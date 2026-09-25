---
type: llm
focus: { source: file, path: src/server/modules/product/product.model.ts }
weight: 2
---

How @lenne.tech/nest-server permissions work (judge by these rules, not by general intuition): a class-level `@Restricted(RoleEnum.ADMIN)` or `@Roles(RoleEnum.ADMIN)` is the secure fallback, and a more specific decision overrides it — field-level `roles:` in `@UnifiedField(...)` or a field-level `@Restricted(...)` on a model or input, a method-level `@Roles(...)` on a controller ("specific overrides general"). A class-level ADMIN restriction plus `roles: RoleEnum.S_USER` on a field therefore means logged-in users can read that field. `securityCheck(user, force)` runs on every returned object and may remove fields the user must not see.

This is a @lenne.tech/nest-server model. The requirement: logged-in users may read products; only admins may see or change the price.

PASS only if all of these hold:
- `price` is restricted to admins at field level (for example `@Restricted(RoleEnum.ADMIN)` on the field, or an equivalent check in `securityCheck()` that removes `price` for non-admins).
- Logged-in users keep read access to the product itself (the model or its read path is not restricted to admins only).
- `securityCheck(user, force)` returns the object for users who may see it and does not return `undefined` for every non-admin (which would hide products from the logged-in users who must read them).
- `name` is a required string, `price` a number, `active` a boolean.

FAIL if a non-admin could read `price`, if ordinary logged-in users could not read products at all, or if a field is missing or has the wrong type.
