#!/bin/bash
# Skip in non-interactive headless mode (claude -p)
. "${0%/*}/_headless-skip.sh"

# SessionStart in Claude Desktop: after a switch of Claude accounts, the sessions of the previous account are
# missing from the sidebar. When a session of another account was active within the window, this names them once
# as context, so the session can offer /lt-dev:desktop-sessions to bring them over.
#
# The hook runs at the start of every Desktop session, so every way out before Node is plain shell: no Desktop
# session (CLAUDE_CODE_ENTRYPOINT is set to claude-desktop there, and written into every Desktop transcript), no
# Desktop data, no second account, or no session file of another account touched within the window. Only then does
# scripts/desktop-sessions.mjs decide exactly, and it stays silent for sessions it already named.
#
# From config.json only the lastKnownAccountUuid key is read; the file also holds OAuth token caches.

[ "${CLAUDE_CODE_ENTRYPOINT:-}" = "claude-desktop" ] || exit 0

APP="${LT_DESKTOP_APP_DIR:-}"
if [ -z "$APP" ]; then
  case "$(uname -s 2>/dev/null)" in
    Darwin) APP="$HOME/Library/Application Support/Claude" ;;
    MINGW* | MSYS* | CYGWIN*) [ -n "${APPDATA:-}" ] && APP="$APPDATA/Claude" ;;
  esac
fi
[ -n "$APP" ] && [ -d "$APP/claude-code-sessions" ] || exit 0

ACTIVE="$(grep -o '"lastKnownAccountUuid"[[:space:]]*:[[:space:]]*"[^"]*"' "$APP/config.json" 2>/dev/null |
  head -n 1 | sed 's/.*"\([^"]*\)"$/\1/')"
[ -n "$ACTIVE" ] || exit 0

DAYS="${LT_DESKTOP_SESSIONS_DAYS:-7}"
recent=""
for account in "$APP/claude-code-sessions"/*/; do
  [ -d "$account" ] || continue
  [ "$(basename "$account")" = "$ACTIVE" ] && continue
  recent="$(find "$account" -maxdepth 2 -name 'local_*.json' -mtime "-$DAYS" -print 2>/dev/null | head -n 1)"
  [ -n "$recent" ] && break
done
[ -n "$recent" ] || exit 0

command -v node >/dev/null 2>&1 || exit 0
exec node "${0%/*}/../../scripts/desktop-sessions.mjs" hook --days "$DAYS"
