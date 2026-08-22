---
description: Full ticket lifecycle in one command — auto-pick (or take ID), TDD-implement with per-slice check + commit, re-analyse, optional review, browser walk, manual re-test handoff (summary + credentials + test data + step-by-step), rebase + tests + check, MR/PR (auto-merge OR reviewer-handoff), CI, squash-merge, delete branch, Linear comment + status handoff
argument-hint: "[issue-id | --project=<name> --team=<name> --status=<list> --base=<branch> --figma=<url> --flows=<path> --review --no-review --auto-merge --review-handoff[=<linear-user>] --post-merge-status=<dev-review|qa-testing[=<linear-user>]> --max-deploy-wait=<minutes> --max-pipeline-retries=<n> --no-squash --keep-branch]"
allowed-tools: Agent, Read, Grep, Glob, Write, Edit, AskUserQuestion, TodoWrite, Bash(git:*), Bash(gh:*), Bash(glab:*), Bash(echo:*), Bash(ls:*), Bash(cat:*), Bash(grep:*), Bash(jq:*), Bash(test:*), Bash(sleep:*), Bash(wc:*), Bash(bash ${CLAUDE_PLUGIN_ROOT}/scripts/*), Bash(node:*), Bash(pnpm run check:*), Bash(npm run check:*), Bash(yarn run check:*), Bash(pnpm check:*), Bash(npm check:*), Bash(yarn check:*), Bash(pnpm run test:*), Bash(npm run test:*), Bash(yarn run test:*), Bash(pnpm test:*), Bash(npm test:*), Bash(yarn test:*), Bash(pnpm run lint:*), Bash(npm run lint:*), Bash(yarn run lint:*), Bash(pnpm run typecheck:*), Bash(npm run typecheck:*), Bash(yarn run typecheck:*), Bash(pnpm run build:*), Bash(npm run build:*), Bash(yarn run build:*), Bash(pnpm install:*), Bash(npm install:*), Bash(yarn install:*), Bash(npx playwright:*), Bash(pnpm exec playwright:*), mcp__plugin_lt-dev_linear__list_teams, mcp__plugin_lt-dev_linear__list_projects, mcp__plugin_lt-dev_linear__list_issue_statuses, mcp__plugin_lt-dev_linear__list_issues, mcp__plugin_lt-dev_linear__get_issue, mcp__plugin_lt-dev_linear__list_comments, mcp__plugin_lt-dev_linear__save_issue, mcp__plugin_lt-dev_linear__save_comment, mcp__plugin_lt-dev_linear__get_user, mcp__plugin_lt-dev_linear__list_users, mcp__plugin_figma_figma__get_design_context, mcp__plugin_figma_figma__get_metadata, mcp__plugin_figma_figma__get_screenshot, SlashCommand
disable-model-invocation: false
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
| `writing-qa-test-instructions` skill | Owns the QA-testability classification and the German QA test instructions posted to Linear (STEP 4b.1a + 4b.3c) |
| `/lt-dev:git:ship` | Phase D (auto-merge path) — rebase/test/check/MR-PR/CI-wait/squash-merge/branch-delete/Linear-handoff |
| `/lt-dev:dev-submit` | Phase D (reviewer-handoff path) — MR/PR + Linear comment + status → Dev Review |
| `grilling-decisions` skill | Settles open ticket questions with the user inside Phase A, before any code is written |
| `building-stories-with-tdd` skill | Drives the TDD inside Phase A |
| `running-check-script` skill | Drives the check loop (per-slice + final, both ship paths) |
| `managing-dev-servers` skill | Rules for backgrounded servers during E2E |
| `rebasing-branches` skill | Drives the rebase inside the auto-merge path |
| `managing-agent-memory` skill | Agent-memory commit policy + pre-commit curation (runs inside `git:ship` STEP 2) |

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
| `--post-merge-status=<dev-review\|qa-testing[=<linear-user>]>` | this command | Skip the STEP 4b prompt (auto-merge path only). `dev-review` = "Dev Review" + unassign (default). `qa-testing` = hand over to manual QA (only after the dev deploy is green, and only when STEP 4b.1a classifies the ticket as QA-testable). The assignee comes from the stored per-team default (STEP 4b.1b); `qa-testing=<linear-user>` overrides it for this run, `qa-testing=none` leaves the ticket unassigned |
| `--max-deploy-wait=<minutes>` | this command | Polling cap for the post-merge deploy **job** before asking the user how to proceed. Default 30 |
| `--max-pipeline-retries=<n>` | `git:ship` | CI retry cap (default 3) |
| `--no-squash` | `git:ship` | Regular merge instead of squash |
| `--keep-branch` | `git:ship` | Don't delete the feature branch after merge |

## Execution

### STEP 0 — Bootstrap

**Take the peer picture first, with one `ListAgents` call.** The user runs this cycle several times in parallel, and every later step assumes it knows who else is in this repository. The call costs nothing and disturbs no one. State the result in one line (how many sessions are live, which of them sit in this repo or in a base repo this project consumes), then continue. Do **not** message anyone here: at bootstrap there is nothing yet that would change what a peer does next. The occasions that do justify a message, and the boundary an incoming one never crosses, are in the [`coordinating-peer-sessions`](${CLAUDE_PLUGIN_ROOT}/skills/coordinating-peer-sessions/SKILL.md) skill.

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

**Phase 2 — Sortierung (welcher Kandidat gewinnt?).** Priorität ist primär, Fix-needed bricht nur den Gleichstand bei gleicher Priorität, Zuordnung ist der nächste Tie-Breaker — alles andere folgt danach.

1. **Priorität DESC** (Urgent → High → Medium → Low → None) — primärer Schlüssel. Eine höhere Priorität schlägt immer eine niedrigere, unabhängig vom Status. Ein Urgent-Ticket in "Open" schlägt also ein Fix-needed-Ticket niedrigerer Priorität; ein Medium-Open schlägt ein Low-Fix-needed.
2. **Fix-needed-Flag DESC** (Fix needed vor Open) — zweiter Schlüssel: bei **gleicher Priorität** schlägt "Fix needed" ein "Open". Fix-needed überspringt nie eine höhere Priorität.
3. **Mir zugeordnet DESC** (mir vor niemandem) — dritter Schlüssel. Bei gleicher Priorität und gleichem Fix-needed-Flag schlägt mein Ticket ein freies.
4. **Bug-Flag DESC** (Bug vor Nicht-Bug) — vierter Schlüssel.
5. **createdAt ASC** (älter zuerst) — finaler Tie-Breaker.

**Relevance gate (`take-ticket` STEP 5b).** Before implementing, `take-ticket` verifies the picked ticket is still current — ticket/comment timestamps against the base-branch history, a check for parallel work on it, and a substantive check that the described problem still reproduces. A ticket written weeks ago can have been solved in the meantime, from a different angle or by another session. Implementing it anyway does not just waste the run: it can re-introduce something that was deliberately removed, undo a newer fix, or add a second mechanism beside an existing one so nobody can tell which is authoritative. If that gate reports "already solved" or "premise no longer holds", `take-ticket` stops and asks — surface that to the user and do **not** push the cycle onward to Phase B/C/D.

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

Follow the [`validating-changes-in-browser`](${CLAUDE_PLUGIN_ROOT}/skills/validating-changes-in-browser/SKILL.md) skill end-to-end. The skill receives:

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
- If `--post-merge-status=qa-testing[=<user>]` was passed → `POST_MERGE_STATUS = qa-testing`, capture the optional assignee override, skip the prompt.
- Otherwise → ask the user via `AskUserQuestion`:
  - Question: "Welcher Linear-Status nach dem Merge?"
  - Options:
    1. "Dev Review — Assignee entfernen (Default)" → `POST_MERGE_STATUS = dev-review`
    2. "QA Testing — an manuelles Testen übergeben" → `POST_MERGE_STATUS = qa-testing`
    3. "Abbrechen" → stop here, branch remains local

**1a. QA-Testbarkeit klassifizieren.** Runs **only** when `POST_MERGE_STATUS = qa-testing`, and **before** the ship, so the routing decision is on screen before anything lands.

"QA Testing" sits in front of "UA Testing" and is worked by people who do not read code. A ticket that cannot be exercised through the running application does not belong there: it occupies a testing column nobody can clear, and the tester spends their round-trip finding out that there was never anything to click. Such a ticket goes straight to **"Awaiting Release"** instead.

Follow [`writing-qa-test-instructions`](${CLAUDE_PLUGIN_ROOT}/skills/writing-qa-test-instructions/SKILL.md) **Part 1** for the classification. Its evidence is Phase C's `final_list` plus the diff — never the ticket title. Set `QA_TESTABLE = true|false` and capture `QA_CLASSIFICATION_REASON` (one sentence, non-developer language).

- `QA_TESTABLE = true` → keep `POST_MERGE_STATUS = qa-testing`.
- `QA_TESTABLE = false` → set `POST_MERGE_STATUS = awaiting-release` and tell the user, before shipping:

  ```
  Kein QA-Testing möglich: <QA_CLASSIFICATION_REASON>
  Ziel-Status nach dem Merge: "Awaiting Release" statt "QA Testing".
  ```

  This is a **statement, not a gate** — the cycle continues without a prompt. The user overrides it by re-running with `--post-merge-status=qa-testing` after adding whatever makes the change observable, or by moving the ticket by hand.

**1b. QA-Assignee auflösen.** Runs **only** when STEP 4b.1a left `POST_MERGE_STATUS = qa-testing` — a ticket rerouted to "Awaiting Release" needs no QA assignee, and asking for one would be a prompt about a handover that is not happening.

Who tests is a property of the *team*, not of this plugin — so the default lives in the plugin's persistent data directory on this machine, never in the plugin itself. Resolve `QA_ASSIGNEE` in this order and stop at the first hit:

1. **Flag override** — `qa-testing=<linear-user>` resolves that identifier via `mcp__plugin_lt-dev_linear__list_users`; `qa-testing=none` means unassigned. A one-off override is **not** persisted: an explicit flag answers this run, it does not silently rewrite the team's default.
2. **Stored default** — read `${CLAUDE_PLUGIN_DATA}/qa-handover.json` (literal path: `~/.claude/plugins/data/lt-dev-lenne-tech/qa-handover.json`) and look up the ticket's Linear team key:

   ```json
   {
     "teams": {
       "<linear-team-key>": { "qaAssigneeId": "<linear-user-id>", "qaAssigneeName": "<display name>" }
     }
   }
   ```

   `"qaAssigneeId": null` is a **stored decision** to leave QA tickets unassigned — honour it and do not re-ask.
3. **Ask once, then persist** — no entry for this team yet → `AskUserQuestion`:
   - Question: "Wer bekommt QA-Testing-Tickets im Team `<team-key>` zugewiesen? (wird gemerkt)"
   - Options: up to 3 likely candidates from `mcp__plugin_lt-dev_linear__list_users` (e.g. recent assignees on this team's tickets), plus "Niemand — unassigned lassen". "Other" takes a name or e-mail.
   - Write the answer back to `qa-handover.json` (creating the file if absent), keyed by team, and say so in one line: `QA-Assignee für <team-key> gemerkt: <name>. Änderbar via --post-merge-status=qa-testing=<user> oder durch Editieren von <pfad>.`

The file is per-machine and outside every repository, so a team member's name never enters the marketplace or a customer repo. The question therefore costs one answer per Linear team, once — every later cycle on that team runs unprompted.

**2. Ship invoken.** Call `git:ship` with `--auto-merge --skip-reanalysis` plus any forwarded ship flags:

```
/lt-dev:git:ship --auto-merge --skip-reanalysis <forwarded ship flags>
```

The `--skip-reanalysis` flag tells `git:ship` to bypass its STEP 1.5 because `take-ticket` STEP 9 already did the equivalent re-analysis. **Do not** pass `--skip-reanalysis` when invoking `git:ship` directly.

If `git:ship` reports failure (rebase conflicts unresolved, CI retry cap hit, merge rejected, …), surface its diagnosis and stop. The feature branch is intentionally **not** deleted on failure — manual recovery is always possible.

**3. Verify the dev deploy is healthy — then (optionally) override Linear.** **Mandatory for BOTH post-merge statuses, including pure dev-tooling / config-only / test-only tickets.**

A ticket is only **done** — and its Linear status is only transitioned / pushed forward — once the merged code is **actually running healthy on dev**: the merge landed AND the **new** containers/replicas of the merged version are up and healthy. A merge alone is **not** "done": the deploy can still fail (broken migration, missing/short env var, crash-loop, bad image), in which case the orchestrator silently keeps serving the **old** build and dev is stale without anyone noticing. This applies even to dev-tooling changes that don't run in the container — the deploy itself must still complete cleanly, because a broken deploy blocks every later ticket too.

`git:ship` STEP 10 has already set the ticket to "Dev Review" (unassigned) — a safe waiting state during deployment. For `POST_MERGE_STATUS = qa-testing` and `awaiting-release`, the forward transition additionally must **not** happen until the deploy is healthy (a tester opening a stale build burns a test cycle). For `dev-review`, no status override follows, but the cycle is **not** reported complete until this verification passes.

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
  3. "Manuell setzen — Cycle beenden ohne Override" → skip 3c, print a note that the forward transition is pending manual deployment confirmation

**3b. Wait for the DEPLOY JOB to complete.** Poll `DEPLOY_JOB` every 30 seconds, capped at `MAX_DEPLOY_WAIT_MINUTES` (default 30, override via `--max-deploy-wait=<minutes>`) — **not** the pipeline as a whole (see 3a). Poll the **job object** by id, which carries no free-text field — GitLab `glab api "projects/:id/jobs/<job-id>" | jq -r '.status'`, GitHub `gh run view <run-id> --json jobs` → the matched job's `status`/`conclusion`. On the 3a fallback (no deploy job identifiable) poll the pipeline object instead: GitHub `gh run view <id> --json status,conclusion`, GitLab `glab api "projects/:id/pipelines/<id>" | jq -r '.status'`.

**Never** derive the status by `jq`-ing `glab mr view/list --output json` — glab emits literal control chars in the MR `description`/`title`, `jq` aborts, the read comes back empty, and a poll that treats empty as "still running" loops **blind** past the actual green/failed state (see `git:ship` STEP 7a). Treat an empty/parse-failed read as a transient retry, and exit on every terminal state.

A GitLab job stays `created` while it waits on its `needs:` predecessors — that is *pending*, not a terminal state; keep polling. `skipped` **is** terminal and means the rollout never ran (typically because an earlier stage failed): treat it exactly like `failed`.

- `success` / `completed` → continue to step 3b-2. If the surrounding pipeline is still `running`, that is **not** a problem — report it explicitly rather than waiting it out:
  ```
  Deployment grün und verifiziert (Job: <deploy-job-name>).
  Pipeline läuft weiter — offene Jobs: <namen>. Deren Ausgang ist eine
  separate Aussage und blockiert das Ticket nicht.
  ```
- `failed` / `cancelled` / `errored` / `skipped` → surface the job log and the pipeline URL. Do **NOT** override Linear — the ticket stays on "Dev Review" (unassigned) so no one starts manual QA against a broken deploy. Print:
  ```
  Deploy-Job <deploy-job-name> failed — Linear-Status bleibt auf "Dev Review" (unassigned).
  Job:      <job-url>
  Pipeline: <pipeline-url>
  Conclusion: <failed|cancelled|errored|skipped>
  Sobald das Deployment manuell repariert / re-triggered und grün ist,
  kannst du das Ticket manuell auf "<QA Testing | Awaiting Release>" setzen.
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

**3c. Testanleitung sicherstellen, dann Linear-Status + Assignee überschreiben.**

**1. Testanleitung verifizieren — vor jeder Transition.** `git:ship` STEP 10c already posted the German "Umsetzung + Testanleitung" comment, following the same [`writing-qa-test-instructions`](${CLAUDE_PLUGIN_ROOT}/skills/writing-qa-test-instructions/SKILL.md) skill. Confirm via `mcp__plugin_lt-dev_linear__list_comments` that it is actually on the ticket, and that its shape matches `QA_TESTABLE`.

- Comment present and matching → continue to step 2.
- Comment missing (the user chose "Überspringen" at ship STEP 10c) or its shape contradicts the classification → generate it now per the skill and post it via `mcp__plugin_lt-dev_linear__save_comment`, then continue.
- Posting fails (permissions, archived issue) → surface the error verbatim, **do not transition**. The ticket rests on "Dev Review" (unassigned) and the summary reports the merge as landed with the QA handover pending. A ticket sitting in a testing column without instructions is indistinguishable from one nobody has looked at.

**2. Transition ausführen** — target depends on `POST_MERGE_STATUS`:

| `POST_MERGE_STATUS` | Ziel-State | Match (case-insensitive, first hit wins) | Assignee |
|---------------------|-----------|-------------------------------------------|----------|
| `qa-testing` | QA Testing | `QA Testing`, `QA Test`, `QA`, `PO Review` | `QA_ASSIGNEE` from STEP 4b.1b (`null` → unassigned) |
| `awaiting-release` | Awaiting Release | `Awaiting Release`, `Ready for Release`, `Release` | unassigned |

1. Find the state via `mcp__plugin_lt-dev_linear__list_issue_statuses` on the ticket's team. If no name matches, surface the team's actual state list and ask the user via `AskUserQuestion` which one to use — the merge has already landed, so never guess and never silently skip.
2. Call `mcp__plugin_lt-dev_linear__save_issue` with the resolved `stateId` and `assigneeId` (`QA_ASSIGNEE` was already resolved in STEP 4b.1b; `null` where the table says unassigned).

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
- Status:   <"Dev Review" | "QA Testing" | "Awaiting Release">  (vorher: "In Progress")
- Assignee: <entfernt | QA_ASSIGNEE>

QA-Übergabe
- Manuell testbar: <ja | nein — QA_CLASSIFICATION_REASON>
- Testanleitung:   <als Linear-Comment gepostet | fehlt — Transition ausgesetzt>

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
- Bei failed Deploy: nach Fix manuell auf "<QA Testing | Awaiting Release>" setzen
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
- Nach Merge: Status-Folgewechsel (Dev Review → QA Testing / Awaiting Release) manuell oder via Automation
```

If `--review` ran (or the user opted in at STEP 2), include a one-line summary of remaining (non-blocking) findings.

## Hard Rules

- **STEP 0.5 pre-flight cleanup deletes a leftover branch only against proof that its content already lives in the base** — a true ancestor, or squash/patch-equivalent verified by empty per-file diffs. A squash-merge rewrites patch-ids, so `git branch -d` refusing says nothing about whether the work is merged; verify the content, then `-D`. Everything short of that proof — a dirty tree, another worktree's branch, a `backup/*` branch, or plain doubt — is surfaced as a finding and left in place for manual recovery. Its scope is the current worktree's just-shipped leftover, one branch, not a purge of local history.
- **Limit local Playwright runs to new + affected specs to keep TDD loops fast.** Both Phase A (`take-ticket`) and Phase D (`git:ship` auto-merge path) default to `lt dev test -- <spec>` (non-lt projects: `pnpm exec playwright test <spec>`); the full Playwright suite is slow and runs in **CI**. Only run the full local suite when the user explicitly asks.
- **Phase C releases its own browser — no idle Chrome survives the cycle.** The `validating-changes-in-browser` skill drives Chrome via the Chrome DevTools MCP; it reuses a single tab wherever possible (`navigate_page`, not a fresh tab per step) and `close_page`s every tab it opened once the walk concludes — on every skill verdict. This is independent of the dev-server decision: even when `lt dev up` is left running (e.g. `WAITING-FOR-USER`, or the STEP 3b "pausieren" choice) so the user can re-test, the automation browser is still closed to save resources.
- **A green `check` is the precondition for every MR/PR and every merge in this cycle.** The `check` script runs in the [`running-check-script`](${CLAUDE_PLUGIN_ROOT}/skills/running-check-script/SKILL.md) skill's **Blocking** mode at three points: `take-ticket` STEP 8 (Phase A), and `git:ship` STEP 1 and STEP 4b (Phase D). At each one, **every** error is fixed at its root, across **every** discovered project — pre-existing errors included, because whether an error came from this ticket makes no difference to whether the project runs, and it blocks the next person just as hard either way. The deciding question is only ever "can this be fixed?", and while the answer is yes, it gets fixed; `STALLED` means attack it differently, not give up.

  The single Accepted residual is a dependency CVE whose full six-step escalation ladder is exhausted and documented. Everything else that stays red stops the cycle: no push, no MR/PR, no merge, branch left local and intact. A red `check` landing on `dev` turns CI red for the whole team, and the next auto-pick then branches off that broken state — which is why this gate sits before the MR and not after it.
- **`take-ticket` STEP 9 gates everything after Phase A.** Its re-analysis user gate is the cycle's contract for completeness, so Phase B onward runs on one condition: STEP 9 completed cleanly and the user confirmed. Any other outcome ends the cycle with that diagnosis surfaced.
- **Follow-up tickets follow `take-ticket` STEP 9a, which owns that rule in full** — when to absorb a finding rather than file it, the parallel-work test that decides it, the `Open` / `Blocked` / project-assigned states a filed one gets, and the carry-to-completion duty for a ticket whose content gets absorbed. Read it there; it is the single source of truth, so a change to the policy is a one-place edit.

  **The cycle adds exactly one thing to it: the moment a `Blocked` follow-up becomes takeable.** A follow-up that needed this ticket merged moves from `Blocked` to `Open` once STEP 4b's healthy-dev-deploy verification confirms the merge is actually live — not at merge time, and not at the end of the cycle. Standalone `take-ticket` runs have no such verification, so they release after the merge lands; the cycle waits for the deploy, because a follow-up released against code that merged but never deployed is worked against a stale dev.
- **On a `READY-TO-SHIP` verdict, the path from Phase C to Phase D runs through the manual re-test handoff (STEP 3b).** The cycle emits the manual (Änderungs-Zusammenfassung + Credentials + Testdaten + Schritt-für-Schritt), passes its Freigabe-Gate, and enters STEP 4 on the explicit "Direkt zu Phase D" choice — that single choice is the whole entry condition. The manual is assembled from Phase C's returned outputs, so no second browser walk happens here.
- **When the user picks "Ich teste selbst" (STEP 3b option 2 — incl. any free-text equivalent — or the Phase C `WAITING-FOR-USER` verdict), the cycle MUST first run the Manual-Test Preparation routine and hand over all five deliverables before pausing:** (1) passende Testdaten in der laufenden Dev-DB vorbereitet (nicht die `-test`-DB), (2) Upload-Testdateien erzeugt *falls* die Änderung ein Upload-Feld betrifft (sonst bewusst keine), (3) kurze, leicht verständliche Zusammenfassung von Ticket + Testziel, (4) Credentials aller benötigten Accounts mit literalen Passwörtern, (5) Schritt-für-Schritt-Anleitung mit vollständigen URLs (auf echte Datensätze zeigend) und genauem was/wie/warum je Schritt. Pausing on this path without these five is a contract violation.
- **The merge strategy is always a stated decision (STEP 4a):** either the user passed `--auto-merge` / `--review-handoff`, or the gate asks and they answer. Those two are the only ways `MERGE_STRATEGY` gets a value.
- **The post-merge Linear state is always a stated decision (STEP 4b.1)** on the auto-merge path: either `--post-merge-status=…` supplied it, or the gate asks. Two states are offered, so the cycle picks one only by way of an answer. The `qa-testing` answer can still be re-routed to `awaiting-release` by STEP 4b.1a, which is a classification, not a second choice.
- **"QA Testing" is reached only by a ticket that a non-developer can actually test, and only together with its instructions.** The column sits in front of "UA Testing" and is worked by people who do not read code, so both conditions are checked before the transition: STEP 4b.1a classifies testability from the diff and Phase C's walked flows (never from the ticket title), and STEP 4b.3c confirms the German test instructions are on the ticket. A ticket that fails the classification goes to "Awaiting Release" with its one-sentence reason stated. A ticket whose instructions cannot be posted does **not** move at all — it rests on "Dev Review" (unassigned) and the summary reports the QA handover as pending. Both failure shapes cost a tester a round-trip: an untestable ticket in a testing column is one nobody can clear, and an instruction-less one is indistinguishable from a ticket nobody has looked at. The classification, the format, and the credentials rule live in [`writing-qa-test-instructions`](${CLAUDE_PLUGIN_ROOT}/skills/writing-qa-test-instructions/SKILL.md) — a change to the policy is a one-place edit there.
- **Who tests is team state, not plugin state.** The QA assignee default lives in `${CLAUDE_PLUGIN_DATA}/qa-handover.json` on the running machine, keyed by Linear team — never in the plugin, and never in a project repository. A person's name hard-coded into a published plugin is personal data shipped to every installation, and it is wrong for every team but one. The command therefore asks once per team and remembers the answer, so the automation is identical from the second run onward.
- **The Linear test instructions name roles, never passwords** — a Linear comment is workspace-readable and archived indefinitely. This is the deliberate opposite of STEP 3b's local re-test manual, which does carry literal `@test.com` passwords because it stays in the developer's own session and points at their local dev DB. Never copy the credentials block from the one into the other.
- **A ticket is DONE once a clean, healthy dev deploy is verified (STEP 4b.3) — for EVERY ticket, including pure dev-tooling / config-only / test-only changes.** The auto-merge path reports the cycle complete, and pushes the Linear status forward, on exactly two conditions: (a) the post-merge **deploy job** on `<BASE_BRANCH>` is green AND (b) the **new** containers/replicas of the merged commit are verifiably running and healthy. Until both hold, the ticket rests on "Dev Review" (unassigned) and the cycle stays open. Anchor on the deploy *job*, not the pipeline: a pipeline may carry unrelated long-running work (image builds for other consumers, publishing, notifications) whose outcome says nothing about whether the server is running the merged code — waiting for it either stalls a finished deployment or paints it red for a foreign failure (observed: an appliance image build ran >1 h next to a 6-minute rollout). A green merge or a green deploy *job* is not enough: the platform's aggregate "healthy" count can include old/superseded containers that keep serving while the new ones crash-loop (observed: a "3/3 healthy" deploy while the new API crash-looped and Swarm served the 22h-old build — dev stale for ~22h, unnoticed). Verify container health against the merged image tag (`get_deployment_status` + `list_deployment_containers` in this stack). If the new containers are unhealthy or the deploy failed/timed out, the ticket stays on "Dev Review" (unassigned), the crash logs are surfaced, and the **root cause is fixed** (in scope even when pre-existing/infra; grund-repo if stack-wide) before the ticket counts as done.
- **The forward transition (STEP 4b.3) waits for that same healthy dev deploy.** When `POST_MERGE_STATUS` is `qa-testing` or `awaiting-release`, the cycle moves the ticket once the verification above passes, and only then — a tester opening a stale build burns a QA cycle and erodes trust in the handoff. On a failed or timed-out deploy the ticket rests on "Dev Review" (unassigned), and the user is told to redo the transition by hand after fixing the deploy.
- **Reviewer-Handoff ends at the handoff.** Phase D's reviewer-handoff path closes after MR/PR creation, Linear assignment, and MR reviewer assignment. The merge belongs to the human reviewer.
- **Auto-merge path always runs `git:ship --auto-merge --skip-reanalysis`** because Phase A already did the equivalent re-analysis and STEP 4a already captured the merge consent. Running them twice would re-prompt the user pointlessly.
- **Auto-merge path (GitLab): the merge happens after `git:ship` STEP 7 polled the pipeline to `success`, via a plain `glab mr merge --squash` in STEP 8.** `git:ship --auto-merge` skips the STEP 8 *confirmation*, nothing else — the green-pipeline wait stays. (Squash is correct here **only because this cycle always ships a feature branch**: Phase A creates `feature/<ticket>`, so the source is never a base branch. See the base-branch rule below.)

  **glab's native merge-when-pipeline-succeeds (`glab mr merge --auto-merge`) is armable only while the pipeline is already `running`.** On a freshly created, still-`pending` pipeline it prints `! No pipeline running` and merges **immediately**: the MR lands before CI, and the full validation (`api:test` / `app:test`) then runs post-merge on `dev` instead of gating the merge. Observed live on DEV-2574 — CI and the STEP 4b.3 deploy verification caught it, but the merge should have waited. So the poll-then-merge path above is the one this cycle takes; where native auto-merge is used at all, it is armed only once the pipeline reads `running`. Either way, STEP 4b.3's healthy-dev-deploy verification still follows.
- **The auto-merge (squash) path applies to feature branches, which is all this cycle ever ships.** Phase A (`take-ticket`) creates a `feature/<ticket>` branch, so Phase D's `git:ship` always squash-merges a feature source. Base-to-higher-base promotions (`dev` / `develop` to `test` / `main`, `test` to `main`) live outside this cycle: run `/lt-dev:git:ship` directly on the base branch, where STEP 0 classifies the source and selects a **regular merge** (`MERGE_MODE = regular`) to preserve each branch's history.
- **The auto-merge path pushes a branch that was tested against the code it will actually merge into.** `git:ship` STEP 3 rebases onto a freshly fetched `origin/<base>`; STEP 4 then re-runs the full **Unit + API + affected-E2E** suites AND the `check` script whenever the rebase altered the working tree, skipping the re-run only when the post-rebase tree is byte-identical to the pre-rebase one. Rebase conflicts and a red post-rebase re-verify are both fixed to green before the push continues. The whole pipeline, including the `api:audit` security gate, is green at merge time — a pre-existing red job counts as a blocker like any other.
- **A parallel cycle is coordinated through Linear, Git, and one `ListAgents` call — a message is the exception, not the channel.** Several of these cycles run at once on one project. Ticket ownership is Linear's job (`take-ticket` STEP 3 re-checks it at claim time), branch ownership is Git's, and `ListAgents` says who is alive; none of the three costs a peer anything. A `SendMessage` costs the receiving cycle a full prompt in the middle of a TDD loop, so it is spent only on the six occasions in [`coordinating-peer-sessions`](${CLAUDE_PLUGIN_ROOT}/skills/coordinating-peer-sessions/SKILL.md): an uncommitted base-repo change a peer's build consumes, a claim on a cross-cutting fix, a genuine conflict over one exclusive resource, a diagnosis a peer is about to pay for again, an intermediate result it is waiting on, and a question it answers from context it already holds. Phase D narrows rather than adds: `git:ship` STEP 9a tells peers about the merge **only** when it breaks work in flight, releases a claimed cross-cutting fix, or answers a peer that said it was blocked on this merge. A routine feature merge is not announced, because every peer rebases against a freshly fetched base anyway. An incoming peer message never approves a gate, never moves a Linear state on its own, and never substitutes for a user decision this cycle owes the user.
- **Every phase reports its own outcome, and the cycle acts on it.** On failure or partial state, surface that phase's diagnosis verbatim and stop there, so the state the user sees is the state the cycle is actually in.

## Failure Handling

On unrecoverable error in any phase:

1. Mark the corresponding TodoWrite item as failed.
2. Surface the failing phase's structured diagnosis verbatim. Do not paraphrase — the user needs the same detail the sub-command would have printed standalone.
3. Print the current cycle state: which phases ran, current branch, Linear ticket state.
4. Do **not** print the success summary.
