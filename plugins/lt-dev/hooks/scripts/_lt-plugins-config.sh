# Shared configuration + helpers for the lt-dev plugin auto-update hook.
# Sourced by update-lt-plugins.sh (frontend) and update-lt-plugins-background.sh.
# Not directly executable — no shebang, no top-level side effects.

LT_PLUGINS_STATE_DIR="${CLAUDE_PLUGIN_DATA:-$HOME/.claude/lt-dev}"
LT_PLUGINS_NOTIFICATION_FILE="$LT_PLUGINS_STATE_DIR/update-notification.txt"
LT_PLUGINS_LAST_RUN_FILE="$LT_PLUGINS_STATE_DIR/update-last-run"
LT_PLUGINS_LOCK_DIR="$LT_PLUGINS_STATE_DIR/update.lock.d"
LT_PLUGINS_LOG_FILE="$LT_PLUGINS_STATE_DIR/update.log"

LT_PLUGINS_THROTTLE_SECONDS=3600           # 1 hour between successful runs
LT_PLUGINS_RETRY_AFTER_FAILURE_SECONDS=300 # 5 min retry after a failed run
LT_PLUGINS_STALE_LOCK_SECONDS=600          # 10 min before a stale lock is reclaimed

lt_plugins_file_mtime() {
  stat -f %m "$1" 2>/dev/null || stat -c %Y "$1" 2>/dev/null || echo 0
}

# Read-only check: is a fresh lock currently held by a live process?
lt_plugins_lock_held() {
  [ -d "$LT_PLUGINS_LOCK_DIR" ] || return 1
  local pid age
  pid=$(cat "$LT_PLUGINS_LOCK_DIR/pid" 2>/dev/null || echo "")
  age=$(( $(date +%s) - $(lt_plugins_file_mtime "$LT_PLUGINS_LOCK_DIR") ))
  [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null \
    && [ "$age" -lt "$LT_PLUGINS_STALE_LOCK_SECONDS" ]
}

# Atomic lock acquisition via mkdir. Reclaims stale locks (dead PID or
# older than LT_PLUGINS_STALE_LOCK_SECONDS). Returns 0 on success, 1 if held.
lt_plugins_acquire_lock() {
  if mkdir "$LT_PLUGINS_LOCK_DIR" 2>/dev/null; then
    echo $$ > "$LT_PLUGINS_LOCK_DIR/pid"
    return 0
  fi
  if ! lt_plugins_lock_held; then
    rm -rf "$LT_PLUGINS_LOCK_DIR" 2>/dev/null
    if mkdir "$LT_PLUGINS_LOCK_DIR" 2>/dev/null; then
      echo $$ > "$LT_PLUGINS_LOCK_DIR/pid"
      return 0
    fi
  fi
  return 1
}

lt_plugins_release_lock() {
  rm -rf "$LT_PLUGINS_LOCK_DIR" 2>/dev/null || true
}

lt_plugins_mark_success() {
  date +%s > "$LT_PLUGINS_LAST_RUN_FILE"
}

# Push the timestamp into the past so the next session retries after
# LT_PLUGINS_RETRY_AFTER_FAILURE_SECONDS instead of waiting the full throttle.
lt_plugins_mark_failure() {
  echo $(( $(date +%s) - LT_PLUGINS_THROTTLE_SECONDS + LT_PLUGINS_RETRY_AFTER_FAILURE_SECONDS )) \
    > "$LT_PLUGINS_LAST_RUN_FILE"
}
