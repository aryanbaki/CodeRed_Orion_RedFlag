# Dashboard clarity and static design handoff

Branch: `codex/dashboard-clarity`, based on integrated main `99997f5`.

The dashboard displays independent agreement grades and a short reason for each Unrated document. Evidence, exact quotes, provider/version metadata, document dates and attributed community reviews are collapsed on demand. Open disclosure state survives history/preferences refreshes on the same route. Navigation to another site starts with collapsed disclosures. Grade colors match Agent 1's palette. The qualitative A–F/? legend does not duplicate server score thresholds; Agent 2 owns the expanded E/F rubric and version bump.

Only dashboard presentation files changed: `src/extension/dashboard.ts`, `src/extension/dashboard.css`, and the new `src/ui/dashboard-review.ts`. The shared popup renderer, history storage API, analysis pipeline, contracts, manifest and build registration are unchanged. Existing integration APIs remain documented in `docs/my-sites-dashboard.md`.

## Reproduce and integrate

Cherry-pick this branch's clarity commit onto integrated main alongside Agent 2's rubric update. Run:

```sh
npm ci
npm run check
npm run test:dashboard
node scripts/capture-dashboard.mjs
```

The capture script uses the actual unpacked extension in a disposable Chromium profile. It seeds synthetic reviews, adds a test-only synthetic label to every image, and exports 18 full-page screenshots to `dist/dashboard-handoff/`. `manifest.json` includes detailed `frames` metadata and the gallery-compatible `screenshots` array `{path, name, state, synthetic:true}` with absolute file paths. Screenshots are generated artifacts rather than committed binaries; the script is committed.

States: empty history; multiple sites; clear confirmation; rated detail; grade legend; expanded evidence/dates/community; delete-one confirmation; partial/pending documents; missing permission/AI off; settings AI off; priority preferences; explicit AI opt-in; AI revoked; 720px settings; unsupported storage version; deleted/expired detail; failed history write; automatic checks disabled.

## Verification and limitations

`npm run check`: TypeScript, 48 unit tests, and production extension build passed. `npm run test:dashboard`: actual extension checks passed for empty/multiple/independent/partial reviews, changed reviews, source attribution, expanded evidence preservation, popup/dashboard consent synchronization, 1280/720/480px widths, keyboard navigation, rejected storage writes, full browser restart persistence, deletion and clearing. Capture completed without page errors or 720px horizontal overflow. Representative full-page images were visually inspected.

All provider evidence in these screenshots is synthetic; no live ratings or AI requests are implied. Permission management is in Agent 1's popup, with permission-required outcomes shown here. Fonts use the shared temporary system monospace: authorized Monoglyphic files and embedding rights were not available. Figma upload belongs to the coordinator; this branch produces static images and the manifest only. This branch is not merged into main.
