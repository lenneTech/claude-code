#!/bin/bash
# Skip in non-interactive headless mode (claude -p)
. "${0%/*}/_headless-skip.sh"

# Detects if the current project is the showroom platform, injecting skill context accordingly.

INPUT=$(cat)

# ── Extract prompt and cwd with jq fallback ──
if command -v jq >/dev/null 2>&1; then
  PROMPT=$(echo "$INPUT" | jq -r '.prompt // .user_prompt // empty' 2>/dev/null)
  CWD=$(echo "$INPUT" | jq -r '.cwd // empty' 2>/dev/null)
else
  PROMPT=$(echo "$INPUT" | grep -o '"prompt"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"prompt"[[:space:]]*:[[:space:]]*"//;s/"$//')
  CWD=$(echo "$INPUT" | grep -o '"cwd"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"cwd"[[:space:]]*:[[:space:]]*"//;s/"$//')
fi

# Fallback to CLAUDE_USER_PROMPT env var and PWD
PROMPT="${PROMPT:-${CLAUDE_USER_PROMPT:-}}"
CWD="${CWD:-$PWD}"

# Keyword guard: only run filesystem checks when prompt is showroom-related
PROMPT_LOWER=$(echo "$PROMPT" | tr '[:upper:]' '[:lower:]')
if ! echo "$PROMPT_LOWER" | grep -qE '(showroom|showcase|portfolio)'; then
  exit 0
fi

CONTEXT=""

# Check if we're inside the showroom project (monorepo or standalone)
if [ -f "$CWD/projects/api/src/server/modules/showcase/showcase.service.ts" ] || \
   ([ -f "$CWD/package.json" ] && grep -q '"showroom"' "$CWD/package.json" 2>/dev/null); then
  CONTEXT="Showroom project detected (local development). The project-level .mcp.json overrides showroom-api to http://localhost:3000/mcp — MCP tools will use the local API server. Use the creating-showcases skill for showcase content tasks and MCP operations. Use the analyzing-projects skill for project analysis features."
fi

if [ -n "$CONTEXT" ]; then
  if command -v jq >/dev/null 2>&1; then
    jq -n --arg ctx "$CONTEXT" '{hookSpecificOutput: {hookEventName: "UserPromptSubmit", additionalContext: $ctx}}'
  else
    escaped=$(printf '%s' "$CONTEXT" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')
    printf '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"%s"}}\n' "$escaped"
  fi
fi

exit 0
