---
description: Update @lenne.tech/nest-server to latest version with automated migration, validation, and package optimization
argument-hint: "[--dry-run] [--target-version X.Y.Z] [--skip-packages] [path]"
allowed-tools: Task
---

# Update @lenne.tech/nest-server

Fully automated update of @lenne.tech/nest-server with migration guide support.

## Usage

```
/lt-dev:backend:update-nest-server [options] [path]
```

## Options

| Option | Description |
|--------|-------------|
| `--dry-run` | Analysis only - show what would change without making modifications |
| `--target-version X.Y.Z` | Update to specific version instead of latest |
| `--skip-packages` | Skip npm-package-maintainer optimization step |
| `[path]` | Target directory for monorepo subprojects (default: current directory) |

## Examples

```bash
# Full update to latest version
/lt-dev:backend:update-nest-server

# Check what would change (no modifications)
/lt-dev:backend:update-nest-server --dry-run

# Update to specific version
/lt-dev:backend:update-nest-server --target-version 12.0.0

# Update specific subproject in monorepo
/lt-dev:backend:update-nest-server projects/api

# Combine options
/lt-dev:backend:update-nest-server --dry-run --target-version 12.0.0

# Fast update without package optimization
/lt-dev:backend:update-nest-server --skip-packages
```

## What This Command Does

1. **Version Analysis** - Detects current version, determines update path
2. **Migration Guide Loading** - Fetches all relevant guides from nest-server repo
3. **Stepwise Major Updates** - Updates through each major version (e.g., 17→18→19)
4. **Code Migration** - Applies breaking change migrations automatically
5. **Package Optimization** - Runs npm-package-maintainer (unless `--skip-packages`)
6. **Validation Loop** - Iterates build/lint/test until all pass
7. **Report Generation** - Documents all changes and migrations

## Related Elements

| Element | Purpose |
|---------|---------|
| **Skill**: `nest-server-updating` | Knowledge base for troubleshooting |
| **Agent**: `lt-dev:nest-server-updater` | Execution engine (spawned by this command) |
| **Command**: `/lt-dev:maintenance:maintain` | General package maintenance |

## When to Use

| Scenario | Command |
|----------|---------|
| Routine update to latest | `/lt-dev:backend:update-nest-server` |
| Check impact before updating | `/lt-dev:backend:update-nest-server --dry-run` |
| Update to specific version | `/lt-dev:backend:update-nest-server --target-version 12.0.0` |
| Quick update without package check | `/lt-dev:backend:update-nest-server --skip-packages` |

---

**Spawn the nest-server-updater agent:**

Use the Task tool to spawn the `lt-dev:nest-server-updater` agent with the following prompt:

```
Update @lenne.tech/nest-server in this project.

Arguments: $ARGUMENTS

Parse the arguments for:
- --dry-run: If present, only analyze and report without making changes
- --target-version X.Y.Z: If present, update to this specific version
- --skip-packages: If present, skip npm-package-maintainer optimization
- Any remaining argument is the target directory path

Execute the update workflow according to the detected mode.
Work fully autonomously without asking questions.
```
