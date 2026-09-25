---
description: "Multi-step agent work: the frontend-dev agent builds a list page and a create modal against generated API types (effort comparison)"
tags: [agent]
max_turns: 60
timeout_seconds: 1200
allowed_tools: [Read, Glob, Grep, Skill, Agent, Write, Edit]
---

Baue in dieser Nuxt-App eine Produktverwaltung. Die Seite listet alle Produkte mit Name, Preis und Status (aktiv/inaktiv) über die generierte API und behandelt Laden, leere Liste und Fehler. Ein Button öffnet ein Modal mit einem Formular zum Anlegen: Name ist Pflicht, Preis darf nicht negativ sein, aktiv ist ein Schalter. Nach dem Anlegen schließt sich das Modal und die Liste zeigt das neue Produkt. Lass das den lt-dev frontend-dev Agent erledigen.

Lege genau diese Dateien an:
- app/pages/app/products/index.vue
- app/components/Product/ProductCreateModal.vue
