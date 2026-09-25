#!/bin/bash
# Tests for the UserPromptSubmit detect hooks — the prompt must be read from the JSON
# payload on stdin (the only place Claude Code puts it), with and without jq, and paths
# written into the JSON output must keep it valid JSON.
#
# Run: bash hooks/scripts/__tests__/user-prompt-hooks.test.sh
#
# Exits 0 on success, prints failures on stdout.

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

PASS=0
FAIL=0

pass() { PASS=$((PASS + 1)); echo "  ✓ $1"; }
fail() { FAIL=$((FAIL + 1)); echo "  ✗ $1"; }

assert_contains() {
  if echo "$1" | grep -q "$2"; then pass "$3"; else fail "$3"; echo "    expected to contain: $2"; echo "    actual: $1"; fi
}
assert_silent() {
  if [ -z "$1" ]; then pass "$2"; else fail "$2"; echo "    expected: silent"; echo "    actual: $1"; fi
}
assert_json_context() {
  # $1 = hook output, $2 = literal text additionalContext must contain, $3 = label
  local ctx
  if ctx=$(printf '%s' "$1" | node -e 'const o = JSON.parse(require("fs").readFileSync(0, "utf8")); process.stdout.write(o.hookSpecificOutput.additionalContext)' 2>/dev/null) \
     && printf '%s' "$ctx" | grep -qF -- "$2"; then
    pass "$3"
  else
    fail "$3"; echo "    expected valid JSON whose context contains: $2"; echo "    actual: $1"
  fi
}

TMP_ROOT="$(mktemp -d)"
trap 'rm -rf "$TMP_ROOT"' EXIT

# A PATH without jq, so _read-prompt.sh takes its grep/sed fallback.
NOJQ_BIN="$TMP_ROOT/nojq-bin"; mkdir -p "$NOJQ_BIN"
for t in cat grep head sed tr; do
  printf '#!/bin/sh\nexec "%s" "$@"\n' "$(command -v "$t")" > "$NOJQ_BIN/$t"
  chmod +x "$NOJQ_BIN/$t"
done

payload() {
  node -e 'process.stdout.write(JSON.stringify({ hook_event_name: "UserPromptSubmit", prompt: process.argv[1] }))' "$1"
}

# $1 = hook script, $2 = project dir, $3 = prompt. CLAUDE_USER_PROMPT is removed on
# purpose: Claude Code never sets it, so a hook still relying on it must fail here.
run_hook() {
  payload "$3" | env -u CLAUDE_USER_PROMPT CLAUDE_CODE_ENTRYPOINT= LT_PLUGIN_HOOKS_SKIP= \
    CLAUDE_PROJECT_DIR="$2" PATH="${HOOK_PATH:-$PATH}" "$BASH" "$SCRIPT_DIR/$1" 2>/dev/null
}

MARKET="$TMP_ROOT/market"
mkdir -p "$MARKET/plugins/demo/.claude-plugin"
echo '{}' > "$MARKET/plugins/demo/.claude-plugin/plugin.json"

WEB="$TMP_ROOT/web"
mkdir -p "$WEB"
echo '{"dependencies":{"nuxt":"4.0.0"}}' > "$WEB/package.json"

NEST="$TMP_ROOT/nest"
mkdir -p "$NEST"
echo '{"dependencies":{"@lenne.tech/nest-server":"11.0.0"}}' > "$NEST/package.json"

LT_BIN="$TMP_ROOT/lt-bin"
mkdir -p "$LT_BIN"
printf '#!/bin/sh\nexit 0\n' > "$LT_BIN/lt"
chmod +x "$LT_BIN/lt"

echo "prompt arrives on stdin"
assert_contains "$(run_hook detect-plugin-dev.sh "$MARKET" 'add a skill for release notes')" "developing-claude-plugins" "plugin-dev reacts to a plugin prompt"
assert_silent   "$(run_hook detect-plugin-dev.sh "$MARKET" 'what time is it')" "plugin-dev stays silent for an unrelated prompt"
assert_silent   "$(run_hook detect-plugin-dev.sh "$MARKET" '/lt-dev:plugin:check the skill')" "slash commands are skipped"
assert_contains "$(run_hook detect-security-context.sh "$WEB" 'check the login form for XSS')" "general-frontend-security" "security-context reacts to a security prompt"
assert_contains "$(run_hook detect-npm-maintenance.sh "$WEB" 'run npm audit and fix it')" "maintaining-npm-packages" "npm-maintenance reacts to an audit prompt"
assert_contains "$(HOOK_PATH="$LT_BIN:$PATH" run_hook detect-lt-cli.sh "$WEB" 'lt fullstack init for a new project')" "using-lt-cli" "lt-cli reacts to an lt prompt"
assert_contains "$(run_hook detect-nest-server.sh "$NEST" 'add a service for invoices')" "generating-nest-servers" "nest-server reacts to a backend prompt"
assert_silent   "$(run_hook detect-nest-server.sh "$NEST" 'what time is it')" "nest-server keyword filter now applies"

echo "without jq"
assert_contains "$(HOOK_PATH="$NOJQ_BIN" run_hook detect-plugin-dev.sh "$MARKET" 'add a "release" skill')" "developing-claude-plugins" "prompt with escaped quotes is read"
assert_silent   "$(HOOK_PATH="$NOJQ_BIN" run_hook detect-plugin-dev.sh "$MARKET" '/lt-dev:plugin:check')" "slash command is still recognised"

NUXT="$TMP_ROOT/nuxt"
mkdir -p "$NUXT/app/components"
touch "$NUXT/nuxt.config.ts"

# Background task / subagent completions arrive as UserPromptSubmit turns carrying a
# <task-notification> block. Its result text below holds a trigger for every detector.
NOTE_RESULT='add a new skill, fixed the XSS in the login form, ran npm audit, lt fullstack init, add a service, tweak the dashboard component'
NOTE="<task-notification><task-id>a1b2</task-id><status>completed</status><result>${NOTE_RESULT}</result></task-notification>"

echo "system-generated turns (<task-notification>)"
# Controls: the same text as a human prompt fires, so silence below is the guard's doing.
assert_contains "$(run_hook detect-plugin-dev.sh "$MARKET" "$NOTE_RESULT")" "developing-claude-plugins" "control: plugin-dev fires on the bare result text"
assert_contains "$(run_hook detect-nuxt.sh "$NUXT" "$NOTE_RESULT")" "developing-lt-frontend" "control: nuxt fires on the bare result text"
assert_silent "$(run_hook detect-plugin-dev.sh "$MARKET" "$NOTE")" "plugin-dev ignores a notification turn"
assert_silent "$(run_hook detect-security-context.sh "$WEB" "$NOTE")" "security-context ignores a notification turn"
assert_silent "$(run_hook detect-npm-maintenance.sh "$WEB" "$NOTE")" "npm-maintenance ignores a notification turn"
assert_silent "$(HOOK_PATH="$LT_BIN:$PATH" run_hook detect-lt-cli.sh "$WEB" "$NOTE")" "lt-cli ignores a notification turn"
assert_silent "$(run_hook detect-nest-server.sh "$NEST" "$NOTE")" "nest-server ignores a notification turn"
assert_silent "$(run_hook detect-nuxt.sh "$NUXT" "$NOTE")" "nuxt ignores a notification turn"
assert_silent "$(HOOK_PATH="$NOJQ_BIN" run_hook detect-plugin-dev.sh "$MARKET" "$NOTE")" "notification turn is ignored without jq"

echo "plugin-dev: genuine plugin-dev prompts fire"
for p in 'add a new skill' 'fix the hook' 'SKILL.md frontmatter' 'plugin.json' 'create a command' \
         'Erstelle einen neuen Hook' 'Passe den Agent an' 'den Hook anpassen' 'the hook does not fire' \
         'review the code-reviewer agent definition' 'improve the lt-dev plugin'; do
  assert_contains "$(run_hook detect-plugin-dev.sh "$MARKET" "$p")" "developing-claude-plugins" "fires: $p"
done

echo "plugin-dev: passing mentions of plugin/hook/agent/command stay silent"
for p in 'the vite plugin crashes on startup' 'the useAuth hook returns undefined' \
         'the agent said the tests pass' 'run the command pnpm test' 'Der Agent schreibt die Tests' \
         'address the command output'; do
  assert_silent "$(run_hook detect-plugin-dev.sh "$MARKET" "$p")" "silent: $p"
done

echo "paths in the JSON output"
case "$(uname -s 2>/dev/null)" in
  MINGW*|MSYS*|CYGWIN*)
    echo "  - skipped: Windows file names cannot contain a backslash" ;;
  *)
    # A backslash in the project path stands in for a Windows path like C:\Users\….
    VNEST="$TMP_ROOT/win\\dir/nest"
    mkdir -p "$VNEST/src/core"
    echo '# @lenne.tech/nest-server (vendored)' > "$VNEST/src/core/VENDOR.md"
    assert_json_context "$(run_hook detect-nest-server.sh "$VNEST" 'add a service')" "$VNEST/src/core/" "nest-server: backslash in the vendor path stays valid JSON"

    VNUXT="$TMP_ROOT/win\\dir/nuxt"
    mkdir -p "$VNUXT/app/components" "$VNUXT/app/core"
    touch "$VNUXT/nuxt.config.ts"
    echo '# @lenne.tech/nuxt-extensions (vendored)' > "$VNUXT/app/core/VENDOR.md"
    assert_json_context "$(run_hook detect-nuxt.sh "$VNUXT" 'tweak the dashboard component')" "$VNUXT/app/core/" "nuxt: backslash in the vendor path stays valid JSON"
    ;;
esac

echo ""
echo "─────────────────────────────────────────"
echo "Total: $((PASS + FAIL)) | Passed: $PASS | Failed: $FAIL"
[ "$FAIL" -gt 0 ] && exit 1 || exit 0
