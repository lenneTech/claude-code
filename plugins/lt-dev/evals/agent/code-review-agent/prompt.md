---
description: "Review quality of the code-reviewer agent on a commit with five seeded defects (effort comparison)"
tags: [agent]
max_turns: 60
timeout_seconds: 1500
allowed_tools: [Read, Glob, Grep, Skill, Agent]
---

Prüfe den letzten Commit in diesem Repository gegen seine Anforderungen (sie stehen in der Commit-Nachricht). Der Commit liegt samt Nachricht als REVIEW.diff im Projekt; git ist in dieser Umgebung nicht aufrufbar. Lass das den lt-dev code-reviewer Agent erledigen und gib seinen Bericht mit allen Befunden vollständig wieder, jeweils mit Datei und Schweregrad. Ändere keinen Code.
