#!/bin/bash
# Tests for scripts/change-provenance.sh — mtime classification against the
# session window, peer attribution by repository, and the resulting verdict.
#
# Run: bash scripts/__tests__/change-provenance.test.sh

set -u

SCRIPT="$(cd "$(dirname "$0")/.." && pwd)/change-provenance.sh"
PASS=0
FAIL=0

assert_contains() {
  local actual="$1" needle="$2" label="$3"
  if echo "$actual" | grep -qF "$needle"; then
    PASS=$((PASS + 1)); echo "  ✓ $label"
  else
    FAIL=$((FAIL + 1)); echo "  ✗ $label"
    echo "    expected to contain: $needle"
    echo "    actual: $actual"
  fi
}

assert_not_contains() {
  local actual="$1" needle="$2" label="$3"
  if echo "$actual" | grep -qF "$needle"; then
    FAIL=$((FAIL + 1)); echo "  ✗ $label"
    echo "    expected NOT to contain: $needle"
  else
    PASS=$((PASS + 1)); echo "  ✓ $label"
  fi
}

TMP_ROOT="$(mktemp -d)"; TMP_ROOT="$(cd "$TMP_ROOT" && pwd -P)"
cleanup() {
  kill "${SESSION_PID:-}" "${PEER_PID:-}" 2>/dev/null
  rm -rf "$TMP_ROOT"
}
trap cleanup EXIT

REPO="$TMP_ROOT/repo"
mkdir -p "$REPO"
git -C "$REPO" init -q
git -C "$REPO" config user.email test@test.com
git -C "$REPO" config user.name "Test"
echo "one" > "$REPO/tracked.txt"
echo "two" > "$REPO/other.txt"
git -C "$REPO" add -A
git -C "$REPO" commit -qm "base"

SOCKS="$TMP_ROOT/socks"; mkdir -p "$SOCKS"

# A stand-in for this session's own process: freshly started, so its lifetime
# begins now and any file with an older mtime must classify as pre-session.
sleep 120 &
SESSION_PID=$!
disown "$SESSION_PID" 2>/dev/null

run() {
  # No socket by default: peer discovery stays off unless a case enables it.
  env -u CLAUDE_CODE_MESSAGING_SOCKET "$@" bash -c "cd '$REPO' && CLAUDE_PID=\$CLAUDE_PID bash '$SCRIPT' 2>&1"
}

echo "change-provenance.sh"

# --- clean tree ------------------------------------------------------------
out="$(run CLAUDE_PID="$SESSION_PID")"
assert_contains "$out" "origin-question: NOT-NEEDED" "a clean tree with no peer needs no question"
assert_contains "$out" "the working tree is clean" "reports the clean tree"

# --- a path older than the session ----------------------------------------
echo "changed by somebody else" > "$REPO/tracked.txt"
touch -t 202001010900 "$REPO/tracked.txt"
out="$(run CLAUDE_PID="$SESSION_PID")"
assert_contains "$out" "pre-session" "classifies a path older than the session as pre-session"
assert_contains "$out" "origin-question: UNATTRIBUTABLE" "no live peer in this checkout leaves it unattributable"
assert_contains "$out" "pre-session=1" "counts the pre-session path"

# --- a path written during the session ------------------------------------
echo "written now" > "$REPO/other.txt"
out="$(run CLAUDE_PID="$SESSION_PID")"
assert_contains "$out" "in-session" "classifies a freshly written path as in-session"
assert_contains "$out" "in-session=1" "counts the in-session path separately"

# --- a deleted path has no mtime and never forces a question ---------------
git -C "$REPO" checkout -q -- tracked.txt
rm -f "$REPO/other.txt"
git -C "$REPO" rm -q --cached other.txt >/dev/null 2>&1
out="$(run CLAUDE_PID="$SESSION_PID")"
assert_contains "$out" "no-mtime" "a path gone from disk classifies as no-mtime"
assert_not_contains "$out" "origin-question: WARRANTED" "a deleted path alone does not warrant a question"
git -C "$REPO" reset -q --hard HEAD

# --- session start unreadable ---------------------------------------------
# Above the default pid_max on macOS and Linux, so it can never be live.
echo "orphan" > "$REPO/tracked.txt"
out="$(run CLAUDE_PID=999999)"
assert_contains "$out" "origin-question: INCONCLUSIVE" "an unreadable session start yields INCONCLUSIVE, not a guess"
assert_contains "$out" "start time unavailable" "says why classification was impossible"

# --- a live peer sharing the checkout -------------------------------------
if command -v node >/dev/null 2>&1; then
  # Start the peer stand-in without a subshell: a subshell would inherit the
  # EXIT trap and delete the fixtures when it ends.
  pushd "$REPO" >/dev/null || exit 1
  node -e 'setTimeout(function(){}, 30000)' >/dev/null 2>&1 &
  PEER_PID=$!
  disown "$PEER_PID" 2>/dev/null
  popd >/dev/null || exit 1
  : > "$SOCKS/$PEER_PID.sock"

  touch -t 202001010900 "$REPO/tracked.txt"
  out="$(env CLAUDE_CODE_MESSAGING_SOCKET="$SOCKS/$SESSION_PID.sock" CLAUDE_PID="$SESSION_PID" \
    bash -c "cd '$REPO' && bash '$SCRIPT' 2>&1")"
  assert_contains "$out" "this repository" "attributes a peer in the same checkout"
  assert_contains "$out" "origin-question: WARRANTED" "pre-session path plus a peer in the checkout warrants the question"
  assert_contains "$out" "ORIGIN message" "names the message to send"

  # Same peer, but nothing older than the session: authorship is merely possible.
  touch "$REPO/tracked.txt"
  out="$(env CLAUDE_CODE_MESSAGING_SOCKET="$SOCKS/$SESSION_PID.sock" CLAUDE_PID="$SESSION_PID" \
    bash -c "cd '$REPO' && bash '$SCRIPT' 2>&1")"
  assert_contains "$out" "origin-question: POSSIBLE" "an in-session path with a peer in the checkout is POSSIBLE, not WARRANTED"

  kill "$PEER_PID" 2>/dev/null
else
  echo "  - skipped live-peer cases (node not available)"
fi

# --- outside a repository -------------------------------------------------
out="$(cd "$TMP_ROOT" && CLAUDE_PID="$SESSION_PID" bash "$SCRIPT" 2>&1)"
assert_contains "$out" "not a git repository" "refuses to run outside a git repository"

# --- explicit base --------------------------------------------------------
out="$(cd "$REPO" && CLAUDE_PID="$SESSION_PID" bash "$SCRIPT" --base HEAD 2>&1)"
assert_contains "$out" "resolved from explicit" "honours an explicit --base"
out="$(cd "$REPO" && CLAUDE_PID="$SESSION_PID" bash "$SCRIPT" --base nope/nope 2>&1)"
assert_contains "$out" "unresolved:nope/nope" "reports an unresolvable base instead of falling back silently"

echo ""
echo "passed: $PASS, failed: $FAIL"
[ "$FAIL" -eq 0 ] || exit 1
