---
description: 'Auto-pick the next Linear ticket (default pool: Fix needed + Open states; ranked by priority DESC → fix-needed tie-break → assigned-to-me DESC → bug-flag DESC → createdAt ASC; tickets assigned to other users are excluded) — or take an explicit ID — then branch, TDD-implement, run all tests, run check, and report a review-ready summary'
argument-hint: "[issue-id | --project=<name> --team=<name> --status=<list> --base=<branch> --figma=<url> --flows=<path>]"
allowed-tools: Agent, Read, Grep, Glob, Write, Edit, AskUserQuestion, TodoWrite, Bash(git:*), Bash(echo:*), Bash(ls:*), Bash(cat:*), Bash(grep:*), Bash(jq:*), Bash(test:*), Bash(wc:*), Bash(bash ${CLAUDE_PLUGIN_ROOT}/scripts/*), Bash(node:*), Bash(pnpm run check:*), Bash(npm run check:*), Bash(yarn run check:*), Bash(pnpm check:*), Bash(npm check:*), Bash(yarn check:*), Bash(pnpm run test:*), Bash(npm run test:*), Bash(yarn run test:*), Bash(pnpm test:*), Bash(npm test:*), Bash(yarn test:*), Bash(pnpm run test:e2e:*), Bash(pnpm run e2e:*), Bash(pnpm run lint:*), Bash(npm run lint:*), Bash(yarn run lint:*), Bash(pnpm run typecheck:*), Bash(npm run typecheck:*), Bash(yarn run typecheck:*), Bash(pnpm run build:*), Bash(npm run build:*), Bash(yarn run build:*), Bash(pnpm install:*), Bash(npm install:*), Bash(yarn install:*), Bash(npx playwright:*), Bash(pnpm exec playwright:*), mcp__plugin_lt-dev_linear__list_teams, mcp__plugin_lt-dev_linear__list_projects, mcp__plugin_lt-dev_linear__list_issue_statuses, mcp__plugin_lt-dev_linear__list_issue_labels, mcp__plugin_lt-dev_linear__list_issues, mcp__plugin_lt-dev_linear__get_issue, mcp__plugin_lt-dev_linear__list_comments, mcp__plugin_lt-dev_linear__save_issue, mcp__plugin_lt-dev_linear__get_user, mcp__plugin_lt-dev_linear__list_users, mcp__plugin_figma_figma__get_design_context, mcp__plugin_figma_figma__get_metadata, mcp__plugin_figma_figma__get_screenshot
disable-model-invocation: true
---

# Take Ticket — End-to-End Ticket Resolution

## When to Use This Command

- You want to start working on the next available ticket without manually picking it
- You have an explicit ticket ID and want the full pipeline (branch, TDD, tests, check, summary) in one shot
- You want optional design / flow / acceptance-criteria sources included automatically

This is the **autonomous, project-agnostic** entry point. It works in any project where Linear is connected via MCP and a `dev`-style base branch exists. It explicitly avoids hardcoding workspace, team, project, or status names — those are detected, filtered, or asked.

## Related Commands & Skills

| Element | Purpose |
|---------|---------|
| `/lt-dev:ticket-cycle` | Full pick → implement → re-analyse → land → Linear-handoff orchestrator (calls `take-ticket` then `git:ship`) |
| `/lt-dev:resolve-ticket` | Resolve a single ticket by ID/file (no auto-pick, no quality loop) — used internally |
| `building-stories-with-tdd` skill | Drives the TDD implementation phase |
| `running-check-script` skill | Drives the `check` script loop (pre-commit + final) |
| `managing-dev-servers` skill | Rules for any backgrounded servers needed during E2E |
| `/lt-dev:review` | Optional follow-up: 7-dimension review before submit |
| `/lt-dev:dev-submit` | Follow-up: MR/PR + Linear comment + status → "Dev Review" |
| `/lt-dev:git:ship` | Follow-up: rebase + tests + check + MR/PR + CI-wait + squash-merge + branch-delete |

---

## Argument Parsing

Parse `$ARGUMENTS` as a free-form string. Recognise (all optional, all combinable):

| Form | Meaning |
|------|---------|
| `ABC-123` or bare digits | Explicit Linear issue ID — skip auto-pick |
| `--project="<name>"` | Restrict auto-pick to one Linear project |
| `--team="<name>"` | Restrict auto-pick to one Linear team |
| `--status="Open,Fix needed"` | Comma-separated state name list. Default: all `unstarted`-type states (Open / Todo / Ready) **plus** any state whose name matches `Fix needed` / `Fix Needed` / `Needs Fix` / `needs-fix` / `fix-needed` (case-insensitive). Backlog states are always excluded unless named explicitly. |
| `--base=<branch>` | Base branch for the feature branch (default: auto-detect `dev` → `develop` → `main` → `master`) |
| `--figma=<url>` | Figma design URL — fetch design context as additional requirement |
| `--flows=<path>` | Relative path containing user-flow docs (e.g. `docs/flows`) |
| `--no-pick` | Force the interactive question even if an ID is present |

If `$ARGUMENTS` is empty, proceed to **STEP 1**.

---

## STEP 0 — Bootstrap Todo List

Create a TodoWrite plan with these items (mark in progress / completed as you proceed):

1. Resolve ticket (auto-pick or explicit)
2. Collect optional context sources (Figma, flows, extra ACs)
3. Assign self & set ticket "In Progress"
4. Sync base branch & create feature branch
5. Analyse all requirement sources (incl. role/permission matrix)
6. TDD implementation per acceptance criterion — `check` + commit after each green cycle
7. Final test sweep until green: full **Unit + API**; Playwright **E2E only the new + affected specs** (full Playwright suite runs in CI / on explicit request)
8. Final `check` script until green
9. Re-analyse ticket vs. implementation — ask user if anything is missing (loop back to STEP 5/6 if so)
10. Print review-ready summary

---

## STEP 1 — Resolve the Ticket

### 1a. If an explicit ID is in `$ARGUMENTS`

- Fetch via `mcp__plugin_lt-dev_linear__get_issue` + `mcp__plugin_lt-dev_linear__list_comments`
- Skip auto-pick. Continue at STEP 2.

### 1b. Auto-Pick Flow

**Optional fast-path — `pick-next-ticket.mjs` (token-saving accelerator).**
Before the manual MCP flow below, you MAY resolve the ranked candidate pool in a
single deterministic call instead of paging `mcp__…__list_issues` (whose
whole-team, all-fields dumps routinely exceed the model's token budget and have
to be spilled to a file and re-parsed):

```
node ${CLAUDE_PLUGIN_ROOT}/scripts/pick-next-ticket.mjs --team <TEAM> [--project "<PROJECT>"] [--status "<list>"] [--assignee me+null]
```

It reproduces this section's Phase-1 hard filter and Phase-2 five-key sort
**exactly** (proven offline in `scripts/pick-next-ticket.test.mjs`) and prints a
compact ranked table plus a machine-readable block:

```
===PICK_RESULT_JSON===
{ "pool": {…}, "top": {…}, "candidates": [ { "rank", "identifier", "priorityName", "status", "fixNeeded", "assignedToMe", "bug", "createdAt", "url", "description" }, … ] }
===END_PICK_RESULT_JSON===
```

`top` is the pick; `candidates[*].description` (top 3 by default) feed the pick
confirmation directly — no follow-up fetch. Parse that block and jump straight to
**Confirm the pick**.

Requirements & graceful fallback — the accelerator NEVER changes *which* ticket
is picked, only *how cheaply* the pool is fetched:
- Needs a Linear Personal API Key (`LINEAR_API_KEY` env, or macOS Keychain
  `security add-generic-password -s linear-api -w …`). The hosted Linear MCP's
  OAuth token is not reusable from a standalone script.
- Exit `4` (no key) / `5` (API error) / `6` (team/project unresolved) → tell the
  user in **one line** (e.g. "Pick-Helper nicht verfügbar (kein Linear-PAT) — nutze
  MCP-Fallback") and **CONTINUE** with the MCP `list_issues` flow below. Never
  abort the pick over a helper failure. Exit `3` → eligible pool empty (handle
  like the "empty pool" branch). Exit `0` → use the JSON block.
- Always project-scope (`--project`) when the repo maps to one Linear project;
  that alone avoids the token blow-up even on the MCP fallback path.

**Detect the target Linear project / team:**

1. Read project signals (in order, stop on first hit):
   - `git remote get-url origin` → repo / org name
   - Root `package.json` `name`
   - Root `README.md` first H1 / "Project:" line
   - Root `CLAUDE.md` "Linear project" / "Linear team" mentions
2. Call `mcp__plugin_lt-dev_linear__list_teams` and `mcp__plugin_lt-dev_linear__list_projects`.
3. Fuzzy-match signals against team / project names.
4. **If ambiguous OR no match:** Ask the user via `AskUserQuestion`:
   - Question: "In welchem Linear-Projekt und Team soll ich nach dem nächsten Ticket suchen?"
   - Offer the top 3 candidates as options. Always include "Anderes Projekt/Team angeben" as a fallback.
5. If `--project=` / `--team=` were passed, use them directly without asking.

**Resolve current user, eligible states, bug labels:**

1. Call `mcp__plugin_lt-dev_linear__get_user` (authenticated viewer) → `CURRENT_USER_ID`.
2. Resolve state IDs into two named buckets via `mcp__plugin_lt-dev_linear__list_issue_statuses`:
   - `OPEN_STATE_IDS` — all states whose Linear **type** is exactly `unstarted` (Linear's "Open" category). Tolerate name variants: `Open`, `Todo`, `Ready`.
   - `FIX_NEEDED_STATE_IDS` — all states whose **name** matches `Fix needed` / `Fix Needed` / `Needs Fix` / `needs-fix` / `fix-needed` (case-insensitive; underscores treated as hyphens). Independent of Linear type. If the team has no such state, the bucket stays empty — no error, the sort just falls through to Open.
   - **Backlog states are always excluded** — never include states whose Linear type is `backlog`, regardless of their name. Auto-pick must not pull tickets the team has consciously deferred. If the user wants backlog tickets, they pass `--status=Backlog` explicitly.
   - If `--status=<list>` is provided, it is the **absolute filter**: only states whose name matches one of the listed entries (case-insensitive) end up in the eligible pool. The `OPEN_STATE_IDS` / `FIX_NEEDED_STATE_IDS` split is still computed inside that filtered set, so the sort-key "Fix needed > Open" continues to work when the user opted into both buckets explicitly.
3. Call `mcp__plugin_lt-dev_linear__list_issue_labels` for the team and capture all label IDs whose name matches `bug` (case-insensitive) → `BUG_LABEL_IDS`. If the team has no bug label, `BUG_LABEL_IDS = []` (every ticket counts as non-bug).

**Selection rule:**

The selection has two distinct phases — first a **hard filter** that defines the eligible pool, then a **multi-key sort** that ranks the rows in that pool.

**Phase 1 — Hard filter (eligibility).** A ticket is only a candidate if **both** conditions hold:

- `stateId` ∈ `OPEN_STATE_IDS ∪ FIX_NEEDED_STATE_IDS` (the ticket is in an Open or Fix-needed state). If `--status=<list>` was passed, this is the user's filtered set as resolved above.
- `assigneeId` ∈ `[CURRENT_USER_ID, null]` (the ticket is either assigned to me or to nobody — tickets assigned to **other users are excluded outright** and never enter the sort).

**Phase 2 — Multi-key sort (ranking inside the eligible pool).** Priority is the **primary** ranking — an Urgent ticket beats a non-Urgent one regardless of status. Fix-needed only breaks ties **at equal priority**; assignment to me is the next tie-breaker. All remaining keys are downstream tie-breakers.

Sort eligible candidates by:

1. **Priority DESC** (Urgent → High → Medium → Low → None) — primary key. A higher-priority ticket always beats a lower-priority one, regardless of status or assignee. So an Urgent Open ticket beats a Low-priority Fix-needed ticket; a Medium Open beats a Low Fix-needed.
2. **Fix-needed-flag DESC** — `stateId ∈ FIX_NEEDED_STATE_IDS` → `1`, else `0`. Second key: at **equal priority**, a Fix-needed ticket beats an Open one. Fix-needed never jumps a higher priority.
3. **Assigned-to-me DESC** (`assigneeId = CURRENT_USER_ID` → `1`, `assigneeId = null` → `0`) — third key. At equal priority + equal fix-needed flag, my ticket beats an unassigned one.
4. **Bug-flag DESC** (ticket carries a label from `BUG_LABEL_IDS` → `1`, else `0`) — fourth key.
5. **`createdAt` ASC** — final tie-breaker (oldest first).

Take the first row.

**Implementation:**

Query `mcp__plugin_lt-dev_linear__list_issues` once (or twice merged) with the Phase 1 filter:

- `teamId` = resolved team
- `projectId` = resolved project (if applicable)
- `stateId` IN `OPEN_STATE_IDS ∪ FIX_NEEDED_STATE_IDS` (or the `--status=`-filtered set). If the Linear filter cannot express the union, run **two** filtered queries (one per bucket) and merge the results.
- `assigneeId` IN `[CURRENT_USER_ID, null]` — if the Linear filter cannot express this OR, run **two** filtered queries (`assigneeId = CURRENT_USER_ID` + `assigneeId = null`) and merge the results. **Never** include tickets assigned to other users in the merged set.
- Server-side ordering is best-effort (`priority` DESC, `createdAt` ASC). The full five-key sort above is applied **client-side** on the returned rows — the server cannot express the fix-needed tie-break directly.

**If the eligible pool is empty:**

- **First, scan the `Blocked` column for tickets that may no longer be blocked.**
  Re-run the helper with `--blocked` (or query the Blocked-state tickets that are
  mine-or-unassigned in this project) and read the `blocked` section. For each
  blocked ticket it reports whether its `blocks` blockers are all Done/Canceled
  (`likelyUnblocked: true`), still active (`false`), or absent from the relations
  (`null` — the block is only a status, so read the description + comments for the
  real reason). **A blocked ticket is NEVER auto-picked.**
- If one or more blocked tickets look releasable, present them to the user **with
  the concrete reason** they are probably no longer blocked (e.g. "Blocker
  DEV-1234 ist seit dem Merge auf Done", "kein aktiver Blocker mehr in den
  Relations") so the user can make an informed call, and ask for an **explicit
  release** before taking one — via `AskUserQuestion`, one option per releasable
  ticket plus "Keins — anders vorgehen". Only on an explicit release do you move
  it to In Progress and continue at STEP 2; otherwise treat it as declined. Never
  release a `null`/`false` ticket without the user confirming the reason no longer
  applies.
- If nothing in Blocked looks releasable (or the user declines), show the empty
  result and ask: "Kein passendes Ticket gefunden. Soll ich (a) eine breitere
  Suche starten (auch `In Progress` / andere Status), (b) ein bestimmtes Ticket
  übernehmen, oder (c) abbrechen?"

**Confirm the pick** via `AskUserQuestion`:
- Show: Identifier, title, priority, **bug-flag** ("🐞 Bug" if matched), assignment ("dir zugeordnet" / "nicht zugeordnet"), status, project, 1-line description excerpt
- Options: "Übernehmen", "Nächstes Ticket vorschlagen" (re-runs the sort skipping this ticket), "Anderes Ticket eingeben", "Abbrechen"

Store the chosen `ISSUE_ID`, `ISSUE_IDENTIFIER` (e.g. `SVL-123`), `ISSUE_TITLE`, `TEAM_KEY`, `STATE_IDS` (full state list for this team).

---

## STEP 2 — Optional Context Sources

Even if Figma / flows are not in `$ARGUMENTS`, **ask once** via a single `AskUserQuestion` call with multi-select (or a 4-option single-select if multi-select is wrong tone):

- "Möchtest du zusätzliche Quellen für die Umsetzung mitgeben?"
- Options:
  - "Figma-Design-URL"
  - "Pfad zu User-Flows / Specs im Repo"
  - "Zusätzliche Anforderungen / Akzeptanzkriterien"
  - "Nein, nur Linear-Ticket nutzen"

For each selected item, collect the concrete value via a follow-up `AskUserQuestion` (text via the auto-provided "Other" entry) — **but skip the prompt for values that were already passed via flags** (`--figma=`, `--flows=`).

Persist collected sources in a working note (in-context). Do **not** write a markdown file unless the user explicitly asks.

---

## STEP 3 — Assign Self & Set Ticket "In Progress"

1. Resolve current Linear user via `mcp__plugin_lt-dev_linear__get_user` (the authenticated viewer — no ID needed).
2. Find the team's "In Progress" state ID from `STATE_IDS`. Match case-insensitively against: `In Progress`, `Started`, `Doing`. If none match, ask the user which state to use.
3. Update the issue via `mcp__plugin_lt-dev_linear__save_issue` with:
   - `assigneeId` = current user
   - `stateId` = matched in-progress state

If the call fails (permissions, archived issue, etc.), surface the error and ask the user whether to continue with implementation anyway.

### 3b. Set VStab Window-Tab Title (best effort)

Label the VS Code window tab with the ticket now being worked on, so multi-window setups show at a glance which window handles which ticket. Format: `<PROJECT_CODE>: <ISSUE_IDENTIFIER> <SHORT_DESC>` — e.g. `VST: DEV-123 Login-Fix`.

1. **Derive `<PROJECT_CODE>`** — the issue identifier carries only the team key (usually `DEV-…`), which says nothing about the project. Derive a concise 2–5 uppercase-letter code from the ticket's **Linear project name** (from `get_issue` → project):
   - Multi-word name → initials, uppercased (`Session Notifier` → `SN`).
   - Single-word name → first 3–4 letters, uppercased (`VStab` → `VST`, `Showroom` → `SHOW`).
   - No Linear project on the issue → use the repository folder name instead (same rules).
2. **Derive `<SHORT_DESC>`** — distil the ticket title to 1–3 words (same language as the ticket title). Drop filler like "implementieren", "hinzufügen" when the remaining words still identify the topic.
3. **Set the title:**

   ```
   bash ${CLAUDE_PLUGIN_ROOT}/scripts/vs-tab-title.sh "<PROJECT_CODE>: <ISSUE_IDENTIFIER> <SHORT_DESC>"
   ```

This is a **non-blocking convenience step**: the script is a silent no-op when the VStab extension is not installed, and any failure here must never stall the ticket flow — log one line and continue. The title clears automatically when the Claude Code session ends; `/lt-dev:ticket-cycle` additionally clears it after a successful hand-off/merge.

---

## STEP 4 — Sync Base Branch & Create Feature Branch

**Determine base branch:**

1. Use `--base=` if provided.
2. Else probe `git rev-parse --verify origin/<name>` for: `dev`, `develop`, `main`, `master`. Use the first that exists.

**Update base:**

```bash
git fetch origin --prune
git checkout <base>
git pull --ff-only origin <base>
```

If `git pull --ff-only` fails (diverged local base), abort and ask the user how to proceed — do **not** force-update silently.

**Create feature branch:**

Branch name pattern: `feature/<ISSUE_IDENTIFIER_LOWER>-<slug>`

- `<ISSUE_IDENTIFIER_LOWER>` = `SVL-123` → `svl-123`
- `<slug>` = title lowercased, ASCII-only, spaces / punctuation → `-`, collapse repeats, trim, max 50 chars

```bash
git checkout -b feature/<id>-<slug>
```

If the branch already exists locally: check it out instead and inform the user. If it exists on `origin` but not locally: `git checkout -b … --track origin/…`.

---

## STEP 5 — Analyse All Requirement Sources

Build an internal **requirements map** by reading, in order:

1. **Linear issue body** + all comments — extract acceptance criteria (lines starting with `- [ ]`, `AK:`, `Acceptance Criteria`, "Definition of Done").
2. **User-supplied flows path** (if provided): read every `.md` / `.mmd` / `.svg` / image referenced by Linear inside the path.
3. **Repo conventions:** `CLAUDE.md`, `docs/`, `README.md` for stack-specific rules.
4. **Figma design** (if provided): call `mcp__plugin_figma_figma__get_design_context` and `mcp__plugin_figma_figma__get_metadata` for the node, plus `get_screenshot` for visual anchors. Extract: component tree, spacing, colors, copy, interactions.
5. **Existing code** related to the ticket: grep for entity names from the title in `projects/api/src/server/`, `projects/app/app/`, or equivalent.

Produce a concise internal plan covering:
- Acceptance criteria (numbered, verbatim where possible)
- Affected modules / files (paths)
- Data model changes (if any)
- API contract changes (if any)
- UI / UX changes (if any)
- **Role / permission matrix** — for every endpoint / mutation / UI action touched, list every role (e.g. `Admin`, `User`, `Guest`, custom org roles) and whether it is `allowed`, `denied`, or `partial` (own-records-only via `securityCheck`). Derive from `@Restricted` / `@Roles` decorators on the affected services, from the ticket text, and from existing call sites. If no role-aware behaviour applies, explicitly note "Single-role feature — no permission matrix needed".
- Open questions for the user

**If any open question is blocking** (e.g. unclear data model, missing AC, ambiguous role behaviour) ask the user before implementation. Non-blocking ambiguities go into the final summary as "Annahmen".

---

## STEP 6 — TDD Implementation (per Acceptance Criterion, with Pre-Commit `check`)

Follow the **`building-stories-with-tdd` skill** verbatim for the full TDD loop. Key points repeated here so you don't skip them:

1. Detect test framework (Vitest vs Jest) **before** writing the first test.
2. Backend story tests in `projects/api/tests/stories/` (or equivalent).
3. Frontend E2E tests in `projects/app/tests/` (Playwright).
4. **Tests first, implementation second.** Run them red → green → repeat.
5. Test data emails must use `@test.com` (cleanup filter).
6. **Backend before frontend** (frontend depends on generated types).
7. After each green TDD iteration, re-run the full **Unit + API** suites (not just the new tests — they are fast and catch regressions). For **Playwright E2E**, run only the **new + affected** specs by default (`lt dev test -- <spec>` / `scripts/e2e-fast.sh -- <spec>`); the full Playwright suite is slow and runs in CI — run it locally only when the user explicitly asks.

If the project is fullstack and the Agent Teams flag is enabled, follow the parallel test-writing pattern from the skill. Otherwise sequential.

For pure-backend or pure-frontend projects, use only the matching half (skip the other).

### 6a. Role / Permission Tests (mandatory when STEP 5 produced a permission matrix)

For every entry in the permission matrix from STEP 5, write tests that **prove** the documented behaviour. Coverage rules:

- **`allowed` role** → integration / API test logs that role in, calls the endpoint, expects 2xx + correct payload.
- **`denied` role** → same setup, expects 401 / 403 (or business-level reject) — never a silent empty result.
- **`partial` (e.g. own records only)** → at minimum two cases: (a) acting on own record → success, (b) acting on another user's record → reject.
- **Frontend equivalent** — Playwright E2E logs in as each role and verifies the UI affordance (button visible / hidden / disabled, route accessible / redirected, action error toast).

Place backend permission tests next to the corresponding story tests; place frontend permission E2E in `projects/app/tests/permissions/` if the project doesn't already have a convention.

**A feature with a permission matrix but no role tests is incomplete** — do not proceed to STEP 7.

### 6b. Pre-Commit `check` + Auto-Commit per Green TDD Cycle

Whenever a TDD slice reaches green (red → green for one or more ACs in the same logical unit — typically one entity / one route / one form), follow this commit gate **before** moving on to the next slice:

1. **Run the full discovered `check` script** (`pnpm run check` / `npm run check` / `yarn run check`, monorepo-aware via the `running-check-script` skill). Iterate-until-green using the skill's escalation ladder — **no `--no-verify`, no `@ts-ignore`, no `eslint-disable` bypasses.**
2. **Re-run the affected test pillar** if `check` introduced auto-fixes (formatter, lint-fix, dedupe). One-pillar re-run is enough at this point; the full three-pillar sweep happens in STEP 7.
3. **Stage + commit** the slice with a Linear-prefixed conventional-commit message:
   - Format: `<type>(<scope>): <subject>` — types: `feat`, `fix`, `test`, `refactor`, `docs`, `chore`. Prepend the Linear identifier in the subject **only** if the project's existing commit history uses that convention (check `git log --oneline -20 origin/<base>`); otherwise rely on the branch name to carry the identifier.
   - Example: `feat(orders): add cancel endpoint with role gating` — body lists the AC numbers covered.
4. **Do not push** — the local branch stays unpushed until `git:ship` (or `dev-submit`) runs.

If a project has **no `check` script**, log `No check script defined — pre-commit check skipped` and continue. Commits still happen per slice.

The point of this loop is to keep the per-slice diff small enough that a reviewer (and the CI pipeline in `git:ship`) can isolate root causes quickly, and to surface typecheck/lint regressions while the related code is still hot in mind.

---

## STEP 7 — Full Test Loop Until Green

The full test pipeline has **three pillars** — all must be fully green, no skips, no flakes. Anything skipped or papered-over hides regressions and breaks the remote CI pipeline.

### 7a. Discover All Test Scripts (three pillars)

For every `package.json` in the repo, identify scripts and assign them to a pillar:

- **Unit:** `test`, `test:unit`, `test:cov`, `vitest`, `jest` (without `e2e`/`integration` suffix). Typically backend `projects/api/src/` and frontend `projects/app/app/`.
- **API / Integration:** `test:e2e` (backend), `test:integration`, `test:api`, `test:stories`, controller + e2e-spec files. Typically backend `projects/api/tests/` (story tests, controller tests).
- **Frontend E2E:** `test:e2e` (frontend), `e2e`, `playwright`, `pw`, `pw:e2e`. Typically frontend `projects/app/tests/`, `tests/e2e/`, `e2e/`.

**Disambiguation:** A `test:e2e` script can mean *either* "backend e2e-spec" *or* "Playwright frontend e2e" — look at the script body, config files (`playwright.config.ts` → Frontend E2E), and directory location to assign correctly.

If the project has **no** frontend (pure-backend repo), Pillar 3 is naturally empty — fine. If the project **has** a frontend but **no Playwright tests exist yet**, ask the user whether the ticket actually requires E2E coverage; if yes, write them as part of STEP 6 (TDD) before reaching STEP 7.

### 7b. Pre-Run Skip & Flake Audit

Before running, statically scan the test files for hidden skips and flake-hiders. Fail-fast if any are found that were not present at the start of the branch:

```bash
# in each test directory:
grep -rnE '\.(skip|todo|only)\b|\b(xit|xdescribe|test\.skip|it\.skip|describe\.skip|fdescribe|fit)\b' --include='*.ts' --include='*.tsx' --include='*.spec.*' --include='*.test.*'
grep -rnE 'retries\s*:\s*[1-9]|test\.retry|retry\s*\(' --include='*.ts' --include='*.tsx' --include='*.config.*' --include='*.spec.*'
```

Any hit → surface to the user. New skips/flake-retries introduced by the TDD phase are blockers — remove them before continuing.

### 7c. Iterate Until Fully Green

```
Run every discovered test script in order:
  1. Unit
  2. API / Integration
  3. Frontend E2E

Termination conditions:
  - ALL pillars exit 0 AND no test reported as SKIPPED/PENDING in output → done
  - Any failure or any SKIPPED test → enter fix loop

Fix loop:
  a. Read failure output (full stderr + last failing test name)
  b. Fix root cause in code or test data — NEVER:
       - add .skip / .todo / xit / xdescribe
       - raise retries: N
       - add test.retry / try-catch swallow in test
       - add timeouts to dodge a real assertion
  c. Pre-existing failures (unrelated to ticket) are blockers too — fix them
     and note them in the summary as "Mitgefixt"
  d. Re-run only the failing pillar first to confirm the fix
  e. Then re-run all three pillars to catch cross-pillar regressions

Stall guard: >3 full pipeline cycles without convergence on the same failure
→ stop and surface a structured diagnosis instead of looping forever.
```

### 7d. Frontend E2E Specifics

- **Dev-server orchestration:** follow `managing-dev-servers` — use `lt dev up` if the project is registered (the lt-dev hook says so), otherwise `run_in_background: true` for `pnpm dev` / `pnpm start` + `pkill` after — never orphan dev servers.
- **Browser engines:** Playwright defaults to chromium; run the configured engines (check `playwright.config.ts` for `projects: [...]`).
- **Headless on CI parity:** run E2E in the same mode CI uses (typically headless) to avoid local-only passes.
- **Test data isolation:** test emails must use `@test.com` (TestHelper cleanup regex), same rule as the backend.

### 7e. Backend Environment

Backend tests typically need `NODE_ENV=e2e` (local). **Never** `NODE_ENV=test` — that is the customer stage, not a test environment.

---

## STEP 8 — Check Script Loop

**Runs only after STEP 7 reports all three test pillars fully green.** The `check` script is the secondary safety net (typecheck / lint / build / audit) — it must not be used as a substitute for tests.

Follow the **`running-check-script` skill** verbatim:

1. Discover all `package.json` `check` scripts (monorepo-aware) across every detected project.
2. Run `<pm> run check` (pnpm preferred per project's lockfile; fall back to npm/yarn).
3. Iterate-until-green with the mandatory 6-step audit-finding escalation ladder.
4. No bypasses (`--no-verify`, `@ts-ignore`, `eslint-disable`, etc.).
5. Classify residuals into Accepted vs Critical.
6. STOP if Unresolved blockers remain — do not pretend success.

**If no `check` script exists** in any `package.json`, log `No check script defined — skipping STEP 8` and continue to STEP 9. Do not invent one.

**If `check` introduces changes** (auto-fixes from lint/format/dedupe): re-run STEP 7's three pillars to confirm the auto-fixes didn't break a test. This is rare but possible.

If STEP 8 produced staged changes (auto-fixes that needed to be persisted), commit them as `chore: post-implementation check fixes` before moving on. The local branch is still **not** pushed at this point.

---

## STEP 9 — Final Re-Analysis & Iteration Loop

After STEP 7 + 8 are fully green, before the summary is printed, perform a **completeness pass** against the original ticket so nothing was silently dropped.

### 9a. Re-Analyse Ticket vs. Implementation

Re-read the original Linear ticket (title + description + all comments) plus any optional sources collected in STEP 2 (Figma node, flow doc, extra ACs). For each AC produced in STEP 5, decide a verdict:

- ✅ done — AC fully implemented + covered by a test (Unit / API / E2E or Permission test)
- ⚠ partial — AC implemented but with a scope cut or open todo (must surface in summary)
- ❌ missing — AC not implemented; blocker, must trigger another TDD slice

Also re-check:

- **Permission matrix from STEP 5** — every row has at least one matching test in STEP 6a.
- **New / changed routes, mutations, UI states** that were *not* in the original AC list — surface as "Mitgenommen" so the user can decide if they belong.
- **Discovered follow-ups** — anything noted during implementation that is out of scope but worth tracking. **Default to implementing, not deferring:** if it can reasonably be done inside this ticket, do it now instead of spinning off a new ticket. A *separate* follow-up ticket is justified only when the work is (a) a genuinely necessary additional feature, (b) **completely** out of the current ticket's scope, and (c) implementable in parallel / independently of this change. Everything else stays in scope and is implemented here.
  - **Dependency gate — do NOT create a follow-up yet if it depends on this ticket landing.** If the follow-up can only be worked once this ticket is fully implemented **and merged into the base branch** (`dev` / `development`), it must **not** be created now. The auto-pick pool (STEP 1b Phase 1) is *Open ∪ Fix-needed* **and** *unassigned-or-mine* — a dependent follow-up dropped into "Open" becomes immediately pickable, so a parallel `ticket-cycle` session would grab it and start on code that isn't merged yet. Note such follow-ups in the STEP 10 summary **only**, and create the real ticket **after** the base merge has landed (standalone: once you've merged; orchestrated via `ticket-cycle`: after its STEP 4b healthy-deploy verification). Only genuinely independent, parallelizable follow-ups may be filed immediately.

### 9b. User Confirmation Loop

Print a compact German status block showing each AC's verdict, "Mitgenommen"-items, and open follow-ups. Then ask via `AskUserQuestion`:

- Question: "Ist das Ticket damit vollständig umgesetzt, oder gibt es noch etwas zu ergänzen / anzupassen, bevor wir abschließen?"
- Options:
  1. "Ja, fertig — Summary drucken und an git:ship übergeben" *(Recommended)*
  2. "Nein, noch etwas ergänzen" → user describes the additional scope, then **loop back to STEP 5** (analyse → STEP 6 implement → STEP 7 tests → STEP 8 check → STEP 9 re-check). Cap loop iterations at **3** to avoid infinite ping-pong; if hit, surface a structured note and stop.
  3. "Anpassung an bestehender Umsetzung" → user describes the change, loop back to STEP 6 only (skip re-analysis of unchanged ACs).

On Option 1, continue to STEP 9.5. On loop-back, re-evaluate the TodoWrite items (mark previously completed ones as in-progress only if they actually need rework).

## STEP 9.5 — Browser Validation Walk

Before printing the review-ready summary, run a manual-style end-to-end browser pass to surface anything tests + check could not catch (broken empty states, missing toasts, regressed roles, console errors, mobile glitches, latent bugs in adjacent pages).

Follow the [`validating-changes-in-browser`](${CLAUDE_PLUGIN_ROOT}/../skills/validating-changes-in-browser/SKILL.md) skill end-to-end:

1. Boot `lt dev up` (or fallback per `managing-dev-servers`).
2. Seed `@test.com` accounts that cover every role from the permission matrix produced in STEP 5 (and every entity state the diff touches). Maintain the account registry — every credential will be surfaced to the user.
3. Derive a step-by-step test list from the diff `origin/<BASE>...HEAD`. Every step explicitly names its account (or marks it as a no-login / public step), so the user can re-walk without follow-up questions.
4. Walk the list yourself via Chrome DevTools MCP. Fix every finding — including pre-existing console errors, layout glitches, broken empty states — in the same loop. Note them as also-fixed for the summary.
5. Render the walked list. Skill verdict drives next step:
   - `READY-TO-SHIP` → continue to STEP 10. Fold the walked list and account registry into the summary.
   - `OPTIMIZE` → user supplied scope notes; loop back to STEP 5/6 (cap iterations at **3** combined with the STEP 9b loop).
   - `WAITING-FOR-USER` → print the walked list + the account registry, leave `lt dev up` running, stop and wait for the user's next message.
   - `CANCELLED` → tear the stack down, surface a closing block stating the branch is intact and unpushed. Skip STEP 10.

If the skill returns `boot_failed` or `stall_guard_triggered`, do NOT proceed to STEP 10 — surface the diagnosis and stop.

## STEP 10 — Review-Ready Summary

Print **one** structured German summary block. This is the artefact the user reviews — make it scannable.

```
╔══════════════════════════════════════════════════════════╗
║ Ticket erledigt: <ISSUE_IDENTIFIER> — <Titel>           ║
╚══════════════════════════════════════════════════════════╝

🎯 Akzeptanzkriterien
- [✓] AK1: <wortlaut> — umgesetzt in <pfade>
- [✓] AK2: …
- [⚠] AK3: <wortlaut> — teilweise umgesetzt, weil <begründung>; offen: <was>

🛠 Umsetzung (Was & Warum)
- <kurze, fachliche Zusammenfassung in 2-4 Bullets>
- <design-entscheidung 1>: <warum>
- <design-entscheidung 2>: <warum>

📂 Geänderte / neue Dateien
- <path>:<range>  — <einzeiler>
- …

🧪 Tests
- Unit: <n> grün
- API: <n> grün
- E2E: <n> grün
- Neue Regressions-/Story-Tests: <pfade>

✅ Check
- check: <ergebnis> (<n> auto-fixes, <n> accepted residuals)

🔍 Für den Review wichtig
- Annahmen, die getroffen wurden: <liste>
- Bewusst NICHT umgesetzt: <liste, falls scope-cut>
- Empfohlene Manual-Smoke-Tests: <1-3 schritte>

🌐 Browser-Walk (aus STEP 9.5)
- Verdict: READY-TO-SHIP / OPTIMIZE / WAITING-FOR-USER / CANCELLED
- Mitgefixt waehrend Walk: kurze Liste oder "keine"
- Out-of-scope-Findings: kurze Liste oder "keine"

Test-Accounts (fuer deinen Re-Walk im Browser):
- email / password / Rolle / Herkunft (z.B. admin@test.com / TestPass123! / Admin / bestehender Seed)
- ...

Walk-Liste (vollstaendig durchgegangen):
[v] 1. Step — Account: email — Beobachtung: ...
[v] 2. ...

🌿 Branch
- Feature: <feature-branch>
- Basis: <base-branch>
- Linear: #<ISSUE_IDENTIFIER> → "In Progress"

Nächste Schritte:
1. /lt-dev:review        # 7-Dimension Review (optional)
2. Eine der drei Landing-Optionen:
   - /lt-dev:git:ship          # MR/PR + CI-Wait + Squash-Merge + Branch-Delete (autonom)
   - /lt-dev:dev-submit        # MR/PR + Linear-Kommentar + Status "Dev Review" (manueller Reviewer)
   - /lt-dev:ticket-cycle      # Already covered if invoked via orchestrator (skip)
```

Adapt sections that don't apply (e.g. no Figma → no Figma references). Never inflate — accuracy over completeness.

---

## Hard Rules

- **Limit local Playwright runs to new + affected specs to keep TDD loops fast.** Default to `lt dev test -- <spec>` / `scripts/e2e-fast.sh -- <spec>`; the full Playwright suite is slow and runs in **CI**. Only run the full local suite when the user explicitly asks.
- **Never push silently.** Branch stays local until the user runs `/lt-dev:dev-submit` or pushes manually.
- **Never bypass quality gates.** No `--no-verify`, no `.skip`, no flake-retry without an open follow-up note.
- **Minimise follow-up tickets — implement in scope by default.** Do not defer work into new tickets to shrink the current change; anything that can reasonably be done inside this ticket is done here. A separate follow-up is justified only when it is a genuinely necessary, **completely** out-of-scope feature that can be built in parallel. If a follow-up depends on this ticket being merged into the base branch (`dev` / `development`), do **not** create it until that merge has landed — the auto-pick pool admits every unassigned "Open" ticket, so a premature dependent follow-up gets grabbed by another `ticket-cycle` session before it can be worked. Until then, note it in the summary only.
- **Never invent acceptance criteria.** If unclear, ask.
- **Always ask before destructive git ops** (force-push, hard reset, branch delete) — they are never part of this command.
- **Failing tests are always blockers**, even if they predate the current changes. Fix root causes.
- **Linear state updates are reversible if they fail mid-run** — surface the error, never assume success silently.

## Failure Handling

If any step throws an unrecoverable error:

1. Mark the corresponding TodoWrite item as failed (not completed).
2. Roll back Linear state changes if the implementation never started (assignment back to previous assignee, status back to previous state).
3. Print a structured diagnosis: which step, what went wrong, what state the repo / branch / Linear issue is in now, recommended next action.
4. Do **not** print the success summary.
