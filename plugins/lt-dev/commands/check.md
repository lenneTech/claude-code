---
description: Run the project's package.json `check` script across all discovered projects (monorepo-aware) with iterate-until-green auto-fix, mandatory audit-finding fix escalation ladder, and structured report. Guarantees project runnability.
argument-hint: '[--project=path]'
allowed-tools: Read, Edit, Write, Grep, Glob, Bash(git:*), Bash(echo:*), Bash(grep:*), Bash(wc:*), Bash(jq:*), Bash(cat:*), Bash(ls:*), Bash(test:*), Bash(bash ${CLAUDE_PLUGIN_ROOT}/scripts/*), Bash(node:*), Bash(pnpm run check:*), Bash(npm run check:*), Bash(yarn run check:*), Bash(pnpm check:*), Bash(npm check:*), Bash(yarn check:*), Bash(pnpm run lint:*), Bash(npm run lint:*), Bash(yarn run lint:*), Bash(pnpm run typecheck:*), Bash(npm run typecheck:*), Bash(yarn run typecheck:*), Bash(pnpm run build:*), Bash(npm run build:*), Bash(yarn run build:*), Bash(pnpm test:*), Bash(npm test:*), Bash(yarn test:*), Bash(pnpm run test:*), Bash(npm run test:*), Bash(yarn run test:*), Bash(pnpm audit:*), Bash(npm audit:*), Bash(yarn audit:*), Bash(pnpm update:*), Bash(npm update:*), Bash(yarn upgrade:*), Bash(pnpm add:*), Bash(npm install:*), Bash(yarn add:*), Bash(pnpm install:*)
disable-model-invocation: true
---

# Check Script Runner

## When to Use This Command

- You want to ensure the project is in a runnable state before committing, pushing, or creating a PR
- You suspect drift (typecheck/lint/build/audit errors accumulated) and want to bring the repo back to green
- As a standalone runnability gate, without spawning a full review (`/lt-dev:review` already includes this)
- Before handing off work to another agent or teammate

## Related Commands

| Command | Purpose |
|---------|---------|
| `/lt-dev:check` | **This command** — runnability-only check with auto-fix |
| `/lt-dev:review` | Full review; runs the same check script logic as Phase 1.5 |
| `/lt-dev:backend:code-cleanup` | Backend-specific style/format cleanup |
| `/lt-dev:refactor-frontend` | Frontend-specific refactoring |
| `/lt-dev:git:rebase` | Post-rebase runnability is validated by the `branch-rebaser` agent's Phase 6.5 |

**When to use which:**
- Quick runnability gate → `/lt-dev:check`
- Full quality review across all dimensions → `/lt-dev:review`

---

## Execution

Parse arguments from `$ARGUMENTS`:
- **`--project=<path>`** (optional): Restrict the run to a single sub-project. By default the command discovers and runs `check` across all tracked `package.json` files in the repo.

### Procedure

**Follow the `running-check-script` skill verbatim** (`plugins/lt-dev/skills/running-check-script/SKILL.md`). The skill is the single source of truth for:

1. **Discovery** — `bash "${CLAUDE_PLUGIN_ROOT}/scripts/discover-check-scripts.sh" "$(pwd)"`
2. **Per-project execution** — run `<pm> run check` in each project directory
3. **Iterate-until-green auto-fix loop** — no hard iteration cap; terminate on GREEN or STALLED
4. **Audit-finding fix escalation ladder** — mandatory 6-step ladder before any acceptance
5. **Residual classification** — Accepted vs Critical blocker
6. **Bypass policy** — no `--no-verify`, no `@ts-ignore`, no `eslint-disable`, etc.
7. **Test-duplication baseline** — record `git rev-parse HEAD` + `git status --porcelain` after GREEN
8. **Report block format** — use as the final output
9. **Gating** — exit status reflects runnability

### Filtering (if `--project` provided)

When `--project=<path>` is passed, filter the discovery output to only projects whose `package.json` path starts with `<path>`. Run the skill's procedure only for those projects.

### Output

Print the **Step 8 report block** from the `running-check-script` skill as the final output. If all projects ended in GREEN, also print a one-line summary:

```
✅ check script runnable across N project(s) — M error(s) auto-fixed, K accepted residual(s)
```

If any project has Unresolved blockers, print:

```
❌ check script BLOCKED — N unresolved error(s) across M project(s). See report above.
```

### Behavior Summary

- No arguments → discovers and runs `check` across the whole repo
- No `check` script found anywhere → prints "No `check` script defined in any tracked package.json" and exits cleanly
- GREEN → success, optionally with Accepted Residuals documented
- STALLED with Unresolved → command finishes but surfaces the blockers prominently; the repo is not runnable
