#!/bin/bash
# live-peers.sh — discover the other Claude Code sessions alive on this machine.
#
# Sourced, never executed. Provides scan_live_peers(), which prints one
# tab-separated line per live peer session:
#
#   <pid>\t<repo-root-or-cwd-or-empty>
#
# Discovery runs through the messaging-socket directory: every session with
# cross-session messaging enabled binds one socket there, named after its own
# process, so that directory is the registry of live local sessions. When
# CLAUDE_CODE_MESSAGING_SOCKET is unset — messaging off, an unsupported
# platform or provider, or the feature flag unresolved on a first run after
# install — there is nothing to discover and the function prints nothing.
#
# The third field is deliberately allowed to be empty: a peer whose working
# directory cannot be read is still a live peer, and reporting it as
# unattributable is honest where guessing a repository is not.
#
# Callers:
#   hooks/scripts/detect-peer-sessions.sh — counts peers at session start
#   scripts/change-provenance.sh          — attributes unexplained changes

LIVE_PEERS_MAX_SCAN="${LIVE_PEERS_MAX_SCAN:-12}"

# Working directory of a live process. Cheap on Linux, one lsof call on macOS.
# Any failure yields an empty string.
_live_peer_cwd() {
  case "$(uname -s 2>/dev/null)" in
    Linux) readlink "/proc/$1/cwd" 2>/dev/null ;;
    Darwin) lsof -a -p "$1" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -1 ;;
    *) : ;;
  esac
}

scan_live_peers() {
  local sock="${CLAUDE_CODE_MESSAGING_SOCKET:-}"
  [ -n "$sock" ] || return 0

  local dir="${sock%/*}"
  [ -d "$dir" ] || return 0

  local self_pid="${CLAUDE_PID:-0}"
  local scanned=0 s base pid cwd root

  for s in "$dir"/*.sock; do
    [ -e "$s" ] || continue
    [ "$s" = "$sock" ] && continue

    [ "$scanned" -ge "$LIVE_PEERS_MAX_SCAN" ] && break
    scanned=$((scanned + 1))

    # The socket is named after the owning process. Anything else is not ours to read.
    base="${s##*/}"
    pid="${base%.sock}"
    case "$pid" in ''|*[!0-9]*) continue ;; esac
    [ "$pid" = "$self_pid" ] && continue

    # A crashed session can leave its socket behind. Require a live claude process.
    kill -0 "$pid" 2>/dev/null || continue
    case "$(ps -p "$pid" -o comm= 2>/dev/null)" in
      *claude*|*node*) : ;;
      *) continue ;;
    esac

    cwd="$(_live_peer_cwd "$pid")"
    root=""
    if [ -n "$cwd" ]; then
      root="$(git -C "$cwd" rev-parse --show-toplevel 2>/dev/null || true)"
      [ -n "$root" ] || root="$cwd"
    fi

    printf '%s\t%s\n' "$pid" "$root"
  done
}
