# RedFlag 0.3.3

The popup is 480 pixels wide. Merriweather remains on headings and grade badges; interface copy and controls use the device's sans-serif font. No font download or sign-in is required. The current-site review is the default view; the saved-sites block is removed from the popup. Saved sites remain available on their separate page.

First use offers two steps: optional interests, then public-policy consent. Seven focus choices and up to five custom text interests are stored locally. Matching supported findings appear first in Red flags and Summary; grades remain governed by the same rubric. Custom interests reorder matching evidence rather than generating new claims or changing grades. Users can edit their interests through Review preferences.

Summary leads with a short overview of up to three key findings, optional protective clauses, review-coverage context and collapsed policy notes. It does not fabricate numerical scores or hide missing evidence. Exact supporting quotations remain available on each finding.

Device vault is a separate local page linked from popup Settings. Users can download preferences, interests and saved reviews as JSON; remove one site or all saved reviews; or explicitly confirm a complete device reset. Exports whitelist supported user records and exclude backend credentials, provider keys, cache and transient jobs. Reset aborts ongoing checks, removes reviews/cache/connection/interests/session data, clears toolbar state and leaves only default paused preferences to prevent background jobs from immediately collecting new data. Reopening the popup returns to onboarding. Website records and backend environment secrets are outside the browser reset's scope.

Verification on October 11, 2026:

- Typecheck, 74 unit tests and build passed.
- Popup checks passed for the 480px layout, Summary, red flags, cited chat, unknown grades, no horizontal overflow and first-use consent.
- Browser onboarding, preferences persistence/storage failure, and branding suites passed.
- Device vault browser suite passed: built-in and custom-interest persistence, no implicit AI consent, JSON download without connection credentials, individual/all review deletion, cancelled reset, full reset and onboarding restart.
- Real MV3/HTTP integration passed automatic pairing, three-policy analysis, Summary, words, refreshing and cited chat. Content-script chat and device-reset messages were rejected. Google responses in this suite were simulated.
- The exact delivered extracted folder was loaded in a fresh Chromium profile and connected to the actual running backend with authenticated health. No new live Gemini requests were required for these interface/data changes.

The versioned extension ZIP contains manifest.json at its root and remains loadable through Chrome's Load unpacked action. Gemini requires the running backend. Screenshots use presentation fixtures and do not represent real service ratings.
