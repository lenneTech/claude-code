#!/bin/bash
# Tests for hooks/scripts/vendor-core-edit-guard.sh — verifies the contribute
# reminder fires only for edits inside an actual vendored core.
#
# Run: bash hooks/scripts/__tests__/vendor-core-edit-guard.test.sh
#
# Exits 0 on success, prints failures on stderr.

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
HOOK="$SCRIPT_DIR/vendor-core-edit-guard.sh"

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
  # $1 = file_path for the JSON tool_input
  CLAUDE_CODE_ENTRYPOINT="" LT_PLUGIN_HOOKS_SKIP="" \
    bash "$HOOK" 2>/dev/null <<EOF
{"tool_name":"Edit","tool_input":{"file_path":"$1"}}
EOF
}

setup_tmp() { TMP=$(mktemp -d -t lt-vendor-guard-XXXXXX); }
cleanup() { rm -rf "$TMP" 2>/dev/null; }

# --- Case 1: edit inside backend vendored core (adjacent VENDOR.md) ---
echo "Case 1: backend vendored core edit"
setup_tmp
mkdir -p "$TMP/projects/api/src/core/common/services"
touch "$TMP/projects/api/src/core/VENDOR.md"
f="$TMP/projects/api/src/core/common/services/crud.service.ts"
touch "$f"
out=$(run_hook "$f")
assert_contains "$out" "VENDORED @lenne.tech/nest-server" "detects backend core"
assert_contains "$out" "contribute-nest-server-core" "names backend contribute command"
cleanup

# --- Case 2: edit inside frontend vendored core ---
echo "Case 2: frontend vendored core edit"
setup_tmp
mkdir -p "$TMP/projects/app/app/core/runtime/composables"
touch "$TMP/projects/app/app/core/VENDOR.md"
f="$TMP/projects/app/app/core/runtime/composables/use-auth.ts"
touch "$f"
out=$(run_hook "$f")
assert_contains "$out" "VENDORED @lenne.tech/nuxt-extensions" "detects frontend core"
assert_contains "$out" "contribute-nuxt-extensions-core" "names frontend contribute command"
cleanup

# --- Case 3: edit a normal project file (outside core) → silent ---
echo "Case 3: normal project file"
setup_tmp
mkdir -p "$TMP/projects/api/src/server/modules/user"
f="$TMP/projects/api/src/server/modules/user/user.service.ts"
touch "$f"
out=$(run_hook "$f")
assert_silent "$out" "stays silent outside core"
cleanup

# --- Case 4: src/core WITHOUT VENDOR.md (not actually vendored) → silent ---
echo "Case 4: src/core without VENDOR.md"
setup_tmp
mkdir -p "$TMP/projects/api/src/core/common"
f="$TMP/projects/api/src/core/common/thing.ts"
touch "$f"
out=$(run_hook "$f")
assert_silent "$out" "stays silent when no adjacent VENDOR.md"
cleanup

# --- Case 5: editing VENDOR.md itself → silent ---
echo "Case 5: VENDOR.md edit"
setup_tmp
mkdir -p "$TMP/projects/api/src/core"
touch "$TMP/projects/api/src/core/VENDOR.md"
out=$(run_hook "$TMP/projects/api/src/core/VENDOR.md")
assert_silent "$out" "does not nag about VENDOR.md edits"
cleanup

# --- Case 6: opt-out via env var → silent ---
echo "Case 6: opt-out env var"
setup_tmp
mkdir -p "$TMP/projects/api/src/core"
touch "$TMP/projects/api/src/core/VENDOR.md"
f="$TMP/projects/api/src/core/x.ts"; touch "$f"
out=$(LT_SKIP_VENDOR_CORE_GUARD=1 bash "$HOOK" 2>/dev/null <<EOF
{"tool_name":"Edit","tool_input":{"file_path":"$f"}}
EOF
)
assert_silent "$out" "respects LT_SKIP_VENDOR_CORE_GUARD"
cleanup

echo ""
echo "─────────────────────────────────────────"
echo "Total: $((PASS + FAIL)) | Passed: $PASS | Failed: $FAIL"
[ "$FAIL" -gt 0 ] && exit 1 || exit 0
