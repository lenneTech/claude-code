#!/bin/bash
# Skip in non-interactive headless mode (claude -p)
. "${0%/*}/_headless-skip.sh"

# Re-injects showroom context after conversation compaction so the creating-showcases
# and analyzing-projects skills remain discoverable when prior context has been summarized.

INPUT=$(cat)

# ── Extract cwd with jq fallback ──
if command -v jq >/dev/null 2>&1; then
  CWD=$(echo "$INPUT" | jq -r '.cwd // empty' 2>/dev/null)
else
  CWD=$(echo "$INPUT" | grep -o '"cwd"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"cwd"[[:space:]]*:[[:space:]]*"//;s/"$//')
fi
CWD="${CWD:-$PWD}"

CONTEXT=""

# Re-inject when inside the showroom platform itself
if [ -f "$CWD/projects/api/src/server/modules/showcase/showcase.service.ts" ] || \
   ([ -f "$CWD/package.json" ] && grep -q '"showroom"' "$CWD/package.json" 2>/dev/null); then
  CONTEXT="Showroom platform context (restored after compaction). Use creating-showcases for showcase content and MCP operations. Use analyzing-projects for project analysis features."
fi

# Also re-inject generic showcase context if a SHOWCASE.md was started in this project
if [ -z "$CONTEXT" ] && [ -f "$CWD/SHOWCASE.md" ]; then
  CONTEXT="SHOWCASE.md detected in this project (context restored after compaction). Use analyzing-projects and creating-showcases skills to continue working with the showcase."
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
