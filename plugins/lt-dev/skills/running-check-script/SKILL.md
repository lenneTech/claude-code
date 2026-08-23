---
name: running-check-script
description: 'Single source of truth for running the package.json `check` script. Defines discovery (multi-package monorepo aware), the iterate-until-green auto-fix loop, the mandatory audit-finding escalation ladder, residual classification (Accepted vs Critical), and report formatting. Activates on "check laufen lassen", "pnpm run check", "läuft das noch", and whenever an agent or command must prove runnability before shipping. NOT for general npm package maintenance (use maintaining-npm-packages). NOT for reproducing the CI pipeline (use validating-ci-pipelines-locally).'
user-invocable: false
---

# Running the `check` Script

This skill is the **single source of truth** for executing the `package.json` `check` script in lt-dev workflows. Every reviewer, rebaser, and orchestrator that needs to guarantee project runnability must follow this procedure verbatim — duplicating the rules across agents leads to drift.

> **Goal:** A truly green `check` run (exit 0) is a non-negotiable prerequisite for any review or rebase to be considered complete. The only acceptable residual is an upstream dependency vulnerability where the full fix escalation ladder has been exhausted.

## When to Use This Skill

| Caller | Phase | Trigger | Mode |
|--------|-------|---------|------|
| `/lt-dev:review` | Phase 1.5 | Before spawning any specialized reviewer | Advisory |
| `lt-dev:code-reviewer` | Phase 1.5 | Before single-pass review (skip if orchestrator already ran it) | Advisory |
| `lt-dev:test-reviewer` | (input briefing) | Honors the skip semantics defined here | Advisory |
| `/lt-dev:take-ticket` | STEP 8 | After all test pillars are green | **Blocking** |
| `/lt-dev:git:ship` | STEP 1, STEP 4b | Pre-flight, and after the post-rebase re-verify | **Blocking** |
| `/lt-dev:ticket-cycle` | via take-ticket + git:ship | Whole cycle | **Blocking** |
| `lt-dev:branch-rebaser` | Phase 6.5 | After lint/format, before tests | **Blocking** |

## Caller modes

The procedure is identical in both modes. Only what happens with an unresolved error differs, and that difference is the whole point of the distinction:

- **Advisory** — the caller's job is to *report*. A red `check` is surfaced as a Critical finding and the workflow continues, because the user still wants the rest of the review.
- **Blocking** — the caller's job is to *ship*. A red `check` stops the workflow. Nothing gets pushed, no MR/PR is created, nothing is merged.

**Every path that leads to an MR/PR or a merge runs in Blocking mode.** A red `check` reaching the base branch costs the whole team: CI goes red for everyone, the next `take-ticket` branches off broken code, and the person who eventually fixes it has no idea which change caused it. That is why the ladder in Step 3 has no iteration cap and why Step 5's residual list is as narrow as it is.

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
2. **Fix every error at the root cause** via `Read` + `Edit`. **Pre-existing errors are fixed too** — whether an error came from this diff or was already there makes no difference to whether the project runs, and a red `check` blocks the next person exactly as hard either way. Scope boundaries do not apply to runnability. The one question that decides anything here is "can this be fixed?", and while the answer is yes, it gets fixed.
3. **Re-run `check` from scratch.** Never trust partial state.
4. **Continue iterating** until one of these terminal conditions:
   - **(a) GREEN** — `check` exits 0 → done for this project
   - **(b) STALLED** — a full iteration produced no net reduction in error count
5. **No hard iteration cap.** As long as each iteration strictly reduces the error count, keep going. The goal is true green.

**STALLED is a signal to change approach, not permission to stop.** The count stops falling when the same fix is being retried, so the next iteration has to attack the error differently: read the failing file in full rather than patching around the reported line, check whether two errors share one cause, look at how a working sibling module solves the same thing, run the failing step alone to see output the aggregate run swallowed, check whether it is one of the known hazards in Steps 6.5 to 6.7. Only when a genuinely different approach has been tried and the count still holds does the residual classification in Step 5 apply — and in **Blocking** mode, everything except an exhausted-ladder dependency vulnerability still stops the workflow.

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

### Step 4a — Claim a cross-cutting finding before fixing it

An audit finding is not this branch's problem. It is the repository's, so **every parallel session running `check` sees the same one** and, left alone, every one of them walks the ladder above. That is wasted work in the best case; in the normal case it is four sessions rewriting the same lockfile and four rebase conflicts nobody needed. The same holds for any other finding that belongs to the repo rather than to the diff: a broken CI config, a corrupted lockfile, a broken shared test setup, an audit-level mismatch with CI.

So before starting the ladder on a finding of that kind:

1. **Read the ledger.** `bash ${CLAUDE_PLUGIN_ROOT}/scripts/peer-ledger.sh read` costs nothing and disturbs nobody. It also answers what a message cannot: whether a session that is no longer running already claimed this, and whether somebody already recorded the cause.
   - The finding shows as `[held]` → **do not fix it.** Record it as claimed in the report block and carry on with the rest of `check`.
   - It shows as `[stale]` → the claiming session is gone. Take it over.
   - A `note` already names the cause → start from it instead of diagnosing it again.
2. **Claim it**: `peer-ledger.sh claim "audit:GHSA-xxxx" "<what it moves>"`. The command refuses a topic another live session holds and names that session, so the claim is decided rather than merely announced.
3. **Then `ListAgents`.** A live peer in this repository that is about to run `check` gets one `CLAIM` message on top (format in [`coordinating-peer-sessions`](${CLAUDE_PLUGIN_ROOT}/skills/coordinating-peer-sessions/SKILL.md)). The ledger already covers everyone else, including sessions that start later.
4. **Fix it, then `peer-ledger.sh release`** naming the ticket or commit that carries the fix, so the topic frees up for good rather than only until this session closes.

If a `CLAIM` for the same finding arrives from a peer first, **do not fix it**. Classify it as claimed in the report block, name the peer, and carry on with the rest of `check`. Contest the claim only when you are already mid-ladder on it, and then one of the two backs off; two sessions on one lockfile is the outcome the claim exists to prevent. None of this reaches the user: who fixes a shared finding is coordination, and the ledger settles it.

This does not soften Step 5. A claimed finding is not an Accepted Residual and not a reason to call `check` green: it is still open, it is just open in a different session. If it blocks this branch's gate, the session waits for the peer (one `ASK`, or `notify_when_idle`) rather than fixing it in parallel.

**The other direction is worth more than the claim.** Most `check` failures are the repository's, not the diff's, so the diagnosis you just paid for is one a peer is about to pay for again. When you find the *cause* of something environmental or shared (a shared test database, a toolchain or SWC config, an audit-level mismatch with CI, a `check-server-start` port hazard), record it with `peer-ledger.sh note "<topic>" "cause: … fix: …"` and send one `SOLVED` to any peer live right now. The note is the part that lasts: it turns the next session's half hour into two lines, including a session that starts long after yours has closed. Record the cause, not the symptom.

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

### Step 6.6 — API tests fail only inside `check`? Suspect a shared test database

**Symptom:** `check` fails at `api · test` with one or two failures, but the very same suite is **green when run on its own**, and the failing spec **moves between runs** — a missing admin user in one run, a missing season in the next, always in a `prepare` / `beforeAll` step (`Cannot read properties of null (reading '_id')`, `404` on a record the setup just created).

**This is not flakiness and not load.** It is a second test run — from another working copy — dropping the database out from under this one. The API e2e global setup **drops its database on start**; if two checkouts resolve to the *same* database name, whoever starts second wipes the first one mid-run. Parallel checkouts are routine (`lt ticket` slots, a second clone, another agent session), so this hits often and reads as random.

**Triage, in this order:**

1. Run the failing suite **alone**. Green in isolation + wandering failure inside `check` ⇒ this bug, not a real defect. Do **not** "fix" the spec.
2. Check for a competing run: `ps aux | grep [v]itest`. A run in *another* directory of the same project is the smoking gun.
3. Confirm the database name is shared: it must contain a per-run (or at least per-working-copy) component. A constant like `myproject-e2e` is the bug.

**The fix belongs in the project, not in the spec** — and it very likely already exists upstream. `nest-server` / `nest-server-starter` give every test RUN its own database (`<base>-e2e-run-<timestamp>-p<pid>`, set in `tests/global-setup.ts` before the workers fork) plus a `db-lifecycle.reporter.ts` that drops it on green, keeps it on red for debugging, and collects the leftovers of crashed runs. A project still on a fixed database name has simply not adopted it — **port the base-repo solution rather than inventing a local one** (see the `contributing-to-lt-framework` skill).

Things to preserve when porting:

- **The drop guard.** A test setup that drops "whatever the URI points at" is dangerous, because a running `lt dev` session exports `NSC__MONGOOSE__URI` / `MONGODB_URI` pointing at the **development** database — a suite started in that shell would wipe the developer's data. Refuse to drop any database whose name does not look disposable (`/(e2e|ci|test|acctest)/i`).
- **Derived databases.** A spec that needs its own database must derive it from the run's database (`deriveTestDbUri(...)`), never invent a global name: a fixed name is shared by concurrent runs, and its leftovers are collected by nothing — an aborted run skips the spec's own cleanup, and the databases pile up (one real machine had accumulated ~140).
- **The startup sweep + run governor (11.29.0+).** `tests/global-setup.ts` additionally (a) sweeps stale leftover DBs of this project BEFORE the run (dead-PID/age guarded) — this is what survives SIGKILL and `--reporter` overrides, and (b) acquires a machine-wide e2e slot (`tests/e2e-run-slots.ts`, `<tmpdir>/lt-e2e-run-slots`) so concurrent `check` runs from parallel sessions queue instead of starving each other. **A run printing `[e2e-governor] waiting for a free e2e slot` every 15s is QUEUED, not hung** — do not kill it and do not misread it as a deadlock. The config also drops to low-resource mode (reduced forks) when another run is active.

### Step 6.7 — `api · test` looks deadlocked (0% CPU, no output)? It is usually a retry grind

A spec file whose app/socket state broke (historically: resource starvation from overlapping runs) grinds through `(1+retry)` attempts × `testTimeout` × tests-per-file — with `retry: 5` that was up to an hour at 0% CPU, which the watchdog kills as "workers idle". Base repos now ship `retry: 2` and the run governor removes the starvation trigger. If you still see it: check `pgrep -f vitest` for a single surviving fork at 0% CPU, read which spec file last logged, and re-run that file alone. Never raise `retry` to paper over it.

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

Both modes share the green case and split on the red one:

| Outcome | Advisory caller | Blocking caller |
|---|---|---|
| All projects GREEN | Continue | Continue |
| Only Accepted Residuals (exhausted-ladder dependency CVEs) | Continue | Continue, residuals named in the summary |
| Any Unresolved blocker | Continue the workflow so the user still gets the rest of the review; list the blockers in the Consolidated Remediation Catalog with Critical priority and surface them in the header status | **Stop.** Nothing is pushed, no MR/PR is created, nothing is merged |

**What a Blocking caller does on red:** print which project failed, which errors remain, which fixes were attempted, and which approaches Step 3 already ruled out — then stop and hand it to the user. The branch stays local and intact, so nothing is lost and the work can resume the moment the cause is understood.

The green requirement covers **every** discovered project. A monorepo where `projects/api` is green and `projects/app` is red is red: CI runs both, so shipping on a partial green just moves the failure to the pipeline, where it costs a full round-trip instead of one more local iteration.

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
| **Skill**: `coordinating-peer-sessions` | Claim protocol for cross-cutting findings when parallel sessions share the repo (Step 4a) |
