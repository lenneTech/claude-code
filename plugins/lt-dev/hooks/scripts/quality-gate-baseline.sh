#!/bin/bash
# Capture git state baseline on UserPromptSubmit
# Used by quality-gate.sh to skip review when Claude made no changes
[[ "$CLAUDE_USER_PROMPT" == /* ]] && exit 0
case "$PWD" in "$HOME/.claude"*) exit 0 ;; esac
git rev-parse --is-inside-work-tree &>/dev/null || exit 0

DIR_HASH=$(echo "$PWD" | md5sum 2>/dev/null | cut -d' ' -f1 || echo "$PWD" | md5 2>/dev/null)
BASELINE_FILE="/tmp/.claude-qg-baseline-${DIR_HASH}"

BASELINE_HASH=$({
  git diff HEAD 2>/dev/null
  git ls-files --others --exclude-standard 2>/dev/null
} | md5sum 2>/dev/null | cut -d' ' -f1 || {
  git diff HEAD 2>/dev/null
  git ls-files --others --exclude-standard 2>/dev/null
} | md5 2>/dev/null)

echo "$BASELINE_HASH" > "$BASELINE_FILE"
exit 0
