#!/bin/bash
# UserPromptSubmit hook: Reset quality gate counter after inactivity
# Resets if >30 minutes have passed since last quality gate run
# and there are actual source code changes in the working directory
#
# Note: File filter is broader than quality-gate.sh (includes json/yaml/sh)
# to detect any dev activity for reset purposes, while the gate itself
# only triggers for actual code changes (ts/vue/tsx/jsx/js/mjs).

# Skip slash commands — they have their own skill associations
[[ "$CLAUDE_USER_PROMPT" == /* ]] && exit 0

# Skip non-project directories
case "$PWD" in
  "$HOME/.claude"*) exit 0 ;;
esac

# Must be in a git repo
git rev-parse --is-inside-work-tree &>/dev/null || exit 0

# Must have changed source files
CHANGED=$(
  {
    git diff --name-only HEAD 2>/dev/null
    git diff --cached --name-only 2>/dev/null
    git ls-files --others --exclude-standard 2>/dev/null
  } | grep -E '\.(ts|vue|tsx|jsx|js|mjs|json|ya?ml|sh)$' | head -1
)
[ -z "$CHANGED" ] && exit 0

DIR_HASH=$(echo "$PWD" | md5sum 2>/dev/null | cut -d' ' -f1 || echo "$PWD" | md5 2>/dev/null)
COUNTER_FILE="/tmp/.claude-qg-${DIR_HASH}"
TIMESTAMP_FILE="/tmp/.claude-qg-ts-${DIR_HASH}"
REVIEWED_FILE="/tmp/.claude-qg-reviewed-${DIR_HASH}"
TIER_FILE="/tmp/.claude-qg-tier-${DIR_HASH}"

# No counter → nothing to reset
[ ! -f "$COUNTER_FILE" ] && exit 0

# Only reset if >30 minutes since last gate
if [ -f "$TIMESTAMP_FILE" ]; then
  LAST_RUN=$(cat "$TIMESTAMP_FILE" 2>/dev/null || echo "0")
  NOW=$(date +%s)
  ELAPSED=$(( NOW - LAST_RUN ))
  [ "$ELAPSED" -lt 1800 ] && exit 0
fi

rm -f "$COUNTER_FILE" "$TIMESTAMP_FILE" "$REVIEWED_FILE" "$TIER_FILE" 2>/dev/null
exit 0
