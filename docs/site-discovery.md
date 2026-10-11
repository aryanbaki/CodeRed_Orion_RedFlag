# Ordinary-page discovery — 2026-10-11

Branch `codex/site-discovery` starts from local main `99997f5`. Coordinator-approved contracts add `browsing` to review contexts and `redflag/scan-current`; manifest identity is RedFlag 0.2.0. No main merge or new provider calls were performed.

## Popup integration

Import `requestCurrentScan` from `src/core/discovery-actions.ts`. On toolbar-popup opening, call `requestCurrentScan()` once. Call it again when Re-check has no state/documents. An optional `tabId` addresses a specific current tab. Only trusted extension UI may invoke this action; a content-script caller receives `untrusted`. The worker resolves the browser URL/document and injects `content.js` under existing host permission or Chrome's actual temporary activeTab grant. It never requests permission itself.

The response is `{ok:true,state:ReviewState|null}` or `{ok:false,code,error}`. Codes: `untrusted`, `disabled`, `unsupported-page`, `permission-required`, `stale-page`. A successfully scanned HTTP(S) page with no legal links returns/publishes an empty `browsing` state. This is different from a restricted Chrome page. Render it without invented document rows or grades. Continue consuming `redflag/state` updates; a scan response does not certify finished retrieval/analysis.

With existing documents, Re-check uses the existing `redflag/analyze` mode `recheck` **even when AI is off**. It refetches documents; AI stays off without stored explicit consent. A scan of unchanged links does not itself refetch them. An analyze/recheck of an authoritative empty state forces a scan and acknowledges an empty result if no agreements are found. Saved-site recheck behavior is unchanged.

`renderSiteAccess` now starts scanning immediately after explicit grants and discloses an optional, reversible all HTTP(S) sites control. Reading access and AI consent remain separate. Origin-specific and broad permission requests execute directly from their button gesture. Background onAdded hooks register automatic scanning, inject into already open permitted tabs with concurrency bounded at three, and retry permission-blocked documents once eligible. No reload is needed. onRemoved stops affected observers, invalidates jobs/state and clears badges. Broad access is never silently requested; individually granted sites can remain after broad revocation.

## Discovery and warning behavior

Granted ordinary pages discover legal links automatically on navigation and targeted mutation batches. The bounded candidate set prioritizes footer/contentinfo and navigation anchors, then the start/end of the subtree, so a long repository page does not lose its footer. Full legal names work through text/accessibility names. Short exact “Terms”/“Privacy” labels require a recognized legal destination path; blog/article/settings/issue/discussion paths are excluded for short labels. Only actual discovered safe URLs are used.

Normal results use `browsing`; the floating overview requires positive nearby agreement context plus enabled preferences. Signup/checkout/onboarding paths classify an already detected consent context, never create one solely from a path. Consent flags participate in the mutation signature, so adding a dialog with existing footer URLs or adding agreement text beside the same legal links updates context without duplicate retrieval. Removing that context removes the floating warning. Repeated injections reuse a single observer/listener set and retain dismissal.

Content messages must match browser document identity and current page generation and be covered by persistent permission or the worker's current manually scanned browser document. Removed permission does not let a still-loaded content script keep publishing. Legal-document requests remain query-free, public, credential-free and bounded. Cross-origin document permission is independent of page access; missing document permission remains visible. No agreement/link/control is clicked and no form values or unrelated page text are sent to the worker/provider.

## Rubric integration

Commit `ff33c09` completes the previously missing E grade: `redflag.rubric.v2` uses A90–100, B75–89, C60–74, D40–59, E20–39, F0–19. Required exact category evidence, complete coverage and nonempty validated findings are unchanged. Partial/missing/fabricated evidence remains Unrated. Update trusted extension backend configuration to rubric v2 and restart the server from integrated code; server versions are source constants, not environment overrides. Previous v1 cache is not a current v2 assessment. Server-only keys remain outside the extension/chat. Setup docs and `.env.example` comments match the authoritative version.

## Verification and limitations

- `npm run check`: typecheck, 49 unit tests and build. Added grade20/E versus the next reachable score15/F, partial/not-found Unrated, and fabricated-quote rejection tests.
- Existing `test:discovery-browser` and `test:actions-browser` passed after the runtime change, preserving consent/revocation, navigation, independent results and queue behavior.
- `npm run test:site-discovery`: actual unpacked Chromium MV3 extension, a 650-link GitHub-like ordinary page with footer Terms/Privacy, blog/settings negatives, same-URL dialog/text consent transitions, quiet browsing, automatic granted navigation, repeated injection, empty/restricted pages, AI-off recheck, and permission event grant/revoke without reload. CDP `Extensions.triggerAction` supplies **actual Chrome activeTab access**. Public responses and optional permission approval/API events are fixtures; Chrome enforces the real injection boundary. Native optional-permission dialog approval remains a manual acceptance check. This suite is added to CI.
- Live read-only Chromium request to the real `aryanbaki/CodeRed_Orion_RedFlag` repository returned HTTP200 and discovered GitHub's actual docs.github.com Terms and Privacy links. Context was browsing and floating warning count was zero. The disposable profile had only a test GitHub host grant, default AI off and no backend configuration; this verifies initial discovery, not terminal retrieval or grades. No demo results replaced live data.

No licensed community catalog is populated, and installed live backend configuration is not supplied by this branch. Unknown grades stay Unrated. Existing conservative HTML partial coverage, query-bearing legal URLs, redirects, PDFs, shadow DOM/iframes, localized labels, very large mutation batches and DNS/private-network limitations remain. Footer priority is bounded discovery, not proof that every legal link on every website is found. Initial injection/scan APIs are asynchronous and navigation-safe; the popup must keep pending/empty/access-required states clear. See `worker-contracts.md` and `analysis-actions.md` for remaining backend/privacy boundaries.

Integrate `8efd5a7` (API/context/manifest), `6cdec2c` (runtime/access), `ff33c09` (rubric), then the final test/documentation commit. Agent 1's updated popup branch consumes this API; its presentation commits are separate.
