# Release Checklist

## Before Upload

- Run `npm ci`
- Run `npm run typecheck`
- Run `npm test`
- Run `npm run build`
- Run `npm run verify:store-assets`
- Run `npm run test:e2e:github`
- Run `npm run package:store`

## Manifest Checks

- `manifest_version` is `3`
- Required permissions are only `cookies`, `storage`, and `activeTab`
- `optional_host_permissions` contains `http://*/*` and `https://*/*`
- No required `<all_urls>`
- No required `host_permissions`
- No background service worker
- No content scripts
- Icons are declared for `16`, `32`, `48`, and `128`

## Chrome Web Store Upload

- Upload `release/sunbeam-cookie-jar-0.1.0.zip`
- Upload `public/icons/icon128.png` if the dashboard requests a separate icon
- Upload screenshots from `store-assets/screenshots/`
- Upload promotional images from `store-assets/promotional/`
- Copy listing text from `STORE_SUBMISSION.md`
- Copy privacy policy from `docs/privacy-policy.md`

## Manual Smoke Test

- Load `dist/` as an unpacked extension
- Open an HTTP or HTTPS website
- Open the extension popup
- Grant access to the current site
- Verify cookies are listed with masked values
- Filter by name/domain
- Reveal values
- Export Redacted JSON
- Export Lossless JSON and confirm the warning appears
- Edit one test cookie
- Delete one test cookie
- Import a Lossless JSON file and confirm preview/overwrite behavior
