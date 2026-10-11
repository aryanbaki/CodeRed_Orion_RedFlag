# RedFlag clarity and discovery verification

Integrated locally on main on 2026-10-11. Popup uses compact A–F tiles and a small question mark for Unrated, omits invented missing-policy rows, collapses detailed evidence and exposes working rechecks independent of AI consent. The dashboard retains separate Terms/Privacy grades, dates, attribution and local history.

Ordinary footer policies and dynamic consent screens are discovered automatically on granted websites; popup opening supplies a current-tab scan. Optional all-sites access is disclosed and reversible. Cross-origin document reading still requires access. AI remains off until opt-in and matching server setup; the key stays server-only. Rubric v2 includes E and retains exact-quote/coverage validation. No live community dataset is bundled.

Verification: typecheck/build and49 unit tests; actual unpacked-extension popup-current-tab, popup redesign, dashboard, actions, discovery, site discovery and backend transport suites passed. Public retrieval/provider results are fixtures in browser suites. Site discovery exercises actual Chrome activeTab and injection, but optional permission approval/events are fixtures: native permission approval remains a manual check. Separate live GitHub discovery found actual Terms/Privacy footer URLs with AI off; no live grades are asserted here.

33 implemented screen/state captures are grouped beside the existing Kairos board on its original page: https://www.figma.com/design/wtbk7uFPxgfCiw69ROZAE4?node-id=21-11 . They are screenshot images, with synthetic example ratings labeled, rather than editable design components. Monoglyphic is not installed; the UI uses a temporary system monospace.

Updated Downloads/RedFlag Chrome Extension and RedFlag-Chrome-Extension.zip contain version0.2.0. Reload the installed extension at chrome://extensions and reload existing tabs after replacing the build. The developer bundle includes matching server source and rubric-v2 setup instructions, never credentials.
