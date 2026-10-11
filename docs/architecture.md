# Architecture decisions

## Current framework

Chrome toolbar action → activeTab permission → user-triggered script reads selected/main text → popup source preview. Priorities live in `chrome.storage.local`. Captured text remains in popup memory. Demo findings are fictional, deterministic and visibly labeled. Network access is disabled by the popup content security policy.

[Chrome documents activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab) as temporary access granted by user action. It suits manual review. It does not authorize continuous all-site detection. We request `scripting` for extraction and `storage` for preferences; no broad host permissions, browsing-history permission, or background monitor.

## Planned production path

1. After initial enablement and site permission setup, an isolated content script automatically discovers legal-document links in signup, checkout, onboarding, and consent contexts, including dynamically added dialogs. No policy-link click or toolbar invocation is required. Match legal labels and actual URLs, resolve relative URLs, and scan only relevant changed subtrees.
2. Validate content-script messages and discovered URLs. A Manifest V3 service worker retrieves public documents in the background using appropriate origin permissions, bounded requests, credentials omitted, and validated redirects. Unsupported content, denied permissions, authentication requirements, and inaccessible documents yield a visible Unrated state; never bypass them or navigate the user's tabs.
3. Resolve applicable cached/community results first, preserving domain/document scope, provider attribution, review status, and freshness. Prefer local catalog matching if authorized access and size permit it; otherwise disclose the queried domain. Community service ratings remain separate from document-specific assessments.
4. If evidence is missing, incomplete, or outdated, queue independent Gemini analyses only after explicit, revocable external-AI opt-in. The stored opt-in enables background processing without per-document clicks. An authenticated backend receives only relevant public legal-document text; enforce request limits, timeouts, abuse protection, per-user quotas, and no raw-text logging. Block private-network fetching and omit form/account content.
5. The server-only Gemini adapter returns findings with exact passages. Validate schema and quotations, assess interpretation quality, and calculate separate Terms/Privacy grades under a documented rubric. Track Additional Terms independently. Insufficient evidence is Unrated. Render plain text; provider/model HTML is never trusted.
6. Show a dismissible pre-consent warning immediately with pending/available results, then update a concise overview as each agreement completes. Preserve per-document citations, grades, freshness, and unavailable states. Local priorities reorder findings without modifying ratings or evidence. Never automatically accept, decline, tick, submit, or block consent controls; routine browsing never waits on Gemini.
7. Deduplicate discovery and in-flight work; cache by document identity/hash and model/prompt/rubric versions with expiry and invalidation. Persist recoverable job state outside service-worker memory, and guard results against navigation changes. Full automatic discovery and proactive analysis are P0; broader site support and history monitoring follow later.

The proactive UI and explicit revocable transmission consent settings now use the [shared worker contracts](worker-contracts.md). See [UI integration instructions](proactive-ui.md). Server transport, authentication, rate limiting, provider cache, and automatic mounting still require the other worker branches. The exported Gemini adapter is a library building block only; it is not an exposed service.

## Evidence contract

Current `PolicyDocument`: source URL, exact captured text, capture timestamp. Current AI `Finding`: category, explanation, exact quote, provider label, source URL. Server validation supplies the source URL from the input rather than trusting the model.

Before production, add a document content hash, extraction coverage, language, source offsets, retrieval time, provider record/review identifiers, review status, model and prompt version, and provider freshness. Keep community records as their own type; their evidence may refer to older documents and must not be represented as quotes verified against today's capture.

Domain boundary matching rejects lookalikes. Production resolution must also check public suffixes, shared-host tenants, IDNs, multiple services per hostname, and explicitly declared provider domains. Do not infer ownership by repeatedly removing labels.

## Failure behavior

- Empty, unsupported or oversized capture: actionable error; no analysis.
- Unknown community record: unavailable, not safe.
- Stale review: show date and uncertainty; do not silently overwrite it with AI.
- Missing key, timeout, quota error, malformed model output, or unsupported quotation: no fabricated fallback finding.
- Zero AI findings: “No supported findings returned,” not “This policy is safe.”
- Text extraction is not guaranteed complete, even below the size cap.

## Deliberate scope

TypeScript plus a small esbuild bundle keeps the first extension inspectable. There is no UI framework or external runtime dependency. We can adopt one if the actual interface warrants it. The package is private to prevent accidental npm publication; the GitHub repository remains public. License selection remains open. No upstream extension code was copied.
