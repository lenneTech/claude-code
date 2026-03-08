---
description: Create a bug report ticket for Linear
argument-hint: [bug-description]
allowed-tools: AskUserQuestion, Write, Read, Glob, mcp__plugin_lt-dev_linear__*, Skill
disable-model-invocation: true
---

# Bug-Report erstellen

Guide the user through creating a well-structured bug report for Linear. Collects reproduction steps, expected vs. actual behavior, environment details, and severity to enable efficient debugging.

## When to Use This Command

- Reporting a bug or defect
- Something that worked before is now broken
- Unexpected behavior in the application
- Error messages or crashes

## Related Commands

| Command | Purpose |
|---------|---------|
| `/lt-dev:create-ticket` | Smart router for all ticket types |
| `/lt-dev:create-story` | Create a user story (feature with user value) |
| `/lt-dev:create-task` | Create a technical task |
| `/lt-dev:resolve-ticket` | Resolve ticket end-to-end with TDD |
| `/lt-dev:debug` | Adversarial debugging with Agent Teams |

**Workflow:** Create bug report → `/lt-dev:resolve-ticket` to fix

**IMPORTANT: All user-facing communication must ALWAYS be in German. Exceptions: Properties (camelCase), code snippets, and technical terms remain in English.**

**ABORT HANDLING: If the user wants to cancel at any point (e.g., "abbrechen", "stop", "cancel"), acknowledge it (in German): "Okay, Bug-Report abgebrochen." and stop the process.**

---

## Step 1: Collect Initial Description

**Check for argument:** If the user provided a description as argument (e.g., `/lt-dev:create-bug "Login zeigt 500 nach Passwort-Reset"`), use that as starting point and skip directly to Step 2.

**If no argument provided:** Output the following prompt in German and wait for user response:

> Bitte beschreibe den Bug so detailliert wie möglich:
> - Was ist passiert? (tatsächliches Verhalten)
> - Was hättest du erwartet? (erwartetes Verhalten)
> - Wie kann man den Bug reproduzieren? (Schritte)
> - Gibt es eine Fehlermeldung?
> - In welcher Umgebung tritt der Bug auf? (Browser, OS, Environment)
>
> Schreib einfach deine Beobachtung auf - ich helfe dir, einen strukturierten Bug-Report zu erstellen.

**Wait for the user's response before proceeding to Step 2.**

---

## Step 2: Analyze and Identify Gaps

After receiving the user's input, analyze it against this checklist:

### Required Elements Checklist

**Bug Identification:**
- [ ] **Title** — Short, descriptive summary (max 10 words)
- [ ] **Actual Behavior** — What actually happens?
- [ ] **Expected Behavior** — What should happen instead?

**Reproduction:**
- [ ] **Steps to Reproduce** — Numbered steps to trigger the bug
- [ ] **Reproducibility** — Always, sometimes, once?
- [ ] **Preconditions** — Required setup or state (logged in, specific data, etc.)

**Context:**
- [ ] **Environment** — Browser, OS, API version, environment (dev/staging/prod)
- [ ] **Error Messages** — Console errors, API responses, stack traces
- [ ] **Screenshots/Logs** (optional) — Visual evidence

**Severity:**
- [ ] **Impact** — How severely does this affect users?
- [ ] **Workaround** — Is there a temporary workaround?

### Gap Analysis

For each missing or unclear element, formulate a **specific question in German** using the AskUserQuestion tool:

**Fehlendes erwartetes Verhalten:**
- "Was hättest du stattdessen erwartet? Wie sollte es richtig funktionieren?"

**Fehlende Reproduktionsschritte:**
- "Kannst du die genauen Schritte beschreiben, um den Bug zu reproduzieren? (z.B. 1. Seite X öffnen, 2. Button Y klicken, 3. ...)"

**Fehlende Reproduzierbarkeit:**
- "Tritt der Bug immer auf oder nur manchmal? Unter welchen Bedingungen?"

**Fehlende Umgebung:**
- "In welcher Umgebung tritt der Bug auf? (Browser/Version, Betriebssystem, Environment: Dev/Staging/Prod)"

**Fehlende Fehlermeldung:**
- "Gibt es eine Fehlermeldung? (z.B. im Browser-Console, API-Response, oder auf der Seite selbst)"

**Fehlende Schwere:**
- "Wie schwerwiegend ist der Bug? Gibt es einen Workaround?"

### Questioning Strategy

1. **Ask only about missing/unclear elements** — Don't ask for information already provided
2. **Be specific** — Reference what was said and ask for clarification
3. **Group related questions** — Ask 2-4 questions at once, not one by one
4. **Accept refusal gracefully** — If the user doesn't have details, proceed with available information

### Proactive Suggestion Strategy

When the user doesn't provide information for certain areas:

**For missing Environment:**
- If working in a project, infer from context (e.g., Nuxt → Browser, NestJS → API)
- Suggest: "Da es ein Frontend-Bug zu sein scheint, nehme ich an: **Chrome/aktuell, Dev-Environment**. Passt das?"

**For missing Severity:**
- Derive from the bug's impact
- Suggest: "Der Impact scheint **[hoch/mittel/niedrig]** zu sein, da **[Begründung]**. Passt das?"

**For missing Reproducibility:**
- Default assumption if not stated
- Suggest: "Tritt der Bug **immer** auf wenn man die beschriebenen Schritte befolgt?"

**Important:**
- Always present suggestions as proposals, not decisions
- Let the user confirm, modify, or reject each suggestion

---

## Step 3: Assess Severity

Based on the collected information, classify the severity:

| Severity | Criteria |
|----------|----------|
| **Critical** | App crash, data loss, security vulnerability, no workaround |
| **High** | Major feature broken, significant user impact, no easy workaround |
| **Medium** | Feature partially broken, workaround exists, moderate impact |
| **Low** | Minor issue, cosmetic, edge case, easy workaround |

Present the severity assessment (in German): "Basierend auf deiner Beschreibung würde ich den Bug als **[Severity]** einstufen, weil **[Begründung]**. Passt das?"

Let the user confirm or adjust.

---

## Step 4: Generate and Present Bug Report

Generate the complete bug report and **present it to the user first**.

**Display the report in a clearly marked code block** so the user can review and request changes.

After presenting, ask (in German): "Ist der Bug-Report so in Ordnung, oder möchtest du noch etwas anpassen?"

**If changes requested:** Make adjustments and present again.

**If approved:** Proceed to Step 5.

### Bug Report Format (German)

```markdown
# [Bug] [Kurzer, beschreibender Titel]

**Typ:** Bug
**Schwere:** [Critical | High | Medium | Low]

## Beschreibung

[1-2 Sätze, die den Bug zusammenfassen]

## Tatsächliches Verhalten

[Was passiert aktuell — so spezifisch wie möglich]

## Erwartetes Verhalten

[Was stattdessen passieren sollte]

## Reproduktionsschritte

**Voraussetzungen:** [Benötigter Zustand, z.B. "Eingeloggt als Admin"]

1. [Schritt 1]
2. [Schritt 2]
3. [Schritt 3]
4. → Bug tritt auf

**Reproduzierbarkeit:** [Immer | Manchmal (ca. X%) | Einmalig]

## Umgebung

- **Browser:** [z.B. Chrome 120, Firefox 121]
- **Betriebssystem:** [z.B. macOS 14.2, Windows 11]
- **Environment:** [Dev | Staging | Production]
- **API-Version:** [falls bekannt]

## Fehlermeldungen (optional)

```
[Console-Output, Stack Trace, oder API-Response hier einfügen]
```

## Screenshots/Logs (optional)

[Referenz auf Screenshots oder Log-Dateien]

## Workaround (optional)

[Temporäre Lösung, falls vorhanden]
```

---

## Step 5: Ask for Output Format

Once the user approves the bug report, use AskUserQuestion with these options:

**Question:** "Wie möchtest du mit diesem Bug-Report fortfahren?"

| Option | Label | Description |
|--------|-------|-------------|
| 1 | Neues Linear Ticket | Neues Bug-Ticket in Linear erstellen |
| 2 | Bestehendes Ticket erweitern | Bereits angelegtes Linear Ticket aktualisieren |
| 3 | Markdown-Datei | Bug-Report in eine .md-Datei speichern |
| 4 | Direkt fixen | Sofort mit dem Bug-Fix starten |

**After user selects an option:**

- **Option 1 (Neues Linear Ticket):** Proceed to Step 6, Option 1
- **Option 2 (Bestehendes Ticket erweitern):**
  - **MUST ask for Ticket-ID first:** "Bitte gib die Ticket-ID des bestehenden Linear Tickets an (z.B. `DEV-123` oder nur `123`):"
  - Wait for user response with the ID
  - Then proceed to Step 6, Option 2 with the provided ID
- **Option 3 (Markdown-Datei):** Proceed to Step 6, Option 3
- **Option 4 (Direkt fixen):** Proceed to Step 6, Option 4
- **Other (free text input):** Parse the input:
  - **Ticket-ID pattern detected** (e.g., `DEV-123`): Proceed to Step 6, Option 2 with this ID
  - **Number only** (e.g., `123`): Assume project prefix → Proceed to Step 6, Option 2
  - **Anything else** (e.g., "nichts", "nein"): Confirm: "Alles klar! Der Bug-Report wurde oben angezeigt und kann bei Bedarf kopiert werden." — END

---

## Step 6: Execute Selected Output

### Option 1: Linear Ticket erstellen

1. Check if Linear MCP is available. If not: "Linear MCP ist nicht installiert. Du kannst es mit `lt claude install-mcps linear` installieren." → ask for alternative option.

2. **Team selection (default: "Entwicklung"):**
   - Use Linear MCP to list available teams
   - If only one team exists, use it automatically without asking
   - If "Entwicklung" exists, use it as default: "Team: **Entwicklung** — Soll ich ein anderes Team verwenden?"
   - If the user confirms (e.g., "ja", "passt", "ok", or empty input), use the default
   - Otherwise, let the user choose from available teams

3. Ask for project (in German): "Zu welchem Projekt soll das Ticket gehören? (oder 'Keins')"
   - List available projects for the selected team

4. **Status (default: "Open"):**
   - Use "Open" as default status without asking
   - Mention it in the creation summary so the user can request a change if needed

5. Map severity to priority:
   - Critical → Priority 1 (Urgent)
   - High → Priority 2 (High)
   - Medium → Priority 3 (Normal)
   - Low → Priority 4 (Low)
   - Confirm with user: "Ich setze die Priorität auf **[Priority]** basierend auf der Schwere. Passt das?"

6. Ask for labels (in German): "Möchtest du Labels hinzufügen? (z.B. 'bug', 'regression', 'frontend', 'backend')"
   - Suggest "bug" as default label

7. Create ticket via Linear MCP:
   - Title: The bug title (prefixed with "[Bug]" if not already)
   - Description: The full bug report in markdown format (without title heading)
   - Set team, project, status, priority, labels as selected

8. Report the created ticket URL (in German)

9. **Then ask:** "Möchtest du diesen Bug jetzt fixen?"

### Option 2: Bestehendes Linear Ticket erweitern

1. Check if Linear MCP is available (same as Option 1)

2. Fetch existing ticket via Linear MCP (`get_issue`)
   - If not found: "Ticket [ID] wurde nicht gefunden. Bitte überprüfe die ID."

3. Show current ticket state (in German):
   - "Aktuelles Ticket [ID]: **[Titel]**"
   - Ask: "Möchtest du die Beschreibung vollständig ersetzen oder den Bug-Report anhängen?"

4. Update ticket via Linear MCP:
   - Ask about title update: "Soll der Titel auf '[neuer Titel]' aktualisiert werden?"
   - Replace or append description (without title heading)

5. Report: "Ticket [ID] wurde erfolgreich aktualisiert: [URL]"

6. **Then ask:** "Möchtest du diesen Bug jetzt fixen?"

### Option 3: Als Markdown-Datei speichern

1. Ask for file location: "Wo soll der Bug-Report gespeichert werden?"
   - Suggest filename based on title (e.g., `bugs/login-500-nach-passwort-reset.md`)

2. Validate path, create directory if needed

3. Write file and confirm: "Bug-Report gespeichert unter [Pfad]"

4. **Then ask:** "Möchtest du diesen Bug jetzt fixen?"

### Option 4: Direkt fixen (or after Option 1/2/3)

When the user chooses to fix immediately:

1. Confirm: "Starte Bug-Fix..."
2. Invoke `/lt-dev:resolve-ticket` based on whether a Linear ticket exists:
   - **Ticket exists:** Use the Skill tool with `skill: "lt-dev:resolve-ticket", args: "<ticket-id>"`
   - **No ticket:** Use the Skill tool with `skill: "lt-dev:resolve-ticket"` with the bug report as context

---

## Execution Summary

1. **Collect description** — Let user describe the bug
2. **Analyze gaps** — Check against required elements (reproduction steps, environment, etc.)
3. **Ask targeted questions** — Only for missing/unclear elements (in German)
4. **Assess severity** — Classify as Critical/High/Medium/Low
5. **Generate and present report** — Format according to template (in German) and present for review
6. **Ask for output** — Linear, existing ticket, Markdown, or direct fix
7. **Execute and offer fix** — Create output, then offer to start debugging

**Key behaviors:**
- User can abort at any point
- Severity maps to priority when creating Linear tickets
- Default status for bugs is "Triage" (not "Open")
- Suggest "bug" as default label
- Handle errors gracefully with German error messages
