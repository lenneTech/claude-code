---
description: "Model written to lenne.tech conventions: UnifiedField, Restricted/Roles, securityCheck, PersistenceModel base"
tags: [quality]
max_turns: 25
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit]
---

In a @lenne.tech/nest-server backend, write the model for a Product entity to src/server/modules/product/product.model.ts. Fields: name (string, required), price (number), active (boolean). Every logged-in user may read name and active; only admins may read or change price. Write only that one file.
