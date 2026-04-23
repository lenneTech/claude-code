---
description: Batch rebase multiple MRs/PRs onto dev (with conflict resolution, linting, testing, review, commit and force push)
allowed-tools: Bash(git:*), Bash(gh:*), Bash(glab:*), Read, Grep, Glob, Agent, AskUserQuestion
argument-hint: "[project-url] [--team] [--no-team]"
disable-model-invocation: true
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
   b. **Spawn branch-rebaser agent** via Agent tool:
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

**OUTPUT REQUIREMENTS:**

1. **All sections below are MANDATORY.**
2. **Section "Detailed Branch Reports" MUST contain the verbatim full output of every spawned `branch-rebaser` agent / teammate.** Do NOT summarize. Wrap each in a `<details>` block.
3. **Action Roadmap** — derive from failed/conflicted branches with concrete next steps per branch.
4. **No-Loss Guarantee:** Every branch processed MUST appear in both the Branch Overview table and the Detailed Branch Reports. Counts must match.
5. **No Placeholders:** Replace every `N`, `X/Y`, `X min` with concrete values.

Display unified report after all branches are processed:

```markdown
## Batch Rebase Report

### Executive Summary
- **Status:** ✅ Alle erfolgreich / ⚠️ Mit Konflikten / ❌ Blockiert
- **Ergebnis:** X/Y Branches erfolgreich rebased
- **Top 3 nächste Schritte:**
  1. ...
  2. ...
  3. ...
- **My Recommendation:** **Standard** (Konflikt-Branches manuell auflösen, sauber rebased mergen) — [Begründung in einem Satz]
- **Branches at a Glance:** ✅ Clean: N | ⚠️ Auto-Resolved: N | ❌ Konflikt: N | **Total: N**

### Decision Helper
- 🚀 **Minimal** — nur Branches mit hartem Konflikt manuell anschauen, Rest ignorieren — N Branches, ≈ X min
- 🎯 **Standard (Empfohlen)** — alle Konflikt-Branches auflösen + clean rebased Branches mergen — N Branches, ≈ X min
- 💎 **Komplett** — zusätzlich Auto-Resolved Branches verifizieren (`git diff` Review pro Branch) — N Branches, ≈ X min
- ⏭️ **Nichts** — Status melden, später kümmern, ≈ X min

After printing the report, **ask via `AskUserQuestion`** which option to execute (skip if all clean). Then process selected branches: open conflict files, propose resolutions, push after confirmation. End with a "Result"-Block: chosen option, branches handled, branches remaining, suggested next step.

### Branch Overview
| # | Branch | MR/PR | Status | Conflicts | Notes |
|---|--------|-------|--------|-----------|-------|
| 1 | feat/DEV-123 | #42 | Success | 2 resolved | All tests pass |
| 2 | fix/DEV-456 | #43 | Failed | 1 unresolvable | Manual fix needed |
| 3 | feat/DEV-789 | #44 | Success | 0 | Clean rebase |

**Results:** X/Y branches rebased successfully.

### Action Roadmap
#### 🔴 Manuelle Auflösung erforderlich
1. **fix/DEV-456 (#43)** — Unresolvable conflict in path:line — `git checkout fix/DEV-456 && <command>`
#### 🟡 Review empfohlen
1. **feat/DEV-123 (#42)** — 2 conflicts auto-resolved — diff prüfen: `git diff origin/dev...feat/DEV-123`
#### 🟢 Bereit zum Merge
1. **feat/DEV-789 (#44)** — Clean rebase, alle Tests grün

### Detailed Branch Reports

<details>
<summary>📦 feat/DEV-123 (#42) — full report</summary>

[Paste the COMPLETE return message of the `branch-rebaser` agent / teammate for this branch here, verbatim.]

</details>

<details>
<summary>📦 fix/DEV-456 (#43) — full report</summary>

[Paste the COMPLETE return message — including conflict details, attempted resolutions, and final state.]

</details>

[One `<details>` block per branch — never omit or summarize.]
```
