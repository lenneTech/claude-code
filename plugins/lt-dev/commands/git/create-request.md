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

Determine the target branch for the MR/PR:

1. Check for `dev` branch: `git rev-parse --verify origin/dev 2>/dev/null`
2. Check for `develop` branch: `git rev-parse --verify origin/develop 2>/dev/null`
3. Fallback to `main`: `git rev-parse --verify origin/main 2>/dev/null`
4. Fallback to `master`: `git rev-parse --verify origin/master 2>/dev/null`

Use the first match as the target branch.

### STEP 3: Generate Description

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

### STEP 4: Create MR/PR

**GitHub:**
```bash
gh pr create --base <target-branch> --title "<title>" --body "<description>"
```

**GitLab:**
```bash
glab mr create --target-branch <target-branch> --title "<title>" --description "<description>"
```

The title should be derived from the branch name or the most descriptive commit message.

### STEP 5: Confirm

Output the MR/PR URL to the user:
- "MR/PR erstellt: <URL>"
- Suggest: "Tipp: `/lt-dev:review` für einen automatisierten Code-Review ausführen."
