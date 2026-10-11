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

## P0 acceptance tests: automatic discovery and background analysis

These are required future tests, not completed verification. The manual Chrome checks above describe the existing capture framework; they do not satisfy the zero-click P0 requirement. Setup may grant site permissions and a revocable background-AI opt-in, but no test may require opening a policy link or invoking the toolbar to start discovery.

| Test | Required result |
| --- | --- |
| Initial discovery | On signup, checkout, onboarding, and consent fixtures, discover Terms of Service, Terms of Use, Terms and Conditions, Privacy Policy, and Additional Terms links before agreement. Resolve relative/cross-origin URLs correctly; deduplicate repeated links without dropping distinct documents. |
| Dynamic context | Insert a legal dialog/form after load and change a legal link. Targeted observation finds new agreements without duplicate warnings or repeated analysis of unchanged documents. Unrelated checkbox/link mutations do not start reviews. |
| Zero-click retrieval | Keep every policy link unopened and record site control events. Background retrieval obtains public legal documents; no link, checkbox, submit-button, navigation, or consent-state side effects occur. |
| MV3 origins and lifecycle | Same-origin and permitted cross-origin retrieval work through the service worker. Missing permission produces a clear Unrated reason. Suspend/restart the worker during a job; recover or retry boundedly without losing document state or showing findings on a newly navigated page. |
| Access failures | Exercise HTTP 401/403/404, authentication redirects, offline/timeouts, unsupported content, oversized/partial documents, and blocked destinations. Each affected document remains visible as Unrated with a reason; no cookies, login bypass, tab navigation, or automatic acceptance is attempted. |
| Community-first processing | Applicable fresh cache/community records appear first with attribution and review dates. Fully sufficient applicable results cause no Gemini call. Missing, incomplete, stale, wrong-domain, or service-only evidence cannot masquerade as a fresh document-specific grade; permitted AI fallback runs only where needed. |
| Cache validity | Repeated loads and duplicate DOM links reuse one job/result. Changed content, expiry, or model/prompt/rubric changes invalidate the appropriate analysis. Old or incomplete cache entries cannot silently become current results. |
| Independent agreements | With Terms, Privacy, and Additional Terms present, assess each independently and combine only supported important findings. A missing Privacy document remains Unrated even if Terms is graded. Conflicts and missing coverage remain visible; no average hides them. |
| Evidence and grades | Every displayed risk has an exact passage and document URL; grades follow the documented rubric. Separate community/AI identity, review time, retrieval time, document date when available, and analysis time. Unknown dates remain unknown. Fabricated quotes, negation errors, and instruction-like policy text cannot create supported findings. |
| Proactive overview | Without opening any legal document, a warning is visible before consent is checked. Cached findings arrive immediately; pending/partial states appear while uncached jobs run and update asynchronously. Actionable warnings explain the relevant clause and available review/dismiss options without making the decision for the user. |
| Responsive browsing | With an artificially delayed 30-second Gemini response, forms, scrolling, navigation, and submission remain usable. Debounced scans and bounded parallel fetches avoid repeated full-page work. No routine action is held until AI finishes. |
| External-AI consent | Before opt-in, no document content is sent to Gemini/backend for AI; eligible local/community review still works and unresolved documents remain Unrated. After opt-in, background analysis proceeds without per-document clicks. Revocation prevents new transmissions and cancels queued work; disclose that already sent requests cannot be recalled. |
| Sensitive-data boundaries | Instrument requests and logs: only relevant public legal text is analyzed; form values, credentials, unrelated page content, account data, and browsing history are absent. Server-side keys never appear in the extension, repository, or logs. Community domain queries match the disclosed lookup behavior. |
| Quotas and failure recovery | Inject Gemini 429/5xx, timeout, refusal, malformed JSON, and unsupported quotations. Retries are bounded; available evidence remains intact and unresolved grades are Unrated. Label dated cache fallback explicitly; never substitute fictional demo findings for a real review. |
| User control | Across three consecutive clean-profile rehearsals, RedFlag never accepts an agreement, ticks a checkbox, presses submit, or interferes with navigation. Dismissal, site-access revocation, and AI-consent revocation work. |

P0 exit: the supported fixtures pass the complete discovery → background retrieval → eligible community/cache lookup → consented AI fallback → independent assessments → proactive overview path. Demonstrate one real AI response and the no-consent/offline paths. Unsupported sites and document types must be disclosed rather than counted as working coverage.
