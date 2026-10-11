# Verification record

Date: 2026-10-11. Environment: Node 24.21.0, macOS, isolated Playwright Chromium 156. Dependency install reported zero known vulnerabilities at the time of installation.

## Completed

- `npm run check`: strict TypeScript check, five test groups, extension build.
- Unit coverage: exact/missing/fabricated quotations; invalid categories; oversized/empty/unsupported inputs; domain lookalikes; non-mutating personalization; Gemini request shape, missing configuration, quota errors and empty responses. Provider requests use a test stub, not Google's live service.
- `npm run test:browser`: actual unpacked extension loaded in a temporary Chromium profile. Checked popup loading, three fictional cards, priority ordering, local-storage persistence after reload, disposal of demo findings on reload, restricted-page error handling, and absence of uncaught page errors.
- Generated and visually inspected `dist/prototype-preview.png`: readable layout, distinct demo labels, priorities and evidence visible. Build outputs are ignored by Git.
- Read-only ToS;DR and PrivacySpy API probes: see research table. Search results were manually inspected for known/unknown/lookalike cases.
- Browser tests close and remove their temporary profile. No upstream extension was installed into the user's ordinary browser.

## Not yet verified

- Real user toolbar invocation and activeTab capture on third-party sites. Browser automation covers the popup and restricted-page state, not this permission-grant interaction.
- Extraction completeness, selected-text capture, dynamic policies, PDFs, and cross-origin iframes across a representative corpus.
- Live Gemini quality, cost, model availability and latency. No credential was requested or used.
- Community ingestion, caching and combined UI; automatic consent reminders; policy change detection.
- GitHub-hosted CI results, until the pushed workflow actually runs.

## Manual Chrome checks

1. Build and load `dist/extension` using Chrome's Load unpacked action.
2. Open an HTTP(S) policy page. Click the toolbar extension action and Review page text. Compare the preview with the visible main content.
3. Select a clause, reopen the popup, and capture. Confirm only the selection appears and the partial-review label is shown.
4. Try empty and over-60,000-character pages/selections. Confirm an error, no retained old findings and no silent truncation.
5. Check priorities, close/reopen the popup, and verify they persist while captured text does not.
6. Run the fictional example and confirm it never appears as a result for the current website.
7. Inspect extension traffic and permissions: no policy transmission, no host permissions, no Gemini credentials.

## Reproducible checks

```sh
npm ci
npm run check
npx playwright install chromium
npm run test:browser
npm run research:probe
```
