---
description: Identify substantial local changes in a vendored ng-base core and prepare them as upstream pull request drafts for github.com/lenneTech/ng-base
argument-hint: "[--dry-run] [--since <sha-or-tag>] [--file <path>]"
allowed-tools: Agent
disable-model-invocation: true
---

# Contribute Vendored ng-base Changes Upstream

Walks the local git history of an Angular app's vendored `@lenne.tech/ng-base` core (`src/core/`), filters out
cosmetic and project-specific commits, and prepares the substantial, generally useful ones as draft PR
branches for `github.com/lenneTech/ng-base`, with the specs upstream needs. Nothing is pushed: the user
reviews every draft and pushes it.

**Only for apps that vendored ng-base.** A Nuxt app uses `/lt-dev:frontend:contribute-nuxt-extensions-core`.

## Usage

```
/lt-dev:frontend:contribute-ng-base-core [options]
```

## Options

| Option | Description |
| --- | --- |
| `--dry-run` | Report what would be proposed, prepare no branches |
| `--since <sha-or-tag>` | Only commits after this point (default: the VENDOR.md baseline) |
| `--file <path>` | Only changes to one vendored file |

## What This Command Does

1. **Verify the vendored state** and read the baseline from `src/core/VENDOR.md`
2. **Collect** the commits touching `src/core/` since the baseline
3. **Filter** cosmetic commits (formatting, lint, whitespace)
4. **Categorize** the rest: upstream candidate, project-specific, unclear (asks)
5. **Check upstream** for the same change, released or in an open PR
6. **Prepare branches** in a fresh clone of upstream (`/tmp/ng-base-head.<id>`), 1:1 from `src/core/` to
   `projects/ng-base/`, with the spec each change needs, and the repo's `check` green; the clone stays as the
   hand-off, and the report says to delete it once every branch is pushed
7. **Write PR drafts** and report them; pushing and opening the draft PR is the user's step

## Related Elements

| Element | Purpose |
| --- | --- |
| **Skill**: `ng-base-core-vendoring` | Knowledge base, vendor contract, workflows |
| **Agent**: `lt-dev:ng-base-core-contributor` | Execution engine (spawned by this command) |
| **Command**: `/lt-dev:frontend:update-ng-base-core` | Forward flow, syncs upstream into the core |

## When to Use

| Scenario | Command |
| --- | --- |
| Local core fixes piled up | `/lt-dev:frontend:contribute-ng-base-core` |
| See the candidates first | `/lt-dev:frontend:contribute-ng-base-core --dry-run` |
| Before converting the app back to npm mode | `/lt-dev:frontend:contribute-ng-base-core` (the lt CLI suggests it) |

---

**Spawn the ng-base-core-contributor agent:**

Use the Agent tool to spawn the `lt-dev:ng-base-core-contributor` agent with this prompt:

```
Prepare upstream PR drafts for the substantial local changes in this Angular app's vendored @lenne.tech/ng-base
core (src/core/).

Arguments: $ARGUMENTS

Parse the arguments for:
- --dry-run: report the candidates, prepare no branches
- --since <sha-or-tag>: only commits after this point
- --file <path>: only changes to this vendored file

Never push, never open a PR unless the user explicitly asks, and any PR opened is a draft into main.
Never tag or publish: a v* tag on ng-base publishes the package.
```
