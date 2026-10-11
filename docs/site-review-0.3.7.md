# RedFlag 0.3.7 verification — October 11, 2026

The extension uses cream surfaces, brown text and rust-red actions. Grade badges and summary bars preserve the supplied S–E green/lime/yellow/orange/red/deep-red palette. The website appears once in the overall card. Brighter badges use dark lettering for readable contrast. Cards and tabs have restrained borders and spacing.

## Onboarding and Analyze behavior

First use has visible step progress, optional interests, custom-interest entry with Enter, back navigation, a local-connection status panel and community-only setup. Interests survive back navigation and reopen; skipping clears them. Failed writes stay visible and keep controls usable. Consent and setup completion are stored in one canonical storage write. Connection retries catch rejected runtime calls, and invalid/oversized connection files leave a usable retry path. The popup footer exposes My sites and Settings after setup.

Analyze all disables repeat admission clicks, preserves scan errors and shows searching/analyzing states. Pending metadata is not overwritten by word counts. Failed policies show concise reasons and canonical explanation/retry information; errors do not imply a successful grade or saved reading time. Sites with no discovered policy or current community rating retain the latest main-branch no-results view and Look again action.

## Verification

- `npm run check`: strict TypeScript, all 77 unit tests and build passed after incorporating main commit `2793a4d`.
- `node tests/browser.mjs`: first-use keyboard controls, blank/duplicate custom interests, back navigation/focus, persisted/skipped interests, connection rejection/recovery, malformed/oversized imports, visible save failure, consent/completion write, community-only setup, reload, Settings link and no 400px overflow or page errors passed.
- `node tests/popup-redesign.mjs`: readable warm colors, 400px width, six grade-profile colors, discovery/pending/no-results states, preserved permission error, duplicate Analyze guard, quota reason/retry, individual/all Analyze, Summary, evidence, Chat, citations and keyboard tabs passed.
- `node tests/actions-browser.mjs`: real MV3 queue, cache reuse, bounded concurrency, duplicate joining, timeout/quota/auth/site-permission failures, stale navigation, close/reopen, per-tab isolation and saved-review deletion passed. Provider and public retrieval outputs were simulated.
- `node --experimental-strip-types tests/site-review-integration.ts`: actual extension through an authenticated local HTTP server passed three-policy setup/analysis, individual cached Analyze, held Analyze all controls and completion, Summary, red flags, Chat/citations and stale/untrusted rejection with no popup errors. Provider output was simulated.
- Dashboard, branding, on-page UI and static policy extraction browser suites passed. Dashboard was checked at narrow and desktop widths; the latest policy discovery/static extraction changes from main were preserved.
- The final ZIP was extracted and tested using `REDFLAG_EXTENSION_DIR` with both the onboarding browser suite and authenticated integration suite. All 51 archive entries passed ZIP integrity checks and exactly matched the packaged build. Manifest and required asset paths were verified; local connection files and provider credentials are excluded.

## Separate live check

A bounded opt-in run of `tests/actions-live.ts` used live GitHub Terms/Privacy documents and the configured free Gemini profile. Individual Analyze made one live analysis and Analyze all made two. All three returned validated Gemini assessments with sourced findings, no upstream transport failures and no popup errors. The approved `gemini-3.1-flash-lite` backup served the results. Each result remained Unrated for insufficient category evidence; this is intentional rather than a transport failure. Setup automatic jobs were explicitly suppressed in the live-test server so only the three button-triggered jobs called Gemini. The controlled discovery webpage was a fixture. This live run preceded the later onboarding presentation and main discovery merge; the final packaged artifact passed the simulated integration checks above.

## Package

Archive: `RedFlag-Extension-0.3.7.zip` (1,682,200 bytes).

SHA-256: `bddcf114542b1e0f5a004567b47ef9f1e6aa01369b5be0fd5b67f341ec4d7506`.

Unzip to a permanent folder, then load the folder containing `manifest.json` through Chrome’s Load unpacked control. Reload/disable older installations as appropriate. Gemini analysis and Chat still require the configured local backend running; policy availability and upstream quotas remain external dependencies. There is no public backend deployment.

Onboarding previews: [interests](design/branding/onboarding-interests-warm.png) and [connection](design/branding/onboarding-connection-warm.png). These are controlled test screenshots, not live website ratings.
