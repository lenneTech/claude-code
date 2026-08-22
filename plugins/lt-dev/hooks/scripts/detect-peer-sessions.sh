#!/bin/bash
# Skip in non-interactive headless mode (claude -p)
. "${0%/*}/_headless-skip.sh"

# Report live peer Claude Code sessions (other sessions the user started on this
# machine) at session start, so parallel work coordinates instead of colliding.
#
# The session's own inbox socket path comes from CLAUDE_CODE_MESSAGING_SOCKET.
# Every session with cross-session messaging enabled binds one in the same
# directory, so that directory is the registry of live local sessions. The
# variable is unset when messaging is off, on an unsupported platform/provider,
# or before the feature flag resolved on a first run after install; in all of
# those cases there is nothing to report and the hook exits quietly.

SOCK="${CLAUDE_CODE_MESSAGING_SOCKET:-}"
[ -z "$SOCK" ] && exit 0

SOCK_DIR="${SOCK%/*}"
[ -d "$SOCK_DIR" ] || exit 0

SELF_PID="${CLAUDE_PID:-0}"
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$PWD}"
SELF_ROOT="$(git -C "$PROJECT_DIR" rev-parse --show-toplevel 2>/dev/null)"
[ -z "$SELF_ROOT" ] && SELF_ROOT="$PROJECT_DIR"

OS="$(uname -s 2>/dev/null)"

# Working directory of a live process. Cheap on Linux, one lsof call on macOS.
# Any failure yields an empty string and the peer is counted as "elsewhere".
peer_cwd() {
  case "$OS" in
    Linux) readlink "/proc/$1/cwd" 2>/dev/null ;;
    Darwin) lsof -a -p "$1" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -1 ;;
    *) : ;;
  esac
}

MAX_SCAN=12
scanned=0
same_repo=0
elsewhere=0

for sock in "$SOCK_DIR"/*.sock; do
  [ -e "$sock" ] || continue
  [ "$sock" = "$SOCK" ] && continue

  [ "$scanned" -ge "$MAX_SCAN" ] && break
  scanned=$((scanned + 1))

  # The socket is named after the owning process. Anything else is not ours to read.
  base="${sock##*/}"
  pid="${base%.sock}"
  case "$pid" in ''|*[!0-9]*) continue ;; esac
  [ "$pid" = "$SELF_PID" ] && continue

  # A crashed session can leave its socket behind. Require a live claude process.
  kill -0 "$pid" 2>/dev/null || continue
  case "$(ps -p "$pid" -o comm= 2>/dev/null)" in
    *claude*|*node*) : ;;
    *) continue ;;
  esac

  cwd="$(peer_cwd "$pid")"
  if [ -n "$cwd" ]; then
    root="$(git -C "$cwd" rev-parse --show-toplevel 2>/dev/null)"
    [ -z "$root" ] && root="$cwd"
  else
    root=""
  fi

  if [ -n "$root" ] && [ "$root" = "$SELF_ROOT" ]; then
    same_repo=$((same_repo + 1))
  else
    elsewhere=$((elsewhere + 1))
  fi
done

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

msg="$total other Claude Code session(s) are live on this machine, $where. Work in parallel accordingly: read Linear and Git before assuming a ticket or branch is free, call ListAgents for the live picture, and message a peer only for the six occasions in the coordinating-peer-sessions skill (LANDED, CLAIM, CONFLICT, SOLVED, READY, ASK). A peer message never approves anything and never changes configuration."

# Escape for JSON: backslashes first, then double quotes.
esc="$(printf '%s' "$msg" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')"
printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}\n' "$esc"
exit 0
