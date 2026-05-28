import { cookieIdentityKey, cookieUrl, toRemoveDetails, toSetDetails } from "./cookieIdentity";
import { buildImportPreview, parseLosslessImport } from "./importPreview";
import type { LosslessExportV1, SerializableCookie } from "./types";

const currentUrl = "https://app.example.test/dashboard";

const sameDomainCookie: SerializableCookie = {
  name: "sid",
  value: "secret",
  domain: "app.example.test",
  hostOnly: true,
  path: "/",
  secure: true,
  httpOnly: true,
  sameSite: "lax",
  session: true,
  storeId: "0",
  partitionKey: { topLevelSite: "https://app.example.test" }
};

const otherDomainCookie: SerializableCookie = {
  name: "sid",
  value: "other",
  domain: "other.example.test",
  hostOnly: true,
  path: "/",
  secure: true,
  httpOnly: false,
  sameSite: "unspecified",
  session: false,
  expirationDate: 1893456000,
  storeId: "1"
};

function file(cookies: SerializableCookie[], redacted = false): LosslessExportV1 {
  return {
    format: "local-cookie-manager-v1",
    exportedAt: "2026-05-27T10:00:00.000Z",
    sourceUrl: currentUrl,
    scope: {
      type: "selected",
      origin: "https://app.example.test",
      url: currentUrl
    },
    redacted,
    cookieCount: cookies.length,
    cookies
  };
}

describe("import preview", () => {
  it("rejects non-v1 and redacted imports", () => {
    expect(() => parseLosslessImport("{}")).toThrow("Only Local Cookie Manager lossless JSON v1 files");
    expect(() => parseLosslessImport(JSON.stringify(file([sameDomainCookie], true)))).toThrow("Redacted exports cannot be imported");
  });

  it("marks creates and overwrites by cookie identity", () => {
    const preview = buildImportPreview(file([sameDomainCookie]), {
      currentUrl,
      existingCookies: [{ ...sameDomainCookie, value: "old" }],
      allowOriginalDomains: false,
      grantedOrigins: ["https://app.example.test/*"]
    });

    const oldCookie: SerializableCookie = { ...sameDomainCookie, value: "old" };
    expect(cookieIdentityKey(sameDomainCookie)).toBe(cookieIdentityKey(oldCookie));
    expect(preview.counts.overwrite).toBe(1);
    expect(preview.items[0].status).toBe("overwrite");
  });

  it("skips cross-domain cookies unless original-domain import is enabled", () => {
    const preview = buildImportPreview(file([otherDomainCookie]), {
      currentUrl,
      existingCookies: [],
      allowOriginalDomains: false,
      grantedOrigins: ["https://app.example.test/*"]
    });

    expect(preview.counts.skipped).toBe(1);
    expect(preview.items[0].reason).toContain("Different domain");
  });

  it("marks cross-domain cookies as permission-needed before import can apply", () => {
    const preview = buildImportPreview(file([otherDomainCookie]), {
      currentUrl,
      existingCookies: [],
      allowOriginalDomains: true,
      grantedOrigins: ["https://app.example.test/*"]
    });

    expect(preview.counts["permission-needed"]).toBe(1);
    expect(preview.permissionOrigins).toEqual(["https://other.example.test/*"]);
  });

  it("allows cross-domain cookies after explicit permission is granted", () => {
    const preview = buildImportPreview(file([otherDomainCookie]), {
      currentUrl,
      existingCookies: [],
      allowOriginalDomains: true,
      grantedOrigins: ["https://app.example.test/*", "https://other.example.test/*"]
    });

    expect(preview.counts.create).toBe(1);
    expect(preview.items[0].status).toBe("create");
  });

  it("treats wildcard site permissions as granting sibling subdomains", () => {
    const preview = buildImportPreview(file([otherDomainCookie]), {
      currentUrl,
      existingCookies: [],
      allowOriginalDomains: true,
      grantedOrigins: ["https://*.example.test/*"]
    });

    expect(preview.counts.create).toBe(1);
    expect(preview.permissionOrigins).toEqual([]);
  });

  it("validates malformed cookies", () => {
    const preview = buildImportPreview(file([{ ...sameDomainCookie, path: "missing-slash" }]), {
      currentUrl,
      existingCookies: [],
      allowOriginalDomains: false,
      grantedOrigins: ["https://app.example.test/*"]
    });

    expect(preview.counts.invalid).toBe(1);
    expect(preview.items[0].reason).toContain("path");
  });

  it("builds Chrome cookie details while preserving storeId and partitionKey", () => {
    expect(cookieUrl(sameDomainCookie)).toBe("https://app.example.test/");
    expect(toSetDetails(sameDomainCookie)).toMatchObject({
      url: "https://app.example.test/",
      name: "sid",
      value: "secret",
      storeId: "0",
      partitionKey: { topLevelSite: "https://app.example.test" }
    });
    expect(toRemoveDetails(sameDomainCookie)).toMatchObject({
      url: "https://app.example.test/",
      name: "sid",
      storeId: "0",
      partitionKey: { topLevelSite: "https://app.example.test" }
    });
  });
});
