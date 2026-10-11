# Shared worker contracts — v1

Canonical types: `src/core/contracts.ts`. This is an additive contract; legacy `src/core/evidence.ts` and the manual/demo framework remain intact. All workers should bring the shared-contract commit from main into their own worktree before binding their code. Request integration-owner changes rather than independently changing the shared shape.

## Ownership

- Agent 1: discovery, content-script/service-worker wiring, manifest/build wiring, retrieval, cache, ToS;DR adapter, state and message persistence/validation.
- Agent 2: server endpoint, Gemini adapter, evidence validation and rubric. Owns any server package/environment loading.
- Agent 3: `src/ui/overview.ts`, UI styles, popup/settings, preference migration and UI tests. Does not edit Agent 1's manifest/build/background files.
- Integration chat: this contract, cross-worker coordination, merges and end-to-end acceptance tests.

## Documents and assessments

Use `DocumentKind` values `terms`, `privacy`, `additional`, or `unknown`; keep documents independent. URL identity is an actual discovered URL, not a guessed policy endpoint. `DocumentReview` contains the discovered document, pending/ready/unrated status, grade, coverage, reason, freshness, community references, and optional assessment. Pending/unrated documents use grade `Unrated`; an Unrated result has a reason. Partial/unknown coverage cannot become a reassuring whole-document grade.

A review may be `ready` with an Unrated assessment if processing finished but evidence is insufficient; prefer `unrated` for that visible state. No finding must ever be invented merely to make a grade. Even empty valid AI output does not establish safety. Positive grades require the rubric's affirmative evidence and sufficient coverage.

`CommunityReference.rating` is a provider's service rating (for example a ToS;DR letter), not the document's `grade`. The overall UI should derive a concise overview from independently supported document findings; do not average missing grades or combine incompatible ratings. `EvidenceFinding.quote` is an exact continuous passage from the analyzed input. Server validation supplies the source URL and validates optional offsets, rather than trusting the model.

Dates are ISO 8601 strings. Absent source/review dates remain unknown. A record update, fetch time, analysis time, and actual review date have distinct meanings. `contentHash` is SHA-256 of the exact UTF-8 analysis text; Agent 2 recomputes/verifies it. Include model/prompt/rubric versions in analysis cache identity. Keep legal text outside the UI review state/messages.

## Backend endpoint

Agent 2 provides `POST /api/analyze` accepting `AnalyzeRequest` and returning `AnalyzeResponse`, with `AnalyzeErrorResponse` for failures. One request analyzes one document. The backend rejects unsupported version, invalid URL/kind/coverage/hash, empty or oversized text, and missing access authorization. The existing 60,000-character cap remains the P0 limit; no silent truncation. The backend computes trusted timestamps/version metadata itself.

Agent 1 only calls the backend when the authoritative stored AI consent is enabled and current. Consent state is not a client-supplied boolean that authorizes an otherwise public unlimited endpoint. The server implements the agreed demo access protection and quotas. Do not send page URLs, form values, preferences, authentication cookies, or unrelated DOM text to Gemini. Server GEMINI_API_KEY is never part of this wire format.

Agent 2 documents the localhost/hosted base URL and server access setup; Agent 1 owns extension host permission configuration. Any demo access credential shipped to an extension must not be treated as a production secret.

## Preferences and consent

Store `RedFlagPreferences` at `chrome.storage.local['redflag.preferences.v1']` using `PREFERENCES_STORAGE_KEY`. Fresh settings come from `createDefaultPreferences(now)`: extension enabled, no selected priorities, AI consent disabled. Agent 3 may migrate legacy `priorities` into recognized categories once; legacy data never implies AI consent.

Affirmative opt-in sets enabled, grantedAt, updatedAt, and current noticeVersion. Revocation sets enabled=false and updatedAt; Agent 1 stops queued/new transmissions. Notice-version mismatch disables transmission until consent is renewed. Do not claim already transmitted requests can be recalled. Keep preference changes in trusted extension settings UI; Agent 1 must reject preference-write requests originating from webpage content scripts. Read permissions and AI consent are independent.

## Extension messaging and UI mount

Use the discriminated `ExtensionMessage`/`ExtensionResponse` unions. Background resolves tab/frame identity from the browser sender, validates discovery payloads, assigns a new pageKey on navigation, and publishes `redflag/state` only to the relevant tab. Popup `redflag/get-state` resolves the active tab in trusted background code. A pageKey distinguishes generations even when a page URL repeats. UI/content scripts discard state for old generations.

Agent 3 exports `mountOverview` from `src/ui/overview.ts` with the exact `MountOverview` signature. It receives initial state/preferences/actions and returns update(state, preferences) and destroy(). Agent 1 imports it into the discovery/content entry point, mounts on relevant context discovery, updates as jobs resolve and preferences change, and destroys on navigation/context disposal. The UI mounts inside an isolated ShadowRoot, handles DOM output as plain text, and does not touch site controls. `onOpenSettings` opens the extension's settings/popup through Agent 1's trusted wiring; `onDismiss` suppresses the current review's overlay. This contract does not require a service-worker keepalive or polling loop.

## Boundary validation

TypeScript types are not runtime validation. Each owner validates their incoming boundary. Unknown messages, unsafe URLs, mismatched versions/document ids, model-generated URLs/metadata, and untrusted preference writes must fail explicitly. Development fixtures use these types but remain clearly labeled; passing mocked tests does not certify live provider functionality.
