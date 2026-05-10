---
name: managing-dev-servers
description: 'Rules for starting, monitoring, and stopping local development servers (nuxt dev, nest start, npm/pnpm run dev, pnpm build --watch, Playwright, etc.) across all lt-dev workflows. Prefers `lt dev up/down/status` for projects registered with the lt CLI — these serve every project under stable HTTPS URLs (`<slug>.localhost`, `api.<slug>.localhost`) via Caddy and inject project-specific env vars (BASE_URL, APP_URL, NUXT_PUBLIC_*, NSC__MONGOOSE__URI, NUXT_PUBLIC_STORAGE_PREFIX) so multiple lt projects can run in parallel without port collisions or auth cross-wiring. Falls back to the run_in_background / pkill contract for non-lt projects to prevent orphaned processes blocking the Claude Code session ("Unfurling..."). Activates whenever a long-running process must be started for manual validation, Chrome DevTools MCP debugging, TDD iterations, framework linking, or any E2E test run. Referenced by building-stories-with-tdd, developing-lt-frontend, generating-nest-servers, and contributing-to-lt-framework.'
user-invocable: false
---

# Managing Dev Servers

Local development servers (`npm run dev`, `nuxt dev`, `nest start`, `pnpm build --watch`, `pnpm test:watch`, etc.) are long-running processes. If they are started uncontrolled in the background, Claude Code cannot reliably reclaim them, the session blocks on "Unfurling..." without consuming tokens, and the user must press ESC to continue.

Apply these rules whenever you start any such process — regardless of whether you are inside a TDD cycle, a framework-linking session, a manual validation run, or an MCP-driven debugging flow.

## Decision tree — what to run before any dev server

The plugin's `detect-lt-dev` hook injects one of three context blocks at the top of every prompt. Use that block as your switch:

1. **"Active lt-dev project" with `session: yes`** — Project registered AND running. Use the URLs from the block. Do nothing extra; for browser tests / API calls use the URLs as-is.
2. **"Active lt-dev project" with `session: no`** — Project registered, **not** running. Run `lt dev up` before any browser test, Chrome DevTools MCP call, Playwright run, or API probe.
3. **"lt-Stack project detected — not yet migrated"** — Project IS an lt project but the registry entry is missing. **Proactively run `lt dev migrate` first** (idempotent, safe — patches legacy ports, registers, updates CLAUDE.md). Then `lt dev up`. **Do NOT start `pnpm dev` / `pnpm start` as a workaround.**
4. **No block injected** — Not an lt project. Use the classic `run_in_background: true` + `pkill` pattern documented below.

If `lt dev up` later complains that Caddy is missing or the daemon is not running, run `lt dev install` first (one-time per machine: `brew install caddy && brew services start caddy && sudo caddy trust`) and retry.

## Preferred for lt-Projects: `lt dev up`

```bash
lt dev install      # One-time per machine (Caddy + Caddyfile stub + CA reminder)
lt dev migrate      # Once per project (idempotent — patches + register + CLAUDE.md)
lt dev up           # Start API + App behind Caddy with stable HTTPS URLs
lt dev status       # Show what is running for THIS project
lt dev status --all # List every registered project + running state
lt dev down         # Stop processes + remove Caddy block + clear ENV bridge
lt dev doctor       # Diagnose Caddy / CA / DNS / port issues
lt dev test         # Convenience: ensure up + run E2E tests with bridge env
```

## E2E tests (Playwright + API)

**API E2E tests (TestHelper, in-process)** — run unchanged. They start a NestJS test module in-process on a dynamic port and never touch Caddy. Use `pnpm run test:e2e` in `projects/api` as before.

**App E2E tests (Playwright)** under `lt dev up`:
- `lt dev up` writes a `<root>/.lt-dev/.env` bridge file containing `NUXT_PUBLIC_SITE_URL`, `NUXT_PUBLIC_API_URL`, storage prefix, DB URI, and `NODE_EXTRA_CA_CERTS` (Caddy root CA path).
- `lt dev migrate` injects a tiny `// >>> lt-dev:bridge >>>` block at the top of `playwright.config.ts` that auto-loads this file. Result: any Playwright invocation (`pnpm test:e2e`, `npx playwright test`, VS Code Playwright Extension, JetBrains test runner) automatically picks up the active URLs and trusts the local CA — no parent-shell env required.
- Existing env-aware patterns (`process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3001'`) keep working as fallback when `lt dev` is not active (CI, classic local dev).

**The convenience wrapper `lt dev test`** ensures the project is up, waits for the App URL to respond, and runs the test command with the bridge env loaded — useful in TDD loops:
```bash
lt dev test                       # ensure up + pnpm test:e2e in projects/app
lt dev test --api                 # API tests in projects/api
lt dev test --teardown            # plus stop session after
lt dev test --debug               # PWDEBUG=1 + headed
lt dev test -- --ui crm-login.spec.ts   # forward args to playwright
```

**Why `lt dev` is the preferred path:**

- Stable URLs per project (`https://crm.localhost`, `https://api.crm.localhost`) — bookmarks, IDE-run-configs, and Chrome DevTools MCP commands stay valid across restarts.
- Cross-wiring impossible: API only trusts its own App origin (Better Auth `trustedOrigins` derived from `APP_URL`), App only talks to its own API (`BASE_URL`), localStorage is namespaced by `NUXT_PUBLIC_STORAGE_PREFIX=<slug>`, MongoDB is namespaced by `NSC__MONGOOSE__URI`.
- HTTPS locally with cookie-domain `.<slug>.localhost` makes WebAuthn/Passkey-style auth realistic without same-origin tricks. The Vite-API-Proxy is OFF under `lt dev up` (`NUXT_PUBLIC_API_PROXY=false`).
- Spawned processes are detached; logs go to `<project>/.lt-dev/{api,app}.log` so the Claude Code session does not block.
- Clean stop path via `lt dev down` (process-group SIGTERM, Caddy block removed, no orphaned children).

**One-time setup per machine:** run `lt dev install` once. Verifies Caddy is installed (suggests `brew install caddy`), creates the Caddyfile stub, reminds you to run `sudo caddy trust` so browsers accept `https://*.localhost`.

**One-time setup for an existing project:** run `lt dev migrate` once. Idempotent — patches legacy hardcoded ports in `config.env.ts` / `nuxt.config.ts` / `playwright.config.ts` to env-aware variants (defaults preserved), registers the project in `~/.lenneTech/projects.json`, and updates the project's `CLAUDE.md` with the URL block.

**If the prompt contains "Active lt-dev project" context, NEVER start with `pnpm dev` / `pnpm start` directly — use `lt dev up`.** The injected context block lists the actual URLs for the current project. If session is `no`, run `lt dev up` first; the URLs only resolve while the Caddy block + processes are active.

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
- **Auth requires consistent BASE_URL/APP_URL — not a specific port number.** Better Auth derives passkey origin and trusted origins from `BASE_URL` (API) and `APP_URL` (App). When `lt dev up` is used, these are set automatically to the project's HTTPS URLs (`https://api.<slug>.localhost`/`https://<slug>.localhost`) — auth works regardless of internal port. The legacy "3000/3001 only" rule applies ONLY to projects that have not yet been migrated to env-aware config (run `lt dev migrate` to migrate). For non-lt projects with hardcoded ports, the original rule still holds: starting on a different port silently breaks auth.
- **Cookies between API and App** — Under `lt dev up`, both subdomains share the parent `.<slug>.localhost` so Better Auth's `crossSubDomainCookies` (auto-enabled in the local baseline when `BASE_URL` is set) makes session cookies visible across both. The `NUXT_PUBLIC_API_PROXY=false` default is intentional — the vite-proxy hack is no longer needed.
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
4. If Caddy itself fails to bind 80/443: `lt dev doctor` will identify the culprit. Stop the conflicting webserver, then `brew services restart caddy`.

Do NOT pick a random alternative port for non-migrated projects — their hardcoded auth config will not match. Either migrate the project with `lt dev migrate`, or fix the collision and use the original port.

## Final-Validation Checklist

Before reporting a task complete:

- [ ] If `lt dev up` was used: `lt dev down` was called (or the user explicitly agreed to leave it running)
- [ ] All background servers started via `run_in_background: true` have been terminated with `pkill`
- [ ] `pgrep -f "nuxt dev"` and `pgrep -f "nest start"` (and any `build --watch`) return no matches — or the user has been asked and agreed to leave them running
- [ ] The active project's URLs are free (use `lt dev status` for lt-projects, `lsof -i :3000 -i :3001` for the default fallback) unless the user asked for a running server
