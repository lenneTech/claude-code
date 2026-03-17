---
description: Create a Linear ticket (Story, Task, or Bug) with guided workflow
argument-hint: "[ticket-idea]"
allowed-tools: AskUserQuestion, Read, Glob
disable-model-invocation: true
---

# Linear Ticket erstellen

Smart-Router für die geführte Erstellung von Linear Tickets. Erkennt automatisch den passenden Ticket-Typ basierend auf der Nutzerbeschreibung und delegiert an den spezialisierten Command.

## When to Use This Command

- Creating any type of Linear ticket (Story, Task, or Bug)
- Unsure which ticket type fits best
- Quick entry point for all ticket creation workflows

## Related Commands

| Command | Purpose |
|---------|---------|
| `/lt-dev:create-story` | Create a user story (feature with user value) |
| `/lt-dev:create-task` | Create a technical task |
| `/lt-dev:create-bug` | Create a bug report |
| `/lt-dev:resolve-ticket` | Resolve ticket end-to-end with TDD |

**Workflow:** Create ticket → `/lt-dev:resolve-ticket` to implement

**IMPORTANT: All user-facing communication must ALWAYS be in German. Exceptions: Properties (camelCase), code snippets, and technical terms remain in English.**

**ABORT HANDLING: If the user wants to cancel at any point (e.g., "abbrechen", "stop", "cancel"), acknowledge it (in German): "Okay, Ticket-Erstellung abgebrochen." and stop the process.**

---

## Step 1: Collect Initial Input

**Check for argument:** If the user provided an idea as argument (e.g., `/lt-dev:create-ticket "Login funktioniert nicht"`), use that as starting point and skip to Step 2.

**If no argument provided:** Output the following prompt in German and wait for user response:

> Welches Ticket möchtest du erstellen? Beschreibe kurz, worum es geht.
>
> Ich erkenne automatisch, ob es sich um eine **Story** (Feature mit Nutzwert), einen **Task** (technische Aufgabe) oder einen **Bug** (Fehlerbericht) handelt.
>
> Du kannst auch direkt den Typ angeben, z.B.:
> - "Story: Admin soll FAQs verwalten können"
> - "Task: Datenbank-Migration auf PostgreSQL 16"
> - "Bug: Login-Seite zeigt 500-Fehler nach Passwort-Reset"

**Wait for the user's response before proceeding to Step 2.**

---

## Step 2: Detect Ticket Type

Analyze the user's input to determine the ticket type:

### Detection Rules

**Story** (User Story / Feature):
- User explicitly says "Story", "Feature", "User Story"
- Description follows "Als [Rolle] möchte ich..." pattern
- Focus on user value, new functionality, or user-facing improvements
- Keywords: "soll können", "möchte", "neues Feature", "Funktion", "Nutzer soll"

**Task** (Technical Task):
- User explicitly says "Task", "Aufgabe", "technisch"
- Technical work without direct user-facing value
- Keywords: "Migration", "Refactoring", "Update", "Konfiguration", "Setup", "Infrastruktur", "Performance", "Optimierung", "CI/CD", "Deployment", "Datenbank"

**Bug** (Bug Report):
- User explicitly says "Bug", "Fehler", "Problem", "kaputt", "funktioniert nicht"
- Something that worked before is now broken
- Keywords: "Error", "Fehler", "Crash", "500", "404", "funktioniert nicht", "falsch", "gebrochen", "broken", "Absturz", "Fehlermeldung"

**Ambiguous:**
- If the type cannot be clearly determined, ask the user (in German):

> Ich bin mir nicht sicher, welcher Ticket-Typ am besten passt. Was trifft zu?

Use AskUserQuestion with options:
1. **Story** — Neues Feature mit Nutzwert (z.B. "Nutzer soll X können")
2. **Task** — Technische Aufgabe ohne direkten Nutzwert (z.B. Migration, Refactoring)
3. **Bug** — Etwas funktioniert nicht wie erwartet

---

## Step 3: Delegate to Specialized Command

Once the ticket type is determined, delegate using the Skill tool:

### Story
Invoke `/lt-dev:create-story` with the user's input as context.

Tell the user (in German): "Das klingt nach einer **User Story**. Starte den Story-Erstellungsprozess..."

Then use the Skill tool: `skill: "lt-dev:create-story", args: "<user's input>"`

### Task
Invoke `/lt-dev:create-task` with the user's input as context.

Tell the user (in German): "Das klingt nach einem **technischen Task**. Starte den Task-Erstellungsprozess..."

Then use the Skill tool: `skill: "lt-dev:create-task", args: "<user's input>"`

### Bug
Invoke `/lt-dev:create-bug` with the user's input as context.

Tell the user (in German): "Das klingt nach einem **Bug-Report**. Starte den Bug-Erstellungsprozess..."

Then use the Skill tool: `skill: "lt-dev:create-bug", args: "<user's input>"`

---

## Execution Summary

1. **Collect input** — Let user describe what they need
2. **Detect type** — Automatically classify as Story, Task, or Bug
3. **Delegate** — Hand off to the specialized command with full context

**Key behaviors:**
- Prefer automatic detection over asking
- When in doubt, ask the user
- User can abort at any point
- Always communicate in German
