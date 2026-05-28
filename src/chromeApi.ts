import { cookieIdentityKey, toRemoveDetails, toSetDetails } from "./cookieIdentity";
import { toSerializableCookie } from "./exportFormats";
import { siteDomainFromHostname, siteOriginPatterns } from "./originPatterns";
import type { SerializableCookie } from "./types";

export interface ActivePage {
  tabId?: number;
  url: string;
  origin: string;
  siteDomain: string;
  siteOriginPatterns: string[];
}

export function isChromeExtensionRuntime(): boolean {
  return typeof chrome !== "undefined" && Boolean(chrome.tabs && chrome.cookies && chrome.permissions);
}

export async function getActivePage(): Promise<ActivePage> {
  const tabs = await queryTabsWithRetry({ active: true, lastFocusedWindow: true });
  const fallbackTabs = tabs.some((tab) => isSupportedTabUrl(tab.url)) ? tabs : await queryTabs({ active: true });
  const allTabs = fallbackTabs.some((tab) => isSupportedTabUrl(tab.url)) ? fallbackTabs : await queryTabs({});

  const tab = allTabs
    .filter((candidate) => isSupportedTabUrl(candidate.url))
    .sort((left, right) => (right.lastAccessed ?? 0) - (left.lastAccessed ?? 0))[0];
  if (!tab?.url) {
    throw new Error("No active tab URL is available.");
  }

  const parsed = new URL(tab.url);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Cookie access is available for http and https pages.");
  }

  const siteDomain = siteDomainFromHostname(parsed.hostname);

  return {
    tabId: tab.id,
    url: parsed.href,
    origin: parsed.origin,
    siteDomain,
    siteOriginPatterns: siteOriginPatterns(siteDomain, parsed.protocol)
  };
}

async function queryTabsWithRetry(queryInfo: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab[]> {
  let lastResult: chrome.tabs.Tab[] = [];

  for (let attempt = 0; attempt < 10; attempt += 1) {
    lastResult = await queryTabs(queryInfo);
    if (lastResult.some((tab) => isSupportedTabUrl(tab.url))) {
      return lastResult;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return lastResult;
}

function isSupportedTabUrl(url: string | undefined): boolean {
  if (!url) {
    return false;
  }
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

async function queryTabs(queryInfo: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab[]> {
  return new Promise((resolve, reject) => {
    chrome.tabs.query(queryInfo, (result) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(result);
    });
  });
}

export async function hasOriginPermissions(originPatterns: string[]): Promise<boolean> {
  return new Promise((resolve, reject) => {
    chrome.permissions.contains({ origins: originPatterns }, (hasPermission) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(hasPermission);
    });
  });
}

export async function requestOriginPermissions(originPatterns: string[]): Promise<boolean> {
  return new Promise((resolve, reject) => {
    chrome.permissions.request({ origins: originPatterns }, (granted) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(granted);
    });
  });
}

export async function loadCookiesForUrl(url: string): Promise<SerializableCookie[]> {
  return (await getCookies({ url })).map(toSerializableCookie);
}

export async function loadCookiesForSite(page: ActivePage): Promise<SerializableCookie[]> {
  const [domainCookies, urlCookies] = await Promise.all([
    getCookies({ domain: page.siteDomain }),
    getCookies({ url: page.url })
  ]);

  return uniqueCookies([...domainCookies, ...urlCookies].map(toSerializableCookie));
}

async function getCookies(details: chrome.cookies.GetAllDetails): Promise<chrome.cookies.Cookie[]> {
  return new Promise((resolve, reject) => {
    chrome.cookies.getAll(details, (result) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(result);
    });
  });
}

function uniqueCookies(cookies: SerializableCookie[]): SerializableCookie[] {
  const map = new Map<string, SerializableCookie>();
  for (const cookie of cookies) {
    map.set(cookieIdentityKey(cookie), cookie);
  }
  return [...map.values()];
}

export async function removeCookie(cookie: SerializableCookie): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    chrome.cookies.remove(toRemoveDetails(cookie), () => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve();
    });
  });
}

export async function setCookie(cookie: SerializableCookie): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    chrome.cookies.set(toSetDetails(cookie), () => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve();
    });
  });
}

export async function getStoredExportFormat(): Promise<string | undefined> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get("exportFormat", (result) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(result.exportFormat);
    });
  });
}

export async function setStoredExportFormat(format: string): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ exportFormat: format }, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve();
    });
  });
}
