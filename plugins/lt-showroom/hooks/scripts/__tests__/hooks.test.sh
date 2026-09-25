#!/bin/bash
# Tests for the lt-showroom hooks:
# - the post-compaction context is registered on SessionStart (matcher "compact") and
#   answers in the SessionStart output shape; PostCompact output never reaches Claude
# - the plugin keeps no context tied to the platform's own source tree: a checkout of the
#   showroom platform gets exactly what any other project gets
# - detect-analyzable-project.sh ignores <task-notification> turns and the marketplace's
#   own plugin names / paths
# - the prompt comes from the stdin payload only (no CLAUDE_USER_PROMPT fallback), and
#   without jq it is still read in full across escaped quotes and newlines
# - detect-analyzable-project.sh needs showroom / showcase intent: "demo" or
#   "screenshot" in an ordinary dev prompt stays quiet
#
# Run: bash hooks/scripts/__tests__/hooks.test.sh
#
# Exits 0 on success, prints failures on stdout.

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
HOOKS_JSON="$SCRIPT_DIR/../hooks.json"

PASS=0
FAIL=0

pass() { PASS=$((PASS + 1)); echo "  ✓ $1"; }
fail() { FAIL=$((FAIL + 1)); echo "  ✗ $1"; }

assert_contains() {
  if printf '%s' "$1" | grep -qF -- "$2"; then pass "$3"; else fail "$3"; echo "    expected to contain: $2"; echo "    actual: $1"; fi
}
assert_silent() {
  if [ -z "$1" ]; then pass "$2"; else fail "$2"; echo "    expected: silent"; echo "    actual: $1"; fi
}
# $1 = hook output, $2 = expected hookEventName, $3 = text additionalContext must contain, $4 = label
assert_hook_output() {
  local got
  got=$(printf '%s' "$1" | node -e '
    const o = JSON.parse(require("fs").readFileSync(0, "utf8")).hookSpecificOutput;
    process.stdout.write(o.hookEventName + "\n" + o.additionalContext);' 2>/dev/null)
  if [ "$(printf '%s' "$got" | head -1)" = "$2" ] && printf '%s' "$got" | grep -qF -- "$3"; then
    pass "$4"
  else
    fail "$4"; echo "    expected hookEventName $2 with context containing: $3"; echo "    actual: $1"
  fi
}

TMP_ROOT="$(mktemp -d)"
trap 'rm -rf "$TMP_ROOT"' EXIT

# A PATH without jq, so the scripts take their grep/sed fallback.
NOJQ_BIN="$TMP_ROOT/nojq-bin"; mkdir -p "$NOJQ_BIN"
for t in cat grep head sed tr; do
  printf '#!/bin/sh\nexec "%s" "$@"\n' "$(command -v "$t")" > "$NOJQ_BIN/$t"
  chmod +x "$NOJQ_BIN/$t"
done

prompt_payload() {
  node -e 'process.stdout.write(JSON.stringify({ hook_event_name: "UserPromptSubmit", prompt: process.argv[1] }))' "$1"
}
session_payload() {
  node -e 'process.stdout.write(JSON.stringify({ hook_event_name: "SessionStart", source: process.argv[1] }))' "$1"
}

# $1 = script, $2 = project dir; payload on stdin. CLAUDE_USER_PROMPT is cleared unless
# a test sets it through EXTRA_PROMPT_ENV.
run_script() {
  local extra=()
  [ -n "${EXTRA_PROMPT_ENV:-}" ] && extra=("CLAUDE_USER_PROMPT=$EXTRA_PROMPT_ENV")
  env -u CLAUDE_USER_PROMPT CLAUDE_CODE_ENTRYPOINT= LT_PLUGIN_HOOKS_SKIP= \
    ${extra[@]+"${extra[@]}"} \
    CLAUDE_PROJECT_DIR="$2" PATH="${HOOK_PATH:-$PATH}" "$BASH" "$SCRIPT_DIR/$1" 2>/dev/null
}
analyzable() { prompt_payload "$2" | run_script detect-analyzable-project.sh "$1"; }

# A checkout of the showroom platform itself: no special treatment.
SHOWROOM="$TMP_ROOT/showroom"
mkdir -p "$SHOWROOM"
echo '{"name":"showroom"}' > "$SHOWROOM/package.json"

APP="$TMP_ROOT/app"
mkdir -p "$APP"
echo '{"name":"some-app"}' > "$APP/package.json"

SHOWCASED="$TMP_ROOT/showcased"
mkdir -p "$SHOWCASED"
touch "$SHOWCASED/SHOWCASE.md"

NOTE='<task-notification><task-id>a1b2</task-id><status>completed</status><result>Reviewed plugins/lt-offers and plugins/lt-showroom hooks; the showroom demo, showcase screenshots and portfolio analysis work.</result></task-notification>'

echo "hooks.json: post-compaction context runs on SessionStart compact"
REG=$(node -e '
  const h = JSON.parse(require("fs").readFileSync(0, "utf8")).hooks;
  const uses = (g) => g.hooks.some((x) => (x.command || "").includes("post-compact-context.sh"));
  const fires = (g, src) => new RegExp("^(?:" + (g.matcher || ".*") + ")$").test(src);
  const ss = h.SessionStart || [];
  console.log([
    ss.some((g) => uses(g) && fires(g, "compact")) ? "compact:yes" : "compact:no",
    ss.some((g) => uses(g) && ["startup", "resume", "clear"].some((s) => fires(g, s))) ? "other:yes" : "other:no",
    (h.PostCompact || []).some(uses) ? "postcompact:yes" : "postcompact:no",
  ].join(" "));' < "$HOOKS_JSON")
assert_contains "$REG" "compact:yes" "registered on SessionStart for source compact"
assert_contains "$REG" "other:no" "not registered for startup/resume/clear"
assert_contains "$REG" "postcompact:no" "no PostCompact registration left (its output never reaches Claude)"
CMDS=$(node -e '
  const h = JSON.parse(require("fs").readFileSync(0, "utf8")).hooks;
  console.log(Object.values(h).flat().flatMap((g) => g.hooks.map((x) => (x.command || "").replace(/.*scripts\//, "").replace(/"$/, ""))).sort().join(" "));' < "$HOOKS_JSON")
assert_contains "$CMDS" "detect-analyzable-project.sh post-compact-context.sh" "only the analyzable-project detector and the compaction hook are registered"

echo "post-compact-context.sh: SessionStart output"
assert_hook_output "$(session_payload compact | run_script post-compact-context.sh "$SHOWCASED")" "SessionStart" "SHOWCASE.md detected" "SHOWCASE.md project: SessionStart additionalContext"
assert_hook_output "$(session_payload compact | HOOK_PATH="$NOJQ_BIN" run_script post-compact-context.sh "$SHOWCASED")" "SessionStart" "SHOWCASE.md detected" "SHOWCASE.md project without jq: SessionStart additionalContext"
assert_silent "$(session_payload startup | run_script post-compact-context.sh "$SHOWCASED")" "silent for source startup"
assert_silent "$(session_payload compact | run_script post-compact-context.sh "$APP")" "silent in a project without SHOWCASE.md"
assert_silent "$(session_payload compact | run_script post-compact-context.sh "$SHOWROOM")" "silent in the platform checkout without SHOWCASE.md"

echo "genuine prompts"
assert_contains "$(analyzable "$APP" 'take screenshots for the showroom page')" "analyzing-projects" "analyzable project + showroom prompt fires"
assert_contains "$(analyzable "$APP" 'bereite mit lt-showroom einen Showcase für dieses Projekt vor')" "analyzing-projects" "genuine prompt that names the plugin still fires"
assert_contains "$(analyzable "$APP" 'create a showcase for this project')" "analyzing-projects" "create a showcase for this project"
assert_contains "$(analyzable "$APP" 'Showroom-Eintrag anlegen')" "analyzing-projects" "Showroom-Eintrag anlegen"
assert_contains "$(analyzable "$APP" 'add a portfolio entry with the tech stack')" "analyzing-projects" "portfolio entry"
assert_contains "$(analyzable "$APP" '/lt-showroom:create')" "analyzing-projects" "the plugin's own slash command fires"

echo "detect-analyzable-project.sh: ordinary dev prompts stay quiet"
assert_silent "$(analyzable "$APP" 'take a screenshot of the failing page')" "screenshot alone"
assert_silent "$(analyzable "$APP" 'demo data for the test')" "demo alone"
assert_silent "$(analyzable "$APP" 'analyse the tech stack and write a presentation of the feature overview')" "analysis / tech stack / presentation / feature overview"
assert_silent "$(analyzable "$APP" 'fix the portfolio grid layout')" "portfolio as a UI word"
assert_silent "$(analyzable "$APP" 'the docs for /lt-showroom:create need a typo fix')" "a mid-prompt mention of the command is not an invocation"
assert_silent "$(analyzable "$TMP_ROOT" 'create a showcase for this project')" "showcase intent without a software project stays quiet"

echo "system-generated turns"
assert_silent "$(analyzable "$APP" "$NOTE")" "detect-analyzable-project: task-notification turn is ignored"
assert_silent "$(HOOK_PATH="$NOJQ_BIN" analyzable "$APP" "$NOTE")" "detect-analyzable-project: ignored without jq"

echo "marketplace self-references"
assert_silent "$(analyzable "$APP" 'bump the lt-showroom version')" "detect-analyzable-project: plugin name alone does not fire"
assert_silent "$(analyzable "$APP" 'update plugins/lt-showroom/skills/creating-showcases/SKILL.md')" "detect-analyzable-project: plugin path alone does not fire"

echo "prompt parsing without jq"
# JSON.stringify escapes the quotes and the newline; a plain "[^"]*" match stopped at
# the first \" and never saw the rest of the prompt.
assert_contains "$(HOOK_PATH="$NOJQ_BIN" analyzable "$APP" "$(printf 'the client said "urgent"\ncreate a showcase for this project')")" "analyzing-projects" "detect-analyzable-project: text after an escaped quote and a newline is read"
assert_silent "$(HOOK_PATH="$NOJQ_BIN" analyzable "$APP" "$(printf 'take a "screenshot"\nof the demo')")" "detect-analyzable-project: dev words stay quiet"

echo "prompt source"
EMPTY='{"hook_event_name":"UserPromptSubmit","prompt":""}'
assert_silent "$(printf '%s' "$EMPTY" | EXTRA_PROMPT_ENV='create a showcase' run_script detect-analyzable-project.sh "$APP")" "detect-analyzable-project: CLAUDE_USER_PROMPT is not read"

echo ""
echo "─────────────────────────────────────────"
echo "Total: $((PASS + FAIL)) | Passed: $PASS | Failed: $FAIL"
[ "$FAIL" -gt 0 ] && exit 1 || exit 0
