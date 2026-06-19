---
description: 'Sequential 7-phase production-readiness workflow for lt-stack projects. Phase 1: full test suite (Unit+API+Frontend+Playwright) green with zero skips. Phase 2: flow coverage gap analysis with auto-completion. Phase 3: k6 load test stable for ~10 concurrent users with optimisation ladder. Phase 4: 8-pillar production-readiness audit with auto-remediation. Phase 5: iterative /lt-dev:review until clean. Phase 6: pnpm run check iterate-until-green. Phase 7: local GitLab/GitHub CI pipeline validation. Strict no-skip policy. Configurable --max-iterations cap. Final consolidated report.'
argument-hint: '[--max-iterations=5] [--max-load-vus=10] [--include-soak] [--base=main] [--ci=gitlab|github|both] [--skip-step=N,M] [--phase=N,M]'
allowed-tools: Read, Edit, Write, Grep, Glob, Bash(git:*), Bash(echo:*), Bash(grep:*), Bash(wc:*), Bash(jq:*), Bash(yq:*), Bash(cat:*), Bash(ls:*), Bash(test:*), Bash(command:*), Bash(which:*), Bash(curl:*), Bash(bash ${CLAUDE_PLUGIN_ROOT}/scripts/*), Bash(node:*), Bash(pnpm run check:*), Bash(npm run check:*), Bash(yarn run check:*), Bash(pnpm check:*), Bash(npm check:*), Bash(yarn check:*), Bash(pnpm run lint:*), Bash(npm run lint:*), Bash(yarn run lint:*), Bash(pnpm run typecheck:*), Bash(npm run typecheck:*), Bash(yarn run typecheck:*), Bash(pnpm run build:*), Bash(npm run build:*), Bash(yarn run build:*), Bash(pnpm test:*), Bash(npm test:*), Bash(yarn test:*), Bash(pnpm run test:*), Bash(npm run test:*), Bash(yarn run test:*), Bash(npm run test\:e2e:*), Bash(pnpm run test\:e2e:*), Bash(yarn run test\:e2e:*), Bash(npx playwright:*), Bash(pnpm exec playwright:*), Bash(npx vitest:*), Bash(pnpm audit:*), Bash(npm audit:*), Bash(yarn audit:*), Bash(pnpm update:*), Bash(npm update:*), Bash(yarn upgrade:*), Bash(pnpm add:*), Bash(npm install:*), Bash(yarn add:*), Bash(pnpm install:*), Bash(k6:*), Bash(brew install k6:*), Bash(brew install gitlab-runner:*), Bash(brew install act:*), Bash(gitlab-runner:*), Bash(act:*), Bash(docker:*), Bash(docker compose:*), Bash(docker-compose:*), Bash(lt dev:*), Bash(pkill:*), Bash(pgrep:*), Bash(mkdir:*), Bash(cp:*), Bash(mv:*), Bash(rm:*), Bash(diff:*), Agent, AskUserQuestion, SlashCommand, TodoWrite
disable-model-invocation: true
effort: max
---

# Production Ready

End-to-end production-readiness workflow that gates a release on tests, coverage, load capacity, eight production pillars, code review, runnability, and CI pipeline parity — all locally, in a fixed order, with no skips.

## When to Use This Command

- Final gate before tagging a release / deploying to production
- After completing a major feature where multiple subsystems changed
- Periodic hardening pass (e.g. monthly) on a long-lived project
- After resolving a customer-reported production incident, to prove the fix is durable

## Related Commands

| Command | Purpose |
|---------|---------|
| `/lt-dev:production-ready` | **This command** — full 7-phase production-readiness workflow |
| `/lt-dev:review` | Multi-reviewer code review; runs as Phase 5 of this command |
| `/lt-dev:check` | Runnability-only gate; runs as Phase 6 of this command |
| `/lt-dev:maintenance:maintain-pre-release` | Conservative pre-release dependency cleanup; useful before this command |
| `/lt-dev:backend:test-generate` | Generate backend tests; useful when Phase 2 surfaces gaps |

**Recommended sequence:** `maintain-pre-release` → `production-ready` → tag → deploy

---

## Architecture

This command is the **direct orchestrator**. Plugin sub-agents cannot spawn sub-sub-agents, so the command is the parallelisation / sequencing point.

```
/lt-dev:production-ready (this command)
│
│  Phase 0: Argument parsing, stack detection, TodoWrite scaffold
│
│  Phase 1: Full test suite (Unit + API + Frontend + Playwright)         ──┐
│  Phase 2: Flow coverage gap analysis & completion                        │
│  Phase 3: k6 load test (~10 VUs) + optimisation ladder                   │ All five phases
│  Phase 4: 8-pillar production-readiness audit + auto-remediation         │ delegated to the
│  Phase 6: pnpm run check iterate-until-green                             │ orchestrator agent
│  Phase 7: Local CI pipeline validation                                  ──┘
│
│  Phase 5 (between Phase 4 and Phase 6): /lt-dev:review iterate-until-clean
│         orchestrated DIRECTLY by this command (sub-agent cannot do it)
│
│  Phase 8 (after Phase 7): validating-changes-in-browser skill — final
│         user-eye browser walk with seeded accounts + ship-or-optimize gate
│
└── Final consolidated report
```

Phases run **sequentially** and in the **specified order**. Each phase must reach its terminal verdict before the next starts.

---

## Execution

Parse arguments from `$ARGUMENTS`:

- **`--max-iterations=N`** (default `5`): hard cap on iterate-until-green loops in every phase
- **`--max-load-vus=N`** (default `10`): k6 concurrency target
- **`--include-soak`** (default off): include the 30-minute k6 soak scenario
- **`--base=<branch>`** (default `main`): base for diff and `/lt-dev:review`
- **`--ci=<gitlab|github|both>`** (default detect): which CI system to validate locally
- **`--skip-step=N[,M]`**: bypass listed phases for this run (e.g. `--skip-step=7` when CI cannot be reproduced locally). **Skipped phases are clearly flagged in the final report — they do NOT count as PASS.**
- **`--phase=N[,M]`**: only run the listed phases (advanced; for re-running a single phase after a fix)

### Phase 0 — Setup

1. **Confirm scope with the user before starting** if `--phase` and `--skip-step` were both omitted. Use `AskUserQuestion` to confirm:
   - "About to run all 7 phases. This may take 30–90 minutes depending on project size and the soak scenario. Continue?" with options `Continue` / `Configure` / `Cancel`.
   - If `Configure`, ask for `--max-iterations`, `--include-soak`, and `--ci` overrides.
   - If `Cancel`, exit cleanly.
2. **Detect the stack** (backend / frontend / fullstack) and the package manager.
3. **Scaffold TodoWrite** with the 7 phases (mark skipped phases as `pending` with a clear `(skipped)` suffix in `content`).
4. **Snapshot HEAD** for after-the-fact diff: `git rev-parse HEAD`. Save to scratch.

### Phase 1 — Full Test Suite

Spawn the orchestrator agent for Phase 1 only:

```
Agent tool with subagent_type "lt-dev:production-readiness-orchestrator":

  Phases: 1
  Base: <base-branch>
  Max iterations: <max-iterations>
  Project root: <pwd>
  Strict no-skip: true

  Goal:
  Make every test (Unit + API + Frontend + Playwright) pass with ZERO skips.
  Every it.skip / test.skip / xit / it.todo / @ts-ignore / eslint-disable in test
  files is a blocker. Iterate-until-green per the agent's protocol.

  Return:
  - The Phase 1 report block (canonical format from the agent)
  - List of converted skips
  - List of needs-human residuals (if any)
```

If the agent returns `Verdict: FAIL`, **stop the workflow** and surface the report. Do not proceed to Phase 2 — a project that cannot get its test suite green is not ready for any further hardening work.

### Phase 2 — Flow Coverage

Spawn the orchestrator agent for Phase 2 only. Pass the Phase 1 result as context (specifically: which test buckets passed, which fixtures already exist).

```
Agent tool with subagent_type "lt-dev:production-readiness-orchestrator":

  Phases: 2
  Base: <base-branch>
  Max iterations: <max-iterations>
  Project root: <pwd>

  Goal:
  Identify every flow (backend route / resolver, frontend page journey,
  cross-stack auth / file-upload). For each uncovered flow, write happy-path
  AND primary-error-path tests using the project's existing patterns.
  All newly added tests must pass before the phase exits.

  Return:
  - The Phase 2 report block
  - Coverage matrix with file:line references for added tests
```

### Phase 3 — k6 Load Test

```
Agent tool with subagent_type "lt-dev:production-readiness-orchestrator":

  Phases: 3
  Max iterations: <max-iterations>
  Max load VUs: <max-load-vus>
  Include soak: <include-soak>
  Project root: <pwd>

  Goal:
  Per the running-load-tests-with-k6 skill — install k6 if missing,
  start the API via managing-dev-servers (lt dev up preferred),
  scaffold tests/load/ if missing, run smoke then load (then soak if
  --include-soak). Walk the 9-step optimisation ladder until thresholds
  pass (p95<500ms, error rate<1%, checks>99% at the configured VU target)
  or iterations cap reached. Save baselines under tests/load/baselines/.
  Stop the API server before exiting unless the parent prefers to keep it.

  Return:
  - The canonical Load Test Report block
  - List of optimisation steps applied
  - Baseline regression delta if a prior baseline existed
```

### Phase 4 — Production Readiness Audit

```
Agent tool with subagent_type "lt-dev:production-readiness-orchestrator":

  Phases: 4
  Max iterations: <max-iterations>
  Project root: <pwd>

  Goal:
  Per the validating-production-readiness skill — walk all 8 pillars in order,
  classify findings as Critical / Major / Minor with file:line evidence,
  apply the auto-remediation table where possible, re-check after each fix.
  k6 results from Phase 3 feed Pillar 6 — read the report, do not re-run.

  Return:
  - The canonical Production Readiness Report block
  - Per-pillar verdict and Auto-fixed counts
  - Blocking issues (Critical findings with file:line)
```

If global verdict is `NOT-READY`, **stop the workflow** and surface the report. The user must decide whether to re-run earlier phases after manual fixes.

### Phase 5 — `/lt-dev:review` Iterate-Until-Clean

This phase is orchestrated by the command directly because sub-agents cannot invoke other slash commands.

Loop with `iteration = 1`:

1. Invoke `/lt-dev:review --base=<base-branch>` via the SlashCommand tool. Capture the resulting report.
2. Parse the report for blockers:
   - Any `❌` / `BLOCK` markers in the unified report
   - Any per-reviewer `Critical` or `High`-severity findings still open after Phase 6 of `/lt-dev:review`
   - Any unresolved blockers in the `Action Roadmap`
3. **If clean** (no blockers): record the result and proceed to Phase 6.
4. **If not clean:** read the `Remediation Catalog` from `/lt-dev:review` and apply the proposed fixes by editing the relevant files (use Read + Edit). Apply only the **non-controversial** items (lint/format/type fixes, missing tests, missing docs that the reviewer drafted) — defer architectural recommendations (`needs-human`) to the final report.
5. Increment `iteration`. If `iteration > --max-iterations`, stop with verdict `STALLED` and surface the remaining blockers as needs-human in the consolidated report. Otherwise re-run from step 1.

The expectation: review → apply → review → apply, converging to clean within the iteration cap.

If `SlashCommand` is not available in this runtime, fall back to spawning the same reviewers directly via `Agent` (mirror the parallel pattern from `/lt-dev:review` Phase 3A/3B). This is a degraded mode — record it in the final report.

### Phase 6 — `pnpm run check` Iterate-Until-Green

```
Agent tool with subagent_type "lt-dev:production-readiness-orchestrator":

  Phases: 6
  Max iterations: <max-iterations>
  Project root: <pwd>

  Goal:
  Per the running-check-script skill — discover all check scripts,
  run per project, iterate the auto-fix loop until GREEN or STALLED.
  Apply the audit-finding fix escalation ladder for any audit failures.
  Honour the global --max-iterations as a circuit breaker.

  Return:
  - The skill's Step 8 report block
  - Per-project verdicts
```

If any project ends in `STALLED` with `Unresolved` blockers, **stop the workflow** and surface the report. The check script is the project's runnability oracle; an unrunnable project cannot ship.

### Phase 7 — Local CI Pipeline Validation

```
Agent tool with subagent_type "lt-dev:production-readiness-orchestrator":

  Phases: 7
  Max iterations: <max-iterations>
  CI format: <ci-format>
  Project root: <pwd>

  Goal:
  Per the validating-ci-pipelines-locally skill — detect pipeline format,
  ensure runner toolchain (gitlab-runner / act / docker-compose), parse jobs,
  resolve image+services+vars, execute each job in stage order. For failures,
  walk the remediation table; iterate. Save logs under tmp/ci-local/.

  Return:
  - The canonical Local CI Pipeline Report block
  - Per-job table with verdict and iterations
  - Blocking jobs with root-cause analysis
```

### Phase 8 — Browser Validation Walk

After all seven previous phases reached their terminal verdicts (Phase 1 green, Phase 2 coverage complete, Phase 3 thresholds passed, Phase 4 READY, Phase 5 clean, Phase 6 GREEN, Phase 7 PASS), run the final manual-style browser pass. This is the single phase the user actually walks alongside — the others are automated gates.

Follow the [`validating-changes-in-browser`](${CLAUDE_PLUGIN_ROOT}/../skills/validating-changes-in-browser/SKILL.md) skill end-to-end:

1. The skill boots `lt dev up` (or fallback per `managing-dev-servers`).
2. It seeds `@test.com` accounts covering every role surfaced across Phase 4 (production-readiness audit), Phase 5 (security/backend/frontend review) permission matrices. Builds the account registry — every credential will appear in the final report.
3. It derives a step-by-step test list from the diff `<base>...HEAD` and walks it autonomously via Chrome DevTools MCP. Every step names its account explicitly.
4. Pre-existing issues found during the walk are fixed in the same loop (noted as also-fixed). Stall guard after 3 unsuccessful fix attempts.
5. The skill renders the walked list and closes with its own AskUserQuestion ship-or-optimize gate.

**Phase 8 verdict mapping for the final report:**

- Skill verdict `READY-TO-SHIP` → Phase 8 PASS.
- Skill verdict `OPTIMIZE` → Phase 8 FAIL. The user supplied scope notes. Loop back to Phase 1 with the new scope (counts as one iteration against `--max-iterations`).
- Skill verdict `WAITING-FOR-USER` → Phase 8 PENDING. Stop the workflow. The user will return with a verdict. The final report cannot be emitted yet.
- Skill verdict `CANCELLED` → Phase 8 ABORTED. Surface the skill's closing block. Do NOT emit `READY-FOR-PRODUCTION` global verdict.

If the skill returns `boot_failed` or `stall_guard_triggered`, the global verdict cannot be `READY-FOR-PRODUCTION` — surface the diagnosis and stop.

**Skip rule:** Phase 8 can only be bypassed via `--skip-step=8`. A skipped Phase 8 means the global verdict cannot be `READY-FOR-PRODUCTION` (the no-skip rule from the Behaviour Summary applies here too).

### Final Consolidated Report

Concatenate the Phase 1–8 reports (Phase 5 is the SlashCommand output's executive summary, Phase 8 is the validating-changes-in-browser skill's final block), then emit:

```
# Production Readiness — Final Report

Project: <name>
Stack:   <backend|frontend|fullstack>
Base:    <branch>
HEAD start:  <sha>
HEAD end:    <sha>
Wallclock:   <total time>

| Phase | Verdict | Iterations | Auto-fixed | Needs-human | Skipped? |
|-------|---------|-------------|-------------|--------------|----------|
| 1. Full test suite              | … | … | … | … | no |
| 2. Flow coverage                | … | … | … | … | no |
| 3. k6 load (~<vus> VUs)         | … | … | … | … | no |
| 4. Production readiness         | … | — | … | … | no |
| 5. /lt-dev:review               | … | … | … | … | no |
| 6. pnpm run check               | … | … | … | … | no |
| 7. Local CI pipeline            | … | … | … | … | no |
| 8. Browser validation walk      | … | — | … | … | no |

Global verdict: <READY-FOR-PRODUCTION|NOT-READY|PARTIAL>

Critical blockers (must fix before production):
- <phase> / <pillar or job> / <file:line> — <one-line description>

Needs-human residuals (review and decide):
- <phase> / <pillar or job> / <file:line> — <one-line description>

Recommended next commands:
- /lt-dev:check                            # quick re-validation after fixes
- /lt-dev:review --base=<branch>           # re-run review only
- /lt-dev:production-ready --phase=<N>     # re-run a single phase
```

After printing the report, use `AskUserQuestion` to ask the user whether to:

1. **Address remaining blockers now** — agent applies fixes for the listed needs-human items where feasible
2. **Open tracking tickets** — for each blocker, draft a Linear issue (do not create until user confirms)
3. **Stop here** — user reviews the report and acts manually

This mirrors the closing pattern of `/lt-dev:review`.

---

## Behaviour Summary

- **Strict order**: Phase 1 → 2 → 3 → 4 → 5 → 6 → 7. Skipping the order is not supported (use `--phase=N` to re-run a single phase after a fix).
- **Strict no-skip**: every test skip is a blocker. Convert or escalate, never accept.
- **Hard stops**: Phase 1 FAIL, Phase 4 NOT-READY, Phase 6 STALLED, Phase 7 FAIL → workflow stops, report surfaced, no Phase 5/later runs.
- **Configurable iteration cap**: `--max-iterations` (default 5) applies to every iterate-until-green loop.
- **Long-running tasks**: k6 soak and CI compose runs use `run_in_background: true` inside the agent; the agent polls or waits for the summary file; the agent owns cleanup.
- **No silent skips**: phases bypassed via `--skip-step` are listed as `Skipped? yes` in the final report and the global verdict cannot be `READY-FOR-PRODUCTION` without all 7 phases passing.

## Limitations

- Phase 5 requires the `SlashCommand` tool. If the runtime forbids it, the command falls back to direct Agent spawning of the reviewer set — this is a degraded mode and is recorded in the final report.
- Phase 7 depends on Docker. On machines without Docker, the agent classifies the phase as `BLOCKED — runner toolchain unavailable` and the global verdict cannot be `READY-FOR-PRODUCTION`.
- This command does not deploy. It only proves the project is ready to be deployed.
