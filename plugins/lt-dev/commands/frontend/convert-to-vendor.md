---
description: Convert an existing npm-mode frontend project to vendor mode for @lenne.tech/nuxt-extensions with automatic changelog application.
argument-hint: "[--dry-run] [--target-version X.Y.Z]"
allowed-tools: Agent
disable-model-invocation: true
---

# Convert Frontend Project: npm to Vendor Mode

Converts the current frontend project from consuming `@lenne.tech/nuxt-extensions` via npm
to having the module source vendored directly at `app/core/`.

**Key feature:** Automatically detects the version gap between the project's current
npm version and the target vendor version, then fetches and applies all relevant
changelog/release changes -- so the project code is updated to match the vendored module version.

## Before You Convert -- Vendor Modification Policy

Vendoring copies the framework module into `app/core/` as first-class
project code. This is a **comprehension aid**, not a fork. After the
conversion, edit `app/core/` **only** when the change is generally useful
to every @lenne.tech/nuxt-extensions consumer (bugfixes, broad enhancements
like new composables or SSR fixes, security fixes, type-compat). All
project-specific behavior stays outside `app/core/` -- use
`app/composables/`, `app/components/`, `app/middleware/`, or plugin
overrides. Generally useful changes MUST flow back upstream via
`/lt-dev:frontend:contribute-nuxt-extensions-core` -- otherwise they rot
in one project's vendor tree and re-conflict on every sync.

The generated `app/core/VENDOR.md` contains the full policy text; read it
once right after the conversion.

## Usage

```
/lt-dev:frontend:convert-to-vendor [options]
```

## Options

| Option | Description |
|--------|-------------|
| `--dry-run` | Analysis only -- show version gap and changes without making modifications |
| `--target-version X.Y.Z` | Vendor at a specific upstream version instead of latest |

## Examples

```bash
# Full conversion to latest version with changelog application
/lt-dev:frontend:convert-to-vendor

# Check what would change (no modifications)
/lt-dev:frontend:convert-to-vendor --dry-run

# Convert to a specific version
/lt-dev:frontend:convert-to-vendor --target-version 1.5.3
```

## What This Command Does

1. **Version Detection** -- Reads current `@lenne.tech/nuxt-extensions` version from package.json
2. **Target Resolution** -- Determines the upstream version to vendor (latest or specified)
3. **CLI Conversion** -- Runs `lt frontend convert-mode --to vendor` for structural transformation
4. **Changelog Discovery** -- Fetches all changelogs/releases for the version gap
5. **Stepwise Change Application** -- Applies breaking-change code updates in version order
6. **Validation Loop** -- Iterates build/lint until all pass
7. **Report Generation** -- Documents the conversion and all applied changes

## Related Elements

| Element | Purpose |
|---------|---------|
| **Agent**: `lt-dev:vendor-mode-converter-frontend` | Execution engine (spawned by this command) |
| **Skill**: `nuxt-extensions-core-vendoring` | Vendor pattern knowledge |
| **Skill**: `developing-lt-frontend` | Frontend patterns and expertise |
| **Command**: `/lt-dev:frontend:convert-to-npm` | Reverse conversion (vendor back to npm) |
| **Command**: `/lt-dev:frontend:update-nuxt-extensions-core` | Update vendored core after conversion |

## When to Use

| Scenario | Command |
|----------|---------|
| Convert to vendor mode with full changelog application | `/lt-dev:frontend:convert-to-vendor` |
| Check impact before converting | `/lt-dev:frontend:convert-to-vendor --dry-run` |
| Convert to a specific version | `/lt-dev:frontend:convert-to-vendor --target-version 1.5.3` |
| Update already-vendored project | `/lt-dev:frontend:update-nuxt-extensions-core` |
| Convert back to npm mode | `/lt-dev:frontend:convert-to-npm` |

## Prerequisites

- `lt` CLI must be installed (`npm i -g @lenne.tech/cli`)
- Project must be in npm mode (`@lenne.tech/nuxt-extensions` in dependencies, no `app/core/VENDOR.md`)
- `gh` CLI for fetching changelogs/releases from GitHub

---

**Spawn the vendor-mode-converter-frontend agent:**

Use the Agent tool to spawn the `lt-dev:vendor-mode-converter-frontend` agent with the following prompt:

```
Convert this frontend project from npm mode to vendor mode.

Arguments: $ARGUMENTS

Parse the arguments for:
- --dry-run: If present, only analyze and report without making changes
- --target-version X.Y.Z: If present, vendor at this specific upstream version

Execute the conversion workflow according to the detected mode.
Work fully autonomously without asking questions.
```
