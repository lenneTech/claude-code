---
description: Identify substantial local changes in a vendored nest-server core and prepare them as Upstream Pull Requests for github.com/lenneTech/nest-server
argument-hint: "[--dry-run] [--since <sha-or-tag>] [--file <path>]"
allowed-tools: Agent
disable-model-invocation: true
---

# Contribute Local Core Changes Back to Upstream nest-server

Reverse flow of the vendoring pattern: find valuable local changes in the
vendored framework core at `projects/api/src/core/`, filter out cosmetic
noise (formatting, linting), categorize the remaining commits as
upstream-candidate or project-specific, cherry-pick candidates onto prepared
branches in a local clone of upstream, and generate PR drafts for human
review.

**Never auto-pushes.** Every candidate becomes a prepared branch + PR body
that the human explicitly reviews and submits via normal GitHub flow.

## Usage

```
/lt-dev:backend:contribute-nest-server-core [options]
```

## Options

| Option                       | Description                                                   |
| ---------------------------- | ------------------------------------------------------------- |
| `--dry-run`                  | Report what would be proposed, no PR preparation              |
| `--since <sha-or-tag>`       | Analyze only commits after a given point (default: vendor baseline) |
| `--file <path>`              | Only consider changes to a specific vendor file               |

## Examples

```bash
# Analyze all local changes since the vendor baseline
/lt-dev:backend:contribute-nest-server-core

# Dry-run: just show what would be proposed
/lt-dev:backend:contribute-nest-server-core --dry-run

# Only look at changes since a specific commit
/lt-dev:backend:contribute-nest-server-core --since e9c3aa7

# Focus on one specific file
/lt-dev:backend:contribute-nest-server-core --file src/core/common/services/crud.service.ts
```

## What This Command Does

1. **Verify vendored state** — confirm `src/core/VENDOR.md` exists
2. **Collect local commits** — `git log` on `projects/api/src/core/` since
   the vendoring commit (or since `--since`)
3. **Filter cosmetic commits** — by commit-message pattern
   (`chore: format`, `style:`, `oxfmt`, `lint:fix`, `prettier`) and by
   normalized-diff emptiness
4. **Categorize substantial commits**:
   - Upstream-candidate: generic bugfix, framework enhancement, type correction
   - Project-specific: business rules, customer-name references, integration code
   - Unclear: asks human
5. **Check upstream for duplicates** — clone upstream HEAD, compare against
   current state to avoid proposing already-applied changes
6. **Prepare candidate branches** — cherry-pick into a fresh upstream clone,
   reverse-flatten import paths where needed (e.g. `./common/` → `./core/common/`
   for files in upstream's `src/index.ts`)
7. **Generate PR drafts** — create a PR body per candidate explaining
   motivation, changes, and test plan, without any project-specific references
8. **Present summary** — show the human a list of ready PR drafts, per-PR
   branch location, and `gh pr create` commands

## Related Elements

| Element                                     | Purpose                                          |
| ------------------------------------------- | ------------------------------------------------ |
| **Skill**: `nest-server-core-vendoring`     | Knowledge base, filter heuristics                |
| **Agent**: `lt-dev:nest-server-core-contributor` | Execution engine (spawned by this command)  |
| **Command**: `/lt-dev:backend:update-nest-server-core` | Forward flow — upstream → project     |

## When to Use

| Scenario                                       | Command                                                     |
| ---------------------------------------------- | ----------------------------------------------------------- |
| You've been making local core fixes and want to share | `/lt-dev:backend:contribute-nest-server-core`       |
| You want to know what's portable before you start | `/lt-dev:backend:contribute-nest-server-core --dry-run` |
| You made one specific fix to share             | `/lt-dev:backend:contribute-nest-server-core --file ...`    |

---

**Spawn the nest-server-core-contributor agent:**

Use the Agent tool to spawn the `lt-dev:nest-server-core-contributor` agent
with the following prompt:

```
Identify substantial local changes in this project's vendored nest-server core
and prepare them as Upstream PRs for github.com/lenneTech/nest-server.

Arguments: $ARGUMENTS

Parse the arguments for:
- --dry-run: If present, report what would be proposed, no PR preparation
- --since <sha-or-tag>: If present, analyze only commits after this point
- --file <path>: If present, only consider this specific vendor file

Execute the contributor workflow:
1. Verify VENDOR.md exists (abort otherwise)
2. Collect local commits since the baseline
3. Filter cosmetic commits (format, style, oxfmt, lint:fix, prettier,
   plus normalized-diff-empty check)
4. Categorize remaining commits as upstream-candidate, project-specific,
   or unclear
5. Check upstream HEAD for already-applied changes
6. Prepare candidate branches in /tmp/nest-server-head with reverse flatten-fix
7. Generate PR body drafts
8. Present a final summary with branch paths and gh-cli commands

NEVER auto-push. NEVER open PRs automatically. Every PR draft is for human
review and manual submission.

Project-specific signals to reject: Volksbank, imo, customer-specific enums,
business-rule hardcoded values, API endpoints with customer domains.

Work fully autonomously otherwise.
```
