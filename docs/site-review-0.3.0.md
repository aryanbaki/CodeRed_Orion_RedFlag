# RedFlag 0.3.0 — current implementation and verification

Verified October 11, 2026 in macOS / isolated Playwright Chromium. This file supersedes historical UI and integration status in earlier handoff documents.

## Included

- Always-visible overall review, Analyze all, and three Privacy / Cookie / Terms policy cards with individual Analyze actions and retrieved word counts.
- Automatic public policy discovery and consented background analysis. Loading states, inaccessible sources, missing policies, and incomplete evidence remain explicit.
- Red flags with exact quoted sources, concise per-policy summaries, supported protections, and Gemini policy chat with independently checked citations.
- User-supplied flag artwork, per-rank toolbar flags, Manline Slabs typography, and distinct primary, secondary, and accent text colors.
- One-time checked backend connection import and consent in onboarding. Provider keys remain server-only. Full policy text and conversation history are transient; bounded source excerpts and review metadata may be kept in My sites.
- Stable extension ID elafbjngcoafcjpkpdcldohljokaalin, manifest version 0.3.0, prompt redflag.prompt.v2, rubric redflag.rubric.v3.

## Verification

`npm run check`: strict TypeScript, all 69 unit tests, and build pass. The final quotation validation check also rejects a protective claim that contradicts a verified risk in the same category.

Actual unpacked-extension browser checks pass:

- `node tests/actions-browser.mjs`: independent / all actions, deduplication, cache refresh, timeout, mixed failures, consent revocation, stale navigation, and tab-specific toolbar flags.
- `node --experimental-strip-types tests/backend-browser.ts`: real MV3 extension to authenticated local HTTP transport, with simulated provider output.
- `npm run test:popup-redesign`: connection import, all visible cards, actions, words, Summary / Red flags / Chat, exact sources, error retry, keyboard navigation, stale chat reset, and no horizontal overflow at 400 px.
- `node --experimental-strip-types tests/site-review-integration.ts`: actual integrated worker and HTTP backend with a simulated Google response; automatic three-policy analysis, checked onboarding, chat, no full policy/chat/provider-key persistence, untrusted sender rejection, and stale delayed chat rejection.

Separate live check: `node --experimental-strip-types tests/site-review-live.ts` used a controlled discovery page linking actual public GitHub policies, the running local backend, actual saved Gemini credentials, and a temporary Chromium profile. At 2026-10-11T13:07:57Z, Privacy had 6,434 retrieved words / two validated findings; Terms had 7,907 words / three validated findings. Both stayed Unrated due to missing category evidence. Actual model: gemini-3.1-flash-lite. Chat answered with four source citations. The cookie workflow is verified by integrated fixtures; this live site had no separate cookie policy. These checks do not configure everyday Chrome or establish interpretation accuracy on every site.

## Delivery

`RedFlag-Extension-0.3.0.zip` contains loadable extension files at ZIP root. Unzip to a permanent folder, enable Developer mode in chrome://extensions, and Load unpacked that folder. Disable older RedFlag copies. Import the separately generated local RedFlag-Local-Connection.json in onboarding and enable Gemini checks. Keep the local backend running.

`RedFlag-Screenshots-0.3.0.zip` contains ordered sample-state PNGs and a layout SVG, clearly marked as sample data, plus separately labeled live verification screenshots/report. Figma publication is deferred at the user's request.

`RedFlag-Source-Backend-0.3.0.zip` contains implementation, tests, scripts, documentation, blank .env.example, and a built extension. It excludes live credentials, backend connection tokens, node_modules, Git metadata, and browser profiles. To run on another computer, install Node 22.6+, run npm ci, create a private .env from the blank example, supply local server credentials, and run npm run start:server.
