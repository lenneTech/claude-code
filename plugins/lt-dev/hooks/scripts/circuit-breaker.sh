#!/bin/bash
# PostToolUseFailure hook: Circuit breaker for repeated failures
#
# Inspired by Ralph's circuit breaker pattern (frankbria/ralph-claude-code).
# Tracks consecutive tool failures and injects corrective guidance when
# Claude appears stuck in a failure loop.
#
# States (Michael Nygard's "Release It!" pattern):
# - CLOSED:    Normal operation (< THRESHOLD failures)
# - HALF_OPEN: Warning injected, monitoring (= THRESHOLD failures)
# - OPEN:      Hard stop, force different approach (> THRESHOLD * 2 failures)
#
# Opt-out: CLAUDE_SKIP_CIRCUIT_BREAKER=1
# Configure: CLAUDE_CB_THRESHOLD (default: 3)

[ "${CLAUDE_SKIP_CIRCUIT_BREAKER:-0}" = "1" ] && exit 0

INPUT=$(cat)

# ── Extract fields from JSON input ──
if command -v jq &>/dev/null; then
  TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
  ERROR=$(echo "$INPUT" | jq -r '.error // empty')
  SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')
  AGENT_TYPE=$(echo "$INPUT" | jq -r '.agent_type // empty')
else
  TOOL_NAME=$(echo "$INPUT" | grep -o '"tool_name"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"tool_name"[[:space:]]*:[[:space:]]*"//;s/"$//')
  ERROR=$(echo "$INPUT" | grep -o '"error"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"error"[[:space:]]*:[[:space:]]*"//;s/"$//')
  SESSION_ID=$(echo "$INPUT" | grep -o '"session_id"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"session_id"[[:space:]]*:[[:space:]]*"//;s/"$//')
  AGENT_TYPE=$(echo "$INPUT" | grep -o '"agent_type"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"agent_type"[[:space:]]*:[[:space:]]*"//;s/"$//')
fi

[ -z "$TOOL_NAME" ] && exit 0

# ── Configuration ──
THRESHOLD="${CLAUDE_CB_THRESHOLD:-3}"
HARD_LIMIT=$((THRESHOLD * 2))

# ── State directory ──
STATE_DIR="/tmp/.claude-circuit-breaker"
mkdir -p "$STATE_DIR" 2>/dev/null

# Session-scoped state key
SESSION_KEY="${SESSION_ID:-$$}"
STATE_FILE="${STATE_DIR}/${SESSION_KEY}-${TOOL_NAME}"
ERROR_FILE="${STATE_DIR}/${SESSION_KEY}-${TOOL_NAME}-last-error"

# ── Track failure count ──
FAIL_COUNT=0
[ -f "$STATE_FILE" ] && FAIL_COUNT=$(cat "$STATE_FILE" 2>/dev/null || echo "0")
FAIL_COUNT=$((FAIL_COUNT + 1))
echo "$FAIL_COUNT" > "$STATE_FILE"

# ── Track error similarity (detect same-error loops) ──
SAME_ERROR=false
if [ -f "$ERROR_FILE" ]; then
  LAST_ERROR=$(cat "$ERROR_FILE" 2>/dev/null)
  # Normalize errors for comparison (strip line numbers, paths, timestamps)
  NORM_CURRENT=$(echo "$ERROR" | sed -E 's/[0-9]+/N/g; s|/[^ ]+||g' | head -c 200)
  NORM_LAST=$(echo "$LAST_ERROR" | sed -E 's/[0-9]+/N/g; s|/[^ ]+||g' | head -c 200)
  [ "$NORM_CURRENT" = "$NORM_LAST" ] && SAME_ERROR=true
fi
echo "$ERROR" > "$ERROR_FILE"

# ── JSON output helper ──
emit_context() {
  local context="$1"
  if command -v jq &>/dev/null; then
    jq -n --arg ctx "$context" '{"hookSpecificOutput":{"hookEventName":"PostToolUseFailure","additionalContext":$ctx}}'
  else
    local escaped
    escaped=$(printf '%s' "$context" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e ':a' -e 'N' -e '$!ba' -e 's/\n/\\n/g' -e 's/\t/\\t/g')
    printf '{"hookSpecificOutput":{"hookEventName":"PostToolUseFailure","additionalContext":"%s"}}\n' "$escaped"
  fi
}

# ── CLOSED state: normal operation ──
if [ "$FAIL_COUNT" -lt "$THRESHOLD" ]; then
  # If same error repeating, count faster (treat 2 same errors as threshold)
  if [ "$SAME_ERROR" = true ] && [ "$FAIL_COUNT" -ge 2 ]; then
    emit_context "[Circuit Breaker WARNING] Same error detected ${FAIL_COUNT} times for ${TOOL_NAME}. The identical error is repeating — try a fundamentally different approach instead of retrying the same strategy. Consider: (1) reading error messages carefully, (2) checking file/module existence, (3) using a different tool or method."
    exit 0
  fi
  exit 0
fi

# ── HALF_OPEN state: warning threshold reached ──
if [ "$FAIL_COUNT" -eq "$THRESHOLD" ]; then
  CONTEXT="[Circuit Breaker HALF_OPEN] ${TOOL_NAME} has failed ${FAIL_COUNT} consecutive times."
  if [ "$SAME_ERROR" = true ]; then
    CONTEXT="${CONTEXT} The SAME error keeps repeating. STOP retrying the same approach."
  fi
  CONTEXT="${CONTEXT} You MUST change your strategy now. Steps: (1) Re-read the error message carefully. (2) Check your assumptions — does the file/path/module exist? (3) Try a completely different approach. (4) If stuck, ask the user for help."
  emit_context "$CONTEXT"
  exit 0
fi

# ── OPEN state: hard limit, force stop ──
if [ "$FAIL_COUNT" -ge "$HARD_LIMIT" ]; then
  # Use continue:false to force Claude to stop entirely
  if command -v jq &>/dev/null; then
    jq -n --arg reason "Circuit breaker OPEN: ${TOOL_NAME} has failed ${FAIL_COUNT} consecutive times. Stopping to prevent infinite failure loop. Please ask the user for help or take a completely different approach." \
      '{"continue":false,"stopReason":$reason,"systemMessage":"Circuit breaker triggered — agent stuck in failure loop"}'
  else
    printf '{"continue":false,"stopReason":"Circuit breaker OPEN: %s has failed %d consecutive times.","systemMessage":"Circuit breaker triggered"}\n' "$TOOL_NAME" "$FAIL_COUNT"
  fi
  # Reset counter after hard stop
  rm -f "$STATE_FILE" "$ERROR_FILE"
  exit 0
fi

# ── Between THRESHOLD and HARD_LIMIT: escalating warnings ──
CONTEXT="[Circuit Breaker WARNING] ${TOOL_NAME} has now failed ${FAIL_COUNT}/${HARD_LIMIT} times. Circuit breaker will FORCE STOP at ${HARD_LIMIT} failures. You MUST try a different approach immediately."
emit_context "$CONTEXT"
exit 0
