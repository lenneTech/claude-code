---
description: Generate and post a testing comment on a Linear issue
argument-hint: [issue-id]
disable-model-invocation: true
---

# Generate Linear Issue Comment

## When to Use This Command

- After completing work on a Linear issue
- To provide testers with clear, non-technical testing instructions
- As part of the workflow: `fix-issue` -> `review` -> `comment`

## Related Commands

| Command | Purpose |
|---------|---------|
| `/lt-dev:fix-issue` | Implement a Linear issue |
| `/lt-dev:review` | Code review before merging |
| `/lt-dev:git:mr-description` | Generate MR description |

---

## Execution

### STEP 0: Resolve Issue ID

Determine the target issue ID:

1. **If `$ARGUMENTS` is provided and non-empty:** Use it directly as the issue ID.
2. **If no argument:** Auto-detect from the current git branch name:
   - Run `git branch --show-current`
   - Extract the issue identifier (e.g., branch `dev-1575` → issue `DEV-1575`, branch `feature/LIN-42-some-description` → issue `LIN-42`)
   - Pattern: Look for a prefix followed by digits, separated by `-` (e.g., `dev-1575`, `lin-42`, `feat/abc-123-title`)
   - If no issue ID can be extracted, ask the user to provide one

Store the resolved issue ID as `ISSUE_ID` for subsequent steps.

### STEP 1: Gather Context

1. **Retrieve Issue:** Fetch Linear issue **#ISSUE_ID** via MCP (title, description, acceptance criteria).
2. **Analyze Changes:** Run `git diff main...HEAD --stat` and `git diff main...HEAD` to understand what was changed. If there are no committed changes, fall back to `git diff HEAD` for uncommitted changes.
3. **Read Key Files:** If the diff is large, read the most relevant changed files to understand the user-facing impact.

### STEP 2: Generate Comment

Write a comment in **German** that a non-developer (e.g., project manager, QA tester) can understand. Follow this structure:

```
## Umsetzung

[1-3 sentences: What was implemented/fixed, described in user-facing terms. No technical jargon.]

## Testanleitung

[Step-by-step testing instructions:]
1. [First step - e.g., "Seite X aufrufen"]
2. [Action to perform]
3. [Expected result to verify]

[If applicable, add edge cases to check.]
```

**Rules:**
- No code references, file names, or technical implementation details
- Focus on WHAT changed from a user perspective, not HOW it was implemented
- Testing steps must be actionable and verifiable
- Keep it concise - max 10-15 lines total

### STEP 3: User Approval

Present the generated comment to the user using `AskUserQuestion`:
- **Option 1:** "Post comment" - Post as-is to Linear
- **Option 2:** "Edit first" - Let the user modify before posting

### STEP 4: Post to Linear

Post the approved comment to issue **#ISSUE_ID** via the Linear MCP `save_comment` tool.

Confirm to the user: "Comment posted to ISSUE_ID."
