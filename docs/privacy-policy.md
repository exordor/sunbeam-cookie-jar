# Privacy Policy for Sunbeam Cookie Jar

Last updated: May 27, 2026

Sunbeam Cookie Jar is a local-only Chrome extension for developers who need to manage cookies for the current site.

## Data Collection

Sunbeam Cookie Jar does not collect, transmit, sell, rent, or share user data.

The extension has no backend, no analytics, no tracking, no cloud sync, no remote code, and no automatic background cookie export.

## Cookie Access

The extension can access cookies only for sites where the user grants access. Cookie access is used only to provide the extension's core features:

- View current-site cookies
- Edit cookies
- Delete selected cookies
- Import supported Lossless JSON cookie files
- Export selected or current-site cookies in user-selected formats

Cookie values are masked by default in the popup. Revealing values is a user action for the current popup session.

## Local Storage

The extension uses `chrome.storage.local` only for local UI settings, such as the preferred export format.

The extension does not store cookie values in `chrome.storage.local`.

## Exports

Exports are created only after user action and are downloaded locally by the browser.

Some export formats can contain real cookie values. Before those exports are created, the extension shows a warning. Redacted JSON replaces cookie values with `***REDACTED***`.

## Imports

The extension currently imports only Lossless JSON v1 files. Imports are previewed before changes are applied. Overwriting existing cookies requires confirmation.

## Contact

For support, use the support contact configured in the Chrome Web Store listing or the project's GitHub issue tracker if a public repository is available.
