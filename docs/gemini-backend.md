# P0 Gemini analysis backend

This branch extends the existing server-only `analyzeWithGemini` library entry point. The P0 endpoint uses `analyzeDocument` and the integration-owned `src/core/contracts.ts` without changing that contract. It is a controlled localhost demo, not a public production service.

## Local configuration

1. Use Node 22.6+ and `npm ci` in this worktree.
2. Copy `.env.example` to `.env` and fill it locally. Never paste the Gemini key into chat, settings, a request body, or extension source.
3. Set the selected Gemini profile key (see below), `GEMINI_MODEL` (an exact enabled model ID supporting structured generateContent), `REDFLAG_DEMO_TOKEN` (32–128 base64url characters), and `REDFLAG_ALLOWED_ORIGIN` (the exact `chrome-extension://` development extension ID). `PORT` defaults to 8787. No model is silently selected or substituted.
4. Generate a local demo token with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`. This is an access credential for this local server, separate from the Google key. Configure the token in trusted extension settings/storage, never compile it into extension code.
5. Run `npm run start:server`. The server listens only on `127.0.0.1`. Startup fails without valid configuration. No policy text, request bodies, credentials, or upstream error bodies are logged. Startup/listen errors have fixed messages.

Git already ignores `.env`, `.env.*`, build outputs and logs; the explicit `.env.example` exception contains names and blank values only. Never commit populated env files. The extension build imports no provider/server modules. The server makes no source-URL fetches and sends only the exact legal text plus fixed analysis instructions/schema to Google, with its key in `x-goog-api-key`.

## Free/paid keys and future providers

Open the ignored `.env` in the Codex side editor. Paste the free-project key immediately after `GEMINI_FREE_API_KEY=` and the paid-project key immediately after `GEMINI_PAID_API_KEY=`. Keep `AI_PROVIDER=gemini` and `GEMINI_PROFILE=free` to start; change the profile to `paid` and restart the server to deliberately use the paid-project key. The profile name is a local label, not verification of Google billing status. Check the project's Billing Tier in AI Studio; two keys on the same project do not create two independent tiers. Existing keys can be reused rather than generating new ones.

`GEMINI_FREE_MODEL` and `GEMINI_PAID_MODEL` optionally override `GEMINI_MODEL` for their respective profile. A missing selected key fails configuration; no free-to-paid fallback occurs on quota or configuration errors. Legacy deployments with `GEMINI_API_KEY` continue to work when `GEMINI_PROFILE` is unset or explicitly `default`. Update the trusted worker's model/cache configuration if the selected profile uses a different model. Profile selection does not alter document/result contracts or bypass consent.

The local setup uses `gemini-3.5-flash-lite` as an editable starting model; Google lists a free tier on its [pricing page](https://ai.google.dev/gemini-api/docs/pricing). Account-specific availability and live quality remain unverified. Google associates keys with [projects](https://ai.google.dev/gemini-api/docs/api-key); free/paid service depends on [billing configuration](https://ai.google.dev/gemini-api/docs/billing), not merely a consumer subscription.

Future credential slots are `OPENAI_API_KEY`/`OPENAI_MODEL`, `ANTHROPIC_API_KEY`/`ANTHROPIC_MODEL` for Claude, and `CUSTOM_API_KEY`/`CUSTOM_API_BASE_URL`/`CUSTOM_API_MODEL`. These are reserved configuration fields only: adding keys does not implement those providers. `src/server/provider-config.ts` is the server-side selection boundary; future adapters must reuse the same document validation, evidence verification, rubric, consent and quota boundaries. Gemini is the only active adapter; setting `AI_PROVIDER` to any other value fails explicitly. OpenAI's [official quickstart](https://developers.openai.com/api/docs/quickstart) uses `OPENAI_API_KEY`. No inactive credentials are loaded into the active transport config or transmitted.

`.env` is kept outside Git and created with owner-only permissions. The local demo token and extension origin are prefilled for this worktree's `dist/extension`; when loading an integrated extension from another directory, update `REDFLAG_ALLOWED_ORIGIN` to its actual ID. Provider keys never belong in browser storage or extension settings. Paste keys into the local editor, save the file, and restart with `npm run start:server` from this worktree.

## Wire integration

Base URL: `http://127.0.0.1:8787`. `POST /api/analyze` accepts exactly `AnalyzeRequest`: `{schemaVersion:1, document:{id,url,kind,text,retrievedAt,documentUpdatedAt?,coverage,contentHash}}`. Send `Content-Type: application/json` and `Authorization: Bearer <local-demo-token>`. The extension request must carry its configured exact Origin; CORS accepts only that origin. Browser-generated Origin cannot be replaced with a site Origin. CLI tests must explicitly set it. Preflight supports POST, Authorization and Content-Type.

The background worker's trusted `redflag.backend.v1` configuration can use `{baseUrl,accessToken,model,promptVersion,rubricVersion}`. Set model to the same `GEMINI_MODEL`, `promptVersion` to `redflag.prompt.v1`, and `rubricVersion` to `redflag.rubric.v2`. Restrict storage access to trusted extension contexts. Agent 1 owns storage/host permissions and must grant the local endpoint origin. The server does not import or implement this client storage.

The authoritative stored affirmative AI opt-in, current `AI_NOTICE_VERSION`, and grant timestamp must be checked by the background worker immediately before every transmission/retry. Revocation stops queued/new transmissions. Do not call from content scripts or pass arbitrary webpage messages through to this endpoint. Retrieve public legal documents without authentication cookies; exclude forms, account data, unrelated DOM text, browsing history and page URLs. This follows the integration contract: consent is not an untrusted request boolean. The server cannot prove that arbitrary supplied text is public or that a bearer-token holder has consented; the trusted worker owns this provenance/privacy boundary. Origin + a local access token protects the demo, not a production user-consent system.

Hash the exact extracted UTF-8 text with SHA-256, lower-case hex; never normalize after hashing. One request analyzes one document: `terms`, `privacy`, or `additional`. `unknown` is returned Unrated/unsupported without calling Google. URLs must be public HTTP(S) DNS names, no credentials, query, fragment, IP literals, local suffixes or nonstandard ports. A query-bearing legal document is unsupported in this demo rather than silently rewritten. Source URL metadata is never fetched by the backend. Retrieval must independently validate destination/redirects before sending text.

Success, including provider failure for an otherwise valid document, is HTTP 200 `AnalyzeResponse`: `{schemaVersion:1,assessment}`. A client must inspect `assessment.grade` and `reason`; 200 alone does not mean rated. ID, URL, kind, coverage, content hash, model, analysis timestamp, prompt version and rubric version are trusted server metadata. Findings carry stable IDs and exact UTF-16 start/end offsets (end exclusive) into submitted text. The first exact occurrence is used if a quote repeats. Provider-selected URLs, timestamps, grades, and unknown fields are rejected. Keep original retrieval/publisher dates in the worker's `DocumentFreshness`; the assessment contract does not duplicate them, and the backend never infers a publisher date from retrieval/analysis time.

Cache only when identity, URL, kind, exact content hash, coverage, model, prompt and rubric versions match. Do not cache incomplete/invalid/provider-failure results as successful ratings. Client persistence, job deduplication, suspension recovery, navigation generation checks and revocation are Agent 1's responsibility. Use client pending states while this bounded synchronous endpoint runs; there is no server job/poll endpoint and no keepalive assumption.

HTTP failures follow `AnalyzeErrorResponse`. Invalid version/shape/hash/date/text → 400 (`invalid-response`); access token → 401 (`authentication-required`); origin → 403 (`unsafe-url`); wrong path → 404; wrong method → 405; input too large → 413; non-JSON/compressed body → 415; upload timeout → 408; demo limits → 429 (`quota`, Retry-After). All error messages are fixed and contain no input or upstream details. Oversized chunked uploads are disconnected after the cap.

## Bounds and failures

- Exact legal text: 12–60,000 nonempty input characters, no truncation; JSON body and provider response each capped at 256,000 bytes; findings ≤30, quotes 12–4,000 characters, explanations 12–2,000 characters.
- Five-second upload deadline; 30-second overall provider deadline covers fetch, retries and full response body; 8,192 output-token cap.
- At most one retry for 500/503 after 250–349ms jitter, inside the same overall deadline. Quota (429), configuration/client errors, malformed/refused/truncated output, and network errors are not automatically retried. Client must not multiply this into an unbounded retry loop.
- Exact origin and constant-time demo-token comparison; two concurrent admitted requests, ten per minute, 100 per rolling 24 hours per server process; twenty open connections, short header/keepalive timeouts. Authenticated invalid JSON requests also consume quota. Limits count requests, so retries may cause at most two provider calls per admitted request.
- Counters reset on server restart and apply to the one local demo credential. Keep this bind address; hosted/multiuser deployment needs managed authentication, durable per-user/provider budgets, HTTPS and shared rate limiting before exposure.
- Partial/unknown extraction coverage skips Gemini and yields Unrated/incomplete. Missing config fails startup; the adapter also fails closed without a request if invoked without config. Timeout, quota, network/provider failure, malformed output or fabricated evidence yields Unrated with no fallback findings. Unknown/malformed provider finish reasons, MAX_TOKENS, safety refusal and oversized output fail closed.

## Rubric `redflag.rubric.v2`

This is an explicit conservative risk rubric for the English demo corpus, not a legal conclusion or a measurement of safety. The model identifies clauses and severity; the server validates exact evidence and computes the grade. Exact quotation validation proves presence, not semantic correctness or recall. Human review and live corpus evaluation remain necessary. Non-English/nonlegal input is instructed to report missing evidence; the wire format has no language/provenance field, so the trusted worker must restrict the demo corpus to English public legal documents.

Required categories:

| Document | Required independent category assessments |
| --- | --- |
| Terms | renewal, cancellation, arbitration, content-rights |
| Privacy | sharing, retention, tracking |
| Additional Terms | all seven, conservatively; categories absent/uncertain produce Unrated |

Every required category must have exactly one assessment: `risk` cites exactly a supporting finding quote; `protective` requires an explicit exact protective quote and no contradictory risk findings; `not-found` uses null quote. Unknown, missing or duplicate assessments, invalid severity, nonexistent/altered/noncontinuous quotes or contradictory risk/coverage statements invalidate the entire provider response. Category assessments are internal validation inputs rather than additions to the canonical response. Never infer protections from silence, or treat a silent category as not applicable. An empty findings list remains Unrated even with protective assessments. Complete claimed extraction is necessary but cannot prove actual retrieval completeness.

Severity guidance (fixed in the versioned prompt):

| Category | High examples | Medium examples | Low rule |
| --- | --- | --- | --- |
| renewal | broad unilateral recurring price/commitment rights | automatic renewal | narrow obligations with explicit limiting safeguards |
| cancellation | materially obstructed cancellation | deadlines, refund/cancellation restrictions | narrow obligations with explicit limits |
| arbitration | mandatory arbitration or class-action waiver | conditional dispute restrictions | narrow procedural limits |
| content-rights | broad or irrevocable rights/license | limited reuse rights | narrow explicitly limited license |
| sharing | sale/broad transfers | conditional third-party sharing | narrow explicitly limited disclosure |
| retention | indefinite retention | conditional retention/deletion limits | narrow explicit retention limits |
| tracking | broad cross-site tracking | conditional behavioral tracking | narrow explicitly limited tracking |

Penalty per required category is the maximum validated risk severity in that category: low=5, medium=15, high=30. Duplicate findings never multiply a category penalty. Start at 100, subtract all category maxima and floor at zero. A=90–100, B=75–89, C=60–74, D=40–59, E=20–39, F=0–19. Version v2 adds the previously missing E band; previous v1 cache results are not current v2 assessments. There is no cross-document averaging. Example: a medium renewal risk with exact protective evidence for cancellation, arbitration and content rights gives 85/B; a missing arbitration assessment produces Unrated instead. Grades require complete coverage, all categories explicitly evidenced, and at least one supported risk. Insufficient evidence retains any validated risk findings but grade is Unrated; invalid output removes all findings.

## Official Gemini implementation references

Verified on 2026-10-11 only for the implementation boundary: [generateContent REST reference](https://ai.google.dev/api/generate-content), [structured output guide](https://ai.google.dev/gemini-api/docs/generate-content/structured-output?hl=en), and [troubleshooting/retries](https://ai.google.dev/gemini-api/docs/troubleshooting). The request uses `v1beta/models/{model}:generateContent`, `x-goog-api-key`, `systemInstruction`, `generationConfig.responseMimeType` and `responseJsonSchema` JSON schema, no tools, and `store:false` for provider request logging configuration. Google data retention/account terms still depend on project/service configuration; `store:false` is not a claim that no data is processed or retained under those terms. No model availability, pricing, latency or live output quality was verified.

## Verification and integration order

`npm run check` verifies strict types, simulated provider/HTTP tests, legacy evidence tests and the extension build. `npm run test:browser` checks the existing unpacked popup framework only; it does not prove the complete P0 background/UI path. `tests/analysis.test.ts` labels all provider responses simulated and starts real local HTTP servers with an injected analyzer. `npm run test:backend-browser` loads a temporary real Chromium MV3 fixture, calls the real local endpoint from its service worker, verifies the browser-generated extension Origin and canonical grade/evidence response, and checks missing-token rejection. It cleans up its temporary browser profile and extension. Provider analysis is injected/simulated; this does not exercise Agent 1’s actual discovery/consent pipeline. No real Google credential is required or used.

Bring the integration-owned shared-contract commit from main first, then cherry-pick this branch's backend implementation commit. Preserve Agent 1's build/manifest changes and Agent 3's settings/UI changes when merging. Set the trusted backend configuration and required optional host permission, then connect the background's canonical request/response handling. Perform a consented live demonstration and hand-review exact quotations, interpretations, missing clauses, all seven categories, refusal/timeout/quota behavior, cost and latency with the actual selected project/model before claiming P0 readiness.

### GenerateContent model compatibility correction — 2026-10-11

The configured free-profile model accepted `models.get` but rejected the earlier `responseFormat.text.mimeType` wire format with HTTP400. A live minimal JSON request with classic `responseMimeType: application/json` and `responseJsonSchema` returned HTTP200/STOP; the adapter now uses those generateContent fields. This preserves the existing backend, rubric, exact-evidence validation, server-only key and bounded retries. Current [API reference](https://ai.google.dev/api/generate-content.md) and [migration guide](https://ai.google.dev/gemini-api/docs/migrate-to-interactions) document classic generateContent fields; newer responseFormat examples are not evidence of compatibility with every configured model.
