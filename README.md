# Sunbeam Cookie Jar

Sunbeam Cookie Jar is a local-only Chrome Manifest V3 extension for viewing, editing, deleting, importing, and exporting cookies for the current site.

It is intentionally private by design:

- no backend
- no analytics
- no tracking
- no cloud sync
- no remote code
- no automatic background cookie export
- no required `<all_urls>` permission

Host access is optional and requested only for the current site after the popup is opened.

## Development

```bash
npm ci
npm run typecheck
npm test
npm run build
```

Load the built extension from:

```text
/Users/jlw/code/cookie-manager/dist
```

For a local unpacked install, open `chrome://extensions`, enable Developer Mode, choose **Load unpacked**, and select `dist/`.

## GitHub E2E Test

The GitHub Playwright test launches Chromium with the unpacked extension, opens `https://github.com/`, reads GitHub cookies through the real Chrome extension APIs, and captures screenshots. In CI, it uses a copied test fixture with GitHub host access pregranted so Chrome's native permission prompt does not require a human click. The production manifest still uses optional host permissions only.

```bash
npm run build
npm run test:e2e:github
```

Screenshots are written to:

```text
test-results/github-popup.png
test-results/github-export-warning.png
```

## Export Formats

- Lossless JSON
- Netscape cookies.txt
- Cookie Header
- Set-Cookie lines
- CSV
- Redacted JSON

Lossless JSON preserves cookie fields including `storeId` and `partitionKey` when present.

## Chrome Web Store

Generate and verify store assets:

```bash
npm run generate:store-assets
npm run verify:store-assets
```

Create the upload zip:

```bash
npm run package:store
```

Chrome Web Store submission materials are in:

- `STORE_SUBMISSION.md`
- `docs/privacy-policy.md`
- `docs/release-checklist.md`
- `store-assets/`

## GitHub Pages

Build the public showcase site locally:

```bash
npm run build:pages
```

The deployed site is configured for:

```text
https://exordor.github.io/sunbeam-cookie-jar/
```

The public privacy policy URL is:

```text
https://exordor.github.io/sunbeam-cookie-jar/privacy.html
```
