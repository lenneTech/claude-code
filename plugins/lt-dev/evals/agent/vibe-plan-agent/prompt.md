---
description: "Planning depth: /lt-dev:vibe:plan turns an unambiguous SPEC.md into IMPLEMENTATION_PLAN.md (effort comparison)"
tags: [agent]
max_turns: 60
timeout_seconds: 1500
allowed_tools: [Read, Glob, Grep, Skill, Agent, Write, Edit]
---

/lt-dev:vibe:plan SPEC.md

Die SPEC.md legt alle Entscheidungen fest; es gibt nichts nachzufragen. Schreib den Plan.
