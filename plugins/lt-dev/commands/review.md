---
description: Comprehensive code review across 7 quality dimensions
argument-hint: [issue-id] [--base=main] [--team] [--no-team]
allowed-tools: Read, Grep, Glob, Bash, Task, AskUserQuestion
---

# Code Review

## When to Use This Command

- Before merging changes to validate overall quality
- After completing a feature or fix implementation
- As a final quality gate after `fix-issue`
- When you want a structured assessment across all quality dimensions

## Related Commands

| Command | Purpose |
|---------|---------|
| `/lt-dev:backend:sec-review` | Focused security review only |
| `/lt-dev:backend:code-cleanup` | Code style and formatting cleanup |
| `/lt-dev:backend:test-generate` | Generate tests for changes |
| `/lt-dev:backend:sec-audit` | OWASP security audit for dependencies |
| `/lt-dev:fix-issue` | Implement a Linear issue (run review after) |
| `/lt-dev:debug` | Adversarial debugging with competing hypotheses |

**Related Skills:**

| Skill | Purpose |
|-------|---------|
| `coordinating-agent-teams` | Auto-detection heuristics and team coordination patterns |

**Recommended workflow:** `fix-issue` → `review` → address findings → `code-cleanup`

---

## Execution

Parse arguments from `$ARGUMENTS`:
- **Issue ID** (optional): Linear issue identifier (e.g., `LIN-123`) for requirement validation
- **`--base=<branch>`** (optional, default: `main`): Base branch for diff comparison
- **`--team`** (optional): Force team mode
- **`--no-team`** (optional): Force single agent mode

### Team Mode Decision

1. **Check feature flag:**
   ```bash
   echo $CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS
   ```
   If empty or 0 → **Single Agent Mode**

2. **Check explicit flags:**
   - `--no-team` in arguments → **Single Agent Mode**
   - `--team` in arguments → **Team Mode**

3. **Auto-detection** (only if no explicit flag):
   Run diff analysis:
   ```bash
   git diff --stat <base-branch>...HEAD
   ```
   Parse output for:
   - **Total changed lines** (insertions + deletions)
   - **Number of changed files**
   - **Fullstack check**: Changes in both `projects/api/` AND `projects/app/`

   **Team Mode triggers:**
   - Changed lines >100 AND changed files >3
   - OR changes detected in both `projects/api/` and `projects/app/`

   **Otherwise:** Single Agent Mode

---

### Execution - Single Agent Mode

Spawn the `code-reviewer` agent via Task tool:

```
Use Task tool with subagent_type "lt-dev:code-reviewer":

Review the code changes on the current branch.

Base branch: <base-branch from --base argument or "main">
Issue ID: <issue-id if provided, otherwise "none">

Analyze all changes against the 7 quality dimensions and produce a structured report.
```

After the agent completes, present its report to the user.

---

### Execution - Team Mode

Inform the user: "Team Mode aktiviert - 3 Reviewer analysieren parallel."

Create an agent team with 3 teammates using Sonnet:

**Teammate "content-quality":**
Review code changes on current branch (base: `<base-branch>`) for these dimensions:
- **Content**: Purpose fulfillment, acceptance criteria compliance (issue: `<issue-id>` if provided)
- **Code Quality**: DRY violations, naming conventions, cyclomatic complexity, SOLID principles
Read the diff, analyze each changed file, and produce findings with severity and file references.
Share findings via message when Phase 1 is complete.

**Teammate "security-performance":**
Review code changes on current branch (base: `<base-branch>`) for these dimensions:
- **Security**: OWASP Top 10, injection vulnerabilities, auth/authz issues, secrets exposure
- **Performance**: N+1 queries, memory leaks, unnecessary re-renders, missing indices
Read the diff, analyze each changed file, and produce findings with severity and file references.
Share findings via message when Phase 1 is complete.

**Teammate "tests-docs":**
Review code changes on current branch (base: `<base-branch>`) for these dimensions:
- **Tests**: Run test suite, check coverage for changed files, identify untested paths
- **Documentation**: API docs, inline comments for complex logic, README updates
- **Formatting**: Run lint/format checks, verify consistent style
Execute tests and linting, analyze results, and produce findings with severity and file references.
Share findings via message when Phase 1 is complete.

Require plan approval before teammates start reviewing.

**After Phase 1 (individual review):**
Have teammates share findings and challenge each other:
- "Does this security issue also affect the test coverage assessment?"
- "Is this complexity finding actually justified by the requirement?"
- "Could this performance concern be a false positive given the usage pattern?"

**After Phase 2 (challenge):**
Lead synthesizes into a unified report matching the code-reviewer output format:
- 7 quality dimensions with fulfillment grades
- Remediation catalog ordered by priority
- Findings that survived the challenge phase are higher confidence

Clean up team after report is presented.
