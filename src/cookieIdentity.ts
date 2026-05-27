import type { CookiePartitionKey, SerializableCookie } from "./types";

export function normalizeCookieDomain(domain: string): string {
  return domain.trim().replace(/^\./, "").toLowerCase();
}

export function normalizePath(path: string): string {
  if (!path) {
    return "/";
  }
  return path.startsWith("/") ? path : `/${path}`;
}

export function partitionKeyString(partitionKey?: CookiePartitionKey): string {
  if (!partitionKey) {
    return "";
  }
  return JSON.stringify(partitionKey, Object.keys(partitionKey).sort());
}

export function cookieIdentityKey(cookie: Pick<SerializableCookie, "domain" | "name" | "path" | "storeId" | "partitionKey">): string {
  return [
    normalizeCookieDomain(cookie.domain),
    normalizePath(cookie.path),
    cookie.name,
    cookie.storeId,
    partitionKeyString(cookie.partitionKey)
  ].join("\u0000");
}

export function cookieUrl(cookie: Pick<SerializableCookie, "domain" | "path" | "secure">): string {
  const protocol = cookie.secure ? "https" : "http";
  const host = normalizeCookieDomain(cookie.domain);
  const path = normalizePath(cookie.path);
  return `${protocol}://${host}${path}`;
}

export function cookieTargetOrigin(cookie: Pick<SerializableCookie, "domain" | "secure">): string {
  const protocol = cookie.secure ? "https" : "http";
  return `${protocol}://${normalizeCookieDomain(cookie.domain)}`;
}

export function cookieMatchesUrl(cookie: Pick<SerializableCookie, "domain" | "hostOnly">, url: string): boolean {
  const host = new URL(url).hostname.toLowerCase();
  const domain = normalizeCookieDomain(cookie.domain);
  if (cookie.hostOnly) {
    return host === domain;
  }
  return host === domain || host.endsWith(`.${domain}`);
}

export function toSetDetails(cookie: SerializableCookie): chrome.cookies.SetDetails {
  const details: chrome.cookies.SetDetails = {
    url: cookieUrl(cookie),
    name: cookie.name,
    value: cookie.value,
    path: normalizePath(cookie.path),
    secure: cookie.secure,
    httpOnly: cookie.httpOnly,
    sameSite: cookie.sameSite,
    storeId: cookie.storeId
  };

  if (!cookie.hostOnly) {
    details.domain = cookie.domain;
  }

  if (!cookie.session && typeof cookie.expirationDate === "number") {
    details.expirationDate = cookie.expirationDate;
  }

  if (cookie.partitionKey) {
    details.partitionKey = cookie.partitionKey as chrome.cookies.CookiePartitionKey;
  }

  return details;
}

export function toRemoveDetails(cookie: SerializableCookie): chrome.cookies.CookieDetails {
  const details: chrome.cookies.CookieDetails = {
    url: cookieUrl(cookie),
    name: cookie.name,
    storeId: cookie.storeId
  };

  if (cookie.partitionKey) {
    details.partitionKey = cookie.partitionKey as chrome.cookies.CookiePartitionKey;
  }

  return details;
}
