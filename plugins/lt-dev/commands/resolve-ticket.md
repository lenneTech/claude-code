---
description: Resolve a Linear ticket or story file with TDD-based implementation
argument-hint: "[issue-id | story-file]"
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
| `/lt-dev:linear-comment` | Generate testing comment for the issue |
| `/lt-dev:dev-submit` | Submit work for review (MR/PR + comment + status update) |
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

### Ticket Type Detection

Determine the ticket type from the Linear issue labels, title, or file path:

| Indicator | Type |
|-----------|------|
| Label "Bug", title contains "fix", "bug", "fehler", "broken", "crash" | **Bug** |
| Label "Security", title contains "vulnerability", "sicherheitslücke", "CVE", "injection", "XSS" | **Security** |
| File path contains `bugs/` | **Bug** |
| Everything else | **Feature/Task** |

### Implementation Workflow

Use the `building-stories-with-tdd` skill to execute the full implementation cycle:

1. **Analysis** — Parse requirements, verify existing API structure, plan implementation
2. **Write Tests** — Create tests FIRST based on acceptance criteria
3. **Run Tests** — Verify tests fail for the right reasons
4. **Implement** — Write code until tests pass (use `generating-nest-servers` for backend, `developing-lt-frontend` for frontend)
5. **Validate** — ALL tests green (not just new ones), code quality check, security review

### MANDATORY: Regression Tests for Bug/Security Fixes

**When ticket type is Bug or Security**, the following additional rules apply:

1. **Write a regression test that reproduces the exact bug/vulnerability BEFORE fixing it**
2. **Verify** the regression test fails (proves the problem exists)
3. After fixing, **verify** the regression test passes (proves the fix works)
4. **Name the test descriptively**: `should not [bug behavior]` or `should prevent [vulnerability]`
5. The regression test MUST remain in the test suite permanently

**A bug/security fix without a regression test is INCOMPLETE — do not proceed to review.**

**CRITICAL: Failing tests are ALWAYS a problem.** Fix the root cause of every failing test — even if the failure predates the current changes or seems unrelated. A green test suite is a non-negotiable prerequisite.

**After completion, update the Linear Issue status** (if source was a Linear ticket).

**Then guide the user through the quality pipeline:**

1. `/lt-dev:review $ARGUMENTS` — Comprehensive 7-dimension quality check
2. Address any findings from the review
3. `/lt-dev:dev-submit $ARGUMENTS` — Create MR/PR, post testing comment, and move ticket to "Dev Review"

**BEGIN IMPLEMENTATION NOW.**
