import { originPatternMatchesOrigin, siteDomainFromHostname, siteOriginPatterns } from "./originPatterns";

describe("origin patterns", () => {
  it("derives the parent site domain from subdomains", () => {
    expect(siteDomainFromHostname("www.douyin.com")).toBe("douyin.com");
    expect(siteDomainFromHostname("api.service.example.co.uk")).toBe("example.co.uk");
    expect(siteDomainFromHostname("localhost")).toBe("localhost");
    expect(siteDomainFromHostname("127.0.0.1")).toBe("127.0.0.1");
  });

  it("builds host permissions for a site domain and its subdomains", () => {
    expect(siteOriginPatterns("douyin.com", "https:")).toEqual([
      "http://douyin.com/*",
      "http://*.douyin.com/*",
      "https://douyin.com/*",
      "https://*.douyin.com/*"
    ]);
    expect(siteOriginPatterns("localhost", "http:")).toEqual(["http://localhost/*", "https://localhost/*"]);
  });

  it("matches wildcard host patterns against exact and sibling subdomain origins", () => {
    expect(originPatternMatchesOrigin("https://*.douyin.com/*", "https://www.douyin.com")).toBe(true);
    expect(originPatternMatchesOrigin("https://*.douyin.com/*", "https://lf-zf.douyin.com")).toBe(true);
    expect(originPatternMatchesOrigin("https://douyin.com/*", "https://lf-zf.douyin.com")).toBe(false);
    expect(originPatternMatchesOrigin("http://*.douyin.com/*", "https://www.douyin.com")).toBe(false);
  });
});
