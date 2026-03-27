---
description: Convert a PRD, specification, or Linear ticket into structured, prioritized tasks
argument-hint: "[file-path | issue-id | URL]"
allowed-tools: Read, Grep, Glob, Bash(git:*), WebFetch, mcp__plugin_lt-dev_linear__get_issue, mcp__plugin_lt-dev_linear__list_comments, AskUserQuestion
disable-model-invocation: true
---

# Spec to Tasks

Convert product requirements, specifications, or ticket descriptions into a structured, prioritized task list ready for implementation.

## When to Use This Command

- Breaking down a PRD or specification document into implementable tasks
- Extracting tasks from a large Linear ticket with complex requirements
- Planning implementation order for a feature with multiple components
- Creating a task breakdown from a Confluence page or design document

## Related Commands

| Command | Purpose |
|---------|---------|
| `/lt-dev:resolve-ticket` | Implement a single ticket end-to-end with TDD |
| `/lt-dev:create-ticket` | Create a new Linear ticket |
| `/lt-dev:create-story` | Create a user story |

**Workflow:** Spec → `/lt-dev:spec-to-tasks` → pick tasks → `/lt-dev:resolve-ticket` per task

---

## Execution

Parse `$ARGUMENTS` to determine the input source.

### Step 1: Source Detection & Content Extraction

1. **Linear Issue ID** (e.g., `LIN-123`, `DEV-456`, or just a project prefix + number):
   - Fetch issue via `mcp__plugin_lt-dev_linear__get_issue`
   - Fetch comments via `mcp__plugin_lt-dev_linear__list_comments`
   - Extract: title, description, acceptance criteria, comments

2. **File path** (e.g., `docs/prd.md`, `specs/feature.md`, `STORY.md`):
   - Read the file
   - Parse markdown structure (headings, lists, acceptance criteria)

3. **URL** (starts with `http://` or `https://`):
   - Fetch content via `WebFetch`
   - Parse the resulting content

4. **No argument**: Ask the user what to convert:
   - "Welche Spezifikation möchtest du in Tasks aufteilen? Du kannst angeben: einen Dateipfad, eine Linear Issue-ID, eine URL, oder den Text direkt einfügen."

### Step 2: Content Analysis

Analyze the extracted content and identify:

1. **Functional requirements** — What the system must do
2. **Non-functional requirements** — Performance, security, accessibility constraints
3. **Acceptance criteria** — Explicit conditions for completion
4. **Dependencies** — External systems, APIs, libraries needed
5. **Implicit requirements** — Things not stated but necessary (auth, validation, error handling, tests)

### Step 3: Task Generation

Generate tasks following these rules:

#### Task Structure

Each task must have:
- **Title**: Imperative form, specific and actionable (e.g., "Create user registration endpoint with email validation")
- **Priority**: High / Medium / Low
- **Type**: Backend / Frontend / Fullstack / Infrastructure / Test
- **Estimated Complexity**: S (< 1h) / M (1-4h) / L (4-8h) / XL (> 8h)
- **Dependencies**: List of task numbers this task depends on
- **Acceptance Criteria**: 2-5 testable conditions derived from the spec

#### Priority Rules

- **High**: Core functionality, blocking other tasks, security-critical
- **Medium**: Supporting functionality, UI polish, error handling
- **Low**: Nice-to-have, optimization, documentation

#### Ordering Rules (inspired by Ralph's fix_plan.md)

1. Infrastructure and setup tasks first (DB schema, module scaffolding)
2. Backend API endpoints before frontend integration
3. Core happy-path before edge cases and error handling
4. Tests alongside each implementation task (TDD)
5. Integration and E2E tests after component tasks

#### Size Guidelines

- Split any XL task into smaller tasks
- Each task should be completable in a single `/lt-dev:resolve-ticket` run
- Prefer many small tasks over few large ones

### Step 4: Output

Present the task list in this format:

```markdown
# Task Breakdown: [Spec Title]

**Source:** [file/ticket/URL]
**Generated:** [date]
**Total Tasks:** N (H: X High, M: Y Medium, L: Z Low)

---

## High Priority

### 1. [Task Title]
- **Type:** Backend | **Complexity:** M
- **Dependencies:** —
- **Acceptance Criteria:**
  - [ ] Criterion 1
  - [ ] Criterion 2

### 2. [Task Title]
- **Type:** Frontend | **Complexity:** S
- **Dependencies:** #1
- **Acceptance Criteria:**
  - [ ] Criterion 1

---

## Medium Priority

### 3. [Task Title]
...

---

## Low Priority

### N. [Task Title]
...

---

## Dependency Graph

#1 → #2 → #5
#1 → #3 → #4 → #5
#6 (independent)
```

### Step 5: Next Steps

After presenting the task list, ask the user:

"Soll ich die Tasks als einzelne Linear Tickets erstellen, in eine Datei speichern, oder direkt mit einem Task starten?"

Options:
- **Linear Tickets**: Create each task as a sub-issue (if Linear MCP available)
- **Save to file**: Write as `tasks/[spec-name]-tasks.md`
- **Start implementing**: Begin with the first high-priority task via resolve-ticket workflow
- **Adjust**: Let the user reorder, merge, split, or remove tasks
