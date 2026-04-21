---
name: rebasing-branches
description: 'Guides rebase workflows for updating feature branches onto the current development branch (dev/develop). Handles conflict resolution with priority ordering, extracts Linear ticket context from branch names for smarter conflict decisions, performs post-rebase optimization, and uses force-push-with-lease for safety. Activates when user mentions "rebase", "branch aktualisieren", "dev stand", "feature branch updaten", "merge conflicts", "rebase MRs", "force push", or "git rebase". NOT for merge request descriptions (use git:mr-description). NOT for general git operations.'
---

# Rebase Workflow Knowledge Base

This skill provides **knowledge and strategy** for rebasing feature branches onto a development branch. For automated execution, use the `lt-dev:branch-rebaser` agent via `/lt-dev:git:rebase` or `/lt-dev:git:rebase-mrs`.

## Gotchas

- **`--force` silently overwrites teammate pushes — always `--force-with-lease`** — If a teammate pushed to the same remote branch while you were rebasing locally, plain `--force` overwrites their commits without any warning. `--force-with-lease` refuses the push if the remote has moved. There is no valid reason to use `--force` on a shared branch.
- **Lock-file conflicts: accepting "ours" without re-install breaks dependencies** — When `pnpm-lock.yaml` or `package-lock.json` conflicts, resolving in favor of the dev-branch version without running `pnpm install` afterwards leaves the lockfile describing packages that aren't actually in `node_modules`. Always: resolve → install → verify `pnpm run build` before continuing.
- **Post-rebase optimization: never remove "redundant" feature code without asking** — The optimization pass sometimes flags code as dead because it's used by a feature not in the current branch. Check git log on the file before removing anything. When in doubt, ask the user or leave it.
- **`git rebase --abort` works only if you haven't started a commit** — Once you `git add` the resolved conflict files, `--abort` still works. After `git rebase --continue` has moved past the conflict commit, you need `git reset --hard ORIG_HEAD` to recover, which DOES require the original ref. ORIG_HEAD is auto-set by rebase start — safe to rely on.
- **Branch names encode Linear ticket context** — `feat/dev-1628-abc-xyz` contains the Linear ID. The rebaser agent uses this to pull ticket context for smarter conflict decisions. Branches without a ticket ID get generic treatment — prefer `feat/dev-XXXX-...` naming for rebaseable branches.

## When This Skill Activates

- Rebasing feature branches onto dev/develop
- Resolving merge conflicts during rebase
- Batch-rebasing multiple MRs/PRs
- Updating a branch to include latest dev changes
- Planning rebase strategies for multiple branches

## Skill Boundaries

| User Intent | Correct Skill |
|------------|---------------|
| "Rebase my branch onto dev" | **THIS SKILL** |
| "Rebase all open MRs" | **THIS SKILL** |
| "Branch aktualisieren" | **THIS SKILL** |
| "Merge conflicts lösen" | **THIS SKILL** |
| "Create MR description" | git:mr-description |
| "Generate commit message" | git:commit-message |
| "Update nest-server" | nest-server-updating |
| "npm audit fix" | maintaining-npm-packages |

## Related Skills

| Element | Purpose |
|---------|---------|
| **Agent**: `lt-dev:branch-rebaser` | Autonomous rebase execution |
| **Command**: `/lt-dev:git:rebase` | Single branch rebase |
| **Command**: `/lt-dev:git:rebase-mrs` | Batch rebase for MRs/PRs |
| **Command**: `/lt-dev:review` | Code review after rebase |
| **Skill**: `generating-nest-servers` | Backend code patterns |
| **Skill**: `developing-lt-frontend` | Frontend code patterns |
| **Skill**: `coordinating-agent-teams` | Parallel worktree execution for batch rebase (>2 branches) |

---

## Rebase Strategy

### Single Branch Workflow

1. **Fetch latest** from remote
2. **Rebase** onto target branch (default: `dev`)
3. **Resolve conflicts** using project context and Linear ticket info
4. **Optimize code** based on new dev state (remove redundancies)
5. **Lint & format** with oxfmt/oxlint
6. **Run tests** to verify nothing broke
7. **Review** changes for quality

### Batch Workflow (MRs/PRs)

Same as single branch, plus:
- List open MRs/PRs from GitHub (`gh`) or GitLab (`glab`)
- User selects which branches to rebase
- After each branch: commit changes + force push with lease
- Generate summary report across all branches

### Base Branch Detection

| Priority | Source | Method |
|----------|--------|--------|
| 1 | User argument | `--base=<branch>` |
| 2 | Common convention | Check if `dev` or `develop` exists |
| 3 | Default branch | Use `main` or `master` |

```bash
# Detect base branch
git branch -r | grep -E 'origin/(dev|develop)$' | head -1 | sed 's|origin/||;s/^[[:space:]]*//'
```

---

## Linear Ticket Extraction

Branch names often contain Linear ticket IDs. Extract and load ticket context for better conflict resolution and code optimization.

### Extraction Patterns

| Pattern | Example | Ticket ID |
|---------|---------|-----------|
| `feat/DEV-123-description` | `feat/DEV-123-add-auth` | DEV-123 |
| `fix/DEV-456-description` | `fix/DEV-456-login-bug` | DEV-456 |
| `DEV-789/description` | `DEV-789/refactor-api` | DEV-789 |
| `feature/PROJ-42-desc` | `feature/PROJ-42-users` | PROJ-42 |

```bash
# Extract ticket ID from branch name
git branch --show-current | grep -oE '[A-Z]+-[0-9]+'
```

### Using Ticket Context

Once extracted, load via `mcp__plugin_lt-dev_linear__get_issue`:
- **Title & description**: Understand the feature intent
- **Acceptance criteria**: Verify rebase didn't break requirements
- **Comments**: Additional context for conflict resolution

---

## Conflict Resolution Strategy

### Priority Order

1. **Incoming changes** (dev) for infrastructure/config files
2. **Feature changes** (current branch) for feature-specific code
3. **Linear ticket context** to decide ambiguous conflicts
4. **Both changes** when they affect different concerns

### Common Conflict Patterns

| File Type | Strategy |
|-----------|----------|
| `package.json` | Accept dev versions, keep feature-specific additions |
| `*.lock` files | Regenerate after resolving package.json |
| Config files | Merge both, prefer dev for shared settings |
| Model/DTO files | Keep both changes, resolve type conflicts |
| Test files | Keep both tests, fix import conflicts |
| Migration files | Keep both, verify execution order |

### After Conflict Resolution

```bash
# Continue rebase after resolving conflicts
git add .
git rebase --continue

# If rebase becomes unrecoverable
git rebase --abort
```

---

## Post-Rebase Optimization

After successful rebase, check if new dev code makes parts of the feature branch redundant:

1. **Duplicate implementations**: Feature branch added something that dev now provides
2. **Outdated workarounds**: Feature branch worked around a bug that dev fixed
3. **API changes**: Feature branch uses old patterns that dev updated
4. **Dependency conflicts**: Feature branch pins a version that dev updated

---

## Lint & Format Tools

### oxfmt (Formatter)

```bash
# Format all files in a project
pnpm dlx oxfmt .

# Format specific files
pnpm dlx oxfmt src/path/to/file.ts
```

### oxlint (Linter)

```bash
# Lint all files
pnpm dlx oxlint .

# Lint with auto-fix
pnpm dlx oxlint --fix .
```

---

## Force Push Safety

**Always use `--force-with-lease`** instead of `--force`:

```bash
git push --force-with-lease
```

This prevents overwriting changes that someone else pushed to the same branch after your last fetch.

---

## When to Use Commands

| Scenario | Command |
|----------|---------|
| Rebase current branch onto dev | `/lt-dev:git:rebase` |
| Rebase with specific base branch | `/lt-dev:git:rebase --base=main` |
| Rebase all open MRs for a project | `/lt-dev:git:rebase-mrs` |
| Rebase selected MRs/PRs | `/lt-dev:git:rebase-mrs [project-url]` |
