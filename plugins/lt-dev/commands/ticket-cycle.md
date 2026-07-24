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
| `--max-deploy-wait=<minutes>` | this command | Polling cap for the post-merge deploy **job** before asking the user how to proceed. Default 30 |
| `--max-pipeline-retries=<n>` | `git:ship` | CI retry cap (default 3) |
| `--no-squash` | `git:ship` | Regular merge instead of squash |
| `--keep-branch` | `git:ship` | Don't delete the feature branch after merge |

## Execution

### STEP 0 — Bootstrap

Create a TodoWrite plan with these items:

0. Pre-Flight — Stale-Leftover-Branch-Cleanup + Basis aktualisieren (STEP 0.5)
1. Phase A — `/lt-dev:take-ticket` (pick, branch, TDD, tests, check, re-analyse)
2. Phase B (optional) — `/lt-dev:review`
3. Phase C — Browser-Validation-Walk via `validating-changes-in-browser` skill
4. Manuelle Nachtest-Anleitung + Freigabe-Gate (Änderungs-Zusammenfassung, Credentials, Testdaten, Schritt-für-Schritt) — bei der Wahl "Ich teste selbst" ist es PFLICHT, VOR dem Pausieren alle 5 Deliverables zu liefern: (a) Testdaten in der laufenden Dev-DB vorbereiten, (b) Upload-Testdateien erzeugen falls eine Upload-Fläche betroffen ist, (c) kurze verständliche Zusammenfassung, (d) Credentials mit literalen Passwörtern, (e) Schritt-für-Schritt mit klickbaren Deep-Links (was/wie/warum)
5. Phase D — Merge-Strategie wählen + Auto-Merge (`/lt-dev:git:ship`) ODER Reviewer-Handoff (`/lt-dev:dev-submit` + Linear-/MR-Assign)
6. Final consolidated summary

### STEP 0.5 — Pre-Flight: Stale-Leftover-Branch-Cleanup + Basis aktualisieren

Runs **before** STEP 1, only in the current worktree. A previous cycle may have **shipped** its ticket (branch merged, remote source branch auto-deleted) yet left the **local** feature branch still checked out and the local base branch un-pulled — so the worktree is stale: the next pick would branch off outdated code, or worse, stack a new ticket on top of a dead leftover branch. Clean this up first — but **never discard unmerged work**.

1. **Resolve the base branch** (the `--base=` override, else auto-detect `dev` → `develop` → `main` → `master`), then `git fetch origin --quiet`.
2. **Is HEAD a stale, already-shipped leftover?** Only if **all** hold:
   - HEAD is a **feature branch**, not the base branch itself, and the working tree is **clean** (`git status --porcelain` empty).
   - Its remote upstream is gone (`git status -b` shows `[origin/<branch>: gone]`) **or** no open MR/PR exists for it.
   - Its content is **already in the base** — either a true ancestor (`git merge-base --is-ancestor HEAD origin/<base>` → yes), **or** squash/patch-equivalent: even when `git cherry origin/<base> HEAD` prints `+` commits (a squash-merge rewrites patch-ids, so `git branch -d` refusing is **not** proof of unmerged work), the touched files are byte-identical to the base. Verify with `git diff origin/<base> HEAD -- <files-of-those-commits>` coming back **empty** (or a `git range-diff <base-merge>~1..<base-merge> <tip>~N..<tip>` showing only metadata/message deltas).
   - It is **not** checked out in another worktree (`git branch -vv` shows no `(…path…)` marker on it) and **not** a deliberately kept `backup/*` / `*-backup` / `*-presquash` branch.
3. **Qualifies as a fully-merged leftover** → `git checkout <base>` → `git pull --ff-only origin <base>` → `git branch -D <leftover>`. `log()` what was deleted and the base SHA it advanced to.
4. **Content NOT provably in the base** (genuine unmerged commits, dirty tree, or *any* doubt) → do **NOT** delete anything. Surface the finding (which commits/files are unmerged) and let the user decide. Never `-D` on uncertainty — the branch is intentionally kept for manual recovery.
5. **HEAD is already the base branch** → `git pull --ff-only origin <base>` and continue. **HEAD is a fresh, un-shipped feature branch** (its work is NOT in the base) → leave it untouched and continue; this is real work-in-progress, not a leftover.

Scope guard: this **only ever** touches the just-shipped leftover of the **current** worktree. It is never a mass purge of historical local branches, never a branch owned by another worktree, and never a `backup/*` branch.

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
- `WAITING-FOR-USER` → the user wants to re-test by hand: run STEP 3b's **Manual-Test Preparation routine** (prepare DB test data · generate upload files when sensible · plain-language summary · credentials · precise was/wie/warum steps), leave `lt dev up` running (the skill still closes its automation browser), emit that enriched manual, stop and wait for the user's next message. Do NOT enter Phase D.
- `CANCELLED` → tear the stack down, surface the closing block, stop without entering Phase D. The feature branch is intentionally left intact for manual recovery.

If the skill returns `boot_failed` or `stall_guard_triggered`, surface the diagnosis verbatim and stop. Do NOT proceed to Phase D.

### STEP 3b — Manuelle Nachtest-Anleitung + Freigabe-Gate

Phase C walked the browser flows **autonomously** and fixed what it found. This step turns that walk into a **human-reproducible test manual** so the developer (or a QA colleague) can re-verify the change by hand **before** it merges. It runs **only** on a `READY-TO-SHIP` verdict from STEP 3 — the other verdicts already stop the cycle (`WAITING-FOR-USER`, `CANCELLED`) or loop back (`OPTIMIZE`).

**No new browser work here.** The manual is assembled purely from the outputs Phase C already returned (`final_list`, `accounts_registry`, `also_fixed`, `out_of_scope_findings`) plus Phase A's `task_summary` / `implementation_summary`.

**1. Consolidate the sections:**

- **Änderungs-Zusammenfassung (kurz & leicht verständlich)** ← Phase A's `task_summary` + `implementation_summary`, written so a non-author (a QA colleague) grasps *what the ticket was* and *what to verify now* in a few plain sentences — no jargon, no internal shorthand. Still carry the most-relevant `file:line` refs and every `also_fixed` entry (each flagged **vorbestehend** or **aus dieser Umsetzung**).
- **Credentials** ← `accounts_registry` verbatim: email / password / role / *existing-seed-or-new-for-this-walk*. Every login-bound step must be reproducible without a follow-up question. Public routes are listed explicitly as `kein Login`.
- **Testdaten** ← the concrete records each manual step acts on (`@test.com` accounts, the seeded entities) plus the active Stack URLs (App, API, DB slug) from `lt dev status`. On the "Ich teste selbst" path these are **actively prepared in the DB** and their real IDs baked into the deep-links — see step 4.
- **Testdateien für Upload** ← only when the diff touches a file-upload surface (CSV/XLSX import, document/image/avatar upload, TUS, …): the concrete sample file(s) to upload, with their absolute on-disk path. Generated in step 4 on the manual-test path. When no upload surface is affected, this section states "keine Upload-Felder betroffen — keine Testdateien nötig".
- **Schritt-für-Schritt-Testanleitung (was / wie / warum)** ← `final_list`, **rewritten from "what I walked" into imperative "do this → expect that" steps.** Each step carries: the account to log in with, the fully-qualified URL **rendered as a clickable markdown link** — `[<Seite / Route>](<URL>)`, so the tester clicks straight through (the session renders GitHub-flavored markdown; deep-links keep their exact query/route/hash params), the **exact action** (which control, what value / which file), the **expected** result the human should observe, and a one-clause **warum** (what the step proves) so the tester understands the point, not just the mechanics. Include the `out_of_scope_findings` as a separate "offen / separat empfohlen" list.

**2. Print one structured block** (render in the user's session language; German template shown, consistent with this command's other output blocks):

```
╔══════════════════════════════════════════════════════════╗
║ Manuelle Nachtest-Anleitung: <ISSUE_IDENTIFIER>         ║
╚══════════════════════════════════════════════════════════╝

Was wurde geändert (kurz & verständlich)
- Ticket:    <ISSUE_IDENTIFIER> — <Titel>  (<Linear-/Issue-URL>)
- Aufgabe:   <1–3 einfache Sätze: was war das Problem / die Aufgabe>
- Zu testen: <1–2 Sätze: was soll jetzt konkret verifiziert werden>
- Umsetzung: <1–2 Sätze: wie umgesetzt, wichtigste file:line-Referenzen>
- Mitgefixt: <also_fixed — je "vorbestehend" / "aus dieser Umsetzung"; oder "keine">

Stack & Testdaten
- App:      <URL>
- API:      <URL>
- DB:       <slug>-local   (Seed: @test.com)
- Testdaten: <in der DB vorbereitete Datensätze mit ihren IDs — oder "keine">

Testdateien für Upload
- <absoluter Pfad zur Sample-Datei + wofür> — oder "keine Upload-Felder betroffen — keine Testdateien nötig"

Zugangsdaten (zum Einloggen beim Nachtesten)
- admin@test.com / TestPass123! / Admin / Seed
- user1@test.com / TestPass123! / User  / neu für diesen Walk
- (kein Login)   / —            / —     / öffentliche Routen

Schritt-für-Schritt (so testest du es selbst nach — was / wie / warum)
   (URLs als klickbare Links: [Seite/Route](vollständige URL) — inkl. Deep-Link-Query auf konkrete Datensätze)
1. Login als <email> → [<Seite / Route>](<vollständige URL>) → <genaue Aktion: welches Control, welcher Wert/welche Datei> → erwartet: <Ergebnis> → prüft: <warum / was der Schritt beweist>
2. Account: kein Login → [<Seite / Route>](<vollständige URL>) → <Aktion> → erwartet: <Ergebnis> → prüft: <warum>
3. …

Offen / separat empfohlen
- <out_of_scope_findings — oder "keine">
```

The block must be **scannable and self-contained** — the user re-walks from this single screen without scrolling back to the Phase C walked list.

**3. Freigabe-Gate.** Ask the user via `AskUserQuestion`:

- Question: "Manuelle Nachtest-Anleitung erstellt. Wie weiter?"
- Options:
  1. "Direkt zu Phase D — Claude hat bereits getestet, jetzt mergen" (default) → continue to STEP 4.
  2. "Ich teste selbst — Testdaten + Anleitung vorbereiten" → **run the Manual-Test Preparation routine (step 4 below) FIRST**, then keep `lt dev up` running, leave the enriched manual on screen, stop and wait for the user's next message. Do **NOT** enter Phase D. When the user returns with a go, resume at STEP 4; if they report a problem, re-enter Phase A's implementation loop (counts against the **3**-iteration cap) and re-run STEP 2 → 3 → 3b.
     - **Never label this option merely "pausieren".** The label is what the model reads back when the answer arrives — by that point, in a long cycle, this command text may already have been compressed out of context. The work must therefore live *in the label itself*, not only in the prose here.
     - **The option's `description` MUST spell out the obligation**, e.g.: "Claude bereitet zuerst passende Testdaten in der Dev-DB vor, erzeugt ggf. Upload-Dateien und liefert Zusammenfassung + Credentials + klickbare Schritt-für-Schritt-Anleitung — und pausiert ERST danach."
     - **Free-text fallback:** any "Other" answer that means the user wants to test first ("teste selbst", "ich schaue erst drauf", "pausieren", "warte") routes to this option — with the identical five-deliverable obligation. Never treat such an answer as a bare pause.
  3. "Doch noch optimieren" → free-text scope; loop back to Phase A's implementation steps (cap **3** total), then re-run STEP 2 → 3 → 3b.
  4. "Abbrechen" → stop here, branch remains local, nothing merged.

Only option 1 proceeds to Phase D. The manual is printed on **every** path so the user always has the reproduction steps in hand.

**4. Manual-Test Preparation — run ONLY when the user chose "Ich teste selbst" (option 2, incl. any free-text equivalent).** The point of that choice is that the user re-tests by hand; make the stack genuinely ready so they can walk every step without any setup work of their own. Prepare and (re-)output all five deliverables:

- **a. Passende Testdaten in der DB vorbereiten.** Seed / ensure the concrete records each manual step acts on exist in the **running dev DB** (from `lt dev status` — never the `-test` DB) with `@test.com` / obviously-fake data. Use the project's seed script (e.g. `pnpm run seed:demo` / `pnpm run seed:test-data`, pointed at the active dev DB + an `@test.com` admin) or, for a small targeted fixture, direct API calls / `mongosh` inserts against the active DB. Cover every role in the permission matrix and every entity state the steps touch (populated + empty + edge). Re-use what Phase C already seeded; only add what is missing. Capture the concrete record IDs and bake them into the deep-link URLs in the step list so each link lands on a real record.
- **b. Testdateien zum Upload erzeugen — nur falls sinnvoll.** When a step involves a file upload (CSV/XLSX import, document/image/avatar upload, TUS), generate small, **valid** sample file(s) in the scratchpad dir and reference their absolute path in the "Testdateien für Upload" section and in the relevant step. Match the format/columns/size the feature expects (a real header row for a CSV import, a tiny valid PNG/PDF for a document field). When no upload surface is touched, generate nothing and keep the "keine Upload-Felder betroffen" line.
- **c. Kurze, leicht verständliche Zusammenfassung** of what the ticket was and what to test now (the "Was wurde geändert" block) — plain language, no jargon.
- **d. Credentials** for every account the manual needs (the "Zugangsdaten" block), with literal passwords.
- **e. Schritt-für-Schritt-Anleitung (was / wie / warum)** with fully-qualified URLs **rendered as clickable markdown links** `[Seite/Route](URL)` (now pointing at the real seeded records — deep-links carry the concrete record IDs / query params) and, per step, the exact action, the expected result, and the reason the step exists.

Then **re-emit the enriched manual block** (reflecting the prepared data, the generated upload-file paths, and the precise steps) and pause with `lt dev up` running and the automation browser closed. Never pause on this path without these five deliverables in hand — that is the contract of the "Ich teste selbst" choice.

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

**3. Verify the dev deploy is healthy — then (optionally) override Linear.** **Mandatory for BOTH post-merge statuses, including pure dev-tooling / config-only / test-only tickets.**

A ticket is only **done** — and its Linear status is only transitioned / pushed forward — once the merged code is **actually running healthy on dev**: the merge landed AND the **new** containers/replicas of the merged version are up and healthy. A merge alone is **not** "done": the deploy can still fail (broken migration, missing/short env var, crash-loop, bad image), in which case the orchestrator silently keeps serving the **old** build and dev is stale without anyone noticing. This applies even to dev-tooling changes that don't run in the container — the deploy itself must still complete cleanly, because a broken deploy blocks every later ticket too.

`git:ship` STEP 10 has already set the ticket to "Dev Review" (unassigned) — a safe waiting state during deployment. For `POST_MERGE_STATUS = po-review-inga`, the PO Review transition additionally must **not** happen until the deploy is healthy (a PO opening a stale build burns a test cycle). For `dev-review`, no status override follows, but the cycle is **not** reported complete until this verification passes.

**3a. Locate the post-merge deploy pipeline — and the deploy JOB inside it.** Capture the merge commit SHA from `git:ship`'s output. Detect the provider from `REQUEST_URL` and locate the pipeline triggered on `<BASE_BRANCH>` by the merge commit:

- GitHub: `gh run list --branch <BASE_BRANCH> --limit 10 --json databaseId,status,conclusion,workflowName,headSha,htmlUrl` — match the entry with `headSha == <merge-sha>` and a workflow name that looks like a deploy (case-insensitive match against `deploy`, `release`, `cd`, `dev`).
- GitLab: `glab ci list --ref <BASE_BRANCH> --per-page 10 --output json` — match the pipeline whose commit SHA equals the merge SHA.

Then resolve `DEPLOY_JOB` — the single job inside that pipeline that performs the **server rollout**:

- GitLab: `glab api "projects/:id/pipelines/<pipeline-id>/jobs?per_page=100"` → pick the job whose `name` matches `deploy` / `rollout` / `release` (case-insensitive), preferring an exact stage match (`stage == "deploy"`) and, when several match, the one whose name contains `<BASE_BRANCH>` (`deploy-dev` on `dev`, `deploy-test` on `test`).
- GitHub: `gh run view <run-id> --json jobs` → same name matching over `.jobs[].name`.

**Why the job and not the pipeline:** a pipeline routinely carries work that has nothing to do with the rollout — image builds for other consumers, artifact publishing, notification jobs. Waiting for the *pipeline* conflates two different questions: "is the merged code running on the server?" and "are all side artefacts finished?". Observed live (SVL, DEV-2636): a pipeline built a multi-arch appliance image alongside the rollout; the server was healthy after ~6 minutes while that image kept building for over an hour, and the pipeline was still `running` — a pipeline-level wait would have reported a perfectly good deployment as pending, then as failed when the unrelated build died. Deploy verification must therefore anchor on the deploy job, and the container-health check in 3b-2 remains the actual proof.

If no deploy **job** can be identified inside the pipeline, fall back to polling the **pipeline object** as before (the pre-existing behaviour) and note in the summary that the verification was pipeline-scoped, not job-scoped.

If no deploy pipeline is found within 60 seconds (some providers take a moment to register the run), ask the user via `AskUserQuestion`:

- Question: "Keine Post-Merge-Deploy-Pipeline für `<merge-sha>` auf `<BASE_BRANCH>` gefunden. Wie weiter?"
- Options:
  1. "Weiter suchen — nochmal 60s polling" → retry locate
  2. "Kein Deployment vorhanden — Linear-Override jetzt durchführen" → continue to step 3c
  3. "Manuell setzen — Cycle beenden ohne Override" → skip 3c, print a note that PO Review transition is pending manual deployment confirmation

**3b. Wait for the DEPLOY JOB to complete.** Poll `DEPLOY_JOB` every 30 seconds, capped at `MAX_DEPLOY_WAIT_MINUTES` (default 30, override via `--max-deploy-wait=<minutes>`) — **not** the pipeline as a whole (see 3a). Poll the **job object** by id, which carries no free-text field — GitLab `glab api "projects/:id/jobs/<job-id>" | jq -r '.status'`, GitHub `gh run view <run-id> --json jobs` → the matched job's `status`/`conclusion`. On the 3a fallback (no deploy job identifiable) poll the pipeline object instead: GitHub `gh run view <id> --json status,conclusion`, GitLab `glab api "projects/:id/pipelines/<id>" | jq -r '.status'`.

**Never** derive the status by `jq`-ing `glab mr view/list --output json` — glab emits literal control chars in the MR `description`/`title`, `jq` aborts, the read comes back empty, and a poll that treats empty as "still running" loops **blind** past the actual green/failed state (see `git:ship` STEP 7a). Treat an empty/parse-failed read as a transient retry, and exit on every terminal state.

A GitLab job stays `created` while it waits on its `needs:` predecessors — that is *pending*, not a terminal state; keep polling. `skipped` **is** terminal and means the rollout never ran (typically because an earlier stage failed): treat it exactly like `failed`.

- `success` / `completed` → continue to step 3b-2. If the surrounding pipeline is still `running`, that is **not** a problem — report it explicitly rather than waiting it out:
  ```
  Deployment grün und verifiziert (Job: <deploy-job-name>).
  Pipeline läuft weiter — offene Jobs: <namen>. Deren Ausgang ist eine
  separate Aussage und blockiert das Ticket nicht.
  ```
- `failed` / `cancelled` / `errored` / `skipped` → surface the job log and the pipeline URL. Do **NOT** override Linear — the ticket stays on "Dev Review" (unassigned) so no one starts PO QA against a broken deploy. Print:
  ```
  Deploy-Job <deploy-job-name> failed — Linear-Status bleibt auf "Dev Review" (unassigned).
  Job:      <job-url>
  Pipeline: <pipeline-url>
  Conclusion: <failed|cancelled|errored|skipped>
  Sobald das Deployment manuell repariert / re-triggered und grün ist,
  kannst du das Ticket manuell auf "PO Review" + Inga setzen.
  ```
  Read the **job's own log** for the diagnosis, not the pipeline overview — a deploy job that fails in seconds usually names its cause outright (missing image tag, auth failure, unhealthy service). Note that deploy logs often stream the target's container logs, so filter to the deploy tool's own output rather than reading the tail blindly.

  Mark this branch of STEP 4b.3 as **partial-success** for the Final Summary (Variant A): merge landed, deploy failed, Linear NOT overridden.
- `running` / `pending` / `created` / `queued` after the timeout → ask the user via `AskUserQuestion`:
  - Question: "Deploy-Job läuft länger als <MAX_DEPLOY_WAIT_MINUTES> Min. Wie weiter?"
  - Options:
    1. "Weiter warten — nochmal <MAX_DEPLOY_WAIT_MINUTES> Min." → reset timer, continue polling
    2. "Nicht warten — Linear-Override jetzt durchführen (riskant, PO testet ggf. stale Build)" → continue to step 3c
    3. "Linear-Status manuell später setzen — Cycle beenden" → skip 3c, print note about pending manual transition

**3b-2. Verify the NEW version's containers are actually healthy** (not just the pipeline / deploy-job status). A green deploy job is **not** proof the new code is running: the deploy platform's aggregate "healthy" count can include **old / superseded** containers that keep serving while the **new** ones crash-loop. Observed live: a deploy reported "3/3 healthy" while the new API container crash-looped on a broken migration and Docker Swarm kept the 22h-old container up — dev ran stale code for ~22h across multiple merges, unnoticed. So, using the deployment platform's container/replica introspection (e.g. the TurboOps MCP tools `get_deployment_status` + `list_deployment_containers` in this stack; `kubectl get pods` / `docker service ps` elsewhere):

- Confirm the containers/replicas whose **image tag matches the merged commit SHA** are running/healthy — not `Exited`, `Restarting`, `CrashLoopBackOff`, or repeatedly recreated.
- Confirm no old-version container is still serving in place of a failed new one (`desired == current`, `running <= total`, and the healthy count refers to the **new** version).
- If the new containers are unhealthy, treat it exactly like a failed deploy pipeline: do **NOT** transition Linear, surface the crash logs (`get_container_logs` / `docker logs`), and **fix the root cause** before the ticket counts as done. Fixing it is in scope even when the cause is pre-existing / infra (e.g. a Dockerfile or migration regression) — a broken deploy blocks the whole team. File a ticket for the root cause (grund-repo if stack-wide) and land the fix rather than leaving dev on stale code.

**3c. Override Linear status + assignee.**

1. Resolve "Inga" via `mcp__plugin_lt-dev_linear__list_users` (filter by name; if ambiguous, ask the user via `AskUserQuestion` to disambiguate).
2. Find the team's "PO Review" workflow state via `mcp__plugin_lt-dev_linear__list_issue_statuses` (case-insensitive match: `PO Review`, `Product Review`, `Product Owner Review`). If no match, surface the error verbatim and skip the override — the merge has already landed, the user can fix Linear manually.
3. Call `mcp__plugin_lt-dev_linear__save_issue` with `stateId = <po-review state id>` and `assigneeId = <inga user id>`.

If `POST_MERGE_STATUS = dev-review`, no Linear override follows — `git:ship` already set "Dev Review" + unassigned. But the healthy-deploy verification (steps 3a → 3b → 3b-2) is **still mandatory**: the cycle is not complete until the new version runs healthy on dev, even though "Dev Review" is a developer/QA state. Do **not** skip the deploy wait + container-health check for `dev-review`.

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

Ticket
- Issue:    <ISSUE_IDENTIFIER> — <Titel>
- Status:   <"Dev Review" | "PO Review">  (vorher: "In Progress")
- Assignee: <entfernt | Inga>

Branch
- Feature: <FEATURE_BRANCH>  (lokal gelöscht / behalten)
- Basis:   <BASE_BRANCH>     (auf neuestem Stand)

Umsetzung
- ACs umgesetzt: <n>/<total>
- Iter-Loops in take-ticket STEP 9: <n>
- Rollen-/Permission-Tests: <n>
- Mitgenommene Änderungen: <liste oder "keine">

Tests vor Merge
- Unit: <n> grün
- API:  <n> grün
- E2E:  <n> grün

Pipeline
- MR/PR:    <REQUEST_URL>
- Attempts: <n>/<MAX>
- Final:    grün

Merge
- Modus:   Squash + Merge (oder: Regular Merge)
- Commit:  <merge-commit-sha-short>

Post-Merge-Deploy  (immer — auch bei POST_MERGE_STATUS = dev-review)
- Deploy-Job:  <job-name> — grün / failed / Timeout (User-Wahl)
- Container:   <n> healthy auf Image-Tag <merge-sha-short>
- Wartezeit:   <n> Min.
- Restpipeline: abgeschlossen / läuft weiter (<offene jobs>) — separat vom Deployment

Linear-Comment
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

Ticket
- Issue:    <ISSUE_IDENTIFIER> — <Titel>
- Status:   "Dev Review"     (vorher: "In Progress")
- Assignee: <REVIEWER.displayName>

Branch
- Feature: <FEATURE_BRANCH>  (lokal noch vorhanden, nicht gemergt)
- Basis:   <BASE_BRANCH>

Umsetzung
- ACs umgesetzt: <n>/<total>
- Iter-Loops in take-ticket STEP 9: <n>
- Rollen-/Permission-Tests: <n>
- Mitgenommene Änderungen: <liste oder "keine">

Tests
- Unit: <n> grün
- API:  <n> grün
- E2E:  <n> grün

MR/PR
- URL:       <REQUEST_URL>
- Reviewer:  <REVIEWER.displayName>  (auf MR eingetragen: ja/nein)

Linear-Comment
- Gepostet / Bearbeitet / Übersprungen

Nächste Schritte (manuell):
- <REVIEWER.displayName> reviewt + merged
- Nach Merge: Status-Folgewechsel (Dev Review → PO Review etc.) manuell oder via Automation
```

If `--review` ran (or the user opted in at STEP 2), include a one-line summary of remaining (non-blocking) findings.

## Hard Rules

- **STEP 0.5 pre-flight cleanup never discards unmerged work.** The cycle deletes a leftover local branch **only** after proving its content is already in the base (true ancestor, or squash/patch-equivalent verified by empty per-file diffs) — a squash-merge rewrites patch-ids, so `git branch -d` refusing is not proof of unmerged work; verify content, then `-D`. On any doubt, a dirty tree, another worktree's branch, or a `backup/*` branch, it deletes **nothing** and surfaces the finding instead. It is scoped to the current worktree's just-shipped leftover, never a mass purge.
- **Limit local Playwright runs to new + affected specs to keep TDD loops fast.** Both Phase A (`take-ticket`) and Phase D (`git:ship` auto-merge path) default to `lt dev test -- <spec>` / `scripts/e2e-fast.sh -- <spec>`; the full Playwright suite is slow and runs in **CI**. Only run the full local suite when the user explicitly asks.
- **Phase C releases its own browser — no idle Chrome survives the cycle.** The `validating-changes-in-browser` skill drives Chrome via the Chrome DevTools MCP; it reuses a single tab wherever possible (`navigate_page`, not a fresh tab per step) and `close_page`s every tab it opened once the walk concludes — on every skill verdict. This is independent of the dev-server decision: even when `lt dev up` is left running (e.g. `WAITING-FOR-USER`, or the STEP 3b "pausieren" choice) so the user can re-test, the automation browser is still closed to save resources.
- **Never bypass `take-ticket` STEP 9.** The re-analysis user gate is the cycle's contract for completeness — if it didn't run cleanly, this command must not proceed.
- **Minimise follow-up tickets; gate dependent ones behind the merge.** The cycle's job is to *implement* the ticket, not to shard it into new tickets — anything that can reasonably be done inside this change is done here, not deferred to a follow-up. A separate follow-up ticket is justified only when the work is a genuinely necessary, **completely** out-of-scope feature that can be built in parallel. Critically, a follow-up that can only be worked **after this ticket is merged into the base branch** (`dev` / `development`) must NOT be created until that merge has landed: the auto-pick filter (STEP 1 Phase 1) admits every unassigned "Open" ticket, so a dependent follow-up filed early gets picked up by another parallel `ticket-cycle` session and started against unmerged code. Carry such follow-ups as `out_of_scope_findings` / "Offen / separat empfohlen" **only**, and create the real ticket **after** STEP 4b's healthy-dev-deploy verification confirms the base merge is live. Only genuinely independent, parallelizable follow-ups may be filed immediately.
- **The manual re-test handoff (STEP 3b) always runs before Phase D on a `READY-TO-SHIP` verdict.** The cycle MUST NOT jump from the autonomous browser walk straight into merging without first emitting the manual re-test manual (Änderungs-Zusammenfassung + Credentials + Testdaten + Schritt-für-Schritt) and passing its Freigabe-Gate. The manual is assembled from Phase C's returned outputs — no second browser walk — and only the explicit "Direkt zu Phase D" choice proceeds to STEP 4.
- **When the user picks "Ich teste selbst" (STEP 3b option 2 — incl. any free-text equivalent — or the Phase C `WAITING-FOR-USER` verdict), the cycle MUST first run the Manual-Test Preparation routine and hand over all five deliverables before pausing:** (1) passende Testdaten in der laufenden Dev-DB vorbereitet (nicht die `-test`-DB), (2) Upload-Testdateien erzeugt *falls* die Änderung ein Upload-Feld betrifft (sonst bewusst keine), (3) kurze, leicht verständliche Zusammenfassung von Ticket + Testziel, (4) Credentials aller benötigten Accounts mit literalen Passwörtern, (5) Schritt-für-Schritt-Anleitung mit vollständigen URLs (auf echte Datensätze zeigend) und genauem was/wie/warum je Schritt. Pausing on this path without these five is a contract violation.
- **The merge-strategy gate (STEP 4a) is mandatory** unless the user passed `--auto-merge` or `--review-handoff` explicitly. The cycle MUST NOT default-to-merge without an explicit decision.
- **The post-merge-status gate (STEP 4b.1) is mandatory** in the auto-merge path unless the user passed `--post-merge-status=…`. The cycle MUST NOT silently pick a Linear state when two are configured.
- **A ticket is DONE only after a clean, healthy dev deploy (STEP 4b.3) — for EVERY ticket, including pure dev-tooling / config-only / test-only changes.** The auto-merge path MUST NOT report the cycle complete, and MUST NOT transition / push the Linear status forward, until (a) the post-merge **deploy job** on `<BASE_BRANCH>` is green AND (b) the **new** containers/replicas of the merged commit are verifiably running and healthy. Anchor on the deploy *job*, not the pipeline: a pipeline may carry unrelated long-running work (image builds for other consumers, publishing, notifications) whose outcome says nothing about whether the server is running the merged code — waiting for it either stalls a finished deployment or paints it red for a foreign failure (observed: an appliance image build ran >1 h next to a 6-minute rollout). A green merge or a green deploy *job* is not enough: the platform's aggregate "healthy" count can include old/superseded containers that keep serving while the new ones crash-loop (observed: a "3/3 healthy" deploy while the new API crash-looped and Swarm served the 22h-old build — dev stale for ~22h, unnoticed). Verify container health against the merged image tag (`get_deployment_status` + `list_deployment_containers` in this stack). If the new containers are unhealthy or the deploy failed/timed out, the ticket stays on "Dev Review" (unassigned), the crash logs are surfaced, and the **root cause is fixed** (in scope even when pre-existing/infra; grund-repo if stack-wide) before the ticket counts as done.
- **The PO Review transition (STEP 4b.3) additionally waits for that healthy dev deploy.** When `POST_MERGE_STATUS = po-review-inga`, the cycle MUST NOT set the Linear ticket to "PO Review" / assignee=Inga until the healthy-deploy verification above passes. POs starting QA against a stale build burn cycles and erode trust in the handoff. If the deploy fails or times out, the ticket stays on "Dev Review" (unassigned) and the user is told to redo the transition manually after fixing the deploy.
- **Reviewer-Handoff never merges from inside this command.** Phase D's reviewer-handoff path stops after MR/PR creation, Linear assignment, and MR reviewer assignment. The human reviewer does the merge.
- **Auto-merge path always runs `git:ship --auto-merge --skip-reanalysis`** because Phase A already did the equivalent re-analysis and STEP 4a already captured the merge consent. Running them twice would re-prompt the user pointlessly.
- **Auto-merge path (GitLab): the merge waits for a green pipeline via `git:ship` STEP 7 → STEP 8 — never let glab's native `--auto-merge` fire on a `pending` pipeline.** `git:ship --auto-merge` only skips the STEP 8 confirmation; the merge itself still happens **after** STEP 7 polled the pipeline to `success`, then a plain `glab mr merge --squash` (squash is correct **only because this cycle always ships a feature branch** — Phase A creates `feature/<ticket>` — so the source is never a base branch; see the base-branch rule below). Do **not** substitute glab's native merge-when-pipeline-succeeds (`glab mr merge --auto-merge`) on a freshly-created pipeline: glab arms it only while the pipeline is `running`, and on a `pending` one it prints `! No pipeline running` and **merges immediately** — the MR lands before CI, and the full validation (`api:test`/`app:test`) then runs **post-merge on `dev`** instead of gating the merge (observed live: DEV-2574 merged on a `pending` pipeline; CI + the deploy verification in STEP 4b.3 caught it, but the merge should have waited). If native auto-merge is ever used, arm it only once the pipeline status is `running`. Either way, STEP 4b.3's healthy-dev-deploy verification is still mandatory afterward.
- **The auto-merge (squash) path only ever runs on a feature branch — base branches are never squashed.** Phase A (`take-ticket`) always creates a `feature/<ticket>` branch, so Phase D's `git:ship` squash-merges a **feature source**, never a base branch. Base→higher-base promotions (`dev`/`develop` → `test`/`main`, `test` → `main`) are **not** part of this cycle: run `/lt-dev:git:ship` directly on the base branch, where STEP 0 classifies the source and auto-selects a **regular merge** (`MERGE_MODE = regular`) — never a squash — to preserve each branch's history.
- **Auto-merge path MUST rebase onto the latest base branch before pushing — and re-verify if the rebase changed anything.** `git:ship` STEP 3 rebases the feature branch onto a freshly fetched `origin/<base>`; STEP 4 then re-runs the full **Unit + API + affected-E2E** suites AND the `check` script whenever the rebase altered the working tree (it skips re-testing only when the post-rebase tree is byte-identical to the pre-rebase tree). This guarantees the branch is validated against the exact code it will merge into — **never push or merge a branch that was only tested against a stale base.** If the rebase produces conflicts, or the post-rebase re-verify goes red, fix to green before continuing; do not push a branch whose rebased state was not re-validated. The whole pipeline (incl. the `api:audit` security gate) must be green — a pre-existing red job is a blocker, not an excuse.
- **No silent fallbacks between phases.** If a phase reports failure or partial state, surface and stop.

## Failure Handling

On unrecoverable error in any phase:

1. Mark the corresponding TodoWrite item as failed.
2. Surface the failing phase's structured diagnosis verbatim. Do not paraphrase — the user needs the same detail the sub-command would have printed standalone.
3. Print the current cycle state: which phases ran, current branch, Linear ticket state.
4. Do **not** print the success summary.
