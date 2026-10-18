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

printf '[lt-dev] auto-update applied:\n- Claude Code plugins updated:\n    lt-dev@lenneTech: 8.25.0 → 8.25.1\n' > "$DATA/update-notification.txt"
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
for needle in 'lt-dev@lenneTech: 8.25.0 → 8.25.1' 'lt-dev Auto-Update' 'Folgende Claude Code Plugins wurden aktualisiert' '/reload-plugins' 'neu installiert' 'continue with the user'; do
  case "$CTX" in *"$needle"*) pass "context contains: $needle" ;; *) fail "context contains: $needle" ;; esac
done
[ ! -e "$DATA/update-notification.txt" ] && pass "the notification is consumed" || fail "the notification is consumed"
# Only a person can run /reload-plugins (the Skill tool does not reach it), so the notice asks the
# user to type it instead of telling Claude to run it (observed 2026-10-18).
case "$CTX" in *'Tippe `/reload-plugins` ein'*) pass "the info block asks the user to type /reload-plugins" ;; *) fail "the info block asks the user to type /reload-plugins" ;; esac
case "$CTX" in *'run the slash command'*) fail "Claude is not told to run /reload-plugins itself" ;; *) pass "Claude is not told to run /reload-plugins itself" ;; esac

echo "wording at normal volume"
for loud in 'ACTION REQUIRED' 'MUST' 'CRITICAL' 'IMPORTANT'; do
  case "$CTX" in *"$loud"*) fail "no '$loud' framing" ;; *) pass "no '$loud' framing" ;; esac
done

echo "no notification"
OUT=$(run_hook)
[ -z "$OUT" ] && pass "silent without a pending notification" || { fail "silent without a pending notification"; echo "    actual: $OUT"; }

# The background updater compares installed_plugins.json before and after `lt claude plugins`
# and writes one line per changed plugin. Observed 2026-10-18: the earlier `diff | head -n 20`
# cut the last two added lines of 11 updates, and the notice reported two updated plugins as
# removed. Here npm and lt are stand-ins on PATH; lt rewrites the manifest like the real one.
BG="$SCRIPT_DIR/update-lt-plugins-background.sh"
# $1 = jq program building the manifest after the update from the one before (on stdin).
run_background() {
  local after_prog="$1" fake="$TMP_ROOT/fake" home="$TMP_ROOT/home"
  rm -rf "$fake" "$home" "$TMP_ROOT/bgdata"
  mkdir -p "$fake" "$home/.claude/plugins" "$TMP_ROOT/bgdata"
  printf '%s\n' "$BEFORE" > "$home/.claude/plugins/installed_plugins.json"
  printf '%s\n' "$BEFORE" | jq "$after_prog" > "$TMP_ROOT/after.json"
  printf '#!/bin/bash\n[ "$1 $2" = "root -g" ] && echo "%s/npmroot"\nexit 0\n' "$TMP_ROOT" > "$fake/npm"
  printf '#!/bin/bash\n[ "$1 $2" = "claude plugins" ] && cp "%s/after.json" "%s/.claude/plugins/installed_plugins.json"\nexit 0\n' \
    "$TMP_ROOT" "$home" > "$fake/lt"
  chmod +x "$fake/npm" "$fake/lt"
  if [ "${2:-}" = "prewarm" ]; then
    # No stamp, so the pre-warm runs; the npx stand-in records its arguments.
    printf '#!/bin/bash\necho "$*" >> "%s/npx-args"\nexit 0\n' "$TMP_ROOT" > "$fake/npx"
    chmod +x "$fake/npx"
    rm -f "$TMP_ROOT/npx-args"
  else
    # A fresh pre-warm stamp keeps the updater from downloading MCP packages.
    date +%s > "$TMP_ROOT/bgdata/mcp-prewarm.stamp"
  fi
  env HOME="$home" CLAUDE_PLUGIN_DATA="$TMP_ROOT/bgdata" PATH="$fake:$PATH" "$BASH" "$BG" < /dev/null > /dev/null 2>&1
  cat "$TMP_ROOT/bgdata/update-notification.txt" 2>/dev/null
}
entry() { printf '"%s":[{"scope":"user","version":"%s","gitCommitSha":"%s"}]' "$1" "$2" "$3"; }

echo "background updater pairs every changed plugin"
if command -v jq >/dev/null 2>&1; then
  # 11 updated plugins plus an unchanged one that sorts between them.
  BEFORE='{"version":2,"plugins":{'
  for i in 01 02 03 04 05 06 07 08 09 10 11; do BEFORE="$BEFORE$(entry "plug-$i@market" "1.0.$i" "aaaaaaa$i"),"; done
  BEFORE="$BEFORE$(entry "plug-05-stable@market" "3.0.0" "ccccccc")}}"
  NOTE=$(run_background '.plugins |= with_entries(if .key == "plug-05-stable@market" then . else .value[0].version |= sub("^1"; "2") | .value[0].gitCommitSha = "bbbbbbb" end)')
  missing=""
  for i in 01 02 03 04 05 06 07 08 09 10 11; do
    case "$NOTE" in *"plug-$i@market: 1.0.$i → 2.0.$i"*) ;; *) missing="$missing plug-$i" ;; esac
  done
  [ -z "$missing" ] && pass "all 11 updated plugins appear as 'old → new'" || { fail "updated plugins missing:$missing"; printf '%s\n' "$NOTE" | sed 's/^/      /'; }
  case "$NOTE" in *entfernt*) fail "no plugin is reported as removed" ;; *) pass "no plugin is reported as removed" ;; esac
  case "$NOTE" in *plug-05-stable*) fail "the unchanged plugin is not listed" ;; *) pass "the unchanged plugin is not listed" ;; esac
  n=$(printf '%s\n' "$NOTE" | grep -c '@market: ')
  [ "$n" -eq 11 ] && pass "one line per changed plugin" || fail "one line per changed plugin (got $n)"

  # A fresh install and a removal are named as such.
  NOTE=$(run_background '.plugins["fresh@market"] = [{"version":"0.1.0","gitCommitSha":"ddddddd"}] | del(.plugins["plug-01@market"])')
  case "$NOTE" in *'fresh@market: neu installiert (0.1.0)'*) pass "a fresh install is named" ;; *) fail "a fresh install is named"; printf '%s\n' "$NOTE" ;; esac
  case "$NOTE" in *'plug-01@market: entfernt (war 1.0.01)'*) pass "a removal is named" ;; *) fail "a removal is named"; printf '%s\n' "$NOTE" ;; esac

  # Past the cap, the last line counts what was left out instead of dropping it silently.
  BEFORE='{"version":2,"plugins":{}}'
  NOTE=$(run_background '.plugins = ([range(45)] | map({key: "many-\(. + 100)@market", value: [{version: "1.0.0", gitCommitSha: "e"}]}) | from_entries)')
  case "$NOTE" in *'… 5 weitere Plugins nicht aufgeführt'*) pass "a capped list names how many were left out" ;; *) fail "a capped list names how many were left out"; printf '%s\n' "$NOTE" | tail -3 ;; esac

  # The pre-warm runs in the project directory; npm would read that project's .npmrc
  # (`node-options=--require=…` runs the repository's code) unless npx gets a prefix of
  # its own. Observed 2026-10-18.
  run_background '.' prewarm > /dev/null
  ARGS=$(cat "$TMP_ROOT/npx-args" 2>/dev/null)
  case "$ARGS" in *"--prefix $TMP_ROOT/home/.cache/lt-dev/npx-prefix -y chrome-devtools-mcp@"*) pass "the pre-warm runs npx with its own prefix" ;; *) fail "the pre-warm runs npx with its own prefix (got: ${ARGS:-no npx call})" ;; esac
else
  echo "  - skipped: the updater needs jq to compare manifests"
fi

echo ""
echo "─────────────────────────────────────────"
echo "Total: $((PASS + FAIL)) | Passed: $PASS | Failed: $FAIL"
[ "$FAIL" -gt 0 ] && exit 1 || exit 0
