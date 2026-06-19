#!/bin/bash
# Plugin Frontmatter Validation Hook
#
# Validates YAML frontmatter in plugin markdown files (skills, commands, agents).
# Called as PreToolUse hook for Write/Edit operations on plugin files.
#
# Strategy:
#   - Write tool: validate the new file content directly (it IS the full file).
#   - Edit tool: load the existing file, apply the (old_string -> new_string)
#     substitution honoring replace_all, then validate the RESULTING file content.
#     This avoids false positives when the new_string contains markdown rules
#     (---) or table separators (|---|) that look like YAML frontmatter markers
#     in isolation but are perfectly fine inside the larger file.
#
# Fail-open: on any unexpected error, allow the operation.

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

# ── Compute the file content that WILL exist after this tool call ──
# CONTENT after this block is the canonical target the validator works on:
#   - Write: tool_input.content (the tool replaces the file with this verbatim).
#   - Edit:  read the existing file, apply (old_string -> new_string) substitution
#            honoring tool_input.replace_all. If the existing file cannot be read
#            (new file, race condition, permission error), fall back to fail-open —
#            Edit will surface the underlying error itself, no need to second-guess.
CONTENT=""

if [ "$TOOL" = "Edit" ]; then
  # Require jq for Edit validation — the legacy regex fallback cannot reliably
  # extract multi-line old_string / new_string from the JSON payload, so without
  # jq we cannot perform an accurate substitution. Fail-open in that case.
  if ! command -v jq &>/dev/null; then
    exit 0
  fi

  OLD_STRING=$(echo "$INPUT" | jq -r '.tool_input.old_string // ""')
  NEW_STRING=$(echo "$INPUT" | jq -r '.tool_input.new_string // ""')
  REPLACE_ALL=$(echo "$INPUT" | jq -r '.tool_input.replace_all // false')

  # Existing file must be readable for us to compute the resulting content.
  # If not (new file via Edit is an Edit-tool error anyway), fail-open.
  [ -r "$FILE_PATH" ] || exit 0

  # Use node for the substitution. Node is robust against any UTF-8, newlines,
  # quotes, and backslashes in the strings (passed as argv, not interpolated).
  # Node is already an allowed bash pattern in this plugin's permissions.json.
  if ! command -v node &>/dev/null; then
    exit 0
  fi

  # node -e places user-args starting at argv[1] (no script-path slot),
  # so destructure with a single skip.
  CONTENT=$(node -e '
    const fs = require("node:fs");
    const [, path, oldStr, newStr, replaceAll] = process.argv;
    let content;
    try { content = fs.readFileSync(path, "utf8"); }
    catch { process.exit(0); }
    const out = replaceAll === "true"
      ? content.split(oldStr).join(newStr)
      : content.replace(oldStr, newStr);
    process.stdout.write(out);
  ' "$FILE_PATH" "$OLD_STRING" "$NEW_STRING" "$REPLACE_ALL" 2>/dev/null) || exit 0
else
  # ── Write tool: tool_input.content is the full file content verbatim ──
  if command -v jq &>/dev/null; then
    CONTENT=$(echo "$INPUT" | jq -r '.tool_input.content // ""')
  else
    # Fallback: extract content between quotes (limited but sufficient for frontmatter check)
    CONTENT=$(echo "$INPUT" | sed -n 's/.*"content"[[:space:]]*:[[:space:]]*"//p' | sed 's/"[[:space:]]*}.*$//')
  fi
fi

[ -z "$CONTENT" ] && exit 0

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
