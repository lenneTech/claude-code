---
name: validating-changes-in-browser
description: 'Final browser validation after implementation AND review have succeeded. Boots the app via `lt dev up`, seeds realistic `@test.com` data, derives a step-by-step test list from the diff (every affected page, role, flow, empty/error state, mobile pass, console + network sweep), then walks it autonomously via Chrome DevTools MCP. Fixes everything it finds, including pre-existing issues, in the same loop. Activates as the last step of any ship-oriented workflow, and on "im Browser prüfen", "durchklicken". NOT a substitute for implementation, code review, or automated E2E tests, which run before.'
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
- `/lt-dev:take-ticket` — as its STEP 9.5, before the summary (with `owns_release_gate: true`; the command's own closing question follows the walk)
- `/lt-dev:ticket-cycle` — as its Phase C, after the optional review and before the release gate (with `owns_release_gate: true`)
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
6. **Account visibility is mandatory.** Every step that requires a login names the account explicitly (email, password, role). The developer reads the list as their own re-walk manual — they must be able to log into the stack without follow-up questions. This applies to both reused seed accounts AND newly-created accounts. For public/unauthenticated steps, mark them explicitly as `Account: no login (public / incognito)` (translated to the user's session language) instead of omitting the field.
7. **Ticket context block is mandatory.** Every walked list begins with a short context block stating (a) what the task / bug was in 1–3 sentences ("task summary"), (b) how it was implemented or fixed in 1–3 sentences plus the most-relevant `file:line` references ("implementation summary"), and (c) the ticket link when the originating workflow knows one (Linear URL, GitHub issue URL, file path of a `*.md` story). The user uses this block to orient themselves before re-walking — they should not need to switch context to remember what the branch is about.
8. **URL-per-step is mandatory for UI steps — as a clickable markdown link.** Every step that touches a browser route carries the fully-qualified URL the user navigates to, **rendered as a clickable markdown link** so the user clicks straight from the list (e.g. `URL: [users/new](https://<slug>.localhost/users/new)`). The session renders GitHub-flavored markdown, so `[label](url)` is clickable in the terminal / VS Code. Deep links (with query params, route params, or hash fragments) keep the exact form you used during the walk inside the link target. For non-UI steps (backend smoke pass, CLI flow), record the equivalent locator (`curl` URL + method, command line). Omit only when the step is genuinely location-less.
9. **The user's final answer is binary in spirit:** ship or optimize further. The `AskUserQuestion` at the end always offers both, unless the originating workflow owns the release gate itself (`owns_release_gate`, see Step 8): then this skill returns its verdict without asking, and the workflow asks once, after its own preparation.
10. **Keep the browser lean and close it when the walk ends.** Reuse a single Chrome DevTools MCP page across steps (`navigate_page`, not a fresh `new_page` per step); open a second tab only when a step truly needs two contexts at once, and `close_page` it immediately after. When the walk concludes — on **every** `AskUserQuestion` outcome — close every page you opened via `close_page` so the MCP releases the Chrome instance, even when you leave `lt dev up` running for the user's own re-test (they use their own browser). Browser-close is independent of the dev-server keep/stop decision. See [managing-dev-servers](${CLAUDE_PLUGIN_ROOT}/skills/managing-dev-servers/SKILL.md).

## Workflow

### Step 1 — Decide whether this step applies at all

The browser walk is a test run like the unit, API, and E2E suites: **whenever the change can be verified through the frontend, directly or indirectly, it runs automatically.** Never ask whether to walk, and never leave it to a flag. The criterion is the one [`writing-qa-test-instructions`](${CLAUDE_PLUGIN_ROOT}/skills/writing-qa-test-instructions/SKILL.md) Part 1 applies to QA, so "walked by Claude" and "testable by QA" never disagree.

Skim the diff (`git diff <base>...HEAD --name-only`) and ask where its effect shows up:

- **Directly:** at least one file under `projects/app/`, `packages/app/`, `app/`, `**/*.vue`, `**/*.svelte`, `**/*.tsx`, or any frontend route directory → full browser pass.
- **Indirectly:** a backend, config, or data change whose effect reaches the UI through a reproducible symptom → full browser pass that produces and checks that symptom. Typical shapes: a validation rule that changes the error a form shows, a permission change that shows, hides, or rejects an action for a role, a query or filter change that alters which records a list shows, a new field that a page renders, an e-mail the app sends (check it in Mailpit), a migration whose result is visible on a page, a runtime config change (`nuxt.config.ts`, env defaults) that changes behaviour. Name the symptom per step, so the walked list says what it proves.
- **No frontend path at all** (a new endpoint no UI consumes yet, an internal job with no visible trace): API smoke pass instead. Hit each new or changed endpoint with `curl` against `https://api.<slug>.localhost` (or the active API URL from `lt dev status`) at three role levels (Admin, regular User, unauthenticated) and assert the response matches the documented contract. State the skipped UI portion and its reason in the list.
- **No runtime impact** (pure tooling, CI, docs, tests only): log "No browser test required — diff has no runtime impact" (translated to the user's session language) and exit cleanly with `READY-TO-SHIP`.

When in doubt between "indirectly" and "no frontend path", walk. A walk that finds nothing costs minutes; a symptom nobody looked at reaches QA or production.

### Step 2 — Boot the application

Follow the [managing-dev-servers](${CLAUDE_PLUGIN_ROOT}/skills/managing-dev-servers/SKILL.md) decision tree. Short version:

- If the prompt contains an "Active lt-dev project" block with `session: yes` → already running, use the URLs from the block.
- If the block says `session: no` → run `lt dev up` and wait until `https://<slug>.localhost` answers 200 OK.
- If the block says "lt-Stack project detected — not yet migrated" → run `lt dev init` first (idempotent — also chains `lt dev install` if needed), then `lt dev up`.
- If no block is injected → non-lt project. Start the project's documented dev server via `run_in_background: true` (e.g. `pnpm dev`) and `pkill` it at the end. Use the documented localhost ports.

**Never start `pnpm dev` / `pnpm start` directly when an lt-dev context block is present** — that bypasses Caddy and re-introduces cross-wiring risk.

If the boot fails (port collision, missing CA trust, DB not running): run `lt dev doctor` and resolve before continuing. Do NOT walk the list against a half-broken stack.

**The stack is scoped to the project, not to your session.** `lt dev up` serves one `<slug>` with one dev database (`<slug>-local`), so a parallel Claude Code session in the same project shares both. Three consequences:

- **`session: yes` may mean a peer started it.** That is fine, use it. But it means `lt dev down` at the end of your walk stops a stack somebody else is mid-walk in. When a peer is live in this project (`ListAgents`), leave the stack up and say so instead.
- **A reseed is destructive for the peer too.** Step 3 writes into the shared dev database. Wiping and reseeding pulls the ground out from under a peer's logged-in session. Add your data alongside theirs, or send one `CONFLICT` and agree who owns the database for the next few minutes.
- **The isolated `lt dev test` stack has none of this problem.** It runs its own `<slug>-test` database and its own URLs, so an E2E suite never disturbs a peer's walk. Prefer it whenever the walk does not have to happen against the dev data.

The Chrome DevTools MCP itself needs no coordination: each session spawns its own chain and its own Chrome, so tabs never cross. What does cross is `pkill` on `chrome` or `node`, and the `cleanup-stale-chrome-mcp` hook, which reaps any chain older than `CHROME_MCP_MAX_AGE_HOURS` (72 by default) that is not its own session's — including a peer's, mid-walk. See [coordinating-peer-sessions](${CLAUDE_PLUGIN_ROOT}/skills/coordinating-peer-sessions/SKILL.md).

### Step 3 — Seed realistic test data + cover every role

The seed data is for **you** — Chrome DevTools MCP will log in as it, navigate as it, click as it. Make it realistic enough that the flows the user cares about actually fire (a list view needs items, a role-gated action needs the right role, a dashboard needs numbers).

Choose the cheapest seed path that produces the required data:

1. **Project provides a seed script** (`pnpm run seed`, `pnpm db:seed`, `scripts/seed.ts`, etc.) → run it. Read it first to know which accounts it produces and what their credentials are, because the walked list has to name them later.
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

Render the test plan in the **language the user has been speaking in this session**. The English template below is illustrative — translate the headings, account-list labels, and step prose when you produce the actual output. Always include the ticket-context block (task summary + implementation summary + ticket link) and a `URL:` field per UI step, rendered as a clickable markdown link `[<route>](https://…)`:

```
Test Plan: <Ticket-ID / Feature Name>

Ticket
- Link    : <Linear URL / GitHub issue URL / file:path-to-story.md, or "no ticket — ad-hoc fix">
- Task    : <1–3 sentence summary of what needed to happen — copied / paraphrased from ticket>
- Done by : <1–3 sentence summary of how it was implemented or fixed, with the most-relevant file:line refs>

Server : https://<slug>.localhost  (App) / https://api.<slug>.localhost (API)

Accounts for this walk
- admin@test.com   / TestPass123!  / Admin / existing seed
- user1@test.com   / TestPass123!  / User  / NEW for this walk
- guest@test.com   / TestPass123!  / Guest / NEW for this walk
- (no login) / — / — / public routes

Steps
[ ] 1. <Page / Flow / Component> — Account: <email> — URL: [<route>](https://<slug>.localhost/<route>) — <concrete action> — <expected result>
[ ] 2. <Page / Flow> — Account: no login (public) — URL: [<public-route>](https://<slug>.localhost/<public-route>) — <action> — <expectation>
[ ] 3. <Backend smoke> — Account: <email or "anonymous"> — URL: POST https://api.<slug>.localhost/<endpoint> (curl) — <action> — <expectation>
[ ] 4. ...
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

**Tab economy:** open the app **once** with `new_page`, then drive every subsequent step by `navigate_page` on that same page — do not open a fresh tab per step. Spawn a second tab only when a step genuinely needs two contexts at once (two roles side-by-side, an OAuth / popup window), and `close_page` it the moment that step is done. `list_pages` shows what is open. See [managing-dev-servers → Chrome DevTools MCP — Browser-Tabs & Cleanup](${CLAUDE_PLUGIN_ROOT}/skills/managing-dev-servers/SKILL.md).

Typical tool calls per step intent:

- **Open the app** → `new_page` with the URL from Step 2 (once — reuse it via `navigate_page` afterwards).
- **Sign in as a role** → `fill_form` on the login form using the credentials from the registry built in Step 3.
- **Navigate** → `navigate_page` (prefer over a new tab).
- **Click / interact** → `click` (with `take_snapshot` first to get stable selectors), `fill`, `press_key`, `hover`, `drag`.
- **Verify state** → `take_snapshot` (DOM tree) + `take_screenshot` (visual confirmation). For a detail (alignment, a small label, an icon, a value in a chart or table), screenshot the element itself (`take_screenshot` with its `uid`) rather than judging it from a full-page image; when a Figma design exists, compare against its screenshot at the same viewport width.
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

**A defect is never out of scope.** Whatever the walk finds broken is fixed in this branch, pre-existing or not, and never turned into a ticket: it surfaced here, and the context to fix it is loaded here. Before touching files outside the originating ticket, coordinate with parallel sessions through the ledger (`peer-ledger.sh read`, then `claim`), as [`coordinating-peer-sessions`](../coordinating-peer-sessions/SKILL.md) describes; a defect a live peer already holds is named in the summary instead of being fixed twice. A fix that changes a contract or a data model is still made, and flagged to the originating workflow as an assumption the developer should check. The only thing that stops a fix is the stall guard above.

What may stay unfixed is an **idea**, not a defect: an improvement the walk noticed that no user would call broken. Name it in the final summary in one line, translated to the user's session language. **Do not open a ticket for it as a matter of course** — a walk that leaves a trail of follow-up tickets behind every ticket is how one day's work becomes a backlog. A ticket is filed only where the idea clears Part 0 of [`filing-ai-proposed-tickets`](../filing-ai-proposed-tickets/SKILL.md): demonstrated, standalone, and genuinely worse left undone. Then it goes through that skill in full — duplicate search first, Triage state, AI label. Everything else is a line in the summary, and the user decides.

### Step 7 — Show the user the walked list

Render the **final** list (every step ticked) in a structured block. **Repeat the ticket-context block AND the account registry verbatim** so the user can re-walk from a single screen without scrolling back. Each executed check carries its `URL:` field again so the user can click straight to the page. Render in the language the user has been speaking; the English template below is illustrative:

```
╔══════════════════════════════════════════════════════════╗
║ Manual Browser Walk: <Ticket-ID / Feature>              ║
╚══════════════════════════════════════════════════════════╝

Ticket
- Link    : <Linear URL / GitHub issue URL / file:path-to-story.md, or "no ticket — ad-hoc fix">
- Task    : <1–3 sentence summary of what needed to happen>
- Done by : <1–3 sentence summary of how it was implemented or fixed, with the most-relevant file:line refs>

Stack
- App:  <URL>
- API:  <URL>
- DB:   <slug>-local (seed data: @test.com)

Accounts (re-walk credentials — log in with these)
- admin@test.com   / TestPass123!  / Admin / existing seed
- user1@test.com   / TestPass123!  / User  / NEW for this walk
- guest@test.com   / TestPass123!  / Guest / NEW for this walk
- (no login) / — / — / public routes

Executed checks
[x] 1. <Step> — Account: <email> — URL: [<route>](https://<slug>.localhost/<route>) — Observation: <short note on what actually happened>
[x] 2. <Step> — Account: no login — URL: [<public-route>](https://<slug>.localhost/<public-route>) — Observation: ...
[x] 3. <Step> — Account: <email> — URL: POST https://api.<slug>.localhost/<endpoint> (curl) — Observation: ...

Also fixed during the walk
- <file:line> — <short reason — what was broken>
- ...
- (Mark pre-existing issues clearly as "pre-existing" vs. "from current implementation")

Ideas outside this ticket (never defects — those are fixed above)
- <file:line> — <the idea, why it is not part of this ticket>
- (Empty if there are none)

Screenshots / Lighthouse
- <path or inline reference to relevant take_screenshot / lighthouse_audit results>
```

The list must be **scannable** — the user reads it as their own re-walk plan, the account registry makes the re-walk reproducible.

If `lt dev up` was started by this skill, leave it running for the user's re-walk **unless they declare they don't need it** in Step 8.

### Step 8 — Ship-or-Optimize gate

**When the originating workflow passed `owns_release_gate: true`** (`/lt-dev:ticket-cycle` does, because it asks the developer once, after preparing test data and a re-test manual), do not ask here. Close the automation browser, leave `lt dev up` running for that preparation, and return the verdict you derived: `READY-TO-SHIP` when every step of the walked list passed, after your own fixes; `stall_guard_triggered` when a finding did not converge. A second question at this point would stop a run the developer expects to continue on its own.

Otherwise, always close with `AskUserQuestion`. **Translate the question text and the four option labels to the language the user has been speaking** — the English version below is illustrative:

- **Question:** "Browser walk complete. Ready to ship, or should we optimize further?"
- **Options:**
  1. "Ship — everything looks good" *(Recommended)*
  2. "Optimize further — I'll describe what" — free-text follow-up; the originating workflow re-enters its implementation loop with the user's notes.
  3. "I'll re-test myself first — wait" — pause; leave `lt dev up` running; the user will return with a verdict.
  4. "Cancel — leave branch as-is" — stop, no shipping; leave the branch as-is for the user.

**On every outcome, close the automation browser first.** The walk is over, so `close_page` every Chrome DevTools MCP page you opened — `list_pages` should show no leftover tab. This is independent of the stack decision below: even when the dev server stays up, the browser is released (the user re-tests in their own browser).

On option 1: close the browser (above), then clean up dev servers (`lt dev down` if you started it, `pkill` non-lt processes) **after** asking the user one last time if they want to keep the stack running for a final sanity check. Then return control to the originating workflow with verdict `READY-TO-SHIP`.

On option 2: close the browser (above), collect the user's notes, return to the originating workflow's implementation step with that scope. After the fixes, this skill runs again from Step 4 (new list from the new diff) — a fresh `new_page` reopens the browser then.

On option 3: close the browser (above) but **don't** tear down the stack. Print the account registry + URLs prominently again. Stop, wait for the user's next message — they re-test in their own browser against the still-running stack.

On option 4: close the browser (above), then tear down the stack the same way as option 1. Surface a closing block stating the branch is intact and unpushed (if the originating workflow normally pushes).

## Working with the originating workflow

This skill is **invoked from** another workflow — never the entry point on its own. The contract:

- **Inputs** the originating workflow passes:
  - `diff_base` (e.g. `origin/dev`) so the skill can compute the diff.
  - `ticket_id` (if any) for the list header.
  - `ticket_url` (if any) — full URL to the originating ticket (e.g. `https://linear.app/<workspace>/issue/DEV-123`, GitHub issue URL, or the absolute repo-relative path to the story file). The skill renders this verbatim in the ticket-context block; if the originating workflow only knows the identifier, it should derive the URL from the workspace conventions before invoking the skill.
  - `task_summary` — 1–3 sentences describing what the task / bug was, in the user's session language. Used in the ticket-context block. Source: ticket description for ticket-driven workflows, the bug description for `/lt-dev:debug`, the diff intent for ad-hoc rebases.
  - `implementation_summary` — 1–3 sentences describing how it was implemented or fixed, plus the most-relevant `file:line` references. Used in the ticket-context block.
  - `permission_matrix` (if Step 5 of the originating workflow produced one) — the skill uses it directly for role coverage.
  - `also_fixed_carryover` (any pre-existing issues already noted by earlier steps) — the skill will avoid double-fixing them.
  - `owns_release_gate` (optional, default `false`) — `true` when the originating workflow asks the developer for approval itself after this skill returns. The skill then returns its verdict without its own Step 8 question (see Step 8).

- **Outputs** the skill returns to the originating workflow:
  - `verdict`: `READY-TO-SHIP` | `OPTIMIZE` | `WAITING-FOR-USER` | `CANCELLED`
  - `also_fixed`: list of files fixed inside this skill's loop (so they can be folded into the originating workflow's summary)
  - `out_of_scope_findings`: improvement ideas deliberately left out of this branch — never defects, which are always fixed in the walk. The originating workflow decides whether any of them clears the bar for a proposal ticket
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
- [filing-ai-proposed-tickets](${CLAUDE_PLUGIN_ROOT}/skills/filing-ai-proposed-tickets/SKILL.md) — the only route by which an out-of-scope finding may become a ticket, and the bar it has to clear first
- Chrome DevTools MCP — `mcp__plugin_lt-dev_chrome-devtools__*` tool family. **Do NOT** use the Playwright-based browser MCP for this skill.

## Final Reminders

- The user only sees the **walked** list, never a draft. If you couldn't walk a step, that step's status is documented and the user is told.
- Fixing pre-existing issues during the walk is the default behavior, not an exception.
- Every step in the list names the account it uses — no implicit logins. New accounts created during this walk are listed with their literal credentials.
- Every UI step in the list carries the fully-qualified URL the user navigates to as a clickable markdown link `[route](url)` (deep links included), so the user can click straight to the page.
- The walked list opens with a ticket-context block (link + task summary + implementation summary) so the user knows what the branch is about without leaving the list.
- The `AskUserQuestion` at the end is mandatory, except when the originating workflow owns the release gate (`owns_release_gate: true`) and asks the developer itself.
- The walk runs automatically whenever the change is verifiable through the frontend, directly or through a symptom — nobody is asked whether to walk.
- Keep tabs to a minimum during the walk (one page, `navigate_page`) and `close_page` every automation tab once the walk ends — the browser is never left idle, regardless of whether the dev server stays up.
- All user-facing artefacts (test plan, walked list, status labels, AskUserQuestion text + options) are translated to the language the user has been speaking in this session — never hardcode the output language.
