---
description: "Multi-step agent work: the backend-dev agent builds a complete module to lt conventions (effort comparison)"
tags: [agent]
max_turns: 60
timeout_seconds: 1200
allowed_tools: [Read, Glob, Grep, Skill, Agent, Write, Edit]
---

Leg in diesem @lenne.tech/nest-server-Backend ein vollständiges Modul Product an. Felder: name (string, Pflicht), price (number), active (boolean). Angemeldete Nutzer dürfen Produkte lesen; den Preis sehen und ändern nur Admins. Lass das den lt-dev backend-dev Agent erledigen.

Lege genau diese Dateien an:
- src/server/modules/product/product.model.ts
- src/server/modules/product/product.service.ts
- src/server/modules/product/product.controller.ts
- src/server/modules/product/inputs/product.input.ts
- src/server/modules/product/inputs/product-create.input.ts
