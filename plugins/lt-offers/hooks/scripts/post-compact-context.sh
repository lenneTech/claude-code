#!/bin/bash
# Skip in non-interactive headless mode (claude -p)
. "${0%/*}/_headless-skip.sh"

# Re-injects offers context after conversation compaction so the creating-offers
# skill remains discoverable when prior context has been summarized.

INPUT=$(cat)

# ── Extract cwd with jq fallback ──
if command -v jq >/dev/null 2>&1; then
  CWD=$(echo "$INPUT" | jq -r '.cwd // empty' 2>/dev/null)
else
  CWD=$(echo "$INPUT" | grep -o '"cwd"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"cwd"[[:space:]]*:[[:space:]]*"//;s/"$//')
fi
# Prefer the stable project root over the hook payload's cwd: the agent's working
# directory changes mid-session (see the CwdChanged event), so after a `cd projects/api`
# a check on "$CWD/projects/api/..." would look for projects/api/projects/api/... and
# miss. CLAUDE_PROJECT_DIR stays put; .cwd and PWD remain the fallbacks.
CWD="${CLAUDE_PROJECT_DIR:-${CWD:-$PWD}}"

CONTEXT=""

# Only re-inject when the current project is an offers workspace — avoids
# polluting unrelated sessions that happened to compact.
if [ -f "$CWD/projects/api/src/server/modules/offer/offer.service.ts" ] || \
   [ -f "$CWD/projects/app/app/interfaces/offer.interface.ts" ]; then
  CONTEXT="Offers project context (restored after compaction). Use the creating-offers skill for offer-related tasks. Two MCP servers available: \`offers-api\` (default → local override to http://localhost:3000/mcp via project .mcp.json, or production https://api.angebote.lenne.tech/mcp) and \`offers-api-demo\` (https://api.demo-angebote.lenne.tech/mcp — use only when the user mentions \"demo\")."
fi

if [ -n "$CONTEXT" ]; then
  if command -v jq >/dev/null 2>&1; then
    jq -n --arg ctx "$CONTEXT" '{hookSpecificOutput: {hookEventName: "PostCompact", additionalContext: $ctx}}'
  else
    escaped=$(printf '%s' "$CONTEXT" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')
    printf '{"hookSpecificOutput":{"hookEventName":"PostCompact","additionalContext":"%s"}}\n' "$escaped"
  fi
fi

exit 0
