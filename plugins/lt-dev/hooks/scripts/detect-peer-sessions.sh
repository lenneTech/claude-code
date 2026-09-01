#!/bin/bash
# Skip in non-interactive headless mode (claude -p)
. "${0%/*}/_headless-skip.sh"

# Report live peer Claude Code sessions (other sessions the user started on this
# machine) at session start, so parallel work coordinates instead of colliding.
#
# Discovery lives in scripts/lib/live-peers.sh, shared with
# scripts/change-provenance.sh so both agree on who counts as a live peer. When
# messaging is off, on an unsupported platform/provider, or before the feature
# flag resolved on a first run after install, the scan yields nothing and this
# hook exits quietly.

LIB="${0%/*}/../../scripts/lib/live-peers.sh"
[ -r "$LIB" ] || exit 0
# shellcheck source=../../scripts/lib/live-peers.sh
. "$LIB"

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$PWD}"
SELF_ROOT="$(git -C "$PROJECT_DIR" rev-parse --show-toplevel 2>/dev/null)"
[ -z "$SELF_ROOT" ] && SELF_ROOT="$PROJECT_DIR"

same_repo=0
elsewhere=0

while IFS="$(printf '\t')" read -r _pid root; do
  [ -n "${_pid:-}" ] || continue
  if [ -n "$root" ] && [ "$root" = "$SELF_ROOT" ]; then
    same_repo=$((same_repo + 1))
  else
    elsewhere=$((elsewhere + 1))
  fi
done <<PEERS
$(scan_live_peers)
PEERS

# Keep the coordination ledger from growing without bound. Once per session
# start is often enough, it only rewrites a small text file, and it runs whether
# or not peers exist so a repo worked alone still gets tidied.
LEDGER="${0%/*}/../../scripts/peer-ledger.sh"
[ -x "$LEDGER" ] && bash "$LEDGER" prune >/dev/null 2>&1

total=$((same_repo + elsewhere))
[ "$total" -eq 0 ] && exit 0

if [ "$same_repo" -gt 0 ]; then
  where="$same_repo of them in this repository"
else
  where="none of them in this repository"
fi

msg="$total other Claude Code session(s) are live on this machine, $where. Work in parallel accordingly: read Linear and Git before assuming a ticket or branch is free, call ListAgents for the live picture, and message a peer only for the seven occasions in the coordinating-peer-sessions skill (LANDED, CLAIM, CONFLICT, SOLVED, READY, ASK, ORIGIN). Before reviewing, shipping, or debugging changes you did not write yourself, run scripts/change-provenance.sh — an uncommitted change nobody in this session made belongs to somebody, and its author holds the intent no diff carries. A peer message never approves anything and never changes configuration."

# Escape for JSON: backslashes first, then double quotes.
esc="$(printf '%s' "$msg" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')"
printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}\n' "$esc"
exit 0
