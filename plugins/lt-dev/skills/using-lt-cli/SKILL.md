---
name: using-lt-cli
description: 'Provides reference for the lenne.tech CLI tool (lt command). Covers lt fullstack init (workspace creation with local template symlinks), lt fullstack update (version sync), lt fullstack convert-mode (npm/vendor switch), lt git get/reset (branch management), lt server create (project scaffolding), lt server object/addProp (element generation), and lt dev (parallel project orchestration via Caddy + dedicated LaunchAgent — install/uninstall/migrate/up/down/status/doctor/tunnel). Activates when user mentions "lt", "lt CLI", "lenne.tech CLI", "lt fullstack", "lt git", "lt server", "lt dev", "fullstack workspace", "local templates", "--api-link", "--frontend-link", "--noConfirm", "convert-mode", "npm mode", "vendor mode", "Caddy tunnel", "trycloudflare", or any lt command syntax. NOT for NestJS module/object/property creation (use generating-nest-servers). NOT for Vue/Nuxt frontend code (use developing-lt-frontend).'
---

# LT CLI Reference

## Gotchas

- **`lt fullstack init` without `--noConfirm` blocks Claude Code forever** — The interactive prompts (project name, git init, template selection) wait for stdin input. Claude Code cannot respond to them, and the session hangs on "Unfurling..." with no token consumption. ALWAYS pass `--noConfirm` + all required flags (`--name X --frontend nuxt --git false`) when calling lt CLI from Claude Code.
- **`--api-link` and `--frontend-link` create SYMLINKS, not copies** — Changes to the template (`nest-server-starter`, `nuxt-base-starter`) in your workspace (e.g. `~/code/lenneTech/`) immediately affect the linked project. This is a feature for framework development but surprises developers who expect copies. Document it in the project README when using `--api-link`.
- **`lt git reset` is DESTRUCTIVE and irreversible** — Lives next to the safe `lt git get` in the CLI menu. `reset` does `git reset --hard` followed by force-pull, destroying ALL local changes without confirmation. Never run it on a branch with unpushed work. Prefer `git stash` + `lt git get`.
- **`lt server object X --controller` generates REST, NOT GraphQL** — Default is REST. For GraphQL projects, use `--resolver`. The CLI does not auto-detect from existing project patterns — you must specify explicitly.
- **`lt fullstack convert-mode` rewrites the source tree** — Switching between `npm` and `vendor` mode moves framework code in/out of `src/core/` (API) or `app/core/` (App). The operation is reversible but NOT idempotent mid-run — always commit before starting, so a failed conversion can be rolled back via `git reset`.
- **`--next` is experimental and incompatible with `lt server module/object/addProp/test/permissions`** — When `lt server create --next` or `lt fullstack init --next` is used, the API is cloned from [`nest-base`](https://github.com/lenneTech/nest-base) (Bun + Prisma 7 + Postgres + Better-Auth) instead of `nest-server-starter`. The downstream generators target the classic nest-server layout (Mongoose models, src/server/modules/, etc.) and will not work on a nest-base project. Use it for greenfield prototyping only; for production work prefer the default template.
- **macOS: a long `$TMPDIR` breaks Nuxt SSR under `lt dev up`** — On macOS, `$TMPDIR` is a long per-user path (`/var/folders/…`, often >~49 chars). Nuxt 4.4.7's vite-node builds a Unix domain socket path under it that exceeds the OS 104-character limit → SSR crashes with a 500. Workaround: start with a short tmp dir, `TMPDIR=/tmp lt dev up`. (Linux `$TMPDIR=/tmp` is short, so this only bites on macOS.)
- **macOS: HMR WebSocket port 24678 collides between parallel `lt dev` projects** — Two `lt dev` projects running at once both try to bind Vite's HMR WS port 24678. `vite.server.hmr.port` is **ignored by Nuxt 4.4.7**, so you cannot reassign it in config. This is **non-fatal** — SSR recompile still works; only live-HMR pushes on the second project are affected. Reload the page to pick up changes there.

## Skill Boundaries

| User Intent | Correct Skill |
|------------|---------------|
| "lt fullstack init" | **THIS SKILL** |
| "lt git get feature-branch" | **THIS SKILL** |
| "lt server create my-project" | **THIS SKILL** |
| "lt server module / object / addProp" | generating-nest-servers |
| "lt server permissions" | generating-nest-servers |
| "Create a NestJS module" | generating-nest-servers |
| "Build a Vue component" | developing-lt-frontend |
| "lt deployment create" | **THIS SKILL** (see the `lt deployment create` command) |
| "Deploy to TurboOps / go live / turbo deploy / deployment stage" | deploying-to-turboops |

**After `lt fullstack init`:**
- Backend work (projects/api/) → `generating-nest-servers`
- Frontend work (projects/app/) → `developing-lt-frontend`

## Commands

### lt git get — Checkout/Create Branch

```bash
lt git get <branch-name>    # alias: lt git g
```

1. Branch exists locally → switches to it
2. Branch exists on remote → checks out and tracks
3. Neither exists → creates new branch from current

### lt git reset — Reset to Remote

```bash
lt git reset
```

Fetches latest from remote, resets current branch to `origin/<branch>`. **Destructive** — all local changes lost.

### lt fullstack init — Create Fullstack Workspace

```bash
# Non-interactive
lt fullstack init --name <Name> --frontend <angular|nuxt> --git <true|false> --noConfirm \
  [--git-link <URL>] [--api-link <path>] [--frontend-link <path>] [--next]
```

| Parameter | Required | Description |
|-----------|----------|-------------|
| `--name` | Yes | Workspace name (PascalCase) |
| `--frontend` | Yes | `angular` or `nuxt` |
| `--git` | Yes | Initialize git: `true` / `false` |
| `--noConfirm` | No | Skip confirmation prompts |
| `--git-link` | No | Git repository URL |
| `--api-branch` | No | Branch of nest-server-starter |
| `--frontend-branch` | No | Branch of frontend starter |
| `--api-copy` / `--api-link` | No | Local API template (copy / symlink) |
| `--frontend-copy` / `--frontend-link` | No | Local frontend template (copy / symlink) |
| `--next` | No | **Experimental** — clone [`nest-base`](https://github.com/lenneTech/nest-base) (Bun + Prisma 7 + Postgres + Better-Auth) for the API. Forces `apiMode = Rest`, `frameworkMode = npm`, and skips the workspace install (run `pnpm install` for app and `bun install` for api manually). Downstream `lt server module/object/addProp/test` are NOT compatible with the resulting layout. |

**Priority:** `--*-link` > `--*-copy` > `--*-branch` > default (GitHub clone)

**Created structure:**
```
<workspace>/
├── projects/
│   ├── api/    ← nest-server-starter (or nest-base with --next)
│   └── app/    ← nuxt-base-starter (or ng-base-starter)
├── package.json
└── .gitignore
```

**Post-creation:**
```bash
cd <workspace> && pnpm install
lt dev init                      # idempotent: ENV patches + register; auto-runs `lt dev install` first if the machine isn't set up yet
lt dev up                        # Start API + App behind Caddy under https://<slug>.localhost

# With --next: install per subproject, no workspace install
cd <workspace>/projects/app && pnpm install
cd <workspace>/projects/api && bun install
```

(Falls back to `pnpm -r --parallel run start` on default ports 3000/3001 if `lt dev` is not used.)

### lt dev — Parallel Project Orchestration (Caddy + HTTPS)

Serves every lt project under stable HTTPS URLs (`<slug>.localhost`, `api.<slug>.localhost`) via Caddy so multiple projects can run side by side without colliding on 3000/3001 and without auth cross-wiring. Use this in every lt-monorepo or standalone API/App project.

```bash
lt dev install                   # One-time per machine: bootstraps dedicated LaunchAgent/systemd unit + Caddyfile stub + CA reminder
lt dev uninstall [--purge]       # Remove the lt-dev service (--purge also drops Caddyfile + logs)
lt dev init                      # Once per project (idempotent): ENV patches + register
lt dev up                        # Start API + App behind Caddy
lt dev down                      # Stop processes + remove Caddy block (also tears down any isolated test stack)
lt dev test                      # ISOLATED Playwright E2E: parallel stack + dedicated `<slug>-test` DB, auto-teardown
lt dev test --shard              # Shard across 2 isolated stacks (default — stable sweet spot)
lt dev test --shard 3            # Shard across N isolated stacks (each own ports/Caddy/DB `<slug>-test-<i>`)
lt dev test --shard auto         # Size N from this machine's CPU + RAM (conservative)
lt dev test down                 # Tear the isolated test stack(s) down (residue-free)
lt dev status                    # Show URLs + PIDs + live upstream state for THIS project (incl. any test stack)
lt dev status --all              # List every registered project + running state
lt dev doctor                    # Diagnose Caddy / CA / DNS / port issues
lt dev tunnel [--api]            # Foreground Cloudflare Quick Tunnel: public *.trycloudflare.com URL
```

What each subcommand does:

- **`install`** — One-time per machine. Verifies `caddy` is on PATH (suggests `brew install caddy` if missing), creates `~/.lenneTech/Caddyfile` stub, writes + bootstraps a dedicated LaunchAgent (macOS, `~/Library/LaunchAgents/tech.lenne.lt-dev-caddy.plist`) or systemd-user unit (Linux). Waits up to 8s for the Caddy admin endpoint (`:2019`) to respond, validates the file, and reminds you to run **`sudo -E HOME="$HOME" caddy trust`** (the `-E HOME="$HOME"` is mandatory — without it sudo switches HOME to `/var/root` and the CA install silently fails). **Does NOT use `brew services start caddy`** — its plist hardcodes `--config /opt/homebrew/etc/Caddyfile` and crash-loops against our Caddyfile location. **Auto-chains:** when run inside an un-initialized lt-dev project, runs `init` afterwards (`--skip-init` to opt out).
- **`uninstall`** — Symmetric counterpart to `install`. Boots out the LaunchAgent / systemd unit, removes the unit file. With `--purge` also deletes `~/.lenneTech/Caddyfile` and caddy logs. Does NOT remove the caddy binary itself (use `brew uninstall caddy` if desired).
- **`init`** (alias `migrate`) — Idempotent. Builds the project identity (slug = `package.json` "name", subdomains from monorepo layout), patches legacy hardcoded `port: 3000` / `port: 3001` / Vite-proxy targets / Playwright URLs to env-aware variants (defaults preserved), persists to `~/.lenneTech/projects.json`, injects a "Local Development (lt dev)" URL block into all `CLAUDE.md` files, adds `.lt-dev/` to `.gitignore`. **Auto-chains:** runs `install` first when the machine isn't prepared yet (`--skip-install` to opt out).
- **`up`** — Allocates internal upstream ports (4000+, never 3000/3001), upserts the Caddy block with **`reverse_proxy 127.0.0.1:<port>`** + reloads, exports `PORT`, `HOST=127.0.0.1` / `NITRO_HOST=127.0.0.1` (pins dev servers to IPv4 so the upstream is unambiguous), `BASE_URL`, `APP_URL`, `NUXT_API_URL`, `NUXT_PUBLIC_API_URL`, `NUXT_PUBLIC_SITE_URL`, `NUXT_PUBLIC_STORAGE_PREFIX`, `NUXT_PUBLIC_API_PROXY=false`, `NSC__MONGOOSE__URI`, `DATABASE_URL`, `NODE_EXTRA_CA_CERTS` (Caddy root CA so Nuxt SSR fetches trust HTTPS), plus legacy aliases `API_URL` / `SITE_URL` for projects that pre-date the `NUXT_*` convention. Then spawns `pnpm start` (api) + `pnpm dev` (app) detached. Pre-flight checks refuse to start when Caddy is missing, Caddy daemon is down, an existing session is alive, or internal ports are bound. Logs at `<root>/.lt-dev/{api,app}.log`.
- **`down`** — Sends SIGTERM to the saved process group (negative PID) so children (Vite, Nest watcher, etc.) receive it too. Removes the project's Caddy block + reloads. Also tears down any isolated test stack (`lt dev test`) for this project.
- **`test`** — ISOLATED E2E. Brings up a SECOND, parallel stack (`<slug>-test.localhost` / `api.<slug>-test.localhost`, own ports + Caddy block + `.lt-dev/.env.test` bridge) on a **dedicated DB `<slug>-test`** (separate from the dev `<slug>-local` and the API-test `<slug>-e2e`), runs the Playwright suite (global-setup resets that DB once before the first test), then **auto-tears-down residue-free**. Runs alongside — and never touches — the dev session. `--keep` leaves it up; **`lt dev test down`** stops it; `--api` runs the (already isolated) API tests instead; `--debug` = PWDEBUG+headed; `-- <args>` forwards to Playwright. **`--shard N`** runs the suite split across N FULLY-isolated stacks in parallel (each own ports + Caddy block + DB `<slug>-test-<i>`) + N `--shard=i/N` Playwright processes — the local CI-parity matrix. A bare **`--shard` defaults to 2** (the stable sweet spot: N≥3 over-subscribes the perf cores on a typical dev machine → flaky); `--shard auto` sizes N from CPU+RAM (conservative). Local shards share ONE machine (unlike CI's per-shard containers), so the CLI exports `LT_DEV_TEST_SHARDS` for the project's playwright.config to relax timeouts under that load only (CI stays fast). `lt dev test down` reclaims all shards. Requires the lt CLI version that ships this isolated session.
- **`status`** / **`status --all`** — Current project: subdomains → upstream ports, db URI, session PIDs (alive/dead), live `lsof` upstream state. `--all`: every registered project with a `●`/`○` indicator.
- **`doctor`** — Caddy on PATH, **lt-dev LaunchAgent / systemd unit loaded**, daemon running, Caddyfile valid, ports 80/443 free or held by Caddy, `*.localhost` resolves (IPv4 or IPv6 loopback), registry status.
- **`tunnel`** — Foreground Cloudflare Quick Tunnel: `cloudflared tunnel --url https://<slug>.localhost --http-host-header <slug>.localhost --no-tls-verify`. Prints a public `*.trycloudflare.com` URL (5-10s) and runs until Ctrl-C. Default exposes the App; `--api` switches the target. Auth cookies on the localhost domain are NOT valid on the tunnel URL — add the tunnel URL to Better-Auth's `trustedOrigins` for login flows to succeed. Start a second `lt dev tunnel --api` in parallel for full external usage.

**Override the spawn binary** via `LT_PNPM_BIN` (e.g. for bun-based projects via wrapper script).

### lt ticket — Parallel ticket dev environments

Work on several tickets/features of ONE project at the same time — each in its
OWN git worktree + its OWN isolated `lt dev` stack (own URLs, ports, Caddy block,
empty DB) — so several tickets can be browser-tested AND E2E-tested in parallel
without any cross-influence.

```bash
lt ticket start DEV-2200            # worktree (branch feat/DEV-2200 from origin/dev) + pnpm install + lt dev up
                                    #   → https://svl-2200.localhost / https://api.svl-2200.localhost, DB svl-sports-system-2200 (empty)
lt ticket start checkout-refactor   # no ticket? a free feature name works too → svl-checkout-refactor.localhost
lt ticket start DEV-2200 --as cof   # override the short id; --branch / --base override branch / base ref (default origin/dev)
lt ticket list                      # dashboard: every ticket env + URLs + branch + status + DB (re-view URLs anytime)
lt ticket switch <id>               # show the worktree path + open it in $LT_EDITOR (default `code`)
lt ticket test <id> [--shard N]     # run the E2E suite in the ticket's isolated stack/DB (delegates to lt dev test)
lt ticket stop <id> [--drop-db]     # lt dev down + remove the worktree (branch kept); --drop-db also drops the ticket DBs
```

- **Isolation:** ticket `DEV-2200` → short id `2200`; a free name is used as-is. Every ticket gets `<slug>-<id>` EVERYWHERE — URLs `<slug>-<id>.localhost` / `api.<slug>-<id>…`, dev DB `<base>-<id>`, test DB `<base>-<id>-test[-<shard>]`, own ports + Caddy block + session. The sibling worktree folder `<parent>/<slug>-<id>` matches the URL, so you always know which ticket you are in.
- **Always from fresh `dev`:** `start` does `git fetch` + branches from `origin/dev`, so every ticket is independent (`--base <ref>` to start elsewhere). Worktrees share ONE `.git` — one `git fetch` updates all, creation is instant, teardown is git-tracked (vs. a full clone per ticket: slower, duplicates `.git`, untracked).
- **Claude-aware automatically:** a gitignored `.lt-dev/ticket` marker tags the worktree → every `lt dev *` run in it is ticket-aware with NO flags, and the lt-dev hook surfaces the ticket id + URLs each prompt. The git-tracked `CLAUDE.md` is NEVER modified per ticket (no git noise).
- **DB-wiping `global-setup`:** allow the per-ticket test-DB pattern `<base>-<id>-test(-<n>)` in the project's allow-list + local-DB guard — only `…-test` names, NEVER a ticket's dev DB. (svl's `global-setup.ts#isAllowedDb` is the reference.)

### lt server create — Scaffold New Server

```bash
lt server create <name> --noConfirm [--branch <branch>] [--copy <path>] [--link <path>] [--next]
```

Creates a standalone NestJS project from nest-server-starter. With `--next`, clones [`nest-base`](https://github.com/lenneTech/nest-base) (Bun + Prisma 7 + Postgres + Better-Auth) instead and skips API-mode / vendor-mode / install / `lt.config.json` processing. For module/object/property commands, see `generating-nest-servers` skill — those are NOT compatible with `--next` projects.

### lt deployment create — Wire the Project to TurboOps

```bash
lt deployment create --noConfirm
```

Run from the repo root. Writes `.turboops.json` = `{ "project": "<slug>" }` at
the repo root — the link between the repo and its TurboOps project (`<slug>` =
the TurboOps project slug). CI reads this file, so **commit it**.

This is only the first step of taking an lt fullstack project live. The complete
end-to-end flow — GitLab CI/CD variables (`TURBOOPS_PROJECT` + the masked
`TURBOOPS_TOKEN` minted in the TurboOps web UI), creating a **multi-service**
deployment stage via the TurboOps web UI (never the single-service MCP
bootstrap), DNS-before-Let's-Encrypt, the swarm Mongo URI, and CI-driven
redeploys — is documented in the **`deploying-to-turboops`** skill and driven by
the `/lt-dev:deployment:setup` command. Read that skill before creating a stage;
it documents the two MCP traps that silently produce a broken fullstack deploy.

## Best Practices

- **Always** use `--noConfirm` from Claude Code to avoid blocking prompts
- Run `git status` before `lt git reset` — it's irreversible
- Use PascalCase for workspace names
- Use `--api-link` / `--frontend-link` for local template development (fastest)
- After init: `pnpm install` → start API → start App

## Reference Files

| Topic | File |
|-------|------|
| Command reference & troubleshooting | [reference.md](${CLAUDE_SKILL_DIR}/reference.md) |
| Real-world examples | [examples.md](${CLAUDE_SKILL_DIR}/examples.md) |

## External Documentation (Canonical Source)

The authoritative references live in the `lenneTech/cli` GitHub repository. Fetch via `WebFetch` when deep context is needed:

| Document | URL | When to fetch |
|----------|-----|---------------|
| **LT-ECOSYSTEM-GUIDE** | `https://raw.githubusercontent.com/lenneTech/cli/main/docs/LT-ECOSYSTEM-GUIDE.md` | Full reference for CLI + plugin (architecture, commands, agents, skills, vendor-mode, glossary) |
| **VENDOR-MODE-WORKFLOW** | `https://raw.githubusercontent.com/lenneTech/cli/main/docs/VENDOR-MODE-WORKFLOW.md` | Step-by-step guide for npm ↔ vendor conversion, vendor updates, rollback |
| **Command Reference** | `https://raw.githubusercontent.com/lenneTech/cli/main/docs/commands.md` | Full CLI command reference with all options |
| **Configuration Guide** | `https://raw.githubusercontent.com/lenneTech/cli/main/docs/lt.config.md` | lt.config.json reference |

**When to fetch**: When user asks about architecture/design decisions, vendor-mode conversion steps, or any CLI/plugin function not covered by this skill's condensed content.

## Related Skills

- `generating-nest-servers` — `lt server module`, `lt server object`, `lt server addProp`, `lt server permissions`
- `developing-lt-frontend` — Nuxt/Vue frontend development
- `building-stories-with-tdd` — TDD workflow orchestration
- `deploying-to-turboops` — take an lt fullstack project live on TurboOps via CI/CD (the full flow after `lt deployment create`)
