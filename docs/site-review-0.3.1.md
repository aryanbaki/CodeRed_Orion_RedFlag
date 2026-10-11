# RedFlag 0.3.1

October 11, 2026. This release replaces the application font with the user-supplied Avion Demo Bold OTF, including popup, My sites dashboard, and the injected review panel. Font bytes remain packaged locally; the supplier readme is preserved.

Unknown / Unrated grades now use a neutral question-mark tile in the overall review, policy cards, My sites list, and injected panel. Real S–E grades retain the glossy grade palette. The toolbar and header retain the RedFlag brand artwork.

Policy card Source dropdowns and their backend/consent explanations are removed. The Summary tab no longer repeats missing-policy and failure paragraphs already represented on the cards. Policy labels, word counts, individual Analyze actions, Analyze all, red flag evidence, and cited chat remain available. The grading rubric and Gemini behavior are unchanged.

Validation: npm run check passes all 69 unit tests, type checking, and build. Actual Chromium popup checks verify all four unknown badges, a saved www.figma.com unknown review, no policy Source dropdowns, no duplicate Summary explanations, Avion font loading, supported grades, analysis controls, cited chat, keyboard access, and no horizontal overflow at 400 px. The branding browser check verifies the loaded font and rated / unknown panel transitions. Integrated three-policy analysis / cited chat and the dashboard browser suite also pass with simulated provider responses. The delivery ZIP was extracted and loaded in a temporary Chromium profile; its stable ID, backend connection, Avion face and unknown badges were verified. See the preceding 0.3.0 record for live Gemini evidence; this visual update does not require another provider call.

Delivery: RedFlag-Extension-0.3.1.zip, with manifest.json at ZIP root, and the already extracted RedFlag-Extension-0.3.1 folder in Downloads. The private local connection JSON is retained separately because Gemini requires it. Older RedFlag delivery files from today are moved to Trash; unrelated downloads and user-supplied font archives are kept.
