---
description: Generate a Merge Request description, optionally copied straight to the clipboard
argument-hint: "[--clipboard]"
allowed-tools: Bash(git:*), Bash(pbcopy:*), Bash(xclip:*), Bash(wl-copy:*), Bash(clip:*), Bash(command -v:*), Read
disable-model-invocation: false
---

# Generate MR Description

## When to Use This Command

- Before creating a Merge/Pull Request
- When you need a structured summary of your branch changes
- To document changes for code reviewers
- With `--clipboard`, when you want the description copied without selecting it by hand

## Related Commands

| Command | Purpose |
|---------|---------|
| `/lt-dev:git:commit-message` | Generate commit message suggestions |
| `/lt-dev:git:create-request` | Create MR/PR directly |
| `/lt-dev:dev-submit` | Full submission workflow (MR/PR + Linear comment + status) |
| `/review` | Claude Code built-in: PR-level review (after PR creation) |

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

Then add: "Copy the markdown block above to use it in your Merge Request."

## Clipboard mode (`--clipboard`)

When `$ARGUMENTS` contains `--clipboard`, present the same block, then follow it with a ready-to-run copy command. Pick the tool that exists on this machine rather than assuming macOS:

```bash
# macOS
cat << 'EOF' | pbcopy
[PASTE THE EXACT MR DESCRIPTION HERE]
EOF

# Linux (X11: xclip, Wayland: wl-copy)
cat << 'EOF' | xclip -selection clipboard
[PASTE THE EXACT MR DESCRIPTION HERE]
EOF

# Windows (Git Bash / WSL)
cat << 'EOF' | clip
[PASTE THE EXACT MR DESCRIPTION HERE]
EOF
```

Resolve the tool with `command -v pbcopy || command -v wl-copy || command -v xclip || command -v clip` and emit only the matching variant, with the real description substituted for the placeholder. Where none is available, say so and leave the markdown block as the copy source.

---

After the description is presented, suggest: "After creating the PR, run `/review` for an automated PR-level review."
