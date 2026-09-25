# Git Worktree Operational Guide for Agent Teams

Reference for worktree best practices when using Agent Teams or parallel Claude Code sessions.

## Worktree Isolation Model

Each worktree is a **fully independent working copy** with its own:
- Checked-out branch
- Working directory state
- Installed dependencies (`node_modules/`)
- Claude Code session context

### Critical Constraint

**Claude Code cannot navigate between worktrees.** Each session is confined to its worktree directory. Attempting to read/edit files in sibling worktrees produces unexpected results. Always open separate sessions per worktree.

## Setup Protocol

### Manual Worktree Creation

```bash
# Create worktree for a feature branch
git worktree add /tmp/rebase-feature-auth feature/auth

# Create worktree from current branch (new branch)
git worktree add -b ai/task-name /tmp/ai-task-name
```

### Subagent Worktree (Automatic)

A subagent spawned with `isolation: "worktree"` on the Agent call gets an automatic worktree. No lt-dev agent sets `isolation` in its frontmatter; the caller passes it per spawn for parallel file-modifying runs.
- Created before agent starts, branched from the default branch (see below)
- Cleaned up automatically if no changes
- User prompted to keep/remove if changes exist

### Worktree Base Branch

The automatic worktree is branched from the repository's **default branch**, not from the caller's HEAD. Only `worktree.baseRef: "head"` in the user's or project's own settings changes that; a plugin cannot set it. Source: https://code.claude.com/docs/en/worktrees

Without `baseRef: "head"`, work on a feature branch runs through task branches:

```bash
# Caller (main tree, on feature/DEV-123): commit first; uncommitted changes do not reach the worktree
git commit -am "wip: state the agent builds on"

# Spawned agent (inside its worktree): branch from the named feature branch, commit there
git switch -c ai/DEV-123-backend feature/DEV-123
git commit -am "feat: backend part"

# Caller (main tree), after the agent reports: merge the task branch back, then delete it
git merge --no-ff ai/DEV-123-backend
git branch -d ai/DEV-123-backend
```

The agent branches instead of checking out `feature/DEV-123` directly because git lets a branch be checked out in only one worktree at a time, and the main tree already holds it (`fatal: 'feature/DEV-123' is already checked out at ...`).

**Rebasing follows from the same rule.** `git rebase` rewrites the branch it runs on, so the branch must be checked out in the worktree doing the rebase. A branch that is checked out in the main tree cannot be checked out in a second worktree, so it cannot be rebased inside one. Rebase it in place in the main tree, or switch the main tree to another branch first and then rebase it in the worktree. Batch rebases in isolated worktrees work for every branch the main tree does not have checked out.

### Worktree Performance Settings

Two settings optimize worktree creation for large repositories:

```json
// settings.json or per-project .claude/settings.json
{
  "worktree.sparsePaths": ["projects/api/", "package.json", "pnpm-lock.yaml"],
  "worktree.symlinkDirectories": ["node_modules", ".cache"]
}
```

| Setting | Purpose |
|---------|---------|
| `worktree.sparsePaths` | Check out only listed paths via git sparse-checkout (cone mode). Faster in large monorepos |
| `worktree.symlinkDirectories` | Symlink directories from the main repo instead of duplicating them. Saves disk space for `node_modules` |

| Agent Focus | Recommended sparsePaths |
|-------------|------------------------|
| Backend only | `projects/api/`, `package.json`, `*.lock*` |
| Frontend only | `projects/app/`, `package.json`, `*.lock*` |
| Full-stack | No sparse (needs both) |
| Config/DevOps | Root config files, `docker/`, `.github/` |

## Dependency Isolation

**Each worktree needs its own installed dependencies.**

```bash
# After creating worktree, install deps
cd /tmp/rebase-feature-auth
pnpm install  # or npm install / yarn install
```

For monorepo projects:
```bash
cd /tmp/rebase-feature-auth
pnpm install  # Root install
cd projects/api && pnpm install  # Subproject if needed
cd ../app && pnpm install
```

**Anti-pattern:** Assuming dependencies from the main worktree carry over. They don't.

## Naming Conventions

### Branch Names

| Convention | Example | Use Case |
|------------|---------|----------|
| `ai/{task-name}` | `ai/oauth-implementation` | AI-initiated branches |
| `feature/{ticket-id}` | `feature/DEV-123` | Feature branches |
| Existing branch | `feature/auth` | Rebase operations |

### Worktree Directories

| Convention | Example |
|------------|---------|
| `/tmp/rebase-{branch}` | `/tmp/rebase-feature-auth` |
| `/tmp/{project}-ai-{task}` | `/tmp/myapp-ai-oauth` |

Avoid unclear names like `/tmp/work-2` or `/tmp/temp`.

### Session Names

Use descriptive session names for `--resume` identification:
```
[branch-name]: [task description]
```
- `feature-auth: Implement OAuth flow`
- `rebase-dev-123: Rebase onto develop`

## Cleanup Discipline

### Automated Cleanup (Subagents)

Subagents spawned with `isolation: "worktree"` handle cleanup automatically:
- No changes → worktree removed silently
- Changes exist → user prompted (keep for review / remove)
- Stale worktrees from interrupted runs are auto-cleaned

### Manual Cleanup (Agent Teams)

**The lead agent handles ALL cleanup after teammates complete:**

```bash
# Remove specific worktree
git worktree remove /tmp/rebase-feature-auth --force

# Prune stale worktree references
git worktree prune

# List active worktrees
git worktree list
```

**Anti-pattern:** Teammates cleaning up their own worktrees. The lead must wait for ALL teammates to finish before cleanup.

### Session Preservation

Before deleting a worktree with valuable context:
1. Document findings in a report file (in main worktree)
2. Commit important changes in the worktree branch
3. Then safely remove the worktree

## Known Limitations

| Limitation | Workaround |
|------------|------------|
| Cannot read sibling worktree files | Open separate session per worktree |
| Branch cannot exist in multiple worktrees | Create new branch or detach HEAD |
| Session data lost on worktree deletion | Document/commit findings first |
| No shared state between worktree sessions | Use messages (Agent Teams) or files |
| Stale code after remote changes | Run `git fetch && git rebase` in worktree |

## Integration with lt-dev Agents

### Agents a caller may isolate

No lt-dev agent carries a static `isolation` field. The caller passes `isolation: "worktree"` on the spawn when several file-modifying agents run in parallel:

| Agent | Pass isolation when | Reason |
|-------|---------------------|--------|
| `branch-rebaser` | Rebasing several branches in parallel | Each rebase needs its own checked-out branch; the branch must not be checked out in the main tree (see Worktree Base Branch) |
| `backend-dev` | Running in parallel with frontend-dev | Separate working copies; merge the task branches afterwards |
| `frontend-dev` | Running in parallel with backend-dev | Separate working copies; merge the task branches afterwards |
| `devops` | Running in parallel with other modifiers | Separate working copies |

### Teammates and agent types

Agent-team teammates cannot use a plugin agent type such as `lt-dev:branch-rebaser`; the type and its `skills:` field are not applied. The lead writes the role into the spawn prompt and names the lt-dev skill the teammate invokes via the `Skill` tool (for example `rebasing-branches`). A teammate needing its own worktree gets one the lead creates manually (Setup Protocol above).

### Agents WITHOUT worktree

| Agent | Reason |
|-------|--------|
| `fullstack-updater` | Needs in-place lockfile changes |
| `nest-server-updater` | Needs in-place dependency resolution |
| `npm-package-maintainer` | Needs in-place lockfile access |
| Review agents | Read-only, no file conflicts |

### Chrome DevTools MCP in Worktrees

**Important:** Chrome DevTools MCP connects to the dev server running in the **main directory**. Agents in worktrees can still use Chrome DevTools to verify UI, but the dev server must be started in the main working directory.
