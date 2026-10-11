# RedFlag repository instructions

Read [docs/TEAM_HANDOFF.md](docs/TEAM_HANDOFF.md) and the relevant source before changing behavior. Source contracts and the latest user request take precedence over historical stage documents. This is a Chrome MV3 extension with a local Gemini backend; there is no public backend deployment.

## Product requirements

- Keep the interface simple: cream surfaces, brown text, red-orange actions, and the established S–E grade colors. Show the website once in the overall grade card.
- Onboarding is an optional explanation of the app. Opening, advancing, going back, skipping, or finishing this guide must not change saved priorities, custom interests, automatic checks, AI consent, grades, or analysis behavior. A display-only guide completion marker is separate from preferences.
- Keep explicit AI consent and backend configuration separate from informational onboarding. Do not infer consent from viewing or dismissing a guide, legacy preferences, or a webpage message.
- Analyze all covers every discovered public policy document, including multiple documents in the same category and additional terms. Missing, inaccessible, unsupported, or incomplete documents remain visible with their independent result or failure; they must not disappear to produce a better overall grade.
- Discovery must work before AI consent/backend setup. An admission acknowledgment is not analysis completion. Keep pending and actionable failure states visible, prevent duplicate admission, and preserve background work when the popup closes.
- Show a horizontal S, A, B, C, D, E grade guide at the bottom of analyzed reviews, with plain concern labels and a separate explanation of Unrated.
- Remove the entire Quick Read / “What these policies mean” overview block. Keep the supported protections, grade profile, red flags, policy details, and citations elsewhere in Summary.

## Shared contracts and evidence

- `src/core/contracts.ts`, `src/core/analysis-actions.ts`, `src/core/chat-contracts.ts`, and `src/core/discovery-actions.ts` define the boundaries. Coordinate changes to shared schemas, storage keys, message names, or version constants with the integration owner before editing callers independently.
- Use `summarizeReview` and `supportedDocumentGrade` from `src/core/summary.ts` for grades. The scale is S, A, B, C, D, E, and Unrated; the UI displays `?` for Unrated. Never average away missing evidence or use ToS;DR service ratings as individual policy grades.
- Findings and protections need exact source quotations. Partial extraction and insufficient required-category evidence cannot earn a whole-document grade. Source/retrieval/review/analysis dates have different meanings.
- Render untrusted policy/model output as text. Keep page generation guards, trusted-extension message validation, bounded queues/timeouts, credential-free policy retrieval, and revocable consent checks intact.
- Provider keys stay server-side. Do not print or commit `.env`, local connection tokens, raw policy text, Chat history, browser profiles, or credentials. Packaging must exclude them.

## Collaboration and Git

- Inspect `git status`, the current branch, and remote main before work. Preserve other contributors’ changes. Follow an explicitly requested branch; otherwise use a focused `codex/<scope>` branch.
- Agree on file ownership before parallel edits. Popup behavior and shared contracts often span workstreams; send a concrete boundary proposal instead of editing the same file concurrently.
- Use normal merges or rebases that preserve remote work. Never force-push shared main or overwrite it with an older local checkout. If main advances, inspect the net diff, integrate it, and rerun affected checks.
- Do not publish another contributor’s unrelated local changes. Keep commit descriptions about the final implementation and actual validation. Record the tested commit/build and distinguish fixtures from live provider checks.

## Validation and delivery

- Use Node.js 24. `npm run check` performs strict TypeScript checks, unit tests, and a production build.
- Run the relevant browser suites from the handoff. During parallel work, designate one build owner; direct `node tests/...` commands use the existing build without deleting another agent’s output.
- Verify Analyze all, individual analysis, no-consent/no-backend, no-results, pending/failure recovery, navigation generations, and popup close/reopen when their behavior changes. Verify guide actions leave canonical preferences unchanged when onboarding changes.
- Most suites simulate retrieval/provider responses. Do not claim they prove live Gemini availability or interpretation quality. Live provider calls require authorization within the task and must use only the selected credential/profile.
- Build before packaging with `node scripts/package-extension.mjs`. Verify archive integrity, root `manifest.json`, version/assets, credential exclusions, and byte equality with the final build. Test the extracted ZIP through `REDFLAG_EXTENSION_DIR` before describing it as verified.

