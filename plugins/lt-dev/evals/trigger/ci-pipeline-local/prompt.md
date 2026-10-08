---
description: "A failing CI job to reproduce locally triggers validating-ci-pipelines-locally"
tags: [trigger]
max_turns: 4
timeout_seconds: 180
allowed_tools: [Read, Glob, Grep, Skill]
---

Unsere GitLab-Pipeline scheitert bei api:test, auf meinem Rechner sind die Tests grün. Lass den Job bitte lokal so laufen wie auf dem Runner, damit wir den Fehler vor dem nächsten Push sehen.
