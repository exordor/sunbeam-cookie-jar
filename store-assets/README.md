# Store Assets

Generated Chrome Web Store assets for Sunbeam Cookie Jar.

## Files

Screenshots:

- `screenshots/01-current-site-cookie-table-1280x800.png`
- `screenshots/02-export-warning-1280x800.png`
- `screenshots/03-export-formats-1280x800.png`
- `screenshots/04-import-preview-1280x800.png`
- `screenshots/05-local-only-privacy-1280x800.png`

Promotional images:

- `promotional/small-promo-440x280.png`
- `promotional/marquee-1400x560.png`

The source generator is `scripts/generate-store-assets.mjs`.

```bash
npm run test:e2e:github
npm run generate:store-assets
npm run verify:store-assets
```
