---
description: Full ticket lifecycle in one command — auto-pick (or take ID), TDD-implement with per-slice check + commit, re-analyse, optional review, browser walk, rebase + tests + check, MR/PR (auto-merge OR reviewer-handoff), CI, squash-merge, delete branch, Linear comment + status handoff
argument-hint: "[issue-id | --project=<name> --team=<name> --status=<list> --base=<branch> --figma=<url> --flows=<path> --review --no-review --auto-merge --review-handoff[=<linear-user>] --post-merge-status=<dev-review|po-review-inga> --max-pipeline-retries=<n> --no-squash --keep-branch]"
allowed-tools: Agent, Read, Grep, Glob, Write, Edit, AskUserQuestion, TodoWrite, Bash(git:*), Bash(gh:*), Bash(glab:*), Bash(echo:*), Bash(ls:*), Bash(cat:*), Bash(grep:*), Bash(jq:*), Bash(test:*), Bash(sleep:*), Bash(wc:*), Bash(bash ${CLAUDE_PLUGIN_ROOT}/scripts/*), Bash(node:*), Bash(pnpm run check:*), Bash(npm run check:*), Bash(yarn run check:*), Bash(pnpm check:*), Bash(npm check:*), Bash(yarn check:*), Bash(pnpm run test:*), Bash(npm run test:*), Bash(yarn run test:*), Bash(pnpm test:*), Bash(npm test:*), Bash(yarn test:*), Bash(pnpm run lint:*), Bash(npm run lint:*), Bash(yarn run lint:*), Bash(pnpm run typecheck:*), Bash(npm run typecheck:*), Bash(yarn run typecheck:*), Bash(pnpm run build:*), Bash(npm run build:*), Bash(yarn run build:*), Bash(pnpm install:*), Bash(npm install:*), Bash(yarn install:*), Bash(npx playwright:*), Bash(pnpm exec playwright:*), mcp__plugin_lt-dev_linear__list_teams, mcp__plugin_lt-dev_linear__list_projects, mcp__plugin_lt-dev_linear__list_issue_statuses, mcp__plugin_lt-dev_linear__list_issues, mcp__plugin_lt-dev_linear__get_issue, mcp__plugin_lt-dev_linear__list_comments, mcp__plugin_lt-dev_linear__save_issue, mcp__plugin_lt-dev_linear__save_comment, mcp__plugin_lt-dev_linear__get_user, mcp__plugin_lt-dev_linear__list_users, mcp__plugin_figma_figma__get_design_context, mcp__plugin_figma_figma__get_metadata, mcp__plugin_figma_figma__get_screenshot, SlashCommand
disable-model-invocation: true
---

# Ticket Cycle — Full Pick→Implement→Land Orchestrator

## When to Use This Command

- You want the complete ticket lifecycle handled end-to-end: from picking the next ticket through to either a merged MR/PR (auto-merge) or a handed-off MR/PR with a named reviewer.
- You want the autonomous flow but **with controlled human gates** at the right moments (ticket re-analysis, scope-cut acknowledgement, review opt-in, merge strategy, post-merge Linear status).
- You want to opt in to auto-merge once CI is green (via `--auto-merge`) so you can step away after the last gate, OR hand off to a human reviewer (via `--review-handoff[=<user>]`) without leaving the command.

If you only need part of the cycle, use the underlying commands directly:

- Just implement & test → `/lt-dev:take-ticket`
- Just review → `/lt-dev:review`
- Just land an existing branch → `/lt-dev:git:ship`
- Just hand off to a reviewer → `/lt-dev:dev-submit`

## Related Commands & Skills

| Element | Purpose |
|---------|---------|
| `/lt-dev:take-ticket` | Phase A — pick/branch/TDD/test/check/re-analyse (this command invokes it) |
| `/lt-dev:review` | Phase B (optional, opt-in) — 7-dimension review |
| `validating-changes-in-browser` skill | Phase C — pre-ship browser-validation walk |
| `/lt-dev:git:ship` | Phase D (auto-merge path) — rebase/test/check/MR-PR/CI-wait/squash-merge/branch-delete/Linear-handoff |
| `/lt-dev:dev-submit` | Phase D (reviewer-handoff path) — MR/PR + Linear comment + status → Dev Review |
| `building-stories-with-tdd` skill | Drives the TDD inside Phase A |
| `running-check-script` skill | Drives the check loop (per-slice + final, both ship paths) |
| `managing-dev-servers` skill | Rules for backgrounded servers during E2E |
| `rebasing-branches` skill | Drives the rebase inside the auto-merge path |

## Argument Parsing

All flags are optional. The command splits arguments into groups and forwards each group to the relevant sub-command:

| Flag | Forwarded to | Effect |
|------|--------------|--------|
| `<ID>` / `--project=` / `--team=` / `--status=` / `--figma=` / `--flows=` / `--no-pick` | `take-ticket` | Same semantics as that command |
| `--base=<branch>` | both | Base branch override (default: auto-detect dev→develop→main→master) |
| `--review` | this command | Skip the STEP 2 prompt and force Phase B (run `/lt-dev:review`) |
| `--no-review` | this command | Skip the STEP 2 prompt and skip Phase B entirely |
| `--auto-merge` | this command | Skip the STEP 4a prompt and take the auto-merge path |
| `--review-handoff[=<linear-user>]` | this command | Skip the STEP 4a prompt and take the reviewer-handoff path. If a user identifier is supplied, skip the reviewer picker too |
| `--post-merge-status=<dev-review\|po-review-inga>` | this command | Skip the STEP 4b prompt (auto-merge path only). `dev-review` = "Dev Review" + unassign (default). `po-review-inga` = "PO Review" + assign Inga |
| `--max-pipeline-retries=<n>` | `git:ship` | CI retry cap (default 3) |
| `--no-squash` | `git:ship` | Regular merge instead of squash |
| `--keep-branch` | `git:ship` | Don't delete the feature branch after merge |

## Execution

### STEP 0 — Bootstrap

Create a TodoWrite plan with these items:

1. Phase A — `/lt-dev:take-ticket` (pick, branch, TDD, tests, check, re-analyse)
2. Phase B (optional) — `/lt-dev:review`
3. Phase C — Browser-Validation-Walk via `validating-changes-in-browser` skill
4. Phase D — Merge-Strategie wählen + Auto-Merge (`/lt-dev:git:ship`) ODER Reviewer-Handoff (`/lt-dev:dev-submit` + Linear-/MR-Assign)
5. Final consolidated summary

### STEP 1 — Phase A: take-ticket

Invoke via the `SlashCommand` tool:

```
/lt-dev:take-ticket <forwarded take-ticket flags>
```

**Auto-Pick** (wenn keine `<ID>` übergeben wurde — `take-ticket` STEP 1b ist die kanonische Quelle, hier nur zur Übersicht). Zwei klar getrennte Phasen:

**Phase 1 — Filter (welche Tickets sind überhaupt Kandidaten?).** Ein Ticket ist nur Kandidat, wenn **beide** Bedingungen gelten:

- Status ist "Open" (Linear-Kategorie `unstarted` — typischerweise `Open`, `Todo`, `Ready`). **Backlog-Tickets sind ausgeschlossen** — was bewusst zurückgestellt wurde, wird nicht automatisch angegangen. Wer ein Backlog-Ticket möchte, übergibt explizit `--status=Backlog`.
- Es ist entweder dem aktuellen Nutzer ODER niemandem zugeordnet. Tickets, die anderen Personen zugeordnet sind, sind **immer außen vor** und nehmen an der Sortierung gar nicht teil.

**Phase 2 — Sortierung (welcher Kandidat gewinnt?).** Aus dem gefilterten Pool wird der erste nach dieser Mehrschlüssel-Sortierung gepickt:

1. **Priorität DESC** (Urgent → High → Medium → Low → None) — primärer Schlüssel. Eine höhere Priorität schlägt immer eine niedrigere, unabhängig von Bug-Status oder Zuordnung.
2. **Bug-Flag DESC** (Bug vor Nicht-Bug) — Tie-Breaker bei gleicher Priorität.
3. **Mir zugeordnet DESC** (mir zugeordnet vor niemandem zugeordnet) — Tie-Breaker bei gleicher Priorität und gleichem Bug-Status.
4. **createdAt ASC** (älter zuerst) — finaler Tie-Breaker.

Wait for `take-ticket` to print its STEP 10 review-ready summary. The user's STEP 9 confirmation inside `take-ticket` is the **first human gate** of the cycle:

- If the user picked option 1 ("Ja, fertig"), continue to STEP 2.
- If the user looped (option 2 or 3), `take-ticket` handles iteration internally. It only returns when the user opts out of the loop with "fertig" or the 3-iteration cap is hit.
- If `take-ticket` aborted (failed Linear assignment, blocking question unanswered, etc.), surface its diagnosis and stop — do **not** continue to Phase B, C or D.

Capture the feature branch name from `take-ticket`'s output (typically `feature/<id>-<slug>`).

### STEP 2 — Phase B (optional): review

Decide whether to run the 7-dimension review:

- If `--review` was passed → run review (skip the prompt).
- If `--no-review` was passed → skip review entirely, continue to STEP 3.
- Otherwise → ask the user via `AskUserQuestion`:
  - Question: "Phase B: Code-Review jetzt durchführen?"
  - Options:
    1. "Nein, direkt zur Browser-Validation" (default) → skip to STEP 3
    2. "Ja, Code-Review starten" → continue with the review below
    3. "Abbrechen" → stop here, branch remains local

If the user opted in (or `--review` forced it), invoke:

```
/lt-dev:review
```

After `review` completes, ask the user via `AskUserQuestion`:

- Question: "Review abgeschlossen. Findings vor dem Ship adressieren?"
- Options:
  1. "Ja — Findings jetzt fixen, dann weiter" → pause; the user (or a follow-up `take-ticket` invocation) addresses findings, then user confirms continuation
  2. "Nein, direkt weiter" → continue to STEP 3
  3. "Abbrechen" → stop here, branch remains local

### STEP 3 — Phase C: Browser-Validation-Walk

Run a manual-style end-to-end browser pass to catch what tests, check and review could not see (broken empty states, console errors, regressed roles, mobile glitches, latent bugs in adjacent pages).

Follow the [`validating-changes-in-browser`](${CLAUDE_PLUGIN_ROOT}/../skills/validating-changes-in-browser/SKILL.md) skill end-to-end. The skill receives:

- `diff_base`: the resolved base branch from Phase A
- `ticket_id`: the issue identifier from Phase A
- `permission_matrix`: the matrix produced in `take-ticket` STEP 5
- `mitgefixt_carryover`: anything already mitgefixt during Phase A/B

Skill verdict drives the cycle:

- `READY-TO-SHIP` → continue to STEP 4 (Phase D).
- `OPTIMIZE` → loop back to Phase A's implementation steps with the user's notes (cap iterations at **3** total across all phases). Re-run STEP 2 (review) afterwards before re-entering STEP 3.
- `WAITING-FOR-USER` → leave `lt dev up` running, print the walked list + account registry, stop and wait for the user's next message. Do NOT enter Phase D.
- `CANCELLED` → tear the stack down, surface the closing block, stop without entering Phase D. The feature branch is intentionally left intact for manual recovery.

If the skill returns `boot_failed` or `stall_guard_triggered`, surface the diagnosis verbatim and stop. Do NOT proceed to Phase D.

### STEP 4 — Phase D: Merge-Strategie + Ship

This phase decides **how** the branch lands: either auto-merged after CI is green, or handed off to a human reviewer who merges after their review.

#### STEP 4a — Merge-Strategie wählen

- If `--auto-merge` was passed → set `MERGE_STRATEGY = auto-merge`, skip the prompt.
- If `--review-handoff[=<user>]` was passed → set `MERGE_STRATEGY = reviewer-handoff`, capture the optional reviewer identifier, skip the prompt.
- Otherwise → ask the user via `AskUserQuestion`:
  - Question: "Wie soll der MR/PR gemergt werden?"
  - Options:
    1. "Auto-Merge (Default) — direkt nach grünem CI mergen" → `MERGE_STRATEGY = auto-merge`
    2. "Reviewer-Handoff — jemand anderes reviewt und mergt" → `MERGE_STRATEGY = reviewer-handoff`
    3. "Abbrechen" → stop here, branch remains local

#### STEP 4b — Pfad: Auto-Merge

Triggered when `MERGE_STRATEGY = auto-merge`.

**1. Post-Merge-Status wählen.** Decide which Linear state the ticket should land in after the merge:

- If `--post-merge-status=dev-review` was passed → `POST_MERGE_STATUS = dev-review` (default semantics), skip the prompt.
- If `--post-merge-status=po-review-inga` was passed → `POST_MERGE_STATUS = po-review-inga`, skip the prompt.
- Otherwise → ask the user via `AskUserQuestion`:
  - Question: "Welcher Linear-Status nach dem Merge?"
  - Options:
    1. "Dev Review — Assignee entfernen (Default)" → `POST_MERGE_STATUS = dev-review`
    2. "PO Review — Inga als Assignee setzen" → `POST_MERGE_STATUS = po-review-inga`
    3. "Abbrechen" → stop here, branch remains local

**2. Ship invoken.** Call `git:ship` with `--auto-merge --skip-reanalysis` plus any forwarded ship flags:

```
/lt-dev:git:ship --auto-merge --skip-reanalysis <forwarded ship flags>
```

The `--skip-reanalysis` flag tells `git:ship` to bypass its STEP 1.5 because `take-ticket` STEP 9 already did the equivalent re-analysis. **Do not** pass `--skip-reanalysis` when invoking `git:ship` directly.

If `git:ship` reports failure (rebase conflicts unresolved, CI retry cap hit, merge rejected, …), surface its diagnosis and stop. The feature branch is intentionally **not** deleted on failure — manual recovery is always possible.

**3. Post-Merge Linear override** (only when `POST_MERGE_STATUS = po-review-inga`). `git:ship` STEP 10 always sets "Dev Review" + unassign. For the `po-review-inga` choice, override it after `git:ship` succeeds:

1. Resolve "Inga" via `mcp__plugin_lt-dev_linear__list_users` (filter by name; if ambiguous, ask the user via `AskUserQuestion` to disambiguate).
2. Find the team's "PO Review" workflow state via `mcp__plugin_lt-dev_linear__list_issue_statuses` (case-insensitive match: `PO Review`, `Product Review`, `Product Owner Review`). If no match, surface the error verbatim and skip the override — the merge has already landed, the user can fix Linear manually.
3. Call `mcp__plugin_lt-dev_linear__save_issue` with `stateId = <po-review state id>` and `assigneeId = <inga user id>`.

If `POST_MERGE_STATUS = dev-review`, do nothing extra — `git:ship` already handled it.

#### STEP 4c — Pfad: Reviewer-Handoff

Triggered when `MERGE_STRATEGY = reviewer-handoff`. The branch is **not** auto-merged; another human reviews and merges.

**1. Reviewer wählen.**

- If `--review-handoff=<user>` provided an identifier → resolve it via `mcp__plugin_lt-dev_linear__get_user` or `list_users`. If resolution fails, fall through to the picker below.
- Otherwise → fetch the workspace members via `mcp__plugin_lt-dev_linear__list_users` and ask the user via `AskUserQuestion`:
  - Question: "Wer soll vor dem Merge reviewen?"
  - Options: up to 3 most-likely candidates from the team (e.g. recent assignees on this team's tickets); the user can always pick "Other" and enter a name/email.
  - Resolve the chosen identifier to a Linear user object (`id`, `displayName`, `email`).

Capture `REVIEWER` = `{linearUserId, displayName, email}`.

**2. MR/PR + Linear handoff via `dev-submit`.** Invoke:

```
/lt-dev:dev-submit
```

`dev-submit` creates the MR/PR, posts the German Linear comment, and moves the ticket to "Dev Review". Capture `REQUEST_URL` from its output.

**3. Override Linear assignee.** `dev-submit` leaves the ticket unassigned. Override:

- Call `mcp__plugin_lt-dev_linear__save_issue` with `assigneeId = REVIEWER.linearUserId` (keep status at "Dev Review" — `dev-submit` already set it).

**4. Reviewer auf MR/PR eintragen.** Use the platform CLI corresponding to the host (detect from `REQUEST_URL`):

- GitHub: `gh pr edit <REQUEST_URL> --add-reviewer <REVIEWER.email-or-handle>`
- GitLab: `glab mr update <REQUEST_URL> --reviewer <REVIEWER.email-or-handle>` (or the `--assignee` equivalent if the project's GitLab review flow uses assignees instead of reviewers — fall back to whichever the project conventions require).

If the platform CLI call fails (missing handle mapping, permission denied), surface the error verbatim and continue — the Linear assignee is already set, so the reviewer will be notified via Linear.

**5. Stop.** Do **not** merge. The cycle ends here; the human reviewer takes over.

### STEP 5 — Final Consolidated Summary

Print one concise German block. The shape depends on the merge strategy.

**Variant A — Auto-Merge** (when `MERGE_STRATEGY = auto-merge` and `git:ship` reported success):

```
╔══════════════════════════════════════════════════════════╗
║ Ticket-Cycle abgeschlossen: <ISSUE_IDENTIFIER>          ║
╚══════════════════════════════════════════════════════════╝

🎫 Ticket
- Issue:    <ISSUE_IDENTIFIER> — <Titel>
- Status:   <"Dev Review" | "PO Review">  (vorher: "In Progress")
- Assignee: <entfernt | Inga>

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

**Variant B — Reviewer-Handoff** (when `MERGE_STRATEGY = reviewer-handoff`):

```
╔══════════════════════════════════════════════════════════╗
║ Ticket-Cycle an Reviewer übergeben: <ISSUE_IDENTIFIER>  ║
╚══════════════════════════════════════════════════════════╝

🎫 Ticket
- Issue:    <ISSUE_IDENTIFIER> — <Titel>
- Status:   "Dev Review"     (vorher: "In Progress")
- Assignee: <REVIEWER.displayName>

🌿 Branch
- Feature: <FEATURE_BRANCH>  (lokal noch vorhanden, nicht gemergt)
- Basis:   <BASE_BRANCH>

🛠 Umsetzung
- ACs umgesetzt: <n>/<total>
- Iter-Loops in take-ticket STEP 9: <n>
- Rollen-/Permission-Tests: <n>
- Mitgenommene Änderungen: <liste oder "keine">

🧪 Tests
- Unit: <n> grün
- API:  <n> grün
- E2E:  <n> grün

📦 MR/PR
- URL:       <REQUEST_URL>
- Reviewer:  <REVIEWER.displayName>  (auf MR eingetragen: ja/nein)

💬 Linear-Comment
- Gepostet / Bearbeitet / Übersprungen

Nächste Schritte (manuell):
- <REVIEWER.displayName> reviewt + merged
- Nach Merge: Status-Folgewechsel (Dev Review → PO Review etc.) manuell oder via Automation
```

If `--review` ran (or the user opted in at STEP 2), include a one-line summary of remaining (non-blocking) findings.

## Hard Rules

- **Limit local Playwright runs to new + affected specs to keep TDD loops fast.** Both Phase A (`take-ticket`) and Phase D (`git:ship` auto-merge path) default to `lt dev test -- <spec>` / `scripts/e2e-fast.sh -- <spec>`; the full Playwright suite is slow and runs in **CI**. Only run the full local suite when the user explicitly asks.
- **Never bypass `take-ticket` STEP 9.** The re-analysis user gate is the cycle's contract for completeness — if it didn't run cleanly, this command must not proceed.
- **The merge-strategy gate (STEP 4a) is mandatory** unless the user passed `--auto-merge` or `--review-handoff` explicitly. The cycle MUST NOT default-to-merge without an explicit decision.
- **The post-merge-status gate (STEP 4b.1) is mandatory** in the auto-merge path unless the user passed `--post-merge-status=…`. The cycle MUST NOT silently pick a Linear state when two are configured.
- **Reviewer-Handoff never merges from inside this command.** Phase D's reviewer-handoff path stops after MR/PR creation, Linear assignment, and MR reviewer assignment. The human reviewer does the merge.
- **Auto-merge path always runs `git:ship --auto-merge --skip-reanalysis`** because Phase A already did the equivalent re-analysis and STEP 4a already captured the merge consent. Running them twice would re-prompt the user pointlessly.
- **Auto-merge path MUST rebase onto the latest base branch before pushing — and re-verify if the rebase changed anything.** `git:ship` STEP 3 rebases the feature branch onto a freshly fetched `origin/<base>`; STEP 4 then re-runs the full **Unit + API + affected-E2E** suites AND the `check` script whenever the rebase altered the working tree (it skips re-testing only when the post-rebase tree is byte-identical to the pre-rebase tree). This guarantees the branch is validated against the exact code it will merge into — **never push or merge a branch that was only tested against a stale base.** If the rebase produces conflicts, or the post-rebase re-verify goes red, fix to green before continuing; do not push a branch whose rebased state was not re-validated. The whole pipeline (incl. the `api:audit` security gate) must be green — a pre-existing red job is a blocker, not an excuse.
- **No silent fallbacks between phases.** If a phase reports failure or partial state, surface and stop.

## Failure Handling

On unrecoverable error in any phase:

1. Mark the corresponding TodoWrite item as failed.
2. Surface the failing phase's structured diagnosis verbatim. Do not paraphrase — the user needs the same detail the sub-command would have printed standalone.
3. Print the current cycle state: which phases ran, current branch, Linear ticket state.
4. Do **not** print the success summary.
