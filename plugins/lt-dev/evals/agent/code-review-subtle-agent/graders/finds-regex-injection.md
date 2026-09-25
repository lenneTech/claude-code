---
type: llm
weight: 2
---

The reviewed commit adds a @lenne.tech/nest-server product module with search and stock reservation. Its requirements: logged-in users may create products, the creator and admins may update them, and only an admin may change who created a product; the purchase price is visible to admins and the creator only; search is paginated with page numbers starting at 1 and the name is a plain text search, not a pattern; reserving stock never lets stock go negative, also under many simultaneous orders; every endpoint has API tests. You are judging a code review report of that commit.

Seeded defect: ProductService.search builds `new RegExp(name, "i")` from the raw query parameter. User input becomes a regular expression: special characters change the query, and a crafted pattern can cause catastrophic backtracking (ReDoS). The requirement says plain text search.

PASS if the report identifies that the unescaped user input is used as a regex (regex injection, ReDoS, missing escaping) and treats it as a real problem.
FAIL if it does not mention it.
