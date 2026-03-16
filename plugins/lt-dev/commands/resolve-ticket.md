---
description: Resolve a Linear ticket or story file with TDD-based implementation
argument-hint: [issue-id | story-file]
allowed-tools: Agent, Read, Grep, Glob, Bash(git:*), mcp__plugin_lt-dev_linear__get_issue, mcp__plugin_lt-dev_linear__list_comments, AskUserQuestion
disable-model-invocation: true
---

# Resolve Ticket

## When to Use This Command

- Resolving a Linear ticket end-to-end (analysis → tests → implementation → review)
- Implementing a ticket from a markdown file (story, task, or bug)
- Any ticket type (Story, Task, Bug) that needs structured, test-driven implementation

## Related Commands

| Command | Purpose |
|---------|---------|
| `/lt-dev:create-ticket` | Create any ticket type (Story, Task, Bug) |
| `/lt-dev:create-story` | Create a user story |
| `/lt-dev:create-task` | Create a technical task |
| `/lt-dev:create-bug` | Create a bug report |
| `/lt-dev:review` | Comprehensive 7-dimension code review after implementation |
| `/review` | Claude Code built-in: PR-level review after PR creation |
| `/lt-dev:comment` | Generate testing comment for the issue |
| `/lt-dev:backend:sec-review` | Security review of code changes |
| `/lt-dev:backend:test-generate` | Generate tests for existing code |

**Workflow options:**
- Have a Linear ticket? → `/lt-dev:resolve-ticket DEV-123`
- Have a ticket file? → `/lt-dev:resolve-ticket stories/my-story.md`
- Need to create a ticket first? → `/lt-dev:create-ticket` → then `/lt-dev:resolve-ticket`

---

## Execution

Parse `$ARGUMENTS` to determine the input source:

### Source Detection

1. **Linear Issue ID** (e.g., `LIN-123`, `DEV-456`, or just `123`):
   - Fetch issue via `mcp__plugin_lt-dev_linear__get_issue`
   - Fetch comments via `mcp__plugin_lt-dev_linear__list_comments`
   - Extract: title, description, acceptance criteria

2. **Ticket file path** (e.g., `stories/my-story.md`, `bugs/login-fix.md`, `STORY.md`):
   - Read the file
   - Extract: requirements, acceptance criteria, deliverables, properties

3. **No argument provided**:
   - Ask the user: "Bitte gib eine Linear Issue-ID (z.B. `DEV-123`) oder einen Ticket-Dateipfad an."

### Implementation Workflow

Use the `building-stories-with-tdd` skill to execute the full implementation cycle:

1. **Analysis** — Parse requirements, verify existing API structure, plan implementation
2. **Write Tests** — Create tests FIRST based on acceptance criteria
3. **Run Tests** — Verify tests fail for the right reasons
4. **Implement** — Write code until tests pass (use `generating-nest-servers` for backend, `developing-lt-frontend` for frontend)
5. **Validate** — ALL tests green (not just new ones), code quality check, security review

**CRITICAL: Failing tests are ALWAYS a problem.** Fix the root cause of every failing test — even if the failure predates the current changes or seems unrelated. A green test suite is a non-negotiable prerequisite.

**After completion, update the Linear Issue status** (if source was a Linear ticket).

**Then guide the user through the quality pipeline:**

1. `/lt-dev:review $ARGUMENTS` — Comprehensive 7-dimension quality check
2. Address any findings from the review
3. `/lt-dev:comment $ARGUMENTS` — Post testing comment on the ticket
4. Ask the user: "Soll ich eine PR erstellen?" — If yes, create PR with `gh pr create` using the issue title and a summary of changes
5. After PR creation: suggest running `/review` for a final PR-level check

**BEGIN IMPLEMENTATION NOW.**
