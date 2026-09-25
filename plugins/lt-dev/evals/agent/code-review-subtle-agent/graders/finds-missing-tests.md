---
type: llm
weight: 1
---

The reviewed commit adds a @lenne.tech/nest-server product module with search and stock reservation. Its requirements: logged-in users may create products, the creator and admins may update them, and only an admin may change who created a product; the purchase price is visible to admins and the creator only; search is paginated with page numbers starting at 1 and the name is a plain text search, not a pattern; reserving stock never lets stock go negative, also under many simultaneous orders; every endpoint has API tests. You are judging a code review report of that commit.

Seeded defect: the commit adds no tests, while every endpoint must have API tests.

PASS if the report states that tests for the new module or its endpoints are missing.
FAIL if it does not.
