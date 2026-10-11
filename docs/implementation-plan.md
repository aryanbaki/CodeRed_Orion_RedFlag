# Ordered implementation plan

Each stage has an observable exit criterion. The framework is stage 1; this document does not imply later stages are already implemented.

| Stage | Work | Exit criterion |
| --- | --- | --- |
| 1. Framework | MV3 popup, capture, local priorities, fictional evidence, validation, tests, CI | Builds; demo distinguished from real capture; no network traffic or bundled API key. |
| 2. Community access | Test documented search/current service APIs; approve attribution and cache strategy; define reviewed/unreviewed states; original adapter and fixtures | Known, unknown, ambiguous, stale and network-failure cases tested; every displayed point has provider identity and link. |
| 3. Extraction | Compare selection/main/body extraction with Readability; policy URL discovery; full-document coverage and truncation handling | Human-checked corpus covers static, dynamic, table-heavy, long, iframe and PDF pages; unsupported inputs are explicit. |
| 4. AI service | Select account/model after data-term review; server-held key; auth, quotas, consent, timeout and output validation | Real approved sample produces quoted findings; quota/timeout/refusal tests pass; no secrets in bundle and no policy-text logs. |
| 5. Combined review | Separate community and AI sections; dates, evidence links, local concern prioritization | Users can distinguish review provenance and verify every risk claim against its source. |
| 6. Agreement reminders | Choose three supported flows; optional host permissions; site adapters; dismiss/snooze and duplicate suppression | All three flows work without interfering with consent; unrelated buttons do not trigger; access is revocable. |
| 7. Policy changes | Evaluate OTA collections and terms; map policy URLs to versions; semantic change summaries | Test meaningful and formatting-only changes; show versions and dates; suppress cosmetic alerts. |
| 8. Release | Resolve license, dependency notices, privacy notice and store disclosures; accessibility and performance review | Clean-machine installation, production service controls, rollback path and store submission artifacts verified. |

## Immediate technical experiments

1. ToS;DR: query several known domains, an unknown domain, and a lookalike; inspect record URLs rather than ranking alone. Test current API versions and document supported request limits. Do not rely on the unauthenticated bulk endpoint that returned 401.
2. Create an original adapter returning explicit availability/review states and provider timestamps. Validate unknown input at the boundary and cap response sizes.
3. Assemble an authorized 20-document evaluation corpus, including five long/complex layouts. Record policy URL, date, hash, expected clauses and extraction coverage. Avoid storing private account pages.
4. Implement the minimal authenticated AI endpoint and an explicit “Send this policy text for AI analysis” step. Choose hosting after confirming quota and data handling, not before.
5. Have a human label risks and acceptable explanations; compare Gemini output for accuracy, negation handling, unsupported claims and missed clauses. Record latency, token usage and cost using the selected model's actual pricing.

Proposed release targets (to be validated, not achieved): every displayed AI quotation matches its source; zero fabricated citations in the evaluation corpus; at least 90% precision on human-reviewed risk findings; all partial captures labeled; no credentials or page text in diagnostics. Measure recall separately rather than masking missed findings behind high precision. Twenty documents is an initial development set, not a general reliability guarantee.

## Product decisions still open

- Which three agreement flows should the first reminder pilot support?
- Should community lookup use a local catalog or a disclosed domain query?
- Which Google project, paid/unpaid service, model, budget and hosting will be used?
- Which attribution and licensing approach applies to the chosen data path?

These decisions do not block the local framework. They do block claims that the complete planned product already works.
