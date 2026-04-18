---
description: Convert an existing npm-mode API project to vendor mode with automatic migration guide application. Detects version gap and applies all breaking-change migrations.
argument-hint: "[--dry-run] [--target-version vX.Y.Z]"
allowed-tools: Agent
disable-model-invocation: true
---

# Convert API Project: npm to Vendor Mode

Converts the current API project from consuming `@lenne.tech/nest-server` via npm
to having the framework core vendored directly at `src/core/`.

**Key feature:** Automatically detects the version gap between the project's current
npm version and the target vendor version, then fetches and applies all relevant
migration guides — so the project code is updated to match the vendored framework version.

## Before You Convert — Vendor Modification Policy

Vendoring copies the framework core into `src/core/` as first-class project
code. This is a **comprehension aid**, not a fork. After the conversion, edit
`src/core/` **only** when the change is generally useful to every
@lenne.tech/nest-server consumer (bugfixes, broad enhancements, security
fixes, build/TS-compat). All project-specific behavior stays outside
`src/core/` via inheritance, extension, or `ICoreModuleOverrides`. Generally
useful changes MUST flow back upstream via
`/lt-dev:backend:contribute-nest-server-core` — otherwise they rot in one
project's vendor tree and re-conflict on every sync.

The generated `src/core/VENDOR.md` contains the full policy text; read it
once right after the conversion.

## Usage

```
/lt-dev:backend:convert-to-vendor [options]
```

## Options

| Option | Description |
|--------|-------------|
| `--dry-run` | Analysis only — show version gap and migration steps without making changes |
| `--target-version vX.Y.Z` | Vendor at a specific upstream version instead of latest |

## Examples

```bash
# Full conversion to latest version with migration guides
/lt-dev:backend:convert-to-vendor

# Check what would change (no modifications)
/lt-dev:backend:convert-to-vendor --dry-run

# Convert to a specific version
/lt-dev:backend:convert-to-vendor --target-version v11.22.0
```

## What This Command Does

1. **Version Detection** — Reads current `@lenne.tech/nest-server` version from package.json
2. **Target Resolution** — Determines the upstream version to vendor (latest or specified)
3. **CLI Conversion** — Runs `lt server convert-mode --to vendor` for structural transformation
4. **Migration Guide Discovery** — Fetches all guides for the version gap from the nest-server repo
5. **Stepwise Migration Application** — Applies breaking-change code migrations in version order
6. **Validation Loop** — Iterates build/lint/test until all pass
7. **Report Generation** — Documents the conversion and all applied migrations

## Related Elements

| Element | Purpose |
|---------|---------|
| **Agent**: `lt-dev:vendor-mode-converter` | Execution engine (spawned by this command) |
| **Skill**: `nest-server-core-vendoring` | Vendor pattern knowledge |
| **Skill**: `nest-server-updating` | Migration guide resources |
| **Command**: `/lt-dev:backend:convert-to-npm` | Reverse conversion (vendor back to npm) |
| **Command**: `/lt-dev:backend:update-nest-server-core` | Update vendored core after conversion |

## When to Use

| Scenario | Command |
|----------|---------|
| Convert to vendor mode with full migration | `/lt-dev:backend:convert-to-vendor` |
| Check impact before converting | `/lt-dev:backend:convert-to-vendor --dry-run` |
| Convert to a specific version | `/lt-dev:backend:convert-to-vendor --target-version v11.22.0` |
| Update already-vendored project | `/lt-dev:backend:update-nest-server-core` |
| Convert back to npm mode | `/lt-dev:backend:convert-to-npm` |

## Prerequisites

- `lt` CLI must be installed (`npm i -g @lenne.tech/cli`)
- Project must be in npm mode (`@lenne.tech/nest-server` in dependencies, no `src/core/VENDOR.md`)
- `gh` CLI for fetching migration guides from GitHub

---

**Spawn the vendor-mode-converter agent:**

Use the Agent tool to spawn the `lt-dev:vendor-mode-converter` agent with the following prompt:

```
Convert this API project from npm mode to vendor mode.

Arguments: $ARGUMENTS

Parse the arguments for:
- --dry-run: If present, only analyze and report without making changes
- --target-version vX.Y.Z: If present, vendor at this specific upstream version

Execute the conversion workflow according to the detected mode.
Work fully autonomously without asking questions.
```
