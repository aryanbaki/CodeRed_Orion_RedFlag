# Ordered implementation plan

Each stage has an observable exit criterion. The framework is stage 1; this document does not imply later stages are already implemented.

## P0: Automatic Legal Document Discovery and Background Analysis

The core demo must discover and analyze relevant legal documents without requiring the user to click, open, or read their links. On supported signup, checkout, onboarding, and consent screens, RedFlag reads the fine print before the user agrees. Initial extension enablement, site permissions, and external-AI consent are explicit setup decisions; they do not require opening the original documents.

1. Detect Terms of Service, Terms of Use, Terms and Conditions, Privacy Policy, and Additional Terms links using actual DOM URLs, associated labels, accessible names, and agreement context. Scan on load and target dynamically added forms/dialogs with a debounced observer. Resolve relative URLs against the document base, deduplicate URLs, and retain every relevant agreement. Never crawl unrelated links or infer a document's contents from its link title.
2. Retrieve publicly accessible documents asynchronously through the Manifest V3 service worker, with permissions covering the enabled page origins and actual document origins. Validate HTTP(S) URLs, redirects, content types, size, and time limits. Do not navigate tabs, click site controls, reuse authentication credentials, bypass access controls, or fetch private-network destinations. Permission-denied, login-required, inaccessible, unsupported, and incomplete documents remain visible as Unrated with a reason.
3. Prefer valid cached analyses and properly attributed community reviews. Match the service/domain and document scope; a service-level ToS;DR rating cannot stand in for separate Terms and Privacy grades. Use Gemini only when applicable ratings/evidence are missing, incomplete, or outdated and external-AI consent has been granted. Record freshness rules explicitly; a download timestamp alone is not a review date. Other community providers require verified licensing and attribution before use.
4. Analyze each agreement independently, including Additional Terms. Preserve separate Terms/Privacy grades, exact evidence passages, source URLs, coverage, and dates. Combine important findings into a concise overview without averaging away an Unrated document, inventing cross-document conclusions, or hiding contradictory clauses. Grades follow a documented rubric; insufficient evidence is Unrated.
5. Display a proactive, dismissible warning while the agreement remains unchecked, with pending/partial states immediately and updated findings as results arrive. Keep grade, provider, review/document freshness, and actionable clauses visible without opening the original documents. Do not delay routine browsing or promise a completed Gemini result before a user who proceeds immediately.
6. Bound scan work, retrieval concurrency, and retries; deduplicate in-flight jobs and cache by validated document identity/content hash plus analysis/model/rubric version. Invalidate changed, expired, incomplete, or mismatched entries. Persist enough job state to recover from service-worker suspension and discard stale results after navigation. Community cache handling must follow its data terms.
7. Analyze only relevant legal-document text. Before external AI transmission, obtain an explicit, revocable opt-in explaining destination and content sent; persist the preference so enabled background analysis requires no per-document click. Until opt-in, use eligible local/community results and show remaining documents as Unrated. Exclude form inputs, account data, browsing history, and unrelated page content; do not log raw policy text. Never automatically accept agreements, tick checkboxes, press submission buttons, or block site navigation while waiting for analysis.

P0 demo scope: one controlled signup flow plus checkout/onboarding/dynamic-consent fixtures proving the same path, with multiple public agreements, caching, and failure states. Broader site coverage, policy-history monitoring, PDF support, authenticated documents, and complex iframe/shadow-DOM integrations remain optional; unsupported cases must be explicit. See [P0 acceptance tests](verification.md#p0-acceptance-tests-automatic-discovery-and-background-analysis).

| Stage | Work | Exit criterion |
| --- | --- | --- |
| 1. Framework | MV3 popup, capture, local priorities, fictional evidence, validation, tests, CI | Builds; demo distinguished from real capture; no network traffic or bundled API key. |
| 2. Community access | Test documented search/current service APIs; approve attribution and cache strategy; define reviewed/unreviewed states; original adapter and fixtures | Known, unknown, ambiguous, stale and network-failure cases tested; every displayed point has provider identity and link. |
| 3. Automatic discovery and retrieval (P0) | Target agreement contexts and dynamic dialogs; discover actual legal URLs; background public-document fetching; completeness and access-state handling | Signup, checkout, onboarding, and consent fixtures find all relevant agreements without link clicks; denied/inaccessible documents are Unrated; browsing stays responsive. |
| 4. Background AI service (P0) | Server-held key; auth, quotas, revocable AI opt-in, asynchronous jobs, cache, timeout and output validation | Enabled analysis runs without per-document interaction; cache hits avoid Gemini; suspension/failure recovery works; no secrets in bundle or sensitive content in requests/logs. |
| 5. Proactive combined review (P0) | Independent agreement assessments; separate Terms/Privacy grades; concise overview; exact citations, freshness, provider identity, and local priorities | Warning appears before checkbox acceptance without opening policies; pending/Unrated states and per-document evidence remain visible; no consent controls are changed. |
| 6. Broader agreement coverage (optional) | Additional site adapters, optional host permissions, dismiss/snooze, iframe/shadow-DOM support | Tested supported flows remain non-disruptive; unrelated controls do not trigger; access is revocable. |
| 7. Policy changes | Evaluate OTA collections and terms; map policy URLs to versions; semantic change summaries | Test meaningful and formatting-only changes; show versions and dates; suppress cosmetic alerts. |
| 8. Release | Resolve license, dependency notices, privacy notice and store disclosures; accessibility and performance review | Clean-machine installation, production service controls, rollback path and store submission artifacts verified. |

## Immediate technical experiments

1. ToS;DR: query several known domains, an unknown domain, and a lookalike; inspect record URLs rather than ranking alone. Test current API versions and document supported request limits. Do not rely on the unauthenticated bulk endpoint that returned 401.
2. Create an original adapter returning explicit availability/review states and provider timestamps. Validate unknown input at the boundary and cap response sizes.
3. Build signup, checkout, onboarding, and dynamic-consent fixtures with multiple legal agreements; verify zero-click discovery and background retrieval first. Use a small hand-checked public-document corpus for P0; expand to 20 documents, including five long/complex layouts, for broader validation. Record URL, date, hash, expected clauses and coverage. Avoid private account pages.
4. Implement the minimal authenticated AI endpoint, explicit revocable background-AI opt-in, bounded jobs, and cache. Once opted in, analysis must require no per-document interaction. Choose hosting after confirming quota and data handling, not before.
5. Have a human label risks and acceptable explanations; compare Gemini output for accuracy, negation handling, unsupported claims and missed clauses. Record latency, token usage and cost using the selected model's actual pricing.

Proposed release targets (to be validated, not achieved): every displayed AI quotation matches its source; zero fabricated citations in the evaluation corpus; at least 90% precision on human-reviewed risk findings; all partial captures labeled; no credentials or page text in diagnostics. Measure recall separately rather than masking missed findings behind high precision. Twenty documents is an initial development set, not a general reliability guarantee.

## Product decisions still open

- Which real site should supplement the P0 controlled agreement fixtures for broader coverage?
- Should community lookup use a local catalog or a disclosed domain query?
- Which Google project, paid/unpaid service, model, budget and hosting will be used?
- Which attribution and licensing approach applies to the chosen data path?

These decisions do not block the local framework. They do block claims that the complete planned product already works.
