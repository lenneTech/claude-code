---
description: Ship the current feature branch into dev — pre-flight check, commit, rebase, test, check, MR/PR, Linear comment + "Dev Review" + unassign, wait for CI, squash-merge, delete branch. Auto-retries on pipeline failure.
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
| `--no-squash` | Use regular merge instead of squash-merge | squash enabled |
| `--keep-branch` | Don't delete feature branch after merge | delete enabled |
| `--auto-merge` | Skip the STEP 8 confirmation prompt — squash-merge as soon as CI is green | off (always asks) |
| `--skip-reanalysis` | Skip STEP 1.5 ticket re-analysis (use when called from an orchestrator that already did it) | off |

---

## STEP 0 — Bootstrap

1. Verify we are **not** on a protected branch (`main`, `master`, `dev`, `develop`). If we are, abort with a helpful message.
2. Capture `FEATURE_BRANCH = git branch --show-current`.
3. Determine `BASE_BRANCH` per the rule above. Probe with `git rev-parse --verify origin/<name>`.
4. Detect Git provider via `git remote get-url origin`:
   - Contains `github.com` → `gh`
   - Else → `glab` (GitLab)
   - If neither CLI is installed, abort and tell the user which CLI to install.
5. Create TodoWrite plan with the 12 phases below (STEPs 0–11 plus STEP 1.5; STEP 1 = pre-flight check, STEP 1.5 = ticket re-analysis, STEP 10 = post-merge Linear handoff, STEP 11 = summary).

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
3. **Push with force-lease** (the rebase rewrote history, so a plain push will be rejected):
   - `git push --force-with-lease origin "$FEATURE_BRANCH"`
   - **NEVER** `--force` plain. `--force-with-lease` aborts if remote moved unexpectedly (someone else pushed).
4. If `--force-with-lease` is rejected → surface to user, do **not** retry with `--force`.

---

## STEP 6 — Create MR/PR (or Reuse Existing)

### 6a. Detect Existing MR/PR

- **GitHub:** `gh pr list --head "$FEATURE_BRANCH" --base "$BASE_BRANCH" --json number,url,state --jq '.[0]'`
- **GitLab:** `glab mr list --source-branch "$FEATURE_BRANCH" --target-branch "$BASE_BRANCH" --output json | jq '.[0]'`

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
  ```bash
  glab ci status --pipeline=$(glab mr view "$REQUEST_ID" --output json | jq -r '.pipeline.id') --live
  ```
  If `--live` is unavailable in the installed `glab` version, poll every 30s with `glab ci status` until the status is `success`, `failed`, or `canceled`.

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

## STEP 8 — Squash & Merge

**This is the irreversible step.** Behaviour depends on the `--auto-merge` flag:

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

On Option 1 — perform the merge:

- **GitHub:**
  ```bash
  gh pr merge "$REQUEST_ID" --squash --delete-branch --subject "<commit-subject>" --body "<commit-body>"
  ```
  - `--delete-branch` deletes both the remote feature branch and (after local `git fetch --prune`) the remote-tracking ref.
  - If `--keep-branch` flag was given, omit `--delete-branch`.

- **GitLab:**
  ```bash
  glab mr merge "$REQUEST_ID" --squash --remove-source-branch --yes
  ```
  - If `--keep-branch` was given, omit `--remove-source-branch`.

If `--no-squash` was given, replace `--squash` with `--merge` (GitHub) or omit it (GitLab default is merge).

**Commit message for the squash:** derive from MR/PR title + body. Prefix with the Linear ID if present.

---

## STEP 9 — Local Cleanup

1. `git checkout "$BASE_BRANCH"`
2. `git pull --ff-only origin "$BASE_BRANCH"` — confirms the merge landed.
3. **Verify the merge actually happened** via `git log --oneline -1 -- ` to see the new commit, or `gh pr view "$REQUEST_ID" --json state --jq .state` (must be `MERGED`).
4. If `--keep-branch` was NOT given:
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

- **Pre-flight `check` is a hard gate** — STEP 1 must be green before STEP 2 runs. No "fix later", no "ignore for now".
- **Never force-push to a protected branch** (`main`, `master`, `dev`, `develop`). The base branch is push-target for the merge only, never for the feature branch's history.
- **Always `--force-with-lease`, never plain `--force`** when pushing rewritten feature-branch history.
- **Merge requires explicit user confirmation** — even if the pipeline is green. This is the irreversible step.
- **Branch deletion only after the merge is confirmed landed in `BASE_BRANCH`** (verified via `git log` or provider API).
- **Pipeline-retry cap is hard** — if exhausted, surface and exit. Do not loop forever.
- **Real CI failures must be fixed in code** — never paper over with `[skip ci]` or by disabling failing checks.
- **No bypass of test rules** during retries — the same no-skip / no-flake-retry rules apply on every iteration.

## Failure Handling

On unrecoverable error at any step:

1. Mark the corresponding TodoWrite item as failed.
2. Print a structured diagnosis: which phase, what went wrong, current git state (`git status -s`, `git branch --show-current`, `git log --oneline -5`), MR/PR state, recommended next action.
3. **Never** delete the feature branch on failure — even partial progress is worth keeping.
4. **Never** print the success summary on failure.
