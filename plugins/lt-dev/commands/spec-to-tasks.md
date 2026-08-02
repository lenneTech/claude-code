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

### Step 2b: Settle the open decisions before slicing

Point 5 is where specs are thinnest, and a task list is the worst place to discover it: an unstated decision becomes a guessed acceptance criterion, which becomes a ticket someone implements against. Where the analysis surfaced a genuine open decision (which roles may do this, what happens to existing records, what an empty result returns), run the [`grilling-decisions`](${CLAUDE_PLUGIN_ROOT}/../skills/grilling-decisions/SKILL.md) skill: one question at a time, each carrying your recommendation, facts read from the codebase rather than asked.

Fold each answer into the acceptance criteria of the task it belongs to. When the spec answers everything, say so and continue.

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

#### Cut vertical slices, not layers

Each task is a **tracer bullet**: a narrow but complete path through every layer it touches — model, service, endpoint, generated types, UI, tests — for one capability. A completed slice is demoable on its own.

The alternative, slicing by layer (all models, then all services, then all pages), produces tasks that can never be verified individually: nothing works until the last one lands, every integration problem surfaces at the end at once, and a wrong assumption in task 1 is discovered in task 12.

Within a slice, the stack's own order still holds — backend before frontend, because the frontend consumes generated types from the running API. That is sequencing *inside* a slice, not a reason to split the slice in two.

**The exception is a wide mechanical change** — renaming a field, retyping a shared symbol — whose blast radius fans across the codebase, so no vertical slice can land green. Sequence those as expand, migrate, contract: add the new form beside the old (nothing breaks), migrate the call sites in batches sized by blast radius (each batch its own task, each keeping the suite green because the old form still exists), then delete the old form once no caller remains.

#### Ordering Rules

1. Prefactoring first: the mechanical change that makes the following slices easy to write ("make the change easy, then make the easy change")
2. Infrastructure and setup only where a slice genuinely cannot run without it (DB schema, module scaffolding)
3. The slice that proves the riskiest assumption early, before slices that depend on it
4. Core happy-path slices before the edge-case and error-handling slices layered on top
5. Tests inside each slice (TDD), never as a trailing task
6. Cross-slice integration and E2E tests after the slices they span

#### Size Guidelines

- Split any XL task into smaller **slices** — narrower capability, still full-depth. Splitting an XL task into "backend part" and "frontend part" is the layer cut this section rules out.
- Each task should be completable in a single `/lt-dev:resolve-ticket` run, in one fresh context window
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
