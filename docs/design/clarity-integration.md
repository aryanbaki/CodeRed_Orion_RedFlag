# RedFlag current implementation

Updated 2026-10-11. The popup uses an overall S–E grade (? when unsupported), with Privacy, Terms and Cookies inside a dropdown. First-use onboarding supplies consent; settings contain only controls. Automatic discovery checks page links and common public policy addresses. My sites contains overall grades, ranked by visits. ToS;DR supplies attributed service-level ratings, never invented individual policy grades.

Gemini receives the entire extracted public legal document as untrusted data. Word counts appear beside policy grades, including an explicit Partial label for incomplete extraction. Direct text surrounding nested lists and tables is retained. Downloads are bounded at 2 MB and extracted text at 250,000 characters; oversized inputs are rejected rather than truncated. Raw policy text is transient, never saved in popup/frontend storage; background history stores review metadata and quoted findings.

The current build is in dist/extension and Downloads/RedFlag Chrome Extension; RedFlag-Chrome-Extension.zip is refreshed. Reload the unpacked extension and existing website tabs to use it. API keys remain in ignored server configuration.

The existing Figma board is https://www.figma.com/design/wtbk7uFPxgfCiw69ROZAE4 . Its earlier 33 captures show the previous implementation. Uploading current editable screens is pending editor access for aryanbaki2@gmail.com; do not treat the old captures as the current UI.

Redesign update: slate surfaces, a subtle grid texture, lavender controls, and separate heading/body/metadata colors replace the warm charcoal/yellow design. S–E swatches are independent provisional tokens in src/ui/theme.ts pending the user’s palette. Each discovered policy has an Analyze/Reanalyze action (mode one, exact document ID); Analyze all rechecks the site. Pending actions are disabled and missing consent opens onboarding. The Chromium popup suite verifies Privacy, Terms and Cookie command dispatch separately. Figma upload remains unconfirmed: the connector requires reauthentication and the native file picker did not accept input. The ordered screenshot import is available in Downloads/RedFlag-Updated-Flow.svg.
