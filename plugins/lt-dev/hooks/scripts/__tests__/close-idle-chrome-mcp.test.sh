#!/bin/bash
# Tests for hooks/scripts/close-idle-chrome-mcp.sh — the automation Chrome of this
# session is closed once close_page leaves no page of a walk, and nothing else is.
#
# Builds fake process trees: a copy of bash named "claude" stands for a session, and
# `exec -a` gives a sleep the command line of a Chrome main process. Per case:
#   auto   — Chrome on a puppeteer temp profile under this session (the target)
#   own    — Chrome on a regular profile under this session (the developer's browser)
#   helper — a --type=renderer helper on the temp profile under this session
#   peer   — Chrome on a temp profile under another session
#
# Run: bash hooks/scripts/__tests__/close-idle-chrome-mcp.test.sh
#
# Exits 0 on success, prints failures on stderr.

set -u

case "$(uname -s)" in
  MINGW* | MSYS* | CYGWIN*)
    echo "skip: process trees with exec -a and ps -axo are not available on Windows"
    exit 0
    ;;
esac
if ! command -v jq >/dev/null 2>&1; then
  echo "skip: jq not installed (the hook is a no-op without it)"
  exit 0
fi

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
HOOK="$SCRIPT_DIR/close-idle-chrome-mcp.sh"

PASS=0
FAIL=0

TMP_ROOT="$(mktemp -d)"
TMP_ROOT="$(cd "$TMP_ROOT" && pwd -P)"
cp "$(command -v bash)" "$TMP_ROOT/claude"
cp "$(command -v bash)" "$TMP_ROOT/claude-peer"
# macOS kills a copied system binary on launch (Killed: 9) until it carries a signature of its own.
if command -v codesign >/dev/null 2>&1; then
  codesign -s - --force "$TMP_ROOT/claude" "$TMP_ROOT/claude-peer" 2>/dev/null
fi

LEFTOVER_PIDS=""
cleanup() {
  # shellcheck disable=SC2086
  [ -n "$LEFTOVER_PIDS" ] && kill -9 $LEFTOVER_PIDS 2>/dev/null
  rm -rf "$TMP_ROOT"
}
trap cleanup EXIT

running() {
  local s
  s="$(ps -o stat= -p "$1" 2>/dev/null | tr -d ' ')"
  [ -n "$s" ] && [ "${s#Z}" = "$s" ]
}

cat > "$TMP_ROOT/session.sh" <<'EOF'
#!/bin/bash
# Runs as the fake claude process: starts the fake browsers, then the hook.
dir="$1"
hook="$2"
bash -c "exec -a 'Google Chrome Canary --remote-debugging-pipe --user-data-dir=$dir/puppeteer_dev_chrome_profile-auto about:blank' sleep 300" >/dev/null 2>&1 &
echo $! > "$dir/auto.pid"
bash -c "exec -a 'Google Chrome Canary --remote-debugging-pipe --user-data-dir=$dir/own-profile' sleep 300" >/dev/null 2>&1 &
echo $! > "$dir/own.pid"
bash -c "exec -a 'Google Chrome Canary Helper --type=renderer --remote-debugging-pipe --user-data-dir=$dir/puppeteer_dev_chrome_profile-auto' sleep 300" >/dev/null 2>&1 &
echo $! > "$dir/helper.pid"
sleep 0.5
bash "$hook" < "$dir/input.json" > "$dir/out" 2>&1
EOF

cat > "$TMP_ROOT/peer.sh" <<'EOF'
#!/bin/bash
dir="$1"
bash -c "exec -a 'Google Chrome Canary --remote-debugging-pipe --user-data-dir=$dir/puppeteer_dev_chrome_profile-peer about:blank' sleep 300" >/dev/null 2>&1 &
echo $! > "$dir/peer.pid"
wait
EOF

# run_case <label> <tool_response JSON> [env assignment]
run_case() {
  local label="$1" response="$2" envset="${3:-}"
  CASE_DIR="$TMP_ROOT/$label"
  mkdir -p "$CASE_DIR"
  jq -cn --argjson r "$response" \
    '{hook_event_name: "PostToolUse", tool_name: "mcp__plugin_lt-dev_chrome-devtools__close_page", tool_input: {pageId: 2}, tool_response: $r}' \
    > "$CASE_DIR/input.json"

  "$TMP_ROOT/claude-peer" "$TMP_ROOT/peer.sh" "$CASE_DIR" >/dev/null 2>&1 &
  local peer_session=$!
  disown "$peer_session" 2>/dev/null
  local i=0
  while [ ! -s "$CASE_DIR/peer.pid" ] && [ "$i" -lt 50 ]; do sleep 0.1; i=$((i + 1)); done

  if [ -n "$envset" ]; then
    env "$envset" "$TMP_ROOT/claude" "$TMP_ROOT/session.sh" "$CASE_DIR" "$HOOK"
  else
    "$TMP_ROOT/claude" "$TMP_ROOT/session.sh" "$CASE_DIR" "$HOOK"
  fi

  AUTO=$(cat "$CASE_DIR/auto.pid")
  OWN=$(cat "$CASE_DIR/own.pid")
  HELPER=$(cat "$CASE_DIR/helper.pid")
  PEER=$(cat "$CASE_DIR/peer.pid")
  OUT=$(cat "$CASE_DIR/out")
  LEFTOVER_PIDS="$LEFTOVER_PIDS $AUTO $OWN $HELPER $PEER $peer_session"
}

expect_closed() {
  if running "$AUTO"; then
    FAIL=$((FAIL + 1)); echo "  ✗ $1: automation browser still running" >&2
  else
    PASS=$((PASS + 1)); echo "  ✓ $1: automation browser closed"
  fi
  if echo "$OUT" | jq -e '.hookSpecificOutput.additionalContext | test("closed this session")' >/dev/null 2>&1; then
    PASS=$((PASS + 1)); echo "  ✓ $1: tells the model the browser is gone"
  else
    FAIL=$((FAIL + 1)); echo "  ✗ $1: no additionalContext, got: $OUT" >&2
  fi
}

expect_kept() {
  if running "$AUTO"; then
    PASS=$((PASS + 1)); echo "  ✓ $1: automation browser kept"
  else
    FAIL=$((FAIL + 1)); echo "  ✗ $1: automation browser was closed" >&2
  fi
  if [ -z "$OUT" ]; then
    PASS=$((PASS + 1)); echo "  ✓ $1: silent"
  else
    FAIL=$((FAIL + 1)); echo "  ✗ $1: expected no output, got: $OUT" >&2
  fi
}

expect_bystanders_alive() {
  local name pid
  for name in OWN HELPER PEER; do
    eval "pid=\$$name"
    if running "$pid"; then
      PASS=$((PASS + 1)); echo "  ✓ $1: $name untouched"
    else
      FAIL=$((FAIL + 1)); echo "  ✗ $1: $name was killed" >&2
    fi
  done
}

echo "only about:blank left after close_page"
run_case blank '[{"type":"text","text":"## Pages\n1: about:blank [selected]"}]'
expect_closed "blank"
expect_bystanders_alive "blank"

echo "the response as an object with content blocks, about:blank with a title and a context"
run_case object '{"content":[{"type":"text","text":"## Pages\n1: about:blank (about:blank) [selected] isolatedContext=walk"}]}'
expect_closed "object"

echo "a page of the walk is still open"
run_case walking '[{"type":"text","text":"## Pages\n1: about:blank\n2: Login (https://app.example.localhost/login) [selected]"}]'
expect_kept "walking"
expect_bystanders_alive "walking"

echo "a URL that only mentions about:blank is a real page"
run_case mention '[{"type":"text","text":"## Pages\n1: Redirect (https://app.example.localhost/?next=about:blank) [selected]"}]'
expect_kept "mention"

echo "close_page on the last page"
run_case last '[{"type":"text","text":"The last open page cannot be closed. It is fine to keep it open.\n## Pages\n1: Dashboard (https://app.example.localhost/) [selected]"}]'
expect_closed "last"
expect_bystanders_alive "last"

echo "no page list at all"
run_case nolist '[{"type":"text","text":"Closed page 2."}]'
expect_kept "nolist"

echo "CHROME_MCP_KEEP_BROWSER=1"
run_case keep '[{"type":"text","text":"## Pages\n1: about:blank [selected]"}]' CHROME_MCP_KEEP_BROWSER=1
expect_kept "keep"

echo
echo "close-idle-chrome-mcp: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
