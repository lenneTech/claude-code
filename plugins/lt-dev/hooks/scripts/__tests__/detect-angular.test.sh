#!/bin/bash
# Tests for hooks/scripts/detect-angular.sh — npm vs. vendored ng-base detection, the vendored core
# update/contribute routing, and silence in Nuxt projects (the Nuxt path stays detect-nuxt.sh's).
#
# Run: bash hooks/scripts/__tests__/detect-angular.test.sh
#
# Exits 0 on success, prints failures on stderr.

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
HOOK="$SCRIPT_DIR/detect-angular.sh"
NUXT_HOOK="$SCRIPT_DIR/detect-nuxt.sh"

PASS=0
FAIL=0

assert_contains() {
  local actual="$1" needle="$2" label="$3"
  if echo "$actual" | grep -q "$needle"; then
    PASS=$((PASS + 1)); echo "  ✓ $label"
  else
    FAIL=$((FAIL + 1)); echo "  ✗ $label"
    echo "    expected to contain: $needle"
    echo "    actual: $actual"
  fi
}

assert_not_contains() {
  local actual="$1" needle="$2" label="$3"
  if echo "$actual" | grep -q "$needle"; then
    FAIL=$((FAIL + 1)); echo "  ✗ $label"
    echo "    expected NOT to contain: $needle"
    echo "    actual: $actual"
  else
    PASS=$((PASS + 1)); echo "  ✓ $label"
  fi
}

assert_silent() {
  local actual="$1" label="$2"
  if [ -z "$actual" ]; then
    PASS=$((PASS + 1)); echo "  ✓ $label"
  else
    FAIL=$((FAIL + 1)); echo "  ✗ $label"
    echo "    expected: silent"
    echo "    actual:   $actual"
  fi
}

assert_json() {
  local actual="$1" label="$2"
  if printf '%s' "$actual" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{JSON.parse(d)})' 2>/dev/null; then
    PASS=$((PASS + 1)); echo "  ✓ $label"
  else
    FAIL=$((FAIL + 1)); echo "  ✗ $label"
    echo "    not valid JSON: $actual"
  fi
}

run_hook() {
  # $1 = hook, $2 = project dir, $3 = user prompt (delivered on stdin like Claude Code does)
  printf '{"hook_event_name":"UserPromptSubmit","prompt":"%s"}' "$3" |
    CLAUDE_CODE_ENTRYPOINT="" LT_PLUGIN_HOOKS_SKIP="" \
    CLAUDE_PROJECT_DIR="$2" bash "$1" 2>/dev/null
}

setup_tmp() {
  TMP=$(mktemp -d -t lt-detect-angular-XXXXXX)
  PROJ="$TMP/proj"
  mkdir -p "$PROJ"
}

cleanup() { rm -rf "$TMP" 2>/dev/null; }

make_angular_app() {
  mkdir -p "$PROJ/projects/app/src/app"
  echo '{"version":1,"projects":{}}' > "$PROJ/projects/app/angular.json"
}
make_vendored_core() {
  mkdir -p "$PROJ/projects/app/src/core"
  echo '# @lenne.tech/ng-base (vendored), baseline 22.0.0' > "$PROJ/projects/app/src/core/VENDOR.md"
}
make_npm_dep() {
  mkdir -p "$PROJ/projects/app/node_modules/@lenne.tech/ng-base"
  echo '{"name":"@lenne.tech/ng-base","version":"22.0.0"}' > "$PROJ/projects/app/node_modules/@lenne.tech/ng-base/package.json"
}
make_nuxt_app() {
  mkdir -p "$PROJ/projects/app/app/components"
  touch "$PROJ/projects/app/nuxt.config.ts"
}

echo "Case 1: project without a frontend"
setup_tmp
out=$(run_hook "$HOOK" "$PROJ" "build a component")
assert_silent "$out" "silent outside an Angular project"
cleanup

echo "Case 2: npm-mode Angular monorepo"
setup_tmp
make_angular_app
make_npm_dep
out=$(run_hook "$HOOK" "$PROJ" "fix the login component")
assert_contains "$out" "Angular project detected in monorepo" "emits npm detection"
assert_contains "$out" "developing-lt-angular-frontend" "routes to the Angular skill"
assert_contains "$out" "node_modules/@lenne.tech/ng-base" "points at the installed library"
assert_not_contains "$out" "vendored core" "does not claim vendored"
assert_not_contains "$out" "update-ng-base-core" "no vendor update command in npm mode"
assert_not_contains "$out" "developing-lt-frontend" "never routes an Angular project to the Nuxt skill"
assert_json "$out" "emits valid JSON"
cleanup

echo "Case 3: vendored Angular monorepo, generic frontend prompt"
setup_tmp
make_angular_app
make_vendored_core
out=$(run_hook "$HOOK" "$PROJ" "tweak the dashboard component")
assert_contains "$out" "vendored core" "emits vendored detection"
assert_contains "$out" "update-ng-base-core" "mentions the core update command"
assert_contains "$out" "contribute-ng-base-core" "mentions the contribute command"
assert_contains "$out" "ng-base-core-vendoring" "mentions the vendoring skill"
assert_json "$out" "emits valid JSON"
cleanup

echo "Case 4: vendored Angular monorepo, update intent"
setup_tmp
make_angular_app
make_vendored_core
out=$(run_hook "$HOOK" "$PROJ" "sync the angular core from upstream")
assert_contains "$out" "update-ng-base-core" "routes update intent to the core sync"
cleanup

echo "Case 5: TDD intent"
setup_tmp
make_angular_app
make_npm_dep
out=$(run_hook "$HOOK" "$PROJ" "write the playwright test first")
assert_contains "$out" "building-stories-with-tdd" "routes TDD intent"
assert_contains "$out" "developing-lt-angular-frontend" "names the Angular skill as the implementation partner"
cleanup

echo "Case 6: unrelated prompt"
setup_tmp
make_angular_app
out=$(run_hook "$HOOK" "$PROJ" "what time is it")
assert_silent "$out" "silent for a prompt without frontend terms"
cleanup

echo "Case 7: standalone Angular app at the project root"
setup_tmp
mkdir -p "$PROJ/src/core"
echo '{}' > "$PROJ/angular.json"
echo '# @lenne.tech/ng-base' > "$PROJ/src/core/VENDOR.md"
out=$(run_hook "$HOOK" "$PROJ" "update the ng-base core")
assert_contains "$out" "vendored core" "root vendored detection"
assert_not_contains "$out" "in monorepo" "root app is not reported as monorepo"
cleanup

echo "Case 8: a nest-server core under src/core does not make the app vendored"
setup_tmp
make_angular_app
mkdir -p "$PROJ/projects/app/src/core"
echo '# @lenne.tech/nest-server' > "$PROJ/projects/app/src/core/VENDOR.md"
out=$(run_hook "$HOOK" "$PROJ" "fix the login component")
assert_not_contains "$out" "vendored core" "only a VENDOR.md naming ng-base counts"
cleanup

echo "Nuxt gate: a Nuxt project keeps its path"
setup_tmp
make_nuxt_app
out=$(run_hook "$HOOK" "$PROJ" "fix the login component")
assert_silent "$out" "detect-angular stays silent in a Nuxt project"
nuxt_out=$(run_hook "$NUXT_HOOK" "$PROJ" "fix the login component")
assert_contains "$nuxt_out" "Nuxt 4 project detected in monorepo" "detect-nuxt still answers the Nuxt project"
assert_not_contains "$nuxt_out" "Angular" "the Nuxt context never mentions Angular"
cleanup

echo "Angular project: detect-nuxt stays silent"
setup_tmp
make_angular_app
out=$(run_hook "$NUXT_HOOK" "$PROJ" "fix the login component")
assert_silent "$out" "detect-nuxt does not claim an Angular project"
cleanup

echo ""
echo "─────────────────────────────────────────"
echo "Total: $((PASS + FAIL)) | Passed: $PASS | Failed: $FAIL"
[ "$FAIL" -gt 0 ] && exit 1 || exit 0
