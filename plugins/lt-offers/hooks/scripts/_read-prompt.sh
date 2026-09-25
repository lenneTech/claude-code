#!/bin/bash
# Shared helper for UserPromptSubmit hooks: reads the hook payload from stdin and
# sets PROMPT to the submitted text (empty when absent or unreadable).
#
# Claude Code passes the prompt only as the `prompt` field of the JSON payload on
# stdin; no environment variable carries it. Hooks that read $CLAUDE_USER_PROMPT,
# which Claude Code does not set, ran every keyword filter on an empty string.
#
# jq is preferred. Without it (Git Bash on Windows ships none), the JSON string is
# extracted escape-aware and unescaped: the match runs over escape pairs (\" \\ \n)
# as well as plain characters, so an escaped quote inside the prompt does not end the
# string early, and printf %b turns \n and friends back into the characters they stand
# for. A plain "[^"]*" match stopped at the first \" and dropped the rest of the prompt.
# The extended regex (grep -E) keeps the alternation POSIX, so it behaves the same with
# GNU grep, BSD grep on macOS and the grep in Git Bash.
#
# Identical copies live in lt-offers and lt-showroom (lt-dev has its own): plugins run
# in isolation and cannot source each other's helpers.

PROMPT=""
if [ ! -t 0 ]; then
  _hook_input=$(cat)
  if command -v jq >/dev/null 2>&1; then
    PROMPT=$(printf '%s' "$_hook_input" | jq -r '.prompt // empty' 2>/dev/null)
  else
    PROMPT=$(printf '%s' "$_hook_input" | tr -d '\n' | grep -oE '"prompt"[[:space:]]*:[[:space:]]*"(\\.|[^"\\])*"' | head -1 | sed 's/^"prompt"[[:space:]]*:[[:space:]]*"//;s/"$//')
    PROMPT=$(printf '%b' "${PROMPT//\\\"/\"}")
  fi
  unset _hook_input
fi
