#!/bin/bash
# StopFailure / SessionEnd hook: clear THIS session's circuit-breaker state.
#
# The breaker keys its state files as "${SESSION_ID}-${TOOL_NAME}" (see
# circuit-breaker.sh), so cleanup has to be keyed the same way. A wildcard
# delete over the whole state directory would reach into every other
# concurrently running session — and parallel sessions are normal here
# (ticket worktrees, `lt dev test`, several Claude Code instances at once),
# so one session hitting an API error would silently reset everyone else's
# in-progress failure counters.
#
# Deletes this session's files only. Missing files, an unreadable payload,
# or an absent state directory are all fine: exit 0 either way, since a
# cleanup hook must never interfere with the session it runs in.

INPUT=$(cat 2>/dev/null || echo '')

if command -v jq &>/dev/null; then
  SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty' 2>/dev/null)
else
  SESSION_ID=$(echo "$INPUT" | grep -o '"session_id"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"session_id"[[:space:]]*:[[:space:]]*"//;s/"$//')
fi

STATE_DIR="/tmp/.claude-circuit-breaker"

# Without a session id there is no safe target: a wildcard here is exactly the
# cross-session wipe this script exists to prevent. Leave the state alone; the
# files are tiny and the next successful call resets the counter anyway.
[ -z "$SESSION_ID" ] && exit 0
[ -d "$STATE_DIR" ] || exit 0

rm -f "${STATE_DIR:?}/${SESSION_ID}"-* 2>/dev/null

exit 0
