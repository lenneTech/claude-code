#!/usr/bin/env bash
# repo-expert.sh — which live session is the expert for the repository a path belongs to?
#
# A session whose working directory is a repository has built the context there: what it
# changed and why, which files it read, the tests it ran, the conventions it follows, the
# uncommitted work in the tree. A session reaching into that repository from outside (a fix
# in a base repo found from a customer project, a review finding in another session's code)
# has less of it. So before this session implements a change in a repository it does not
# work in, and a live session does, the user decides whether the change is handed over to
# that expert session. This script answers the question the rule depends on, deterministically,
# instead of leaving it to a guess from session names.
#
# Usage: bash repo-expert.sh <path inside the target repository>
#
# Output (one field per line, experts tab-separated):
#   target: <repository root of the path>
#   this-session: <repository root this session works in, or "outside any repository">
#   expert<TAB><pid><TAB><root>     one line per live peer working in the target repository
#   verdict: SELF | HANDOVER-QUESTION | NONE | UNKNOWN
#   <one line saying what to do>
#
#   SELF               this session works in the target repository itself: it is an expert
#                      there, so it implements; peers in the same repository are experts too
#                      and coordinate as usual (ledger, CLAIM)
#   HANDOVER-QUESTION  a live peer works in the target repository and this session does not:
#                      ask the user whether to hand the change over to that session
#   NONE               no live session works there: implement, coordinating through the ledger
#   UNKNOWN            peers cannot be scanned (cross-session messaging unavailable, native
#                      Windows), the scan was cut off at LIVE_PEERS_MAX_SCAN (default 64), or a
#                      live peer's directory is unreadable: check ListAgents,
#                      whose generated names usually start with the session's directory name,
#                      and ask the user when a row could be the expert
#
# Repositories are compared by their common git directory, so a peer in another worktree of
# the same repository (an `lt ticket` worktree, say) counts as working in the same project.
# This session's own directory is CLAUDE_PROJECT_DIR when set (hooks), otherwise the working
# directory of its Claude Code process (CLAUDE_PID), which stays put when the shell changes
# directory, otherwise the shell's directory.

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# The library caps its scan at 12 sockets to keep the SessionStart hook fast. A user with more
# sessions than that would get NONE ("implement") while an expert sits past the cap, the one
# answer this script must never give wrongly. Run on demand, it scans further (an lsof per peer,
# about 50 ms each), and a scan that is still cut off answers UNKNOWN.
LIVE_PEERS_MAX_SCAN="${LIVE_PEERS_MAX_SCAN:-64}"
# shellcheck source=lib/live-peers.sh
. "$SCRIPT_DIR/lib/live-peers.sh"

# Physical path of a repository's common git directory, or empty when $1 is not in one.
common_dir() {
  local dir="$1" cd
  [ -n "$dir" ] || return 0
  cd="$(git -C "$dir" rev-parse --path-format=absolute --git-common-dir 2>/dev/null)" || return 0
  [ -n "$cd" ] && (cd "$cd" 2>/dev/null && pwd -P)
}

path="${1:-}"
if [ -z "$path" ]; then
  echo "usage: repo-expert.sh <path inside the target repository>" >&2
  exit 2
fi
probe="$path"
[ -d "$probe" ] || probe="$(dirname "$probe")"
while [ ! -d "$probe" ] && [ "$probe" != "/" ] && [ "$probe" != "." ]; do probe="$(dirname "$probe")"; done

target_root="$(git -C "$probe" rev-parse --show-toplevel 2>/dev/null || true)"
if [ -z "$target_root" ]; then
  echo "repo-expert: $path is not inside a git repository" >&2
  exit 2
fi
target_root="$(cd "$target_root" && pwd -P)"
target_common="$(common_dir "$target_root")"

own_dir="${CLAUDE_PROJECT_DIR:-}"
if [ -z "$own_dir" ] && [ -n "${CLAUDE_PID:-}" ]; then own_dir="$(_live_peer_cwd "$CLAUDE_PID")"; fi
[ -n "$own_dir" ] || own_dir="$PWD"
own_root="$(git -C "$own_dir" rev-parse --show-toplevel 2>/dev/null || true)"
own_common="$(common_dir "$own_root")"

echo "target: $target_root"
echo "this-session: ${own_root:-outside any repository}"

if [ -n "$own_common" ] && [ "$own_common" = "$target_common" ]; then
  echo "verdict: SELF"
  echo "This session works in the target repository and is an expert there: implement, coordinating with peers in the same repository through the ledger as usual."
  exit 0
fi

scan_possible=1
[ -n "${CLAUDE_CODE_MESSAGING_SOCKET:-}" ] || scan_possible=0
case "$(uname -s 2>/dev/null)" in MINGW*|MSYS*|CYGWIN*) scan_possible=0 ;; esac

experts=0
unreadable=0
truncated=0
if [ "$scan_possible" -eq 1 ]; then
  sock_dir="${CLAUDE_CODE_MESSAGING_SOCKET%/*}"
  peer_sockets=0
  for s in "$sock_dir"/*.sock; do
    [ -e "$s" ] && [ "$s" != "$CLAUDE_CODE_MESSAGING_SOCKET" ] && peer_sockets=$((peer_sockets + 1))
  done
  [ "$peer_sockets" -gt "$LIVE_PEERS_MAX_SCAN" ] && truncated=1
  while IFS="$(printf '\t')" read -r pid root; do
    [ -n "$pid" ] || continue
    if [ -z "$root" ]; then unreadable=$((unreadable + 1)); continue; fi
    if [ "$(common_dir "$root")" = "$target_common" ]; then
      printf 'expert\t%s\t%s\n' "$pid" "$root"
      experts=$((experts + 1))
    fi
  done <<EOF
$(scan_live_peers)
EOF
fi

if [ "$experts" -gt 0 ]; then
  echo "verdict: HANDOVER-QUESTION"
  echo "A live session works in this repository and this one does not: ask the user whether to hand the change over to it (match the pid to its ListAgents name by uptime) before implementing it here."
elif [ "$scan_possible" -eq 0 ] || [ "$unreadable" -gt 0 ] || [ "$truncated" -eq 1 ]; then
  echo "verdict: UNKNOWN"
  echo "Live sessions could not be fully resolved. Check ListAgents: a row whose name starts with this repository's directory name is probably its expert, and then the handover is the user's question."
else
  echo "verdict: NONE"
  echo "No live session works in this repository: implement, and claim the work in the ledger first."
fi
exit 0
