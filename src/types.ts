export type SameSiteStatus = "no_restriction" | "lax" | "strict" | "unspecified";

export interface CookiePartitionKey {
  topLevelSite?: string;
  hasCrossSiteAncestor?: boolean;
  [key: string]: unknown;
}

export interface SerializableCookie {
  name: string;
  value: string;
  domain: string;
  hostOnly: boolean;
  path: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite: SameSiteStatus;
  session: boolean;
  expirationDate?: number;
  storeId: string;
  partitionKey?: CookiePartitionKey;
}

export interface ExportScope {
  type: "selected" | "current-tab-url";
  origin: string;
  url: string;
}

export interface LosslessExportV1 {
  format: "local-cookie-manager-v1";
  exportedAt: string;
  sourceUrl: string;
  scope: ExportScope;
  redacted: boolean;
  cookieCount: number;
  cookies: SerializableCookie[];
}

export type ExportFormat =
  | "lossless-json"
  | "netscape"
  | "cookie-header"
  | "set-cookie"
  | "csv"
  | "redacted-json";

export interface ExportResult {
  content: string;
  filename: string;
  mimeType: string;
  containsRealValues: boolean;
}

export interface ImportPreviewItem {
  cookie: SerializableCookie;
  status: "create" | "overwrite" | "invalid" | "permission-needed" | "skipped";
  reason?: string;
  targetOrigin?: string;
}

export interface ImportPreview {
  items: ImportPreviewItem[];
  counts: Record<ImportPreviewItem["status"], number>;
  permissionOrigins: string[];
  sourceUrl: string;
}
