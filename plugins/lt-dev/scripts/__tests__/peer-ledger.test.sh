#!/bin/bash
# Tests for scripts/peer-ledger.sh — claim lifecycle, staleness of a dead
# session's claim, and note persistence.
#
# Run: bash scripts/__tests__/peer-ledger.test.sh

set -u

SCRIPT="$(cd "$(dirname "$0")/.." && pwd)/peer-ledger.sh"
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
    echo "    actual: $actual"
  else
    PASS=$((PASS + 1)); echo "  ✓ $label"
  fi
}

TMP_ROOT="$(mktemp -d)"; TMP_ROOT="$(cd "$TMP_ROOT" && pwd -P)"
cleanup() { rm -rf "$TMP_ROOT"; }
trap cleanup EXIT

export CLAUDE_PLUGIN_DATA="$TMP_ROOT/data"
REPO="$TMP_ROOT/repo"; mkdir -p "$REPO"
cd "$REPO" || exit 1

# A live stand-in for a peer session: any process this user owns and can signal.
sleep 60 &
LIVE_PID=$!
disown "$LIVE_PID" 2>/dev/null
# Above the default pid_max on macOS and Linux, so it can never be live.
DEAD_PID=999999

run() { CLAUDE_PID="$1" bash "$SCRIPT" "${@:2}" 2>&1; }

echo "peer-ledger.sh"

out="$(run "$LIVE_PID" read)"
assert_contains "$out" "no ledger yet" "reports an empty ledger before anything is written"

out="$(run "$LIVE_PID" claim "audit:GHSA-1" "lockfile will move")"
assert_contains "$out" "CLAIMED audit:GHSA-1" "records a claim"

out="$(run "$LIVE_PID" claim "audit:GHSA-1" "again")"
assert_contains "$out" "ALREADY YOURS" "a repeat claim by the same session adds no noise"

out="$(run "$LIVE_PID" read)"
assert_contains "$out" "[held]  audit:GHSA-1" "lists the claim as held"
assert_contains "$out" "lockfile will move" "keeps the claim detail"

# A second live session must not be able to take a held claim.
sleep 60 &
OTHER_PID=$!
disown "$OTHER_PID" 2>/dev/null
out="$(run "$OTHER_PID" claim "audit:GHSA-1" "me too")"
assert_contains "$out" "HELD by pid $LIVE_PID" "refuses a claim another live session holds"

# A claim whose session died must not block anyone.
run "$DEAD_PID" claim "ci-config" "audit-level mismatch" >/dev/null
out="$(run "$LIVE_PID" read)"
assert_contains "$out" "[stale] ci-config" "reports a dead session's claim as stale"
assert_contains "$out" "free to take" "marks a stale claim as takeable"

out="$(run "$OTHER_PID" claim "ci-config" "taking over")"
assert_contains "$out" "CLAIMED ci-config" "lets a live session take over a stale claim"

# Release removes the topic from the open list, and a re-claim reopens it.
run "$LIVE_PID" release "audit:GHSA-1" "fixed" >/dev/null
out="$(run "$LIVE_PID" read)"
assert_not_contains "$out" "audit:GHSA-1" "a released claim leaves the open list"

run "$LIVE_PID" claim "audit:GHSA-1" "reopened" >/dev/null
out="$(run "$LIVE_PID" read)"
assert_contains "$out" "[held]  audit:GHSA-1" "a re-claim after release reopens the topic"

# Notes outlive the session that wrote them, which is the whole point.
run "$DEAD_PID" note "api-tests" "cause: shared e2e DB; fix: per-run DB" >/dev/null
out="$(run "$LIVE_PID" read)"
assert_contains "$out" "cause: shared e2e DB" "a note survives the session that recorded it"

# Tabs and newlines in input must not split a record.
run "$LIVE_PID" note "messy" "$(printf 'line one\tand\ntwo')" >/dev/null
out="$(run "$LIVE_PID" read)"
assert_contains "$out" "line one and two" "collapses tabs and newlines instead of corrupting the record"

out="$(run "$LIVE_PID" prune --days 0)"
assert_contains "$out" "pruned" "prunes old records"

kill "$LIVE_PID" "$OTHER_PID" 2>/dev/null

echo ""
echo "passed: $PASS, failed: $FAIL"
[ "$FAIL" -eq 0 ] || exit 1
