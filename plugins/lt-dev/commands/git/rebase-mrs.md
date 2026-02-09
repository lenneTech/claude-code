---
description: Batch rebase multiple MRs/PRs onto dev (with conflict resolution, linting, testing, review, commit and force push)
allowed-tools: Bash(git:*), Bash(gh:*), Bash(glab:*), Read, Grep, Glob, Task, AskUserQuestion, Skill
argument-hint: [project-url] [--team] [--no-team]
---

# Batch Rebase MRs/PRs

## When to Use This Command

- To rebase multiple open MRs/PRs onto the latest dev branch
- After a large dev merge that affects many feature branches
- During sprint cleanup to bring all branches up to date

## Related Commands

| Command | Purpose |
|---------|---------|
| `/lt-dev:git:rebase` | Rebase a single branch |
| `/lt-dev:git:commit-message` | Generate commit message |
| `/lt-dev:git:mr-description` | Generate MR description |
| `/lt-dev:review` | Standalone code review |

**Related Skills:**

| Skill | Purpose |
|-------|---------|
| `coordinating-agent-teams` | Parallel worktree execution for batch operations |

---

## Execution

1. **Detect or ask for project source:**
   - If argument is a GitHub/GitLab URL → use that project
   - Otherwise detect from current repo's `origin` remote
   - Determine platform: GitHub (`gh`) or GitLab (`glab`)

2. **List open MRs/PRs:**
   ```bash
   # GitHub
   gh pr list --state open --json number,title,headRefName --limit 50

   # GitLab
   glab mr list --state opened
   ```

3. **Present list to user** via AskUserQuestion:
   - Show MR/PR number, title, and branch name
   - Let user select which branches to rebase (multi-select)

4. **Ask for base branch** (default: dev):
   - Use `--base=<branch>` if provided
   - Otherwise ask user to confirm base branch

5. **Parse flags:** Check `$ARGUMENTS` for `--team` or `--no-team`

### Team Mode Decision

1. **Check feature flag:**
   ```bash
   echo $CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS
   ```
   If empty or 0 → **Single Mode**

2. **Check explicit flags:**
   - `--no-team` in arguments → **Single Mode**
   - `--team` in arguments → **Team Mode**

3. **Auto-detection** (only if no explicit flag):
   - More than 2 branches selected → **Team Mode**
   - Otherwise → **Single Mode**

---

### Execution - Single Mode

For each selected branch, sequentially:

   a. **Save current branch** to restore later
   b. **Spawn branch-rebaser agent** via Task tool:
      ```
      Rebase branch <branch-name> onto <base-branch>.

      Parameters:
      - branch: <branch-name>
      - base: <base-branch>
      - mode: batch
      - project-path: <cwd>

      Execute the full rebase workflow (Phases 0-12):
      analyze, checkout, rebase, conflict resolution, Linear ticket analysis,
      code optimization, lint/format, tests, urgency check, iteration, review,
      commit, and force push.

      Work autonomously. Report results when done.
      ```
   c. **Collect status** (success/failure/skipped)

**Restore original branch:**
```bash
git checkout <original-branch>
```

**Display summary report** (see Report Format below).

---

### Execution - Team Mode

Inform the user: "Team Mode aktiviert - Branches werden parallel via Worktrees rebased."

**Step 1: Worktree Setup**

For each selected branch, create a worktree:
```bash
git worktree add /tmp/rebase-<branch-name> <branch-name>
```

If worktree creation fails for any branch, report the error and exclude that branch from parallel processing.

**Step 2: Create Agent Team**

Create an agent team with N teammates (one per branch) using Sonnet:

For each branch, create a teammate:

**Teammate "rebase-`<branch-name>`":**
Rebase branch `<branch-name>` onto `<base-branch>`.
Work exclusively in worktree: `/tmp/rebase-<branch-name>`
Execute the full rebase workflow (Phases 0-12):
analyze, rebase, conflict resolution, Linear ticket analysis,
code optimization, lint/format, tests, urgency check, iteration, review,
commit, and force push.
Report results (success/failure, conflicts resolved, test status) when done.

Lead monitors progress and collects reports from all teammates.

**Step 3: Worktree Cleanup (CRITICAL)**

After ALL teammates complete (regardless of success or failure):

```bash
# Remove each worktree
git worktree remove /tmp/rebase-<branch-name> --force

# After all worktrees removed, prune stale entries
git worktree prune
```

**This cleanup MUST always execute**, even if teammates failed or timed out. Leftover worktrees consume disk space and can cause git confusion.

**Step 4: Clean up team**

Shutdown teammates, end team session.

---

## Report Format

Display summary report after all branches are processed:

```markdown
## Batch Rebase Report

| # | Branch | MR/PR | Status | Conflicts | Notes |
|---|--------|-------|--------|-----------|-------|
| 1 | feat/DEV-123 | #42 | Success | 2 resolved | All tests pass |
| 2 | fix/DEV-456 | #43 | Failed | 1 unresolvable | Manual fix needed |
| 3 | feat/DEV-789 | #44 | Success | 0 | Clean rebase |

**Results:** X/Y branches rebased successfully.
```
