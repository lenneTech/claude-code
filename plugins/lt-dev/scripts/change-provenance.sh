#!/bin/bash
# change-provenance.sh — who wrote the changes in front of this session?
#
# A diff says what changed. It never says who decided it, or why. Most of the
# time that gap does not matter because the session looking at the diff is the
# session that wrote it. Three situations break that assumption, and all three
# are routine here:
#
#   1. Base-repo work stays UNCOMMITTED on the checked-out branch by house rule,
#      so a peer session's edit is in the tree with nothing on the record.
#   2. /clear and summarization drop this session's own memory while the process
#      and its files live on.
#   3. Two sessions share one checkout.
#   4. A session edits a repo it is NOT sitting in. This is not exotic here, it
#      is the rule: the smoke test mandates that a finding be fixed in the
#      matching base repo, so the runner is always in a different checkout than
#      the fix. Such a peer is reported as `elsewhere`, and it is still worth
#      asking — see the verdict section.
#
# This script separates what this process wrote from what it did not, and names
# the live sessions that could hold the missing intent. It reads only: git,
# file mtimes, and the messaging-socket registry. It sends nothing, writes
# nothing, and touches no file in the repository.
#
# What the classification can and cannot prove:
#
#   pre-session  mtime older than this process — this process did NOT write it.
#                That direction is reliable: a session does not backdate a file.
#   in-session   mtime inside this process's lifetime — this process wrote it,
#                OR a peer sharing the checkout did, OR it came from a checkout,
#                rebase, stash pop, or install that rewrote mtimes wholesale.
#                So `in-session` is weak evidence of authorship, never proof.
#   no-mtime     deleted paths have no mtime left to read. Classify from memory.
#
# Usage:
#   change-provenance.sh [--base <ref>] [--max-files N]
#
#   --base       compare commits against this ref (default: @{upstream}, then
#                origin/dev, origin/develop, origin/main, origin/master)
#   --max-files  cap the listed paths (default 40); the counts stay complete

set -u

BASE=""
MAX_FILES=40

usage() {
  sed -n '2,30p' "$0" | sed 's/^# \{0,1\}//'
}

while [ $# -gt 0 ]; do
  case "$1" in
    --base) BASE="${2:-}"; shift 2 ;;
    --base=*) BASE="${1#--base=}"; shift ;;
    --max-files) MAX_FILES="${2:-40}"; shift 2 ;;
    --max-files=*) MAX_FILES="${1#--max-files=}"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "change-provenance: unknown argument: $1" >&2; exit 2 ;;
  esac
done
case "$MAX_FILES" in ''|*[!0-9]*) MAX_FILES=40 ;; esac

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "change-provenance: not a git repository" >&2; exit 2; }

LIB="$(cd "$(dirname "$0")" && pwd)/lib/live-peers.sh"
# shellcheck source=lib/live-peers.sh
[ -r "$LIB" ] && . "$LIB"

# --- portability -----------------------------------------------------------
# GNU `stat -f` means --file-system and would silently print a mount point, so
# the format is chosen by platform rather than by trying one and falling back.
case "$(uname -s 2>/dev/null)" in
  Darwin|*BSD) MTIME_PRIMARY='-f %m'; MTIME_ALT='-c %Y' ;;
  *) MTIME_PRIMARY='-c %Y'; MTIME_ALT='-f %m' ;;
esac

file_mtime() {
  local v
  # shellcheck disable=SC2086
  v="$(stat $MTIME_PRIMARY "$1" 2>/dev/null || true)"
  # shellcheck disable=SC2086
  case "$v" in ''|*[!0-9]*) v="$(stat $MTIME_ALT "$1" 2>/dev/null || true)" ;; esac
  case "$v" in ''|*[!0-9]*) echo "" ;; *) echo "$v" ;; esac
}

fmt_time() {
  local e="${1:-}"
  [ -n "$e" ] || { echo "-"; return; }
  date -r "$e" '+%Y-%m-%d %H:%M' 2>/dev/null \
    || date -d "@$e" '+%Y-%m-%d %H:%M' 2>/dev/null \
    || echo "$e"
}

fmt_ago() {
  local s="${1:-0}" h m
  h=$((s / 3600)); m=$(((s % 3600) / 60))
  if [ "$h" -gt 0 ]; then echo "${h}h ${m}m ago"; else echo "${m}m ago"; fi
}

# `ps -o etimes=` (seconds) exists on Linux but not on macOS, whose ps only
# offers etime as [[dd-]hh:]mm:ss.
elapsed_from_etime() {
  local e d h m s
  e="$(printf '%s' "${1:-}" | tr -d ' ')"
  [ -n "$e" ] || return 0
  d=0
  case "$e" in *-*) d="${e%%-*}"; e="${e#*-}" ;; esac
  case "$e" in
    *:*:*) h="${e%%:*}"; e="${e#*:}"; m="${e%%:*}"; s="${e##*:}" ;;
    *:*) h=0; m="${e%%:*}"; s="${e##*:}" ;;
    *) return 0 ;;
  esac
  for part in "$d" "$h" "$m" "$s"; do
    case "$part" in ''|*[!0-9]*) return 0 ;; esac
  done
  echo $(( (10#$d * 86400) + (10#$h * 3600) + (10#$m * 60) + 10#$s ))
}

# --- session window --------------------------------------------------------
NOW="$(date +%s)"
SESSION_PID="${CLAUDE_PID:-0}"
SESSION_START=""
SESSION_AGE=""

if [ "$SESSION_PID" != "0" ] && kill -0 "$SESSION_PID" 2>/dev/null; then
  secs="$(ps -p "$SESSION_PID" -o etimes= 2>/dev/null | tr -d ' ' || true)"
  case "$secs" in ''|*[!0-9]*) secs="$(elapsed_from_etime "$(ps -p "$SESSION_PID" -o etime= 2>/dev/null || true)")" ;; esac
  case "$secs" in
    ''|*[!0-9]*) : ;;
    *) SESSION_AGE="$secs"; SESSION_START=$((NOW - secs)) ;;
  esac
fi

# --- base ref --------------------------------------------------------------
resolve_base() {
  local cand
  if [ -n "$BASE" ]; then
    git rev-parse --verify --quiet "$BASE" >/dev/null 2>&1 && { echo "$BASE|explicit"; return; }
    echo "|unresolved:$BASE"; return
  fi
  cand="$(git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null || true)"
  if [ -n "$cand" ]; then echo "$cand|@{upstream}"; return; fi
  for cand in origin/dev origin/develop origin/main origin/master; do
    git rev-parse --verify --quiet "$cand" >/dev/null 2>&1 && { echo "$cand|fallback"; return; }
  done
  echo "|none"
}

base_info="$(resolve_base)"
BASE_REF="${base_info%%|*}"
BASE_SRC="${base_info#*|}"

echo "# change provenance"
echo "repo:    $ROOT"
if [ -n "$SESSION_START" ]; then
  echo "session: pid $SESSION_PID, started $(fmt_time "$SESSION_START") ($(fmt_ago "$SESSION_AGE"))"
else
  echo "session: start time unavailable (CLAUDE_PID unset or process not readable) — mtime classification is not possible"
fi
if [ -n "$BASE_REF" ]; then
  echo "base:    $BASE_REF (resolved from $BASE_SRC)"
else
  echo "base:    none ($BASE_SRC) — the commit section is skipped"
fi
echo ""

# --- commits since base ----------------------------------------------------
commits_pre=0
if [ -n "$BASE_REF" ]; then
  commit_lines="$(git log --no-merges --format='%H%x09%at%x09%an%x09%s' "$BASE_REF..HEAD" 2>/dev/null || true)"
  commit_total=0
  [ -n "$commit_lines" ] && commit_total="$(printf '%s\n' "$commit_lines" | grep -c . || true)"
  echo "## commits since base ($commit_total)"
  if [ "$commit_total" -eq 0 ]; then
    echo "none"
  else
    shown=0
    while IFS="$(printf '\t')" read -r sha at an subj; do
      [ -n "${sha:-}" ] || continue
      class="unknown"
      if [ -n "$SESSION_START" ]; then
        if [ "$at" -lt "$SESSION_START" ]; then class="pre-session"; commits_pre=$((commits_pre + 1)); else class="in-session"; fi
      fi
      if [ "$shown" -lt "$MAX_FILES" ]; then
        printf '%-11s  %s  %s  %-18s %s\n' "$class" "$(echo "$sha" | cut -c1-8)" "$(fmt_time "$at")" "$an" "$subj"
        shown=$((shown + 1))
      fi
    done <<COMMITS
$commit_lines
COMMITS
    [ "$commit_total" -gt "$shown" ] && echo "... $((commit_total - shown)) more"
    echo ""
    echo "Git already explains these: subject, author, and date are on the record, and"
    echo "the ticket id in the branch or subject carries the rest. They are context, not"
    echo "a reason to message anybody."
  fi
  echo ""
fi

# --- uncommitted paths -----------------------------------------------------
status_lines="$(git status --porcelain 2>/dev/null || true)"
u_total=0; u_pre=0; u_in=0; u_nomtime=0
u_shown=0
u_out=""

if [ -n "$status_lines" ]; then
  while IFS= read -r line; do
    [ -n "$line" ] || continue
    code="$(printf '%s' "$line" | cut -c1-2)"
    path="$(printf '%s' "$line" | cut -c4-)"
    # Renames read as "old -> new"; the new path is the one on disk.
    case "$path" in *' -> '*) path="${path##* -> }" ;; esac
    # Quoted paths (non-ASCII or spaces) come back wrapped in double quotes.
    case "$path" in '"'*'"') path="${path#\"}"; path="${path%\"}" ;; esac

    u_total=$((u_total + 1))
    mt=""
    [ -e "$ROOT/$path" ] && mt="$(file_mtime "$ROOT/$path")"

    if [ -z "$mt" ]; then
      class="no-mtime"; u_nomtime=$((u_nomtime + 1)); when="(gone from disk)"
    elif [ -z "$SESSION_START" ]; then
      class="unknown"; when="$(fmt_time "$mt")"
    elif [ "$mt" -lt "$SESSION_START" ]; then
      class="pre-session"; u_pre=$((u_pre + 1)); when="$(fmt_time "$mt")"
    else
      class="in-session"; u_in=$((u_in + 1)); when="$(fmt_time "$mt")"
    fi

    if [ "$u_shown" -lt "$MAX_FILES" ]; then
      u_out="$u_out$(printf '%-11s  %-2s  %-58s %s' "$class" "$code" "$path" "$when")
"
      u_shown=$((u_shown + 1))
    fi
  done <<STATUS
$status_lines
STATUS
fi

echo "## uncommitted paths ($u_total)"
if [ "$u_total" -eq 0 ]; then
  echo "none — the working tree is clean"
else
  printf '%s' "$u_out"
  [ "$u_total" -gt "$u_shown" ] && echo "... $((u_total - u_shown)) more"
  echo ""
  echo "Nothing on the record explains these. A pre-session path was not written by"
  echo "this process, so its author and its reason live somewhere else."
fi
echo ""

# --- live peers ------------------------------------------------------------
peers_here=0; peers_elsewhere=0; peers_unknown=0
peer_out=""
if command -v scan_live_peers >/dev/null 2>&1; then
  while IFS="$(printf '\t')" read -r pid root; do
    [ -n "${pid:-}" ] || continue
    if [ -z "$root" ]; then
      peers_unknown=$((peers_unknown + 1))
      peer_out="$peer_out$(printf '%-17s pid %-8s %s' "unattributable" "$pid" "(working directory unreadable)")
"
    elif [ "$root" = "$ROOT" ]; then
      peers_here=$((peers_here + 1))
      peer_out="$peer_out$(printf '%-17s pid %-8s %s' "this repository" "$pid" "$root")
"
    else
      peers_elsewhere=$((peers_elsewhere + 1))
      peer_out="$peer_out$(printf '%-17s pid %-8s %s' "elsewhere" "$pid" "$root")
"
    fi
  done <<PEERS
$(scan_live_peers)
PEERS
fi

peer_total=$((peers_here + peers_elsewhere + peers_unknown))
echo "## live peer sessions ($peer_total)"
if [ "$peer_total" -eq 0 ]; then
  echo "none reachable — either no other session is running, or cross-session messaging"
  echo "is unavailable here (see the coordinating-peer-sessions skill)"
else
  printf '%s' "$peer_out"
  echo ""
  echo "ListAgents gives these sessions their addressable names; this listing gives them"
  echo "a repository. Match them by uptime and repo before addressing one."
fi
echo ""

# --- verdict ---------------------------------------------------------------
unexplained=$((u_pre))
askable=$((peers_here + peers_unknown))

echo "## verdict"
if [ -z "$SESSION_START" ]; then
  status="INCONCLUSIVE"
  reason="This session's start time could not be read, so nothing can be attributed by mtime."
  action="Attribute from the commit record and your own memory of this conversation. Ask only what remains genuinely unexplained."
elif [ "$u_total" -eq 0 ] && [ "$commits_pre" -eq 0 ]; then
  status="NOT-NEEDED"
  reason="The tree is clean and every commit since the base was made inside this session's window."
  action="Nothing to attribute. Do not message anybody about provenance."
elif [ "$unexplained" -eq 0 ] && [ "$askable" -eq 0 ]; then
  status="NOT-NEEDED"
  reason="No uncommitted path predates this session, and no peer shares this checkout."
  action="Treat the changes as this session's own. Where your own memory does not cover one (after /clear or a summarization), reconstruct it from the diff rather than asking a peer."
elif [ "$unexplained" -gt 0 ] && [ "$askable" -gt 0 ]; then
  status="WARRANTED"
  reason="$unexplained uncommitted path(s) predate this session, and $askable peer session(s) could hold the intent."
  action="Send ONE ORIGIN message to the peer(s) that share this checkout, naming the paths. Carry on with work that does not depend on the answer; never block on it."
elif [ "$unexplained" -gt 0 ] && [ "$peers_elsewhere" -gt 0 ]; then
  status="WARRANTED-CROSS-REPO"
  reason="$unexplained uncommitted path(s) predate this session. No live peer shares this checkout, but $peers_elsewhere session(s) are live in another one — and editing a repo you are not sitting in is the NORM in this stack, not an exception (the smoke test requires a finding to be fixed in its base repo, so the runner is never in the repo it fixes)."
  action="Check the ledger FIRST (peer-ledger.sh read): a claim names the repository, which is what identifies a cross-repo author — the working directory cannot. If no claim covers these paths, send ONE ORIGIN message to the sessions listed as 'elsewhere', naming the paths. Carry on meanwhile; never block on the answer."
elif [ "$unexplained" -gt 0 ]; then
  status="UNATTRIBUTABLE"
  reason="$unexplained uncommitted path(s) predate this session, and no live peer exists in any checkout."
  action="The author is gone (session closed) or it was this process before its context was cleared. Reconstruct intent from the diff, the ticket, and the ledger (peer-ledger.sh read); state the reconstruction as an assumption in your report. Nobody to ask."
else
  status="POSSIBLE"
  reason="Every uncommitted path carries an mtime from this session's window, but $askable peer session(s) share this checkout, and in-session mtimes do not prove authorship."
  action="Check the paths against your own memory of this conversation. Ask only about the ones you cannot account for."
fi

echo "origin-question: $status"
echo "$reason"
echo "$action"
echo ""
echo "counts: uncommitted=$u_total (pre-session=$u_pre, in-session=$u_in, no-mtime=$u_nomtime) | commits-before-session=$commits_pre | peers-here=$peers_here, elsewhere=$peers_elsewhere, unattributable=$peers_unknown"
exit 0
