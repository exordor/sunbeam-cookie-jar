import {
  createLosslessExport,
  encodeCookieHeaderPart,
  formatCookieHeader,
  formatCsv,
  formatExport,
  formatNetscapeCookies,
  formatSetCookieLines
} from "./exportFormats";
import type { ExportScope, SerializableCookie } from "./types";

const scope: ExportScope = {
  type: "selected",
  origin: "https://example.test",
  url: "https://example.test/path"
};

const cookies: SerializableCookie[] = [
  {
    name: "sid",
    value: "secret value",
    domain: "example.test",
    hostOnly: true,
    path: "/",
    secure: true,
    httpOnly: true,
    sameSite: "lax",
    session: true,
    storeId: "0",
    partitionKey: { topLevelSite: "https://example.test", hasCrossSiteAncestor: false }
  },
  {
    name: "prefs",
    value: "a,b\n\"c\"",
    domain: ".example.test",
    hostOnly: false,
    path: "/settings",
    secure: false,
    httpOnly: false,
    sameSite: "strict",
    session: false,
    expirationDate: 1893456000,
    storeId: "0"
  }
];

describe("export formats", () => {
  it("creates lossless JSON metadata and preserves cookie fields", () => {
    const result = createLosslessExport(cookies, scope, false, "2026-05-27T10:00:00.000Z");

    expect(result).toEqual({
      format: "local-cookie-manager-v1",
      exportedAt: "2026-05-27T10:00:00.000Z",
      sourceUrl: scope.url,
      scope,
      redacted: false,
      cookieCount: 2,
      cookies
    });
    expect(result.cookies[0].partitionKey).toEqual({ topLevelSite: "https://example.test", hasCrossSiteAncestor: false });
  });

  it("redacts JSON values without changing metadata shape", () => {
    const result = formatExport("redacted-json", cookies, scope, "2026-05-27T10:00:00.000Z");
    const parsed = JSON.parse(result.content);

    expect(result.containsRealValues).toBe(false);
    expect(parsed.redacted).toBe(true);
    expect(parsed.cookieCount).toBe(2);
    expect(parsed.cookies.map((cookie: SerializableCookie) => cookie.value)).toEqual(["***REDACTED***", "***REDACTED***"]);
  });

  it("formats Netscape cookies with tabs, HttpOnly prefix, flags, and session expiration", () => {
    const result = formatNetscapeCookies(cookies);
    const lines = result.trim().split("\n");

    expect(lines[0]).toBe("# Netscape HTTP Cookie File");
    expect(lines[2]).toBe("#HttpOnly_example.test\tFALSE\t/\tTRUE\t0\tsid\tsecret value");
    expect(lines[3]).toBe(".example.test\tTRUE\t/settings\tFALSE\t1893456000\tprefs\ta%2Cb%0A%22c%22");
    expect(lines[2].split("\t")).toHaveLength(7);
    expect(lines[3].split("\t")).toHaveLength(7);
  });

  it("formats Cookie Header with selected cookies and escapes unsafe values", () => {
    expect(encodeCookieHeaderPart("secret value")).toBe("secret%20value");
    expect(formatCookieHeader([cookies[0]])).toBe("Cookie: sid=secret%20value\n");
  });

  it("formats Set-Cookie lines with expected attributes", () => {
    const result = formatSetCookieLines(cookies);

    expect(result).toContain("Set-Cookie: sid=secret%20value; Path=/; Secure; HttpOnly; SameSite=Lax");
    expect(result).toContain(
      "Set-Cookie: prefs=a%2Cb%0A%22c%22; Domain=.example.test; Path=/settings; SameSite=Strict; Expires=Tue, 01 Jan 2030 00:00:00 GMT"
    );
  });

  it("formats CSV with quote, comma, and newline escaping", () => {
    const result = formatCsv(cookies);

    expect(result).toContain("name,value,domain,hostOnly,path,secure,httpOnly,sameSite,session,expirationDate,storeId,partitionKey");
    expect(result).toContain('"a,b\n""c"""');
    expect(result).toContain('"{""topLevelSite"":""https://example.test"",""hasCrossSiteAncestor"":false}"');
  });
});
