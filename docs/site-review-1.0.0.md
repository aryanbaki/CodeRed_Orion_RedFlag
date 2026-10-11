# RedFlag 1.0.0 verification — October 11, 2026

The release integrates teammate main `b463226` and its discovery-before-consent fix, preserving the warm cream, brown and red-orange theme. It removes the duplicate header domain and entire Quick Read block. A horizontal S, A, B, C, D, E guide explains concern levels and Unrated at the bottom of analyzed reviews.

The optional welcome does not gate discovery or write preferences. AI consent is explicit and separate, preserves existing enable/disable settings and priorities, and can be revoked in Settings. Initial discovery runs alongside backend connection checks. Requested analysis resumes after consent.

Analyze all retains independent documents when legal links disappear, includes late common/dynamic discoveries in its fresh-review batch, upgrades joined cache reads to fresh analysis, and retains explicit failures. Common-policy lookup caches distinguish which policy kinds are missing. Stale page actions are rejected; pending discovery is restarted after MV3 worker suspension.

## Checks

- `npm run check`: TypeScript, 78 unit tests and production build passed.
- `node tests/popup-redesign.mjs`: warm colors, 400px layout, horizontal S–E guide, Quick Read removal, Summary, Chat, citations, keyboard tabs and failure states passed.
- `node tests/browser.mjs`: first use, optional guide, unchanged preferences, explicit consent, backend/import failures, Settings revocation and persistence passed.
- `node tests/analysis-batch-browser.mjs`: late discovery, retained/returning links, independent inaccessible document, fresh batch and navigation reset passed.
- `node tests/actions-browser.mjs`: actual worker one/all/recheck, cache, duplicate joining, two concurrent jobs, timeout, independent failures, popup close/reopen, stale generation and badges passed.
- `node tests/site-review-integration.ts` with Node type stripping: real extension → authenticated local HTTP backend, three-policy analysis, consent resume, Summary, Chat, citations and stale/untrusted rejection passed.
- `node tests/dashboard-browser.mjs` and `node tests/popup-current-tab.mjs`: navigation, settings, history, public discovery and no-AI boundary passed.

Browser checks use controlled public-document and provider responses. They establish application behavior, not universal website accessibility or live provider availability. The previous 0.3.7 bounded live Gemini result remains documented separately; no new live-provider quality claim is made here. AI analysis and Chat require the configured local backend.

## Artifact

`~/Downloads/RedFlag-Extension-1.0.0.zip` — 1,681,213 bytes.

SHA-256: `6f871d6a5e1c5f437e918ddcfcb0ed8b86d3685e4bb7dc77cf6561589411b962`

ZIP integrity, root manifest/version, safe entry paths, credential exclusions and byte equality with the final build passed. The archive was extracted to a fresh folder for onboarding and extension-to-backend verification. Team entry points are `AGENTS.md` and `docs/TEAM_HANDOFF.md`.
