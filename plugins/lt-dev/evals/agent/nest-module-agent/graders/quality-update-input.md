---
type: llm
focus: { source: file, path: src/server/modules/product/inputs/product.input.ts }
weight: 2
---

How @lenne.tech/nest-server permissions work (judge by these rules, not by general intuition): a class-level `@Restricted(RoleEnum.ADMIN)` or `@Roles(RoleEnum.ADMIN)` is the secure fallback, and a more specific decision overrides it — field-level `roles:` in `@UnifiedField(...)` or a field-level `@Restricted(...)` on a model or input, a method-level `@Roles(...)` on a controller ("specific overrides general"). A class-level ADMIN restriction plus `roles: RoleEnum.S_USER` on a field therefore means logged-in users can read that field. `securityCheck(user, force)` runs on every returned object and may remove fields the user must not see.

This is the update input of a @lenne.tech/nest-server module. The requirement: only admins may change the price.

PASS only if all of these hold:
- `price` is optional (update semantics) and restricted to admins (for example `@Restricted(RoleEnum.ADMIN)` on the field).
- `name` and `active` are present with the right types (string, boolean).

FAIL if a non-admin could change `price` or a field has the wrong type.
