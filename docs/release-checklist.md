# Release Checklist

## Before Upload

- Run `npm ci`
- Update `package.json` and `public/manifest.json` to the same SemVer version
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

## GitHub Release

Releases are automated from stable SemVer tags. Do not use a high version number for early releases; use `v0.x.y` until the extension API and user-facing behavior are stable enough for `v1.0.0`.

Example:

```bash
git tag v0.2.0
git push origin v0.2.0
```

The release workflow will:

- Verify the tag is in `vX.Y.Z` format
- Verify the tag version matches `package.json`
- Verify the tag version matches `public/manifest.json`
- Run typecheck, unit tests, build, store asset verification, and GitHub E2E
- Audit production manifest permissions
- Build the Chrome Web Store zip
- Generate a SHA-256 checksum
- Publish a GitHub Release with both assets attached

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
