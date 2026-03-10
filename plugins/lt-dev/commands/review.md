---
description: Comprehensive code review with specialized domain reviewers (frontend, backend, security, devops) running in parallel
argument-hint: [issue-id] [--base=main]
allowed-tools: Read, Grep, Glob, Bash(git:*), Bash(echo:*), Agent, AskUserQuestion
disable-model-invocation: true
---

# Code Review

## When to Use This Command

- Before merging changes to validate overall quality
- After completing a feature or fix implementation
- As a final quality gate after `resolve-ticket`
- When you want a structured assessment across all quality dimensions

## Related Commands

| Command | Purpose |
|---------|---------|
| `/review` | Claude Code built-in: quick PR-level review (requires `gh` CLI) |
| `/security-review` | Claude Code built-in: general security review of branch diff |
| `/lt-dev:backend:sec-review` | Focused security review (@lenne.tech/nest-server specific) |
| `/lt-dev:backend:code-cleanup` | Code style and formatting cleanup |
| `/lt-dev:backend:test-generate` | Generate tests for changes |
| `/lt-dev:backend:sec-audit` | OWASP security audit for dependencies |
| `/lt-dev:resolve-ticket` | Resolve a ticket (run review after) |
| `/lt-dev:debug` | Adversarial debugging with competing hypotheses |

**Recommended workflow:** `resolve-ticket` → `/lt-dev:review` → address findings → `code-cleanup` → create PR → `/review`

---

## Architecture

The review spawns an orchestrator that creates an Agent Team with specialized reviewers:

```
/lt-dev:review (this command)
│
└── code-reviewer (orchestrator)
    │  Creates Agent Team, all reviewers run in parallel:
    │
    ├── security-reviewer    (always — OWASP, Permissions, Injection, XSS, Auth, Secrets, Dependencies)
    ├── frontend-reviewer    (if frontend changes — Types, Components, Composables, A11y, SSR, Performance, Styling)
    ├── backend-reviewer     (if backend changes — Security Decorators, Models, Controllers, Services, Tests)
    └── devops-reviewer      (if infra changes — Docker, CI/CD, Environment, .dockerignore)
```

The orchestrator detects which domains are affected by the diff and only spawns relevant reviewers. The security-reviewer always runs. All reviewers execute in parallel as an Agent Team.

---

## Execution

Parse arguments from `$ARGUMENTS`:
- **Issue ID** (optional): Linear issue identifier (e.g., `LIN-123`) for requirement validation
- **`--base=<branch>`** (optional, default: `main`): Base branch for diff comparison

Spawn the `code-reviewer` orchestrator agent:

```
Use Agent tool with subagent_type "lt-dev:code-reviewer":

Review the code changes on the current branch.

Base branch: <base-branch from --base argument or "main">
Issue ID: <issue-id if provided, otherwise "none">

Analyze the diff, detect affected domains (frontend/backend/devops), create an Agent Team
with the appropriate specialized reviewers (security-reviewer always, plus frontend-reviewer,
backend-reviewer, devops-reviewer as needed), and produce a unified review report.
```

After the orchestrator completes, present its unified report to the user.
