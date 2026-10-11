# Analysis actions and toolbar integration

Implemented on `codex/analysis-actions`, starting from local main `d306957`. This branch owns discovery/background orchestration, commands, and toolbar state. Popup and dashboard presentation belongs to their assigned workers. No merge into main has been performed.

## Trusted UI API

Import `requestAnalysis`, `AnalysisCommand`, and `AnalysisActionResponse` from `src/core/analysis-actions.ts`.

```ts
await requestAnalysis({type:'redflag/analyze', mode:'one', pageKey:state.pageKey,
  documentId:state.documents[0].document.id, tabId});
await requestAnalysis({type:'redflag/analyze', mode:'all', pageKey:state.pageKey, tabId});
await requestAnalysis({type:'redflag/analyze', mode:'recheck', pageKey:state.pageKey, tabId});
await requestAnalysis({type:'redflag/recheck-site', siteOrigin:savedSite.siteOrigin});
```

`tabId` is optional for current-page commands; background resolves the active tab if omitted. Only `one` accepts/requires `documentId`. Callers never supply URLs or legal text. Background checks sender, current URL, page generation, and authoritative discovered documents. Content-script commands are rejected. Saved-site commands resolve an existing bounded local history record and cannot recreate a deleted record.

Success returns `{ok:true,state,queuedDocumentIds,joinedDocumentIds}` immediately. This acknowledges admission, not an analysis grade. Render that state, then consume existing `redflag/state` updates/storage state. Identical active jobs join; separate documents complete independently. Failure returns `{ok:false,code,error}` with `untrusted`, `invalid-command`, `stale-page`, `no-review`, `document-not-found`, `disabled`, or `history-unavailable`. Closing the popup does not cancel background work. A detached saved-site recheck updates history without changing another tab's state/badge.

Analyze one/all reuse valid versioned cache after retrieving and validating the document. Re-check bypasses cache and refetches. Retrieval remains credential-free and restricted to configured, permissioned public origins. AI consent is checked before transmission, including queued jobs. Missing consent produces Unrated without sending legal text to Gemini. Revocation stops new/queued transmissions; already transmitted requests cannot be recalled. Service worker restart restores session jobs with a bounded retry budget. Two jobs run concurrently; retrieval, extraction and analysis timeouts are 12s, 5s and 30s. Retry-After cooldowns survive worker suspension. Explicit re-check cannot bypass them.

## One shared summary rule

Import `summarizeReview`, `supportedDocumentGrade`, and `supportedAssessment` from `src/core/summary.ts`; use them in popup, history and toolbar rather than reimplementing a grade calculation.

- Each Terms, Privacy and Additional Terms result remains independent. A grade needs a matching Gemini assessment, complete coverage, valid content hash/analysis timestamp, and unexpired cache. Exact quotations are validated against retrieved text before publication/cache reuse.
- The summary uses the worst supported document grade, never an average. It exposes separate kind grades, counts, pending/Unrated entries, missing Terms/Privacy, and high-severity concerns. A kind with any unsupported result is Unrated.
- The combined grade is Unrated until every discovered document is graded and Terms and Privacy were both discovered. Additional Terms is required when discovered. Even a complete discovered set does not prove every agreement on a site was found.
- Community service ratings remain attributed community references, never document-specific AI grades. Partial extraction, inaccessible documents and stale assessments do not produce reassuring summary grades.
- Source publication/update dates, retrieval time, analysis time and cache expiry are distinct. Unknown source dates remain unknown; a new retrieval timestamp does not establish newly written legal terms.

Toolbar badges overlay the installed RedFlag logo. Fully graded discovered sets show the worst letter. Incomplete sets show `?`, colored by the worst supported grade when available; the accessible title gives coverage, separate Terms/Privacy grades, missing kinds and concerns. Pending-only sets show `…`; unknown sets show `?`; supported high concerns without a grade show `!`. Navigation clears the previous grade immediately, serializes badge writes, and ignores previous-generation results. Native small-badge legibility remains a visual acceptance check; no custom replacement icon was introduced.

## Optional safe failure details

Coordinator-approved additive `DocumentReview.failure` is `{stage:'retrieval'|'analysis',code:UnratedReason,message:string,retryAfterSeconds?:number}`. Existing reason/status/coverage remain authoritative. `src/background/failures.ts` supplies fixed safe messages, distinguishes source login failures from backend authentication, and bounds Retry-After to finite 0–86400 seconds. Never display raw provider bodies, tokens or credentials. A new attempt clears previous assessment/cache/failure metadata; failure cannot leave an old supported grade behind.

## Reused implementation and merge order

Backend implementation was inspected and reused from its owner: original `88fd571`, `b4b6d0f`, `cd5b99b`, `c85ea5b` are represented here as `5fd5201`, `f0f97ae`, `334c736`, `ac426bb`. History APIs from Agent 3's `e057165` and `02fcffc` are represented as `fde3af3` and `725a132`. Avoid applying duplicate commits when integrating worker branches.

Owned contract/action commits are `c96d1fe`, `c0ad2e6`, `0075474`, `b3f7823`, and `6d0095e`, followed by the final documentation/navigation-test commit. Import this branch's background/core changes before binding UI controls. Agent 1's popup and Agent 3's dashboard presentation commits are intentionally absent; their branches consume these APIs. Coordinator should bring Agent 3's later history evidence-hardening changes (`8ad2a2e`) and dashboard verification (`fd7538a`) with that worker's presentation work.

The backend key remains server-only. The Gemini adapter now sends verified classic generateContent fields `responseMimeType` and `responseJsonSchema`; the configured free model rejected the previous responseFormat serialization. Safe provider HTTP 400/404/422 responses become invalid-response, 401/403 authentication-required, and 429 quota-exceeded. Do not loosen evidence validation or switch to a paid profile to obtain a grade. See `docs/gemini-backend.md` for protected endpoint setup and provider configuration.

## Verification record — 2026-10-11

All of the following passed on this branch:

- `npm run check`: typecheck, 47 unit tests, extension build.
- `npm run test:actions-browser`: actual unpacked MV3 worker, automatic discovery, Analyze one/all/re-check, cache reuse, joined requests, concurrency, independent success/failure, permissions, source/backend auth, AI disabled, accelerated timeout, rate-limit cooldown, popup close/reopen, per-tab switching, old-page and untrusted commands, late results after navigation, saved-site deletion. Public retrieval and Gemini responses are mocked fixtures.
- `npm run test:discovery-browser`: four consent contexts, dynamic dialogs/links, credential omission, unchanged consent controls, isolated extraction, explicit consent/revocation, browsing responsiveness, worker restart. Retrieval/provider simulated.
- `npm run test:browser` and `npm run test:ui`: popup/settings persistence, explicit consent/revocation, multiple independent policies, pending/partial/stale/Unrated displays, priorities, accessibility and dismissal. Fictional fixtures are labeled separately.
- `npm run test:backend-browser`: actual local authenticated backend and actual MV3 transport, with injected mocked Google provider. This is not live Gemini verification.

Manual `tests/actions-live.ts` is separate from CI. After build, run with Node's `--experimental-strip-types` and `--env-file` pointing to an ignored server environment file; it starts a temporary protected backend and disposable browser profile. No key is logged or embedded. The signup page is a controlled fixture; its public GitHub Terms and Privacy Markdown are fetched live, then analyzed by the configured free Gemini profile after explicit test-profile opt-in. One full live run produced Privacy C with two validated exact findings; Terms remained Unrated (`invalid-response`), with complete retrieval coverage and zero accepted findings. Mixed results remained independent. Presence validation does not certify model recall or semantic quality. No further provider calls were made to seek a favorable result.

Domino's was inspected read-only in Chromium. Its rendered homepage exposed `/content/privacy` and `/content/terms-of-use`; direct requests to those observed URLs returned HTTP 404 during this run. The homepage was not a supported consent/signup context, and no location, checkout, account or agreement controls were used. Live consent-screen success and public legal retrieval there remain unverified. No demo data replaced these failures.

Remaining release constraints: native toolbar visual acceptance; live Gemini Terms validation failure; real Domino's consent flow access; existing conservative HTML partial coverage; public-origin allowlist/permissions and unresolved DNS/private-network guarantees described in worker contracts; no live community-provider result in these tests. CI fixtures verify orchestration, not provider availability or whole-site legal discovery completeness.
