#!/bin/bash
# PostToolUse hook: Reset circuit breaker counter on success
#
# When a tool succeeds, reset its failure counter.
# This implements the HALF_OPEN → CLOSED transition.
#
# Opt-out: CLAUDE_SKIP_CIRCUIT_BREAKER=1

[ "${CLAUDE_SKIP_CIRCUIT_BREAKER:-0}" = "1" ] && exit 0

INPUT=$(cat)

# ── Extract fields ──
if command -v jq &>/dev/null; then
  TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
  SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')
else
  TOOL_NAME=$(echo "$INPUT" | grep -o '"tool_name"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"tool_name"[[:space:]]*:[[:space:]]*"//;s/"$//')
  SESSION_ID=$(echo "$INPUT" | grep -o '"session_id"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"session_id"[[:space:]]*:[[:space:]]*"//;s/"$//')
fi

[ -z "$TOOL_NAME" ] && exit 0

# ── Reset counter for this tool ──
STATE_DIR="/tmp/.claude-circuit-breaker"
SESSION_KEY="${SESSION_ID:-$$}"
STATE_FILE="${STATE_DIR}/${SESSION_KEY}-${TOOL_NAME}"
ERROR_FILE="${STATE_DIR}/${SESSION_KEY}-${TOOL_NAME}-last-error"

rm -f "$STATE_FILE" "$ERROR_FILE" 2>/dev/null

exit 0
