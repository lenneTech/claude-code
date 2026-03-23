---
description: Submit current work for dev review — creates MR/PR, posts Linear comment, and moves ticket to Dev Review
argument-hint: "[issue-id]"
allowed-tools: Read, Bash(git:*), Bash(gh pr:*), Bash(glab mr:*), mcp__plugin_lt-dev_linear__get_issue, mcp__plugin_lt-dev_linear__list_comments, mcp__plugin_lt-dev_linear__create_comment, mcp__plugin_lt-dev_linear__update_issue, mcp__plugin_lt-dev_linear__get_status, mcp__plugin_lt-dev_linear__list_workflow_states, AskUserQuestion
disable-model-invocation: true
---

# Dev Submit — Work for Review bereitstellen

## When to Use This Command

- When implementation is complete and ready for another developer to review
- To hand off work: creates MR/PR, documents what was done, and signals readiness in Linear
- Combines `/lt-dev:git:create-request`, `/lt-dev:linear-comment`, and Linear status update in one step

## Related Commands

| Command | Purpose |
|---------|---------|
| `/lt-dev:git:create-request` | Only create MR/PR (without Linear integration) |
| `/lt-dev:linear-comment` | Only post a comment on a Linear issue |
| `/lt-dev:resolve-ticket` | Full ticket resolution (implementation + tests + review) |
| `/lt-dev:review` | Code review before submitting |

---

## Execution

### STEP 0: Resolve Linear Issue ID

Determine the target issue ID:

1. **If `$ARGUMENTS` is provided and non-empty:** Use it directly as the issue ID.
2. **If no argument:** Auto-detect from the current git branch name:
   - Run `git branch --show-current`
   - Extract the issue identifier (e.g., branch `dev-1575` → issue `DEV-1575`, branch `feature/LIN-42-some-description` → issue `LIN-42`)
   - Pattern: Look for a prefix followed by digits, separated by `-` (e.g., `dev-1575`, `lin-42`, `feat/abc-123-title`)
3. **If no issue ID can be extracted:** Ask the user via `AskUserQuestion`:
   - "Ich konnte keine Linear Issue-ID aus dem Branch-Namen ableiten. Bitte gib die Issue-ID an (z.B. `DEV-123`):"

Store the resolved issue ID as `ISSUE_ID` for subsequent steps.

### STEP 1: Pre-Flight — Git State prüfen

1. **Current branch:** Run `git branch --show-current`. Abort if on `main`, `master`, `dev`, or `develop`.
2. **Uncommitted changes:** Run `git status --porcelain`.
   - If there are uncommitted changes, ask the user via `AskUserQuestion`:
     - "Es gibt uncommittete Änderungen:"
     - Show the list of changed files
     - Option 1: "Automatisch committen & pushen" → Stage all, create commit with descriptive message, push
     - Option 2: "Ich mache es selbst" → Pause and let the user handle it, then continue
3. **Unpushed commits:** Run `git log @{upstream}..HEAD --oneline 2>/dev/null`.
   - If there are unpushed commits (or no upstream), ask the user:
     - "Es gibt unpushte Commits. Soll ich pushen?"
     - Option 1: "Ja, pushen" → Run `git push -u origin $(git branch --show-current)`
     - Option 2: "Nein, abbrechen" → Abort

### STEP 2: MR/PR erstellen

**Detect Git Provider:**

```bash
git remote get-url origin
```

| URL Pattern | Provider | CLI Tool |
|-------------|----------|----------|
| `github.com` | GitHub | `gh` |
| `gitlab` or other | GitLab | `glab` |

**Detect Target Branch** (first match wins):
1. `origin/dev`
2. `origin/develop`
3. `origin/main`
4. `origin/master`

**Check for existing MR/PR:**
- GitHub: `gh pr list --head $(git branch --show-current) --json url --jq '.[0].url'`
- GitLab: `glab mr list --source-branch $(git branch --show-current) --json url --jq '.[0].url'`

If an MR/PR already exists, skip creation and use the existing URL.

**Generate description** from branch commits:
1. Run `git log <target-branch>..HEAD --oneline` for commit list
2. Run `git diff <target-branch>..HEAD --stat` for changed files

**Create MR/PR:**
- GitHub: `gh pr create --base <target-branch> --title "<title>" --body "<description>"`
- GitLab: `glab mr create --target-branch <target-branch> --title "<title>" --description "<description>"`

Store the MR/PR URL as `REQUEST_URL`.

### STEP 3: Linear Comment posten

1. **Retrieve Issue:** Fetch Linear issue **#ISSUE_ID** via MCP (title, description).
2. **Analyze Changes:** Use the commit list and diff stat from Step 2.
3. **Generate Comment** in **German** for non-developers:

```
## Umsetzung

[1-3 sentences: What was implemented/fixed, described in user-facing terms. No technical jargon.]

## Testanleitung

[Step-by-step testing instructions:]
1. [First step - e.g., "Seite X aufrufen"]
2. [Action to perform]
3. [Expected result to verify]

## Review

MR/PR: REQUEST_URL
```

4. **User Approval** via `AskUserQuestion`:
   - Show the generated comment
   - Option 1: "Posten" → Post as-is
   - Option 2: "Bearbeiten" → Let the user modify before posting
5. **Post** the comment to issue **#ISSUE_ID** via Linear MCP `create_comment`.

### STEP 4: Ticket-Status auf "Dev Review" setzen

1. **Get workflow states:** Use Linear MCP to list available workflow states for the issue's team.
2. **Find "Dev Review" state:** Look for a state matching "Dev Review", "In Review", "Review", or "Code Review" (case-insensitive).
   - If no matching state is found, ask the user which state to use.
3. **Update issue status** via Linear MCP `update_issue` to the matched state.

### STEP 5: Zusammenfassung

Output a summary:

```
Dev Submit abgeschlossen:
- MR/PR: <REQUEST_URL>
- Linear Comment: Gepostet auf ISSUE_ID
- Ticket-Status: Verschoben nach "Dev Review"
```
