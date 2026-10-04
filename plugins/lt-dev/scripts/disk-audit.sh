#!/usr/bin/env bash
# disk-audit.sh — read-only inventory of reclaimable disk space on a developer machine.
#
# Prints one finding per line, tab-separated, sorted by class and size:
#
#   id <TAB> class <TAB> mb <TAB> note
#
#   id     what disk-clean.sh acts on (kind:target); pass it back verbatim
#   class  regenerable  rebuilt or re-downloaded on demand — safe to clean
#          data         may hold work or database contents — needs an explicit decision
#          personal     the user's own files — report only, never cleaned by the scripts
#          info         context (store generations kept, guards installed, VM disk size)
#   mb     allocated size; du counts APFS clones in full, so the real gain is measured with df
#
# The output is meant to be read by Claude in one go: one line per finding instead of dozens
# of du/find/docker calls, and the same answer on every run.
#
# Usage: disk-audit.sh [--code-root DIR] [--stale-days N] [--stopped-days N] [--throwaway DIR]...
#                      [--min-mb N] [--no-large-files]
#   --code-root DIR    project root to scan for stale node_modules / build output (default ~/code)
#   --stale-days N     a project is stale when package.json, lockfile and git index are older (90)
#   --stopped-days N   a stopped Docker container is listed after this many days (3)
#   --throwaway DIR    a directory of throwaway projects; every subdirectory becomes a project-dir
#                      finding with its git safety state (repeatable)
#   --min-mb N         hide findings smaller than this (50)
#   --no-large-files   skip the scan for single files over 2 GB in the home directory

set -uo pipefail
. "$(dirname "${BASH_SOURCE[0]}")/lib/disk-common.sh"
. "$(dirname "${BASH_SOURCE[0]}")/lib/ensure-node-path.sh"
ensure_node_on_path >/dev/null 2>&1 || true

CODE_ROOT="${LT_DISK_CODE_ROOT:-$HOME/code}"
STALE_DAYS=90
STOPPED_DAYS=3
MIN_MB=50
LARGE_FILES=1
THROWAWAY=()

while [ $# -gt 0 ]; do
  case "$1" in
    --code-root) CODE_ROOT="$(untilde "$2")"; shift 2 ;;
    --stale-days) STALE_DAYS="$2"; shift 2 ;;
    --stopped-days) STOPPED_DAYS="$2"; shift 2 ;;
    --throwaway) THROWAWAY+=("$(untilde "${2%/}")"); shift 2 ;;
    --min-mb) MIN_MB="$2"; shift 2 ;;
    --no-large-files) LARGE_FILES=0; shift ;;
    -h|--help) sed -n '2,30p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done
CODE_ROOT="${CODE_ROOT%/}"

NOW=$(date +%s)
OUT="$(mktemp)"
trap 'rm -f "$OUT"' EXIT

# emit <id> <class> <mb> <note> — findings below MIN_MB are dropped, except info lines.
emit() {
  if [ "$2" != "info" ] && [ "${3:-0}" -lt "$MIN_MB" ]; then return; fi
  printf '%s\t%s\t%s\t%s\n' "$1" "$2" "${3:-0}" "$4" >> "$OUT"
}

is_throwaway() {
  local p="$1" t
  for t in "${THROWAWAY[@]+"${THROWAWAY[@]}"}"; do
    case "$p" in "$t"/*) return 0 ;; esac
  done
  return 1
}

# ------------------------------------------------------------------ package managers
audit_package_managers() {
  local root gen d g mb n active_n
  if command -v pnpm >/dev/null 2>&1; then
    gen="$(pnpm_active_generation)"
    root="$(pnpm_store_root)"
    active_n="${gen#v}"
    for d in "$root"/v*; do
      [ -d "$d" ] || continue
      g="$(basename "$d")"; n="${g#v}"; mb=$(size_mb "$d")
      if [ "$g" = "$gen" ]; then
        emit "pnpm-store:$g" regenerable "$mb" "active store of pnpm ${n}; on APFS a prune empties it completely and every project re-downloads on its next install"
      elif [ -n "$gen" ] && [ -d "$d" ] && [ ! -d "$d/links" ] && [ "$n" -lt "$active_n" ] 2>/dev/null; then
        emit "pnpm-store-old:$g" regenerable "$mb" "store of pnpm ${n}; projects still pinned to pnpm ${n} refill it on install"
      else
        emit "pnpm-store-kept:$g" info "$mb" "kept: newer than the active generation or holds a global virtual store"
      fi
    done
  fi
  [ -d "$HOME/.npm" ] && emit "npm-cache" regenerable "$(size_mb "$HOME/.npm")" "npm cache incl. _npx; refilled on demand"
  for d in "$HOME/Library/Caches/Yarn" "$HOME/.cache/yarn"; do
    [ -d "$d" ] && emit "yarn-cache" regenerable "$(size_mb "$d")" "$(tilde "$d")"
  done
  # shellcheck disable=SC2088  # a literal ~ is the display text
  [ -d "$HOME/.bun/install/cache" ] && emit "bun-cache" regenerable "$(size_mb "$HOME/.bun/install/cache")" "~/.bun/install/cache"
}

# ------------------------------------------------------------------ docker
docker_epoch() {  # ISO timestamp from docker inspect → epoch
  local t="${1:0:19}"
  date -j -u -f '%Y-%m-%dT%H:%M:%S' "$t" +%s 2>/dev/null || date -u -d "$t" +%s 2>/dev/null || echo 0
}

audit_docker() {
  command -v docker >/dev/null 2>&1 || return 0
  if ! docker info >/dev/null 2>&1; then
    emit "docker" info 0 "daemon not running; start Docker to audit images, cache and volumes"
    return 0
  fi
  local sdf v name links size anon_n=0 anon_mb=0 cid cname fin age
  sdf="$(docker system df 2>/dev/null)"
  emit "docker-build-cache" regenerable "$(to_mb "$(printf '%s\n' "$sdf" | awk '/^Build Cache/ {print $6}')")" "docker builder prune -a"
  # Images: counted, not taken from `docker system df`. Its RECLAIMABLE column reported 100 % for
  # 15 images all used by containers (containerd image store, 2026-10-03). What `docker image
  # prune -a` removes is every image no container — running or stopped — references.
  local ids used iid isize img_n=0 img_mb=0
  ids="$(docker ps -aq 2>/dev/null)"
  # shellcheck disable=SC2086  # container ids are plain hex words
  used="$([ -n "$ids" ] && docker inspect -f '{{.Image}}' $ids 2>/dev/null | sort -u)"
  while IFS=$'\t' read -r iid isize; do
    [ -n "$iid" ] || continue
    grep -qxF "$iid" <<< "$used" && continue
    img_n=$((img_n + 1)); img_mb=$((img_mb + $(to_mb "$isize")))
  done < <(docker images --no-trunc --format '{{.ID}}\t{{.Size}}' 2>/dev/null | sort -u)
  [ "$img_n" -gt 0 ] && emit "docker-images" regenerable "$img_mb" "$img_n images no container uses (shared layers make the real gain smaller); pulled or rebuilt on demand"

  docker ps -a --filter status=exited --filter status=created --filter status=dead --format '{{.ID}}\t{{.Names}}' 2>/dev/null |
    while IFS=$'\t' read -r cid cname; do
      fin="$(docker inspect -f '{{.State.FinishedAt}}' "$cid" 2>/dev/null)" || continue
      case "$fin" in 0001-*) fin="$(docker inspect -f '{{.Created}}' "$cid" 2>/dev/null)" ;; esac
      age=$(( (NOW - $(docker_epoch "$fin")) / 86400 ))
      [ "$age" -lt "$STOPPED_DAYS" ] && continue
      printf '%s\t%s\t%s\t%s\n' "docker-container:${cname:-$cid}" regenerable 0 "stopped ${age}d ago; its named volumes stay" >> "$OUT"
    done

  # Volumes: parse the "Local Volumes" table of `docker system df -v` (name, links, size).
  while read -r name links size; do
    [ "$links" = "0" ] || continue
    if [[ "$name" =~ ^[0-9a-f]{64}$ ]]; then
      anon_n=$((anon_n + 1)); anon_mb=$((anon_mb + $(to_mb "$size")))
    else
      emit "docker-volume:$name" data "$(to_mb "$size")" "no container uses it; may hold database data"
    fi
  done < <(docker system df -v 2>/dev/null | awk '
    /^Local Volumes space usage/ { sect = 1; next }
    sect && /^VOLUME NAME/ { hdr = 1; next }
    sect && hdr && NF == 0 { exit }
    sect && hdr && NF >= 3 { print $1, $(NF - 1), $NF }')
  [ "$anon_n" -gt 0 ] && emit "docker-volumes-anonymous" data "$anon_mb" "$anon_n anonymous volumes no container uses"

  v="$HOME/Library/Containers/com.docker.docker/Data/vms/0/data/Docker.raw"
  [ -f "$v" ] && emit "docker-disk" info "$(size_mb "$v")" "Docker Desktop disk (allocated); shrinks after the prunes above"
}

# ------------------------------------------------------------------ projects
audit_projects() {
  [ -d "$CODE_ROOT" ] || { emit "code-root" info 0 "$(tilde "$CODE_ROOT") not found; pass --code-root"; return 0; }
  local nm dir last age note class out p t sub safety nmmb

  # Stale node_modules (top level per project; build output and throwaway roots handled below).
  while IFS= read -r nm; do
    case "$nm" in */.output/*|*/dist/*|*/.nuxt/*) continue ;; esac
    is_throwaway "$nm" && continue
    dir="$(dirname "$nm")"
    last=$(project_last_touched "$dir"); [ "$last" -eq 0 ] && continue
    age=$(( (NOW - last) / 86400 )); [ "$age" -lt "$STALE_DAYS" ] && continue
    path_in_use "$dir" && continue
    class=regenerable; note="project untouched ${age}d (since $(day_of "$last"))"
    has_lockfile "$dir" || { class=data; note="$note; no lockfile, a reinstall may resolve newer versions"; }
    emit "node-modules:$(tilde "$nm")" "$class" "$(size_mb "$nm")" "$note"
  done < <(find "$CODE_ROOT" -name node_modules -type d -prune 2>/dev/null)

  # Build output of stale projects.
  while IFS= read -r out; do
    is_throwaway "$out" && continue
    dir="$(dirname "$out")"
    [ -f "$dir/package.json" ] || continue
    last=$(project_last_touched "$dir"); [ "$last" -eq 0 ] && continue
    age=$(( (NOW - last) / 86400 )); [ "$age" -lt "$STALE_DAYS" ] && continue
    path_in_use "$dir" && continue
    emit "build-output:$(tilde "$out")" regenerable "$(size_mb "$out")" "project untouched ${age}d; rebuilt by its build"
  done < <(find "$CODE_ROOT" \( -name node_modules -o -name .git \) -prune -o -type d \
             \( -name .nuxt -o -name .output -o -name dist -o -name coverage -o -name .turbo -o -name .next \) -prune -print 2>/dev/null)

  # Throwaway project directories: the whole directory, with what deleting it would lose.
  for t in "${THROWAWAY[@]+"${THROWAWAY[@]}"}"; do
    [ -d "$t" ] || { emit "throwaway-root" info 0 "$(tilde "$t") not found"; continue; }
    for sub in "$t"/*/; do
      sub="${sub%/}"; [ -d "$sub" ] || continue
      if path_in_use "$sub"; then emit "project-dir:$(tilde "$sub")" info 0 "in use by a running process; left alone"; continue; fi
      safety="$(git_safety "$sub")"
      last=$(project_last_touched "$sub"); [ "$last" -eq 0 ] && last=$(mtime_of "$sub")
      emit "project-dir:$(tilde "$sub")" data "$(size_mb "$sub")" "git=$safety; last touched $(day_of "$last")"
      if [ "$safety" != "safe" ] && [ "$safety" != "no-git" ]; then
        nmmb=0
        while IFS= read -r p; do nmmb=$((nmmb + $(size_mb "$p"))); done < <(find "$sub" -name node_modules -type d -prune 2>/dev/null)
        emit "node-modules-all:$(tilde "$sub")" regenerable "$nmmb" "only the node_modules of this project; keeps its unsaved work"
      fi
    done
  done
}

# ------------------------------------------------------------------ tools and caches
audit_tools() {
  local pw refs d name rev log mb base prod dirs i n
  pw="${PLAYWRIGHT_BROWSERS_PATH:-$HOME/Library/Caches/ms-playwright}"
  [ -d "$pw" ] || pw="$HOME/.cache/ms-playwright"
  if [ -d "$pw" ]; then
    refs="$(playwright_referenced_revisions "$pw")"
    if [ -z "$refs" ]; then
      emit "playwright" info "$(size_mb "$pw")" "no install links found; browsers left alone"
    else
      for d in "$pw"/*-*; do
        [ -d "$d" ] || continue
        name="$(basename "$d")"; rev="${name##*-}"
        [[ "$rev" =~ ^[0-9]+$ ]] || continue
        printf '%s\n' "$refs" | grep -qx "$rev" && continue
        emit "playwright-browser:$name" regenerable "$(size_mb "$d")" "no installed Playwright version uses revision $rev"
      done
    fi
  fi

  d="$HOME/Library/Developer/Xcode/DerivedData"
  [ -d "$d" ] && emit "xcode-derived-data" regenerable "$(size_mb "$d")" "rebuilt by the next Xcode build"
  d="$HOME/Library/Developer/Xcode/iOS DeviceSupport"
  [ -d "$d" ] && emit "xcode-device-support" regenerable "$(size_mb "$d")" "re-created when a device connects"
  if command -v xcrun >/dev/null 2>&1; then
    n=$(xcrun simctl list devices unavailable 2>/dev/null | grep -c '(unavailable')
    [ "$n" -gt 0 ] && printf '%s\t%s\t%s\t%s\n' "xcode-simulators-unavailable" regenerable 0 "$n simulators of removed runtimes; size not measured" >> "$OUT"
  fi

  # JetBrains: every version directory except the newest per product.
  for base in "$HOME/Library/Application Support/JetBrains" "$HOME/Library/Caches/JetBrains" "$HOME/Library/Logs/JetBrains"; do
    [ -d "$base" ] || continue
    for prod in $(ls "$base" 2>/dev/null | sed -nE 's/^([A-Za-z]+)[0-9]{4}\.[0-9]+$/\1/p' | sort -u); do
      # shellcheck disable=SC2010  # JetBrains version directories are plain alphanumeric names
      dirs="$(ls "$base" | grep -E "^${prod}[0-9]{4}\.[0-9]+$" | sort -V)"
      n=$(printf '%s\n' "$dirs" | wc -l | tr -d ' ')
      i=0
      for name in $dirs; do
        i=$((i + 1)); [ "$i" -eq "$n" ] && break
        emit "jetbrains-old:$(tilde "$base/$name")" regenerable "$(size_mb "$base/$name")" "superseded by $(printf '%s\n' "$dirs" | tail -1)"
      done
    done
  done

  while IFS= read -r d; do
    emit "junk-file:$(tilde "$d")" regenerable "$(size_mb "$d")" "heap dump of a crashed JVM"
  done < <(find "$HOME" -maxdepth 1 -type f -name '*.hprof' 2>/dev/null)
  while IFS= read -r d; do
    emit "junk-file:$(tilde "$d")" regenerable "$(size_mb "$d")" "installer image from $(day_of "$(mtime_of "$d")"); downloadable again"
  done < <(find "$HOME/Downloads" "$HOME/Library/Parallels/Downloads" -maxdepth 1 -type f \( -name '*.iso' -o -name '*.dmg' \) 2>/dev/null)

  for log in /opt/homebrew/var/log/mongodb/mongo.log /usr/local/var/log/mongodb/mongo.log; do
    [ -f "$log" ] || continue
    mb=0; for d in "$log" "$log".*; do [ -f "$d" ] && mb=$((mb + $(size_mb "$d"))); done
    emit "mongo-log" regenerable "$mb" "$(tilde "$log") incl. rotated files; rotated via logRotate, no restart"
  done

  if [ "$(uname)" = "Darwin" ]; then
    for g in pnpm-store-guard mongo-log-guard; do
      if [ -f "$HOME/Library/LaunchAgents/tech.lenne.lt-dev.$g.plist" ]; then emit "guard:$g" info 0 "installed"
      else emit "guard:$g" info 0 "missing; disk-guards.sh install keeps it from growing back"; fi
    done
  fi
}

# ------------------------------------------------------------------ personal files (report only)
audit_personal() {
  local d mb models f
  for d in "$HOME"/Pictures/*.photoslibrary; do
    [ -d "$d" ] && emit "photos-library:$(tilde "$d")" personal "$(size_mb "$d")" "with iCloud Photos: Photos > Settings > iCloud > Optimize Mac Storage"
  done
  [ -d "$HOME/Movies" ] && emit "media:~/Movies" personal "$(size_mb "$HOME/Movies")" "archive to external storage"
  if [ -d "$HOME/.ollama/models" ]; then
    models=""
    command -v ollama >/dev/null 2>&1 && models="$(ollama list 2>/dev/null | awk 'NR > 1 {printf "%s%s %s%s", sep, $1, $3, $4; sep = ", "}')"
    emit "ollama-models" personal "$(size_mb "$HOME/.ollama/models")" "remove unused ones with ollama rm <model>${models:+: $models}"
  fi
  for d in "$HOME"/Parallels/*.pvm; do
    [ -d "$d" ] || continue
    mb=0; for f in "$d"/*.mem; do [ -f "$f" ] && mb=$((mb + $(size_mb "$f"))); done
    emit "vm:$(tilde "$d")" personal "$(size_mb "$d")" "$([ "$mb" -gt 0 ] && echo "suspended, ${mb} MB memory image: shut down instead of suspending" || echo "virtual machine")"
  done
  # shellcheck disable=SC2088  # a literal ~ is the display text
  [ -d "$HOME/.claude/projects" ] && emit "claude-transcripts" info "$(size_mb "$HOME/.claude/projects")" "~/.claude/projects (session transcripts)"

  [ "$LARGE_FILES" = 1 ] || return 0
  while IFS= read -r f; do
    emit "large-file:$(tilde "$f")" personal "$(size_mb "$f")" "single file over 2 GB"
  done < <(find "$HOME" -xdev \( -name node_modules -o -name .git -o -name '*.photoslibrary' -o -name '*.pvm' \
             -o -path "$HOME/Library/Containers/com.docker.docker" -o -path "$HOME/Library/CloudStorage" \
             -o -path "$HOME/Library/Mobile Documents" -o -path "$HOME/.ollama" -o -path "$HOME/Library/pnpm" \) -prune \
             -o -type f -size +2G -print 2>/dev/null | head -40)
}

audit_package_managers
audit_docker
audit_projects
audit_tools
audit_personal

total_regen=$(awk -F'\t' '$2 == "regenerable" {s += $3} END {print s + 0}' "$OUT")
total_data=$(awk -F'\t' '$2 == "data" {s += $3} END {print s + 0}' "$OUT")
total_pers=$(awk -F'\t' '$2 == "personal" {s += $3} END {print s + 0}' "$OUT")
printf '# disk-audit free_mb=%s code_root=%s stale_days=%s regenerable_mb=%s data_mb=%s personal_mb=%s\n' \
  "$(free_mb)" "$(tilde "$CODE_ROOT")" "$STALE_DAYS" "$total_regen" "$total_data" "$total_pers"
printf '# id\tclass\tmb\tnote\n'
awk -F'\t' 'BEGIN { o["regenerable"] = 1; o["data"] = 2; o["personal"] = 3; o["info"] = 4 }
  { printf "%d\t%012d\t%s\n", o[$2], 999999999999 - $3, $0 }' "$OUT" | sort | cut -f3-
