---
name: using-lt-cli
description: 'Provides reference for the lenne.tech CLI tool (lt command). Covers lt fullstack init (workspace creation with local template symlinks), lt git get/reset (branch management), and lt server create (project scaffolding). Activates when user mentions "lt", "lt CLI", "lenne.tech CLI", "lt fullstack", "lt git", "fullstack workspace", "local templates", "--api-link", "--frontend-link", or any lt command syntax. NOT for NestJS module/object/property creation (use generating-nest-servers). NOT for Vue/Nuxt frontend code (use developing-lt-frontend).'
effort: low
---

# LT CLI Reference

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
  [--git-link <URL>] [--api-link <path>] [--frontend-link <path>]
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

**Priority:** `--*-link` > `--*-copy` > `--*-branch` > default (GitHub clone)

**Created structure:**
```
<workspace>/
├── projects/
│   ├── api/    ← nest-server-starter
│   └── app/    ← nuxt-base-starter (or ng-base-starter)
├── package.json
└── .gitignore
```

**Post-creation:**
```bash
cd <workspace> && pnpm install
cd projects/api && pnpm start     # Port 3000
cd projects/app && pnpm start     # Port 3001
```

### lt server create — Scaffold New Server

```bash
lt server create <name> --noConfirm [--branch <branch>] [--copy <path>] [--link <path>]
```

Creates a standalone NestJS project from nest-server-starter. For module/object/property commands, see `generating-nest-servers` skill.

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
