---
description: Comprehensive code review across 7 quality dimensions
argument-hint: [issue-id] [--base=main]
allowed-tools: Read, Grep, Glob, Task
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

**Recommended workflow:** `fix-issue` → `review` → address findings → `code-cleanup`

---

## Execution

Parse arguments from `$ARGUMENTS`:
- **Issue ID** (optional): Linear issue identifier (e.g., `LIN-123`) for requirement validation
- **`--base=<branch>`** (optional, default: `main`): Base branch for diff comparison

Spawn the `code-reviewer` agent via Task tool:

```
Use Task tool with subagent_type "lt-dev:code-reviewer":

Review the code changes on the current branch.

Base branch: <base-branch from --base argument or "main">
Issue ID: <issue-id if provided, otherwise "none">

Analyze all changes against the 7 quality dimensions and produce a structured report.
```

After the agent completes, present its report to the user.
