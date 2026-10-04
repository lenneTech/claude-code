#!/usr/bin/env bash
# disk-clean.sh — performs cleanups that disk-audit.sh proposed, by id, and nothing else.
#
# Every id is re-validated at execution time: the audit may be minutes old, and in the meantime
# a session may have started a dev server in a "stale" project, attached a container to an
# "unused" volume or begun an install that writes to the pnpm store. The executor therefore
# never trusts the audit's verdict; it repeats the check and refuses when it no longer holds.
#
# Output: one line per id — status <TAB> id <TAB> detail — with status
#   ok | dry-run | refused | failed
# then "# freed_mb=<df delta> free_mb=<now>". The gain is measured with df, never du.
#
# Usage: disk-clean.sh [--dry-run] [--accept-data-loss] [--code-root DIR] <id>...
#   --dry-run            report what would happen, change nothing
#   --accept-data-loss   allow deleting a project-dir whose git state is not "safe"
#                        (uncommitted work, unpushed commits, no remote). Only after the user
#                        confirmed that exact directory.
#   --code-root DIR      root that node-modules / build-output ids must live under (default ~/code)

set -uo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/lib/disk-common.sh"
. "$(dirname "${BASH_SOURCE[0]}")/lib/ensure-node-path.sh"
ensure_node_on_path >/dev/null 2>&1 || true

DRY=0
ACCEPT_LOSS=0
CODE_ROOT="${LT_DISK_CODE_ROOT:-$HOME/code}"
IDS=()
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY=1; shift ;;
    --accept-data-loss) ACCEPT_LOSS=1; shift ;;
    --code-root) CODE_ROOT="$(untilde "$2")"; shift 2 ;;
    -h|--help) sed -n '2,22p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) IDS+=("$1"); shift ;;
  esac
done
CODE_ROOT="${CODE_ROOT%/}"
[ ${#IDS[@]} -gt 0 ] || { echo "usage: disk-clean.sh [--dry-run] [--accept-data-loss] <id>..." >&2; exit 2; }

report() { printf '%s\t%s\t%s\n' "$1" "$2" "$3"; }

# act <id> <description> <command...> — run the command, or only describe it in dry-run mode.
act() {
  local id="$1" what="$2"; shift 2
  if [ "$DRY" = 1 ]; then report dry-run "$id" "would $what"; return 0; fi
  if "$@" >/dev/null 2>&1; then report ok "$id" "$what"; else report failed "$id" "$what"; fi
}

# under_home <path> — a real path strictly below $HOME that is not a symlink.
under_home() {
  case "$1" in "$HOME"/?*) ;; *) return 1 ;; esac
  [ ! -L "$1" ]
}

clean_one() {
  local id="$1" kind="${1%%:*}" target="" p name rev refs active safety base pw log f n
  [ "$kind" != "$id" ] && target="${id#*:}"
  p="$(untilde "$target")"

  case "$kind" in
    pnpm-store)
      active="$(pnpm_active_generation)"
      [ -n "$active" ] && [ "$target" = "$active" ] || { report refused "$id" "not the active generation (${active:-pnpm not found})"; return; }
      [ -z "$(store_writers)" ] || { report refused "$id" "a pnpm install is writing to the store right now"; return; }
      act "$id" "prune the pnpm store" bash -c 'cd "$HOME" && pnpm store prune' ;;

    pnpm-store-old)
      active="$(pnpm_active_generation)"; base="$(pnpm_store_root)/$target"
      [ -d "$base" ] || { report refused "$id" "not found"; return; }
      [ -n "$active" ] && [ "${target#v}" -lt "${active#v}" ] 2>/dev/null || { report refused "$id" "not older than the active generation (${active:-unknown})"; return; }
      [ ! -d "$base/links" ] || { report refused "$id" "holds a global virtual store; prune it with pnpm ${target#v}"; return; }
      act "$id" "remove $(tilde "$base")" rm -rf "$base" ;;

    npm-cache)
      act "$id" "npm cache clean --force" npm cache clean --force
      if proc_mentions "/.npm/_npx/"; then report refused "npm-cache:_npx" "an npx process runs from it"
      else act "npm-cache:_npx" "remove ~/.npm/_npx" rm -rf "$HOME/.npm/_npx"; fi ;;

    yarn-cache|bun-cache)
      disk_proc_init
      grep -qE "(^|/)${kind%-cache}( |$)" <<< "$_DISK_PROC_SNAPSHOT" && { report refused "$id" "${kind%-cache} is running"; return; }
      for f in "$HOME/Library/Caches/Yarn" "$HOME/.cache/yarn" "$HOME/.bun/install/cache"; do
        case "$kind:$f" in yarn-cache:*Yarn|yarn-cache:*yarn|bun-cache:*bun*) [ -d "$f" ] && act "$id" "remove $(tilde "$f")" rm -rf "$f" ;; esac
      done ;;

    docker-build-cache) act "$id" "docker builder prune -a" docker builder prune -a -f ;;
    docker-images) act "$id" "docker image prune -a" docker image prune -a -f ;;

    docker-container)
      f="$(docker inspect -f '{{.State.Status}}' "$target" 2>/dev/null)" || { report refused "$id" "not found"; return; }
      case "$f" in exited|created|dead) act "$id" "docker rm $target" docker rm "$target" ;;
        *) report refused "$id" "state is $f" ;; esac ;;

    docker-volume)
      docker volume ls -qf dangling=true 2>/dev/null | grep -qx "$target" || { report refused "$id" "in use by a container (or gone)"; return; }
      act "$id" "docker volume rm $target" docker volume rm "$target" ;;

    docker-volumes-anonymous)
      n=0
      for f in $(docker volume ls -qf dangling=true 2>/dev/null | grep -E '^[0-9a-f]{64}$'); do
        if [ "$DRY" = 1 ] || docker volume rm "$f" >/dev/null 2>&1; then n=$((n + 1)); fi
      done
      report "$([ "$DRY" = 1 ] && echo dry-run || echo ok)" "$id" "$n anonymous volumes" ;;

    node-modules)
      [ "$(basename "$p")" = node_modules ] && under_home "$p" && [ -d "$p" ] || { report refused "$id" "not a node_modules directory below \$HOME"; return; }
      case "$p" in "$CODE_ROOT"/*) ;; *) report refused "$id" "outside the code root $(tilde "$CODE_ROOT")"; return ;; esac
      path_in_use "$(dirname "$p")" && { report refused "$id" "a running process uses this project"; return; }
      act "$id" "remove $(tilde "$p")" rm -rf "$p" ;;

    node-modules-all)
      under_home "$p" && [ -d "$p" ] || { report refused "$id" "not a directory below \$HOME"; return; }
      path_in_use "$p" && { report refused "$id" "a running process uses this project"; return; }
      n=0
      while IFS= read -r f; do
        if [ "$DRY" = 1 ] || rm -rf "$f"; then n=$((n + 1)); fi
      done < <(find "$p" -name node_modules -type d -prune 2>/dev/null)
      report "$([ "$DRY" = 1 ] && echo dry-run || echo ok)" "$id" "$n node_modules directories" ;;

    build-output)
      name="$(basename "$p")"
      case "$name" in .nuxt|.output|dist|coverage|.turbo|.next) ;; *) report refused "$id" "not a build output directory"; return ;; esac
      under_home "$p" && [ -d "$p" ] && [ -f "$(dirname "$p")/package.json" ] || { report refused "$id" "not inside a project below \$HOME"; return; }
      path_in_use "$(dirname "$p")" && { report refused "$id" "a running process uses this project"; return; }
      act "$id" "remove $(tilde "$p")" rm -rf "$p" ;;

    project-dir)
      under_home "$p" && [ -d "$p" ] || { report refused "$id" "not a directory below \$HOME"; return; }
      [ "$(dirname "$p")" != "$HOME" ] && [ "$p" != "$CODE_ROOT" ] || { report refused "$id" "refusing a top-level directory"; return; }
      path_in_use "$p" && { report refused "$id" "a running process uses it"; return; }
      safety="$(git_safety "$p")"
      if [ "$safety" != safe ] && [ "$safety" != no-git ] && [ "$ACCEPT_LOSS" != 1 ]; then
        report refused "$id" "git=$safety; deleting loses work — node-modules-all:$target frees most of the space, or pass --accept-data-loss after the user confirmed"
        return
      fi
      act "$id" "remove $(tilde "$p") (git=$safety)" rm -rf "$p" ;;

    playwright-browser)
      pw="${PLAYWRIGHT_BROWSERS_PATH:-$HOME/Library/Caches/ms-playwright}"; [ -d "$pw" ] || pw="$HOME/.cache/ms-playwright"
      rev="${target##*-}"
      [[ "$target" =~ ^[a-z_]+-[0-9]+$ ]] && [ -d "$pw/$target" ] || { report refused "$id" "no such browser directory"; return; }
      refs="$(playwright_referenced_revisions "$pw")"
      [ -n "$refs" ] || { report refused "$id" "no install links found; cannot prove it unused"; return; }
      printf '%s\n' "$refs" | grep -qx "$rev" && { report refused "$id" "revision $rev is used by an installed Playwright"; return; }
      act "$id" "remove $target" rm -rf "${pw:?}/$target" ;;

    xcode-derived-data|xcode-device-support)
      pgrep -x Xcode >/dev/null 2>&1 && { report refused "$id" "Xcode is running"; return; }
      f="$HOME/Library/Developer/Xcode/DerivedData"; [ "$kind" = xcode-device-support ] && f="$HOME/Library/Developer/Xcode/iOS DeviceSupport"
      act "$id" "empty $(tilde "$f")" bash -c 'rm -rf "$1"/*' _ "$f" ;;

    xcode-simulators-unavailable) act "$id" "xcrun simctl delete unavailable" xcrun simctl delete unavailable ;;

    jetbrains-old)
      name="$(basename "$p")"; base="$(dirname "$p")"
      case "$base" in "$HOME/Library/Application Support/JetBrains"|"$HOME/Library/Caches/JetBrains"|"$HOME/Library/Logs/JetBrains") ;;
        *) report refused "$id" "not a JetBrains version directory"; return ;; esac
      [[ "$name" =~ ^([A-Za-z]+)[0-9]{4}\.[0-9]+$ ]] || { report refused "$id" "not a JetBrains version directory"; return; }
      # shellcheck disable=SC2010  # JetBrains version directories are plain alphanumeric names
      f="$(ls "$base" | grep -E "^${BASH_REMATCH[1]}[0-9]{4}\.[0-9]+$" | sort -V | tail -1)"
      [ "$f" != "$name" ] || { report refused "$id" "this is the newest version"; return; }
      pgrep -if "${BASH_REMATCH[1]}\.app/Contents/MacOS" >/dev/null 2>&1 && { report refused "$id" "${BASH_REMATCH[1]} is running"; return; }
      act "$id" "remove $(tilde "$p") (keeps $f)" rm -rf "$p" ;;

    junk-file)
      case "$p" in *.hprof|*.iso|*.dmg) ;; *) report refused "$id" "only .hprof, .iso and .dmg files"; return ;; esac
      under_home "$p" && [ -f "$p" ] || { report refused "$id" "not a regular file below \$HOME"; return; }
      lsof "$p" >/dev/null 2>&1 && { report refused "$id" "the file is open"; return; }
      act "$id" "remove $(tilde "$p")" rm -f "$p" ;;

    mongo-log)
      [ -f /opt/homebrew/var/log/mongodb/mongo.log ] || [ -f /usr/local/var/log/mongodb/mongo.log ] \
        || { report refused "$id" "no MongoDB log found"; return; }
      for log in /opt/homebrew/var/log/mongodb/mongo.log /usr/local/var/log/mongodb/mongo.log; do
        [ -f "$log" ] || continue
        if [ "$DRY" = 1 ]; then report dry-run "$id" "would rotate $(tilde "$log") and delete rotated files"; continue; fi
        mongosh --quiet --eval 'quit(db.adminCommand({ logRotate: 1 }).ok === 1 ? 0 : 1)' >/dev/null 2>&1 \
          || { report failed "$id" "logRotate failed (mongod not running?)"; continue; }
        n=0
        for f in "$log".*; do
          [ -f "$f" ] || continue
          lsof "$f" >/dev/null 2>&1 && continue
          rm -f "$f" && n=$((n + 1))
        done
        report ok "$id" "rotated $(tilde "$log"), deleted $n rotated files"
      done ;;

    photos-library|media|ollama-models|vm|large-file|claude-transcripts|guard|docker-disk|pnpm-store-kept|docker|code-root|throwaway-root|playwright)
      report refused "$id" "report only; the user decides and acts on it" ;;

    *) report refused "$id" "unknown id" ;;
  esac
}

before=$(free_mb)
for id in "${IDS[@]}"; do clean_one "$id"; done
[ "$DRY" = 1 ] && exit 0
after=$(free_mb)
printf '# freed_mb=%s free_mb=%s\n' "$((after - before))" "$after"
