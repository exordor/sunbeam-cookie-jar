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

The GitHub Playwright test launches Chromium with the unpacked extension, opens `https://github.com/`, grants optional host access, reads GitHub cookies through the real Chrome extension APIs, opens the action popup, and captures screenshots.

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
