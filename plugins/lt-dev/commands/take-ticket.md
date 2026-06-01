---
description: Auto-pick the next Linear ticket (highest priority, unassigned) — or take an explicit ID — then branch, TDD-implement, run all tests, run check, and report a review-ready summary
argument-hint: "[issue-id | --project=<name> --team=<name> --status=<list> --base=<branch> --figma=<url> --flows=<path>]"
allowed-tools: Agent, Read, Grep, Glob, Write, Edit, AskUserQuestion, TodoWrite, Bash(git:*), Bash(echo:*), Bash(ls:*), Bash(cat:*), Bash(grep:*), Bash(jq:*), Bash(test:*), Bash(wc:*), Bash(bash ${CLAUDE_PLUGIN_ROOT}/scripts/*), Bash(node:*), Bash(pnpm run check:*), Bash(npm run check:*), Bash(yarn run check:*), Bash(pnpm check:*), Bash(npm check:*), Bash(yarn check:*), Bash(pnpm run test:*), Bash(npm run test:*), Bash(yarn run test:*), Bash(pnpm test:*), Bash(npm test:*), Bash(yarn test:*), Bash(pnpm run test:e2e:*), Bash(pnpm run e2e:*), Bash(pnpm run lint:*), Bash(npm run lint:*), Bash(yarn run lint:*), Bash(pnpm run typecheck:*), Bash(npm run typecheck:*), Bash(yarn run typecheck:*), Bash(pnpm run build:*), Bash(npm run build:*), Bash(yarn run build:*), Bash(pnpm install:*), Bash(npm install:*), Bash(yarn install:*), Bash(npx playwright:*), Bash(pnpm exec playwright:*), mcp__plugin_lt-dev_linear__list_teams, mcp__plugin_lt-dev_linear__list_projects, mcp__plugin_lt-dev_linear__list_issue_statuses, mcp__plugin_lt-dev_linear__list_issues, mcp__plugin_lt-dev_linear__get_issue, mcp__plugin_lt-dev_linear__list_comments, mcp__plugin_lt-dev_linear__save_issue, mcp__plugin_lt-dev_linear__get_user, mcp__plugin_lt-dev_linear__list_users, mcp__plugin_figma_figma__get_design_context, mcp__plugin_figma_figma__get_metadata, mcp__plugin_figma_figma__get_screenshot
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
| `/lt-dev:resolve-ticket` | Resolve a single ticket by ID/file (no auto-pick, no quality loop) — used internally |
| `building-stories-with-tdd` skill | Drives the TDD implementation phase |
| `running-check-script` skill | Drives the `check` script loop |
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
| `--status="Open,Backlog"` | Comma-separated status priority list (default: `Open,Backlog`) |
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
5. Analyse all requirement sources
6. TDD implementation
7. Run full test suites until green
8. Run `check` script until green
9. Print review-ready summary

---

## STEP 1 — Resolve the Ticket

### 1a. If an explicit ID is in `$ARGUMENTS`

- Fetch via `mcp__plugin_lt-dev_linear__get_issue` + `mcp__plugin_lt-dev_linear__list_comments`
- Skip auto-pick. Continue at STEP 2.

### 1b. Auto-Pick Flow

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

**Determine status priority list:**

- Use `--status=` if provided, else default to `Open,Backlog`.
- Resolve each name to a Linear state ID via `mcp__plugin_lt-dev_linear__list_issue_statuses` for the selected team. Tolerate variants ("Open", "Todo", "Ready", "Backlog").

**Fetch and rank candidates:**

For each status in priority order, call `mcp__plugin_lt-dev_linear__list_issues` with:
- `teamId` = resolved team
- `projectId` = resolved project (if applicable)
- `stateId` = current status
- `assigneeId` = `null` (unassigned only)
- Order by priority DESC (Urgent → High → Medium → Low → None), then by createdAt ASC.

Pick the **first match** found. If a status returns nothing, fall through to the next status. If all statuses are empty:

- Show the user the empty result and ask: "Kein passendes Ticket gefunden. Soll ich (a) eine breitere Suche starten, (b) ein bestimmtes Ticket übernehmen, oder (c) abbrechen?"

**Confirm the pick** via `AskUserQuestion`:
- Show: Identifier, title, priority, status, project, 1-line description excerpt
- Options: "Übernehmen", "Nächstes Ticket vorschlagen", "Anderes Ticket eingeben", "Abbrechen"

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
- Open questions for the user

**If any open question is blocking** (e.g. unclear data model, missing AC) ask the user before implementation. Non-blocking ambiguities go into the final summary as "Annahmen".

---

## STEP 6 — TDD Implementation

Follow the **`building-stories-with-tdd` skill** verbatim for the full TDD loop. Key points repeated here so you don't skip them:

1. Detect test framework (Vitest vs Jest) **before** writing the first test.
2. Backend story tests in `projects/api/tests/stories/` (or equivalent).
3. Frontend E2E tests in `projects/app/tests/` (Playwright).
4. **Tests first, implementation second.** Run them red → green → repeat.
5. Test data emails must use `@test.com` (cleanup filter).
6. **Backend before frontend** (frontend depends on generated types).
7. After each green TDD iteration, run the full test suite — not just the new tests.

If the project is fullstack and the Agent Teams flag is enabled, follow the parallel test-writing pattern from the skill. Otherwise sequential.

For pure-backend or pure-frontend projects, use only the matching half (skip the other).

---

## STEP 7 — Full Test Loop Until Green

**Discover all test scripts** in every `package.json` of the repo (`test`, `test:unit`, `test:e2e`, `e2e`, `test:integration`, etc.). Iterate this loop until **all** tests pass — no skips, no `xit`, no `test.skip`, no flaky retries hidden:

```
1. Run every discovered test script in order: unit → integration/API → e2e
2. If ALL green and no SKIPPED tests → done
3. If failures:
   a. Read the failure output
   b. Fix root cause (NEVER skip / xfail / add retry-only to hide flakiness)
   c. If a pre-existing failure surfaces, fix that too — green suite is a hard requirement
   d. Re-run only the failing script first to confirm the fix, then full pipeline
4. If a test is skipped: investigate why. Either restore it (preferred) or document the explicit reason and ask the user before continuing.
```

**For Playwright E2E** that needs a running app: follow `managing-dev-servers` (use `lt dev up` if the project is registered, else `run_in_background: true` + `pkill` afterwards — never orphan dev servers).

**Backend tests** typically need `NODE_ENV=e2e` (local) — never `NODE_ENV=test` (that's customer stage).

If the test loop stalls (>3 full-pipeline runs without convergence on the same suite), stop and surface a structured diagnosis to the user instead of looping forever.

---

## STEP 8 — Check Script Loop

Run `/lt-dev:check` semantics via the **`running-check-script` skill** verbatim:

1. Discover all `package.json` `check` scripts (monorepo-aware).
2. Iterate-until-green with the mandatory 6-step audit-finding escalation ladder.
3. No bypasses (`--no-verify`, `@ts-ignore`, `eslint-disable`, etc.).
4. Classify residuals into Accepted vs Critical.
5. STOP if Unresolved blockers remain — do not pretend success.

If the repo has no `check` script anywhere, log "No check script defined" and continue.

---

## STEP 9 — Review-Ready Summary

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

🌿 Branch
- Feature: <feature-branch>
- Basis: <base-branch>
- Linear: #<ISSUE_IDENTIFIER> → "In Progress"

Nächste Schritte:
1. /lt-dev:review        # 7-Dimension Review
2. /lt-dev:dev-submit    # MR/PR + Linear-Kommentar + Status "Dev Review"
   ODER
2. /lt-dev:git:ship      # MR/PR + CI-Wait + Squash-Merge + Branch-Delete (autonomous landing)
```

Adapt sections that don't apply (e.g. no Figma → no Figma references). Never inflate — accuracy over completeness.

---

## Hard Rules

- **Never push silently.** Branch stays local until the user runs `/lt-dev:dev-submit` or pushes manually.
- **Never bypass quality gates.** No `--no-verify`, no `.skip`, no flake-retry without an open follow-up note.
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
