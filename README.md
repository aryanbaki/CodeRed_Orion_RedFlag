# Policy review framework

A Chrome extension that combines community-reviewed insights and Google Gemini to explain terms and privacy policies, highlight sourced risks, and show personalized reminders before you agree.

**Status: research and framework, not a finished risk analyzer.** The product name and project license are undecided. Repository: [CodeRed_Orion_RedFlag](https://github.com/aryanbaki/CodeRed_Orion_RedFlag).

## What runs today

- Manifest V3 popup with user-triggered policy text capture.
- Local priorities for privacy, renewal, cancellation, arbitration and content rights.
- Proactive multi-document UI and explicit, revocable background-AI consent settings; automatic mounting still requires discovery/background integration.
- Explicitly fictional example demonstrating evidence and prioritization.
- Original server-only Gemini adapter with structured output and exact-quote validation, tested with simulated responses.
- Type checking, focused unit tests, build tooling, and GitHub Actions.

The extension makes no network requests. Real page capture produces a source preview, not a risk rating. It does not intercept agreement buttons, monitor browsing, or call Gemini. Community data, a backend endpoint, and reminders are planned. The Gemini adapter is deliberately excluded from the browser bundle.

## Run locally

Use Node.js 24 LTS and npm:

```sh
npm ci
npm run check
```

1. Open `chrome://extensions` in Chrome.
2. Enable Developer mode and choose **Load unpacked**.
3. Select `dist/extension` from this checkout.
4. Open a policy page and open the extension popup.
5. Choose **Review page text**, or **Try fictional example**.

Selected text takes precedence. Otherwise the prototype reads the first `main` or `article`, falling back to the page body. This is a basic extraction experiment: compare the preview with the policy, especially for collapsed sections or tables. Documents above 60,000 characters are rejected, never silently analyzed as complete. Text lives only in the open popup; closing it discards the text. Priorities, review enablement and background-AI consent are saved in local extension storage. AI consent defaults off. The popup itself never transmits the manual preview.

Run the isolated Chromium browser checks with `npx playwright install chromium` followed by `npm run test:browser`. Run `npm run test:ui` for synthetic multi-document warning fixtures (not live AI or discovery). Browser checks use a temporary browser profile and do not modify your everyday Chrome profile.

## Research and implementation

- [Research findings and source references](docs/research.md)
- [Architecture and data boundaries](docs/architecture.md)
- [Ordered implementation plan and acceptance criteria](docs/implementation-plan.md)
- [Verification record and browser test procedure](docs/verification.md)
- [Proactive UI checks and integration instructions](docs/proactive-ui.md)

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
