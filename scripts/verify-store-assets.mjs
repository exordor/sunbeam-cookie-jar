import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const expectedImages = [
  ["public/icons/icon16.png", 16, 16],
  ["public/icons/icon32.png", 32, 32],
  ["public/icons/icon48.png", 48, 48],
  ["public/icons/icon128.png", 128, 128],
  ["store-assets/promotional/small-promo-440x280.png", 440, 280],
  ["store-assets/promotional/marquee-1400x560.png", 1400, 560],
  ["store-assets/screenshots/01-current-site-cookie-table-1280x800.png", 1280, 800],
  ["store-assets/screenshots/02-export-warning-1280x800.png", 1280, 800],
  ["store-assets/screenshots/03-export-formats-1280x800.png", 1280, 800],
  ["store-assets/screenshots/04-import-preview-1280x800.png", 1280, 800],
  ["store-assets/screenshots/05-local-only-privacy-1280x800.png", 1280, 800]
];

for (const [relativePath, expectedWidth, expectedHeight] of expectedImages) {
  const absolutePath = path.join(rootDir, relativePath);
  const { width, height } = readPngSize(absolutePath);
  if (width !== expectedWidth || height !== expectedHeight) {
    throw new Error(`${relativePath} must be ${expectedWidth}x${expectedHeight}, got ${width}x${height}`);
  }
}

const manifest = JSON.parse(fs.readFileSync(path.join(rootDir, "public", "manifest.json"), "utf8"));
for (const size of ["16", "32", "48", "128"]) {
  if (manifest.icons?.[size] !== `icons/icon${size}.png`) {
    throw new Error(`manifest.icons.${size} must point to icons/icon${size}.png`);
  }
  if (manifest.action?.default_icon?.[size] !== `icons/icon${size}.png`) {
    throw new Error(`manifest.action.default_icon.${size} must point to icons/icon${size}.png`);
  }
}
if (manifest.host_permissions) {
  throw new Error("Production manifest must not declare required host_permissions.");
}
if ((manifest.permissions ?? []).includes("<all_urls>")) {
  throw new Error("Production manifest must not request <all_urls>.");
}
if (!manifest.optional_host_permissions?.includes("http://*/*") || !manifest.optional_host_permissions?.includes("https://*/*")) {
  throw new Error("Production manifest must declare http/https optional host permissions.");
}

console.log("Store assets and production manifest checks passed.");

function readPngSize(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing image: ${path.relative(rootDir, filePath)}`);
  }
  const buffer = fs.readFileSync(filePath);
  if (buffer.toString("ascii", 1, 4) !== "PNG") {
    throw new Error(`${path.relative(rootDir, filePath)} is not a PNG.`);
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}
