---
description: Generate Merge Request description
allowed-tools: Bash(git diff:*), Bash(git log:*), Bash(git status:*), Bash(git branch:*), Read
---

# Generate MR Description

## When to Use This Command

- Before creating a Merge/Pull Request
- When you need a structured summary of your branch changes
- To document changes for code reviewers

## Related Commands

| Command | Purpose |
|---------|---------|
| `/lt-dev:git:commit-message` | Generate commit message suggestions |
| `/lt-dev:git:mr-description-clipboard` | Same as this, but with clipboard copy |

---

Create a comprehensive summary of the changes in English so I can use it as a description in a Merge Request. Only include the essential points.

Please structure the description as follows:
- **Summary**: Brief summary (1-2 sentences)
- **Changes**: List of the most important changes
- **Technical Details**: Relevant technical details if necessary
- **Testing**: How was it tested / how can it be tested

Keep it short and concise - focus on what's essential for code reviewers.

**IMPORTANT OUTPUT FORMAT:**
Present the final MR description in a clearly marked code block that is easy to copy:

```markdown
## Summary
[Your summary here]

## Changes
- Change 1
- Change 2

## Technical Details
[Details if necessary]

## Testing
[Testing approach]
```

Then add: "✂️ **Copy the markdown block above to use it in your Merge Request.**"
