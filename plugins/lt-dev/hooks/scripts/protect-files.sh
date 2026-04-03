#!/bin/bash
# PreToolUse hook: Protect critical files from accidental modification
#
# Inspired by Ralph's file protection pattern (frankbria/ralph-claude-code).
# Blocks Write/Edit operations on files that should not be modified by agents
# without explicit user confirmation.
#
# Protection sources (checked in order):
# 1. .claude-protect file in project root (one glob pattern per line)
# 2. Built-in patterns for lenne.tech projects
#
# Fail-open: on any error (missing jq, bad JSON), allow the operation.
# Opt-out: CLAUDE_SKIP_FILE_PROTECTION=1

[ "${CLAUDE_SKIP_FILE_PROTECTION:-0}" = "1" ] && exit 0

INPUT=$(cat)

# ── Extract file_path from JSON input ──
if command -v jq &>/dev/null; then
  FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
else
  FILE_PATH=$(echo "$INPUT" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"file_path"[[:space:]]*:[[:space:]]*"//;s/"$//')
fi

[ -z "$FILE_PATH" ] && exit 0

# ── Resolve to relative path for pattern matching ──
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$PWD}"
REL_PATH="${FILE_PATH#"$PROJECT_DIR"/}"

# If file is outside project, use absolute path
[ "$REL_PATH" = "$FILE_PATH" ] && REL_PATH="$FILE_PATH"

# ── JSON deny helper ──
deny() {
  local reason="$1"
  if command -v jq &>/dev/null; then
    jq -n --arg reason "$reason" '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":$reason}}'
  else
    local escaped
    escaped=$(printf '%s' "$reason" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')
    printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"ask","permissionDecisionReason":"%s"}}\n' "$escaped"
  fi
  exit 0
}

# ── Match helper: check if path matches a glob pattern ──
# Uses bash extended globbing for simple patterns, falls back to grep for complex ones
matches_pattern() {
  local path="$1"
  local pattern="$2"
  local basename
  basename=$(basename "$path")

  # Direct filename match (e.g., ".env", "package-lock.json")
  if [[ "$pattern" != *"/"* ]] && [[ "$pattern" != *"*"* ]]; then
    [ "$basename" = "$pattern" ] && return 0
    return 1
  fi

  # Glob pattern match using bash case statement
  # Convert glob to regex-like pattern for case matching
  case "$path" in
    $pattern) return 0 ;;
  esac

  case "$basename" in
    $pattern) return 0 ;;
  esac

  return 1
}

# ── Built-in protected patterns for lenne.tech projects ──
BUILTIN_PATTERNS=(
  # Lock files (should only change via package manager)
  "package-lock.json"
  "pnpm-lock.yaml"
  "yarn.lock"
)

# ── Check built-in patterns ──
for pattern in "${BUILTIN_PATTERNS[@]}"; do
  if matches_pattern "$REL_PATH" "$pattern"; then
    deny "Protected file: '${REL_PATH}' matches built-in protection pattern '${pattern}'. This file requires explicit user confirmation to modify. Reason: Changes to this file type can affect deployment, security, or dependency integrity."
    exit 0
  fi
done

# ── Check project-specific .claude-protect file ──
PROTECT_FILE="${PROJECT_DIR}/.claude-protect"
if [ -f "$PROTECT_FILE" ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    # Skip empty lines and comments
    [[ -z "$line" || "$line" == \#* ]] && continue
    # Trim whitespace
    pattern=$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    [ -z "$pattern" ] && continue

    if matches_pattern "$REL_PATH" "$pattern"; then
      deny "Protected file: '${REL_PATH}' matches project protection pattern '${pattern}' (from .claude-protect). This file requires explicit user confirmation to modify."
      exit 0
    fi
  done < "$PROTECT_FILE"
fi

exit 0
