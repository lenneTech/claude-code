---
description: "Bug fix at the root cause: the report names transfers only, while the unchecked shared debit helper also serves redeem (trace-transfer pattern)"
tags: [agent]
max_turns: 60
timeout_seconds: 1200
allowed_tools: [Read, Glob, Grep, Skill, Agent, Write, Edit]
---

Bug aus dem Support: Bei Überweisungen zwischen Guthabenkonten kann der Kontostand negativ werden. Beispiel: Konto A hat 50 Credits und überweist 80 an Konto B. Danach steht A auf -30, und B hat 80 Credits mehr. Erwartet: Die Überweisung wird abgelehnt, und beide Kontostände bleiben unverändert.

Behebe den Fehler in diesem @lenne.tech/nest-server-Backend. Lass das den lt-dev backend-dev Agent erledigen. In dieser Umgebung gibt es keine Shell, Tests lassen sich also nicht ausführen; schreib sie trotzdem.
