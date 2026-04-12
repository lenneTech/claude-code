---
description: Sync the vendored @lenne.tech/nuxt-extensions core from upstream into a project that keeps the frontend module in app/core/
argument-hint: "[--dry-run] [--target X.Y.Z] [--ref <git-sha-or-branch>] [--force]"
allowed-tools: Agent
disable-model-invocation: true
---

# Sync Vendored nuxt-extensions core from Upstream

Fully automated one-way sync from `github.com/lenneTech/nuxt-extensions` into a
project's vendored frontend core at `app/core/`. Analyzes the delta
between the vendored baseline and the chosen upstream target, detects
conflicts with local patches, categorizes each upstream hunk, and either
adopts approved changes or prepares a human-review document.

**Only for projects that have vendored the nuxt-extensions module.** For classic
npm-based nuxt-extensions updates, use the `fullstack-updater` agent or
`pnpm add @lenne.tech/nuxt-extensions@latest`.

## Usage

```
/lt-dev:frontend:update-nuxt-extensions-core [options]
```

## Options

| Option                       | Description                                                   |
| ---------------------------- | ------------------------------------------------------------- |
| `--dry-run`                  | Analysis only -- report what would change, no file modifications |
| `--target X.Y.Z`             | Sync to a specific upstream version (default: latest tag)     |
| `--ref <sha-or-branch>`      | Sync to a specific upstream commit or branch                  |
| `--force`                    | Skip conflict prompts (CI-only, dangerous)                    |

## Examples

```bash
# Sync to latest upstream tag (default)
/lt-dev:frontend:update-nuxt-extensions-core

# See what would change without modifying anything
/lt-dev:frontend:update-nuxt-extensions-core --dry-run

# Sync to a specific version
/lt-dev:frontend:update-nuxt-extensions-core --target 1.5.3

# Sync to upstream main branch (for preview)
/lt-dev:frontend:update-nuxt-extensions-core --ref main
```

## What This Command Does

1. **Verify vendored state** -- confirm `app/core/VENDOR.md` exists and
   `@lenne.tech/nuxt-extensions` is **not** in package.json
2. **Fetch upstream baseline and target** -- clone both into `/tmp` at the
   recorded baseline SHA and the chosen target ref
3. **Generate diffs** -- upstream delta, local changes, and the intersection
4. **Categorize hunks** -- clean pick / conflict / not applicable
5. **Present curation proposal** -- structured review document for human approval
6. **Apply approved changes** -- patch files (no flatten-fix needed)
7. **Validate** -- `nuxt build` / lint, looped with auto-fix up to 10 times
8. **Update VENDOR.md** -- new baseline, new sync history entry
9. **Commit in a structured series** -- one commit per logical step

## Related Elements

| Element                                         | Purpose                                          |
| ----------------------------------------------- | ------------------------------------------------ |
| **Skill**: `nuxt-extensions-core-vendoring`     | Knowledge base, vendor patterns, workflows       |
| **Agent**: `lt-dev:nuxt-extensions-core-updater` | Execution engine (spawned by this command)      |
| **Command**: `/lt-dev:frontend:contribute-nuxt-extensions-core` | Reverse flow -- port local changes upstream |

## When to Use

| Scenario                                       | Command                                                       |
| ---------------------------------------------- | ------------------------------------------------------------- |
| Routine sync to latest upstream                | `/lt-dev:frontend:update-nuxt-extensions-core`                |
| Check upstream delta before merging            | `/lt-dev:frontend:update-nuxt-extensions-core --dry-run`      |
| Sync to a specific version                     | `/lt-dev:frontend:update-nuxt-extensions-core --target X.Y.Z` |
| Preview upcoming unreleased changes            | `/lt-dev:frontend:update-nuxt-extensions-core --ref main`     |

---

**Spawn the nuxt-extensions-core-updater agent:**

Use the Agent tool to spawn the `lt-dev:nuxt-extensions-core-updater` agent with
the following prompt:

```
Sync the vendored @lenne.tech/nuxt-extensions core in this project from upstream.

Arguments: $ARGUMENTS

Parse the arguments for:
- --dry-run: If present, only analyze and report without making changes
- --target X.Y.Z: If present, sync to this specific version
- --ref <sha-or-branch>: If present, sync to this ref
- --force: If present, skip human conflict prompts (CI-only)

Execute the sync workflow according to the detected mode.
Work fully autonomously but always stop for human review at the conflict
resolution stage unless --force is set.

nuxt-extensions tags have NO v-prefix (e.g., 1.5.3 not v1.5.3).
No flatten-fix is needed -- direct 1:1 file mapping between upstream and vendor.

If the project is NOT vendored (no app/core/VENDOR.md), abort immediately and tell
the user to use pnpm add @lenne.tech/nuxt-extensions@latest instead.
```
