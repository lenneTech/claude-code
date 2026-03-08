---
description: Create a technical task ticket for Linear
argument-hint: [task-idea]
allowed-tools: AskUserQuestion, Write, Read, Glob, mcp__plugin_lt-dev_linear__*, Skill
disable-model-invocation: true
---

# Technischen Task erstellen

Guide the user through creating a well-structured technical task ticket for Linear. Tasks are work items without direct user-facing value — infrastructure, migrations, refactoring, performance improvements, etc.

## When to Use This Command

- Technical work without direct user value (migrations, refactoring, infra)
- DevOps and CI/CD tasks
- Performance optimizations
- Configuration changes
- Dependency updates or technical debt reduction

## Related Commands

| Command | Purpose |
|---------|---------|
| `/lt-dev:create-ticket` | Smart router for all ticket types |
| `/lt-dev:create-story` | Create a user story (feature with user value) |
| `/lt-dev:create-bug` | Create a bug report |
| `/lt-dev:resolve-ticket` | Resolve ticket end-to-end with TDD |

**Workflow:** Create task → `/lt-dev:resolve-ticket` to implement

**IMPORTANT: All user-facing communication must ALWAYS be in German. Exceptions: Properties (camelCase), code snippets, and technical terms remain in English.**

**ABORT HANDLING: If the user wants to cancel at any point (e.g., "abbrechen", "stop", "cancel"), acknowledge it (in German): "Okay, Task-Erstellung abgebrochen." and stop the process.**

---

## Step 1: Collect Initial Thoughts

**Check for argument:** If the user provided an initial idea as argument (e.g., `/lt-dev:create-task "DB Migration PostgreSQL 16"`), use that as starting point and skip directly to Step 2.

**If no argument provided:** Output the following prompt in German and wait for user response:

> Bitte beschreibe den technischen Task. Teile so viele Details wie möglich mit:
> - Was genau soll gemacht werden?
> - Warum ist es notwendig? (technischer Grund)
> - Welche Systeme/Module sind betroffen?
> - Gibt es Abhängigkeiten oder Risiken?
> - Geschätzter Aufwand?
>
> Schreib einfach deine Gedanken auf - ich helfe dir, sie in ein strukturiertes Task-Ticket zu bringen.

**Wait for the user's response before proceeding to Step 2.**

---

## Step 2: Analyze and Identify Gaps

After receiving the user's input, analyze it against this checklist:

### Required Elements Checklist

**Basic Task Elements:**
- [ ] **Title** — Short, descriptive title (max 10 words)
- [ ] **Objective** — What needs to be done?
- [ ] **Motivation** — Why is this necessary? (technical debt, performance, security, etc.)

**Technical Details:**
- [ ] **Scope** — Which systems, modules, or files are affected?
- [ ] **Approach** — How should it be done? (high-level strategy)
- [ ] **Dependencies** — Are there blockers or prerequisites?
- [ ] **Risks** — What could go wrong? Rollback strategy?

**Completion Criteria:**
- [ ] **Deliverables** — What specific outputs are expected?
- [ ] **Verification** — How do we know it's done correctly?

### Gap Analysis

For each missing or unclear element, formulate a **specific question in German** using the AskUserQuestion tool:

**Fehlendes Ziel:**
- "Was genau soll mit diesem Task erreicht werden?"

**Fehlende Motivation:**
- "Warum ist dieser Task notwendig? (z.B. technische Schulden, Performance, Sicherheit, Vorbereitung für Feature)"

**Fehlender Scope:**
- "Welche Systeme oder Module sind betroffen? (z.B. Backend, Frontend, Datenbank, CI/CD)"

**Fehlender Ansatz:**
- "Hast du schon eine Vorstellung, wie das umgesetzt werden soll?"

**Fehlende Abhängigkeiten:**
- "Gibt es Abhängigkeiten oder Voraussetzungen, die erfüllt sein müssen?"

**Fehlende Risiken:**
- "Gibt es Risiken bei der Umsetzung? Brauchen wir eine Rollback-Strategie?"

**Fehlende Deliverables:**
- "Was sind die konkreten Ergebnisse? (z.B. migrierte Datenbank, aktualisierte Config, neues CI/CD-Pipeline)"

### Questioning Strategy

1. **Ask only about missing/unclear elements** — Don't ask for information already provided
2. **Be specific** — Reference what was said and ask for clarification
3. **Group related questions** — Ask 2-4 questions at once, not one by one
4. **Accept refusal gracefully** — If the user refuses to answer, proceed with available information

### Proactive Suggestion Strategy

When the user doesn't provide information for certain areas, **suggest reasonable completions**:

**For missing Motivation:**
- Derive from the task's nature (e.g., migration → "technische Weiterentwicklung und Kompatibilität")
- Suggest: "Der technische Grund könnte sein: **[Vorschlag]**. Passt das?"

**For missing Risks:**
- Suggest common risks based on task type
- Suggest: "Mögliche Risiken wären: **[Liste]**. Soll ich das so aufnehmen?"

**For missing Deliverables:**
- Generate standard deliverables based on the task type
- Suggest: "Die Ergebnisse wären: **[Liste]**. Passt das?"

**Important:**
- Always present suggestions as proposals, not decisions
- Let the user confirm, modify, or reject each suggestion
- Integrate confirmed suggestions into the ticket

---

## Step 3: Validate Completeness

Once all information is gathered, perform a final validation:

### Completeness Check
- Is the objective clear and specific?
- Are the deliverables measurable?
- Are risks identified and mitigated?
- Is the scope well-defined (not too broad)?

### Size Check
- Can this be completed in one sprint?
- If too large, suggest splitting (in German): "Dieser Task scheint recht umfangreich. Sollen wir ihn in kleinere Tasks aufteilen?"

### Coherence Check
- Are the deliverables consistent with the objective?
- Are there any contradictions?

**If issues found:** Ask clarifying questions (in German) before proceeding.

**If complete:** Proceed to Step 4.

---

## Step 4: Generate and Present Ticket

Generate the complete task ticket and **present it to the user first**.

**Display the ticket in a clearly marked code block** so the user can review and request changes.

After presenting, ask (in German): "Ist der Task so in Ordnung, oder möchtest du noch etwas anpassen?"

**If changes requested:** Make adjustments and present again.

**If approved:** Proceed to Step 5.

### Task Format (German)

```markdown
# [Kurzer, beschreibender Titel]

**Typ:** Task

## Ziel

[Was soll erreicht werden - 1-2 Sätze]

## Motivation

[Warum ist dieser Task notwendig - technischer Grund]

## Beschreibung

[Ausführliche Beschreibung der Aufgabe]

### Betroffene Systeme
- [System/Modul 1]
- [System/Modul 2]

### Ansatz
[High-Level-Strategie für die Umsetzung]

### Abhängigkeiten (optional)
- [Abhängigkeit 1]
- [Abhängigkeit 2]

### Risiken (optional)
- [Risiko 1] → Mitigation: [Maßnahme]
- [Risiko 2] → Mitigation: [Maßnahme]

## Deliverables

- [ ] [Konkretes Ergebnis 1]
- [ ] [Konkretes Ergebnis 2]
- [ ] [Konkretes Ergebnis 3]

## Verifikation

- [ ] [Wie prüfen wir, dass es korrekt umgesetzt wurde?]
- [ ] [Test/Check 2]
```

---

## Step 5: Ask for Output Format

Once the user approves the ticket, use AskUserQuestion with these options:

**Question:** "Wie möchtest du mit diesem Task fortfahren?"

| Option | Label | Description |
|--------|-------|-------------|
| 1 | Neues Linear Ticket | Neues Ticket in Linear erstellen |
| 2 | Bestehendes Ticket erweitern | Bereits angelegtes Linear Ticket aktualisieren |
| 3 | Markdown-Datei | Task in eine .md-Datei im Projekt speichern |
| 4 | Direkt umsetzen | Sofort mit der Implementierung starten |

**Note:** The "Other" option allows shortcuts — e.g., entering a Ticket-ID directly.

**After user selects an option:**

- **Option 1 (Neues Linear Ticket):** Proceed to Step 6, Option 1
- **Option 2 (Bestehendes Ticket erweitern):**
  - **MUST ask for Ticket-ID first:** "Bitte gib die Ticket-ID des bestehenden Linear Tickets an (z.B. `DEV-123` oder nur `123`):"
  - Wait for user response with the ID
  - Then proceed to Step 6, Option 2 with the provided ID
- **Option 3 (Markdown-Datei):** Proceed to Step 6, Option 3
- **Option 4 (Direkt umsetzen):** Proceed to Step 6, Option 4
- **Other (free text input):** Parse the input:
  - **Ticket-ID pattern detected** (e.g., `DEV-123`): Proceed to Step 6, Option 2 with this ID
  - **Number only** (e.g., `123`): Assume project prefix → Proceed to Step 6, Option 2
  - **Anything else** (e.g., "nichts", "nein"): Confirm: "Alles klar! Der Task wurde oben angezeigt und kann bei Bedarf kopiert werden." — END

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

5. Ask for priority (in German): "Möchtest du eine Priorität setzen? (0=Keine, 1=Urgent, 2=High, 3=Normal, 4=Low) — Standard: Keine"

6. Ask for labels (in German): "Möchtest du Labels hinzufügen? (z.B. 'tech-debt', 'infrastructure', 'migration')"
   - List available labels for the selected team

7. Create ticket via Linear MCP:
   - Title: The task title
   - Description: The full task in markdown format (without title heading to avoid duplication)
   - Set team, project, status, priority, labels as selected

8. Report the created ticket URL (in German)

9. **Then ask:** "Möchtest du diesen Task jetzt umsetzen?"

### Option 2: Bestehendes Linear Ticket erweitern

1. Check if Linear MCP is available (same as Option 1)

2. Fetch existing ticket via Linear MCP (`get_issue`)
   - If not found: "Ticket [ID] wurde nicht gefunden. Bitte überprüfe die ID."

3. Show current ticket state (in German):
   - "Aktuelles Ticket [ID]: **[Titel]**"
   - Ask: "Möchtest du die Beschreibung vollständig ersetzen oder den Task anhängen?"

4. Update ticket via Linear MCP:
   - Ask about title update: "Soll der Titel auf '[neuer Titel]' aktualisiert werden?"
   - Replace or append description (without title heading)

5. Report: "Ticket [ID] wurde erfolgreich aktualisiert: [URL]"

6. **Then ask:** "Möchtest du diesen Task jetzt umsetzen?"

### Option 3: Als Markdown-Datei speichern

1. Ask for file location: "Wo soll der Task gespeichert werden?"
   - Suggest filename based on title

2. Validate path, create directory if needed

3. Write file and confirm: "Task gespeichert unter [Pfad]"

4. **Then ask:** "Möchtest du diesen Task jetzt umsetzen?"

### Option 4: Direkt umsetzen (or after Option 1/2/3)

When the user chooses direct implementation:

1. Confirm: "Starte Implementierung..."
2. Invoke `/lt-dev:resolve-ticket` depending on whether a Linear ticket exists:
   - **Ticket exists:** Use the Skill tool with `skill: "lt-dev:resolve-ticket", args: "<ticket-id>"`
   - **No ticket (markdown/direct):** Use the Skill tool with `skill: "lt-dev:resolve-ticket", args: "<file-path-or-context>"`

---

## Execution Summary

1. **Collect input** — Let user describe the technical task
2. **Analyze gaps** — Check against required elements checklist
3. **Ask targeted questions** — Only for missing/unclear elements (in German)
4. **Validate completeness** — Size, coherence, deliverables check
5. **Generate and present ticket** — Format according to template (in German) and present for review
6. **Ask for output** — Linear, existing ticket, Markdown, or direct implementation
7. **Execute and offer implementation** — Create output, then offer to start work

**Key behaviors:**
- User can abort at any point
- Always validate paths/teams before executing
- Handle errors gracefully with German error messages
- Tasks focus on WHAT and WHY, not user stories with roles
