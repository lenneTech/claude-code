#!/bin/bash
# Skip in non-interactive headless mode (claude -p)
. "${0%/*}/_headless-skip.sh"

# SessionStart hook: surface any pending lt-plugin update notification and
# fire a detached background updater. Must stay fast (<1s) — heavy lifting
# is done by update-lt-plugins-background.sh.

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=_lt-plugins-config.sh
. "$SCRIPT_DIR/_lt-plugins-config.sh"

mkdir -p "$LT_PLUGINS_STATE_DIR" 2>/dev/null || exit 0

emit_context() {
  local body instruction full
  body=$(cat "$LT_PLUGINS_NOTIFICATION_FILE")
  rm -f "$LT_PLUGINS_NOTIFICATION_FILE"
  # Factual wording at normal volume: additionalContext framed as an out-of-band system
  # command ("ACTION REQUIRED ... you MUST") can trigger Claude's prompt-injection
  # defenses, and Claude then shows the text to the user instead of acting on it
  # (hooks reference, "Add context for Claude"). `read` from a heredoc rather than
  # $(cat <<'EOF'): bash 3.2 parses quotes inside a heredoc nested in $(...), so a single
  # apostrophe in the text is a syntax error there.
  IFS= read -r -d '' instruction <<'EOF' || true
lt-dev plugin auto-update report

The lt-dev background updater installed newer versions of the Claude Code plugins listed above. The user does not know about the update yet, and the new versions become active in this session only after a plugin reload.

So that the user learns about the update before the work starts, the first reply of this session begins with a short info block in German (German whatever the conversation language, because this notice has one fixed wording for the whole team):

   ---
   ℹ️ **lt-dev Auto-Update**

   Folgende Claude Code Plugins wurden aktualisiert:
   - <plugin name>: <alte version> → <neue version>
   - …

   Tippe `/reload-plugins` ein, damit sie in dieser Session aktiv werden. Neue Sessions starten direkt mit den neuen Versionen.
   ---

   The list items are the lines above, copied as they stand: each line is one plugin, already paired (`name@owner: old → new`, `neu installiert`, `entfernt`), and a final `… weitere` line counts plugins left out.

Claude cannot run `/reload-plugins` itself: the Skill tool reaches only a few built-in commands, and this is not one of them, so the info block asks the user to type it. After the info block, continue with the user's request as usual.
EOF
  full=$(printf '%s\n\n%s\n' "$body" "$instruction")
  if command -v jq >/dev/null 2>&1; then
    jq -n --arg ctx "$full" '{
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext: $ctx
      }
    }'
  else
    # Fallback: stdout becomes additional context for SessionStart hooks.
    printf '%s\n' "$full"
  fi
}

if [ -s "$LT_PLUGINS_NOTIFICATION_FILE" ]; then
  emit_context
fi

if [ -f "$LT_PLUGINS_LAST_RUN_FILE" ]; then
  last=$(cat "$LT_PLUGINS_LAST_RUN_FILE" 2>/dev/null || echo 0)
  now=$(date +%s)
  if [ "$last" -gt 0 ] && [ $((now - last)) -lt "$LT_PLUGINS_THROTTLE_SECONDS" ]; then
    exit 0
  fi
fi

if lt_plugins_lock_held; then
  exit 0
fi

BG_SCRIPT="${CLAUDE_PLUGIN_ROOT:-}/hooks/scripts/update-lt-plugins-background.sh"
if [ -n "${CLAUDE_PLUGIN_ROOT:-}" ] && [ -f "$BG_SCRIPT" ]; then
  nohup bash "$BG_SCRIPT" >/dev/null 2>&1 &
  disown 2>/dev/null || true
fi

exit 0
