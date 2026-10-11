#!/bin/bash
# SessionEnd: cleans up the screenshot runs (lt-showroom) the ending Claude session started,
# plus any run whose Claude process is already gone. A run interrupted mid-way (Ctrl-C, /clear,
# closed terminal) would otherwise leave its clone, `lt ticket` stack, Compose project and dev
# servers behind.
#
# SessionEnd hooks get 1.5 s in total, and a plugin hook's own `timeout` does not raise that
# budget, while stopping containers takes longer. So this hook only hands the work to a
# detached `screenshot-session.mjs sweep` and returns at once. The sweep touches nothing but
# what each run recorded in its session.json.
#
# Runs in headless sessions too: a `claude -p` run can start screenshots as well.

set -u

input="$(cat 2>/dev/null || true)"
work_root="${LT_SHOWROOM_HOME:-$HOME/.lt-showroom}"

# Nothing to do on the common path: no screenshot run has ever been started here.
compgen -G "$work_root/*/session.json" >/dev/null 2>&1 || exit 0
command -v node >/dev/null 2>&1 || exit 0

session_id="$(printf '%s' "$input" | sed -n 's/.*"session_id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)"
[ -n "$session_id" ] || session_id="${CLAUDE_CODE_SESSION_ID:-}"

plugin_root="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/../.." && pwd)}"
args=(sweep --detach)
[ -n "$session_id" ] && args+=(--session "$session_id")

node "$plugin_root/scripts/screenshot-session.mjs" "${args[@]}" >/dev/null 2>&1 || true
exit 0
