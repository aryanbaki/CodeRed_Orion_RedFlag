# RedFlag 0.3.6

A Chrome extension that combines community-reviewed insights and Google Gemini to explain terms and privacy policies, highlight sourced risks, and show personalized reminders before you agree.

**Status: locally verified developer extension; no public backend deployment.** The project license is undecided. Repository: [CodeRed_Orion_RedFlag](https://github.com/aryanbaki/CodeRed_Orion_RedFlag).

## What runs today

- Always-visible overall review with Analyze all, plus Privacy, Cookies, and Terms cards with individual Analyze buttons and retrieved word counts.
- Red flags show exact source passages, Summary shows supported risks and protections, and Chat answers questions using the retrieved policies with citations.
- User-supplied glossy flag artwork and Merriweather typography.
- Grades S, A, B, C, D, E; a neutral “?” badge means unknown / Unrated.
- Installation grants HTTP/HTTPS site access. Public policy links and verified common policy addresses are checked automatically.
- First-use onboarding enables automatic Gemini analysis or community ratings only. Settings has no priorities questionnaire.
- Official ToS;DR API lookup with 42 bundled services, domain matching (including the standard www alias), source attribution, and cached results. Community ratings apply to the service and never invent individual policy grades.
- My sites stores checked sites locally, shows overall grades, and ranks frequently checked sites first.
- Primary model: Gemini 3.5 Flash, with Gemini 3.1 Flash-Lite then Gemini 2.5 Flash-Lite as backups. Backups use the same selected credential; missing evidence never triggers another model. Gemini 3.1 Flash-Lite passed a live structured-output check; 2.5 is currently unavailable for the configured key.
- Server-only Gemini adapter with structured output, exact quotation validation, and independently evidenced policy categories. Fully evidenced protective policies can earn S.
- Sites with no discovered policies or current community rating show “I couldn’t find anything on this platform” instead of empty score cards.
- Discovery recognizes Site Terms, Privacy Notices/Statements, and combined privacy-and-cookie documents, preserving both scopes during page updates.
- Static legal containers with complete extracted text can be graded. Explicit Adobe Core Components policy layouts with legal titles and visible rich-text blocks are also supported. Hidden sections, ambiguous structure, missing evidence, inaccessible documents, and absent configuration remain unrated.

The overall Gemini grade is the worst supported grade across discovered documents, once Terms and Privacy are present and every discovered document is graded. A separate Cookie policy is optional because some sites include cookie terms in Privacy; its row shows a neutral “?” badge when no separate policy was found. During incomplete AI analysis, a current comprehensively reviewed ToS;DR service rating can supply the overall grade, with its source shown.

## Run locally

Use Node.js 24 and npm:

```sh
npm ci
npm run check
npm run test:popup-redesign
node tests/extraction-browser.mjs
npm run test:backend-browser
```

1. Open Chrome extensions, enable Developer mode, and load unpacked `dist/extension`.
2. Reload an existing installation so the changed host permissions and new popup apply.
3. Open RedFlag on a website and complete first-use setup once.
4. For Gemini, configure the server as described in [Gemini backend setup](docs/gemini-backend.md), run `npm run start:server`, then import the generated `RedFlag-Local-Connection.json` in onboarding. The manifest has a stable extension ID, so moving the unpacked folder preserves the backend origin.
5. Enable Gemini checks after reviewing the onboarding notice. Discovery and analysis then run automatically; Analyze all or individual Analyze buttons explicitly refresh the results.
6. Use Review setup to change or revoke AI consent.

Provider credentials stay in ignored local configuration. The saved free-profile credentials were reused for live Gemini checks: GitHub Privacy returned two exact-quote findings, and a Terms retry returned three. Both remained unrated because required category evidence was missing. Chromium UI/transport suites use simulated provider responses; the separate live check is recorded in docs/verification.md. This is local development configuration, not a deployed public backend.

Refresh the attributed initial community snapshot with `node scripts/refresh-community.mjs`. API failures retain existing data. Old snapshots do not supply an overall community grade after seven days without refresh.

## Research and implementation

- [Research findings and source references](docs/research.md)
- [Architecture and data boundaries](docs/architecture.md)
- [Ordered implementation plan and acceptance criteria](docs/implementation-plan.md)
- [Verification record and browser test procedure](docs/verification.md)
- [Proactive UI checks and integration instructions](docs/proactive-ui.md)
- [Discovery/background configuration and limitations](docs/discovery-background.md)

Run `npm run research:probe` for read-only API availability checks. This sends fixed example requests to ToS;DR and PrivacySpy; it does not send browsing activity or save policy content.

## Layout

| Location | Purpose |
| --- | --- |
| `src/extension` | Popup, permissions, capture, local preferences |
| `src/core` | Evidence contract, validation, prioritization, domain matching |
| `src/providers` | Fictional demo and server-only Gemini adapter |
| `tests` | Evidence, domain, provider, and browser checks |
| `docs` | Research, decisions, implementation gates |

## Attribution and licensing

Research references: [ToS;DR](https://github.com/tosdr/browser-extensions), [PrivacySpy](https://github.com/Politiwatch/privacyspy), [Checkmate](https://github.com/nyxb1t/checkmate), [Open Terms Archive](https://github.com/OpenTermsArchive/engine), and [Mozilla Readability](https://github.com/mozilla/readability). No source code, ratings datasets, or artwork from these projects has been copied into this framework. Dependencies retain their own licenses. No project license has been selected; public visibility alone is not a reuse license.

## Local Gemini backend

The local endpoints are `POST /api/analyze`, `POST /api/chat`, and authenticated `POST /api/health`. Setup, canonical contracts, consent integration, exact-evidence validation, the explicit grading rubric and simulated-verification limits are documented in [docs/gemini-backend.md](docs/gemini-backend.md). Fill an ignored local `.env` from the blank `.env.example`, then run `npm run start:server`. Keep Google credentials on the server; the extension receives only a separate local access token. Chat and complete retrieved policy text are transient, while bounded evidence and review metadata may be saved in My sites.

Create the versioned loadable archive with `node scripts/package-extension.mjs` after building. It includes manifest.json at its root and excludes local connection credentials. See [current verification](docs/site-review-0.3.4.md).

Version 0.3.2 adds automatic local-backend pairing, concise summaries, and estimated reading minutes saved for successfully analyzed documents. The backend must run on 127.0.0.1:8787; provider keys stay server-side. First-use public-policy consent remains a single Enable checks action.

Version 0.3.3 widens the popup to 480px, keeps Merriweather headings with sans-serif interface copy, replaces the long Summary with a concise overview and expandable notes, and adds a two-step first-use interests/consent flow. Optional interests reorder verified findings without changing grades. Device vault offers individual review deletion, review clearing, credential-free JSON export and a complete device reset that pauses checks. No account or sign-in is required.

Version 0.3.4 adds prose summaries with positives first, ordinal S–E grade bars, distinct review/publisher dates, manual public-policy links, common-address retries, and compact reminders for observed legal links during ordinary browsing. Signup/consent pages still get a dismissible agreement review. Reminder actions open the toolbar popup (Chrome 127+), preserving the website tab for analysis and chat.
