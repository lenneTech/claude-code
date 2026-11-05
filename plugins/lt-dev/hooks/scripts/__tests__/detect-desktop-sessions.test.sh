#!/bin/bash
# Tests for hooks/scripts/detect-desktop-sessions.sh: silent outside Claude Desktop and without a switch of accounts,
# no Node process on those paths (the hook runs at every Desktop session start), one hint per newly found session.
#
# Run: bash hooks/scripts/__tests__/detect-desktop-sessions.test.sh
#
# Exits 0 on success, prints failures on stderr.

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
HOOK="$SCRIPT_DIR/detect-desktop-sessions.sh"

PASS=0
FAIL=0

ok() { PASS=$((PASS + 1)); echo "  ✓ $1"; }
ko() {
  FAIL=$((FAIL + 1))
  echo "  ✗ $1"
  if [ -n "${2:-}" ]; then echo "    $2"; fi
  return 0 # `cond && ko … || ok …` must not count a failure as a pass as well
}

assert_silent() { if [ -z "$1" ]; then ok "$2"; else ko "$2" "expected no output, got: $1"; fi; }
assert_contains() { if printf '%s' "$1" | grep -q -- "$2"; then ok "$3"; else ko "$3" "expected '$2' in: $1"; fi; }
assert_not_contains() { if printf '%s' "$1" | grep -q -- "$2"; then ko "$3" "did not expect '$2' in: $1"; else ok "$3"; fi; }

TMP="$(mktemp -d)"
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT

APP="$TMP/app"
CFG="$TMP/config"
DATA="$TMP/data"
PROJECT="$TMP/project"
mkdir -p "$APP/claude-code-sessions/acc-active/org-a" "$CFG/projects/p1" "$PROJECT"
printf '{"lastKnownAccountUuid":"acc-active","oauth:tokenCache":"SECRET-TOKEN-VALUE"}' > "$APP/config.json"

NOW_MS="$(node -e 'process.stdout.write(String(Date.now()))')"
# The folder goes into JSON that Node reads, so on Windows (Git Bash) it has to be a native path.
PROJECT_JSON="$PROJECT"
command -v cygpath >/dev/null 2>&1 && PROJECT_JSON="$(cygpath -m "$PROJECT")"
add_session() { # account id title [lastActivityAt in ms]
  local dir="$APP/claude-code-sessions/$1/org-b"
  mkdir -p "$dir"
  printf '{"cliSessionId":"%s","cwd":"%s","originCwd":"%s","isArchived":false,"lastActivityAt":%s,"title":"%s"}' \
    "$2" "$PROJECT_JSON" "$PROJECT_JSON" "${4:-$NOW_MS}" "$3" > "$dir/local_$2.json"
  printf '{"type":"user"}\n' > "$CFG/projects/p1/$2.jsonl"
}

# A node on PATH that only leaves a mark: the fast paths must never start it.
FAKEBIN="$TMP/fakebin"
mkdir -p "$FAKEBIN"
printf '#!/bin/sh\ntouch "%s/node-started"\n' "$TMP" > "$FAKEBIN/node"
chmod +x "$FAKEBIN/node"

run() { # entrypoint [extra env…]
  local entry="$1"
  shift
  env -u LT_PLUGIN_HOOKS_SKIP CLAUDE_CODE_ENTRYPOINT="$entry" LT_DESKTOP_APP_DIR="$APP" CLAUDE_CONFIG_DIR="$CFG" \
    CLAUDE_PLUGIN_DATA="$DATA" "$@" bash "$HOOK" 2>/dev/null
}
run_fake_node() { run "$1" PATH="$FAKEBIN:$PATH"; }
node_started() { [ -e "$TMP/node-started" ]; }

echo "detect-desktop-sessions.sh"

# --- not a Desktop session -------------------------------------------------
add_session acc-old 11111111-1111-4111-8111-111111111111 "Alte Session"
out="$(run_fake_node cli)"
assert_silent "$out" "silent in a terminal session, even with sessions of another account"
node_started && ko "no Node outside Claude Desktop" || ok "no Node outside Claude Desktop"

out="$(run sdk-cli)"
assert_silent "$out" "silent in headless mode"

# --- Desktop session, no switch of accounts ----------------------------------
rm -rf "$APP/claude-code-sessions/acc-old"
# In real use the active account always holds a fresh entry: the running Desktop session itself.
add_session acc-active 44444444-4444-4444-8444-444444444444 "Diese Session"
start="$(date +%s%N 2>/dev/null)"
out="$(run_fake_node claude-desktop)"
end="$(date +%s%N 2>/dev/null)"
assert_silent "$out" "silent in Desktop with only the active account"
node_started && ko "no Node without a second account" || ok "no Node without a second account"
case "$start$end" in
  *N*) ;;
  *) echo "    (fast path took $(((end - start) / 1000000)) ms)" ;;
esac

# --- Desktop session, other account only with old sessions -------------------
add_session acc-old 22222222-2222-4222-8222-222222222222 "Vor Wochen" "$((NOW_MS - 30 * 86400000))"
touch -t 202001010000 "$APP/claude-code-sessions/acc-old/org-b/local_22222222-2222-4222-8222-222222222222.json"
out="$(run_fake_node claude-desktop)"
assert_silent "$out" "silent when the other account has no session within the window"
node_started && ko "no Node for old sessions" || ok "no Node for old sessions"

# --- Desktop session after a switch ------------------------------------------
add_session acc-old 33333333-3333-4333-8333-333333333333 "Frische Session"
out="$(run claude-desktop)"
assert_contains "$out" '"hookEventName":"SessionStart"' "names the sessions of the previous account as SessionStart context"
assert_contains "$out" 'Frische Session' "names the session by its title"
assert_contains "$out" '/lt-dev:desktop-sessions' "points to the command"
assert_not_contains "$out" 'Vor Wochen' "leaves out sessions older than the window"
assert_not_contains "$out" 'SECRET' "never passes on anything else from config.json"

out="$(run claude-desktop)"
assert_silent "$out" "names every session only once"

# --- broken input never breaks a session start --------------------------------
printf 'not json' > "$APP/config.json"
out="$(run claude-desktop)"
rc=$?
assert_silent "$out" "silent when config.json is unreadable"
[ "$rc" -eq 0 ] && ok "exits 0 when config.json is unreadable" || ko "exits 0 when config.json is unreadable" "rc=$rc"

echo ""
echo "─────────────────────────────────────────"
echo "Total: $((PASS + FAIL)) | Passed: $PASS | Failed: $FAIL"
[ "$FAIL" -eq 0 ]
