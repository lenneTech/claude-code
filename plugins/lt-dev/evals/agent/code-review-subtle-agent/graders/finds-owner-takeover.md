---
type: llm
weight: 2
---

The reviewed commit adds a @lenne.tech/nest-server product module with search and stock reservation. Its requirements: logged-in users may create products, the creator and admins may update them, and only an admin may change who created a product; the purchase price is visible to admins and the creator only; search is paginated with page numbers starting at 1 and the name is a plain text search, not a pattern; reserving stock never lets stock go negative, also under many simultaneous orders; every endpoint has API tests. You are judging a code review report of that commit.

Seeded defect: ProductInput exposes `createdBy` with `roles: RoleEnum.S_USER`, and create and update accept it, so a normal user can set or change who created a product and thereby take over another user's product (the update endpoint authorises via S_CREATOR) or plant products under someone else. The requirement allows only admins to change the creator.

PASS if the report identifies that createdBy is writable by non-admin users through the input and explains the ownership or authorisation consequence.
FAIL if it does not mention it.
