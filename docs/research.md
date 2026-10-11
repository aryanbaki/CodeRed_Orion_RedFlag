# Feasibility research

Checked 2026-10-11. This is a targeted source and API investigation, not a complete security/code audit or a certification of the upstream products. Commit identifiers make the observations reproducible; activity dates are push dates, not assurances of ongoing support.

## Reference comparison

| Project / inspected revision | Findings | Recommended role |
| --- | --- | --- |
| [ToS;DR extension](https://github.com/tosdr/browser-extensions/tree/9590f883923728618c8acc887e16915ccd333dfd) | TypeScript extension, AGPL-3.0-or-later. Inspected database download, domain matching, constants. Last push Oct 7, 2026. | Primary community source; original adapter rather than copying extension code. |
| [PrivacySpy](https://github.com/Politiwatch/privacyspy/tree/b37768e0979fba6b5dbb6d779f8cfa588f19cbcf) | GPLv3 repository. Consistent rubric and citations/notes. Last push Mar 8, 2025. | Rubric reference and optional secondary provider; inspect each record's freshness. |
| [Checkmate](https://github.com/nyxb1t/checkmate/tree/6251b23e84fead0a7601ec0ee5a164289d234e9d) | Plasmo/React extension plus Next.js backend. Inspected analysis route and Gemini adapter: JSON output, 30k-character limit, timeout; parsed output in this path is returned without an evidence contract. README requests contacting authors for reuse/licensing. Last push Jun 18, 2026. | UX/architecture comparison. No code reuse planned. |
| [Open Terms Archive engine](https://github.com/OpenTermsArchive/engine/tree/7589a72c4fbac2195148b21c38e1d79df9d9746e) | Node engine for downloading, archiving and publishing document versions; EUPL-1.2. Last push Oct 8, 2026. | Later history/changes service. Collection coverage and dataset terms require separate review. |

## Live API experiments

Unauthenticated, read-only requests from this development environment:

| Endpoint | Result | Implication |
| --- | --- | --- |
| `https://api.tosdr.org/appdb/version/v2` | HTTP 401 | Cannot assume anonymous bulk access. Do not borrow a credential from upstream code. |
| `https://api.tosdr.org/service/v2/?id=182` | HTTP 200 JSON | Service details are reachable; one example does not prove production reliability or broad coverage. |
| `https://api.tosdr.org/search/v5?query=facebook.com` | HTTP 200, matching service | Public search path works for this sample. |
| Search v5 for `policy-review-example.invalid` and `facebook.com.attacker.test` | HTTP 200, empty services | Unknown and lookalike examples do not get a rating. |
| `https://privacyspy.org/api/v2/index.json` | HTTP 200 JSON | Public discovery index available. |
| `https://privacyspy.org/api/v2/rubric.json` | HTTP 200 JSON | Rubric available for technical evaluation. |

Reproduce with `npm run research:probe`. Network availability is time-dependent. Responses have not been bundled into the extension.

[ToS;DR search documentation](https://docs.tosdr.org/developer/tos-dr-developers/search) describes `/search/v5?query=...`. The search route passed the three examples above. Before production, test documented current service endpoints, resolve candidates using actual domain lists, distinguish community review status, and validate freshness/schema. A matching title is insufficient. Unknown sites must show “No community review found,” never a good rating.

[ToS;DR contribution terms](https://docs.tosdr.org/site-policy/tosdr-terms/tosdr.org-terms-of-contribution) identify CC BY-SA 3.0 contributions with a larger-program exception for AGPL-3.0-or-later. This differs from the extension code license. Record the applicable API/dataset terms, attribution and redistribution treatment before shipping cached data. The old `/en/legal` path returned 404 during this investigation.

[PrivacySpy's API page](https://privacyspy.org/api/) permits integration subject to its Terms and attribution; [its repository terms](https://github.com/Politiwatch/privacyspy/blob/master/TERMS_AND_PRIVACY.md) describe CC BY 4.0 for its website content, excluding material clearly drawn from other sources. Code remains GPLv3; preserve attribution and source-specific terms. Its [contribution guide](https://privacyspy.org/contribute/) records rubric answers with citations and/or notes. Do not relabel a note as a quotation or merge its score into ToS;DR's rating. Its [extension](https://privacyspy.org/extension/) documents periodic local database downloads, a useful design for reducing browsing disclosure.

## Gemini feasibility

Google documents [server-side key handling](https://ai.google.dev/gemini-api/docs/api-key), [structured output](https://ai.google.dev/gemini-api/docs/structured-output), and [API data terms](https://ai.google.dev/gemini-api/terms). Use a server-held key, a configurable model, strict output validation, and explicit user consent before transmitting policy text. Review the selected paid/unpaid service's data terms before enabling real traffic. No Google account or billing configuration was changed and no live Gemini request was made.

Our adapter requests findings with a category, explanation, and verbatim quotation. It rejects findings whose quotes are absent from the submitted text. Quote presence is necessary but does not prove the interpretation is correct; evaluation must assess context, negation, exceptions, and missing clauses. Never accept policy text as instructions, execute model output, or show a model-generated overall safety score.

## Additional repositories

- [Mozilla Readability](https://github.com/mozilla/readability): Apache-2.0 text extraction candidate. Evaluate policy completeness before adoption; article heuristics can drop legal sections. Not installed.
- [PrivacySpy Extension](https://github.com/Politiwatch/PrivacySpy-Extension): separate repository linked by the core project, useful for studying local lookup and update cadence. Located, not code-audited or installed.
- [ToS;DR review application](https://github.com/tosdr/edit.tosdr.org): useful for understanding review provenance and data states. Located, not audited.

## Feasibility conclusion

A user-triggered, evidence-first review is technically plausible. The extension foundation and isolated Gemini adapter can be built independently of provider licensing decisions. Broad automatic “before you agree” detection is a separate, harder problem involving permissions, dynamic forms, iframes, and false positives. Start with supported sites and opt-in access after validating the manual review path.

Remaining evidence: broader ToS;DR search/current-service coverage, authorized bulk access if needed, explicit data attribution design, real Gemini quality/latency/cost, extraction completeness, and browser interaction tests for agreement flows. Upstream extension installations and side-by-side product testing were not performed in this pass.
