---
description: Full ticket lifecycle in one command — auto-pick (or take ID), TDD-implement with per-slice check + commit, re-analyse, optional review, rebase + tests + check, MR/PR, wait for CI, squash-merge, delete branch, Linear comment + status handoff
argument-hint: "[issue-id | --project=<name> --team=<name> --status=<list> --base=<branch> --figma=<url> --flows=<path> --review --auto-merge --max-pipeline-retries=<n> --no-squash --keep-branch]"
allowed-tools: Agent, Read, Grep, Glob, Write, Edit, AskUserQuestion, TodoWrite, Bash(git:*), Bash(gh:*), Bash(glab:*), Bash(echo:*), Bash(ls:*), Bash(cat:*), Bash(grep:*), Bash(jq:*), Bash(test:*), Bash(sleep:*), Bash(wc:*), Bash(bash ${CLAUDE_PLUGIN_ROOT}/scripts/*), Bash(node:*), Bash(pnpm run check:*), Bash(npm run check:*), Bash(yarn run check:*), Bash(pnpm check:*), Bash(npm check:*), Bash(yarn check:*), Bash(pnpm run test:*), Bash(npm run test:*), Bash(yarn run test:*), Bash(pnpm test:*), Bash(npm test:*), Bash(yarn test:*), Bash(pnpm run lint:*), Bash(npm run lint:*), Bash(yarn run lint:*), Bash(pnpm run typecheck:*), Bash(npm run typecheck:*), Bash(yarn run typecheck:*), Bash(pnpm run build:*), Bash(npm run build:*), Bash(yarn run build:*), Bash(pnpm install:*), Bash(npm install:*), Bash(yarn install:*), Bash(npx playwright:*), Bash(pnpm exec playwright:*), mcp__plugin_lt-dev_linear__list_teams, mcp__plugin_lt-dev_linear__list_projects, mcp__plugin_lt-dev_linear__list_issue_statuses, mcp__plugin_lt-dev_linear__list_issues, mcp__plugin_lt-dev_linear__get_issue, mcp__plugin_lt-dev_linear__list_comments, mcp__plugin_lt-dev_linear__save_issue, mcp__plugin_lt-dev_linear__save_comment, mcp__plugin_lt-dev_linear__get_user, mcp__plugin_lt-dev_linear__list_users, mcp__plugin_figma_figma__get_design_context, mcp__plugin_figma_figma__get_metadata, mcp__plugin_figma_figma__get_screenshot, SlashCommand
disable-model-invocation: true
---

# Ticket Cycle — Full Pick→Implement→Land Orchestrator

## When to Use This Command

- You want the complete ticket lifecycle handled end-to-end: from picking the next ticket through to a merged MR/PR and a Linear handoff comment.
- You want the autonomous flow but **with controlled human gates** at the right moments (ticket re-analysis, scope-cut acknowledgement, merge confirmation).
- You want to opt in to auto-merge once CI is green (via `--auto-merge`) so you can step away after the last gate.

If you only need part of the cycle, use the underlying commands directly:

- Just implement & test → `/lt-dev:take-ticket`
- Just review → `/lt-dev:review`
- Just land an existing branch → `/lt-dev:git:ship`
- Hand off to a human reviewer instead of auto-merging → `/lt-dev:dev-submit`

## Related Commands & Skills

| Element | Purpose |
|---------|---------|
| `/lt-dev:take-ticket` | Phase A — pick/branch/TDD/test/check/re-analyse (this command invokes it) |
| `/lt-dev:review` | Phase B (optional) — 7-dimension review when `--review` is passed |
| `/lt-dev:git:ship` | Phase C — rebase/test/check/MR-PR/CI-wait/squash-merge/branch-delete/Linear-handoff (this command invokes it) |
| `building-stories-with-tdd` skill | Drives the TDD inside Phase A |
| `running-check-script` skill | Drives the check loop (per-slice + final, both phases) |
| `managing-dev-servers` skill | Rules for backgrounded servers during E2E |
| `rebasing-branches` skill | Drives the rebase inside Phase C |

## Argument Parsing

All flags are optional. The command splits arguments into two groups and forwards each group to the relevant sub-command:

| Flag | Forwarded to | Effect |
|------|--------------|--------|
| `<ID>` / `--project=` / `--team=` / `--status=` / `--figma=` / `--flows=` / `--no-pick` | `take-ticket` | Same semantics as that command |
| `--base=<branch>` | both | Base branch override (default: auto-detect dev→develop→main→master) |
| `--review` | this command | After Phase A completes, run `/lt-dev:review` before Phase C |
| `--auto-merge` | `git:ship` | Skip the merge-confirmation prompt once CI is green |
| `--max-pipeline-retries=<n>` | `git:ship` | CI retry cap (default 3) |
| `--no-squash` | `git:ship` | Regular merge instead of squash |
| `--keep-branch` | `git:ship` | Don't delete the feature branch after merge |

## Execution

### STEP 0 — Bootstrap

Create a TodoWrite plan with these items:

1. Phase A — `/lt-dev:take-ticket` (pick, branch, TDD, tests, check, re-analyse)
2. (optional) Phase B — `/lt-dev:review`
3. Phase C — `/lt-dev:git:ship --skip-reanalysis` (rebase, tests, check, MR/PR, CI-wait, squash-merge, branch-delete, Linear handoff)
4. Final consolidated summary

### STEP 1 — Phase A: take-ticket

Invoke via the `SlashCommand` tool:

```
/lt-dev:take-ticket <forwarded take-ticket flags>
```

Wait for `take-ticket` to print its STEP 10 review-ready summary. The user's STEP 9 confirmation inside `take-ticket` is the **first human gate** of the cycle:

- If the user picked option 1 ("Ja, fertig"), continue to STEP 2.
- If the user looped (option 2 or 3), `take-ticket` handles iteration internally. It only returns when the user opts out of the loop with "fertig" or the 3-iteration cap is hit.
- If `take-ticket` aborted (failed Linear assignment, blocking question unanswered, etc.), surface its diagnosis and stop — do **not** continue to Phase B or C.

Capture the feature branch name from `take-ticket`'s output (typically `feature/<id>-<slug>`).

### STEP 2 — Phase B (optional): review

If `--review` was passed, invoke:

```
/lt-dev:review
```

After `review` completes, ask the user via `AskUserQuestion`:

- Question: "Review abgeschlossen. Findings vor dem Ship adressieren?"
- Options:
  1. "Ja — Findings jetzt fixen, dann weiter" → pause; the user (or a follow-up `take-ticket` invocation) addresses findings, then user confirms continuation
  2. "Nein, direkt shippen" → continue to STEP 3
  3. "Abbrechen" → stop here, branch remains local

If `--review` was not passed, skip STEP 2 entirely.

### STEP 3 — Phase C: git:ship

Invoke via the `SlashCommand` tool:

```
/lt-dev:git:ship --skip-reanalysis <forwarded ship flags>
```

The `--skip-reanalysis` flag tells `git:ship` to bypass its STEP 1.5 because `take-ticket` STEP 9 already did the equivalent re-analysis. **Do not** pass `--skip-reanalysis` when invoking `git:ship` directly.

The user's STEP 8 confirmation inside `git:ship` (or its bypass via `--auto-merge`) is the **final human gate** of the cycle.

If `git:ship` reports failure (rebase conflicts unresolved, CI retry cap hit, merge rejected, …), surface its diagnosis and stop. The feature branch is intentionally **not** deleted on failure — manual recovery is always possible.

### STEP 4 — Final Consolidated Summary

After `git:ship` reports success, print one concise German block that aggregates both phases:

```
╔══════════════════════════════════════════════════════════╗
║ Ticket-Cycle abgeschlossen: <ISSUE_IDENTIFIER>          ║
╚══════════════════════════════════════════════════════════╝

🎫 Ticket
- Issue:   <ISSUE_IDENTIFIER> — <Titel>
- Status:  "Dev Review" (vorher: "In Progress")
- Assignee: entfernt

🌿 Branch
- Feature: <FEATURE_BRANCH>  (lokal gelöscht / behalten)
- Basis:   <BASE_BRANCH>     (auf neuestem Stand)

🛠 Umsetzung
- ACs umgesetzt: <n>/<total>
- Iter-Loops in take-ticket STEP 9: <n>
- Rollen-/Permission-Tests: <n>
- Mitgenommene Änderungen: <liste oder "keine">

🧪 Tests vor Merge
- Unit: <n> grün
- API:  <n> grün
- E2E:  <n> grün

📦 Pipeline
- MR/PR:    <REQUEST_URL>
- Attempts: <n>/<MAX>
- Final:    ✅ grün

🔀 Merge
- Modus:   Squash + Merge (oder: Regular Merge)
- Commit:  <merge-commit-sha-short>

💬 Linear-Comment
- Gepostet / Bearbeitet / Übersprungen

Nächste Schritte (manuell):
- Deployment auf dev beobachten
- QA / funktionalen Review koordinieren
```

If `--review` ran, include a one-line summary of remaining (non-blocking) findings.

## Hard Rules

- **Never bypass `take-ticket` STEP 9.** The re-analysis user gate is the cycle's contract for completeness — if it didn't run cleanly, this command must not proceed.
- **Never bypass `git:ship` STEP 8 silently.** Auto-merge requires the explicit `--auto-merge` flag at invocation time (or an in-run user opt-in via the STEP 8 option 2).
- **No silent fallbacks between phases.** If a phase reports failure or partial state, surface and stop.
- **Phase C always runs `git:ship --skip-reanalysis`** because Phase A already did the equivalent re-analysis. Running it twice would re-prompt the user pointlessly.
- **The cycle does NOT call `/lt-dev:dev-submit`** because Phase C lands the branch and posts the Linear handoff directly (post-merge). If a human reviewer is needed before merge, use `take-ticket` + `dev-submit` manually instead of this command.

## Failure Handling

On unrecoverable error in any phase:

1. Mark the corresponding TodoWrite item as failed.
2. Surface the failing phase's structured diagnosis verbatim. Do not paraphrase — the user needs the same detail the sub-command would have printed standalone.
3. Print the current cycle state: which phases ran, current branch, Linear ticket state.
4. Do **not** print the success summary.
