---
description: Generate commit message with alternatives
allowed-tools: Bash(git diff:*), Bash(git status:*), Bash(git log:*)
---

# Generate Commit Message

## When to Use This Command

- After making changes and before committing
- When you want well-crafted commit message suggestions
- To follow consistent commit message conventions

## Related Commands

| Command | Purpose |
|---------|---------|
| `/lt-dev:git:mr-description` | Generate MR description for branch |
| `/lt-dev:git:mr-description-clipboard` | Generate MR description with clipboard copy |

---

Analyze the current changes compared to the last git commit (`git diff`) and create a commit message.

**Requirements:**
- Write in English
- Keep it short: one concise sentence
- Focus on WHAT changed and WHY, not HOW

**Output format:**
Provide exactly 3 alternatives:

```
1. [your first commit message suggestion]
2. [your second commit message suggestion]
3. [your third commit message suggestion]
```

Then add: " **Copy your preferred message to use with `git commit -am \"...\"`**"