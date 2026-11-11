#!/bin/bash
# Tests for hooks/scripts/update-lt-plugins-scheduled.sh, which the lt-dev hooks module
# starts from a running session twice a day: it starts the background updater only when
# the last run is LT_PLUGINS_SCHEDULE_SECONDS old (or missing or unreadable), never while
# another run holds the lock, and never under the hook opt-outs.
#
# The script runs from a copy next to a stand-in background updater that only records
# that it was started, so no test reaches npm or `lt claude plugins`.
#
# Run: bash hooks/scripts/__tests__/update-lt-plugins-scheduled.test.sh

set -u

SRC_DIR="$(cd "$(dirname "$0")/.." && pwd)"

PASS=0
FAIL=0

pass() { PASS=$((PASS + 1)); echo "  ✓ $1"; }
fail() { FAIL=$((FAIL + 1)); echo "  ✗ $1"; }

TMP_ROOT="$(mktemp -d)"
trap 'rm -rf "$TMP_ROOT"' EXIT

BIN="$TMP_ROOT/scripts"
mkdir -p "$BIN"
cp "$SRC_DIR/update-lt-plugins-scheduled.sh" "$SRC_DIR/_lt-plugins-config.sh" "$SRC_DIR/_headless-skip.sh" "$BIN/"
cat > "$BIN/update-lt-plugins-background.sh" <<'STUB'
#!/bin/bash
echo started >> "$CLAUDE_PLUGIN_DATA/started"
STUB

# Runs the script against a fresh state directory; prints "started" when the background
# updater ran within two seconds, "idle" otherwise. $1 is the last-run file content
# ("-" for no file); further arguments are extra environment assignments.
run_case() {
  local last="$1"; shift
  local data="$TMP_ROOT/data-$RANDOM$RANDOM"
  mkdir -p "$data"
  [ "$last" = "-" ] || printf '%s\n' "$last" > "$data/update-last-run"
  [ -n "${HOLD_LOCK:-}" ] && { mkdir "$data/update.lock.d"; echo $$ > "$data/update.lock.d/pid"; }
  env CLAUDE_CODE_ENTRYPOINT=cli LT_PLUGIN_HOOKS_SKIP= CLAUDE_PLUGIN_DATA="$data" "$@" \
    "$BASH" "$BIN/update-lt-plugins-scheduled.sh" < /dev/null > /dev/null 2>&1
  local i
  for i in $(seq 1 20); do
    [ -s "$data/started" ] && { echo started; return; }
    sleep 0.1
  done
  echo idle
}

NOW=$(date +%s)

echo "schedule"
[ "$(run_case "$NOW")" = idle ] && pass "a run less than 12 hours ago starts nothing" || fail "a run less than 12 hours ago starts nothing"
[ "$(run_case $((NOW - 11 * 3600)))" = idle ] && pass "an 11-hour-old run starts nothing" || fail "an 11-hour-old run starts nothing"
[ "$(run_case $((NOW - 12 * 3600 - 5)))" = started ] && pass "a 12-hour-old run starts the updater" || fail "a 12-hour-old run starts the updater"
[ "$(run_case -)" = started ] && pass "a machine without a recorded run starts the updater" || fail "a machine without a recorded run starts the updater"
[ "$(run_case garbage)" = started ] && pass "an unreadable stamp counts as no run" || fail "an unreadable stamp counts as no run"

echo "guards"
[ "$(HOLD_LOCK=1 run_case $((NOW - 13 * 3600)))" = idle ] && pass "a live lock holder keeps a second run from starting" || fail "a live lock holder keeps a second run from starting"
[ "$(run_case $((NOW - 13 * 3600)) LT_PLUGIN_HOOKS_SKIP=1)" = idle ] && pass "LT_PLUGIN_HOOKS_SKIP opts out" || fail "LT_PLUGIN_HOOKS_SKIP opts out"
[ "$(run_case $((NOW - 13 * 3600)) CLAUDE_CODE_ENTRYPOINT=sdk-cli)" = idle ] && pass "a headless session starts nothing" || fail "a headless session starts nothing"

echo
echo "$PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
