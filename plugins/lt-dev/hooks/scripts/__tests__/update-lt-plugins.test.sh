#!/bin/bash
# Tests for hooks/scripts/update-lt-plugins.sh: a pending update notification becomes
# SessionStart additionalContext (valid JSON, the German info block, the reload step),
# is consumed once, and is worded as project information at normal volume. The hooks
# reference warns that text framed as an out-of-band system command can trigger
# Claude's prompt-injection defenses, so Claude shows it to the user instead of acting.
#
# Run: bash hooks/scripts/__tests__/update-lt-plugins.test.sh
#
# Exits 0 on success, prints failures on stdout.

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
HOOK="$SCRIPT_DIR/update-lt-plugins.sh"

PASS=0
FAIL=0

pass() { PASS=$((PASS + 1)); echo "  ✓ $1"; }
fail() { FAIL=$((FAIL + 1)); echo "  ✗ $1"; }

TMP_ROOT="$(mktemp -d)"
trap 'rm -rf "$TMP_ROOT"' EXIT

DATA="$TMP_ROOT/data"
mkdir -p "$DATA"
# A recent last-run stamp keeps the hook from starting the background updater, and
# CLAUDE_PLUGIN_ROOT is unset for the same reason.
date +%s > "$DATA/update-last-run"

run_hook() {
  env -u CLAUDE_PLUGIN_ROOT CLAUDE_CODE_ENTRYPOINT= LT_PLUGIN_HOOKS_SKIP= CLAUDE_PLUGIN_DATA="$DATA" \
    "$BASH" "$HOOK" < /dev/null 2>/dev/null
}

printf '< lt-dev@lenneTech 8.25.0 abc1234\n> lt-dev@lenneTech 8.25.1 def5678\n' > "$DATA/update-notification.txt"
OUT=$(run_hook)
CTX=$(printf '%s' "$OUT" | node -e '
  const o = JSON.parse(require("fs").readFileSync(0, "utf8")).hookSpecificOutput;
  if (o.hookEventName === "SessionStart") process.stdout.write(o.additionalContext);' 2>/dev/null)

echo "pending notification"
if command -v jq >/dev/null 2>&1; then
  [ -n "$CTX" ] && pass "emits valid SessionStart additionalContext JSON" || { fail "emits valid SessionStart additionalContext JSON"; echo "    actual: $OUT"; }
else
  # Without jq the script prints the text itself, which SessionStart adds to the context.
  CTX=$OUT
  [ -n "$CTX" ] && pass "without jq: prints the report as plain SessionStart stdout" || fail "without jq: prints the report as plain SessionStart stdout"
fi
for needle in 'lt-dev@lenneTech 8.25.1' 'lt-dev Auto-Update' 'Folgende Claude Code Plugins wurden aktualisiert' '/reload-plugins' 'neu installiert' 'continue with the user'; do
  case "$CTX" in *"$needle"*) pass "context contains: $needle" ;; *) fail "context contains: $needle" ;; esac
done
[ ! -e "$DATA/update-notification.txt" ] && pass "the notification is consumed" || fail "the notification is consumed"

echo "wording at normal volume"
for loud in 'ACTION REQUIRED' 'MUST' 'CRITICAL' 'IMPORTANT'; do
  case "$CTX" in *"$loud"*) fail "no '$loud' framing" ;; *) pass "no '$loud' framing" ;; esac
done

echo "no notification"
OUT=$(run_hook)
[ -z "$OUT" ] && pass "silent without a pending notification" || { fail "silent without a pending notification"; echo "    actual: $OUT"; }

echo ""
echo "─────────────────────────────────────────"
echo "Total: $((PASS + FAIL)) | Passed: $PASS | Failed: $FAIL"
[ "$FAIL" -gt 0 ] && exit 1 || exit 0
