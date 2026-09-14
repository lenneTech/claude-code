#!/bin/bash
# Shared helper for UserPromptSubmit hooks: reads the hook payload from stdin and
# sets PROMPT to the submitted text (empty when absent or unreadable).
#
# Claude Code passes the prompt only as the `prompt` field of the JSON payload on
# stdin; no environment variable carries it. Hooks that read $CLAUDE_USER_PROMPT,
# which Claude Code does not set, ran every keyword filter on an empty string.
#
# jq is preferred. Without it (Git Bash on Windows ships none), the JSON string is
# extracted escape-aware and unescaped, the same way block-dangerous-bash.sh does.

PROMPT=""
if [ ! -t 0 ]; then
  _hook_input=$(cat)
  if command -v jq >/dev/null 2>&1; then
    PROMPT=$(printf '%s' "$_hook_input" | jq -r '.prompt // empty' 2>/dev/null)
  else
    PROMPT=$(printf '%s' "$_hook_input" | tr -d '\n' | grep -o '"prompt"[[:space:]]*:[[:space:]]*"\(\\.\|[^"\\]\)*"' | head -1 | sed 's/^"prompt"[[:space:]]*:[[:space:]]*"//;s/"$//')
    PROMPT=$(printf '%b' "${PROMPT//\\\"/\"}")
  fi
  unset _hook_input
fi
