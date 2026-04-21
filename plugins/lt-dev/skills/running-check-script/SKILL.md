---
name: running-check-script
description: 'Single source of truth for running the package.json `check` script across lt-dev review and rebase workflows. Defines discovery (multi-package monorepo aware), the iterate-until-green auto-fix loop, the mandatory audit-finding fix escalation ladder, residual classification (Accepted vs Critical), test-duplication avoidance, and report formatting. Activates whenever an agent or command needs to validate runnability via `check` — currently used by `/lt-dev:review`, `code-reviewer`, `branch-rebaser`, and `test-reviewer`. NOT for general npm package maintenance (use maintaining-npm-packages). NOT for the rebase orchestration itself (use rebasing-branches).'
user-invocable: false
---

# Running the `check` Script

This skill is the **single source of truth** for executing the `package.json` `check` script in lt-dev workflows. Every reviewer, rebaser, and orchestrator that needs to guarantee project runnability must follow this procedure verbatim — duplicating the rules across agents leads to drift.

> **Goal:** A truly green `check` run (exit 0) is a non-negotiable prerequisite for any review or rebase to be considered complete. The only acceptable residual is an upstream dependency vulnerability where the full fix escalation ladder has been exhausted.

## When to Use This Skill

| Caller | Phase | Trigger |
|--------|-------|---------|
| `/lt-dev:review` | Phase 1.5 | Before spawning any specialized reviewer |
| `lt-dev:code-reviewer` | Phase 1.5 | Before single-pass review (skip if orchestrator already ran it) |
| `lt-dev:branch-rebaser` | Phase 6.5 | After lint/format, before tests |
| `lt-dev:test-reviewer` | (input briefing) | Honors the skip semantics defined here |

## Procedure

### Step 1 — Discover `check` scripts

Use the dedicated helper script (located in the lt-dev plugin):

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/discover-check-scripts.sh" "$(pwd)"
```

Output is TSV, one project per line:

```
<package.json path>\t<check script>\t<includes_tests:yes|no>\t<package manager>
```

The helper:
- Uses `git ls-files "package.json" "**/package.json"` so it respects `.gitignore` and skips `node_modules`
- Parses JSON via `jq` → `node -e` → `grep+sed` fallback chain (works even without `jq` installed)
- Resolves single-level composite scripts (`"check": "pnpm run ci"` → looks up `ci`)
- Detects whether `check` transitively invokes a test runner (`test`, `vitest`, `jest`, `playwright`)
- Detects the package manager per project via lockfile (`pnpm-lock.yaml` → `pnpm`, etc.; default `pnpm`)

If the helper returns nothing → no project defines `check` → skip the rest of this skill.

### Step 2 — Run `check` per project

For each discovered project, `cd` into its directory and run the `check` script with the detected package manager:

```bash
cd "$(dirname <package.json path>)"
<package manager> run check
```

Capture stdout, stderr, and exit code. Track an iteration counter starting at 1.

### Step 3 — Auto-fix loop (iterate until truly green)

If a project's `check` exits non-zero:

1. **Parse all errors** from the current run (typecheck, lint, build, missing imports, type mismatches, unused symbols, audit findings, etc.)
2. **Fix each error at the root cause** via `Read` + `Edit`. Includes pre-existing errors unrelated to the diff — runnability overrides scope boundaries.
3. **Re-run `check` from scratch.** Never trust partial state.
4. **Continue iterating** until one of these terminal conditions:
   - **(a) GREEN** — `check` exits 0 → done for this project
   - **(b) STALLED** — a full iteration produced no net reduction in error count → stop and classify residuals
5. **No hard iteration cap.** As long as each iteration strictly reduces the error count, keep going. The goal is true green.

### Step 4 — Audit findings: mandatory fix escalation ladder

When `pnpm audit` / `npm audit` / `yarn audit` (invoked by `check`) reports a vulnerability, you MUST exhaust this ladder **before** classifying the finding as Accepted. Re-run `check` after every step.

| # | Step | Command (pnpm / npm / yarn) |
|---|------|------------------------------|
| 1 | Update to latest compatible | `pnpm update <pkg>` / `npm update <pkg>` / `yarn upgrade <pkg>` |
| 2 | Automatic remediation | `pnpm audit --fix` / `npm audit fix` / `yarn audit --fix` |
| 3 | Force semver-major upgrade | `pnpm audit --fix --force` / `npm audit fix --force` |
| 4 | Bump direct dep to next major if advisory lists fix there | `pnpm add <pkg>@<major>` / `npm install <pkg>@<major>` / `yarn add <pkg>@<major>` |
| 5 | Force a transitive dep version | `pnpm.overrides` / `resolutions` (yarn) / `overrides` (npm) block in `package.json`, then re-install |
| 6 | Replace the package | Switch to a maintained alternative if abandoned |

A finding may only be classified as Accepted after **every** applicable step has been tried and verified, with documented evidence that no patched version exists anywhere in the ecosystem.

### Step 5 — Residual classification

Only after a project has STALLED (and, for audit findings, only after the escalation ladder is exhausted):

| Residual type | Treatment |
|---------------|-----------|
| Vulnerable dependency where the full ladder has been tried and no patched version exists (verified via registry, advisory database, upstream repo) | **Accepted Residual** — document with package name, advisory ID, ladder steps tried, why each failed, evidence of unfixability. NOT a blocker. |
| Vulnerable dependency where the ladder has NOT been fully tried | **Critical blocker** — the loop is not allowed to terminate until the ladder is exhausted. |
| Any other residual (typecheck, lint, build, test, import, etc.) | **Critical blocker** — add to Remediation Catalog with Critical priority. |

### Step 6 — Bypass policy (hard rules)

Never use any of the following to silence errors:

- `git commit --no-verify`
- `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`
- `eslint-disable`, `eslint-disable-next-line`, `eslint-disable-line`
- `/* istanbul ignore */`
- Lint rule downgrades in config files
- Commenting out broken code
- Deleting failing tests

The ONLY permitted "non-fix" is an upstream dependency vulnerability where the escalation ladder has been fully exhausted. Everything else must be fixed at the root.

### Step 7 — Test-duplication avoidance

Tests must not run twice if `check` already covered them on an unchanged working tree.

After each project completes Step 3 with a GREEN result, record a **post-check baseline**:

```bash
git -C <project-dir> rev-parse HEAD                 # commit baseline
git -C <project-dir> status --porcelain             # working-tree baseline
```

A subsequent test phase (e.g. `branch-rebaser` Phase 7, `code-reviewer` Phase 5, `test-reviewer`) may **skip** running tests for a project when ALL of the following hold:

1. The discovery output marked the project's `check` as `includes_tests=yes`
2. The project ended Step 3 in GREEN status (or YELLOW with only Accepted Residuals)
3. `git rev-parse HEAD` matches the baseline (no new commits)
4. `git status --porcelain` matches the baseline (no working-tree changes since)

If any condition fails → run tests as normal.

### Step 8 — Report block

Every caller must include this block in its final report:

```markdown
### Check Script Results
| Project | Script | Iterations | Initial Errors | Auto-Fixed | Accepted | Final Status |
|---------|--------|------------|----------------|------------|----------|--------------|
| projects/api | pnpm run check | 3 | 7 | 6 | 1 | ⚠️ (1 accepted) |
| projects/app | pnpm run check | 1 | 0 | 0 | 0 | ✅ |

**Fixes applied:**
- `projects/api/src/modules/user/user.service.ts:42` — Removed unused `LoggerService` import (pre-existing)
- `projects/api/src/modules/auth/auth.controller.ts:18` — Fixed implicit `any` on `req` parameter (introduced in diff)

**Check Script — Accepted Residuals** (escalation ladder exhausted):
- `projects/api`: `some-package@1.2.3` — GHSA-xxxx-yyyy-zzzz (Moderate)
  - Ladder steps tried: (1) `pnpm update` — no newer version, (2) `audit --fix` — no fix available, (3) `--force` — same, (4) next major doesn't exist, (5) no override target, (6) no maintained alternative
  - Evidence: registry shows latest = 1.2.3, no advisory fix listed

**Check Script — Unresolved** (Critical blockers):
- _(none)_
```

### Step 9 — Gating

- All projects GREEN, or only Accepted Residuals remain → continue with the caller's next phase
- Any Unresolved blocker → continue the workflow (so the user still gets review feedback) but list the blockers prominently in the Consolidated Remediation Catalog with Critical priority and surface them in the header status

## Skip Coordination Between Callers

When `/lt-dev:review` delegates a small diff to `lt-dev:code-reviewer`, the orchestrator has already executed this skill in Phase 1.5. To avoid a duplicate run, the orchestrator passes:

> **SKIP running-check-script** — orchestrator already ran it. Pre-computed Check Script Results block:
> `<paste full block from Step 8 verbatim>`

The agent then skips Steps 1–7 and pastes the block verbatim into its report.

## Related Elements

| Element | Relationship |
|---------|--------------|
| **Script**: `scripts/discover-check-scripts.sh` | Discovery helper (Step 1) |
| **Command**: `/lt-dev:review` | Orchestrator caller (Phase 1.5) |
| **Agent**: `code-reviewer` | Single-pass caller (Phase 1.5) |
| **Agent**: `branch-rebaser` | Rebase caller (Phase 6.5) |
| **Agent**: `test-reviewer` | Honors skip semantics from Step 7 |
| **Skill**: `maintaining-npm-packages` | Owns the broader package maintenance ladder; this skill borrows Step 4 from there |
| **Skill**: `rebasing-branches` | Strategy for rebases; defers `check` execution to this skill |
