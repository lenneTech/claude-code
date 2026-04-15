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
  instruction=$(cat <<'EOF'
ACTION REQUIRED — lt-dev plugin auto-update report.

The lt-dev background updater detected new plugin versions and applied them. Before processing the user's request, you MUST do BOTH of the following, in this exact order:

1. Output a short German info block to the user (always in German, regardless of conversation language). Use this exact format:

   ---
   ℹ️ **lt-dev Auto-Update**

   Folgende Claude Code Plugins wurden aktualisiert:
   - <plugin name>: <alte version> → <neue version>
   - …

   Sie stehen nach dem nächsten Befehl bzw. nach Aufruf von `/reload-plugins` zur Verfügung.
   ---

   Parse the plugin list from the report above. Each diff line looks like
   `< <name>@<owner> <version> <sha>` (removed) or `> <name>@<owner> <version> <sha>` (added).
   Pair removed/added entries by `<name>@<owner>` and render them as `name: oldVersion → newVersion`. If a plugin only has an added line (fresh install), render it as `name: neu installiert (version)`.

2. Then invoke the slash command `/reload-plugins` so the updated plugins become active in the CURRENT session — the user does NOT need to restart Claude Code.

After both steps are done, continue with the user's original request normally.
EOF
)
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
