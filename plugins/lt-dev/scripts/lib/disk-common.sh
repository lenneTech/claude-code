#!/usr/bin/env bash
# disk-common.sh — shared helpers for disk-audit.sh, disk-clean.sh and the disk guards.
#
# Every safety decision lives here exactly once, so the audit that PROPOSES a deletion and the
# executor that PERFORMS it can never disagree about what "stale", "in use" or "safe to lose"
# means. Pure bash + BSD/GNU coreutils; no node, no jq.
#
# Source it, do not execute it:
#   . "$(dirname "${BASH_SOURCE[0]}")/lib/disk-common.sh"

# Numbers are parsed and printed with "." as the decimal point. Under a German locale awk
# reads "21.18GB" as 21, which turned a 21.18 GB Docker cache into 21000 MB (caught by the tests).
export LC_ALL=C

# ---------------------------------------------------------------- portability

# mtime_of <path> — epoch seconds, 0 when missing.
mtime_of() {
  [ -e "$1" ] || { echo 0; return; }
  stat -f %m "$1" 2>/dev/null || stat -c %Y "$1" 2>/dev/null || echo 0
}

# day_of <epoch> — YYYY-MM-DD.
day_of() {
  date -r "$1" +%Y-%m-%d 2>/dev/null || date -d "@$1" +%Y-%m-%d 2>/dev/null || echo "?"
}

# size_mb <path> — allocated size in MB (du counts APFS clones in full; see free_mb).
size_mb() {
  local kb
  kb=$({ du -sk "$1" 2>/dev/null || true; } | awk '{print $1 + 0}')
  echo $(( ${kb:-0} / 1024 ))
}

# free_mb — free space on the volume holding $HOME. This, not du, is what a cleanup must be
# measured against: pnpm imports node_modules as APFS clones, so du counts shared blocks twice.
free_mb() { df -k "$HOME" | awk 'NR==2 {print int($4 / 1024)}'; }

# to_mb <docker size string> — "21.18GB" / "512MB" / "3.2kB" / "0B" → integer MB.
to_mb() {
  awk -v s="$1" 'BEGIN {
    n = s + 0; u = s; sub(/^[0-9.]+/, "", u)
    f = (u ~ /^[Tt]/) ? 1000000 : (u ~ /^[Gg]/) ? 1000 : (u ~ /^[Mm]/) ? 1 : 0
    printf "%d", n * f + 0.5
  }'
}

# tilde <path> — replace $HOME with ~ (shorter output, no personal paths in reports).
tilde() { case "$1" in "$HOME"*) echo "~${1#"$HOME"}" ;; *) echo "$1" ;; esac; }

# untilde <path> — expand a leading ~ again.
untilde() { case "$1" in "~"*) echo "$HOME${1#"~"}" ;; *) echo "$1" ;; esac; }

# ---------------------------------------------------------------- processes

# disk_proc_init — command lines and working directories of all running processes,
# captured once per run. A project is "in use" when either names a path inside it: a dev
# server started with relative paths shows up only through its cwd.
#
# Two self-matches have to be kept out, and both bit (2026-10-03):
# - The audit's and executor's own command lines name the very paths being checked.
# - The matcher itself: a snapshot taken on the left of a pipe runs CONCURRENTLY with the awk or
#   grep on the right, whose arguments contain the path — so every path read as "in use", the
#   audit never reported a stale node_modules, and `_npx` was always refused. The snapshot is
#   therefore captured once, in the current shell, before any matcher process exists, and the
#   matchers read it from a here-string.
_DISK_PROC_SNAPSHOT=""
disk_proc_init() {
  [ -n "$_DISK_PROC_SNAPSHOT" ] && return 0
  _DISK_PROC_SNAPSHOT="$(ps -axo command= 2>/dev/null | grep -v -e 'disk-clean\.sh' -e 'disk-audit\.sh')
$(lsof -nP -d cwd -Fn 2>/dev/null | sed -n 's/^n//p')
."
}

# path_in_use <dir> — 0 when a running process references <dir> or anything below it.
path_in_use() {
  local dir="${1%/}"
  disk_proc_init
  awk -v d="$dir" '
    index($0, d "/") || index($0, d " ") || $0 == d || substr($0, length($0) - length(d) + 1) == d { hit = 1 }
    END { exit !hit }' <<< "$_DISK_PROC_SNAPSHOT"
}

# proc_mentions <fixed-string> — 0 when a running process command line or cwd contains it.
proc_mentions() {
  disk_proc_init
  grep -qF -- "$1" <<< "$_DISK_PROC_SNAPSHOT"
}

# store_writers — command lines of running pnpm processes that write to the store. `pnpm run …`
# and dev servers do not count; a bare `pnpm` does (it means install).
store_writers() {
  local procs
  procs="$(ps -axo command= 2>/dev/null)"
  printf '%s\n' "$procs" | awk '
    BEGIN {
      n = split("install i add update up upgrade fetch dedupe remove rm uninstall un dlx import rebuild rb link ln", w, " ")
      for (k = 1; k <= n; k++) writes[w[k]] = 1
    }
    {
      for (f = 1; f <= NF; f++) {
        base = $f; sub(/.*\//, "", base)
        if (base == "pnpx") { print; next }
        if (base ~ /^pnpm(\.cjs|\.mjs|\.js)?$/) {
          if (f == NF) { print; next }
          for (g = f + 1; g <= NF; g++) if ($g in writes) { print; next }
          next
        }
      }
    }'
}

# ---------------------------------------------------------------- projects

# git_root_of <dir> — nearest directory at or above <dir> that holds .git (dir or file).
git_root_of() {
  local d="$1"
  while [ -n "$d" ] && [ "$d" != "/" ]; do
    [ -e "$d/.git" ] && { echo "$d"; return 0; }
    d="$(dirname "$d")"
  done
  return 1
}

# git_index_of <repo-root> — path of the index file, also for linked worktrees (.git is a file).
git_index_of() {
  local root="$1" g
  if [ -d "$root/.git" ]; then echo "$root/.git/index"; return; fi
  g="$(sed -n 's/^gitdir: //p' "$root/.git" 2>/dev/null)"
  [ -z "$g" ] && return
  case "$g" in /*) ;; *) g="$root/$g" ;; esac
  echo "$g/index"
}

# project_last_touched <project-dir> — newest mtime of the signals that move when someone works
# on the project: its package.json, its lockfile and the git index of its repository.
project_last_touched() {
  local dir="$1" newest=0 m f root
  for f in "$dir/package.json" "$dir/pnpm-lock.yaml" "$dir/package-lock.json" "$dir/yarn.lock"; do
    m=$(mtime_of "$f"); [ "$m" -gt "$newest" ] && newest=$m
  done
  if root="$(git_root_of "$dir")"; then
    m=$(mtime_of "$(git_index_of "$root")"); [ "$m" -gt "$newest" ] && newest=$m
  fi
  echo "$newest"
}

# has_lockfile <project-dir> — a lockfile in the project or in its workspace root (≤ 2 levels up).
has_lockfile() {
  local d="$1" f
  for _ in 0 1 2; do
    for f in pnpm-lock.yaml package-lock.json yarn.lock bun.lock bun.lockb; do
      [ -f "$d/$f" ] && return 0
    done
    d="$(dirname "$d")"
  done
  return 1
}

# git_safety <dir> — one word describing what deleting <dir> would lose:
#   no-git        no repository at all
#   safe          has a remote, nothing uncommitted (node_modules ignored), nothing unpushed
#   no-remote     commits exist only here
#   dirty:N       N uncommitted paths
#   unpushed:N    N commits not on any remote branch
git_safety() {
  local dir="$1" dirty unpushed
  [ -e "$dir/.git" ] || { echo "no-git"; return; }
  dirty=$(git -C "$dir" status --porcelain 2>/dev/null | grep -cv 'node_modules')
  [ "$dirty" -gt 0 ] && { echo "dirty:$dirty"; return; }
  if [ -z "$(git -C "$dir" remote 2>/dev/null)" ]; then
    if git -C "$dir" rev-parse -q --verify HEAD >/dev/null 2>&1; then echo "no-remote"; else echo "no-git"; fi
    return
  fi
  unpushed=$(git -C "$dir" log --oneline --branches --not --remotes 2>/dev/null | wc -l | tr -d ' ')
  [ "$unpushed" -gt 0 ] && { echo "unpushed:$unpushed"; return; }
  echo "safe"
}

# ---------------------------------------------------------------- pnpm

# pnpm_active_generation — "v11" etc. for the pnpm on PATH, empty when pnpm is unavailable.
# Run from $HOME so a project's packageManager pin cannot switch the version under us.
pnpm_active_generation() {
  local p
  p="$(cd "$HOME" && pnpm store path 2>/dev/null)" || return 0
  [ -n "$p" ] && basename "$p"
}

# pnpm_store_root — the directory holding the v<N> generations.
pnpm_store_root() {
  local p
  p="$(cd "$HOME" && pnpm store path 2>/dev/null)"
  if [ -n "$p" ]; then dirname "$p"; else echo "$HOME/Library/pnpm/store"; fi
}

# ---------------------------------------------------------------- playwright

# playwright_referenced_revisions — every browser revision named by a LIVE Playwright install.
# A dir in the browser cache whose revision is absent here is garbage. Matching the quoted
# revision anywhere in browsers.json also honours per-OS revisionOverrides (WebKit), so the
# check errs towards keeping a browser, never towards deleting a needed one.
playwright_referenced_revisions() {
  local links="$1/.links" f core
  [ -d "$links" ] || return 0
  for f in "$links"/*; do
    [ -f "$f" ] || continue
    core="$(cat "$f")"
    [ -f "$core/browsers.json" ] && grep -oE '"[0-9]{3,6}"' "$core/browsers.json" | tr -d '"'
  done | sort -u
}
