# RedFlag 0.3.4 verification

Summary now starts with a short paragraph built from validated policy explanations. Confirmed benefits appear above the policy grade profile, with concerns below. Expandable quotes and individual policy notes preserve the supporting evidence. Grade bars show ordinal S–E policy results, not invented numerical scores or legal-compliance ratings. Unknown grades show an empty bar with ?.

The overall card retains the estimated reading minutes saved for successfully reviewed words. It adds the current analysis date as Reviewed and, separately, the publisher's Policy updated date when available from retrieved metadata. Missing publisher dates are not inferred from analysis or retrieval time; invalid/future dates and stale assessments are excluded.

An ordinary site without found policies offers Look again and a public-link form. Look again clears the common-address discovery cache and retries verified headings. Supplied URLs must be public HTTP(S), query-free, credential-free, within browser permissions and submitted from trusted extension UI for the current page generation. Users select Privacy, Terms, Cookies or Other page. Other-page analysis does not manufacture one of the three policy grades. Manual documents survive later DOM discovery passes in the same generation. Retrieval continues to omit browser cookies.

Granted pages are scanned automatically without Gemini. Existing DOM observers track legal links and context changes, including after navigation or dynamically appearing signup/consent UI. Common paths are accepted only after a legal heading is verified. After first-use Gemini consent and backend connection, discovered documents are processed automatically. Without consent, supported community information and public discovery remain available; no new policy text is sent to Gemini.

Ordinary browsing with observed legal links shows a compact dismissible reminder. Signup and consent contexts show the agreement review before the user agrees. Neither reminder changes form values, checks consent boxes, moves focus nor submits anything. Dismissal lasts for the page generation. Opening from the reminder uses the native action popup so the website stays active for policy/chat routing; minimum Chrome version is now 127 per the [official action API documentation](https://developer.chrome.com/docs/extensions/reference/api/action#method-openPopup).

Verified October 11, 2026:

- Typecheck, 76 unit tests and build passed, including distinct publisher/review-date behavior.
- Popup browser checks passed for prose Summary, positive-before-negative layout, S–E bars, dates, words, red flags and cited chat.
- Real MV3/HTTP integration passed three-policy automatic analysis, manual-link addition on a no-policy page, unsafe URL and untrusted manual-command rejection, Summary, recheck and cited chat. Google responses were simulated.
- Discovery/browser suites passed ordinary-page compact reminders, dynamic consent context, SPA/navigation discovery, optional site grants/revocation, no unintended form events, no transmission without consent, and worker recovery.
- Device vault regression passed exports without credentials, individual/all review deletion and full device reset.
- The delivered ZIP was extracted and that exact folder loaded into fresh Chromium, connected automatically to the actual running backend and authenticated health. Interface changes required no new live Gemini requests.

The versioned ZIP has manifest.json at its root and excludes provider keys and private connection files. The running backend remains required for Gemini. Screenshots use fixture content and do not establish real service grades.
