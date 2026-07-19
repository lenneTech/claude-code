---
name: managing-dev-servers
description: 'Rules for starting, monitoring, and stopping local development servers (nuxt dev, nest start, npm/pnpm run dev, pnpm build --watch, Playwright, etc.) and for closing the Chrome DevTools MCP browser and minimizing tabs after tests. Prefers `lt dev up/down/status/tunnel` for lt CLI projects — stable HTTPS URLs (`<slug>.localhost`, `api.<slug>.localhost`) via Caddy, project-scoped env vars, parallel projects without port or auth cross-wiring. `lt dev tunnel` exposes a project via a Cloudflare Quick Tunnel. Falls back to the run_in_background / pkill contract for non-lt projects to prevent orphaned processes blocking the Claude Code session ("Unfurling..."). Activates whenever a long-running process starts for manual validation, Chrome DevTools MCP debugging, TDD, framework linking, or E2E, or when browser tabs must be closed / minimized after a walk. Referenced by building-stories-with-tdd, developing-lt-frontend, generating-nest-servers, validating-changes-in-browser, and contributing-to-lt-framework.'
user-invocable: false
---

# Managing Dev Servers

Local development servers (`npm run dev`, `nuxt dev`, `nest start`, `pnpm build --watch`, `pnpm test:watch`, etc.) are long-running processes. If they are started uncontrolled in the background, Claude Code cannot reliably reclaim them, the session blocks on "Unfurling..." without consuming tokens, and the user must press ESC to continue.

Apply these rules whenever you start any such process — regardless of whether you are inside a TDD cycle, a framework-linking session, a manual validation run, or an MCP-driven debugging flow.

## Decision tree — what to run before any dev server

The plugin's `detect-lt-dev` hook injects one of three context blocks at the top of every prompt. Use that block as your switch:

1. **"Active lt-dev project" with `session: yes`** — Project registered AND running. Use the URLs from the block. Do nothing extra; for browser tests / API calls use the URLs as-is.
2. **"Active lt-dev project" with `session: no`** — Project registered, **not** running. For the **Playwright/E2E suite** run `lt dev test` (isolated parallel stack on a dedicated `<slug>-test` DB — never touches dev data, auto-teardown). For **manual browser tests, Chrome DevTools MCP, or API probes**, run `lt dev up` first.
3. **"lt-Stack project detected — not yet migrated"** — Project IS an lt project but the registry entry is missing. **Proactively run `lt dev init` first** (idempotent, safe — patches legacy ports, registers, updates CLAUDE.md). Then `lt dev up`. **Do NOT start `pnpm dev` / `pnpm start` as a workaround.**
4. **No block injected** — Not an lt project. Use the classic `run_in_background: true` + `pkill` pattern documented below.

If `lt dev up` later complains that Caddy is missing or the daemon is not running, run `lt dev install` first. One-time per machine:

```bash
brew install caddy                       # macOS (Linux: https://caddyserver.com/docs/install)
lt dev install                           # writes + bootstraps the dedicated LaunchAgent / systemd-user unit
sudo -E HOME="$HOME" caddy trust         # trust the local Caddy root CA system-wide
```

**Do NOT use `brew services start caddy`** — its plist hardcodes `--config /opt/homebrew/etc/Caddyfile` and crash-loops against the lt-dev Caddyfile at `~/.lenneTech/Caddyfile`. `lt dev install` owns its own dedicated service (`tech.lenne.lt-dev-caddy`) to sidestep that entirely. **The `-E HOME="$HOME"` on `caddy trust` is also mandatory** — without it sudo switches HOME to `/var/root`, caddy fails to find its user-scoped CA, and the trust install silently does nothing.

## Preferred for lt-Projects: `lt dev up`

```bash
lt dev install      # One-time per machine (dedicated LaunchAgent/systemd unit + Caddyfile stub + CA reminder)
lt dev uninstall    # Remove the lt-dev service (symmetric counterpart; `--purge` also drops Caddyfile + logs)
lt dev init         # Once per project (idempotent — patches + register + CLAUDE.md)
lt dev up           # Start API + App behind Caddy with stable HTTPS URLs
lt dev status       # Show what is running for THIS project
lt dev status --all # List every registered project + running state
lt dev down         # Stop processes + remove Caddy block + clear ENV bridge
lt dev doctor       # Diagnose Caddy / CA / DNS / port issues
lt dev test         # ISOLATED Playwright E2E: parallel stack + dedicated DB, auto-teardown
lt dev test down    # Tear the isolated test stack down (residue-free)
lt dev tunnel       # Foreground Cloudflare Quick Tunnel — expose the App publicly (--api for the API)
```

**`init` and `install` auto-chain (idempotent, one hop, no recursion):** running `lt dev init` on a machine that isn't set up runs `lt dev install` first; running `lt dev install` inside an un-initialized project runs `lt dev init` afterwards. So the minimal first run in a fresh project is just **`lt dev init`** then **`lt dev up`** — no need to remember the install step. Opt out with `--skip-install` (init) / `--skip-init` (install). The former name `lt dev migrate` still works as an alias for `lt dev init`.

## E2E tests (Playwright + API)

**API E2E tests (TestHelper, in-process)** — run unchanged. They start a NestJS test module in-process on a dynamic port and never touch Caddy. Use `pnpm run test:e2e` in `projects/api` as before.

**App E2E tests (Playwright) — preferred: the isolated `lt dev test` (below).** For ad-hoc runs against the dev session, the `lt dev up` bridge still applies:
- `lt dev up` writes a `<root>/.lt-dev/.env` bridge file containing `NUXT_PUBLIC_SITE_URL`, `NUXT_PUBLIC_API_URL`, storage prefix, DB URI, and `NODE_EXTRA_CA_CERTS` (Caddy root CA path).
- `lt dev init` injects a tiny `// >>> lt-dev:bridge >>>` block at the top of `playwright.config.ts` that auto-loads this file. Result: any Playwright invocation (`pnpm test:e2e`, `npx playwright test`, VS Code Playwright Extension, JetBrains test runner) automatically picks up the active URLs and trusts the local CA — no parent-shell env required.
- Existing env-aware patterns (`process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3001'`) keep working as fallback when `lt dev` is not active (CI, classic local dev).

**`lt dev test` — ISOLATED parallel E2E stack (preferred for the suite):** spins up a SECOND, fully separate stack that runs PARALLEL to — and never touches — your `lt dev up` dev session:
- Own URLs (`<slug>-test.localhost` / `api.<slug>-test.localhost`), own internal ports + Caddy block, and a **dedicated DB `<slug>-test`** — separate from both the dev DB (`<slug>-local`) and the API-test DB (`<slug>-e2e`).
- Playwright's `global-setup` resets that dedicated DB **once, before the first test** — so a developer keeps working in their own environment while E2E runs, a run never pollutes dev data, and tests may build on each other within the run.
- The test API runs COMPILED (`node dist`) for stable long suites; the App is a Nuxt dev server. A separate `.lt-dev/.env.test` bridge carries the test URLs + DB.
- **Auto-teardown** at the end — processes, Caddy block, env bridge, session file, registry entry all removed (residue-free) — with a Ctrl-C signal trap and a stale-session reclaim on the next run.

```bash
lt dev test                       # isolated Playwright E2E in projects/app (auto-teardown)
lt dev test --keep                # leave the test stack up afterwards (debug)
lt dev test down                  # tear the isolated test stack down (residue-free)
lt dev test --api                 # API tests in projects/api (already isolated on `<slug>-e2e` — no stack)
lt dev test --debug               # PWDEBUG=1 + headed
lt dev test -- --ui login.spec.ts # forward args to Playwright
```

**Do NOT run the Playwright suite against the `lt dev up` dev session** — that pollutes (and `global-setup` would reset) your dev DB. Use `lt dev test`.

**Limit local Playwright runs to new + affected specs to keep TDD loops fast.** The full Playwright suite is slow and runs in **CI**. During local development / TDD, default to `lt dev test -- <spec>` (or `lt dev test -- tests/e2e/<file>.spec.ts`); the equivalent for non-lt-projects is `scripts/e2e-fast.sh -- <spec>` / `pnpm dlx playwright test <spec>`. Backend Unit + API stay unrestricted — they're fast. Only run the **full** local Playwright suite when the user explicitly asks (or when an orchestrator like `production-ready` calls for it).

> **Requires** the lt CLI version that ships the isolated test session. Older lt CLIs run `lt dev test` against the dev session (legacy behavior). The project's `playwright.config.ts` global-setup must reset only the active `MONGO_URI` DB and allow-list `<slug>-test`.

**Why `lt dev` is the preferred path:**

- Stable URLs per project (`https://crm.localhost`, `https://api.crm.localhost`) — bookmarks, IDE-run-configs, and Chrome DevTools MCP commands stay valid across restarts.
- Cross-wiring impossible: API only trusts its own App origin (Better Auth `trustedOrigins` derived from `APP_URL`), App only talks to its own API (`BASE_URL`), localStorage is namespaced by `NUXT_PUBLIC_STORAGE_PREFIX=<slug>`, MongoDB is namespaced by `NSC__MONGOOSE__URI`.
- HTTPS locally with cookie-domain `.<slug>.localhost` makes WebAuthn/Passkey-style auth realistic without same-origin tricks. The Vite-API-Proxy is OFF under `lt dev up` (`NUXT_PUBLIC_API_PROXY=false`).
- Spawned processes are detached; logs go to `<project>/.lt-dev/{api,app}.log` so the Claude Code session does not block. Previous logs are rotated to `<name>.log.1` on each `lt dev up`; only one prior generation is kept (bounded disk usage even across long `up`/`down` cycles).
- Clean stop path via `lt dev down` (process-group SIGTERM, Caddy block removed, no orphaned children).

**One-time setup per machine:** run `lt dev install` once. Verifies Caddy is installed (suggests `brew install caddy`), creates the Caddyfile stub, writes + bootstraps the dedicated LaunchAgent / systemd-user unit (so it auto-starts on login and never collides with `brew services caddy`), then reminds you to run `sudo -E HOME="$HOME" caddy trust` so browsers accept `https://*.localhost`.

**Sharing a running project externally (mobile preview, webhook target, teammate review):** `lt dev tunnel` — opens a Cloudflare Quick Tunnel to the App, prints a public `https://*.trycloudflare.com` URL, runs in the foreground until Ctrl-C. `lt dev tunnel --api` exposes the API instead (start a second one in parallel for full external usage). Requires `cloudflared` on PATH (`brew install cloudflared`). Auth cookies on `*.localhost` are NOT valid on the tunnel URL — Better-Auth's `trustedOrigins` must include the random tunnel URL for login flows to succeed.

**One-time setup for an existing project:** run `lt dev init` once. Idempotent — patches legacy hardcoded ports in `config.env.ts` / `nuxt.config.ts` / `playwright.config.ts` to env-aware variants (defaults preserved), registers the project in `~/.lenneTech/projects.json`, updates the project's `CLAUDE.md` with the URL block, and rewrites a leftover `lt-monorepo` package name to the directory basename so each project gets its own `<slug>.localhost` (relevant when the user `git clone`d the template directly instead of running `lt fullstack init`).

**If the prompt contains "Active lt-dev project" context, NEVER start with `pnpm dev` / `pnpm start` directly — use `lt dev up`.** The injected context block lists the actual URLs for the current project. If session is `no`, run `lt dev up` first; the URLs only resolve while the Caddy block + processes are active.

## Local email (Mailpit)

Local transactional mail is caught by a shared **Mailpit** instance (the modern successor to
MailHog — the lenneTech catcher was migrated; the hostname may still read `mailhog.lenne.tech`
but it runs Mailpit). Projects send via SMTP on port `1025`; when no SMTP host is configured
nest-server uses `jsonTransport` and does **not** transmit (so test envs never send). The web
UI is basic-auth protected — **credentials live in the team vault; never hardcode them.**

To inspect what an app sends — or to harden email templates — Mailpit gives you, per message:
a correct **HTML preview of `multipart/related` + inline CID images** (old MailHog could not —
it showed raw MIME boundaries / `=3D` artifacts, a *preview* limitation, not a mail defect), a
**responsive phone/tablet/desktop preview**, an **HTML Check** client-compatibility score, and
a **Link Check** — plus a scriptable **REST API** (`/api/v1/messages`,
`/api/v1/message/{id}/html-check`, `/api/v1/message/{id}/part/{n}`, `DELETE /api/v1/messages`).
Verify emails via Chrome DevTools MCP (web UI) or the REST API; automated tests must assert
content **without** sending (jsonTransport or an `EmailService` recording mock).

→ Full details, endpoints, send-a-test-mail recipe, and CID-vs-URL logo trade-offs:
[reference/local-email-mailpit.md](reference/local-email-mailpit.md).

## Chrome DevTools MCP — Browser-Tabs & Cleanup

The Chrome DevTools MCP (`mcp__…_chrome-devtools__*`) drives a **real Chrome instance**. Every `new_page` is a real tab holding a live renderer process — memory and CPU that keep running until the tab is closed. Treat the browser exactly like a dev server: minimal footprint while it runs, fully released when the work is done.

**Tab economy — use as few tabs as possible:**

- Open the app **once** with `new_page`, then move through every subsequent step by `navigate_page` on that same page. Do **not** spawn a fresh tab per step.
- Open a **second** tab only when a step genuinely needs two contexts at once (e.g. comparing two roles side-by-side, an OAuth / popup window, a before/after view). Close it again with `close_page` the moment that step is over.
- `list_pages` shows what is open; `select_page` switches the active tab. If tabs have piled up, close the surplus with `close_page` before continuing.

**Close the browser after the tests:**

- When the browser work for the current task is finished, close every page you opened via `close_page` so the MCP can release the Chrome instance. **A browser must never linger idle after a test walk** — that is wasted memory for the rest of the session.
- Do this **even when you leave the dev server (`lt dev up`) running** for the user's own re-test: the user opens their own browser against the live stack, so Claude's automation browser has no reason to stay open. Server-lifecycle and browser-lifecycle are decided independently.

## Correct Pattern (for non-lt projects, or when `lt dev` is not applicable)

1. **Start with `run_in_background: true`** — Claude Code tracks the process and surfaces its output on demand.
2. **Wait for readiness before interacting** — poll for the port/log signal (`curl http://localhost:3000/health`, `pgrep -f "nest start"`, or a log line in the Bash output) instead of blind `sleep`.
3. **Stop the process after the test/validation** — use `pkill -f "<process-name>"` (e.g. `pkill -f "nuxt dev"`, `pkill -f "nest start"`, `pkill -f "build --watch"`).
4. **Ask before leaving a server running** — if the user might want to continue interactive debugging, confirm explicitly rather than assuming.

## Incorrect Patterns (Do Not Use)

- `npm run dev &` — backgrounded via shell without later cleanup
- `sleep N` after a backgrounded command without a kill step
- Leaving a dev server running and waiting for the next user prompt
- Reporting a task as "done" while `pgrep` still shows the process
- Starting `pnpm dev` directly when an "Active lt-dev project" context block is present — that bypasses Caddy and re-introduces cross-wiring risk

## Why It Matters

Orphaned dev servers block the Claude Code main loop. The session appears to hang ("Unfurling..."), no tokens are consumed, and the only recovery is user interaction (ESC). This breaks the autonomous iteration contract that TDD and framework-linking workflows rely on.

## Gotchas

- **"Unfurling..." with no token consumption** — This is the most-missed symptom. The spinner continues but nothing is happening. It means a background process was started uncontrolled and is holding the main loop. Recovery requires the user to press ESC; no retry will help. Prevention: always use `run_in_background: true` + eventual `pkill`.
- **Auth requires consistent BASE_URL/APP_URL — not a specific port number.** Better Auth derives passkey origin and trusted origins from `BASE_URL` (API) and `APP_URL` (App). When `lt dev up` is used, these are set automatically to the project's HTTPS URLs (`https://api.<slug>.localhost`/`https://<slug>.localhost`) — auth works regardless of internal port. The legacy "3000/3001 only" rule applies ONLY to projects that have not yet been migrated to env-aware config (run `lt dev init` to migrate). For non-lt projects with hardcoded ports, the original rule still holds: starting on a different port silently breaks auth.
- **Cookies between API and App** — Under `lt dev up` / `lt dev test`, both subdomains share the parent `.<slug>.localhost` so Better Auth's `crossSubDomainCookies` (auto-enabled in the local baseline when `BASE_URL` is set) makes session cookies visible across both. The `NUXT_PUBLIC_API_PROXY=false` default is intentional — the vite-proxy hack is no longer needed. **E2E cookie INJECTION caveat:** a real `Set-Cookie: Domain=<slug>.localhost` is a DOMAIN cookie (RFC 6265: sent to subdomains incl. `api.<slug>.localhost`), but Playwright `addCookies({ domain })` with a BARE domain (no leading dot) is stored HOST-ONLY and is NOT sent to the API subdomain → the cross-origin `/iam/get-session` returns `null` → auto-logout to `/auth/login`. When injecting a captured session, prefix a leading dot for multi-label hosts (`.<slug>-test.localhost`); single-label hosts (CI/`localhost`) stay host-only. See `developing-lt-frontend/reference/e2e-testing.md`.
- **`pnpm build --watch` is a dev server too** — Framework-linking workflows run both `pnpm build --watch` and `pnpm dev` in parallel. The watch process is easy to forget in cleanup because it produces less visible output. Track it like any other server and `pkill -f "build --watch"` when done.
- **`pkill -f "<name>"` matches too broadly with short names** — `pkill -f "dev"` can kill unrelated processes (e.g. `devtools`, `developer`). Always match the full command: `pkill -f "nuxt dev"`, `pkill -f "nest start"`, `pkill -f "pnpm build --watch"`.

## Integration Points

- **building-stories-with-tdd** — Step 3 (Run Tests) and Step 5b (Final Validation) both may start servers. Apply these rules before entering the iteration loop and before final sign-off.
- **developing-lt-frontend** — Use `lt dev up` (preferred) or `nuxt dev` (fallback) for Chrome DevTools MCP debugging, `npx playwright test` for E2E. Playwright reads `NUXT_PUBLIC_SITE_URL` so it follows whatever URL `lt dev up` exports.
- **generating-nest-servers** — Use `lt dev up` (preferred) or `nest start` (fallback) for manual API probing, E2E runs against a live API.
- **contributing-to-lt-framework** — both `pnpm build --watch` (framework side) and `pnpm dev` (starter side) run in parallel. Track and clean up both.

## URLs (lenne.tech Fullstack)

- **Default (template fallback):** API `localhost:3000`, App `localhost:3001`. These remain the fallback for projects that have not been migrated to env-aware config or are run via `pnpm start`/`pnpm dev` directly.
- **Per-project (lt-dev mode):** Stable HTTPS URLs from `~/.lenneTech/projects.json`: `https://<slug>.localhost` (App) + `https://api.<slug>.localhost` (API). Always read the active URLs from the prompt's "Active lt-dev project" context block when present, or run `lt dev status` to inspect.

### URL/Port Collision Recovery

If two projects compete for the same internal port:

1. Run `lt dev status --all` to see which projects are registered + running.
2. For lt-aware projects: `lt dev down` on the other project before `lt dev up` on the new one — internal ports are auto-allocated, so collisions are extremely rare.
3. For non-lt processes still bound to a port: `lsof -iTCP -sTCP:LISTEN -nP -iTCP:<port>` to find the PID, `pkill -f "<matching process>"` to free it.
4. If Caddy itself fails to bind 80/443: `lt dev doctor` will identify the culprit. Stop the conflicting webserver, then re-run `lt dev install` (it bootstraps the lt-dev LaunchAgent / systemd unit, no `brew services` involved).

Do NOT pick a random alternative port for non-migrated projects — their hardcoded auth config will not match. Either migrate the project with `lt dev init`, or fix the collision and use the original port.

## Final-Validation Checklist

Before reporting a task complete:

- [ ] If `lt dev up` was used: `lt dev down` was called (or the user explicitly agreed to leave it running)
- [ ] Every Chrome DevTools MCP tab opened during testing was closed via `close_page` — `list_pages` shows no leftover automation tab (this is independent of the dev-server keep/stop decision)
- [ ] All background servers started via `run_in_background: true` have been terminated with `pkill`
- [ ] `pgrep -f "nuxt dev"` and `pgrep -f "nest start"` (and any `build --watch`) return no matches — or the user has been asked and agreed to leave them running
- [ ] The active project's URLs are free (use `lt dev status` for lt-projects, `lsof -i :3000 -i :3001` for the default fallback) unless the user asked for a running server
