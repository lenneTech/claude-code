---
name: managing-dev-servers
description: 'Rules for starting, monitoring, and stopping local development servers (nuxt dev, nest start, npm/pnpm run dev, pnpm build --watch, Playwright, etc.) across all lt-dev workflows. Enforces the run_in_background / pkill contract that prevents orphaned processes from blocking the Claude Code session ("Unfurling..."). Activates whenever a long-running process must be started for manual validation, Chrome DevTools MCP debugging, TDD iterations, framework linking, or any E2E test run. Referenced by building-stories-with-tdd, developing-lt-frontend, generating-nest-servers, and contributing-to-lt-framework.'
user-invocable: false
---

# Managing Dev Servers

Local development servers (`npm run dev`, `nuxt dev`, `nest start`, `pnpm build --watch`, `pnpm test:watch`, etc.) are long-running processes. If they are started uncontrolled in the background, Claude Code cannot reliably reclaim them, the session blocks on "Unfurling..." without consuming tokens, and the user must press ESC to continue.

Apply these rules whenever you start any such process — regardless of whether you are inside a TDD cycle, a framework-linking session, a manual validation run, or an MCP-driven debugging flow.

## Correct Pattern

1. **Start with `run_in_background: true`** — Claude Code tracks the process and surfaces its output on demand.
2. **Wait for readiness before interacting** — poll for the port/log signal (`curl http://localhost:3000/health`, `pgrep -f "nest start"`, or a log line in the Bash output) instead of blind `sleep`.
3. **Stop the process after the test/validation** — use `pkill -f "<process-name>"` (e.g. `pkill -f "nuxt dev"`, `pkill -f "nest start"`, `pkill -f "build --watch"`).
4. **Ask before leaving a server running** — if the user might want to continue interactive debugging, confirm explicitly rather than assuming.

## Incorrect Patterns (Do Not Use)

- `npm run dev &` — backgrounded via shell without later cleanup
- `sleep N` after a backgrounded command without a kill step
- Leaving a dev server running and waiting for the next user prompt
- Reporting a task as "done" while `pgrep` still shows the process

## Why It Matters

Orphaned dev servers block the Claude Code main loop. The session appears to hang ("Unfurling..."), no tokens are consumed, and the only recovery is user interaction (ESC). This breaks the autonomous iteration contract that TDD and framework-linking workflows rely on.

## Gotchas

- **"Unfurling..." with no token consumption** — This is the most-missed symptom. The spinner continues but nothing is happening. It means a background process was started uncontrolled and is holding the main loop. Recovery requires the user to press ESC; no retry will help. Prevention: always use `run_in_background: true` + eventual `pkill`.
- **Alternative ports silently break authentication** — Better Auth cookies are configured against ports 3000 (API) and 3001 (App). Starting on another port (e.g. because 3000 is bound) makes login APIs return 401/403 mysteriously. Fix the port collision (`lsof` + `pkill`) rather than switching to 3002.
- **`pnpm build --watch` is a dev server too** — Framework-linking workflows run both `pnpm build --watch` and `pnpm dev` in parallel. The watch process is easy to forget in cleanup because it produces less visible output. Track it like any other server and `pkill -f "build --watch"` when done.
- **`pkill -f "<name>"` matches too broadly with short names** — `pkill -f "dev"` can kill unrelated processes (e.g. `devtools`, `developer`). Always match the full command: `pkill -f "nuxt dev"`, `pkill -f "nest start"`, `pkill -f "pnpm build --watch"`.

## Integration Points

- **building-stories-with-tdd** — Step 3 (Run Tests) and Step 5b (Final Validation) both may start servers. Apply these rules before entering the iteration loop and before final sign-off.
- **developing-lt-frontend** — `nuxt dev` for Chrome DevTools MCP debugging, `npx playwright test` for E2E.
- **generating-nest-servers** — `nest start` / `pnpm dev` for manual API probing, E2E runs against a live API.
- **contributing-to-lt-framework** — both `pnpm build --watch` (framework side) and `pnpm dev` (starter side) run in parallel. Track and clean up both.

## Ports (lenne.tech Fullstack)

- **API (nest-server-starter):** Port `3000` — required for authentication cookies and CORS
- **App (nuxt-base-starter):** Port `3001` — required for authentication cookies and CORS

Do not remap these ports during local testing; Better Auth and CORS are configured against them.

### Port Collision Recovery

If a start fails because the port is already bound (leftover from a previous iteration):

```bash
lsof -i :3000        # or :3001
pkill -f "<matching process>"
```

Then re-start. Do not pick an alternative port as a workaround — the auth config will not match.

## Final-Validation Checklist

Before reporting a task complete:

- [ ] All background servers started via `run_in_background: true` have been terminated with `pkill`
- [ ] `pgrep -f "nuxt dev"` and `pgrep -f "nest start"` (and any `build --watch`) return no matches — or the user has been asked and agreed to leave them running
- [ ] Ports 3000 and 3001 are free (`lsof -i :3000 -i :3001` returns empty) unless the user asked for a running server
