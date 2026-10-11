# Compact popup verification — 2026-10-11

Based on local main `99997f5` in separate branch `codex/popup-clarity`. Owned presentation commits `18048bd` and `47073fc`; API dependency `8efd5a7`, runtime dependency `6cdec2c` integrated unchanged from discovery worker. No merge performed.

Unknown grades use fixed-size `?` with accessible `Unrated` label. Supported A–F use readable green/amber/pink tokens. Empty/restricted pages have no grade summary or invented absent policy rows. Only discovered documents get concise independent rows. Scope/graded/pending counts remain explicit; evidence expands on demand with exact quotations and source links. Settings/consent unchanged. Ordinary-site Re-check works without AI consent; Analyze remains disabled while AI is off.

Passed strict TypeScript/build and existing browser/action/UI suites. Updated `tests/popup-redesign.mjs` tests synthetic states in actual unpacked Chromium: empty no cards/rows, permission-empty CTA, partial/Unrated `?` without overflow, supported grade colors, no horizontal overflow, long domains/names, keyboard/settings, persisted consent, source-logo/font fallback, missing docs, main-state header visible in screenshot. `node tests/popup-current-tab.mjs` tests actual popup/service-worker ordinary footer discovery, current domain, browsing context, no consent overlay, AI-off Analyze disabled and Re-check refetch without opt-in. Public-document response is simulated; no live AI call.

Screenshots: [manifest](clarity-screenshots/manifest.json), 15 captures including restricted, empty, permission setup, pending, partial, rated, Unrated, AI-off, settings, recent, exact expanded evidence and separately labeled unchanged consent overlay. Main states capture top-of-popup header; evidence/settings/recent intentionally show expanded/scrolled detail. Synthetic review/provider labels are retained. Temporary system monospace remains; Monoglyphic is unfinished pending authorized file and embedding/distribution permission.

Coordinator integrates approved discovery worker/runtime and separately updates simulator/release. This branch does not modify backend, history, dashboard or simulator ownership.
