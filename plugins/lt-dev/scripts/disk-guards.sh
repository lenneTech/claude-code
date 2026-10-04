#!/usr/bin/env bash
# disk-guards.sh — installs, reports and removes the daily disk guards (macOS LaunchAgents).
#
#   pnpm-store-guard  prunes the pnpm store above 15 GB, at most every 14 days
#   mongo-log-guard   rotates a Homebrew MongoDB log above 1 GB (only installed when one exists)
#
# The guard scripts are COPIED to ~/.local/share/lt-dev/guards, together with the two libraries
# they source. A LaunchAgent must not point into the plugin cache: its path contains the plugin
# version and disappears on the next plugin update, after which the agent would fail silently
# every day. Re-run `install` after a plugin update to refresh the copies.
#
# Usage: disk-guards.sh install|status|uninstall [--dry-run]
# Env:   LT_DISK_GUARD_HOUR (13) — hour of the daily run; a run missed during sleep fires on wake

set -uo pipefail
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST="$HOME/.local/share/lt-dev/guards"
AGENTS="$HOME/Library/LaunchAgents"
HOUR="${LT_DISK_GUARD_HOUR:-13}"
GUARDS="pnpm-store-guard mongo-log-guard"

action="${1:-status}"
dry_run=0; [ "${2:-}" = "--dry-run" ] && dry_run=1

if [ "$(uname)" != "Darwin" ]; then
  echo "disk guards use launchd and are macOS-only; on Linux run the guard scripts from a systemd user timer"
  [ "$action" = status ] && exit 0 || exit 2
fi

label() { echo "tech.lenne.lt-dev.$1"; }
plist() { echo "$AGENTS/$(label "$1").plist"; }

applies() {  # applies <guard> — whether the guard has anything to watch on this machine
  case "$1" in
    mongo-log-guard) [ -f /opt/homebrew/var/log/mongodb/mongo.log ] || [ -f /usr/local/var/log/mongodb/mongo.log ] ;;
    *) return 0 ;;
  esac
}

write_plist() {  # write_plist <guard> <minute>
  cat > "$(plist "$1")" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$(label "$1")</string>
  <key>ProgramArguments</key>
  <array><string>/bin/bash</string><string>$DEST/$1.sh</string></array>
  <key>StartCalendarInterval</key>
  <dict><key>Hour</key><integer>$HOUR</integer><key>Minute</key><integer>$2</integer></dict>
  <key>StandardErrorPath</key><string>$HOME/Library/Logs/lt-dev-$1.err.log</string>
  <key>ProcessType</key><string>Background</string>
  <key>LowPriorityIO</key><true/>
  <key>Nice</key><integer>10</integer>
</dict>
</plist>
EOF
}

status() {
  local g state last
  for g in $GUARDS; do
    if [ ! -f "$(plist "$g")" ]; then
      state="not installed"; applies "$g" || state="not installed (nothing to watch on this machine)"
    elif launchctl print "gui/$(id -u)/$(label "$g")" >/dev/null 2>&1; then state="active"
    else state="installed but not loaded"; fi
    last="$(tail -n 1 "$HOME/Library/Logs/lt-dev-$g.log" 2>/dev/null)"
    printf '%s\t%s\t%s\n' "$g" "$state" "${last:--}"
  done
}

case "$action" in
  install)
    [ "$dry_run" = 1 ] && { echo "would copy guards to ${DEST/#$HOME/~} and load: $GUARDS"; exit 0; }
    mkdir -p "$DEST/lib" "$AGENTS"
    cp "$SRC/lib/disk-common.sh" "$SRC/lib/ensure-node-path.sh" "$DEST/lib/"
    minute=0
    for g in $GUARDS; do
      if ! applies "$g"; then minute=$((minute + 5)); continue; fi
      cp "$SRC/guards/$g.sh" "$DEST/$g.sh"; chmod +x "$DEST/$g.sh"
      write_plist "$g" "$minute"
      launchctl bootout "gui/$(id -u)/$(label "$g")" >/dev/null 2>&1 || true
      launchctl bootstrap "gui/$(id -u)" "$(plist "$g")" || echo "failed to load $(label "$g")" >&2
      minute=$((minute + 5))
    done
    status ;;
  uninstall)
    for g in $GUARDS; do
      [ "$dry_run" = 1 ] && { echo "would unload and remove $(label "$g")"; continue; }
      launchctl bootout "gui/$(id -u)/$(label "$g")" >/dev/null 2>&1 || true
      rm -f "$(plist "$g")"
    done
    [ "$dry_run" = 1 ] || rm -rf "$DEST"
    status ;;
  status) status ;;
  *) echo "usage: disk-guards.sh install|status|uninstall [--dry-run]" >&2; exit 2 ;;
esac
