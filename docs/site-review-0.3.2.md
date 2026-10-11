# RedFlag 0.3.2 verification

This release packages Merriweather Regular, Bold, Black and Italic with the supplied OFL license. Unknown grades remain neutral question marks. Policy cards and Analyze all remain visible.

The overall subtitle estimates reading time saved from extracted word counts for current, successful Gemini assessments. Insufficient evidence can prevent a grade without invalidating a completed reading. Provider failures, unread text, pending work, invalid counts and expired results do not count. Rechecking does not accumulate minutes, and a document URL counts once. Estimates use 238 words/minute, the adult English non-fiction mean reported in [Brysbaert's 2019 meta-analysis](https://biblio.ugent.be/publication/8647789); they are estimated reading time, not measured time savings.

Summary now separates At a glance, Watch out for and In your favor. Model identifiers are removed from summary cards, while exact evidence remains expandable. Stale or failed assessments cannot supply summaries or evidence.

The popup pairs automatically with the running local backend on 127.0.0.1:8787. First-use Enable checks remains a single consent action. Technical connection-file import is only in Advanced connection. Generic server instances disable pairing by default. Local pairing requires the exact stable extension Origin and loopback socket, with bounded JSON and deadline. Authenticated health is checked before saving metadata. Google keys remain on the backend.

Verified on October 11, 2026:

- Typecheck, 72 unit tests and extension build passed.
- Popup browser suite passed, including estimated minutes, sources absent from policy cards, summary, citations, error recovery, unknown Figma badges, font loading and no horizontal overflow.
- Restricted-page onboarding, persistence, storage failure and branding browser suites passed.
- Real MV3 extension/HTTP integration passed: automatic pairing, one-action consent, three-document analysis, words, Summary, red flags, refreshing, cited chat, stale and untrusted chat rejection, no raw policy/chat/provider-key persistence. Google responses in this integration suite were simulated.
- The delivered ZIP was extracted and that exact folder loaded into a fresh Chromium profile. With the actual configured local backend running, automatic pairing, authenticated health, Merriweather loading and version 0.3.2 passed. This delivery check made no new Gemini analysis calls; previous live provider evidence remains in 0.3.1 verification.

Deliverables: RedFlag-Extension-0.3.2.zip and its extracted loadable folder in Downloads. The extension archive excludes backend source, connection files and provider credentials. The local backend must remain running for Gemini analysis and chat; this is not yet a hosted service for other users.
