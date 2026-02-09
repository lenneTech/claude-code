# Agent Team Patterns

Detailed coordination patterns for Claude Code Agent Teams. Referenced from SKILL.md.

## Pattern: Independent Then Challenge (Review)

Used by `/lt-dev:review` for large or fullstack changes.

### Setup

3 reviewer teammates, each responsible for specific quality dimensions:

| Teammate | Dimensions |
|----------|-----------|
| content-quality | Purpose Fulfillment, Acceptance Criteria, DRY, Naming, Complexity |
| security-performance | OWASP Top 10, N+1 Queries, Memory Leaks, Auth/Authz |
| tests-docs | Test Execution, Coverage, Documentation, Lint/Format |

### Phases

**Phase 1 - Independent Analysis:**
- Each teammate reviews the diff independently
- No inter-teammate communication during this phase
- Each produces findings in their assigned dimensions

**Phase 2 - Challenge:**
- Teammates share their findings via messages
- Each teammate challenges other teammates' findings:
  - "I disagree with the security finding because..."
  - "This performance issue is actually more severe because..."
  - "The test coverage gap also affects..."
- Purpose: Eliminate false positives, surface missed issues

**Phase 3 - Synthesis:**
- Lead collects all findings and challenges
- Produces unified report with 7-dimension grades
- Includes remediation catalog ordered by priority

### Team Creation Template

```
Create an agent team with 3 teammates using Sonnet:

Teammate "content-quality":
Review code changes for: purpose fulfillment, acceptance criteria compliance,
DRY violations, naming conventions, and cyclomatic complexity.
Base branch: <base>. Share findings when done.

Teammate "security-performance":
Review code changes for: OWASP Top 10 vulnerabilities, N+1 query patterns,
memory leaks, authentication/authorization issues.
Base branch: <base>. Share findings when done.

Teammate "tests-docs":
Run tests, check coverage, validate documentation completeness,
verify lint/format compliance.
Base branch: <base>. Share findings when done.

After all teammates complete Phase 1, have them share findings and
challenge each other's assessments. Then synthesize into a unified report.
Require plan approval before teammates start reviewing.
```

---

## Pattern: Parallel With Handoff (TDD)

Used by `/lt-dev:create-story` for fullstack test writing.

### Setup

2 teammates with a contract-based handoff:

| Teammate | Responsibility |
|----------|---------------|
| backend-tests | API tests in projects/api/tests/stories/, defines contracts |
| frontend-tests | E2E tests in projects/app/tests/e2e/, consumes contracts |

### Phases

**Phase 1 - Backend Contract Definition:**
- Backend teammate analyzes story requirements
- Writes API tests using TestHelper patterns
- Defines API contracts: endpoints, request/response shapes, status codes
- Shares contracts via message to frontend teammate

**Phase 2 - Parallel Test Writing:**
- Backend teammate continues writing remaining API tests
- Frontend teammate writes E2E tests based on received contracts
- Frontend teammate uses Playwright patterns

**Phase 3 - Contract Validation:**
- Lead verifies contract consistency between backend and frontend tests
- Checks that frontend tests expect the same responses backend tests assert

### Important Constraints

- **Only test writing is parallel** - implementation remains sequential
- After team completes, invoke `building-stories-with-tdd` skill for implementation
- Backend teammate must share contracts BEFORE frontend teammate starts writing tests that depend on API responses

### Team Creation Template

```
Create an agent team with 2 teammates using Sonnet:

Teammate "backend-tests":
Write API tests for this story in projects/api/tests/stories/.
Use TestHelper patterns from existing tests.
Define API contracts (endpoints, request/response shapes, status codes).
Share contracts via message to frontend-tests teammate when ready.

Teammate "frontend-tests":
Write E2E tests for this story in projects/app/tests/e2e/.
Use Playwright patterns from existing tests.
Wait for API contract messages from backend-tests before writing
tests that depend on API responses.

Lead coordinates and validates contract consistency.
```

---

## Pattern: Adversarial Convergence (Debug)

Used by `/lt-dev:debug` for root cause investigation.

### Setup

N teammates (one per hypothesis), dynamically created after hypothesis generation.

### Phases

**Phase 1 - Hypothesis Generation (Lead only):**
- Lead analyzes bug description and relevant code
- Generates 3-5 hypotheses with brief rationale
- User confirms/removes/adds hypotheses

**Phase 2 - Investigation:**
- One teammate per hypothesis
- Each teammate:
  1. Finds evidence FOR their hypothesis
  2. Finds evidence AGAINST other teammates' hypotheses
  3. Shares both via messages

**Phase 3 - Adversarial Debate:**
- Teammates respond to evidence against their hypothesis
- Counter-arguments with code references
- Lead moderates if discussion stagnates

**Phase 4 - Convergence:**
- Lead collects: confidence level per hypothesis, strongest counter-argument, consensus/dissent
- Ranked hypotheses with evidence table
- If no hypothesis survives: Lead generates new ones based on collected evidence

### Team Creation Template

```
Create an agent team with N teammates (one per hypothesis) using Sonnet:

Teammate "hypothesis-1-<short-name>":
Investigate hypothesis: "<hypothesis description>"
1. Find evidence FOR this hypothesis in the codebase
2. Find evidence AGAINST other hypotheses
3. Share findings via messages

[... repeat for each hypothesis ...]

Use delegate mode so the lead only coordinates.
Each teammate should actively try to falsify other theories.
```

---

## Pattern: Parallel Worktree Execution (Batch Rebase)

Used by `/lt-dev:git:rebase-mrs` for parallel branch rebasing.

### Setup

N teammates (one per branch), each working in an isolated git worktree.

### Worktree Lifecycle

```bash
# Setup (lead creates before spawning teammates)
git worktree add /tmp/rebase-<branch-name> <branch-name>

# Teammate works in /tmp/rebase-<branch-name>
# Executes full rebase workflow (Phases 0-12 from branch-rebaser)

# Cleanup (lead removes after ALL teammates complete)
git worktree remove /tmp/rebase-<branch-name> --force
git worktree prune
```

### Important Constraints

- **Worktree cleanup is CRITICAL** - always execute, even on failure
- Each teammate must work exclusively in its assigned worktree path
- Lead must NOT work in the main worktree during parallel operations
- Force push operations must be serialized (one at a time) to avoid race conditions

### Team Creation Template

```
Create an agent team with N teammates (one per branch) using Sonnet:

Teammate "rebase-<branch-1>":
Rebase branch <branch-1> onto <base-branch>.
Work in worktree: /tmp/rebase-<branch-1>
Execute the full rebase workflow (Phases 0-12).
Report results when done.

[... repeat for each branch ...]

Lead monitors progress and collects reports.
After ALL teammates complete, clean up worktrees.
```

---

## Anti-Patterns

### Same-File Edits
Never assign multiple teammates to edit the same file. Git cannot merge concurrent changes to the same file in a worktree. Use worktrees for isolation or assign non-overlapping file sets.

### Too Many Teammates
More than 5 teammates increases coordination overhead exponentially. For batch operations, consider grouping (e.g., 3 branches per teammate instead of 1).

### Missing Context in Spawn Prompt
Each teammate starts a fresh session. The spawn prompt must include ALL context needed:
- Relevant file paths
- Base branch name
- Specific instructions (not "do the usual")
- Expected output format

### Premature Convergence
Don't let the lead synthesize before all teammates report. Wait for all findings before drawing conclusions.

### Teammate Self-Cleanup
Teammates should NOT clean up shared resources (worktrees, temp files). The lead handles all cleanup after teammates complete, ensuring nothing is removed prematurely.

---

## Cleanup Protocol

1. **Lead waits** for all teammates to complete or timeout
2. **Lead collects** all reports and findings
3. **Lead synthesizes** final output
4. **Lead cleans up**:
   - Remove worktrees: `git worktree remove <path> --force`
   - Prune stale worktrees: `git worktree prune`
   - Delete temp files created by teammates
5. **Lead presents** results to user
6. **Team shutdown** - lead terminates the team session
