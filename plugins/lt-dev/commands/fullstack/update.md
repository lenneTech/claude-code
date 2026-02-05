---
description: Update a lenne.tech fullstack project by synchronizing backend and frontend with latest nest-server-starter and nuxt-base-starter
argument-hint: "[--dry-run] [--skip-backend] [--skip-frontend]"
allowed-tools: Task
---

# Update Fullstack Project

Coordinated update of backend (nest-server) and frontend (nuxt-extensions) with starter repository synchronization.

## Usage

```
/lt-dev:fullstack:update [options]
```

## Options

| Option | Description |
|--------|-------------|
| `--dry-run` | Analysis only - show update plan without making changes |
| `--skip-backend` | Skip backend (API) update |
| `--skip-frontend` | Skip frontend (App) update |

## Examples

```bash
# Full update of backend and frontend
/lt-dev:fullstack:update

# Check what would change (no modifications)
/lt-dev:fullstack:update --dry-run

# Update only frontend
/lt-dev:fullstack:update --skip-backend

# Update only backend
/lt-dev:fullstack:update --skip-frontend
```

## What This Command Does

1. **Project Analysis** - Detects project structure, current versions of nest-server and nuxt-extensions
2. **Starter Repository Analysis** - Clones nest-server-starter and nuxt-base-starter to compare changes
3. **Update Plan Generation** - Creates UPDATE_PLAN.md with all changes, presents for user approval
4. **Backend Update** - Spawns nest-server-updater agent, applies starter changes, validates
5. **Frontend Update** - Updates nuxt-extensions, applies starter changes, regenerates types, validates
6. **Final Validation & Report** - Cross-project validation and comprehensive change report

## Related Elements

| Element | Purpose |
|---------|---------|
| **Skill**: `nest-server-updating` | Backend update knowledge base |
| **Skill**: `developing-lt-frontend` | Frontend patterns and expertise |
| **Skill**: `maintaining-npm-packages` | Package optimization guidance |
| **Skill**: `using-lt-cli` | CLI context and commands |
| **Agent**: `lt-dev:fullstack-updater` | Execution engine (spawned by this command) |
| **Agent**: `lt-dev:nest-server-updater` | Backend update (spawned by fullstack-updater) |
| **Command**: `/lt-dev:backend:update-nest-server` | Standalone backend update |

## When to Use

| Scenario | Command |
|----------|---------|
| Routine fullstack update | `/lt-dev:fullstack:update` |
| Check impact before updating | `/lt-dev:fullstack:update --dry-run` |
| Only update frontend | `/lt-dev:fullstack:update --skip-backend` |
| Only update backend | `/lt-dev:fullstack:update --skip-frontend` |
| Backend-only project | `/lt-dev:backend:update-nest-server` |

---

**Spawn the fullstack-updater agent:**

Use the Task tool to spawn the `lt-dev:fullstack-updater` agent with the following prompt:

```
Update this lenne.tech fullstack project by synchronizing with latest starter repositories.

Arguments: $ARGUMENTS

Parse the arguments for:
- --dry-run: If present, only analyze and report without making changes
- --skip-backend: If present, skip backend (API) update
- --skip-frontend: If present, skip frontend (App) update

Execute the fullstack update workflow.
Present the update plan for user approval before making changes (unless --dry-run).
```
