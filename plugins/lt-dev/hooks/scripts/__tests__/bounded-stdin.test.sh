#!/bin/bash
# Tests for hooks/scripts/_read-stdin.sh and every hook that reads its payload through
# it: a stdin that never closes must not hold a hook until its hooks.json timeout.
#
# An unguarded `INPUT=$(cat)` waits for EOF forever. Observed in another plugin on
# Windows: a PowerShell wrapper swallowed EOF and froze sessions, and a UserPromptSubmit
# hook blocks the model for as long as it runs. Each hook here gets a stdin whose writer
# stays alive for 30 s; it has to exit within a few seconds anyway.
#
# Run: bash hooks/scripts/__tests__/bounded-stdin.test.sh
#
# Exits 0 on success, prints failures on stdout.

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

PASS=0
FAIL=0

pass() { PASS=$((PASS + 1)); echo "  ✓ $1"; }
fail() { FAIL=$((FAIL + 1)); echo "  ✗ $1"; }

TMP_ROOT="$(mktemp -d)"
trap 'rm -rf "$TMP_ROOT"' EXIT
PROJ="$TMP_ROOT/proj"
mkdir -p "$PROJ"
LIMIT=6   # seconds; the read gives up after 2 s, the writer would hold for 30 s
# Git Bash starts processes several times slower, and the cases run in parallel: on the
# v8.27.2 tag run (2026-10-19) windows-latest measured 2-7 s for hooks that all returned.
# 12 s still sits far below the writer's 30 s, so a hook that waits for EOF still fails.
case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*) LIMIT=12 ;; esac

hook_env() {
  env CLAUDE_CODE_ENTRYPOINT= LT_PLUGIN_HOOKS_SKIP= CLAUDE_PROJECT_DIR="$PROJ" \
    CLAUDE_SKIP_DANGEROUS_BASH_CHECK=0 CLAUDE_SKIP_CIRCUIT_BREAKER=0 CLAUDE_SKIP_FILE_PROTECTION=0 \
    LT_DEV_REGISTRY_PATH="$TMP_ROOT/none.json" "$@"
}

# $1 = case id, $2 = script, $3 = payload written before stdin stays open (may be ""),
# $4 = optional argument for the script.
# Writes "<seconds>" to $TMP_ROOT/$1.time and the hook's stdout to $TMP_ROOT/$1.out.
# The writer (a backgrounded sleep) is killed as soon as the hook exits, so the test
# itself never waits the 30 s. No mkfifo: Git Bash does not need to support FIFOs.
open_stdin_case() {
  local id="$1" script="$2" data="$3" pidf="$TMP_ROOT/$1.wpid" start=$SECONDS
  { printf '%s' "$data"; sleep 30 & echo $! > "$pidf"; wait; } 2>/dev/null |
    { hook_env "$BASH" "$SCRIPT_DIR/$script" ${4:+"$4"} > "$TMP_ROOT/$id.out" 2>/dev/null
      while [ ! -s "$pidf" ]; do sleep 0; done
      kill "$(cat "$pidf")" 2>/dev/null; }
  echo $((SECONDS - start)) > "$TMP_ROOT/$id.time"
}

SCRIPTS="_read-prompt.sh:detect-plugin-dev.sh post-compact-context.sh block-dangerous-bash.sh protect-files.sh
circuit-breaker.sh circuit-breaker-reset.sh circuit-breaker-cleanup.sh validate-plugin-frontmatter.sh
vendor-core-edit-guard.sh"

BASH_CMD='{"hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"rm -rf ~"}}'

echo "stdin that never closes (all cases run in parallel)"
i=0
for entry in $SCRIPTS; do
  i=$((i + 1))
  open_stdin_case "empty$i" "${entry#*:}" "" &
done
# A complete payload without EOF: bash 4+ keeps the partial read, so the guard still acts.
open_stdin_case "bashdata" block-dangerous-bash.sh "$BASH_CMD" &
# detect-lt-dev.sh reads the payload only in its SubagentStart mode.
open_stdin_case "subagent" detect-lt-dev.sh "" SubagentStart &
wait

i=0
for entry in $SCRIPTS; do
  i=$((i + 1))
  t=$(cat "$TMP_ROOT/empty$i.time" 2>/dev/null || echo 99)
  if [ "$t" -le "$LIMIT" ]; then pass "${entry%%:*} returns without EOF (${t}s)"; else fail "${entry%%:*} returned after ${t}s"; fi
done
t=$(cat "$TMP_ROOT/subagent.time" 2>/dev/null || echo 99)
if [ "$t" -le "$LIMIT" ]; then pass "detect-lt-dev.sh SubagentStart returns without EOF (${t}s)"; else fail "detect-lt-dev.sh SubagentStart returned after ${t}s"; fi
t=$(cat "$TMP_ROOT/bashdata.time" 2>/dev/null || echo 99)
if [ "$t" -le "$LIMIT" ]; then pass "a payload without EOF returns (${t}s)"; else fail "a payload without EOF returned after ${t}s"; fi
if [ "${BASH_VERSINFO[0]}" -ge 4 ]; then
  if grep -q '"permissionDecision":"deny"' "$TMP_ROOT/bashdata.out"; then pass "bash ${BASH_VERSION%%(*}: the payload read before the timeout is still checked"; else fail "bash ${BASH_VERSION%%(*}: payload without EOF was not checked"; cat "$TMP_ROOT/bashdata.out"; fi
else
  echo "  - bash ${BASH_VERSION%%(*} drops partial input on a read timeout: the hook fails open"
fi

echo "normal input"
OUT=$(printf '%s' "$BASH_CMD" | hook_env "$BASH" "$SCRIPT_DIR/block-dangerous-bash.sh" 2>/dev/null)
case "$OUT" in *'"permissionDecision":"deny"'*) pass "block-dangerous-bash still parses a closed stdin" ;; *) fail "block-dangerous-bash still parses a closed stdin"; echo "    actual: $OUT" ;; esac
mkdir -p "$TMP_ROOT/market/plugins/demo/.claude-plugin"
echo '{}' > "$TMP_ROOT/market/plugins/demo/.claude-plugin/plugin.json"
OUT=$(printf '{"hook_event_name":"UserPromptSubmit","prompt":"add a new skill"}' |
  hook_env CLAUDE_PROJECT_DIR="$TMP_ROOT/market" "$BASH" "$SCRIPT_DIR/detect-plugin-dev.sh" 2>/dev/null)
case "$OUT" in *developing-claude-plugins*) pass "_read-prompt.sh still reads the prompt" ;; *) fail "_read-prompt.sh still reads the prompt"; echo "    actual: $OUT" ;; esac
OUT=$(printf '{"session_id":"s","tool_name":"Bash","error":"boom"}\n\n' | hook_env "$BASH" -c '. "$1/_read-stdin.sh"; read_hook_input; printf "%s" "$HOOK_INPUT"' _ "$SCRIPT_DIR")
[ "$OUT" = "$(printf '{"session_id":"s","tool_name":"Bash","error":"boom"}\n\n')" ] && pass "the helper returns the payload byte for byte" || { fail "the helper returns the payload byte for byte"; printf '    actual: %q\n' "$OUT"; }

echo "large payload"
# A Write of a lockfile carries the whole file; the read must finish well inside the
# 3 s protect-files timeout, or the confirmation is skipped.
BIG=$(head -c 500000 /dev/zero | tr '\0' 'a')
start=$SECONDS
OUT=$(printf '{"hook_event_name":"PreToolUse","tool_name":"Write","tool_input":{"file_path":"%s/pnpm-lock.yaml","content":"%s"}}' "$PROJ" "$BIG" |
  hook_env "$BASH" "$SCRIPT_DIR/protect-files.sh" 2>/dev/null)
t=$((SECONDS - start))
case "$OUT" in *'"permissionDecision":'*'"ask"'*) pass "a 500 KB Write payload is read in full" ;; *) fail "a 500 KB Write payload is read in full"; echo "    actual: ${OUT:0:200}" ;; esac
if [ "$t" -le 2 ]; then pass "a 500 KB payload is read inside the hook timeout (${t}s)"; else fail "a 500 KB payload took ${t}s"; fi

echo ""
echo "─────────────────────────────────────────"
echo "Total: $((PASS + FAIL)) | Passed: $PASS | Failed: $FAIL"
[ "$FAIL" -gt 0 ] && exit 1 || exit 0
