# RedFlag team handoff

This is the entry point for a teammate or coding agent continuing RedFlag. Read [AGENTS.md](../AGENTS.md), [README.md](../README.md), and the files for your workstream. The canonical TypeScript contracts and the latest user request outrank older stage records such as `worker-contracts.md`, which still describe superseded grades, limits, and UI flows.

## Baseline and active requirements

Release: **1.0.0**, October 11, 2026. Teammate main `b463226` and the discovery-before-consent branch are included in the integration history. The repository contains a Chrome MV3 extension and a localhost Gemini server. It has no deployed public backend. See [1.0.0 verification](site-review-1.0.0.md) for the tested release and ZIP.

The current requested changes are:

1. Analyze every discovered policy, including multiple Privacy/Cookie/Terms documents and additional terms; keep unsupported or failed documents explicit.
2. Make onboarding optional and informational. Guide navigation, skip, and completion must not write preferences or change how the app analyzes, grades, or orders findings. A guide-seen marker may control only the guide’s display. Keep explicit AI consent/backend setup outside those informational actions.
3. Remove the entire Quick Read overview, including “THE QUICK READ,” “What these policies mean,” its prose and coverage text. Preserve the remaining useful Summary sections and sourced details.
4. Maintain the warm cream/brown/red-orange interface and the established red-to-green S–E grade palette.

The release removes the questionnaire and writes only a display marker on guide dismissal. AI consent is managed separately through Analyze or Settings. A horizontal S–E grade guide appears at the bottom after analysis.

## Workstreams and file boundaries

Assign one owner per file for each task. The table is a useful split, not a fixed assignment to named people.

| Workstream | Primary files | Responsibilities and integration points |
| --- | --- | --- |
| AI summaries, Chat, and red flags | `src/providers/gemini.ts`, `src/server/chat.ts`, `src/server/grading.ts`, `src/core/site-insights.ts` | Structured provider output, exact quotations, protections, cited answers, evidence deduplication. Coordinate shared result fields with the grade and popup owners. |
| Grades and policy details | `src/core/summary.ts`, `src/core/reading-time.ts`, `src/core/review-dates.ts`, `src/ui/popup-review.ts`, `src/ui/dashboard-review.ts` | Conservative S–E/? grades, source/date/coverage provenance, words and saved-time estimates, independent policy result/failure display. Grade rules belong in core rather than copied into each UI. |
| Workflow and navigation | `src/extension/popup.ts`, `popup.html`, `popup.css`, `dashboard.ts`, `src/ui/preferences.ts` | Optional guide, separate explicit settings/consent, Analyze actions, tabs, footer, no-results, keyboard and responsive behavior. `popup.ts` is shared with evidence presentation; coordinate before edits. |
| Discovery and job orchestration | `src/extension/background.ts`, `content.ts`, `src/discovery/*`, `src/background/*`, `src/history/*` | Legal links/scopes, common-address discovery, credential-free retrieval/extraction, queue/cache/consent, page generations, per-tab badges, bounded local history. |
| Integration and release | `src/core/contracts.ts`, action/chat contracts, `manifest.json`, package versions, `scripts/build.mjs`, `scripts/package-extension.mjs`, integration tests/docs | Shared boundaries, final build, merged validation, archive inspection, extracted-artifact test, and release record. |

`src/ui/overview.ts` and related UI fixtures remain in the repository, but the current extension does not put its old floating grade overlay on ordinary pages. Inspect the actual `content.ts` wiring before changing it.

## Data and action contracts

The source of truth is [contracts.ts](../src/core/contracts.ts). Contract version is 1. Policy kinds are `terms`, `privacy`, `cookies`, `additional`, and `unknown`. Keep each discovered agreement independently identifiable even when two scopes use the same URL. `ReviewState` contains a background-generated `pageKey`, sanitized page URL, context, discovery status, community references, and document reviews. Raw policy text is not part of review-state messages or saved history.

`DocumentReview` carries status, grade, coverage, word count, freshness, cache flag, assessment, and an optional staged failure with canonical code/message/retry delay. `DocumentAssessment` carries findings/protections, summary, content hash, source identity, and provider/model/prompt/rubric metadata. Model-generated URLs, grades, quotations, and metadata must pass server/runtime validation.

| Trusted UI action | Behavior |
| --- | --- |
| `redflag/scan-current` | Discovers the current site with existing permissions. Does not request AI consent. |
| `redflag/analyze` with `one` | Targets one authoritative discovered document. Current valid evidence may be reused. |
| `redflag/analyze` with `all` | Queues all discovered documents with valid cache reuse. |
| `redflag/analyze` with `recheck` | Queues every discovered document and bypasses analysis cache for an explicit fresh review. The popup’s Analyze all currently uses this mode. |
| `redflag/recheck-site` | Resolves an existing saved-site record; cannot recreate a deleted review. |
| `redflag/chat` | Uses current retrieved documents and cited answers, with bounded input/history and stale-page rejection. |

Use [analysis-actions.ts](../src/core/analysis-actions.ts), [discovery-actions.ts](../src/core/discovery-actions.ts), and [chat-contracts.ts](../src/core/chat-contracts.ts). Callers supply document IDs/page keys, never arbitrary policy text or URLs for analysis. The background resolves the current tab and validates trusted-extension senders. Success acknowledgment means queued/joined work, not a finished assessment; UI must consume subsequent `redflag/state` updates. Two independent jobs run concurrently, with bounded retrieval/extraction/analysis transport. Popup closure must not cancel admitted work.

The backend endpoints are authenticated `POST /api/analyze`, `POST /api/chat`, and `POST /api/health`; pairing has a separate local-connect path. Setup is documented in [gemini-backend.md](gemini-backend.md). The configured selected provider credential stays server-side. Backup models use that same credential; insufficient evidence is a valid Unrated result, not a reason to try a more favorable model.

## Evidence, grades, and preferences

Use `supportedAssessment`, `supportedDocumentGrade`, and `summarizeReview` from [summary.ts](../src/core/summary.ts). S is strongest; E is weakest; Unrated displays as `?`. A Gemini grade requires matching source identity, complete coverage, current rubric/versioned evidence, and affirmative evidence for required categories. Overall Gemini grade is the worst supported grade only when Terms and Privacy exist and all discovered documents are graded. Cookies may be included in Privacy, so a separate Cookie document is optional. Fresh, comprehensively reviewed ToS;DR service ratings can supply an attributed overall community grade; they cannot become individual policy grades.

Exact quotes establish text presence, not perfect interpretation or complete discovery. Keep missing evidence, partial coverage, operational failures, and unknown publisher dates explicit. Saved reading-time estimates must derive from current successful assessments, not from failed transport.

Canonical preferences use `redflag.preferences.v1`: enabled state, priorities, and versioned affirmative AI consent. Custom interests use `redflag.custom-interests.v1`; backend configuration, jobs, cache, and history have separate storage. Guide display state must not act as consent or overwrite these settings. Discovery and information remain usable before AI consent. Each new transmission must still respect authoritative consent; revocation stops queued/new sends, but cannot recall already sent requests.

Current whole-policy limits are 250,000 characters and 2,000,000 downloaded bytes in [policy-text.ts](../src/core/policy-text.ts). Reject oversized input rather than silently truncating. Retrieval omits credentials, rejects unsafe destinations, and does not click links, toggle site controls, log in, or submit forms.

## Collaboration and integration workflow

1. Read `git status`, local/remote main, the latest task instructions, and this handoff. Preserve uncommitted work; assign file ownership before parallel editing.
2. Follow the user’s requested branch. Otherwise use a focused `codex/<scope>` branch from current main. Avoid concurrent builds in a shared checkout: one owner builds, other agents run direct suites against that build.
3. Explain proposed changes to shared types/storage/message names before editing every caller. Make related producer/consumer changes together and keep transport/runtime validation.
4. Before integrating or pushing, inspect current remote main and teammate branch net diffs. Use normal merge/rebase operations; never force-push main or replace it with an older checkout. If main advances, integrate its changes, resolve behavior intentionally, and rerun affected checks.
5. Keep unrelated teammate changes out of your commit. Handoff the base/current commit, owned files, behavior changes, exact commands/results, fixture/live distinction, and unresolved risks.
6. The integration owner builds and verifies the final merged artifact, then packages it. A ZIP built before a later change is stale even if its version string did not change.

Read-only remote inspection during preparation found `fix/analyze-all-discovery-before-consent` at `cfac7e8`, four commits ahead of baseline main. Its net diff only moves the popup Analyze all consent/backend gate until after discovery and the no-document check. It does not remove transmission consent or change background/contracts. Earlier commits on that branch began from an older UI; inspect/apply the final behavior rather than replaying stale popup files. Recheck the remote state before integration; this snapshot is not a standing instruction to merge the branch.

## Verification and packaging

Use Node.js 24 and `npm ci`. `npm run check` runs strict types, unit tests, and the build. Tests listed below are commands to run as relevant; this handoff does not claim the active change has passed them.

| Concern | Useful checks |
| --- | --- |
| Optional information-only guide and keyboard/failures | `node tests/browser.mjs` plus assertions that guide actions leave canonical preferences/custom interests unchanged |
| Popup Summary/grades/pending/errors/navigation | `node tests/popup-redesign.mjs`, `node tests/popup-current-tab.mjs` |
| All policies, queue/cache, retries, navigation, closure | `node tests/actions-browser.mjs`, `node tests/analysis-batch-browser.mjs`, `node tests/discovery-browser.mjs`, `node tests/site-discovery-browser.mjs` |
| Real extension-to-local-HTTP flow | `node --experimental-strip-types tests/site-review-integration.ts`, `node --experimental-strip-types tests/backend-browser.ts` |
| Extraction and explicit combined legal scopes | `node tests/extraction-browser.mjs`, unit tests in `tests/legal-label.test.ts` and discovery tests |
| Saved reviews/settings/deletion/accessibility | `node tests/dashboard-browser.mjs`, `node tests/device-vault-browser.mjs` |
| Palette/assets | `node tests/branding-browser.mjs` |

Direct test commands use the existing `dist/extension`. The matching npm browser scripts rebuild first, so coordinate before invoking them in parallel. Most tests use synthetic public policy/provider responses. A live-provider run needs authorization, bounded calls, and the selected credential/profile; record it separately from fixture checks.

After the final build, `node scripts/package-extension.mjs` creates the versioned ZIP in Downloads. Verify ZIP integrity, `manifest.json` at root, manifest/package version agreement, required assets, absence of local `.env`/connection credentials, and byte equality with the final build. Extract it into a fresh folder, then run:

```sh
REDFLAG_EXTENSION_DIR='/absolute/path/to/extracted-extension' node tests/browser.mjs
REDFLAG_EXTENSION_DIR='/absolute/path/to/extracted-extension' node --experimental-strip-types tests/site-review-integration.ts
```

Record the final commit, test commands, artifact path, SHA-256, and limits in a new versioned verification note. Keep historical release records unchanged rather than retroactively crediting them with new tests.
