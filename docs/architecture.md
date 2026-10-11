# Architecture decisions

## Current framework

Chrome toolbar action → activeTab permission → user-triggered script reads selected/main text → popup source preview. Priorities live in `chrome.storage.local`. Captured text remains in popup memory. Demo findings are fictional, deterministic and visibly labeled. Network access is disabled by the popup content security policy.

[Chrome documents activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab) as temporary access granted by user action. It suits manual review. It does not authorize continuous all-site detection. We request `scripting` for extraction and `storage` for preferences; no broad host permissions, browsing-history permission, or background monitor.

## Planned production path

1. Extract candidate policy text, display URL and coverage, and let the user confirm transmission.
2. Community provider resolves a verified domain, returns reviewed points with attribution and timestamps. Prefer local catalog matching if authorized access and size permit it; otherwise disclose the queried domain.
3. Authenticated backend receives only approved policy text. Apply size limits, timeouts, abuse protection, per-user quotas, and no raw-text logging.
4. Server-only Gemini adapter returns categorized explanations with exact source passages.
5. Validate schema and quotes, then separately assess interpretation quality. Render plain text; provider/model HTML is never trusted.
6. Keep community findings and AI interpretation distinct. Reorder using local preferences; do not change provider ratings or evidence.
7. Later, opt-in site adapters offer dismissible reminders. Never accept, decline, or block consent on the user's behalf.

The server transport, authentication, rate limiting, provider cache, and transmission consent UI do not exist yet. The exported Gemini adapter is a library building block only; it is not an exposed service.

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
