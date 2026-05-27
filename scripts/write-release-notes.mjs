import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const tag = process.env.RELEASE_TAG ?? "";
if (!/^v\d+\.\d+\.\d+$/.test(tag)) {
  throw new Error(`RELEASE_TAG must use stable SemVer format vX.Y.Z. Received: ${tag || "(empty)"}`);
}

const version = tag.slice(1);
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const shortSha = execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
const zipName = `${pkg.name}-${version}.zip`;
const checksumName = `${pkg.name}-${version}.sha256`;
const outDir = path.join(process.cwd(), "release");
const outPath = path.join(outDir, "release-notes.md");

fs.mkdirSync(outDir, { recursive: true });

const notes = `## Sunbeam Cookie Jar ${tag}

Release ${tag} of Sunbeam Cookie Jar, a local-only Chrome Manifest V3 cookie manager for developers.

### Highlights

- View current-site cookies in a compact table.
- Filter cookies by cookie name and domain.
- Mask cookie values by default; revealing values is explicit and session-only.
- Edit cookies, delete selected cookies, and import Lossless JSON v1 with a preview diff.
- Export cookies as Lossless JSON, Redacted JSON, Netscape cookies.txt, Cookie Header, Set-Cookie lines, and CSV.
- Show a clear warning before exporting real cookie values.
- Use optional per-site host permissions instead of required \`<all_urls>\`.

### Privacy posture

- No backend.
- No analytics.
- No tracking.
- No cloud sync.
- No remote code.
- No automatic background cookie export.
- \`chrome.storage.local\` is used only for local UI settings, not cookie values.

### Installation from this release

1. Download \`${zipName}\` from the assets below.
2. Unzip it locally.
3. Open \`chrome://extensions\`.
4. Enable **Developer mode**.
5. Choose **Load unpacked** and select the unzipped extension folder.

This release asset is an unpacked-extension zip for local installation and Chrome Web Store submission preparation. It is not a Chrome Web Store signed package yet.

### Verification

This release was built from commit \`${shortSha}\` and verified with:

- TypeScript typecheck
- Vitest unit tests
- Production extension build
- Store asset validation
- Playwright GitHub E2E test
- Manifest permission audit
- Chrome Web Store zip packaging

### Assets

- \`${zipName}\`
- \`${checksumName}\`
`;

fs.writeFileSync(outPath, notes);
console.log(`Wrote ${path.relative(process.cwd(), outPath)}`);
