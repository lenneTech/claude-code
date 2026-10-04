#!/usr/bin/env bash
# mongo-log-guard — keeps a Homebrew MongoDB log from growing without bound.
#
# Installed by disk-guards.sh as a daily LaunchAgent. mongod never rotates its own log, and test
# suites (one connection, index build and drop per run) fill it fast: one developer log reached
# 15 GB within nine months (observed 2026-10-02). Above the threshold this asks mongod to rotate
# (`logRotate` renames the file to mongo.log.<timestamp> and reopens a fresh one — no restart)
# and keeps only the newest rotated file for debugging.
#
# Usage: mongo-log-guard.sh [--dry-run] [--force]
# Env:   LT_MONGO_LOG_GUARD_THRESHOLD_MB (1024)

set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$HERE/lib/disk-common.sh"
export PATH="${LT_DISK_GUARD_PATH:-/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin}"

THRESHOLD_MB="${LT_MONGO_LOG_GUARD_THRESHOLD_MB:-1024}"
LOG="$HOME/Library/Logs/lt-dev-mongo-log-guard.log"

dry_run=0; force=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) dry_run=1 ;;
    --force) force=1 ;;
    *) echo "unknown argument: $arg" >&2; exit 2 ;;
  esac
done

log() {
  local line; line="$(date '+%Y-%m-%d %H:%M:%S') $*"
  echo "$line"
  [ "$dry_run" = 1 ] && return 0
  mkdir -p "$(dirname "$LOG")"; echo "$line" >> "$LOG"
  if [ "$(wc -l < "$LOG" | tr -d ' ')" -gt 500 ]; then tail -n 300 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"; fi
}

current=""
for c in "${LT_MONGO_LOG_PATH:-}" /opt/homebrew/var/log/mongodb/mongo.log /usr/local/var/log/mongodb/mongo.log; do
  [ -n "$c" ] && [ -f "$c" ] && { current="$c"; break; }
done
[ -n "$current" ] || { log "no MongoDB log found — nothing to do"; exit 0; }

mb=$(size_mb "$current")
if [ "$force" = 0 ] && [ "$mb" -lt "$THRESHOLD_MB" ]; then log "$(basename "$current") ${mb} MB < ${THRESHOLD_MB} MB — nothing to do"; exit 0; fi
[ "$dry_run" = 1 ] && { log "$(basename "$current") ${mb} MB — would rotate and keep only the newest rotated file"; exit 0; }

if ! mongosh --quiet --eval 'quit(db.adminCommand({ logRotate: 1 }).ok === 1 ? 0 : 1)' >/dev/null 2>&1; then
  log "$(basename "$current") ${mb} MB — logRotate failed (mongod not running?), nothing changed"; exit 0
fi
log "$(basename "$current") ${mb} MB — rotated"
ls -t "$current".* 2>/dev/null | tail -n +2 | while IFS= read -r old; do
  if lsof "$old" >/dev/null 2>&1; then log "  kept (still open): $(basename "$old")"
  else rm -f "$old" && log "  deleted: $(basename "$old")"; fi
done
