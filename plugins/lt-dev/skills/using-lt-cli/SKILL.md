---
name: using-lt-cli
description: 'Provides reference for the lenne.tech CLI tool (lt command). Covers lt fullstack init (workspace creation with local template symlinks), lt fullstack update (version sync), lt fullstack convert-mode (npm/vendor switch), lt git get/reset (branch management), lt server create (project scaffolding), and lt server object/addProp (element generation). Activates when user mentions "lt", "lt CLI", "lenne.tech CLI", "lt fullstack", "lt git", "lt server", "fullstack workspace", "local templates", "--api-link", "--frontend-link", "--noConfirm", "convert-mode", "npm mode", "vendor mode", or any lt command syntax. NOT for NestJS module/object/property creation (use generating-nest-servers). NOT for Vue/Nuxt frontend code (use developing-lt-frontend).'
---

# LT CLI Reference

## Gotchas

- **`lt fullstack init` without `--noConfirm` blocks Claude Code forever** — The interactive prompts (project name, git init, template selection) wait for stdin input. Claude Code cannot respond to them, and the session hangs on "Unfurling..." with no token consumption. ALWAYS pass `--noConfirm` + all required flags (`--name X --frontend nuxt --git false`) when calling lt CLI from Claude Code.
- **`--api-link` and `--frontend-link` create SYMLINKS, not copies** — Changes to the template (`nest-server-starter`, `nuxt-base-starter`) in `/Users/kaihaase/code/lenneTech/` immediately affect the linked project. This is a feature for framework development but surprises developers who expect copies. Document it in the project README when using `--api-link`.
- **`lt git reset` is DESTRUCTIVE and irreversible** — Lives next to the safe `lt git get` in the CLI menu. `reset` does `git reset --hard` followed by force-pull, destroying ALL local changes without confirmation. Never run it on a branch with unpushed work. Prefer `git stash` + `lt git get`.
- **`lt server object X --controller` generates REST, NOT GraphQL** — Default is REST. For GraphQL projects, use `--resolver`. The CLI does not auto-detect from existing project patterns — you must specify explicitly.
- **`lt fullstack convert-mode` rewrites the source tree** — Switching between `npm` and `vendor` mode moves framework code in/out of `src/core/` (API) or `app/core/` (App). The operation is reversible but NOT idempotent mid-run — always commit before starting, so a failed conversion can be rolled back via `git reset`.
- **`--next` is experimental and incompatible with `lt server module/object/addProp/test/permissions`** — When `lt server create --next` or `lt fullstack init --next` is used, the API is cloned from [`nest-base`](https://github.com/lenneTech/nest-base) (Bun + Prisma 7 + Postgres + Better-Auth) instead of `nest-server-starter`. The downstream generators target the classic nest-server layout (Mongoose models, src/server/modules/, etc.) and will not work on a nest-base project. Use it for greenfield prototyping only; for production work prefer the default template.

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
lt dev install                   # one-time per machine: verify Caddy + CA
lt dev migrate                   # idempotent: ENV patches + register project
lt dev up                        # Start API + App behind Caddy under https://<slug>.localhost

# With --next: install per subproject, no workspace install
cd <workspace>/projects/app && pnpm install
cd <workspace>/projects/api && bun install
```

(Falls back to `pnpm -r --parallel run start` on default ports 3000/3001 if `lt dev` is not used.)

### lt dev — Parallel Project Orchestration (Caddy + HTTPS)

Serves every lt project under stable HTTPS URLs (`<slug>.localhost`, `api.<slug>.localhost`) via Caddy so multiple projects can run side by side without colliding on 3000/3001 and without auth cross-wiring. Use this in every lt-monorepo or standalone API/App project.

```bash
lt dev install                   # One-time per machine: Caddy + Caddyfile stub + CA reminder
lt dev migrate                   # Once per project (idempotent): ENV patches + register
lt dev up                        # Start API + App behind Caddy
lt dev down                      # Stop processes + remove Caddy block
lt dev status                    # Show URLs + PIDs + live upstream state for THIS project
lt dev status --all              # List every registered project + running state
lt dev doctor                    # Diagnose Caddy / CA / DNS / port issues
```

What each subcommand does:

- **`install`** — One-time per machine. Verifies `caddy` is on PATH (suggests `brew install caddy` if missing), creates `~/.lenneTech/Caddyfile` stub, validates the file, reminds you to run `sudo caddy trust` so browsers accept `https://*.localhost`.
- **`migrate`** — Idempotent. Builds the project identity (slug = `package.json` "name", subdomains from monorepo layout), patches legacy hardcoded `port: 3000` / `port: 3001` / Vite-proxy targets / Playwright URLs to env-aware variants (defaults preserved), persists to `~/.lenneTech/projects.json`, injects a "Local Development (lt dev)" URL block into all `CLAUDE.md` files, adds `.lt-dev/` to `.gitignore`.
- **`up`** — Allocates internal upstream ports (4000+, never 3000/3001), upserts the Caddy block + reloads, exports `PORT`, `BASE_URL`, `APP_URL`, `NUXT_API_URL`, `NUXT_PUBLIC_API_URL`, `NUXT_PUBLIC_SITE_URL`, `NUXT_PUBLIC_STORAGE_PREFIX`, `NUXT_PUBLIC_API_PROXY=false`, `NSC__MONGOOSE__URI`, `DATABASE_URL`, then spawns `pnpm start` (api) + `pnpm dev` (app) detached. Pre-flight checks refuse to start when Caddy is missing, Caddy daemon is down, an existing session is alive, or internal ports are bound. Logs at `<root>/.lt-dev/{api,app}.log`.
- **`down`** — Sends SIGTERM to the saved process group (negative PID) so children (Vite, Nest watcher, etc.) receive it too. Removes the project's Caddy block + reloads.
- **`status`** / **`status --all`** — Current project: subdomains → upstream ports, db URI, session PIDs (alive/dead), live `lsof` upstream state. `--all`: every registered project with a `●`/`○` indicator.
- **`doctor`** — Caddy on PATH, daemon running, Caddyfile valid, ports 80/443 free or held by Caddy, `*.localhost` resolves, registry status.

**Override the spawn binary** via `LT_PNPM_BIN` (e.g. for bun-based projects via wrapper script).

### lt server create — Scaffold New Server

```bash
lt server create <name> --noConfirm [--branch <branch>] [--copy <path>] [--link <path>] [--next]
```

Creates a standalone NestJS project from nest-server-starter. With `--next`, clones [`nest-base`](https://github.com/lenneTech/nest-base) (Bun + Prisma 7 + Postgres + Better-Auth) instead and skips API-mode / vendor-mode / install / `lt.config.json` processing. For module/object/property commands, see `generating-nest-servers` skill — those are NOT compatible with `--next` projects.

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
