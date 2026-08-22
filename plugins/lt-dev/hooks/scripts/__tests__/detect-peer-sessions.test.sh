#!/bin/bash
# Tests for hooks/scripts/detect-peer-sessions.sh — verifies peer discovery via
# the messaging-socket directory, liveness filtering, and same-repo attribution.
#
# Run: bash hooks/scripts/__tests__/detect-peer-sessions.test.sh
#
# Exits 0 on success, prints failures on stderr.

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
HOOK="$SCRIPT_DIR/detect-peer-sessions.sh"

PASS=0
FAIL=0

assert_contains() {
  local actual="$1" needle="$2" label="$3"
  if echo "$actual" | grep -q "$needle"; then
    PASS=$((PASS + 1)); echo "  ✓ $label"
  else
    FAIL=$((FAIL + 1)); echo "  ✗ $label"
    echo "    expected to contain: $needle"
    echo "    actual: $actual"
  fi
}

assert_silent() {
  local actual="$1" label="$2"
  if [ -z "$actual" ]; then
    PASS=$((PASS + 1)); echo "  ✓ $label"
  else
    FAIL=$((FAIL + 1)); echo "  ✗ $label"
    echo "    expected no output, got: $actual"
  fi
}

TMP_ROOT="$(mktemp -d)"
# macOS resolves /tmp through a symlink; lsof reports the physical path, so the
# test has to compare physical paths too or same-repo attribution never matches.
TMP_ROOT="$(cd "$TMP_ROOT" && pwd -P)"
cleanup() { rm -rf "$TMP_ROOT"; }
trap cleanup EXIT

run_hook() {
  env -u LT_PLUGIN_HOOKS_SKIP CLAUDE_CODE_ENTRYPOINT=cli "$@" bash "$HOOK" 2>/dev/null
}

echo "detect-peer-sessions.sh"

# --- messaging unavailable -------------------------------------------------
out="$(env -u CLAUDE_CODE_MESSAGING_SOCKET -u LT_PLUGIN_HOOKS_SKIP \
  CLAUDE_CODE_ENTRYPOINT=cli bash "$HOOK" 2>/dev/null)"
assert_silent "$out" "silent when CLAUDE_CODE_MESSAGING_SOCKET is unset"

out="$(run_hook CLAUDE_CODE_MESSAGING_SOCKET="$TMP_ROOT/nope/1.sock")"
assert_silent "$out" "silent when the socket directory does not exist"

# --- headless opt-out ------------------------------------------------------
SOCKS="$TMP_ROOT/socks"; mkdir -p "$SOCKS"
out="$(env CLAUDE_CODE_ENTRYPOINT=sdk-cli CLAUDE_CODE_MESSAGING_SOCKET="$SOCKS/1.sock" \
  bash "$HOOK" 2>/dev/null)"
assert_silent "$out" "silent in headless mode (claude -p)"

# --- no peers --------------------------------------------------------------
: > "$SOCKS/1.sock"
out="$(run_hook CLAUDE_CODE_MESSAGING_SOCKET="$SOCKS/1.sock" CLAUDE_PID=1)"
assert_silent "$out" "silent when only this session's socket is present"

# --- dead and malformed entries are ignored --------------------------------
# PID 999999 is above the default pid_max on both macOS and Linux, so it cannot
# be live; a crashed session leaving its socket behind must not count as a peer.
: > "$SOCKS/999999.sock"
: > "$SOCKS/not-a-pid.sock"
out="$(run_hook CLAUDE_CODE_MESSAGING_SOCKET="$SOCKS/1.sock" CLAUDE_PID=1)"
assert_silent "$out" "silent for a stale socket of a dead process and a non-numeric name"

# --- a live peer is reported ----------------------------------------------
if command -v node >/dev/null 2>&1; then
  PEER_DIR="$TMP_ROOT/peer-repo"; mkdir -p "$PEER_DIR"
  # Start the stand-in peer WITHOUT a subshell: a subshell inherits the EXIT
  # trap above and would fire cleanup when it ends, deleting the sockets this
  # case depends on.
  pushd "$PEER_DIR" >/dev/null || exit 1
  node -e 'setTimeout(function(){}, 20000)' >/dev/null 2>&1 &
  PEER_PID=$!
  disown "$PEER_PID" 2>/dev/null   # keep bash job control from printing "Terminated" on kill
  popd >/dev/null || exit 1
  : > "$SOCKS/$PEER_PID.sock"

  out="$(run_hook CLAUDE_CODE_MESSAGING_SOCKET="$SOCKS/1.sock" CLAUDE_PID=1 \
    CLAUDE_PROJECT_DIR="$TMP_ROOT/elsewhere")"
  assert_contains "$out" '"hookEventName":"SessionStart"' "emits a SessionStart context block"
  assert_contains "$out" "1 other Claude Code session" "counts the live peer"
  assert_contains "$out" "none of them in this repository" "attributes a peer in another directory as elsewhere"
  assert_contains "$out" "coordinating-peer-sessions" "names the skill that carries the protocol"

  out="$(run_hook CLAUDE_CODE_MESSAGING_SOCKET="$SOCKS/1.sock" CLAUDE_PID=1 \
    CLAUDE_PROJECT_DIR="$PEER_DIR")"
  assert_contains "$out" "1 of them in this repository" "attributes a peer in the same directory as same-repo"

  kill "$PEER_PID" 2>/dev/null
else
  echo "  - skipped live-peer cases (node not available)"
fi

# --- output stays valid JSON ----------------------------------------------
if command -v python3 >/dev/null 2>&1 && [ -n "${out:-}" ]; then
  if printf '%s' "$out" | python3 -c 'import json,sys; json.load(sys.stdin)' 2>/dev/null; then
    PASS=$((PASS + 1)); echo "  ✓ emits parseable JSON"
  else
    FAIL=$((FAIL + 1)); echo "  ✗ emits parseable JSON"
  fi
fi

echo ""
echo "passed: $PASS, failed: $FAIL"
[ "$FAIL" -eq 0 ] || exit 1
