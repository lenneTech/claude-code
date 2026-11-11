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

# `source` decides what the notice may say about this session: only a fresh process
# (`startup`) loaded the installed versions. `/clear` and an in-session `/resume` fire this
# hook too and keep the versions the session started with.
. "${0%/*}/_read-stdin.sh"
read_hook_input 2
SOURCE=""
if command -v jq >/dev/null 2>&1; then
  SOURCE=$(printf '%s' "$HOOK_INPUT" | jq -r '.source // ""' 2>/dev/null)
else
  SOURCE=$(printf '%s' "$HOOK_INPUT" | grep -o '"source"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"source"[[:space:]]*:[[:space:]]*"//;s/"$//')
fi

emit_context() {
  local body instruction full this_en this_de
  if [ "$SOURCE" = "startup" ]; then
    this_en="This session started after the update and already runs the new versions"
    this_de="Diese Session nutzt sie bereits."
  else
    this_en="This session may still run the versions it started with (a /clear or an in-session /resume keeps them); if so, it reloads them on its own within ten minutes"
    this_de="Falls diese Session noch die alten Versionen nutzt, lädt sie sie innerhalb von zehn Minuten selbst neu, sonst hilft \`/reload-plugins\`."
  fi
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

The lt-dev background updater installed newer versions of the Claude Code plugins listed above. The user does not know about the update yet. @THIS_EN@. Other running interactive sessions reload them on their own within ten minutes (the lt-dev hooks module).

So that the user learns about the update before the work starts, the first reply of this session begins with a short info block in German (German whatever the conversation language, because this notice has one fixed wording for the whole team):

   ---
   ℹ️ **lt-dev Auto-Update**

   Folgende Claude Code Plugins wurden aktualisiert:
   - <plugin name>: <alte version> → <neue version>
   - …

   @THIS_DE@ Andere laufende Sessions laden sie innerhalb von zehn Minuten selbst neu, sonst hilft dort `/reload-plugins`.
   ---

   The list items are the lines above, copied as they stand: each line is one plugin, already paired (`name@owner: old → new`, `neu installiert`, `entfernt`), and a final `… weitere` line counts plugins left out.

After the info block, continue with the user's request as usual.
EOF
  instruction=${instruction//@THIS_EN@/$this_en}
  instruction=${instruction//@THIS_DE@/$this_de}
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
