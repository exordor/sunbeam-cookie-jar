const COMMON_SECOND_LEVEL_SUFFIXES = new Set([
  "ac.uk",
  "co.jp",
  "co.kr",
  "co.nz",
  "co.uk",
  "com.au",
  "com.br",
  "com.cn",
  "com.hk",
  "com.sg",
  "com.tw",
  "gov.uk",
  "net.au",
  "net.cn",
  "org.au",
  "org.cn",
  "org.uk"
]);

export function siteDomainFromHostname(hostname: string): string {
  const host = hostname.trim().toLowerCase().replace(/\.$/, "");
  if (!host || host === "localhost" || isIpAddress(host)) {
    return host;
  }

  const labels = host.split(".").filter(Boolean);
  if (labels.length <= 2) {
    return host;
  }

  const lastTwo = labels.slice(-2).join(".");
  if (COMMON_SECOND_LEVEL_SUFFIXES.has(lastTwo) && labels.length >= 3) {
    return labels.slice(-3).join(".");
  }

  return lastTwo;
}

export function siteOriginPatterns(siteDomain: string, protocol: string): string[] {
  const normalizedDomain = siteDomain.trim().toLowerCase().replace(/\.$/, "");
  const schemes = normalSiteSchemes(protocol);
  const hosts = [normalizedDomain];

  if (shouldIncludeSubdomains(normalizedDomain)) {
    hosts.push(`*.${normalizedDomain}`);
  }

  return [...new Set(schemes.flatMap((scheme) => hosts.map((host) => `${scheme}://${host}/*`)))];
}

export function originPatternMatchesOrigin(pattern: string, origin: string): boolean {
  const parsedPattern = parseOriginPattern(pattern);
  if (!parsedPattern) {
    return false;
  }

  let parsedOrigin: URL;
  try {
    parsedOrigin = new URL(origin);
  } catch {
    return false;
  }

  const originScheme = parsedOrigin.protocol.replace(/:$/, "");
  const originHost = parsedOrigin.hostname.toLowerCase();
  const schemeMatches = parsedPattern.scheme === "*" || parsedPattern.scheme === originScheme;
  if (!schemeMatches) {
    return false;
  }

  if (parsedPattern.host.startsWith("*.")) {
    const domain = parsedPattern.host.slice(2);
    return originHost === domain || originHost.endsWith(`.${domain}`);
  }

  return parsedPattern.host === "*" || parsedPattern.host === originHost;
}

function normalSiteSchemes(protocol: string): string[] {
  if (protocol === "http:" || protocol === "https:") {
    return ["http", "https"];
  }
  return [protocol.replace(/:$/, "")];
}

function shouldIncludeSubdomains(host: string): boolean {
  return Boolean(host) && host !== "localhost" && !isIpAddress(host);
}

function isIpAddress(host: string): boolean {
  return isIpv4Address(host) || host.includes(":");
}

function isIpv4Address(host: string): boolean {
  const parts = host.split(".");
  return (
    parts.length === 4 &&
    parts.every((part) => {
      if (!/^\d+$/.test(part)) {
        return false;
      }
      const value = Number(part);
      return value >= 0 && value <= 255;
    })
  );
}

function parseOriginPattern(pattern: string): { scheme: string; host: string } | null {
  const match = /^(\*|https?|file|ftp):\/\/([^/]+)\/\*$/.exec(pattern.trim().toLowerCase());
  if (!match) {
    return null;
  }
  return {
    scheme: match[1],
    host: match[2]
  };
}
