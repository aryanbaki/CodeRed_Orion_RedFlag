# ToS;DR initial data

The bundled snapshot in src/background/community-seed.ts comes from the official https://api.tosdr.org/search/v5 endpoint. It includes 42 services fetched on October 11, 2026, using fixed searches for Google, YouTube, Facebook, Amazon, Reddit, and Wikipedia. Records are retained with their original service IDs, declared domains, names, ratings, review status, and timestamps. The adapter validates and normalizes these records; it does not reproduce upstream extension code.

Attribution: ToS;DR and its contributors, https://tosdr.org.
Data license: Creative Commons Attribution-ShareAlike 3.0 Unported, https://creativecommons.org/licenses/by-sa/3.0/.
Upstream API/license reference: https://tosdr.github.io/tosdr.org/api.html.
API documentation: https://docs.tosdr.org/developer/tos-dr-developers/search.

Refresh with node scripts/refresh-community.mjs. Failed refreshes preserve an existing snapshot. The snapshot and normalized data remain under the upstream data license; the repository's own code license is a separate decision.

Community ratings cover services. ToS;DR A–E labels are preserved and do not manufacture an S grade or individual Privacy/Terms/Cookies assessments. Matching permits only declared domains and their standard www alias, without attributing arbitrary subdomains to a service. A fetched timestamp is not represented as a human review date. Ratings older than seven days since retrieval are not displayed as current overall grades.
