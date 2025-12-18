---
description: Generate MR description and save to clipboard
allowed-tools: Bash(git diff:*), Bash(git log:*), Bash(git status:*), Bash(git branch:*), Bash(pbcopy:*), Read
---

# Generate MR Description (Clipboard)

## When to Use This Command

- Before creating a Merge/Pull Request when you want quick clipboard access
- When you prefer copying directly via command instead of manual selection
- Same as `/mr-description` but with automatic clipboard command

## Related Commands

| Command | Purpose |
|---------|---------|
| `/lt-dev:git:commit-message` | Generate commit message suggestions |
| `/lt-dev:git:mr-description` | Same as this, without clipboard copy |

---

Create a comprehensive summary of the changes in English for a Merge Request description.

Please structure the description as follows:
- **Summary**: Brief summary (1-2 sentences)
- **Changes**: List of the most important changes
- **Technical Details**: Relevant technical details if necessary
- **Testing**: How was it tested / how can it be tested

Keep it short and concise - focus on what's essential for code reviewers.

**IMPORTANT - CLIPBOARD WORKFLOW:**

1. First, create the MR description in this format:

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

2. After presenting the description, provide this shell command:

```bash
cat << 'EOF' | pbcopy
[PASTE THE EXACT MR DESCRIPTION HERE]
EOF
echo " MR description copied to clipboard!"
```

3. User can run this command to copy the description to clipboard automatically.

**Platform-specific commands:**
- macOS: `pbcopy`
- Linux: `xclip -selection clipboard` or `xsel --clipboard`
- Windows: `clip`
