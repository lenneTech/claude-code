#!/usr/bin/env bash
# docker-image-guard — removes the Docker images pulled from a registry that no container uses.
#
# Installed by disk-guards.sh as a daily LaunchAgent that acts at most once per MIN_DAYS (7): a
# week missed while Docker was off or busy is made up the next day. An image is removed only when
#   - it came from a registry, so the next pull brings it back (docker_pulled_unused in
#     lib/disk-common.sh says how a pull is told apart from a local build), and
#   - no container references it, running or stopped.
# A locally built image is never removed: it can be the only copy of a build.
#
# Why images and why weekly: compose stacks, CI reproductions and test suites pull images that
# nothing removes. After a cleanup of 55 images (35 GB) on one developer Mac, 9 images (6.3 GB)
# were back within a day (observed 2026-11-03).
#
# Not `docker image prune -a --filter until=…`: `until` compares the image's CREATION time, not
# its last use, so a base image built months ago and pulled yesterday reads as old. And
# `prune -a` removes local builds as well.
#
# Skipped, and retried the next day, while Docker is not running or while something pulls,
# builds or creates: a pull, a build, `compose up/run/create`, `docker run/create`,
# `gitlab-runner exec`, `act`, or a live Testcontainers session (which talks to the API, not
# the CLI). Removing an image a pull has just fetched, before its container exists, breaks that
# run. `docker image rm` runs without --force, so an image a container started using after the
# check is refused, not removed.
#
# Usage: docker-image-guard.sh [--dry-run] [--force]
# Env:   LT_DOCKER_IMAGE_GUARD_MIN_DAYS (7)

set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$HERE/lib/disk-common.sh"
# launchd starts with a bare PATH; Docker Desktop links its CLI into one of these.
export PATH="${LT_DISK_GUARD_PATH:-$HOME/.docker/bin:/usr/local/bin:/opt/homebrew/bin:/Applications/Docker.app/Contents/Resources/bin:/usr/bin:/bin:/usr/sbin:/sbin}"

MIN_DAYS="${LT_DOCKER_IMAGE_GUARD_MIN_DAYS:-7}"
STAMP="$HOME/.local/state/lt-dev/docker-image-guard.last-run"
LOG="$HOME/Library/Logs/lt-dev-docker-image-guard.log"

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

command -v docker >/dev/null 2>&1 || { log "docker not found — nothing to do"; exit 0; }
if [ "$force" = 0 ] && [ -f "$STAMP" ]; then
  age=$(( ($(date +%s) - $(mtime_of "$STAMP")) / 86400 ))
  [ "$age" -lt "$MIN_DAYS" ] && { log "last run ${age} d ago (< ${MIN_DAYS} d) — skipped"; exit 0; }
fi
docker info >/dev/null 2>&1 || { log "Docker is not running — skipped, retried on the next run"; exit 0; }

busy="$(docker_busy)"
tc="$(docker ps -q --filter label=org.testcontainers=true 2>/dev/null)"
[ -n "$tc" ] && busy="${busy:+$busy
}Testcontainers session ($(printf '%s\n' "$tc" | wc -l | tr -d ' ') containers)"
if [ -n "$busy" ]; then
  log "skipped, Docker is pulling, building or creating:"
  printf '%s\n' "$busy" | cut -c1-160 | while IFS= read -r l; do log "    $l"; done
  exit 0
fi

rows="$(docker_pulled_unused)"
if [ -z "$rows" ]; then
  log "no unused registry images — nothing to do"
  [ "$dry_run" = 1 ] || { mkdir -p "$(dirname "$STAMP")"; touch "$STAMP"; }
  exit 0
fi

n=0; mb_total=0; failed=0
while IFS=$'\t' read -r id size refs; do
  mb=$(( ${size:-0} / 1048576 ))
  if [ "$dry_run" = 1 ]; then log "  would remove $refs (${mb} MB)"; continue; fi
  # shellcheck disable=SC2086  # refs is a space-separated list of image references
  out="$(docker image rm $refs 2>&1)"
  if docker image inspect "$id" >/dev/null 2>&1; then
    failed=$((failed + 1)); log "  kept $refs: $(printf '%s\n' "$out" | grep -i -m1 -E 'error|conflict' | cut -c1-140)"
  else
    n=$((n + 1)); mb_total=$((mb_total + mb)); log "  removed $refs (${mb} MB)"
  fi
done <<< "$rows"

[ "$dry_run" = 1 ] && exit 0
mkdir -p "$(dirname "$STAMP")"; touch "$STAMP"
kept=""; [ "$failed" -gt 0 ] && kept=", $failed kept"
log "done: removed $n images, ${mb_total} MB by image size (shared layers make the real gain smaller)$kept"
[ "$n" -gt 0 ] && osascript -e "display notification \"$n unused registry images removed (${mb_total} MB). The next use pulls them again.\" with title \"Docker images cleaned\"" >/dev/null 2>&1
exit 0
