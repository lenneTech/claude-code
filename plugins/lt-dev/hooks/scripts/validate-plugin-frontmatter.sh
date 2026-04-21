#!/bin/bash
# Plugin Frontmatter Validation Hook
#
# Validates YAML frontmatter in plugin markdown files (skills, commands, agents).
# Called as PreToolUse hook for Write operations on plugin files.
#
# Fail-open: on any error, allow the operation.

INPUT=$(cat)

# ── Extract file_path from JSON input ──
if command -v jq &>/dev/null; then
  FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""')
else
  FILE_PATH=$(echo "$INPUT" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"file_path"[[:space:]]*:[[:space:]]*"//;s/"$//')
fi

[ -z "$FILE_PATH" ] && exit 0

# ── Fast path: skip non-markdown files ──
case "$FILE_PATH" in
  *.md|*.MD) ;;
  *) exit 0 ;;
esac

# ── Skip files not in plugin directories ──
echo "$FILE_PATH" | grep -qE '/(skills|commands|agents)/' || exit 0

# ── Reference files in skills/ (non-SKILL.md) are exempt ──
if echo "$FILE_PATH" | grep -q '/skills/'; then
  case "$FILE_PATH" in
    *SKILL.md) ;;
    *) exit 0 ;;
  esac
fi

# ── Determine tool name ──
if command -v jq &>/dev/null; then
  TOOL=$(echo "$INPUT" | jq -r '.tool_name // ""')
else
  TOOL=$(echo "$INPUT" | grep -o '"tool_name"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"tool_name"[[:space:]]*:[[:space:]]*"//;s/"$//')
fi

# ── Edit tool: only validate if frontmatter is being touched ──
if [ "$TOOL" = "Edit" ]; then
  if command -v jq &>/dev/null; then
    OLD_STRING=$(echo "$INPUT" | jq -r '.tool_input.old_string // ""')
    NEW_STRING=$(echo "$INPUT" | jq -r '.tool_input.new_string // ""')
  else
    OLD_STRING=$(echo "$INPUT" | grep -o '"old_string"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"old_string"[[:space:]]*:[[:space:]]*"//;s/"$//')
    NEW_STRING=$(echo "$INPUT" | grep -o '"new_string"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"new_string"[[:space:]]*:[[:space:]]*"//;s/"$//')
  fi

  # If neither old_string nor new_string contains ---, the edit is not touching frontmatter → allow
  if ! echo "$OLD_STRING" | grep -q '\-\-\-' && ! echo "$NEW_STRING" | grep -q '\-\-\-'; then
    exit 0
  fi

  # Frontmatter is being edited — validate new_string as the content to check
  CONTENT="$NEW_STRING"
  [ -z "$CONTENT" ] && exit 0
else
  # ── Write tool: extract content from JSON input ──
  if command -v jq &>/dev/null; then
    CONTENT=$(echo "$INPUT" | jq -r '.tool_input.content // ""')
  else
    # Fallback: extract content between quotes (limited but sufficient for frontmatter check)
    CONTENT=$(echo "$INPUT" | sed -n 's/.*"content"[[:space:]]*:[[:space:]]*"//p' | sed 's/"[[:space:]]*}.*$//')
  fi

  [ -z "$CONTENT" ] && exit 0
fi

# ── JSON deny helper ──
deny() {
  local reason="$1"
  if command -v jq &>/dev/null; then
    jq -n --arg reason "$reason" '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":$reason}}'
  else
    local escaped
    escaped=$(printf '%s' "$reason" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')
    printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"%s"}}\n' "$escaped"
  fi
  exit 0
}

# ── Check frontmatter presence ──
TRIMMED=$(echo "$CONTENT" | sed '/^[[:space:]]*$/d' | head -1)
[ "$TRIMMED" != "---" ] && deny "Plugin markdown files require YAML frontmatter (file must start with ---)"

# ── Extract frontmatter block (between first --- and second ---) ──
FRONTMATTER=$(echo "$CONTENT" | awk '
  /^---$/ { count++; next }
  count == 1 { print }
  count >= 2 { exit }
')

[ -z "$FRONTMATTER" ] && deny "YAML frontmatter is not properly closed (missing closing ---)"

# ── Parse frontmatter fields ──
get_field() {
  local field="$1"
  echo "$FRONTMATTER" | grep -E "^${field}:" | head -1 | sed "s/^${field}:[[:space:]]*//" | sed "s/^[\"']//;s/[\"']$//"
}

FM_NAME=$(get_field "name")
FM_DESCRIPTION=$(get_field "description")
FM_MODEL=$(get_field "model")
FM_TOOLS=$(get_field "tools")

# ── Validate SKILL.md ──
if echo "$FILE_PATH" | grep -q '/skills/.*SKILL\.md$'; then
  MISSING=""
  [ -z "$FM_NAME" ] && MISSING="name"
  [ -z "$FM_DESCRIPTION" ] && { [ -n "$MISSING" ] && MISSING="$MISSING, description" || MISSING="description"; }

  [ -n "$MISSING" ] && deny "SKILL.md requires these fields in frontmatter: $MISSING"

  # Check description length (max 1024 chars)
  DESC_LEN=${#FM_DESCRIPTION}
  [ "$DESC_LEN" -gt 1024 ] && deny "Skill description too long (${DESC_LEN} chars). Maximum is 1024 characters."
fi

# ── Validate agent files ──
if echo "$FILE_PATH" | grep -q '/agents/'; then
  MISSING=""
  [ -z "$FM_NAME" ] && MISSING="name"
  [ -z "$FM_DESCRIPTION" ] && { [ -n "$MISSING" ] && MISSING="$MISSING, description" || MISSING="description"; }
  [ -z "$FM_MODEL" ] && { [ -n "$MISSING" ] && MISSING="$MISSING, model" || MISSING="model"; }
  [ -z "$FM_TOOLS" ] && { [ -n "$MISSING" ] && MISSING="$MISSING, tools" || MISSING="tools"; }

  [ -n "$MISSING" ] && deny "Agent file missing required fields: $MISSING"

  # Validate model value
  MODEL_LOWER=$(echo "$FM_MODEL" | tr '[:upper:]' '[:lower:]')
  case "$MODEL_LOWER" in
    haiku*|sonnet*|opus*|inherit|claude-*) ;;
    *) deny "Invalid model \"$FM_MODEL\". Use: haiku, sonnet, opus, inherit, or a full model ID (e.g., claude-sonnet-4-6)" ;;
  esac
fi

# ── Validate command files ──
if echo "$FILE_PATH" | grep -q '/commands/'; then
  [ -z "$FM_DESCRIPTION" ] && deny "Command file requires \"description\" field in frontmatter"
fi

exit 0
