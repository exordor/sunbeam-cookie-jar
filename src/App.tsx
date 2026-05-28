import { useEffect, useMemo, useRef, useState } from "react";
import {
  getActivePage,
  getStoredExportFormat,
  hasOriginPermissions,
  isChromeExtensionRuntime,
  loadCookiesForSite,
  loadCookiesForUrl,
  removeCookie,
  requestOriginPermissions,
  setCookie,
  setStoredExportFormat,
  type ActivePage
} from "./chromeApi";
import { cookieIdentityKey, cookieMatchesUrl, cookieUrl } from "./cookieIdentity";
import { formatExport } from "./exportFormats";
import { applyablePreviewItems, buildImportPreview, parseLosslessImport } from "./importPreview";
import type { ExportFormat, ExportScope, ImportPreview, LosslessExportV1, SerializableCookie } from "./types";

const EXPORT_FORMATS: Array<{ value: ExportFormat; label: string }> = [
  { value: "lossless-json", label: "Lossless JSON" },
  { value: "netscape", label: "Netscape cookies.txt" },
  { value: "cookie-header", label: "Cookie Header" },
  { value: "set-cookie", label: "Set-Cookie lines" },
  { value: "csv", label: "CSV" },
  { value: "redacted-json", label: "Redacted JSON" }
];

const demoPage: ActivePage = {
  url: "https://example.test/account",
  origin: "https://example.test",
  siteDomain: "example.test",
  siteOriginPatterns: ["http://example.test/*", "http://*.example.test/*", "https://example.test/*", "https://*.example.test/*"]
};

const demoCookies: SerializableCookie[] = [
  {
    name: "session_id",
    value: "demo-secret-session",
    domain: "example.test",
    hostOnly: true,
    path: "/",
    secure: true,
    httpOnly: true,
    sameSite: "lax",
    session: true,
    storeId: "0"
  },
  {
    name: "theme",
    value: "light",
    domain: "example.test",
    hostOnly: true,
    path: "/",
    secure: true,
    httpOnly: false,
    sameSite: "unspecified",
    session: false,
    expirationDate: 1893456000,
    storeId: "0"
  }
];

interface ExportIntent {
  format: ExportFormat;
  scope: ExportScope;
  cookies: SerializableCookie[];
}

interface ImportState {
  file: LosslessExportV1;
  preview: ImportPreview;
  allowOriginalDomains: boolean;
  overwriteConfirmed: boolean;
  grantedOrigins: string[];
}

type RuntimeMode = "extension" | "preview";

export default function App() {
  const runtimeMode: RuntimeMode = isChromeExtensionRuntime() ? "extension" : "preview";
  const [activePage, setActivePage] = useState<ActivePage | null>(runtimeMode === "preview" ? demoPage : null);
  const [accessGranted, setAccessGranted] = useState(runtimeMode === "preview");
  const [cookies, setCookies] = useState<SerializableCookie[]>(runtimeMode === "preview" ? demoCookies : []);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [showValues, setShowValues] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("lossless-json");
  const [exportIntent, setExportIntent] = useState<ExportIntent | null>(null);
  const [editCookie, setEditCookie] = useState<SerializableCookie | null>(null);
  const [importState, setImportState] = useState<ImportState | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(runtimeMode === "extension");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (runtimeMode === "preview") {
      return;
    }

    let cancelled = false;

    async function initialize() {
      setLoading(true);
      setError("");

      try {
        const [page, storedFormat] = await Promise.all([getActivePage(), getStoredExportFormat()]);
        if (cancelled) {
          return;
        }

        setActivePage(page);
        if (isExportFormat(storedFormat)) {
          setExportFormat(storedFormat);
        }

        const hasAccess = await hasOriginPermissions(page.siteOriginPatterns);
        if (cancelled) {
          return;
        }

        setAccessGranted(hasAccess);
        if (hasAccess) {
          const loadedCookies = await loadCookiesForSite(page);
          if (!cancelled) {
            setCookies(loadedCookies);
          }
        }
      } catch (caught) {
        if (!cancelled) {
          setError(errorMessage(caught));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void initialize();
    return () => {
      cancelled = true;
    };
  }, [runtimeMode]);

  const selectedCookies = useMemo(
    () => cookies.filter((cookie) => selectedKeys.has(cookieIdentityKey(cookie))),
    [cookies, selectedKeys]
  );

  const filteredCookies = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) {
      return cookies;
    }
    return cookies.filter((cookie) => {
      return cookie.name.toLowerCase().includes(query) || cookie.domain.toLowerCase().includes(query);
    });
  }, [cookies, filter]);

  const selectedCookie = selectedCookies.length === 1 ? selectedCookies[0] : null;
  const realValueExport = exportFormat !== "redacted-json";
  const cookieHeaderNeedsSelection = exportFormat === "cookie-header";
  const canExportCurrentOrigin = !cookieHeaderNeedsSelection && cookies.length > 0;
  const canExportSelected = selectedCookies.length > 0;

  async function refreshCookies() {
    if (!activePage || runtimeMode === "preview") {
      return;
    }

    const loadedCookies = await loadCookiesForSite(activePage);
    setCookies(loadedCookies);
    setSelectedKeys((previous) => {
      const available = new Set(loadedCookies.map(cookieIdentityKey));
      return new Set([...previous].filter((key) => available.has(key)));
    });
  }

  async function grantAccess() {
    if (!activePage) {
      return;
    }

    setError("");
    setStatus("");
    setLoading(true);

    try {
      const granted = runtimeMode === "preview" ? true : await requestOriginPermissions(activePage.siteOriginPatterns);
      setAccessGranted(granted);
      if (!granted) {
        setStatus("Access was not granted.");
        return;
      }
      if (runtimeMode === "extension") {
        await refreshCookies();
      }
      setStatus("Access granted for this site.");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }

  async function changeExportFormat(format: ExportFormat) {
    setExportFormat(format);
    if (runtimeMode === "extension") {
      await setStoredExportFormat(format);
    }
  }

  function startExport(kind: ExportScope["type"]) {
    if (!activePage) {
      return;
    }

    if (kind === "current-tab-url" && exportFormat === "cookie-header") {
      setStatus("Cookie Header export requires selected cookies.");
      return;
    }

    const exportCookies = kind === "selected" ? selectedCookies : cookies;
    if (exportCookies.length === 0) {
      setStatus("No cookies available for export.");
      return;
    }

    const scope: ExportScope = {
      type: kind,
      origin: activePage.origin,
      url: activePage.url
    };

    const intent = { format: exportFormat, scope, cookies: exportCookies };
    if (!realValueExport) {
      downloadExport(intent);
      return;
    }

    setExportIntent(intent);
  }

  function downloadExport(intent: ExportIntent) {
    const result = formatExport(intent.format, intent.cookies, intent.scope);
    const blob = new Blob([result.content], { type: result.mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = result.filename;
    link.click();
    URL.revokeObjectURL(url);
    setExportIntent(null);
    setStatus(`Exported ${intent.cookies.length} cookie${intent.cookies.length === 1 ? "" : "s"}.`);
  }

  async function deleteSelected() {
    if (selectedCookies.length === 0) {
      return;
    }

    setError("");
    setStatus("");
    setLoading(true);

    try {
      if (runtimeMode === "extension") {
        await Promise.all(selectedCookies.map(removeCookie));
        await refreshCookies();
      } else {
        setCookies((current) => current.filter((cookie) => !selectedKeys.has(cookieIdentityKey(cookie))));
      }
      setSelectedKeys(new Set());
      setStatus(`Deleted ${selectedCookies.length} cookie${selectedCookies.length === 1 ? "" : "s"}.`);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }

  function toggleCookie(cookie: SerializableCookie) {
    const key = cookieIdentityKey(cookie);
    setSelectedKeys((previous) => {
      const next = new Set(previous);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function toggleAllFiltered(checked: boolean) {
    setSelectedKeys((previous) => {
      const next = new Set(previous);
      for (const cookie of filteredCookies) {
        const key = cookieIdentityKey(cookie);
        if (checked) {
          next.add(key);
        } else {
          next.delete(key);
        }
      }
      return next;
    });
  }

  async function saveEditedCookie(nextCookie: SerializableCookie) {
    if (!editCookie) {
      return;
    }

    setError("");
    setStatus("");
    setLoading(true);

    try {
      const identityChanged = cookieIdentityKey(editCookie) !== cookieIdentityKey(nextCookie);
      if (runtimeMode === "extension") {
        if (identityChanged) {
          await removeCookie(editCookie);
        }
        await setCookie(nextCookie);
        await refreshCookies();
      } else {
        setCookies((current) => {
          const withoutOld = current.filter((cookie) => cookieIdentityKey(cookie) !== cookieIdentityKey(editCookie));
          return [...withoutOld, nextCookie];
        });
      }

      setEditCookie(null);
      setSelectedKeys(new Set([cookieIdentityKey(nextCookie)]));
      setStatus("Cookie saved.");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }

  async function handleImportFile(file: File) {
    if (!activePage) {
      return;
    }

    setError("");
    setStatus("");

    try {
      const text = await file.text();
      const parsed = parseLosslessImport(text);
      const preview = buildImportPreview(parsed, {
        currentUrl: activePage.url,
        existingCookies: cookies,
        allowOriginalDomains: false,
        grantedOrigins: activePage.siteOriginPatterns
      });
      setImportState({
        file: parsed,
        preview,
        allowOriginalDomains: false,
        overwriteConfirmed: false,
        grantedOrigins: activePage.siteOriginPatterns
      });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function updateImportOverride(allowOriginalDomains: boolean) {
    if (!importState || !activePage) {
      return;
    }

    const preview = buildImportPreview(importState.file, {
      currentUrl: activePage.url,
      existingCookies: cookies,
      allowOriginalDomains,
      grantedOrigins: importState.grantedOrigins
    });

    setImportState({
      ...importState,
      allowOriginalDomains,
      overwriteConfirmed: false,
      preview
    });
  }

  async function prepareImportPermissions() {
    if (!importState || !activePage || importState.preview.permissionOrigins.length === 0) {
      return;
    }

    setError("");
    setStatus("");
    setLoading(true);

    try {
      const granted = runtimeMode === "preview" ? true : await requestOriginPermissions(importState.preview.permissionOrigins);
      if (!granted) {
        setStatus("Import permissions were not granted.");
        return;
      }

      const grantedOrigins = [...new Set([...importState.grantedOrigins, ...importState.preview.permissionOrigins])];
      const extraCookies =
        runtimeMode === "extension"
          ? (await Promise.all(
              importState.preview.permissionOrigins.map((originPattern) => loadCookiesForUrl(originPattern.replace(/\*$/, "")))
            )).flat()
          : [];

      const existingCookies = mergeCookies(cookies, extraCookies);
      const preview = buildImportPreview(importState.file, {
        currentUrl: activePage.url,
        existingCookies,
        allowOriginalDomains: importState.allowOriginalDomains,
        grantedOrigins
      });

      setImportState({
        ...importState,
        preview,
        grantedOrigins,
        overwriteConfirmed: false
      });
      setStatus("Permissions granted. Review the updated import preview before applying.");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }

  async function applyImport() {
    if (!importState) {
      return;
    }

    if (importState.preview.permissionOrigins.length > 0) {
      await prepareImportPermissions();
      return;
    }

    const items = applyablePreviewItems(importState.preview);
    if (items.length === 0) {
      setStatus("No importable cookies in this file.");
      return;
    }

    if (importState.preview.counts.overwrite > 0 && !importState.overwriteConfirmed) {
      setStatus("Confirm overwrites before applying the import.");
      return;
    }

    setError("");
    setStatus("");
    setLoading(true);

    try {
      if (runtimeMode === "extension") {
        for (const item of items) {
          await setCookie(item.cookie);
        }
        await refreshCookies();
      } else {
        setCookies((current) => mergeCookies(current, items.map((item) => item.cookie)));
      }

      setImportState(null);
      setStatus(`Imported ${items.length} cookie${items.length === 1 ? "" : "s"}.`);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }

  const allFilteredSelected = filteredCookies.length > 0 && filteredCookies.every((cookie) => selectedKeys.has(cookieIdentityKey(cookie)));

  return (
    <main className="popup-shell">
      <header className="header">
        <div>
          <h1>Sunbeam Cookie Jar</h1>
          <p className="origin">{activePage?.origin ?? "No supported page"}</p>
        </div>
        <button className="ghost-button" type="button" onClick={() => void refreshCookies()} disabled={!accessGranted || loading || runtimeMode === "preview"}>
          Refresh
        </button>
      </header>

      {runtimeMode === "preview" && <div className="notice">Preview mode</div>}
      {error && <div className="alert alert-error">{error}</div>}
      {status && <div className="alert">{status}</div>}

      <section className="access-row" aria-label="Site access">
        <div>
          <strong>{accessGranted ? "Site access granted" : "Site access required"}</strong>
          <span>{accessPatternLabel(activePage)}</span>
        </div>
        <button className="primary-button" type="button" onClick={() => void grantAccess()} disabled={!activePage || accessGranted || loading}>
          Grant access to this site
        </button>
      </section>

      <section className="toolbar" aria-label="Cookie tools">
        <label className="search-label">
          <span>Search</span>
          <input
            type="search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Name or domain"
            disabled={!accessGranted}
          />
        </label>

        <label className="format-label">
          <span>Format</span>
          <select value={exportFormat} onChange={(event) => void changeExportFormat(event.target.value as ExportFormat)} disabled={!accessGranted}>
            {EXPORT_FORMATS.map((format) => (
              <option key={format.value} value={format.value}>
                {format.label}
              </option>
            ))}
          </select>
        </label>

        <button type="button" onClick={() => setShowValues((value) => !value)} disabled={!accessGranted}>
          {showValues ? "Mask values" : "Reveal values"}
        </button>
      </section>

      <section className="actions" aria-label="Cookie actions">
        <button type="button" onClick={() => startExport("selected")} disabled={!accessGranted || !canExportSelected}>
          Export selected
        </button>
        <button type="button" onClick={() => startExport("current-tab-url")} disabled={!accessGranted || !canExportCurrentOrigin}>
          Export current site
        </button>
        <button type="button" onClick={() => selectedCookie && setEditCookie(selectedCookie)} disabled={!accessGranted || !selectedCookie}>
          Edit selected
        </button>
        <button className="danger-button" type="button" onClick={() => void deleteSelected()} disabled={!accessGranted || selectedCookies.length === 0 || loading}>
          Delete selected
        </button>
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={!accessGranted}>
          Import JSON
        </button>
        <input
          ref={fileInputRef}
          className="file-input"
          type="file"
          accept="application/json,.json"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void handleImportFile(file);
            }
          }}
        />
      </section>

      <section className="table-wrap" aria-label="Cookies">
        <table>
          <colgroup>
            <col className="col-selected" />
            <col className="col-name" />
            <col className="col-value" />
            <col className="col-domain" />
            <col className="col-path" />
            <col className="col-secure" />
            <col className="col-http" />
            <col className="col-same-site" />
            <col className="col-session" />
            <col className="col-expiration" />
          </colgroup>
          <thead>
            <tr>
              <th className="select-col">
                <input
                  aria-label="Select all filtered cookies"
                  type="checkbox"
                  checked={allFilteredSelected}
                  disabled={!accessGranted || filteredCookies.length === 0}
                  onChange={(event) => toggleAllFiltered(event.target.checked)}
                />
              </th>
              <th>name</th>
              <th>value</th>
              <th>domain</th>
              <th>path</th>
              <th>secure</th>
              <th>HttpOnly</th>
              <th>SameSite</th>
              <th>session</th>
              <th>expirationDate</th>
            </tr>
          </thead>
          <tbody>
            {filteredCookies.map((cookie) => {
              const key = cookieIdentityKey(cookie);
              return (
                <tr key={key}>
                  <td className="select-col">
                    <input
                      aria-label={`Select ${cookie.name}`}
                      type="checkbox"
                      checked={selectedKeys.has(key)}
                      onChange={() => toggleCookie(cookie)}
                    />
                  </td>
                  <td className="strong-cell">{cookie.name}</td>
                  <td className="value-cell">{showValues ? cookie.value : maskValue(cookie.value)}</td>
                  <td>{cookie.domain}</td>
                  <td>{cookie.path}</td>
                  <td>{booleanMark(cookie.secure)}</td>
                  <td>{booleanMark(cookie.httpOnly)}</td>
                  <td>{cookie.sameSite}</td>
                  <td>{booleanMark(cookie.session)}</td>
                  <td>{formatExpiration(cookie)}</td>
                </tr>
              );
            })}
            {!loading && accessGranted && filteredCookies.length === 0 && (
              <tr>
                <td colSpan={10} className="empty-cell">
                  No cookies match this view.
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={10} className="empty-cell">
                  Loading...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <footer className="footer">
        <span>{cookies.length} site cookie{cookies.length === 1 ? "" : "s"}</span>
        <span>{selectedCookies.length} selected</span>
      </footer>

      {exportIntent && (
        <ExportWarning
          intent={exportIntent}
          onCancel={() => setExportIntent(null)}
          onConfirm={() => downloadExport(exportIntent)}
        />
      )}

      {editCookie && (
        <EditDialog
          cookie={editCookie}
          onCancel={() => setEditCookie(null)}
          onSave={(cookie) => void saveEditedCookie(cookie)}
        />
      )}

      {importState && (
        <ImportDialog
          state={importState}
          loading={loading}
          onCancel={() => setImportState(null)}
          onToggleOverride={updateImportOverride}
          onToggleOverwrite={(overwriteConfirmed) => setImportState({ ...importState, overwriteConfirmed })}
          onApply={() => void applyImport()}
        />
      )}
    </main>
  );
}

function ExportWarning({ intent, onCancel, onConfirm }: { intent: ExportIntent; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="export-warning-title">
        <h2 id="export-warning-title">Export real cookie values?</h2>
        <p>
          Cookie values can contain session tokens or other secrets. This export is created locally, but anyone with the file may be able to use
          those values.
        </p>
        <div className="modal-meta">
          <span>{EXPORT_FORMATS.find((format) => format.value === intent.format)?.label}</span>
          <span>{intent.cookies.length} cookie{intent.cookies.length === 1 ? "" : "s"}</span>
        </div>
        <p className="muted">Choose Redacted JSON to export metadata without real values.</p>
        <div className="modal-actions">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button className="danger-button" type="button" onClick={onConfirm}>
            Export
          </button>
        </div>
      </section>
    </div>
  );
}

function EditDialog({
  cookie,
  onCancel,
  onSave
}: {
  cookie: SerializableCookie;
  onCancel: () => void;
  onSave: (cookie: SerializableCookie) => void;
}) {
  const [draft, setDraft] = useState(cookie);

  function update<K extends keyof SerializableCookie>(key: K, value: SerializableCookie[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal wide-modal" role="dialog" aria-modal="true" aria-labelledby="edit-cookie-title">
        <h2 id="edit-cookie-title">Edit cookie</h2>
        <div className="form-grid">
          <label>
            <span>Name</span>
            <input value={draft.name} onChange={(event) => update("name", event.target.value)} />
          </label>
          <label>
            <span>Value</span>
            <textarea value={draft.value} onChange={(event) => update("value", event.target.value)} rows={4} />
          </label>
          <label>
            <span>Domain</span>
            <input value={draft.domain} onChange={(event) => update("domain", event.target.value)} />
          </label>
          <label>
            <span>Path</span>
            <input value={draft.path} onChange={(event) => update("path", event.target.value)} />
          </label>
          <label>
            <span>SameSite</span>
            <select value={draft.sameSite} onChange={(event) => update("sameSite", event.target.value as SerializableCookie["sameSite"])}>
              <option value="unspecified">unspecified</option>
              <option value="no_restriction">no_restriction</option>
              <option value="lax">lax</option>
              <option value="strict">strict</option>
            </select>
          </label>
          <label>
            <span>ExpirationDate</span>
            <input
              value={draft.expirationDate ?? ""}
              inputMode="numeric"
              onChange={(event) => {
                const value = event.target.value.trim();
                update("expirationDate", value === "" ? undefined : Number(value));
              }}
            />
          </label>
        </div>
        <div className="checkbox-grid">
          <label>
            <input type="checkbox" checked={draft.hostOnly} onChange={(event) => update("hostOnly", event.target.checked)} />
            Host only
          </label>
          <label>
            <input type="checkbox" checked={draft.secure} onChange={(event) => update("secure", event.target.checked)} />
            Secure
          </label>
          <label>
            <input type="checkbox" checked={draft.httpOnly} onChange={(event) => update("httpOnly", event.target.checked)} />
            HttpOnly
          </label>
          <label>
            <input
              type="checkbox"
              checked={draft.session}
              onChange={(event) => {
                update("session", event.target.checked);
                if (event.target.checked) {
                  update("expirationDate", undefined);
                }
              }}
            />
            Session
          </label>
        </div>
        <div className="modal-actions">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button className="primary-button" type="button" onClick={() => onSave(draft)} disabled={!draft.name || !draft.domain || !draft.path.startsWith("/")}>
            Save
          </button>
        </div>
      </section>
    </div>
  );
}

function ImportDialog({
  state,
  loading,
  onCancel,
  onToggleOverride,
  onToggleOverwrite,
  onApply
}: {
  state: ImportState;
  loading: boolean;
  onCancel: () => void;
  onToggleOverride: (allowOriginalDomains: boolean) => void;
  onToggleOverwrite: (overwriteConfirmed: boolean) => void;
  onApply: () => void;
}) {
  const applyableCount = state.preview.counts.create + state.preview.counts.overwrite;
  const needsPermissions = state.preview.permissionOrigins.length > 0;
  const needsOverwriteConfirmation = state.preview.counts.overwrite > 0 && !state.overwriteConfirmed;

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal wide-modal" role="dialog" aria-modal="true" aria-labelledby="import-title">
        <h2 id="import-title">Import preview</h2>
        <div className="summary-grid">
          <span>Create: {state.preview.counts.create}</span>
          <span>Overwrite: {state.preview.counts.overwrite}</span>
          <span>Permission: {state.preview.counts["permission-needed"]}</span>
          <span>Skipped: {state.preview.counts.skipped}</span>
          <span>Invalid: {state.preview.counts.invalid}</span>
        </div>
        <label className="check-row">
          <input type="checkbox" checked={state.allowOriginalDomains} onChange={(event) => onToggleOverride(event.target.checked)} />
          Import cookies into their original domains
        </label>
        {state.preview.counts.overwrite > 0 && (
          <label className="check-row danger-text">
            <input type="checkbox" checked={state.overwriteConfirmed} onChange={(event) => onToggleOverwrite(event.target.checked)} />
            Confirm overwriting existing cookies
          </label>
        )}
        <div className="preview-list">
          {state.preview.items.slice(0, 80).map((item, index) => (
            <div className={`preview-item preview-${item.status}`} key={`${item.cookie.name}-${item.cookie.domain}-${item.cookie.path}-${index}`}>
              <strong>{item.cookie.name}</strong>
              <span>{item.cookie.domain}</span>
              <em>{item.status}</em>
              {item.reason && <small>{item.reason}</small>}
            </div>
          ))}
        </div>
        <div className="modal-actions">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="primary-button"
            type="button"
            onClick={onApply}
            disabled={loading || applyableCount === 0 || needsOverwriteConfirmation}
          >
            {needsPermissions ? "Grant permissions and preview" : "Apply import"}
          </button>
        </div>
      </section>
    </div>
  );
}

function maskValue(value: string): string {
  if (!value) {
    return "(empty)";
  }
  return "•".repeat(Math.min(Math.max(value.length, 6), 18));
}

function booleanMark(value: boolean): string {
  return value ? "Yes" : "No";
}

function formatExpiration(cookie: SerializableCookie): string {
  if (cookie.session || typeof cookie.expirationDate !== "number") {
    return "Session";
  }
  return new Date(cookie.expirationDate * 1000).toISOString().slice(0, 10);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isExportFormat(value: unknown): value is ExportFormat {
  return typeof value === "string" && EXPORT_FORMATS.some((format) => format.value === value);
}

function accessPatternLabel(page: ActivePage | null): string {
  if (!page) {
    return "Open an http or https page";
  }
  return page.siteOriginPatterns.some((pattern) => pattern.includes("*."))
    ? `${page.siteDomain} and subdomains`
    : page.siteDomain;
}

function mergeCookies(base: SerializableCookie[], incoming: SerializableCookie[]): SerializableCookie[] {
  const map = new Map(base.map((cookie) => [cookieIdentityKey(cookie), cookie]));
  for (const cookie of incoming) {
    map.set(cookieIdentityKey(cookie), cookie);
  }
  return [...map.values()];
}
