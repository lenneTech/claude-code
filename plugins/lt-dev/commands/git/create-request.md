---
description: Create a Merge Request (GitLab) or Pull Request (GitHub) from the current branch
allowed-tools: Bash(git:*), Bash(gh pr:*), Bash(glab mr:*), Read, AskUserQuestion
disable-model-invocation: true
---

# Create Merge/Pull Request

## When to Use This Command

- To create a MR/PR from the current feature branch
- After completing implementation and pushing changes
- As part of the dev-submit workflow

## Related Commands

| Command | Purpose |
|---------|---------|
| `/lt-dev:git:mr-description` | Generate MR description without creating |
| `/lt-dev:git:mr-description-clipboard` | Generate MR description and copy to clipboard |
| `/lt-dev:dev-submit` | Full submission workflow (includes this command) |
| `/lt-dev:review` | Code review before merging |

---

## Execution

### STEP 0: Pre-Flight Checks

1. **Current branch:** Run `git branch --show-current`. Abort if on `main`, `master`, `dev`, or `develop` — these are protected branches.
2. **Uncommitted changes:** Run `git status --porcelain`.
   - If there are uncommitted changes, ask the user via `AskUserQuestion`:
     - "Es gibt uncommittete Änderungen. Soll ich diese committen und pushen, oder möchtest du das selbst machen?"
     - Option 1: "Automatisch committen & pushen" → Stage all, create commit with descriptive message, push
     - Option 2: "Ich mache es selbst" → Abort and let the user handle it
3. **Unpushed commits:** Run `git log @{upstream}..HEAD --oneline 2>/dev/null`.
   - If there are unpushed commits (or no upstream), ask the user:
     - "Es gibt unpushte Commits. Soll ich pushen?"
     - Option 1: "Ja, pushen" → Run `git push -u origin $(git branch --show-current)`
     - Option 2: "Nein" → Abort

### STEP 1: Detect Git Provider

Determine whether the remote is GitHub or GitLab:

```bash
git remote get-url origin
```

| URL Pattern | Provider | CLI Tool |
|-------------|----------|----------|
| `github.com` | GitHub | `gh` |
| `gitlab` or other | GitLab | `glab` |

### STEP 2: Detect Target Branch

Determine the target branch for the MR/PR using a priority chain:

**Priority 1 — Parent branch from git history:**

Try to determine the branch from which the current branch was created:

```bash
# Check reflog for branch creation point
git reflog show $(git branch --show-current) --format='%gs' | grep 'branch: Created from' | head -1
```

This returns e.g. `branch: Created from dev` or `branch: Created from refs/heads/develop`. Extract the branch name.

If not found, try the checkout history:

```bash
git reflog show --format='%gs' | grep 'checkout: moving from .* to $(git branch --show-current)' | head -1
```

Extract the source branch name (the part after "moving from" and before " to").

Verify the detected parent branch exists on remote: `git rev-parse --verify origin/<detected-branch> 2>/dev/null`

**Priority 2 — Fallback to well-known branches** (if Priority 1 fails or detected branch has no remote):

1. `origin/dev`
2. `origin/develop`
3. `origin/main`
4. `origin/master`

Use the first match as the target branch.

### STEP 3: Check for Existing MR/PR

Before creating, check if an MR/PR already exists for this branch:

- GitHub: `gh pr list --head $(git branch --show-current) --json url --jq '.[0].url'`
- GitLab: `glab mr list --source-branch $(git branch --show-current) --json url --jq '.[0].url'`

If an MR/PR already exists, output the URL and skip to STEP 5.

### STEP 4: Generate Description

Analyze the branch changes to generate a concise MR/PR description:

1. Run `git log <target-branch>..HEAD --oneline` to get commit list
2. Run `git diff <target-branch>..HEAD --stat` to get changed files overview

Structure the description:

```markdown
## Summary
[1-2 sentences summarizing the changes]

## Changes
- [Key change 1]
- [Key change 2]
- ...

## Commits
- [commit messages from the branch]
```

### STEP 5: Create MR/PR

**GitHub:**
```bash
gh pr create --base <target-branch> --title "<title>" --body "<description>"
```

**GitLab:**
```bash
glab mr create --target-branch <target-branch> --title "<title>" --description "<description>"
```

The title should be derived from the branch name or the most descriptive commit message.

### STEP 6: Confirm

Output the MR/PR URL to the user:
- "MR/PR erstellt: <URL>"
- Suggest: "Tipp: `/lt-dev:review` für einen automatisierten Code-Review ausführen."
