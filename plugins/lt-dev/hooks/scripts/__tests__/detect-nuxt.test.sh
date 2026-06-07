#!/bin/bash
# Tests for hooks/scripts/detect-nuxt.sh — verifies npm vs. vendored detection
# and the vendored core update/contribute routing.
#
# Run: bash hooks/scripts/__tests__/detect-nuxt.test.sh
#
# Exits 0 on success, prints failures on stderr.

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
HOOK="$SCRIPT_DIR/detect-nuxt.sh"

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

run_hook() {
  # $1 = project dir, $2 = user prompt
  CLAUDE_CODE_ENTRYPOINT="" LT_PLUGIN_HOOKS_SKIP="" \
    CLAUDE_PROJECT_DIR="$1" CLAUDE_USER_PROMPT="$2" bash "$HOOK" 2>/dev/null
}

setup_tmp() {
  TMP=$(mktemp -d -t lt-detect-nuxt-XXXXXX)
  PROJ="$TMP/proj"
  mkdir -p "$PROJ"
}

cleanup() { rm -rf "$TMP" 2>/dev/null; }

# Make a monorepo nuxt app at projects/app
make_nuxt_app() {
  mkdir -p "$PROJ/projects/app/app/components"
  touch "$PROJ/projects/app/nuxt.config.ts"
}
make_vendored_core() {
  mkdir -p "$PROJ/projects/app/app/core"
  echo '# @lenne.tech/nuxt-extensions (vendored)' > "$PROJ/projects/app/app/core/VENDOR.md"
}
make_npm_dep() {
  mkdir -p "$PROJ/projects/app/node_modules/@lenne.tech/nuxt-extensions/dist"
}

# --- Case 1: non-nuxt project → silent ---
echo "Case 1: non-nuxt project"
setup_tmp
out=$(run_hook "$PROJ" "build a component")
assert_silent "$out" "exits silently when not a nuxt project"
cleanup

# --- Case 2: npm-mode nuxt monorepo → npm context, no vendor routing ---
echo "Case 2: npm-mode nuxt monorepo"
setup_tmp
make_nuxt_app
make_npm_dep
out=$(run_hook "$PROJ" "fix the login component")
assert_contains "$out" "Nuxt 4 project detected in monorepo" "emits npm detection"
assert_contains "$out" "developing-lt-frontend" "routes to developing-lt-frontend"
assert_not_contains "$out" "vendored core" "does NOT claim vendored"
assert_not_contains "$out" "update-nuxt-extensions-core" "no vendor update command"
cleanup

# --- Case 3: vendored nuxt monorepo (default frontend prompt) ---
echo "Case 3: vendored nuxt monorepo, generic frontend prompt"
setup_tmp
make_nuxt_app
make_vendored_core
out=$(run_hook "$PROJ" "tweak the dashboard component")
assert_contains "$out" "vendored core" "emits vendored detection"
assert_contains "$out" "update-nuxt-extensions-core" "mentions core update command"
assert_contains "$out" "contribute-nuxt-extensions-core" "mentions contribute command"
assert_contains "$out" "nuxt-extensions-core-vendoring" "mentions vendoring skill"
cleanup

# --- Case 4: vendored + explicit update keywords ---
echo "Case 4: vendored nuxt monorepo, update intent"
setup_tmp
make_nuxt_app
make_vendored_core
out=$(run_hook "$PROJ" "sync the nuxt core from upstream to the latest version")
assert_contains "$out" "update-nuxt-extensions-core" "routes update intent to core sync"
assert_contains "$out" "maintenance:maintain" "mentions npm maintenance for baseline bump"
cleanup

# --- Case 5: vendored, prompt without frontend terms → silent ---
echo "Case 5: vendored but unrelated prompt"
setup_tmp
make_nuxt_app
make_vendored_core
out=$(run_hook "$PROJ" "what time is it")
assert_silent "$out" "stays silent for unrelated prompt"
cleanup

# --- Case 6: vendored at project root (non-monorepo) ---
echo "Case 6: vendored nuxt at project root"
setup_tmp
mkdir -p "$PROJ/app/components" "$PROJ/app/core"
touch "$PROJ/nuxt.config.ts"
echo '# @lenne.tech/nuxt-extensions (vendored)' > "$PROJ/app/core/VENDOR.md"
out=$(run_hook "$PROJ" "update the nuxt-extensions core")
assert_contains "$out" "vendored core" "root vendored detection"
assert_contains "$out" "update-nuxt-extensions-core" "root vendored update routing"
cleanup

echo ""
echo "─────────────────────────────────────────"
echo "Total: $((PASS + FAIL)) | Passed: $PASS | Failed: $FAIL"
[ "$FAIL" -gt 0 ] && exit 1 || exit 0
