---
description: Resolve a Linear ticket or story file with TDD-based implementation
argument-hint: [issue-id | story-file]
disable-model-invocation: true
---

# Resolve Ticket

## When to Use This Command

- Resolving a Linear ticket end-to-end (analysis → tests → implementation → review)
- Implementing a story from a markdown file
- Any ticket that needs structured, test-driven implementation

## Related Commands

| Command | Purpose |
|---------|---------|
| `/lt-dev:create-story` | Create a user story first, then resolve |
| `/lt-dev:fix-issue` | Quick-fix a Linear issue (less structured, no TDD) |
| `/lt-dev:review` | Comprehensive code review after implementation |
| `/review` | Claude Code built-in: PR-level review after PR creation |
| `/lt-dev:backend:test-generate` | Generate tests for existing code |

**Workflow options:**
- Have a Linear ticket? → `/lt-dev:resolve-ticket DEV-123`
- Have a story file? → `/lt-dev:resolve-ticket stories/my-story.md`
- Need to create a story first? → `/lt-dev:create-story` → then `/lt-dev:resolve-ticket`
- Quick fix without TDD? → `/lt-dev:fix-issue`

---

## Execution

Parse `$ARGUMENTS` to determine the input source:

### Source Detection

1. **Linear Issue ID** (e.g., `LIN-123`, `DEV-456`, or just `123`):
   - Fetch issue via `mcp__plugin_lt-dev_linear__get_issue`
   - Fetch comments via `mcp__plugin_lt-dev_linear__list_comments`
   - Extract: title, description, acceptance criteria

2. **Story file path** (e.g., `stories/my-story.md`, `STORY.md`):
   - Read the file
   - Extract: story statement, requirements, acceptance criteria, properties

3. **No argument provided**:
   - Ask the user: "Bitte gib eine Linear Issue-ID (z.B. `DEV-123`) oder einen Story-Dateipfad an."

### Implementation Workflow

Use the `building-stories-with-tdd` skill to execute the full implementation cycle:

1. **Analysis** — Parse requirements, verify existing API structure, plan implementation
2. **Write Tests** — Create tests FIRST based on acceptance criteria
3. **Run Tests** — Verify tests fail for the right reasons
4. **Implement** — Write code until tests pass (use `generating-nest-servers` for backend, `developing-lt-frontend` for frontend)
5. **Validate** — All tests green, code quality check, security review

**After all tests pass, guide the user through the quality pipeline:**

1. `/lt-dev:review $ARGUMENTS` — Comprehensive 7-dimension quality check
2. Address any findings from the review
3. Ask the user: "Soll ich eine PR erstellen?" — If yes, create PR with `gh pr create`
4. After PR creation: suggest running `/review` for a final PR-level check

**BEGIN IMPLEMENTATION NOW.**
