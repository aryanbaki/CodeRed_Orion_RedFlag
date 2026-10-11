# RedFlag 0.3.5 verification

The popup returns to a compact 400px layout. The separate Settings and Add a public policy link blocks no longer occupy the main popup. The current site review remains the focus.

Red flags, Summary and Chat are hidden while a page is only being discovered and has no grade. They appear when the user starts an analysis, while analysis is running, or when a saved/current state already contains a rated grade or supported assessment. This keeps the initial discovery screen focused on finding policies. A grade already present remains enough to show the completed review tabs.

The existing discovery worker still scans legal links and common public paths automatically. Gemini is called only after the user's Enable checks consent and a discovered policy is queued. The compact browsing reminder remains dismissible and does not submit forms or change page controls.

Verified with typecheck, build, automatic MV3/HTTP integration, policy discovery, and the existing unit suite. The package remains loadable through Chrome's Load unpacked flow. The running backend is still required for Gemini analysis.
