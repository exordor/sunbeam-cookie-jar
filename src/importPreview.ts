import { cookieIdentityKey, cookieMatchesUrl, cookieTargetOrigin } from "./cookieIdentity";
import { originPatternMatchesOrigin } from "./originPatterns";
import type { ImportPreview, ImportPreviewItem, LosslessExportV1, SerializableCookie } from "./types";

interface PreviewOptions {
  currentUrl: string;
  existingCookies: SerializableCookie[];
  allowOriginalDomains: boolean;
  grantedOrigins?: string[];
}

export function parseLosslessImport(text: string): LosslessExportV1 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Import file is not valid JSON.");
  }

  if (!isLosslessExport(parsed)) {
    throw new Error("Only Local Cookie Manager lossless JSON v1 files can be imported.");
  }

  if (parsed.redacted) {
    throw new Error("Redacted exports cannot be imported because cookie values are not present.");
  }

  return parsed;
}

export function buildImportPreview(importFile: LosslessExportV1, options: PreviewOptions): ImportPreview {
  const existing = new Map(options.existingCookies.map((cookie) => [cookieIdentityKey(cookie), cookie]));
  const granted = new Set(options.grantedOrigins ?? []);
  const items: ImportPreviewItem[] = [];
  const permissionOrigins = new Set<string>();

  for (const cookie of importFile.cookies) {
    const validationError = validateCookie(cookie);
    if (validationError) {
      items.push({ cookie, status: "invalid", reason: validationError });
      continue;
    }

    const matchesCurrentUrl = cookieMatchesUrl(cookie, options.currentUrl);
    const targetOrigin = cookieTargetOrigin(cookie);

    if (!matchesCurrentUrl && !options.allowOriginalDomains) {
      items.push({
        cookie,
        status: "skipped",
        reason: "Different domain. Enable original-domain import to include it.",
        targetOrigin
      });
      continue;
    }

    if (!matchesCurrentUrl && !hasGrantedOrigin(targetOrigin, granted)) {
      permissionOrigins.add(`${targetOrigin}/*`);
      items.push({
        cookie,
        status: "permission-needed",
        reason: "Optional host permission is required for this domain.",
        targetOrigin
      });
      continue;
    }

    items.push({
      cookie,
      status: existing.has(cookieIdentityKey(cookie)) ? "overwrite" : "create",
      targetOrigin
    });
  }

  return {
    items,
    counts: countItems(items),
    permissionOrigins: [...permissionOrigins].sort(),
    sourceUrl: importFile.sourceUrl
  };
}

export function applyablePreviewItems(preview: ImportPreview): ImportPreviewItem[] {
  return preview.items.filter((item) => item.status === "create" || item.status === "overwrite");
}

function hasGrantedOrigin(targetOrigin: string, grantedOrigins: Set<string>): boolean {
  if (grantedOrigins.has(`${targetOrigin}/*`)) {
    return true;
  }
  return [...grantedOrigins].some((originPattern) => originPatternMatchesOrigin(originPattern, targetOrigin));
}

function countItems(items: ImportPreviewItem[]): ImportPreview["counts"] {
  const counts: ImportPreview["counts"] = {
    create: 0,
    overwrite: 0,
    invalid: 0,
    "permission-needed": 0,
    skipped: 0
  };

  for (const item of items) {
    counts[item.status] += 1;
  }

  return counts;
}

function validateCookie(cookie: SerializableCookie): string | undefined {
  if (!cookie.name) {
    return "Cookie name is required.";
  }
  if (!cookie.domain || /\s/.test(cookie.domain)) {
    return "Cookie domain is invalid.";
  }
  if (!cookie.path || !cookie.path.startsWith("/")) {
    return "Cookie path must start with /.";
  }
  if (!cookie.session && typeof cookie.expirationDate !== "number") {
    return "Persistent cookies require expirationDate.";
  }
  if (typeof cookie.expirationDate === "number" && (!Number.isFinite(cookie.expirationDate) || cookie.expirationDate < 0)) {
    return "expirationDate must be a positive Unix timestamp.";
  }
  if (!["no_restriction", "lax", "strict", "unspecified"].includes(cookie.sameSite)) {
    return "sameSite value is invalid.";
  }
  return undefined;
}

function isLosslessExport(value: unknown): value is LosslessExportV1 {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<LosslessExportV1>;
  return (
    candidate.format === "local-cookie-manager-v1" &&
    typeof candidate.exportedAt === "string" &&
    typeof candidate.sourceUrl === "string" &&
    typeof candidate.redacted === "boolean" &&
    typeof candidate.cookieCount === "number" &&
    Array.isArray(candidate.cookies) &&
    typeof candidate.scope === "object" &&
    candidate.scope !== null
  );
}
