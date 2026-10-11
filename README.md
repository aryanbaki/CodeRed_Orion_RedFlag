# RedFlag

**Understand a website’s terms before you agree.**

RedFlag is a Manifest V3 Chrome extension that discovers public privacy, cookie, and terms policies, combines attributed ToS;DR community ratings with Google Gemini analysis, and explains concerns using exact passages from the source documents.

**Current version:** 0.3.6 · **Status:** local developer extension with a local Gemini backend. No public backend is deployed.

## What you can do

- **Review policies at a glance.** See an overall grade, separate Privacy, Cookies, and Terms cards, and retrieved word counts. Use **Analyze all** or a policy’s **Analyze** button to refresh a review.
- **Read the evidence.** Red flags include source quotations and links. Summary brings together supported risks and protections; Chat answers questions with policy citations.
- **Choose your focus.** Optional interests bring relevant findings first without changing their grades.
- **Use community ratings.** ToS;DR ratings are attributed to the service being reviewed. They do not become invented scores for individual policies.
- **Keep a local review history.** My sites stores checked reviews on your device. The device vault supports deletion, clearing, and credential-free export.

When no public policies or current community rating are found, RedFlag shows **“I couldn’t find anything on this platform”** with an option to check again, instead of displaying empty score cards.

## How grades work

RedFlag uses **S, A, B, C, D, and E**, with S strongest and E weakest under its evidence-based rubric. **?** means unknown or unrated.

Gemini identifies clauses; the backend verifies exact quotations and computes grades from the supported evidence. A grade requires complete extraction and evidence for every required grading category. Missing, inaccessible, hidden, or ambiguous policy content remains unrated. A review can still show verified findings when it cannot support a grade.

The overall Gemini grade is the worst supported grade across discovered documents once Terms and Privacy are present and every discovered document is graded. A separate cookie policy is optional. Combined privacy-and-cookie documents are recognized in both categories. During incomplete AI analysis, a current, comprehensively reviewed ToS;DR service rating can supply the overall grade, with its source identified.

See the [grading rubric and evidence requirements](docs/gemini-backend.md#rubric-redflagrubricv3) for details.

## Quick start

### 1. Build the extension

Requirements: **Node.js 24**, npm, and **Chrome 127 or newer**.

```sh
npm ci
npm run check
```

This checks TypeScript, runs the unit tests, and builds the extension in `dist/extension`.

### 2. Load it in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked** and select `dist/extension`.
4. Open a regular website and select the RedFlag toolbar icon.
5. Complete first-use setup. Choose community ratings only to use RedFlag without a Gemini backend.

After rebuilding, click **Reload** on RedFlag’s extension card. Its manifest key keeps the extension ID stable when the unpacked folder moves.

### 3. Enable Gemini analysis

Create a private configuration file from the blank template:

```sh
cp .env.example .env
```

In `.env`, configure the selected Gemini profile and its matching API key, a model, and a separate local backend access token. The template defaults to the `free` profile, which reads `GEMINI_FREE_API_KEY`. To use `GEMINI_API_KEY`, set `GEMINI_PROFILE=default`.

Generate the local access token with:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Save it as `REDFLAG_DEMO_TOKEN` in `.env`, then start the backend:

```sh
npm run start:server
```

The backend listens on `127.0.0.1:8787` and derives the allowed extension origin from the manifest. RedFlag pairs automatically with the running local backend. Open its popup, retry the connection if needed, and choose **Enable checks** after reviewing the notice.

For manual connection, use **Advanced connection** to import the generated `~/Downloads/RedFlag-Local-Connection.json` file. Keep the backend running while using AI analysis and Chat.

**Store provider keys in `.env`, never in `.env.example`, extension source, or Git.** The connection file contains a private backend access token and should also stay local. See the [backend setup guide](docs/gemini-backend.md) for full configuration, profile selection, and troubleshooting.

## Privacy and data handling

Installation requests access to HTTP/HTTPS sites so RedFlag can discover public policy links and retrieve their documents. AI analysis requires affirmative consent, which can be changed or revoked through **Review setup**.

- Google provider keys stay on the backend. The extension receives a separate local access token.
- Consented Gemini analysis sends retrieved public policy text to Google. ToS;DR lookup sends the site domain.
- Account data, form inputs, and authentication cookies are excluded from the policy retrieval flow.
- Complete policy text and Chat are transient; bounded evidence and review metadata may be stored locally in My sites.
- No RedFlag account or sign-in is required.

See [architecture and data boundaries](docs/architecture.md) for the implementation details.

## Development and verification

```sh
# Types, unit tests, and production build
npm run check

# Packaged popup and extraction checks
npm run test:popup-redesign
node tests/extraction-browser.mjs

# Extension-to-backend transport checks
npm run test:backend-browser
```

Browser suites require a Playwright-compatible Chromium installation. Most UI and transport checks use simulated provider responses; they do not establish live Gemini output quality.

The latest local verification passed TypeScript, all **77 unit tests**, the production build, and DOM extraction checks. Live Chrome verification confirmed policy discovery, a supported privacy grade, sourced findings, and the no-results screen. Automated Chromium launch was unavailable in that environment. Additional verification records are in [docs/verification.md](docs/verification.md).

### Supporting tools

- `node scripts/package-extension.mjs` creates a versioned ZIP in Downloads after a build, with `manifest.json` at the archive root and local connection credentials excluded.
- `node scripts/refresh-community.mjs` refreshes the attributed community snapshot. API failures retain existing data; snapshots older than seven days do not supply an overall community grade.
- `npm run research:probe` sends fixed example requests to ToS;DR and PrivacySpy to check API availability. It does not send browsing activity or save policy content.

## Current limitations

- Gemini analysis and Chat need the local backend; this repository does not provide a deployed public service.
- The configured primary model is Gemini 3.5 Flash, with Gemini 3.1 Flash-Lite and Gemini 2.5 Flash-Lite as backups. Availability depends on the configured Google project. Backups use the same selected credential; missing evidence does not trigger a model switch.
- Discovery supports explicit legal links, verified common policy addresses, standard static legal containers, and explicit Adobe Core Components legal layouts. Unsupported or incomplete documents remain unrated.
- A verified quotation establishes that a passage exists, but does not guarantee that every relevant clause was found or correctly interpreted.

## Project layout

| Directory | Purpose |
| --- | --- |
| `src/extension` | Manifest, popup, dashboard, content script, and service worker |
| `src/discovery` | Legal-link recognition and URL validation |
| `src/background` | Retrieval, extraction, caching, analysis, and community lookup |
| `src/core` | Shared contracts, evidence rules, grade summaries, and interests |
| `src/server` | Local HTTP backend, authentication, validation, and grading |
| `src/providers` | Server-only Gemini adapter and demo provider |
| `src/history` | Local review storage and retention |
| `src/ui` | Shared interface components, preferences, and styling |
| `tests` | Unit, integration, and browser verification |
| `docs` | Setup guides, research, architecture, and verification records |

## Documentation

- [Gemini backend setup](docs/gemini-backend.md)
- [Architecture and data boundaries](docs/architecture.md)
- [Discovery and background behavior](docs/discovery-background.md)
- [Verification records](docs/verification.md)
- [Research and source references](docs/research.md)
- [Implementation plan and acceptance criteria](docs/implementation-plan.md)
- [UI checks and integration guidance](docs/proactive-ui.md)

## Attribution and licensing

Research references include [ToS;DR](https://github.com/tosdr/browser-extensions), [PrivacySpy](https://github.com/Politiwatch/privacyspy), [Checkmate](https://github.com/nyxb1t/checkmate), [Open Terms Archive](https://github.com/OpenTermsArchive/engine), and [Mozilla Readability](https://github.com/mozilla/readability). Community data attribution is documented in [docs/tosdr-data.md](docs/tosdr-data.md). Dependencies retain their own licenses.

**No project license has been selected.** Public repository visibility does not grant a reuse license.
