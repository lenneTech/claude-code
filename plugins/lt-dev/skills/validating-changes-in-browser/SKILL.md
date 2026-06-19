---
name: validating-changes-in-browser
description: Final browser validation after implementation AND review have succeeded. Boots the app via `lt dev up`, seeds realistic `@test.com` data, derives a step-by-step test list from the diff (every affected page, role, flow, empty/error state, mobile pass, console + network sweep), then walks the list autonomously via Chrome DevTools MCP. Fixes everything it finds — including pre-existing console errors, layout glitches, regressed empty states, a11y findings — in the same loop. Closes by rendering the walked list to the user + an `AskUserQuestion` gate "ship or further optimize". Activates as the last step of any ship-oriented workflow. Referenced from `/lt-dev:resolve-ticket`, `/lt-dev:take-ticket`, `/lt-dev:ticket-cycle`, `/lt-dev:review`, `/lt-dev:debug`, `/lt-dev:production-ready`, the `building-stories-with-tdd` TDD loop, and the `branch-rebaser` agent. NOT a substitute for implementation, code review, or automated E2E tests — those run before.
user-invocable: false
---

# Validating Changes in the Browser

This skill is the **last station** before a ticket is shipped. It is invoked **only after** the implementation is complete and the relevant review step has succeeded — not as a substitute for either, but as the final user-eye check that catches the things a unit test, an API test, or a static review cannot see: broken empty states, missing toasts, focus traps, regressed flows on roles the developer didn't think to test, console errors, layout glitches, latent bugs in sibling pages that the change accidentally exposed.

The orchestrator runs the test list **itself** via Chrome DevTools MCP. Whatever it finds — including issues that pre-date the current branch — is fixed in the same loop. The user only sees the **final** list, fully ticked, with a question: ship or optimize further.

**Language convention for this skill:**

- The instructions you read here (English) tell you HOW to run the workflow.
- The artefacts the **developer sees** at the end (test plan headings, walked list, status labels, ship-or-optimize question and options) are rendered in the **language the user has been speaking in this session** — German if the conversation has been in German, English if in English, the user's language otherwise. The English examples below are illustrative templates; translate the headings, columns, action prose, status labels, and the AskUserQuestion text+options to match the user's language before showing them.

## When to Use This Skill

Activates at the end of these workflows (invoked from each):

- `/lt-dev:resolve-ticket` — after the review-pipeline guidance, before `/lt-dev:dev-submit`
- `/lt-dev:take-ticket` — inside STEP 10 (Review-Ready Summary), before handoff
- `/lt-dev:ticket-cycle` — between Phase B (review) and Phase C (ship)
- `/lt-dev:review` — as the final Phase 7, after Phase 6 decision & fix-execution
- `/lt-dev:debug` — after Step 7 (fix implementation) succeeded
- `/lt-dev:production-ready` — as the final phase, after CI validation
- `building-stories-with-tdd` skill — at the end of Step 5b (Final Validation)
- `branch-rebaser` agent — after Phase 10 (Code Review) succeeded

## NOT for

- Skipping the implementation step (use the relevant dev workflow first)
- Skipping the code review (use `/lt-dev:review` first)
- Running automated E2E tests — Playwright lives in `lt dev test` / CI and runs separately; this skill is for the human-shaped flows that automated tests miss
- Smoke testing a fresh `git pull` you didn't touch — only relevant when there is a diff to validate

## Hard Rules

1. **Run the list yourself first.** The list shown to the user is the **walked** list, not a draft. Every check must have been executed via Chrome DevTools MCP (or, for non-UI tickets, the documented manual equivalent) before the user sees it.
2. **Fix everything you find, including pre-existing issues.** A console error that was already on `main` is still a console error on this branch — patch it as part of the validation loop and surface it in the summary as "also fixed" (translated to the user's session language).
3. **No silent skips.** If a step cannot be tested (e.g. the project has no app, the change is backend-only and no UI consumes it yet), declare that explicitly in the list — don't omit the step.
4. **Never reuse production data.** Seeds use `@test.com` emails and clearly fake names so they're filterable / wipeable.
5. **Never leave dev servers orphaned.** Follow [managing-dev-servers](${CLAUDE_PLUGIN_ROOT}/skills/managing-dev-servers/SKILL.md) for start + stop semantics. If you used `lt dev up`, leave it up only if the user wants to continue testing manually.
6. **Account visibility is mandatory.** Every step that requires a login MUST explicitly name the account (email, password, role). The developer reads the list as their own re-walk manual — they must be able to log into the stack without follow-up questions. This applies to both reused seed accounts AND newly-created accounts. For public/unauthenticated steps, mark them explicitly as `Account: no login (public / incognito)` (translated to the user's session language) instead of omitting the field.
7. **The user's final answer is binary in spirit:** ship or optimize further. The `AskUserQuestion` at the end always offers both — never end the workflow without that gate.

## Workflow

### Step 1 — Decide whether this step applies at all

Skim the diff (`git diff <base>...HEAD --name-only`):

- **At least one file under `projects/app/`, `packages/app/`, `app/`, `**/*.vue`, `**/*.svelte`, `**/*.tsx`, or any frontend route directory** → full browser pass mandatory.
- **Backend-only diff (`projects/api/`, `src/server/`, etc.)** that exposes a new/changed endpoint:
  - If a frontend consumer exists in the same repo → still do a browser pass (the new endpoint will manifest in the UI somewhere).
  - If no consumer exists yet → reduce to an API smoke pass: hit each new/changed endpoint with `curl` against `https://api.<slug>.localhost` (or the active API URL from `lt dev status`) at three role levels (Admin, regular User, unauthenticated) and assert the response matches the documented contract. Skip the UI portion explicitly in the list.
- **Pure tooling / config / CI diff** (no runtime impact): log "No browser test required — diff has no runtime impact" (translated to the user's session language) and exit cleanly. Do NOT skip the user gate, even here — they still get the closing question to confirm "ship".

### Step 2 — Boot the application

Follow the [managing-dev-servers](${CLAUDE_PLUGIN_ROOT}/skills/managing-dev-servers/SKILL.md) decision tree. Short version:

- If the prompt contains an "Active lt-dev project" block with `session: yes` → already running, use the URLs from the block.
- If the block says `session: no` → run `lt dev up` and wait until `https://<slug>.localhost` answers 200 OK.
- If the block says "lt-Stack project detected — not yet migrated" → run `lt dev init` first (idempotent — also chains `lt dev install` if needed), then `lt dev up`.
- If no block is injected → non-lt project. Start the project's documented dev server via `run_in_background: true` (e.g. `pnpm dev`) and `pkill` it at the end. Use the documented localhost ports.

**Never start `pnpm dev` / `pnpm start` directly when an lt-dev context block is present** — that bypasses Caddy and re-introduces cross-wiring risk.

If the boot fails (port collision, missing CA trust, DB not running): run `lt dev doctor` and resolve before continuing. Do NOT walk the list against a half-broken stack.

### Step 3 — Seed realistic test data + cover every role

The seed data is for **you** — Chrome DevTools MCP will log in as it, navigate as it, click as it. Make it realistic enough that the flows the user cares about actually fire (a list view needs items, a role-gated action needs the right role, a dashboard needs numbers).

Choose the cheapest seed path that produces the required data:

1. **Project provides a seed script** (`pnpm run seed`, `pnpm db:seed`, `scripts/seed.ts`, etc.) → run it. Read it first to know which accounts it produces and what their credentials are — you MUST surface those credentials to the user later.
2. **`tests/fixtures/` contains a seed fixture** → adapt it inline or pipe it via the API. Same rule: read the fixture to know the credentials.
3. **No seed infrastructure exists** → create accounts + entities yourself via Chrome DevTools MCP (sign-up flow) OR via direct API calls (`testHelper`-style, but ad-hoc — `curl https://api.<slug>.localhost/auth/signin -d '{...}'`). You pick the passwords; record them.

Seed rules:

- **Emails end in `@test.com`** so the cleanup regex picks them up later (consistent with `building-stories-with-tdd`).
- **Names are obviously fake** (`Test Admin`, `Test User One`) — never realistic personally-identifying strings.
- **Cover every role you will test against.** For a permission-matrix ticket, that means one account per role mentioned in the matrix from the implementation step. If the matrix lists `Admin`, `User`, `Guest`, and a custom `Reviewer` role, you create or reuse four accounts.
- **Cover the entity states the diff touches.** A list-view change needs ≥3 items including edge cases (long string, missing optional field, special characters). A status-driven flow needs items in each status (draft / sent / archived / etc.).
- **Use a single, memorable password scheme** across all accounts (e.g. `TestPass123!`) — so the user can re-walk fast without juggling passwords. Never write "see seed" or "default password" — always write the literal value.

**Maintain an account registry** in your working notes from this step onwards. For every account you reuse or create, record: email, literal password, role, and provenance (`existing seed` vs `NEW for this walk`). The registry feeds the test-list header AND the closing summary — the user needs every credential visible to reproduce the walk. Translate the provenance labels to the user's session language when rendering.

### Step 4 — Derive the step-by-step test list from the diff

Build the list **from the actual diff**, not from a generic template. For every changed or newly-added surface, generate one or more concrete check steps.

**Account-per-step is mandatory.** Every step in the list explicitly names which account is used:

- For login-required steps → `Account: <email>` (the account from the registry built in Step 3).
- For public / unauthenticated routes → `Account: no login (public / incognito)` (translated to the user's session language).
- For multi-role flows (e.g. "Admin approves, User sees result") → split into separate steps, one per role, each naming its account.

Never leave the account implicit — the user reads the list as their own re-walk manual.

Render the test plan in the **language the user has been speaking in this session**. The English template below is illustrative — translate the headings, account-list labels, and step prose when you produce the actual output:

```
🧪 Test Plan: <Ticket-ID / Feature Name>

🌐 Server : https://<slug>.localhost  (App) / https://api.<slug>.localhost (API)

👥 Accounts for this walk
- admin@test.com   / TestPass123!  / Admin / existing seed
- user1@test.com   / TestPass123!  / User  / NEW for this walk
- guest@test.com   / TestPass123!  / Guest / NEW for this walk
- (no login) / — / — / public routes

📋 Steps
[ ] 1. <Page / Flow / Component> — Account: <email> — <concrete action> — <expected result>
[ ] 2. <Page / Flow> — Account: no login (public) — <action> — <expectation>
[ ] 3. ...
```

Coverage rules (apply each that fits the diff):

- **Every changed page / route** → at least one check that navigates to it and confirms it renders without console errors, hydration mismatches, or 4xx/5xx network calls.
- **Every changed component used in multiple places** → check each callsite, not just one. Use `git grep` against the component name to find them.
- **Every new / changed form** → check (a) happy path submit, (b) at least one validation error, (c) the loading state, (d) the success feedback (Toast / redirect / inline confirmation).
- **Every new / changed list view** → check (a) populated state, (b) empty state, (c) error state (force by killing the API or injecting a 500 via `evaluate_script`), (d) pagination edge if applicable.
- **Every role / permission matrix row from the implementation step** → log in as that role using the account from the registry, attempt the action, assert allow / deny / partial as documented.
- **Every destructive action** → confirm the confirm-dialog is present, the button is red / clearly destructive, and the action is reversible (or explicitly not).
- **Every navigation change** (new route, redirect, breadcrumb update) → walk it from the entry point the user would actually use, not just direct URL.
- **Mobile viewport pass** at the end: `resize_page` to 390×844, walk the top 3–5 most-affected pages again, confirm no overflow / unreachable buttons / collapsed-menu regressions.
- **Console + network pass** at the end: take a final `take_snapshot`, `list_console_messages`, and `list_network_requests` on the most-changed page. Any `error` / `warning` level console message or failed network request → finding.

For non-UI tickets (backend-only, no consumer): the list is shorter — endpoint, role, expected status code, expected schema. Same rigor on account visibility (which role is used per request).

### Step 5 — Walk the list yourself

For each step, drive Chrome DevTools MCP using the `mcp__plugin_lt-dev_chrome-devtools__*` tools (NOT the Playwright-based browser MCP — see [managing-dev-servers](${CLAUDE_PLUGIN_ROOT}/skills/managing-dev-servers/SKILL.md)).

Typical tool calls per step intent:

- **Open the app** → `new_page` with the URL from Step 2.
- **Sign in as a role** → `fill_form` on the login form using the credentials from the registry built in Step 3.
- **Navigate** → `navigate_page`.
- **Click / interact** → `click` (with `take_snapshot` first to get stable selectors), `fill`, `press_key`, `hover`, `drag`.
- **Verify state** → `take_snapshot` (DOM tree) + `take_screenshot` (visual confirmation).
- **Inspect console** → `list_console_messages` after the action.
- **Inspect network** → `list_network_requests` after the action.
- **Force an error** → `evaluate_script` to throw / mutate a request / mock a 500.
- **Mobile pass** → `resize_page` to 390×844, repeat the relevant steps.
- **Run a Lighthouse a11y / perf snapshot** → `lighthouse_audit` on the most-changed page.

After each step, mark the checkbox **only if** the step actually passed. If it failed → Step 6.

### Step 6 — Fix everything you find, then re-walk

Findings during the walk include:

- A new or pre-existing bug (broken button, wrong text, 500 on a side-effect endpoint, layout overflow, ...).
- A console error or warning. Treat warnings as findings unless they are documented third-party noise.
- A network failure (4xx other than expected 401/403, 5xx, CORS error, slow request > 2s for a non-load-heavy endpoint).
- A regressed empty / loading / error state.
- An a11y violation surfaced by Lighthouse (focus order, missing label, contrast).
- A mobile regression (overflow, unreachable button, broken menu).

For each finding:

1. **Diagnose root cause** by reading the relevant code (the component, the page, the composable, the controller / service if backend).
2. **Fix it** — including if it pre-dates the branch. Use the same editing rules the originating workflow has been using (TypeScript strictness, no `--no-verify`, no `@ts-ignore`).
3. **Note it in working memory** as "also fixed" (translated to the user's session language) — these will surface in the final summary so the user knows the branch did more than just the ticket.
4. **Re-walk the affected step** to confirm green.
5. **Re-walk dependent steps too** — a fix to a shared composable might affect other pages.

Stall guard: if the same finding fails to converge after 3 fix attempts, stop the loop, write a structured diagnosis (file, observation, attempted fixes, current hypothesis), and surface it as a blocker in the final summary. Don't ship a known-broken state silently.

If a finding is truly out-of-scope and high-risk to fix in this branch (e.g. a multi-day refactor of a shared module), explicitly note it as "out of scope, separate ticket recommended" (translated to the user's session language) — the user gets to decide what to do with it.

### Step 7 — Show the user the walked list

Render the **final** list (every step ticked) in a structured block. **Repeat the account registry verbatim** so the user can log in without scrolling back. Render in the language the user has been speaking; the English template below is illustrative:

```
╔══════════════════════════════════════════════════════════╗
║ Manual Browser Walk: <Ticket-ID / Feature>              ║
╚══════════════════════════════════════════════════════════╝

🌐 Stack
- App:  <URL>
- API:  <URL>
- DB:   <slug>-local (seed data: @test.com)

👥 Accounts (re-walk credentials — log in with these)
- admin@test.com   / TestPass123!  / Admin / existing seed
- user1@test.com   / TestPass123!  / User  / NEW for this walk
- guest@test.com   / TestPass123!  / Guest / NEW for this walk
- (no login) / — / — / public routes

📋 Executed checks
[✓] 1. <Step> — Account: <email> — Observation: <short note on what actually happened>
[✓] 2. <Step> — Account: no login — Observation: ...
[✓] 3. <Step> — Account: <email> — Observation: ...

🛠 Also fixed during the walk
- <file:line> — <short reason — what was broken>
- ...
- (Mark pre-existing issues clearly as "pre-existing" vs. "from current implementation")

⚠ Deliberately not fixed (out of scope)
- <file:line> — <reason, recommendation: separate ticket>
- (Empty if everything was covered)

📸 Screenshots / Lighthouse
- <path or inline reference to relevant take_screenshot / lighthouse_audit results>
```

The list must be **scannable** — the user reads it as their own re-walk plan, the account registry makes the re-walk reproducible.

If `lt dev up` was started by this skill, leave it running for the user's re-walk **unless they declare they don't need it** in Step 8.

### Step 8 — Ship-or-Optimize gate

Always close with `AskUserQuestion`. **Translate the question text and the four option labels to the language the user has been speaking** — the English version below is illustrative:

- **Question:** "Browser walk complete. Ready to ship, or should we optimize further?"
- **Options:**
  1. "🚀 Ship — everything looks good" *(Recommended)*
  2. "🛠 Optimize further — I'll describe what" — free-text follow-up; the originating workflow re-enters its implementation loop with the user's notes.
  3. "👀 I'll re-test myself first — wait" — pause; leave `lt dev up` running; the user will return with a verdict.
  4. "❌ Cancel — leave branch as-is" — stop, no shipping; leave the branch as-is for the user.

On option 1: clean up dev servers (`lt dev down` if you started it, `pkill` non-lt processes) **after** asking the user one last time if they want to keep the stack running for a final sanity check. Then return control to the originating workflow with verdict `READY-TO-SHIP`.

On option 2: collect the user's notes, return to the originating workflow's implementation step with that scope. After the fixes, this skill runs again from Step 4 (new list from the new diff).

On option 3: don't tear down the stack. Print the account registry + URLs prominently again. Stop, wait for the user's next message.

On option 4: tear down the stack the same way as option 1. Surface a closing block stating the branch is intact and unpushed (if the originating workflow normally pushes).

## Working with the originating workflow

This skill is **invoked from** another workflow — never the entry point on its own. The contract:

- **Inputs** the originating workflow MUST pass:
  - `diff_base` (e.g. `origin/dev`) so the skill can compute the diff.
  - `ticket_id` (if any) for the list header.
  - `permission_matrix` (if Step 5 of the originating workflow produced one) — the skill uses it directly for role coverage.
  - `also_fixed_carryover` (any pre-existing issues already noted by earlier steps) — the skill will avoid double-fixing them.

- **Outputs** the skill returns to the originating workflow:
  - `verdict`: `READY-TO-SHIP` | `OPTIMIZE` | `WAITING-FOR-USER` | `CANCELLED`
  - `also_fixed`: list of files fixed inside this skill's loop (so they can be folded into the originating workflow's summary)
  - `out_of_scope_findings`: list of issues deliberately deferred (for the originating workflow to convert into follow-up tickets)
  - `accounts_registry`: list of all accounts used (existing + newly-created) with credentials — the originating workflow includes this in its own summary block so the user has the credentials in one place.
  - `final_list`: the rendered list (so the originating workflow can include it in its own summary block)

- **Failure modes the originating workflow must handle:**
  - `stall_guard_triggered` — a finding failed to converge; the originating workflow should NOT mark the ticket complete.
  - `boot_failed` — the stack couldn't start; the originating workflow should surface `lt dev doctor`'s output and stop.

## Related Skills & Tools

- [managing-dev-servers](${CLAUDE_PLUGIN_ROOT}/skills/managing-dev-servers/SKILL.md) — decision tree for booting servers (`lt dev` vs fallback)
- [using-lt-cli](${CLAUDE_PLUGIN_ROOT}/skills/using-lt-cli/SKILL.md) — `lt dev` command reference
- [developing-lt-frontend](${CLAUDE_PLUGIN_ROOT}/skills/developing-lt-frontend/SKILL.md) — frontend patterns the fixes may need to follow
- [generating-nest-servers](${CLAUDE_PLUGIN_ROOT}/skills/generating-nest-servers/SKILL.md) — backend patterns for API-side fixes during the walk
- Chrome DevTools MCP — `mcp__plugin_lt-dev_chrome-devtools__*` tool family. **Do NOT** use the Playwright-based browser MCP for this skill.

## Final Reminders

- The user only sees the **walked** list, never a draft. If you couldn't walk a step, that step's status is documented and the user is told.
- Fixing pre-existing issues during the walk is the default behavior, not an exception.
- Every step in the list names the account it uses — no implicit logins. New accounts created during this walk are listed with their literal credentials.
- The `AskUserQuestion` at the end is mandatory — there is no path that returns to the originating workflow without it.
- All user-facing artefacts (test plan, walked list, status labels, AskUserQuestion text + options) are translated to the language the user has been speaking in this session — never hardcode the output language.
