---
description: Sync the vendored @lenne.tech/nest-server core from upstream into a project that keeps the framework in src/core/
argument-hint: "[--dry-run] [--target X.Y.Z] [--ref <git-sha-or-branch>] [--force]"
allowed-tools: Agent
disable-model-invocation: true
---

# Sync Vendored nest-server core from Upstream

Fully automated one-way sync from `github.com/lenneTech/nest-server` into a
project's vendored core at `projects/api/src/core/`. Analyzes the delta
between the vendored baseline and the chosen upstream target, detects
conflicts with local patches, categorizes each upstream hunk, reapplies the
flatten-fix pattern, and either adopts approved changes or prepares a
human-review document.

**Only for projects that have vendored the nest-server core.** For classic
npm-based nest-server updates, use `/lt-dev:backend:update-nest-server`.

## Usage

```
/lt-dev:backend:update-nest-server-core [options]
```

## Options

| Option                       | Description                                                   |
| ---------------------------- | ------------------------------------------------------------- |
| `--dry-run`                  | Analysis only — report what would change, no file modifications |
| `--target X.Y.Z`             | Sync to a specific upstream version (default: latest tag)     |
| `--ref <sha-or-branch>`      | Sync to a specific upstream commit or branch                  |
| `--force`                    | Skip conflict prompts (CI-only, dangerous)                    |

## Examples

```bash
# Sync to latest upstream tag (default)
/lt-dev:backend:update-nest-server-core

# See what would change without modifying anything
/lt-dev:backend:update-nest-server-core --dry-run

# Sync to a specific version
/lt-dev:backend:update-nest-server-core --target 11.25.0

# Sync to upstream main branch (for preview)
/lt-dev:backend:update-nest-server-core --ref main
```

## What This Command Does

1. **Verify vendored state** — confirm `src/core/VENDOR.md` exists and
   `@lenne.tech/nest-server` is **not** in package.json
2. **Fetch upstream baseline and target** — clone both into `/tmp` at the
   recorded baseline SHA and the chosen target ref
3. **Generate diffs** — upstream delta, local changes, and the intersection
4. **Categorize hunks** — clean pick / conflict / not applicable
5. **Present curation proposal** — structured review document for human approval
6. **Apply approved changes** — patch files, reapply flatten-fix, re-run
   idempotent edge-case fixes
7. **Validate** — tsc / lint / format / migrate:list / e2e tests, looped
   with auto-fix up to 10 times
8. **Update VENDOR.md** — new baseline, new sync history entry
9. **Commit in a structured series** — one commit per logical step

## Related Elements

| Element                                    | Purpose                                          |
| ------------------------------------------ | ------------------------------------------------ |
| **Skill**: `nest-server-core-vendoring`    | Knowledge base, flatten patterns, workflows      |
| **Agent**: `lt-dev:nest-server-core-updater` | Execution engine (spawned by this command)     |
| **Command**: `/lt-dev:backend:update-nest-server` | Classic npm-based update (non-vendored)   |
| **Command**: `/lt-dev:backend:contribute-nest-server-core` | Reverse flow — port local changes upstream |

## When to Use

| Scenario                                       | Command                                                |
| ---------------------------------------------- | ------------------------------------------------------ |
| Routine sync to latest upstream                | `/lt-dev:backend:update-nest-server-core`              |
| Check upstream delta before merging            | `/lt-dev:backend:update-nest-server-core --dry-run`    |
| Sync to a specific version                     | `/lt-dev:backend:update-nest-server-core --target X`   |
| Preview upcoming unreleased changes            | `/lt-dev:backend:update-nest-server-core --ref main`   |

---

**Spawn the nest-server-core-updater agent:**

Use the Agent tool to spawn the `lt-dev:nest-server-core-updater` agent with
the following prompt:

```
Sync the vendored @lenne.tech/nest-server core in this project from upstream.

Arguments: $ARGUMENTS

Parse the arguments for:
- --dry-run: If present, only analyze and report without making changes
- --target X.Y.Z: If present, sync to this specific version
- --ref <sha-or-branch>: If present, sync to this ref
- --force: If present, skip human conflict prompts (CI-only)

Execute the sync workflow according to the detected mode.
Work fully autonomously but always stop for human review at the conflict
resolution stage unless --force is set.

Remember the flatten-fix edge cases: index.ts, core.module.ts, test/test.helper.ts,
common/interfaces/core-persistence-model.interface.ts.

If the project is NOT vendored (no VENDOR.md), abort immediately and tell
the user to use /lt-dev:backend:update-nest-server instead.
```
