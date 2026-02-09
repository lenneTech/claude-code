---
description: Rebase current branch onto dev (with conflict resolution, linting, testing and review)
allowed-tools: Bash(git:*), Bash(gh:*), Bash(glab:*), Read, Grep, Glob, Task, AskUserQuestion, Skill
argument-hint: [--base=<branch>]
---

# Rebase Branch onto Dev

## When to Use This Command

- To update your current feature branch with the latest dev changes
- Before creating a Merge/Pull Request
- When your branch has fallen behind the development branch

## Related Commands

| Command | Purpose |
|---------|---------|
| `/lt-dev:git:rebase-mrs` | Batch rebase multiple MRs/PRs |
| `/lt-dev:git:commit-message` | Generate commit message after rebase |
| `/lt-dev:git:mr-description` | Generate MR description for rebased branch |
| `/lt-dev:review` | Standalone code review |

---

## Execution

1. **Validate current branch** - must not be a protected branch (dev, develop, main, master).

2. **Determine base branch:**
   - Use `--base=<branch>` if provided in arguments
   - Otherwise detect: check if `dev` or `develop` exists on remote
   - Fall back to `main` or `master`

3. **Confirm with user** if base branch detection was ambiguous.

4. **Spawn branch-rebaser agent** via Task tool:

   ```
   Rebase the current branch onto <base-branch>.

   Parameters:
   - branch: <current-branch>
   - base: <base-branch>
   - mode: single
   - project-path: <cwd>

   Execute the full rebase workflow (Phases 0-10):
   analyze, checkout, rebase, conflict resolution, Linear ticket analysis,
   code optimization, lint/format, tests, urgency check, iteration, and review.

   Work autonomously. Report results when done.
   ```

5. **Display the agent's report** to the user.
