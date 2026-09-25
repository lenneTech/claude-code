#!/bin/bash
# Skip in non-interactive headless mode (claude -p)
. "${0%/*}/_headless-skip.sh"

# Re-injects showroom context after conversation compaction so the creating-showcases
# and analyzing-projects skills remain discoverable when prior context has been summarized.
#
# Registered on SessionStart with matcher "compact", which fires after auto or manual
# compaction. PostCompact is the wrong event for this: it has no decision control and
# Claude Code sends its stdout only to the debug log, so context printed there never
# reaches Claude. SessionStart adds hookSpecificOutput.additionalContext to the context.

INPUT=$(cat)

# ── Extract source and cwd with jq fallback ──
if command -v jq >/dev/null 2>&1; then
  SOURCE=$(echo "$INPUT" | jq -r '.source // empty' 2>/dev/null)
  CWD=$(echo "$INPUT" | jq -r '.cwd // empty' 2>/dev/null)
else
  SOURCE=$(echo "$INPUT" | grep -o '"source"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"source"[[:space:]]*:[[:space:]]*"//;s/"$//')
  CWD=$(echo "$INPUT" | grep -o '"cwd"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"cwd"[[:space:]]*:[[:space:]]*"//;s/"$//')
fi

# The matcher already limits this hook to compaction; the check keeps a registration
# on startup/resume/clear from injecting "restored after compaction" text.
[ -n "$SOURCE" ] && [ "$SOURCE" != "compact" ] && exit 0

# Prefer the stable project root over the hook payload's cwd: the agent's working
# directory changes mid-session (see the CwdChanged event), so after a `cd projects/api`
# a check on "$CWD/projects/api/..." would look for projects/api/projects/api/... and
# miss. CLAUDE_PROJECT_DIR stays put; .cwd and PWD remain the fallbacks.
CWD="${CLAUDE_PROJECT_DIR:-${CWD:-$PWD}}"

CONTEXT=""

# Re-inject showcase context if a SHOWCASE.md was started in this project
if [ -f "$CWD/SHOWCASE.md" ]; then
  CONTEXT="SHOWCASE.md detected in this project (context restored after compaction). Use analyzing-projects and creating-showcases skills to continue working with the showcase."
fi

if [ -n "$CONTEXT" ]; then
  if command -v jq >/dev/null 2>&1; then
    jq -n --arg ctx "$CONTEXT" '{hookSpecificOutput: {hookEventName: "SessionStart", additionalContext: $ctx}}'
  else
    escaped=$(printf '%s' "$CONTEXT" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')
    printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}\n' "$escaped"
  fi
fi

exit 0
