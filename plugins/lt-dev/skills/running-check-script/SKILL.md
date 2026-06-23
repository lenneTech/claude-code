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
<package.json path>\t<check script>\t<includes_tests:no|unit+api|yes>\t<package manager>
```

`includes_tests` values — callers decide what to do with each, the discovery itself prescribes no behavior:

| Value | Meaning | Playwright coverage |
|-------|---------|---------------------|
| `no` | No test runner detected in the check chain. | Not covered. |
| `unit+api` | The `check` chain delegates to the lt `check.mjs` wrapper, which runs **Unit (app) + API (api)** test steps and **deliberately skips Playwright** (Playwright runs via `lt dev test` / CI — see `scripts/check.mjs`). | **Not covered** — Playwright must still be run separately if needed. |
| `yes` | Direct pattern match on `test`, `vitest`, `jest`, or `playwright` in the check chain (transitively, one level of composite resolution). Scope is whatever the script defines. | Unknown — callers should verify locally if Playwright coverage is required. |

The helper:
- Uses `git ls-files "package.json" "**/package.json"` so it respects `.gitignore` and skips `node_modules`
- Parses JSON via `jq` → `node -e` → `grep+sed` fallback chain (works even without `jq` installed)
- Resolves single-level composite scripts (`"check": "pnpm run ci"` → looks up `ci`)
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

**CI parity — the local audit MUST match the CI security gate.** A project's local `check` may run `pnpm audit` at a *lower* severity threshold (or narrower scope) than the CI gate — e.g. local `pnpm audit --prod --audit-level=critical` while a CI job runs `pnpm audit --prod --audit-level=high` (`allow_failure: false`). A green local `check` then **hides** findings that fail CI: the pipeline goes red on a "pre-existing" HIGH CVE the local loop never even surfaced. **Before trusting a green local `check`, confirm its `--audit-level` and `--prod`/scope match the strictest audit gate in `.gitlab-ci.yml` / `.github/workflows`.** If they diverge, raise the local `check` audit-level to match CI (so the local loop becomes the single source of truth that catches exactly what CI enforces), then run the ladder above on whatever new findings surface. An audit-level mismatch is a silent local↔CI parity bug — never an Accepted Residual.

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
- `it.skip(...)`, `describe.skip(...)`, `test.skip(...)` in test files
- `--passWithNoTests` flags on the test command
- Adding `oxlint-disable` directives to suppress real findings

The ONLY permitted "non-fix" is an upstream dependency vulnerability where the escalation ladder has been fully exhausted. Everything else must be fixed at the root.

### Step 6.5 — `check-server-start.sh` failure modes (Nitro/Nest port hazards)

The starter `check` pipeline ends with `bash scripts/check-server-start.sh`, which boots the production build and waits for the readiness log. Three known failure modes — all surface as the same symptom (`ERR_SOCKET_BAD_PORT` from `node:net`) but have different root causes:

1. **Nitro `PORT`-string bug** (App side): the script must use `NITRO_PORT=$FREE_PORT`, never `PORT=$FREE_PORT`. Some Nitro versions read `process.env.PORT` without `parseInt` and crash; `NITRO_PORT` is the documented Nitro-specific knob, goes through Nitro's own env loader, and is coerced to number reliably. Nest does not have this issue — `NSC__PORT` is fine on the API side.

2. **lerna/nx ANSI-injection** (BOTH api and app, only when `check` is invoked from a workspace runner): the runner wraps subprocess stdout and may inject ANSI color escape sequences (`\x1b[33m...\x1b[39m`) into command output. A naive `FREE_PORT=$(node -e "...console.log(p)")` captures the codes too. **A naive `tr -cd '0-9'` makes it worse** — the codes contain digits (33, 39) themselves, producing nonsense ports like 335454639. The only correct fix is to strip the ANSI sequence pattern explicitly with `sed`:
   ```bash
   FREE_PORT=$(node -e "..." | sed $'s/\x1b\\[[0-9;]*m//g' | tr -d '[:space:]')
   ```

3. **Phantom Unix-domain-sockets** named `[33m12345[39m` next to the package.json (mode `srwx`): leftover from earlier failed runs. When Nest's port-parser fell through "string with weird chars" → "treat as Unix socket path", it actually bound a socket file. `cleanup()` SIGTERM kills the process, the file stays. Delete with:
   ```bash
   rm -f $'\x1b[33m'*$'\x1b[39m'
   ```
   Then re-run `check`.

These hazards are documented in detail in the `modernizing-toolchain` skill (Phase 6). When a `check` run fails with `ERR_SOCKET_BAD_PORT`, the first triage step is to confirm the script in question already has both the `NITRO_PORT` and ANSI-strip fixes applied.

### Step 7 — Test-duplication avoidance

Tests must not run twice if `check` already covered them on an unchanged working tree.

After each project completes Step 3 with a GREEN result, record a **post-check baseline**:

```bash
git -C <project-dir> rev-parse HEAD                 # commit baseline
git -C <project-dir> status --porcelain             # working-tree baseline
```

A subsequent test phase (e.g. `branch-rebaser` Phase 7, `code-reviewer` Phase 5, `test-reviewer`) may **skip** running tests for a project when ALL of the following hold:

1. The discovery output marked the project's `check` as covering the test category in question (see table below)
2. The project ended Step 3 in GREEN status (or YELLOW with only Accepted Residuals)
3. `git rev-parse HEAD` matches the baseline (no new commits)
4. `git status --porcelain` matches the baseline (no working-tree changes since)

Skip eligibility per `includes_tests` value:

| `includes_tests` | Unit/API test phase | Playwright/E2E test phase |
|------------------|---------------------|---------------------------|
| `no` | Run normally | Run normally |
| `unit+api` | Skip-eligible (conditions 2–4 still apply) | **Run normally — `check.mjs` does not execute Playwright** |
| `yes` | Skip-eligible (conditions 2–4 still apply) | Skip-eligible **only if** the caller has independently verified Playwright is part of the project's `check` chain; otherwise run normally |

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
