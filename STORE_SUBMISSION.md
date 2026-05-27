# Chrome Web Store Submission

Use this file as the source of truth when filling out the Chrome Web Store Developer Dashboard.

## Product Details

Name: Sunbeam Cookie Jar

Category: Developer Tools

Single purpose:
Sunbeam Cookie Jar is a local-only developer tool for managing cookies for the current site after the user grants site access.

Short description:
Local-only current-site cookie manager with safe import, export, edit, and delete tools for developers.

Detailed description:
Sunbeam Cookie Jar helps developers inspect and manage cookies for the current site without sending cookie data anywhere.

Open the popup, grant access to the current site, then view cookies in a compact table with masked values by default. You can filter by name or domain, reveal values for the current popup session, edit cookies, delete selected cookies, import Lossless JSON, and export selected or current-site cookies.

Export formats:
- Lossless JSON
- Redacted JSON
- Netscape cookies.txt
- Cookie Header
- Set-Cookie lines
- CSV

Privacy and safety:
- Local-only
- No backend
- No analytics
- No tracking
- No cloud sync
- No remote code
- No automatic background cookie export
- Optional per-site host access
- Real-value exports show a warning before download
- Default export scope is selected cookies or the current tab URL, not all browser cookies

## Store Listing Assets

Icon:
- `public/icons/icon128.png`

Screenshots:
- `store-assets/screenshots/01-current-site-cookie-table-1280x800.png`
- `store-assets/screenshots/02-export-warning-1280x800.png`
- `store-assets/screenshots/03-export-formats-1280x800.png`
- `store-assets/screenshots/04-import-preview-1280x800.png`
- `store-assets/screenshots/05-local-only-privacy-1280x800.png`

Promotional images:
- Small promo tile: `store-assets/promotional/small-promo-440x280.png`
- Marquee promo tile: `store-assets/promotional/marquee-1400x560.png`

## Privacy Practices

Data collection:
The extension does not collect, transmit, sell, or share user data. Cookie values are accessed locally in Chrome only after explicit user action and site access. Cookie values are never sent to a backend because there is no backend.

Data usage:
Cookie data is used only to display, edit, delete, import, or export cookies as requested by the user.

Storage:
The extension uses `chrome.storage.local` only for local UI settings, such as the preferred export format. It does not store cookie values.

Export:
Exports are local Blob downloads created only after user action. Real-value export formats show a warning before download. Redacted JSON replaces cookie values with `***REDACTED***`.

Privacy policy:
Use `docs/privacy-policy.md` as the policy text. Host it at a public URL before submitting if the Chrome Web Store dashboard requires a URL.

## Permission Justifications

`cookies`:
Required to read, edit, delete, import, and export cookies for sites where the user has granted access.

`storage`:
Used only for local UI preferences, such as the preferred export format. Cookie values are not stored.

`activeTab`:
Used to identify the current tab and show the current origin when the user opens the popup.

Optional host permissions `http://*/*` and `https://*/*`:
Used to request per-site access only after the user opens the popup and clicks the grant button. The extension does not request required `<all_urls>` or required `host_permissions`.

## Release Build

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run verify:store-assets
npm run test:e2e:github
npm run package:store
```

Upload the generated zip:

```text
release/sunbeam-cookie-jar-0.1.0.zip
```
