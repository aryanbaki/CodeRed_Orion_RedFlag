# Policy review framework

A Chrome extension that combines community-reviewed insights and Google Gemini to explain terms and privacy policies, highlight sourced risks, and show personalized reminders before you agree.

**Status: research and framework, not a finished risk analyzer.** The project license is undecided. Repository: [CodeRed_Orion_RedFlag](https://github.com/aryanbaki/CodeRed_Orion_RedFlag).

## What runs today

- Manifest V3 automatic legal-link discovery and public-document retrieval on enabled signup, checkout, onboarding, and consent screens.
- Popup with optional manual source preview.
- Local priorities for privacy, renewal, cancellation, arbitration and content rights.
- Automatically mounted multi-document warnings and explicit, revocable background-AI consent settings.
- Explicitly fictional example demonstrating evidence and prioritization.
- Original server-only Gemini adapter with structured output and exact-quote validation, tested with simulated responses.
- Type checking, focused unit tests, build tooling, and GitHub Actions.

After scoped site/document permission grants, the extension retrieves public legal documents automatically. AI remains off until explicit opt-in; configured analysis requests go to the server, never directly to Gemini. The server backend is awaiting integration and the community catalog is empty by default. HTML extraction is conservatively partial and remains Unrated; exact findings can still be shown. The extension never changes site consent controls or waits on AI before allowing navigation. The Gemini adapter is excluded from the browser bundle.

## Run locally

Use Node.js 24 LTS and npm:

```sh
npm ci
npm run check
```

1. Open `chrome://extensions` in Chrome.
2. Enable Developer mode and choose **Load unpacked**.
3. Select `dist/extension` from this checkout.
4. Open a supported signup/checkout/onboarding/consent page and open the extension popup once to grant scoped site access.
5. Reload the site. Legal links are discovered and warnings appear automatically; grant document-origin access in settings if needed.
6. Background AI requires explicit opt-in and backend configuration; see the integration instructions. Manual preview and the fictional example remain available separately.

Selected text takes precedence. Otherwise the prototype reads the first `main` or `article`, falling back to the page body. This is a basic extraction experiment: compare the preview with the policy, especially for collapsed sections or tables. Documents above 60,000 characters are rejected, never silently analyzed as complete. Text lives only in the open popup; closing it discards the text. Priorities, review enablement and background-AI consent are saved in local extension storage. AI consent defaults off. The popup itself never transmits the manual preview.

Run the isolated Chromium browser checks with `npx playwright install chromium` followed by `npm run test:browser`. Run `npm run test:ui` for synthetic multi-document warning fixtures (not live AI or discovery). Run `npm run test:discovery-browser` for actual MV3 discovery, background, and UI integration with controlled retrieval/AI responses. Browser checks use a temporary browser profile and do not modify your everyday Chrome profile.

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
