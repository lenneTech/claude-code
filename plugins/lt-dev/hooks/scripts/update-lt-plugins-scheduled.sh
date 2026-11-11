#!/bin/bash
# Twice-a-day plugin update for machines whose sessions stay open: the lt-dev hooks module
# (hooks/plugin-updates.js) starts this from a running interactive session once the last
# update is LT_PLUGINS_SCHEDULE_SECONDS old. It re-checks schedule and lock, starts
# update-lt-plugins-background.sh detached (same lock, state and notification as the
# SessionStart updater) and returns at once. Every session then reloads the installed
# versions on its own.

# Same opt-outs as the SessionStart hooks (LT_PLUGIN_HOOKS_SKIP, `claude -p`).
. "${0%/*}/_headless-skip.sh"

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=_lt-plugins-config.sh
. "$SCRIPT_DIR/_lt-plugins-config.sh"

mkdir -p "$LT_PLUGINS_STATE_DIR" 2>/dev/null || exit 0

last=$(cat "$LT_PLUGINS_LAST_RUN_FILE" 2>/dev/null || echo 0)
case "$last" in ''|*[!0-9]*) last=0 ;; esac
if [ $(( $(date +%s) - last )) -lt "$LT_PLUGINS_SCHEDULE_SECONDS" ]; then
  exit 0
fi

if lt_plugins_lock_held; then
  exit 0
fi

nohup bash "$SCRIPT_DIR/update-lt-plugins-background.sh" >/dev/null 2>&1 &
disown 2>/dev/null || true
exit 0
