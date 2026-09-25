---
type: llm
focus: { source: file, path: src/server/modules/product/product.controller.ts }
weight: 2
---

How @lenne.tech/nest-server permissions work (judge by these rules, not by general intuition): a class-level `@Restricted(RoleEnum.ADMIN)` or `@Roles(RoleEnum.ADMIN)` is the secure fallback, and a more specific decision overrides it — field-level `roles:` in `@UnifiedField(...)` or a field-level `@Restricted(...)` on a model or input, a method-level `@Roles(...)` on a controller ("specific overrides general"). A class-level ADMIN restriction plus `roles: RoleEnum.S_USER` on a field therefore means logged-in users can read that field. `securityCheck(user, force)` runs on every returned object and may remove fields the user must not see.

This is a @lenne.tech/nest-server REST controller for products. The requirement: logged-in users may read products.

PASS only if all of these hold:
- Every endpoint carries a `@Roles(...)` decision (on the method or inherited from the class).
- Read endpoints (list / get) admit logged-in users (for example `RoleEnum.S_USER`).
- No endpoint is open to everyone (no `RoleEnum.S_EVERYONE` and no endpoint without a role decision), and write endpoints are not open to anonymous users.

FAIL if any endpoint is public, lacks a role decision, or if logged-in users cannot read products.
