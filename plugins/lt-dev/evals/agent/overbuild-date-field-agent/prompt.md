---
description: "Over-build trap: a due date with a date picker in an existing task form, where the project already has a date field component and date utils"
tags: [agent]
max_turns: 60
timeout_seconds: 1200
allowed_tools: [Read, Glob, Grep, Skill, Agent, Write, Edit]
---

In der Aufgabenverwaltung dieser Nuxt-App fehlt ein Fälligkeitsdatum. Beim Anlegen und Bearbeiten einer Aufgabe soll man es über eine Datumsauswahl setzen können; es ist optional und darf nicht in der Vergangenheit liegen. Die Aufgabenliste zeigt es an. Die API kennt das Feld dueDate bereits (app/api-client/types.gen.ts). Lass das den lt-dev frontend-dev Agent erledigen. In dieser Umgebung gibt es keine Shell und keinen Browser.
