---
description: Batch rebase multiple MRs/PRs onto dev (with conflict resolution, linting, testing, review, commit and force push)
allowed-tools: Bash(git:*), Bash(gh:*), Bash(glab:*), Read, Grep, Glob, Task, AskUserQuestion, Skill
argument-hint: [project-url]
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

5. **For each selected branch**, sequentially:

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

6. **Restore original branch:**
   ```bash
   git checkout <original-branch>
   ```

7. **Display summary report:**

   ```markdown
   ## Batch Rebase Report

   | # | Branch | MR/PR | Status | Conflicts | Notes |
   |---|--------|-------|--------|-----------|-------|
   | 1 | feat/DEV-123 | #42 | Success | 2 resolved | All tests pass |
   | 2 | fix/DEV-456 | #43 | Failed | 1 unresolvable | Manual fix needed |
   | 3 | feat/DEV-789 | #44 | Success | 0 | Clean rebase |

   **Results:** X/Y branches rebased successfully.
   ```
