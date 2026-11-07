---
description: Sync the vendored @lenne.tech/ng-base core from upstream into an Angular app that keeps the library in src/core/
argument-hint: "[--dry-run] [--target X.Y.Z] [--ref <git-sha-or-branch>] [--force] [--no-maintain]"
allowed-tools: Agent
disable-model-invocation: true
---

# Sync Vendored ng-base core from Upstream

One-way sync from `github.com/lenneTech/ng-base` into an Angular app's vendored core at `src/core/` (in a
fullstack monorepo `projects/app/src/core/`). Analyzes the delta between the vendored baseline and the chosen
upstream target, detects conflicts with local patches, categorizes each upstream hunk, re-derives the
`tsconfig.json` paths for added or removed entry points, and adopts the approved changes or prepares a review
document.

**Only for apps that vendored ng-base.** An app on the npm package raises its exact pin instead
(`pnpm add @lenne.tech/ng-base@<version>`), and a Nuxt app uses `/lt-dev:frontend:update-nuxt-extensions-core`.

## Usage

```
/lt-dev:frontend:update-ng-base-core [options]
```

## Options

| Option | Description |
| --- | --- |
| `--dry-run` | Analysis only: report what would change, no file modifications |
| `--target X.Y.Z` | Sync to a specific upstream version (tag `vX.Y.Z`; default: the newest release) |
| `--ref <sha-or-branch>` | Sync to a specific upstream commit or branch |
| `--force` | Skip conflict prompts (CI only, dangerous) |
| `--no-maintain` | Skip the full `/lt-dev:maintenance:maintain` pass, only raise packages to the upstream baseline |

## Examples

```bash
/lt-dev:frontend:update-ng-base-core                  # newest release
/lt-dev:frontend:update-ng-base-core --dry-run        # what would change
/lt-dev:frontend:update-ng-base-core --target 22.1.0  # a specific version
/lt-dev:frontend:update-ng-base-core --ref main       # preview unreleased changes
```

## What This Command Does

1. **Verify the vendored state:** `src/core/VENDOR.md` names `@lenne.tech/ng-base`, and the package is not an
   npm dependency of the app
2. **Fetch upstream baseline and target** into a run directory of the agent's own under `/tmp` (the library
   is `projects/ng-base/` there); the agent removes it when the sync ends
3. **Generate diffs:** upstream delta and local changes, without the files the vendor copy never carries
4. **Categorize hunks:** clean pick, conflict, not applicable, plus added or removed entry points
5. **Present the curation proposal** for human approval
6. **Apply approved changes** (1:1 mapping, no import is rewritten)
7. **Re-derive the `tsconfig.json` paths** from the core's `ng-package.json` files, and point stylesheet
   imports at `src/core/`
8. **Sync npm dependencies:** at least the versions the upstream library declares; wire-critical peers such as
   `better-auth` only together with the API; then, unless `--no-maintain`, `/lt-dev:maintenance:maintain`
9. **Validate** with the app's `check` script, looped with auto-fix up to 10 times
10. **Update VENDOR.md** (new baseline, sync history) and **commit** in a structured series

## Related Elements

| Element | Purpose |
| --- | --- |
| **Skill**: `ng-base-core-vendoring` | Knowledge base, vendor contract, workflows |
| **Agent**: `lt-dev:ng-base-core-updater` | Execution engine (spawned by this command) |
| **Command**: `/lt-dev:frontend:contribute-ng-base-core` | Reverse flow, ports local changes upstream |
| **Command**: `/lt-dev:frontend:update-nuxt-extensions-core` | The same sync for a vendored Nuxt core |

## When to Use

| Scenario | Command |
| --- | --- |
| Routine sync to the newest release | `/lt-dev:frontend:update-ng-base-core` |
| Check the upstream delta first | `/lt-dev:frontend:update-ng-base-core --dry-run` |
| Sync to a specific version | `/lt-dev:frontend:update-ng-base-core --target X.Y.Z` |
| Preview unreleased changes | `/lt-dev:frontend:update-ng-base-core --ref main` |

---

**Spawn the ng-base-core-updater agent:**

Use the Agent tool to spawn the `lt-dev:ng-base-core-updater` agent with this prompt:

```
Sync the vendored @lenne.tech/ng-base core in this Angular app from upstream.

Arguments: $ARGUMENTS

Parse the arguments for:
- --dry-run: only analyze and report, change nothing
- --target X.Y.Z: sync to this version (tag vX.Y.Z)
- --ref <sha-or-branch>: sync to this ref
- --force: skip human conflict prompts (CI only)
- --no-maintain: skip the full npm maintenance pass (only raise packages to the upstream baseline)

Execute the sync workflow according to the detected mode. Work autonomously, but stop for human review at the
conflict resolution stage unless --force is set.

ng-base tags carry a v prefix (v22.1.0), the npm version does not (22.1.0).
After applying changes, re-derive the tsconfig paths with ng-base-paths.mjs until its --check exits 0.

If the app is NOT vendored (no src/core/VENDOR.md naming @lenne.tech/ng-base), stop immediately and tell the
user to raise the exact pin with pnpm add @lenne.tech/ng-base@<version> instead.
```

**Cleanup:** the agent removes its run directory before its final message. When it pauses for review and the
sync ends there (the user rejects it or does not continue), remove the directory its pause message names, by
that exact path (`rm -rf /tmp/ng-base-sync.k3J9aQ`). Never by a pattern: a parallel session may be syncing
another app from a `/tmp/ng-base-*` folder of its own.
