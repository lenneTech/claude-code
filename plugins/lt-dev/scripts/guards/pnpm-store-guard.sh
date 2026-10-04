#!/usr/bin/env bash
# pnpm-store-guard — keeps the global pnpm store from growing without bound.
#
# Installed by disk-guards.sh as a daily LaunchAgent. Prunes only when the store is past a size
# threshold, at most once per MIN_DAYS, and never while a pnpm install writes to the store.
#
# Why a threshold and not a schedule: on APFS pnpm imports packages into node_modules as clones,
# so every store file has a link count of 1 — and `pnpm store prune` deletes every file with
# link count 1. A prune therefore EMPTIES the store. Existing node_modules keep working (clones
# are independent files), but every project downloads again on its next install, so pruning
# only when the store is big keeps that cost rare.
#
# Store generations: pnpm 10 writes store/v10, pnpm 11 store/v11. The active generation is
# pruned with `pnpm store prune`; an OLDER one is removed outright (equivalent here) unless it
# holds a global virtual store (links/), whose symlinks only its own pnpm can resolve. A newer
# generation is never touched — that happens when an older pnpm wins on PATH.
#
# Usage: pnpm-store-guard.sh [--dry-run] [--force]
# Env:   LT_PNPM_STORE_GUARD_THRESHOLD_GB (15) or LT_PNPM_STORE_GUARD_THRESHOLD_MB (finer, wins),
#        LT_PNPM_STORE_GUARD_MIN_DAYS (14)

set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$HERE/lib/disk-common.sh"
. "$HERE/lib/ensure-node-path.sh"
# launchd starts with a bare PATH; resolve Node/pnpm the way the plugin's other scripts do.
export PATH="${LT_DISK_GUARD_PATH:-/usr/bin:/bin:/usr/sbin:/sbin}"
ensure_node_on_path >/dev/null 2>&1 || true

THRESHOLD_GB="${LT_PNPM_STORE_GUARD_THRESHOLD_GB:-15}"
THRESHOLD_MB="${LT_PNPM_STORE_GUARD_THRESHOLD_MB:-$((THRESHOLD_GB * 1024))}"
MIN_DAYS="${LT_PNPM_STORE_GUARD_MIN_DAYS:-14}"
STAMP="$HOME/.local/state/lt-dev/pnpm-store-guard.last-prune"
LOG="$HOME/Library/Logs/lt-dev-pnpm-store-guard.log"

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

command -v pnpm >/dev/null 2>&1 || { log "pnpm not found — nothing to do"; exit 0; }
root="$(pnpm_store_root)"
[ -d "$root" ] || { log "no store at $(tilde "$root") — nothing to do"; exit 0; }

total_mb=$(size_mb "$root")
if [ "$force" = 0 ] && [ "$total_mb" -le "$THRESHOLD_MB" ]; then
  log "store ${total_mb} MB <= ${THRESHOLD_MB} MB — nothing to do"; exit 0
fi
if [ "$force" = 0 ] && [ -f "$STAMP" ]; then
  age=$(( ($(date +%s) - $(mtime_of "$STAMP")) / 86400 ))
  [ "$age" -lt "$MIN_DAYS" ] && { log "store ${total_mb} MB, last prune ${age} d ago (< ${MIN_DAYS} d) — skipped"; exit 0; }
fi
writers="$(store_writers)"
if [ -n "$writers" ]; then
  log "store ${total_mb} MB — skipped, pnpm is writing to the store:"
  printf '%s\n' "$writers" | cut -c1-160 | while IFS= read -r l; do log "    $l"; done
  exit 0
fi

active="$(pnpm_active_generation)"
log "store ${total_mb} MB — pruning (pnpm $(cd "$HOME" && pnpm --version), active $active)"
for d in "$root"/v*; do
  [ -d "$d" ] || continue
  g="$(basename "$d")"
  if [ "$g" = "$active" ]; then
    if [ "$dry_run" = 1 ]; then log "  $g: would run pnpm store prune"
    else (cd "$HOME" && pnpm store prune 2>&1) | { grep -E '^Removed [0-9]' || true; } | while IFS= read -r l; do log "  $g: $l"; done; fi
  elif [ -d "$d/links" ]; then
    log "  $g: holds a global virtual store — left alone"
  elif [ "${g#v}" -lt "${active#v}" ] 2>/dev/null; then
    if [ "$dry_run" = 1 ]; then log "  $g: would be removed"; else rm -rf "$d" && log "  $g: removed"; fi
  else
    log "  $g: newer than the active generation — left alone"
  fi
done

[ "$dry_run" = 1 ] && exit 0
mkdir -p "$(dirname "$STAMP")"; touch "$STAMP"
after_mb=$(size_mb "$root")
log "done: ${total_mb} MB -> ${after_mb} MB"
osascript -e "display notification \"${total_mb} MB -> ${after_mb} MB. The next install per project downloads again.\" with title \"pnpm store pruned\"" >/dev/null 2>&1 || true
