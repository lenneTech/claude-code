#!/usr/bin/env bash
# Tests for scripts/repo-expert.sh — which live session is the expert for a repository.
#
# A live peer is simulated the way change-provenance.test.sh does it: a node process whose
# working directory is the repository, plus a socket file named after its pid in a private
# socket directory. The session under test is the shell itself (CLAUDE_PID=$$).
#
# Run: bash scripts/__tests__/repo-expert.test.sh

set -u

SCRIPT="$(cd "$(dirname "$0")/.." && pwd)/repo-expert.sh"
PASS=0
FAIL=0
pass() { PASS=$((PASS + 1)); echo "  ✓ $1"; }
fail() { FAIL=$((FAIL + 1)); echo "  ✗ $1"; }
assert_contains() { if printf '%s' "$1" | grep -qF -- "$2"; then pass "$3"; else fail "$3"; echo "    expected: $2"; echo "    actual:   $1"; fi; }
assert_not_contains() { if printf '%s' "$1" | grep -qF -- "$2"; then fail "$3"; echo "    unexpected: $2"; else pass "$3"; fi; }

TMP_ROOT="$(mktemp -d)"
PEERS=""
cleanup() { for p in $PEERS; do kill "$p" 2>/dev/null; done; rm -rf "$TMP_ROOT"; }
trap cleanup EXIT

mkrepo() { mkdir -p "$1" && git -C "$1" init -q && git -C "$1" -c user.email=t@test.com -c user.name=t commit -q --allow-empty -m init; }
TARGET="$TMP_ROOT/target"; mkrepo "$TARGET"; mkdir -p "$TARGET/src/deep"
MINE="$TMP_ROOT/mine"; mkrepo "$MINE"
SOCKS="$TMP_ROOT/socks"; mkdir -p "$SOCKS"
: > "$SOCKS/$$.sock"

# $1 = directory the session under test runs in, $2 = path asked about, rest = extra env
run() {
  local own="$1" path="$2"; shift 2
  env CLAUDE_CODE_MESSAGING_SOCKET="$SOCKS/$$.sock" CLAUDE_PID=$$ CLAUDE_PROJECT_DIR="$own" "$@" \
    bash -c "cd '$own' && bash '$SCRIPT' '$path' 2>&1"
}

# Start a live peer stand-in whose working directory is $1. No subshell: it would inherit the
# EXIT trap and delete the fixtures when it ends.
start_peer() {
  pushd "$1" >/dev/null || exit 1
  node -e 'setTimeout(function(){}, 60000)' >/dev/null 2>&1 &
  local pid=$!
  disown "$pid" 2>/dev/null
  popd >/dev/null || exit 1
  : > "$SOCKS/$pid.sock"
  PEERS="$PEERS $pid"
  echo "$pid"
}

windows() { case "$(uname -s 2>/dev/null)" in MINGW*|MSYS*|CYGWIN*) return 0 ;; esac; return 1; }

echo "no live peer anywhere"
out="$(run "$MINE" "$TARGET/src")"
# Native Windows cannot scan peers (no socket directory), and says so instead of answering NONE.
if windows; then want="verdict: UNKNOWN"; else want="verdict: NONE"; fi
assert_contains "$out" "$want" "a repository nobody else works in has no expert (UNKNOWN where peers cannot be scanned)"
assert_contains "$out" "target: $(cd "$TARGET" && pwd -P)" "names the repository the path belongs to"

echo "this session works in the target itself"
out="$(run "$TARGET" "$TARGET/src/deep")"
assert_contains "$out" "verdict: SELF" "a session in the target repository is its expert and asks nobody"

echo "messaging unavailable"
out="$(env -u CLAUDE_CODE_MESSAGING_SOCKET CLAUDE_PID=$$ CLAUDE_PROJECT_DIR="$MINE" bash -c "cd '$MINE' && bash '$SCRIPT' '$TARGET' 2>&1")"
assert_contains "$out" "verdict: UNKNOWN" "without cross-session messaging the answer is unknown, never NONE"
out="$(env -u CLAUDE_CODE_MESSAGING_SOCKET CLAUDE_PID=$$ CLAUDE_PROJECT_DIR="$TARGET" bash -c "cd '$TARGET' && bash '$SCRIPT' '$TARGET' 2>&1")"
assert_contains "$out" "verdict: SELF" "being in the target needs no peer scan"

echo "outside a repository"
out="$(run "$MINE" "$TMP_ROOT")"
assert_contains "$out" "not inside a git repository" "refuses a path outside any repository"

if windows; then
  echo "  - skipped live-peer cases: the socket scan does not run on native Windows"
elif command -v node >/dev/null 2>&1; then
  echo "a live peer works in the target"
  PEER="$(start_peer "$TARGET/src")"
  sleep 0.3
  out="$(run "$MINE" "$TARGET/src/deep/file.ts")"
  assert_contains "$out" "verdict: HANDOVER-QUESTION" "a live peer in the target makes the handover a question for the user"
  assert_contains "$out" "expert	$PEER" "names the expert peer's pid"

  out="$(run "$TARGET" "$TARGET/src")"
  assert_contains "$out" "verdict: SELF" "a peer in the same repository does not outrank a session that also works there"

  echo "a peer in a worktree of the target repository"
  kill "$PEER" 2>/dev/null
  WT="$TMP_ROOT/target-wt"
  git -C "$TARGET" worktree add -q -b wt "$WT" 2>/dev/null
  PEER2="$(start_peer "$WT")"
  sleep 0.3
  out="$(run "$MINE" "$TARGET")"
  assert_contains "$out" "verdict: HANDOVER-QUESTION" "a worktree of the same repository counts as the same project"
  assert_contains "$out" "expert	$PEER2" "names the worktree peer"

  echo "a peer in an unrelated repository"
  kill "$PEER2" 2>/dev/null
  OTHER="$TMP_ROOT/other"; mkrepo "$OTHER"
  PEER3="$(start_peer "$OTHER")"
  sleep 0.3
  out="$(run "$MINE" "$TARGET")"
  assert_contains "$out" "verdict: NONE" "a peer in another repository is no expert for this one"
  assert_not_contains "$out" "expert	$PEER3" "does not list it"

  echo "a scan cut off at its cap"
  OTHER2="$TMP_ROOT/other2"; mkrepo "$OTHER2"
  PEER4="$(start_peer "$OTHER2")"
  sleep 0.3
  out="$(run "$MINE" "$TARGET" LIVE_PEERS_MAX_SCAN=1)"
  assert_contains "$out" "verdict: UNKNOWN" "a truncated scan never claims that nobody works there"
else
  echo "  - skipped live-peer cases (node not available)"
fi

echo ""
echo "passed: $PASS, failed: $FAIL"
[ "$FAIL" -eq 0 ] || exit 1
