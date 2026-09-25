---
type: llm
focus: { source: file, path: src/server/modules/product/inputs/product-create.input.ts }
weight: 2
---

How @lenne.tech/nest-server permissions work (judge by these rules, not by general intuition): a class-level `@Restricted(RoleEnum.ADMIN)` or `@Roles(RoleEnum.ADMIN)` is the secure fallback, and a more specific decision overrides it — field-level `roles:` in `@UnifiedField(...)` or a field-level `@Restricted(...)` on a model or input, a method-level `@Roles(...)` on a controller ("specific overrides general"). A class-level ADMIN restriction plus `roles: RoleEnum.S_USER` on a field therefore means logged-in users can read that field. `securityCheck(user, force)` runs on every returned object and may remove fields the user must not see.

This is the create input of a @lenne.tech/nest-server module. It usually extends the update input `ProductInput`, which is a separate file you cannot see. The requirement: name is required; only admins may set the price.

PASS only if all of these hold:
- `name` is declared here as a required (not optional) string.
- `price`: either this file restricts it to admins (for example `@Restricted(RoleEnum.ADMIN)` on the field), or the class extends `ProductInput` and does not redeclare `price` without such a restriction. A redeclared, unrestricted `price` fails.
- Any field declared here has the right type: `price` number, `active` boolean.

FAIL if `name` is optional or missing, or if this file declares `price` without an admin restriction.
