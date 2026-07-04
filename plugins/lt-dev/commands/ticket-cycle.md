---
description: Full ticket lifecycle in one command — auto-pick (or take ID), TDD-implement with per-slice check + commit, re-analyse, optional review, browser walk, manual re-test handoff (summary + credentials + test data + step-by-step), rebase + tests + check, MR/PR (auto-merge OR reviewer-handoff), CI, squash-merge, delete branch, Linear comment + status handoff
argument-hint: "[issue-id | --project=<name> --team=<name> --status=<list> --base=<branch> --figma=<url> --flows=<path> --review --no-review --auto-merge --review-handoff[=<linear-user>] --post-merge-status=<dev-review|po-review-inga> --max-deploy-wait=<minutes> --max-pipeline-retries=<n> --no-squash --keep-branch]"
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
| `--post-merge-status=<dev-review\|po-review-inga>` | this command | Skip the STEP 4b prompt (auto-merge path only). `dev-review` = "Dev Review" + unassign (default). `po-review-inga` = "PO Review" + assign Inga (only after the dev deploy is green) |
| `--max-deploy-wait=<minutes>` | this command | Polling cap for the post-merge deploy pipeline before asking the user how to proceed (only relevant when `POST_MERGE_STATUS = po-review-inga`). Default 30 |
| `--max-pipeline-retries=<n>` | `git:ship` | CI retry cap (default 3) |
| `--no-squash` | `git:ship` | Regular merge instead of squash |
| `--keep-branch` | `git:ship` | Don't delete the feature branch after merge |

## Execution

### STEP 0 — Bootstrap

Create a TodoWrite plan with these items:

1. Phase A — `/lt-dev:take-ticket` (pick, branch, TDD, tests, check, re-analyse)
2. Phase B (optional) — `/lt-dev:review`
3. Phase C — Browser-Validation-Walk via `validating-changes-in-browser` skill
4. Manuelle Nachtest-Anleitung + Freigabe-Gate (Änderungs-Zusammenfassung, Credentials, Testdaten, Schritt-für-Schritt)
5. Phase D — Merge-Strategie wählen + Auto-Merge (`/lt-dev:git:ship`) ODER Reviewer-Handoff (`/lt-dev:dev-submit` + Linear-/MR-Assign)
6. Final consolidated summary

### STEP 1 — Phase A: take-ticket

Invoke via the `SlashCommand` tool:

```
/lt-dev:take-ticket <forwarded take-ticket flags>
```

**Auto-Pick** (wenn keine `<ID>` übergeben wurde — `take-ticket` STEP 1b ist die kanonische Quelle, hier nur zur Übersicht). Zwei klar getrennte Phasen:

**Phase 1 — Filter (welche Tickets sind überhaupt Kandidaten?).** Ein Ticket ist nur Kandidat, wenn **beide** Bedingungen gelten:

- Status ist "Open" (Linear-Kategorie `unstarted` — typischerweise `Open`, `Todo`, `Ready`) **oder** "Fix needed" (Name-Match auf `Fix needed` / `Fix Needed` / `Needs Fix` / `needs-fix` / `fix-needed`, case-insensitive — unabhängig von der Linear-Kategorie). **Backlog-Tickets sind ausgeschlossen** — was bewusst zurückgestellt wurde, wird nicht automatisch angegangen. Wer ein Backlog-Ticket möchte, übergibt explizit `--status=Backlog`. Ein explizit gesetztes `--status=<liste>` ist der absolute Filter.
- Es ist entweder dem aktuellen Nutzer ODER niemandem zugeordnet. Tickets, die anderen Personen zugeordnet sind, sind **immer außen vor** und nehmen an der Sortierung gar nicht teil.

**Phase 2 — Sortierung (welcher Kandidat gewinnt?).** Status ist primär, Priorität zweit, Zuordnung dritt — alles andere sind Tie-Breaker.

1. **Fix-needed-Flag DESC** (Fix needed vor Open) — primärer Schlüssel. Ein Low-Prio-Ticket in "Fix needed" schlägt ein Urgent-Ticket in "Open".
2. **Priorität DESC** (Urgent → High → Medium → Low → None) — zweiter Schlüssel. Innerhalb desselben Status schlägt eine höhere Priorität immer eine niedrigere, unabhängig davon, wem das Ticket zugeordnet ist.
3. **Mir zugeordnet DESC** (mir vor niemandem) — dritter Schlüssel. Bei gleichem Status und gleicher Priorität schlägt mein Ticket ein freies.
4. **Bug-Flag DESC** (Bug vor Nicht-Bug) — vierter Schlüssel.
5. **createdAt ASC** (älter zuerst) — finaler Tie-Breaker.

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

- `READY-TO-SHIP` → continue to STEP 3b (manual re-test handoff), then Phase D.
- `OPTIMIZE` → loop back to Phase A's implementation steps with the user's notes (cap iterations at **3** total across all phases). Re-run STEP 2 (review) afterwards before re-entering STEP 3.
- `WAITING-FOR-USER` → leave `lt dev up` running, print the walked list + account registry, stop and wait for the user's next message. Do NOT enter Phase D.
- `CANCELLED` → tear the stack down, surface the closing block, stop without entering Phase D. The feature branch is intentionally left intact for manual recovery.

If the skill returns `boot_failed` or `stall_guard_triggered`, surface the diagnosis verbatim and stop. Do NOT proceed to Phase D.

### STEP 3b — Manuelle Nachtest-Anleitung + Freigabe-Gate

Phase C walked the browser flows **autonomously** and fixed what it found. This step turns that walk into a **human-reproducible test manual** so the developer (or a QA colleague) can re-verify the change by hand **before** it merges. It runs **only** on a `READY-TO-SHIP` verdict from STEP 3 — the other verdicts already stop the cycle (`WAITING-FOR-USER`, `CANCELLED`) or loop back (`OPTIMIZE`).

**No new browser work here.** The manual is assembled purely from the outputs Phase C already returned (`final_list`, `accounts_registry`, `also_fixed`, `out_of_scope_findings`) plus Phase A's `task_summary` / `implementation_summary`.

**1. Consolidate the four sections:**

- **Änderungs-Zusammenfassung** ← Phase A's `task_summary` + `implementation_summary` (with the most-relevant `file:line` refs), plus every `also_fixed` entry (each flagged **vorbestehend** or **aus dieser Umsetzung**).
- **Credentials** ← `accounts_registry` verbatim: email / password / role / *existing-seed-or-new-for-this-walk*. Every login-bound step must be reproducible without a follow-up question. Public routes are listed explicitly as `kein Login`.
- **Testdaten** ← the seed + fixtures the walk relied on (`@test.com` accounts, any records the walk created) and the active Stack URLs (App, API, DB slug) from `lt dev status`.
- **Schritt-für-Schritt-Testanleitung** ← `final_list`, but **rewritten from "what I walked" into imperative "do this → expect that" steps.** Each step carries: the account to log in with, the fully-qualified URL, the action to perform, and the **expected** result the human should observe. Include the `out_of_scope_findings` as a separate "offen / separat empfohlen" list.

**2. Print one structured block** (render in the user's session language; German template shown, consistent with this command's other output blocks):

```
╔══════════════════════════════════════════════════════════╗
║ Manuelle Nachtest-Anleitung: <ISSUE_IDENTIFIER>         ║
╚══════════════════════════════════════════════════════════╝

🎫 Was wurde geändert
- Ticket:    <ISSUE_IDENTIFIER> — <Titel>  (<Linear-/Issue-URL>)
- Aufgabe:   <1–3 Sätze: was sollte passieren>
- Umsetzung: <1–3 Sätze: wie umgesetzt, wichtigste file:line-Referenzen>
- Mitgefixt: <also_fixed — je "vorbestehend" / "aus dieser Umsetzung"; oder "keine">

🌐 Stack & Testdaten
- App:      <URL>
- API:      <URL>
- DB:       <slug>-local   (Seed: @test.com)
- Fixtures: <während des Walks angelegte Testdaten — oder "keine">

👥 Zugangsdaten (zum Einloggen beim Nachtesten)
- admin@test.com / TestPass123! / Admin / Seed
- user1@test.com / TestPass123! / User  / neu für diesen Walk
- (kein Login)   / —            / —     / öffentliche Routen

📋 Schritt-für-Schritt (so testest du es selbst nach)
1. Login als <email> → <URL> → <Aktion> → erwartet: <Ergebnis>
2. Account: kein Login → <URL> → <Aktion> → erwartet: <Ergebnis>
3. …

⚠ Offen / separat empfohlen
- <out_of_scope_findings — oder "keine">
```

The block must be **scannable and self-contained** — the user re-walks from this single screen without scrolling back to the Phase C walked list.

**3. Freigabe-Gate.** Ask the user via `AskUserQuestion`:

- Question: "Manuelle Nachtest-Anleitung erstellt. Wie weiter?"
- Options:
  1. "Direkt zu Phase D — Claude hat bereits getestet, jetzt mergen" (default) → continue to STEP 4.
  2. "Ich teste erst manuell — pausieren" → keep `lt dev up` running, leave the manual on screen, stop and wait for the user's next message. Do **NOT** enter Phase D. When the user returns with a go, resume at STEP 4; if they report a problem, re-enter Phase A's implementation loop (counts against the **3**-iteration cap) and re-run STEP 2 → 3 → 3b.
  3. "Doch noch optimieren" → free-text scope; loop back to Phase A's implementation steps (cap **3** total), then re-run STEP 2 → 3 → 3b.
  4. "Abbrechen" → stop here, branch remains local, nothing merged.

Only option 1 proceeds to Phase D. The manual is printed on **every** path so the user always has the reproduction steps in hand.

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

**3. Wait for deploy + Linear override** (only when `POST_MERGE_STATUS = po-review-inga`).

The PO Review transition must **not** happen right after merge — the dev environment must actually be redeployed with the merged code first. Otherwise the PO opens the app, sees a stale build, and burns a test cycle on something that "looks broken" but is just not deployed yet. `git:ship` STEP 10 has already set the ticket to "Dev Review" (unassigned), which is a safe waiting state during deployment.

**3a. Locate the post-merge deploy pipeline.** Capture the merge commit SHA from `git:ship`'s output. Detect the provider from `REQUEST_URL` and locate the pipeline triggered on `<BASE_BRANCH>` by the merge commit:

- GitHub: `gh run list --branch <BASE_BRANCH> --limit 10 --json databaseId,status,conclusion,workflowName,headSha,htmlUrl` — match the entry with `headSha == <merge-sha>` and a workflow name that looks like a deploy (case-insensitive match against `deploy`, `release`, `cd`, `dev`).
- GitLab: `glab ci list --ref <BASE_BRANCH> --per-page 10 --output json` — match the pipeline whose commit SHA equals the merge SHA.

If no deploy pipeline is found within 60 seconds (some providers take a moment to register the run), ask the user via `AskUserQuestion`:

- Question: "Keine Post-Merge-Deploy-Pipeline für `<merge-sha>` auf `<BASE_BRANCH>` gefunden. Wie weiter?"
- Options:
  1. "Weiter suchen — nochmal 60s polling" → retry locate
  2. "Kein Deployment vorhanden — Linear-Override jetzt durchführen" → continue to step 3c
  3. "Manuell setzen — Cycle beenden ohne Override" → skip 3c, print a note that PO Review transition is pending manual deployment confirmation

**3b. Wait for deploy completion.** Poll the located pipeline every 30 seconds, capped at `MAX_DEPLOY_WAIT_MINUTES` (default 30, override via `--max-deploy-wait=<minutes>`). Poll the **pipeline object** by id, which carries no free-text field — GitHub `gh run view <id> --json status,conclusion`, GitLab `glab api "projects/:id/pipelines/<id>" | jq -r '.status'`. **Never** derive the status by `jq`-ing `glab mr view/list --output json` — glab emits literal control chars in the MR `description`/`title`, `jq` aborts, the read comes back empty, and a poll that treats empty as "still running" loops **blind** past the actual green/failed state (see `git:ship` STEP 7a). Treat an empty/parse-failed read as a transient retry, and exit on every terminal state:

- `success` / `completed` → continue to step 3c.
- `failed` / `cancelled` / `errored` → surface the pipeline URL and conclusion. Do **NOT** override Linear — the ticket stays on "Dev Review" (unassigned) so no one starts PO QA against a broken deploy. Print:
  ```
  ⚠️ Deploy-Pipeline failed — Linear-Status bleibt auf "Dev Review" (unassigned).
  Pipeline: <pipeline-url>
  Conclusion: <failed|cancelled|errored>
  Sobald das Deployment manuell repariert / re-triggered und grün ist,
  kannst du das Ticket manuell auf "PO Review" + Inga setzen.
  ```
  Mark this branch of STEP 4b.3 as **partial-success** for the Final Summary (Variant A): merge landed, deploy failed, Linear NOT overridden.
- `running` / `pending` / `queued` after the timeout → ask the user via `AskUserQuestion`:
  - Question: "Deploy-Pipeline läuft länger als <MAX_DEPLOY_WAIT_MINUTES> Min. Wie weiter?"
  - Options:
    1. "Weiter warten — nochmal <MAX_DEPLOY_WAIT_MINUTES> Min." → reset timer, continue polling
    2. "Nicht warten — Linear-Override jetzt durchführen (riskant, PO testet ggf. stale Build)" → continue to step 3c
    3. "Linear-Status manuell später setzen — Cycle beenden" → skip 3c, print note about pending manual transition

**3c. Override Linear status + assignee.**

1. Resolve "Inga" via `mcp__plugin_lt-dev_linear__list_users` (filter by name; if ambiguous, ask the user via `AskUserQuestion` to disambiguate).
2. Find the team's "PO Review" workflow state via `mcp__plugin_lt-dev_linear__list_issue_statuses` (case-insensitive match: `PO Review`, `Product Review`, `Product Owner Review`). If no match, surface the error verbatim and skip the override — the merge has already landed, the user can fix Linear manually.
3. Call `mcp__plugin_lt-dev_linear__save_issue` with `stateId = <po-review state id>` and `assigneeId = <inga user id>`.

If `POST_MERGE_STATUS = dev-review`, do nothing extra — `git:ship` already handled it. No deploy wait is needed in this branch: "Dev Review" is for developers / QA who know how to read the deploy state themselves.

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

**Clear the VStab window-tab title first** (best effort, non-blocking) — the cycle for this ticket is over, the tab must not keep advertising a finished ticket:

```
bash ${CLAUDE_PLUGIN_ROOT}/scripts/vs-tab-title.sh --clear
```

Silent no-op when the VStab extension is not installed; a failure here never blocks the summary. On the failure path (see "Failure Handling") the title is deliberately **kept**, since the ticket is still in progress. The title was set by `take-ticket` STEP 3b.

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

🚀 Post-Merge-Deploy  (nur bei POST_MERGE_STATUS = po-review-inga)
- Pipeline: <pipeline-url>
- Status:   ✅ grün / ⚠️ failed / ⌛ Timeout (User-Wahl)
- Wartezeit: <n> Min.

💬 Linear-Comment
- Gepostet / Bearbeitet / Übersprungen

Nächste Schritte (manuell):
- Deployment auf dev beobachten (falls nicht schon gewartet)
- QA / funktionalen Review koordinieren
- Bei failed Deploy: nach Fix manuell auf "PO Review" + Inga setzen
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
- **The manual re-test handoff (STEP 3b) always runs before Phase D on a `READY-TO-SHIP` verdict.** The cycle MUST NOT jump from the autonomous browser walk straight into merging without first emitting the manual re-test manual (Änderungs-Zusammenfassung + Credentials + Testdaten + Schritt-für-Schritt) and passing its Freigabe-Gate. The manual is assembled from Phase C's returned outputs — no second browser walk — and only the explicit "Direkt zu Phase D" choice proceeds to STEP 4.
- **The merge-strategy gate (STEP 4a) is mandatory** unless the user passed `--auto-merge` or `--review-handoff` explicitly. The cycle MUST NOT default-to-merge without an explicit decision.
- **The post-merge-status gate (STEP 4b.1) is mandatory** in the auto-merge path unless the user passed `--post-merge-status=…`. The cycle MUST NOT silently pick a Linear state when two are configured.
- **The PO Review transition (STEP 4b.3) waits for a green dev deploy.** When `POST_MERGE_STATUS = po-review-inga`, the cycle MUST NOT set the Linear ticket to "PO Review" / assignee=Inga until the post-merge deploy pipeline on `<BASE_BRANCH>` is green. POs starting QA against a stale build burn cycles and erode trust in the handoff. If the deploy fails or times out, the ticket stays on "Dev Review" (unassigned) and the user is told to redo the transition manually after fixing the deploy.
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
