---
description: "/lt-dev:review on a small diff whose only defect sits in an untouched caller (blast radius), with decoys below the reporting bar"
tags: [agent]
max_turns: 80
timeout_seconds: 1800
allowed_tools: [Read, Glob, Grep, Skill, Agent]
---

/lt-dev:review --base=main

Der ausgecheckte Branch fix/invoice-cents enthält einen Commit gegen main. Commit-Nachricht mit den Anforderungen, Statistik und Diff stehen in REVIEW.diff. In dieser Umgebung gibt es keine Shell: git, das check-Skript, die Plugin-Skripte und der Browser sind nicht aufrufbar, und es gibt kein Ticket. Lies REVIEW.diff und die Dateien im Projekt. Die Reviewer-Agents starte wie im Command vorgesehen: Sie können Dateien lesen und durchsuchen, nur keine Shell nutzen. Phase 6 (Fix) und Phase 7 (Browser) entfallen hier, ändere keinen Code. Deine letzte Nachricht ist der vollständige Bericht aus Phase 5.
