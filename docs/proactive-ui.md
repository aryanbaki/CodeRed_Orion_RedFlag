# Proactive UI implementation and integration

UI branch: `codex/proactive-ui`, based on latest main `f83562e`, then fast-forwarded to integration contracts `0e45ede`. No discovery, service-worker, manifest, or extension build files are changed here. No applicable AGENTS.md was found in the repository or its ancestor directories.

## Integration API

Import `mountOverview` from `src/ui/overview.ts` in Agent 1's content entry point. It implements the exact `MountOverview` contract from `src/core/contracts.ts`:

```ts
const controller = mountOverview(state, preferences, {
  onDismiss: () => suppressCurrentPageKey(state.pageKey),
  onOpenSettings: () => openTrustedExtensionSettings(),
});
// As each document completes, or local priorities change:
controller.update(nextState, nextPreferences);
// On navigation or consent-context disposal:
controller.destroy();
```

Agent 1 owns supported-screen detection, automatic invocation, message validation and build wiring. The host carries `data-redflag-ui="warning"` for scanner exclusion and contains an isolated ShadowRoot. Mount once per generation. Updates with a different pageKey are ignored; destroy/remount for new generations. Dismissal removes the host and suppresses subsequent updates to that controller. The callback lets Agent 1 preserve dismissal even if it considers mounting again.

The popup asks trusted background for `redflag/get-state` and listens for `redflag/state` runtime messages for its current generation. Agent 1 should publish state changes to the open popup as well as the appropriate content script; the UI has no polling loop. Popup shows an explicit unavailable message when the background is not included in this standalone branch.

Preferences are stored at `PREFERENCES_STORAGE_KEY` (`redflag.preferences.v1`) through the trusted popup's `chrome.storage.local`. Legacy recognized priorities migrate once; legacy values never imply AI consent. Observe storage changes to apply priorities/enablement and stop new AI transmissions/cancel queued work immediately after revocation. The worker must independently enforce enabled consent, grantedAt and current AI_NOTICE_VERSION before transmission. Existing requests cannot be recalled. The popup does not fetch policies or call AI itself. Site-access buttons request/revoke exact HTTP(S) origin patterns for the active site and discovered legal documents, separate from AI consent. Agent 1 owns optional host permission declarations and dynamic script registration. Community domain lookup is disclosed. If a broader grant still covers an origin after scoped revocation, Chrome extension settings manage that broader grant.

## Presentation and privacy

- Preserve cream/forest-green palette and serif title. Warning has a named non-modal region, a polite live summary, keyboard-operable controls and visible focus. It does not move focus on mount. Dismiss and Privacy settings remain outside the scrolling findings pane; there is no focus trap.
- Independent Terms, Privacy and Additional Terms cards, plus undiscovered-document labels with unknown applicability. Combined concerns favor saved priorities, then severity. No grade average is calculated.
- Pending, partial, inaccessible and insufficient-evidence states remain visible. A whole-document grade requires a ready, complete, matching Gemini assessment; community ratings never supply it.
- Exact passages render as plain text. Source URLs use HTTP(S) links with noopener/noreferrer. Provider/model/rubric, coverage, retrieval, analysis, actual document update and cache expiry are separate. Absent dates remain Unknown. Community reviewed/updated/fetched dates remain distinct and stale/unknown reviews are explicit.
- AI consent is off by default and revocable with one button. Disclosure names the RedFlag analysis server and Google Gemini, legal text/source URLs, automatic background behavior, excluded sensitive data, device-local preference, and inability to recall sent requests.
- Fictional examples use a separate dashed section with repeated labels. They never populate real results or act as failure fallback. Manual source preview remains in popup memory and is not sent to AI by the popup.

## Checks completed (2026-10-11)

- `npm run check`: strict TypeScript, nine test groups (five existing and four new UI/preference/access groups), extension build.
- `npm run test:ui`: isolated Chromium with **synthetic result fixtures**, not live website/provider results. Three independent agreements; available and pending results; async ready/failure changes; partial and missing documents; stale cache/community references; Unrated failures; exact evidence/source links; priority ordering; unsafe HTML/URLs; generation guard; non-mutating site controls; retained focus/expanded community details; narrow viewport; keyboard dismissal, settings callback, review enable/disable, and simulated scoped permission grant/revocation.
- `npm run test:browser`: actual unpacked standalone extension in a temporary Chromium profile. Fictional/real separation, local priorities/reload, explicit consent disclosure, opt-in persistence, revocation in canonical storage, simulated save failure, restricted-page preview error, no page exceptions. A separate popup test supplies synthetic runtime state to verify progressive rendering, unrelated-tab/old-generation rejection, and simultaneous separation of real-result and fictional-example sections; this is not a live discovery check. Profile is removed after testing.
- `git diff --check`: clean.
- Visually inspected generated `dist/proactive-ui-fixture.png` and `dist/prototype-preview.png`. Generated outputs are ignored.

UI tests are also added to GitHub Actions after Chromium installation. Hosted CI has not been verified.

## Remaining integration verification

This branch implements the UI and controls; it does not by itself install automatic discovery or perform public-document retrieval. Integrate Agent 1's content/background/build wiring and Agent 2's analysis service to verify actual zero-click discovery and cancellation of queued transmissions. No live Gemini analysis, third-party policy accuracy, three complete P0 rehearsals, screen-reader session, or full-site accessibility audit was performed here. Live permission grant prompts, authenticated documents, PDFs, iframe/shadow-host support and deployed server destination configuration remain owned by discovery/backend/integration.

Permission UI follows [Chrome optional permissions](https://developer.chrome.com/docs/extensions/reference/api/permissions) and [match patterns](https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns); requests run in a direct popup user gesture.

## Changed files

- `src/ui/overview.ts`, `review.ts`, `styles.ts`, `dom.ts`: mounting, rendering, isolated palette and safe output.
- `src/ui/preferences.ts`, `consent.ts`, `access.ts`: migration, consent and scoped site permissions.
- `src/extension/popup.ts`, `popup.html`, `popup.css`: current review and settings presentation.
- `tests/ui.test.ts`, `ui-fixture.ts`, `ui-browser.mjs`, `browser.mjs`: unit, fixture warning and unpacked-popup tests.
- `package.json`, `.github/workflows/check.yml`: UI test command and CI wiring.
- `README.md`, `docs/architecture.md`, `docs/verification.md`, `docs/proactive-ui.md`: status, checks and integration instructions.
