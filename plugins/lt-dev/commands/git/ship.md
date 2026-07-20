---
description: Ship the current feature branch into dev — pre-flight check, commit, rebase, test, check, MR/PR, Linear comment + "Dev Review" + unassign, wait for CI, merge (squash for feature branches, regular merge when promoting a base branch into a higher base branch), delete branch. Auto-retries on pipeline failure.
argument-hint: "[--base=<branch>] [--max-pipeline-retries=<n>] [--no-squash] [--keep-branch]"
allowed-tools: Agent, Read, Grep, Glob, Write, Edit, AskUserQuestion, TodoWrite, Bash(git:*), Bash(gh:*), Bash(glab:*), Bash(echo:*), Bash(ls:*), Bash(cat:*), Bash(grep:*), Bash(jq:*), Bash(test:*), Bash(sleep:*), Bash(bash ${CLAUDE_PLUGIN_ROOT}/scripts/*), Bash(node:*), Bash(pnpm run check:*), Bash(npm run check:*), Bash(yarn run check:*), Bash(pnpm check:*), Bash(npm check:*), Bash(yarn check:*), Bash(pnpm run test:*), Bash(npm run test:*), Bash(yarn run test:*), Bash(pnpm test:*), Bash(npm test:*), Bash(yarn test:*), Bash(pnpm run lint:*), Bash(npm run lint:*), Bash(yarn run lint:*), Bash(pnpm run typecheck:*), Bash(npm run typecheck:*), Bash(yarn run typecheck:*), Bash(pnpm run build:*), Bash(npm run build:*), Bash(yarn run build:*), Bash(pnpm install:*), Bash(npm install:*), Bash(yarn install:*), Bash(npx playwright:*), Bash(pnpm exec playwright:*), mcp__plugin_lt-dev_linear__get_issue, mcp__plugin_lt-dev_linear__list_comments, mcp__plugin_lt-dev_linear__save_comment, mcp__plugin_lt-dev_linear__save_issue, mcp__plugin_lt-dev_linear__list_issue_statuses
disable-model-invocation: true
---

# Ship Feature Branch to Dev

## When to Use This Command

- Implementation is finished locally and you want the branch landed in `dev` without manual hand-holding
- You want auto-retry if the remote CI pipeline fails (re-rebase + re-push + re-wait)
- You want squash-merge + branch cleanup automated, with a safety prompt before the irreversible step

This command is the **closing bookend** to `/lt-dev:take-ticket`. It does **not** create MRs/PRs with Linear integration — for that, use `/lt-dev:dev-submit` instead (or run it before this command). This command focuses on the **landing pipeline**.

## Related Commands

| Command | Purpose |
|---------|---------|
| `/lt-dev:ticket-cycle` | Full orchestrator: `take-ticket` → this command in one shot |
| `/lt-dev:take-ticket` | Pick + implement + test a ticket (the typical predecessor) |
| `/lt-dev:check` | Standalone check-script runner (used internally by Phase 1) |
| `/lt-dev:git:rebase` | Standalone rebase onto dev (used internally by Phase 3) |
| `/lt-dev:git:create-request` | Standalone MR/PR creation (used internally by Phase 6) |
| `/lt-dev:dev-submit` | MR/PR + Linear comment + Linear status → "Dev Review" (no merge, no pipeline wait) |

**Difference vs. `/lt-dev:dev-submit`:** `dev-submit` hands off to a human reviewer. `ship` lands the branch into dev autonomously after CI is green.

---

## Argument Parsing

Parse `$ARGUMENTS` for these optional flags:

| Flag | Meaning | Default |
|------|---------|---------|
| `--base=<branch>` | Target branch | auto-detect: `dev` → `develop` → `main` → `master` |
| `--max-pipeline-retries=<n>` | Max full retry cycles if CI fails | `3` |
| `--no-squash` | Force a regular merge instead of squash (feature source only; a base-branch promotion is always a regular merge regardless) | squash for feature sources |
| `--keep-branch` | Don't delete feature branch after merge | delete enabled |
| `--auto-merge` | Skip the STEP 8 confirmation prompt — squash-merge as soon as CI is green | off (always asks) |
| `--skip-reanalysis` | Skip STEP 1.5 ticket re-analysis (use when called from an orchestrator that already did it) | off |

---

## STEP 0 — Bootstrap

1. Capture `SOURCE_BRANCH = git branch --show-current` — the branch being shipped. Later steps refer to it as `FEATURE_BRANCH` (same value); the name reflects the common case — in **promotion mode** it holds a base branch.
2. **Classify the source and derive `MERGE_MODE`.** This is the guard that keeps a base branch from ever being squashed.

   - **Base-branch set:** `dev`, `develop`, `test`, `staging`, `main`, `master`.
   - **Promotion order (rank):** `dev`/`develop` = 1 → `test`/`staging` = 2 → `main`/`master` = 3.

   **a. `SOURCE_BRANCH` is NOT in the base set → feature mode** (normal case):
   - `MERGE_MODE = squash` (or `regular` if `--no-squash` was passed).
   - Resolve `BASE_BRANCH` via auto-detect (`dev` → `develop` → `main` → `master`; `--base` overrides). Probe each with `git rev-parse --verify origin/<name>`.

   **b. `SOURCE_BRANCH` IS in the base set → promotion mode** (base → higher base, e.g. `dev`→`test`, `test`→`main`):
   - `MERGE_MODE = regular` — **forced. A base branch is NEVER squashed** (squashing `dev` into `test` would collapse dev's entire history into one commit and permanently diverge the branches). `--no-squash` is implied; ignore any squash intent.
   - Resolve `BASE_BRANCH` as a **strictly higher-rank base branch**: an explicit `--base` wins but must be in the base set and satisfy `rank(BASE_BRANCH) > rank(SOURCE_BRANCH)`; otherwise auto-select the next existing higher-rank base (`test`/`staging`, then `main`/`master`). If no valid higher base exists (e.g. on `main`) or the target is not higher-rank, **abort** with a helpful message.
   - Promotion mode applies the **Promotion-Mode step overrides** (next section): the base source branch is never rebased, force-pushed, or deleted.
3. Detect Git provider via `git remote get-url origin`:
   - Contains `github.com` → `gh`
   - Else → `glab` (GitLab)
   - If neither CLI is installed, abort and tell the user which CLI to install.
4. Create TodoWrite plan with the 12 phases below (STEPs 0–11 plus STEP 1.5; STEP 1 = pre-flight check, STEP 1.5 = ticket re-analysis, STEP 10 = post-merge Linear handoff, STEP 11 = summary).

---

## Promotion Mode — Step Overrides (base branch → higher base branch)

Applies **only** when STEP 0 classified the run as **promotion mode** (`SOURCE_BRANCH` is a base branch, `MERGE_MODE = regular`). A base branch must never be rebased, rewritten, force-pushed, squashed, or deleted, so these steps change:

- **STEP 1.5 (ticket re-analysis):** skipped — a base-branch promotion has no originating ticket.
- **STEP 2 (commit local work):** a base branch must be clean. If `git status --porcelain` is non-empty, **abort** and surface the changes — never auto-commit onto a base branch. Only ensure `SOURCE_BRANCH` is in sync with `origin/<SOURCE_BRANCH>`.
- **STEP 3 + STEP 5 (rebase + force-push):** **skipped entirely.** Never rebase a base branch onto its target or force-push it. Just `git fetch origin --prune` and confirm the source is current. The promotion is validated by the MR pipeline (STEP 7), not a local re-test.
- **STEP 4 (tests):** the rebase-gated re-test does not apply — the commits being promoted were already validated when their own feature MRs landed; CI (STEP 7) is the gate.
- **STEP 6 (MR):** create the `SOURCE_BRANCH → BASE_BRANCH` MR/PR as usual.
- **STEP 8 (merge):** regular merge (`MERGE_MODE = regular`) — **never `--squash`, never `--remove-source-branch` / `--delete-branch`.**
- **STEP 9 (cleanup):** do **not** delete `SOURCE_BRANCH`. Checkout `BASE_BRANCH` and `git pull --ff-only`. `--keep-branch` is implied.
- **STEP 10 (Linear handoff):** skipped — no ticket.

All other steps (STEP 1 pre-flight check, STEP 7 CI wait, STEP 11 summary) run unchanged.

---

## STEP 1 — Pre-Flight `check` Script (BLOCKING GATE)

**Before `ship` touches anything else**, the project's `check` script must pass cleanly. The whole landing pipeline relies on a known-good baseline; without it, every later failure becomes ambiguous (was it the rebase? the new commit? the existing drift?).

### 1a. Discover

Use the `running-check-script` skill to discover every `package.json` `check` script in the repo (monorepo-aware).

**If no `check` script exists anywhere**, log `No check script defined — STEP 1 skipped` and continue directly to STEP 2. Do not invent one.

### 1b. Run

For every discovered project, run `<pm> run check`:

- pnpm preferred per project's lockfile (`pnpm-lock.yaml`)
- fall back to npm (`package-lock.json`) or yarn (`yarn.lock`)

### 1c. Iterate-Until-Green

Follow the `running-check-script` skill verbatim:

- Iterate-until-green with the mandatory 6-step audit-finding escalation ladder.
- No bypasses (`--no-verify`, `@ts-ignore`, `eslint-disable`, etc.).
- Classify residuals into Accepted vs Critical.

### 1d. Outcome

- **Green** (possibly with accepted residuals documented): continue to STEP 2.
- **Critical blocker remains:** abort the whole ship workflow. Print a structured diagnosis (which project, which error, which fix attempts ran). Recommend `/lt-dev:check` to drill in. Do **not** proceed to commit/rebase/MR/PR.

This phase is **non-skippable** — it runs even when the working tree is dirty, because `check` is expected to run against the current local state, and unfixable drift must surface here, not three phases deeper.

## STEP 1.5 — Ticket Re-Analysis vs. Branch State

Before any push or MR/PR work, verify the branch actually delivers what the originating ticket asked for. Skipped if `--skip-reanalysis` is passed (typical when invoked from `/lt-dev:ticket-cycle` which already re-analysed in `take-ticket` STEP 9).

### 1.5a. Resolve Linear Issue ID

Extract the Linear identifier from `FEATURE_BRANCH`:

- Pattern: prefix-digits after stripping the leading `feature/` segment (e.g. `feature/svl-123-...` → `SVL-123`).
- Uppercase the prefix.

If extraction fails OR the branch has no Linear identifier (e.g. ad-hoc refactor branch), log `No Linear ticket linked — STEP 1.5 skipped` and continue to STEP 2.

### 1.5b. Fetch Ticket + Diff

- `mcp__plugin_lt-dev_linear__get_issue` for title, description, ACs.
- `mcp__plugin_lt-dev_linear__list_comments` for additional requirements posted after creation.
- `git log --oneline $BASE_BRANCH..HEAD` and `git diff --stat $BASE_BRANCH..HEAD` for what the branch actually contains.

### 1.5c. Coverage Verdict

For each acceptance criterion in the ticket, decide a verdict (done / partial / missing) based on commit messages, diff stat, and (when ambiguous) opening the relevant files.

Also re-check:

- **Permission matrix** — does the diff include role-aware tests for every touched protected endpoint or UI affordance? (grep changed files for `@Restricted`, `@Roles`, `securityCheck`, role-aware Playwright tests.)
- **Mitgenommene Änderungen** — diff contains files / routes not mentioned in the ticket. Note them; they end up in the MR description.

### 1.5d. User Gate

If any AC is `missing` or `partial` without justification, print a compact German status block and ask via `AskUserQuestion`:

- Question: "Vor dem Ship: <n> AKs sind noch offen oder unvollständig. Wie weiter?"
- Options:
  1. "Zurück zur Implementierung — Ship abbrechen" → exit cleanly so the user can finish in `take-ticket` (or manually).
  2. "Trotzdem shippen — bewusste Scope-Reduktion" → user must provide a one-line justification, which is appended to the MR description body and to the Linear comment in STEP 10. Continue to STEP 2.
  3. "Ich prüfe noch manuell" → pause until user confirms continuation.

If all ACs are satisfied, log `All acceptance criteria satisfied — proceeding` and continue to STEP 2.

---

## STEP 2 — Commit & Push Local Work

1. Run `git status --porcelain`.
2. **If there are uncommitted changes:**
   - Ask via `AskUserQuestion`:
     - Show the list of changed files.
     - Option 1: "Automatisch committen & pushen" — proceed below
     - Option 2: "Ich committe selbst" — pause, then re-check
     - Option 3: "Abbrechen"
   - On Option 1:
     - `git add -A`
     - Generate a concise commit message from the diff. Prefix with the Linear identifier if the branch name carries one (e.g. `svl-123-...` → `SVL-123: <summary>`).
     - `git commit -m "<message>"`
3. **Check unpushed commits:** `git log @{upstream}..HEAD --oneline 2>/dev/null` (or compare against the would-be upstream if no upstream is set).
4. **If there are unpushed commits or no upstream:**
   - `git push -u origin "$FEATURE_BRANCH"`

After this phase, the local branch state must equal `origin/$FEATURE_BRANCH`.

---

## STEP 3 — Rebase onto `origin/$BASE_BRANCH`

1. `git fetch origin --prune`
2. Capture pre-rebase commit: `PRE_REBASE_SHA = git rev-parse HEAD`
3. Capture pre-rebase diff hash: `PRE_REBASE_DIFF = git rev-parse HEAD:` (tree hash)
4. Spawn the **`branch-rebaser` agent** via the Agent tool with:
   ```
   Rebase the current branch onto <BASE_BRANCH>.

   Parameters:
   - branch: <FEATURE_BRANCH>
   - base: <BASE_BRANCH>
   - mode: single
   - project-path: <cwd>

   Execute the full rebase workflow (Phases 0-10). Handle conflicts using Linear context if available. Do NOT push at the end — the parent command handles pushing.
   ```
5. If the agent reports unresolved conflicts → abort and surface its report.
6. After the agent returns, capture `POST_REBASE_TREE = git rev-parse HEAD:`.
7. Compute `REBASE_CHANGED_TREE = (PRE_REBASE_DIFF != POST_REBASE_TREE)` — true if the rebase actually altered the working tree (not just rewrote authors/dates).

---

## STEP 4 — Tests & Check (only if the rebase changed the tree)

**If `REBASE_CHANGED_TREE` is false AND we are not in a pipeline-retry iteration**, skip to STEP 5 directly — there is nothing to re-test (STEP 1's green check is still valid).

Otherwise run the full quality loop, same rules as `/lt-dev:take-ticket` STEPs 7-8:

### 4a. Full Test Suite — Three Pillars, Iterate Until Green

The full test pipeline has **three pillars** — all must be fully green, no skips, no flakes. Anything skipped or papered-over hides regressions and breaks the remote CI in STEP 7.

**Discover and bucket scripts** across every `package.json`:

- **Unit:** `test`, `test:unit`, `test:cov`, `vitest`, `jest` (without `e2e`/`integration` suffix). Typically backend `src/` and frontend `app/`.
- **API / Integration:** backend `test:e2e`, `test:integration`, `test:api`, `test:stories` — anything that exercises the API surface (REST/GraphQL) against a running test instance.
- **Frontend E2E:** frontend `test:e2e`, `e2e`, `playwright`, `pw`, `pw:e2e` — Playwright suites in `tests/` / `tests/e2e/` / `e2e/`.

**Disambiguate `test:e2e`** by inspecting the script body, presence of `playwright.config.ts`, and directory location. Backend `test:e2e` and frontend `test:e2e` are different pillars even though they share a script name.

Run in order: **1. Unit → 2. API / Integration → 3. Frontend E2E.**

**Pre-Run Skip & Flake Audit** (before invoking any script):

```bash
grep -rnE '\.(skip|todo|only)\b|\b(xit|xdescribe|test\.skip|it\.skip|describe\.skip|fdescribe|fit)\b' --include='*.ts' --include='*.tsx' --include='*.spec.*' --include='*.test.*'
grep -rnE 'retries\s*:\s*[1-9]|test\.retry|retry\s*\(' --include='*.ts' --include='*.tsx' --include='*.config.*' --include='*.spec.*'
```

Any hit introduced on this branch is a blocker — remove it.

**Hard rules during the fix loop:**

- **No skips.** No `test.skip` / `xit` / `xdescribe` / `.todo` / `.only` to silence failures.
- **No flaky retry-hiding.** A test that needs `retries: N` to pass is broken — fix the root cause.
- **No try-catch swallow in tests.** No timeout-tweaks to dodge a real assertion.
- **Pre-existing failures are blockers too** — fix them; never accept "war schon kaputt".
- **Termination:** all three pillars exit 0 **and** no test reports as SKIPPED/PENDING.
- For **Frontend E2E**: by default run only the **new + affected** specs (`lt dev test -- <spec>` / `scripts/e2e-fast.sh -- <spec>`) — the full Playwright suite is slow and runs in **CI**; run the full local suite only when the user explicitly asks. Follow `managing-dev-servers` — for lt-projects use `lt dev test` (isolated parallel stack on a dedicated `<slug>-test` DB, auto-teardown, never touches dev data); for non-lt-projects `run_in_background: true` + `pkill` after (never orphan dev servers). Run in the same headless mode CI uses for local/CI parity.
- For **Backend** tests: `NODE_ENV=e2e` (local) — never `NODE_ENV=test` (customer stage).
- **Stall guard:** if 3 full pipeline iterations don't converge on the same failure, stop and surface a structured diagnosis instead of looping forever.

If the project has **no frontend**, Pillar 3 is naturally empty — fine. If the project **has a frontend but no Playwright tests** and the diff touches `app/`, surface that gap and ask the user whether to add E2E coverage before continuing.

### 4b. Check Script — Iterate Until Green

**Runs only after STEP 4a reports all three test pillars fully green.** The `check` script is the secondary safety net (typecheck / lint / build / audit) — never a substitute for tests.

Use the `running-check-script` skill verbatim:

- Discover all `check` scripts (monorepo-aware) across every detected project.
- Run `<pm> run check` (pnpm preferred per project's lockfile; fall back to npm/yarn).
- Iterate-until-green with the mandatory 6-step audit-finding escalation ladder.
- No bypasses (`--no-verify`, `@ts-ignore`, `eslint-disable`, etc.).
- **If `check` introduces auto-fixes** (lint/format/dedupe), re-run STEP 4a's three pillars to confirm the auto-fixes didn't break a test.
- **If no `check` script** exists anywhere, log `No check script defined — skipping STEP 4b` and continue. Do not invent one.

---

## STEP 5 — Commit & Push Any New Changes

1. Re-run `git status --porcelain`.
2. **If new uncommitted changes exist** (from Phase 4 fixes):
   - `git add -A`
   - `git commit -m "chore: post-rebase fixes (tests + check)"` — or a more specific message if the changes are obviously scoped (e.g. "fix: failing API test for X").

   > ⚠️ **The `check` script auto-fixes format/lint in the WORKING TREE, not in the commit.** If the check ran *after* the commit was created (typical post-rebase order), its formatter fixes are sitting uncommitted — pushing without this `git status` sweep ships the unformatted commit and the remote `lint` job fails on `format:check` (seen live: oxfmt fix left in the tree, CI red on exactly one file). This step is therefore MANDATORY after every check run, not optional.
3. **Push with force-lease** (the rebase rewrote history, so a plain push will be rejected):
   - `git push --force-with-lease origin "$FEATURE_BRANCH"`
   - **NEVER** `--force` plain. `--force-with-lease` aborts if remote moved unexpectedly (someone else pushed).
4. If `--force-with-lease` is rejected → surface to user, do **not** retry with `--force`.

---

## STEP 6 — Create MR/PR (or Reuse Existing)

### 6a. Detect Existing MR/PR

- **GitHub:** `gh pr list --head "$FEATURE_BRANCH" --base "$BASE_BRANCH" --json number,url,state --jq '.[0]'`
- **GitLab (jq-safe — never pipe `glab mr list --output json` to `jq`):** take the iid from the line-based **text** output, which cannot break on a description's control chars:

  ```bash
  # First `!<iid>` token in the text listing; empty ⇒ no open MR → STEP 6b:
  REQUEST_ID=$(glab mr list --source-branch "$FEATURE_BRANCH" --target-branch "$BASE_BRANCH" | grep -oE '![0-9]+' | head -1 | tr -d '!')
  # URL comes from the text view (never `--output json | jq`):
  [ -n "$REQUEST_ID" ] && REQUEST_URL=$(glab mr view "$REQUEST_ID" | awk -F'[[:space:]]*:[[:space:]]*' 'tolower($1) ~ /url/ {print $2; exit}')
  ```

  > ⚠️ Piping `glab mr list --output json` to `jq` aborts if **any** listed MR's `description` / `title` carries literal control chars (raw newlines, emoji from a multi-line body) → empty → silently reads as "no existing MR" → a **duplicate** MR gets created. Same class of bug as STEP 7a; the text listing is control-char-safe.

Store as `REQUEST_URL` and `REQUEST_ID`.

### 6b. If No Open Request Exists

Delegate to the `/lt-dev:git:create-request` command's own STEP 1-4 logic (provider detection already done; target branch is `$BASE_BRANCH`). Capture `REQUEST_URL` and `REQUEST_ID` from the created MR/PR.

**Title:** derive from branch name + Linear ID + ticket title (fetch via `mcp__plugin_lt-dev_linear__get_issue` if the branch carries a Linear identifier).

**Body:** generate from `git log $BASE_BRANCH..$FEATURE_BRANCH --oneline` + `git diff $BASE_BRANCH..$FEATURE_BRANCH --stat`. Keep it concise — this is the landing PR, not a human review (use `/lt-dev:dev-submit` for that).

---

## STEP 7 — Wait for CI Pipeline, Retry on Failure

Counter: `PIPELINE_ATTEMPT = 1`. Cap: `MAX = --max-pipeline-retries` (default 3).

### 7a. Wait

- **GitHub:**
  ```bash
  gh pr checks "$REQUEST_ID" --watch --required
  ```
  This blocks until all required checks finish. Exit code 0 → pass; non-zero → at least one check failed.

- **GitLab:**

  > ⚠️ **Never pipe `glab mr view` / `glab mr list --output json` to `jq` when polling.** glab serialises the MR `description` / `title` with **literal control characters** (raw newlines, emoji from a multi-line body); `jq` then aborts with `Invalid string: control characters from U+0000 through U+001F must be escaped`, the command substitution yields an **empty** string, and a poll that reads empty as "still running" loops **blind** — indistinguishable from a running pipeline — until its cap is hit. Derive state from an endpoint that carries **no free-text field**: the MR's *pipelines* list and the *pipeline* object.

  ```bash
  # Pipeline id from the pipelines endpoint (no description → jq-safe):
  PIPELINE_ID=$(glab api "projects/:id/merge_requests/$REQUEST_ID/pipelines" | jq -r '.[0].id')

  # Poll the pipeline object (jq-safe) until a terminal state — fail loud on empty:
  while :; do
    S=$(glab api "projects/:id/pipelines/$PIPELINE_ID" | jq -r '.status // empty')
    case "$S" in
      success)                  echo "pipeline green"; break ;;
      failed|canceled|skipped)  echo "pipeline $S"; break ;;   # → STEP 7b
      "")                       echo "WARN: empty pipeline status — retry, do NOT treat as running" ;;
      *)                        : ;;                            # running/pending/created → keep waiting
    esac
    sleep 30
  done
  ```
  `glab ci status --live` MAY be used for interactive watching, but the **pipeline id it needs must come from the pipelines endpoint above, never from `glab mr view --output json | jq`.** The poll MUST exit on **every** terminal state (`success` / `failed` / `canceled` / `skipped`) and treat an empty / parse-failed read as a transient retry, **never** as "still running".

  **Watch-loop hygiene (hard rules — each one has bitten in production):**

  1. **Verify the probe ONCE in the foreground before arming any background wait.** Run the exact status command interactively and confirm it prints a real state (`running`/`pending`). A probe with a broken inline parser (typo'd `node -e` one-liner, wrong jq path) yields an empty string on every iteration — the loop never breaks, never reports, and a FAILED pipeline sits undetected until the watch times out. `jq -r '.status // "poll-error"'` only, never hand-rolled `node -e` JSON parsing.
  2. **The watch must EMIT on every terminal state immediately, not only report at loop end.** A `for i in $(seq …)`-style wait that only `echo`s after the loop delivers the verdict at timeout in the failure case. Structure the watch so `failed`/`canceled`/`skipped` terminates it just as fast as `success` (the loop in the snippet above does this; keep that shape).
  3. **After every force-push, re-resolve the pipeline id from `glab api "projects/:id/merge_requests/$REQUEST_ID"` → `.head_pipeline.id`** — the amended SHA gets a NEW pipeline, the old id keeps reporting the stale (failed) run, and `glab ci list` can lag behind the API. Also **re-arm auto-merge** (`glab mr merge … --auto-merge`) after the new pipeline is `running`: a force-push can drop the previous arming.
  4. **Check back on the FIRST early jobs (~2–5 min in), not only at the projected end.** `lint`/`format:check` fail within minutes; discovering that after a 35-minute full-suite wait costs a whole cycle.

### 7b. On Failure

1. Fetch the failed-job logs:
   - GitHub: `gh run view <run-id> --log-failed` for each failed check run.
   - GitLab: `glab ci trace <job-id>` for each failed job.
2. Diagnose: is it a real code failure or an infra flake (runner unavailable, cache miss, network)?
3. **Infra flake** (user confirmation required): ask the user via `AskUserQuestion` whether to re-run the pipeline without code changes.
   - On approve: GitHub `gh run rerun <run-id> --failed`; GitLab `glab ci retry`.
   - Wait again (step 7a).
4. **Real failure:** loop back to **STEP 3** (re-rebase to pick up any new dev commits, then re-run tests + check + push). Increment `PIPELINE_ATTEMPT`.

### 7c. Cap Exhausted

If `PIPELINE_ATTEMPT > MAX`:
- Print a structured diagnosis: which checks failed, latest log excerpt, recommended manual next step.
- **Do not** proceed to merge.
- Exit.

---

## STEP 8 — Merge (Squash or Regular, per `MERGE_MODE`)

**This is the irreversible step.** It runs only **after STEP 7 confirmed the pipeline is green** — the merge command below is a plain merge of an already-validated MR, never a "merge when it eventually passes". The merge verb is `MERGE_MODE` from STEP 0: `--squash` for a feature source, a **regular merge** for a base→higher-base promotion — a base branch is never squashed.

> ⚠️ **GitLab: never arm the native `--auto-merge` (merge-when-pipeline-succeeds) on a pipeline that is still `pending`.** `glab mr merge --auto-merge` only *arms* auto-merge while a pipeline is actively `running`; on a freshly-created `pending` pipeline it prints `! No pipeline running on <branch>` and **merges IMMEDIATELY** — the MR lands before CI runs, and the full pipeline then executes **post-merge on the base branch** (observed live on SVL: an MR armed with `--auto-merge` on a `pending` pipeline merged at once, and `api:test`/`app:test` ran on `dev` afterwards instead of gating the merge). This command sidesteps the trap by design: STEP 7 **polls the pipeline to `success` first**, then STEP 8 does a **plain `glab mr merge` (with `--squash` only for a feature source) without `--auto-merge`**. Do NOT shortcut STEP 7 by arming glab's native auto-merge on a fresh pipeline. If you use native auto-merge at all, poll until the pipeline status is `running` (not `pending`) before arming, and re-arm after any force-push (STEP 7a hygiene rule 3).

Behaviour depends on this command's `--auto-merge` flag (which only skips the STEP 8 confirmation prompt — it does **not** mean "hand the merge to glab's native merge-when-pipeline-succeeds"):

- **With `--auto-merge`:** skip the prompt and proceed directly to the merge below. The flag is a one-time, explicit user opt-in (set per invocation); it is **never** the default.
- **Without `--auto-merge`** (default): ask via `AskUserQuestion`:

```
"Pipeline ist grün. Wie willst du mergen?"
  Options:
    1. "Squash + Merge jetzt ausführen"           (default)
    2. "Jedes weitere Mal automatisch mergen sobald Pipeline grün ist"
       → user is confirming auto-merge for THIS run only; equivalent to having
         passed --auto-merge from the start. Note this for the summary so the
         user remembers what they opted into.
    3. "Ich merge selbst im Web"  → exit with REQUEST_URL printed
    4. "Abbrechen"
```

Either branch ends with the same merge command below.

On Option 1 — perform the merge. The merge verb comes from `MERGE_MODE` (STEP 0): **`squash` for a feature source, `regular` for a base→higher-base promotion — a base branch is never squashed.**

- **GitHub** (`--squash` when `MERGE_MODE = squash`, `--merge` when `regular`):
  ```bash
  gh pr merge "$REQUEST_ID" --squash --delete-branch --subject "<commit-subject>" --body "<commit-body>"   # feature source
  # promotion (MERGE_MODE = regular): gh pr merge "$REQUEST_ID" --merge --subject "…" --body "…"   (NO --delete-branch)
  ```
  - `--delete-branch` deletes both the remote feature branch and (after local `git fetch --prune`) the remote-tracking ref.
  - **Omit `--delete-branch` in promotion mode** (never delete a base branch) or when `--keep-branch` was given.

- **GitLab** (`--squash` when `MERGE_MODE = squash`; omit it when `regular` — GitLab's default is a merge commit):
  ```bash
  glab mr merge "$REQUEST_ID" --squash --remove-source-branch --yes                # feature source
  # promotion (MERGE_MODE = regular): glab mr merge "$REQUEST_ID" --yes             (NO --squash, NO --remove-source-branch)
  ```
  - **Omit `--remove-source-branch` in promotion mode** or when `--keep-branch` was given.

`--no-squash` sets `MERGE_MODE = regular` for a feature source too; promotion mode is always `regular` regardless of flags.

**Commit message for the squash:** derive from MR/PR title + body. Prefix with the Linear ID if present.

---

## STEP 9 — Local Cleanup

1. `git checkout "$BASE_BRANCH"`
2. `git pull --ff-only origin "$BASE_BRANCH"` — confirms the merge landed.
3. **Verify the merge actually happened** via `git log --oneline -1 -- ` to see the new commit, or `gh pr view "$REQUEST_ID" --json state --jq .state` (must be `MERGED`).
4. **In promotion mode (base source), never delete `SOURCE_BRANCH`** — skip this whole step regardless of `--keep-branch`; a promoted base branch keeps living. Otherwise, if `--keep-branch` was NOT given:
   - `git branch -D "$FEATURE_BRANCH"` (local hard-delete; safe because it's already merged into base via squash).
   - The remote branch is already deleted by Phase 8.
   - `git fetch --prune` to clean up stale remote-tracking refs.

## STEP 10 — Linear: Comment + "Dev Review" + Unassign (post-merge)

This phase mirrors `/lt-dev:dev-submit` and runs **only after a successful merge into `$BASE_BRANCH`**. "Dev Review" here means functional / QA review on the dev deployment, not code review of an open MR/PR. Skipped automatically if no Linear identifier can be resolved.

### 10a. Resolve Linear Issue ID

Try to extract the Linear identifier from `FEATURE_BRANCH` (captured at STEP 0, still in memory even though the branch is gone):
- Pattern: `<prefix>-<digits>` after stripping the leading `feature/` segment (e.g. `feature/svl-123-...` → `SVL-123`, `feature/lin-42-foo` → `LIN-42`).
- Uppercase the prefix.

**If extraction fails:**
- Ask the user via `AskUserQuestion`:
  - "Ich konnte keine Linear-Issue-ID aus dem Branch-Namen ableiten. Bitte gib die Issue-ID an (z.B. `SVL-123`), oder wähle 'Überspringen' wenn dieses Branch kein Linear-Ticket hat."
  - Options: "ID eingeben (Other)", "Linear-Schritte überspringen"
- On skip → continue directly to STEP 11 with `LINEAR_UPDATED = false`.

Store as `ISSUE_ID`.

### 10b. Fetch Issue Context

- `mcp__plugin_lt-dev_linear__get_issue` for title, description, and current team.
- `mcp__plugin_lt-dev_linear__list_issue_statuses` for the team's workflow states (used in 10d).

### 10c. Generate & Post Comment

Generate a **German** comment for non-developers, using commits + diff stat from STEP 6:

```
## Umsetzung

[1-3 sentences: What was implemented/fixed, in user-facing terms. No technical jargon.]

## Testanleitung

1. [First step — e.g., "Seite X aufrufen"]
2. [Action to perform]
3. [Expected result to verify]

## Status

In `<BASE_BRANCH>` gemerged (Squash). Wird beim nächsten Deployment auf dev verfügbar sein.

MR/PR: <REQUEST_URL>
```

Then ask the user via `AskUserQuestion`:
- Show the generated comment.
- Options:
  1. "Posten" → post via `mcp__plugin_lt-dev_linear__save_comment` on `ISSUE_ID`
  2. "Bearbeiten" → let the user provide a revised version, then post
  3. "Überspringen" → don't post

### 10d. Status → "Dev Review" + Remove Assignee

1. Find the team's review state in the list from 10b. Match case-insensitively against: `Dev Review`, `In Review`, `Review`, `Code Review`. Pick the first match.
   - If none match, ask the user which state to use (offer the team's available states as options).
2. Update the issue via `mcp__plugin_lt-dev_linear__save_issue` with:
   - `stateId` = matched review state
   - `assigneeId` = `null` (explicitly unassign — the implementer is no longer the owner during functional review)

If the call fails (permissions, archived issue, etc.), surface the error and continue to the summary — **do not** retry the call silently. The merge has already landed; Linear state is recoverable manually.

Set `LINEAR_UPDATED = true` on success.

---

## STEP 11 — Summary

Print a concise German block:

```
╔══════════════════════════════════════════════════════════╗
║ Branch ge-shipped: <FEATURE_BRANCH> → <BASE_BRANCH>     ║
╚══════════════════════════════════════════════════════════╝

🌿 Branch
- Feature: <FEATURE_BRANCH>  (lokal gelöscht / behalten)
- Basis:   <BASE_BRANCH>     (auf neuestem Stand)

📦 Pipeline
- MR/PR:   <REQUEST_URL>
- Attempts: <PIPELINE_ATTEMPT> / <MAX>
- Final:   ✅ grün

🔀 Merge
- Modus:   Squash + Merge   (oder: Regular Merge)
- Commit:  <merge-commit-sha-short>  <subject>

🎫 Linear  (nur falls ISSUE_ID erkannt, nach erfolgreichem Merge)
- Issue:    #<ISSUE_ID>
- Comment:  Gepostet / Bearbeitet / Übersprungen
- Status:   "Dev Review"   (funktionaler Review auf dev-Deployment)
- Assignee: Entfernt

🧪 Tests vor Merge
- Unit: <n> grün
- API:  <n> grün
- E2E:  <n> grün

✅ Check
- Pre-Flight (STEP 1): <ergebnis>
- Post-Rebase (STEP 4b): <ergebnis / skipped>

Nächste Schritte:
- Ticket-Status final updaten (z.B. via Linear UI oder Workflow-Automation)
- Deployment beobachten (falls Auto-Deploy auf dev läuft)
```

---

## Hard Rules

- **Limit local Playwright runs to new + affected specs to keep TDD loops fast.** Default to `lt dev test -- <spec>` / `scripts/e2e-fast.sh -- <spec>`; the full Playwright suite is slow and runs in **CI**. Only run the full local suite when the user explicitly asks.
- **Pre-flight `check` is a hard gate** — STEP 1 must be green before STEP 2 runs. No "fix later", no "ignore for now".
- **Never force-push to a base branch** (`dev`, `develop`, `test`, `staging`, `main`, `master`). Force-push (`--force-with-lease`) is only ever applied to a feature branch's own rewritten history; in promotion mode the base source is never rebased or force-pushed at all.
- **Squash is only ever applied to a feature source.** Base branches (`dev`, `develop`, `test`, `staging`, `main`, `master`) are never squashed: promoting a base branch into a higher base branch (`dev`/`develop` → `test`/`staging` → `main`/`master`) always uses a **regular merge** (`MERGE_MODE = regular`), preserving each branch's commit history. STEP 0 classifies the source and derives `MERGE_MODE`; promotion mode additionally skips the rebase, force-push, and branch-delete of the base source.
- **Always `--force-with-lease`, never plain `--force`** when pushing rewritten feature-branch history.
- **Merge requires explicit user confirmation** — even if the pipeline is green. This is the irreversible step.
- **Branch deletion only after the merge is confirmed landed in `BASE_BRANCH`** (verified via `git log` or provider API).
- **Pipeline-retry cap is hard** — if exhausted, surface and exit. Do not loop forever.
- **Never `jq` `glab mr view` / `glab mr list --output json` output** (see STEP 6a / 7a): glab emits literal control chars in `description` / `title`, `jq` aborts, and an empty result silently reads as "still running" (blind poll) or "no existing MR" (duplicate MR). Derive CI state from the free-text-free **pipelines endpoint** (`glab api "projects/:id/merge_requests/<iid>/pipelines"` → `.[0].id`, then `glab api "projects/:id/pipelines/<id>"` → `.status`); take an MR iid from `glab mr list` **text** output. A status poll must exit on every terminal state and never treat empty/parse-failure as "keep waiting".
- **Real CI failures must be fixed in code** — never paper over with `[skip ci]` or by disabling failing checks.
- **No bypass of test rules** during retries — the same no-skip / no-flake-retry rules apply on every iteration.
- **GitLab: the merge only happens after STEP 7 confirmed the pipeline is green — never arm glab's native `--auto-merge` on a `pending` pipeline.** `glab mr merge --auto-merge` merges IMMEDIATELY on a not-yet-`running` pipeline (glab prints `! No pipeline running`), so CI runs post-merge on the base branch instead of gating the merge (see STEP 8 warning). Follow STEP 7 (poll to `success`) → STEP 8 (plain `glab mr merge`; `--squash` only for a feature source); only ever arm native auto-merge once the pipeline status is `running`.

## Failure Handling

On unrecoverable error at any step:

1. Mark the corresponding TodoWrite item as failed.
2. Print a structured diagnosis: which phase, what went wrong, current git state (`git status -s`, `git branch --show-current`, `git log --oneline -5`), MR/PR state, recommended next action.
3. **Never** delete the feature branch on failure — even partial progress is worth keeping.
4. **Never** print the success summary on failure.
