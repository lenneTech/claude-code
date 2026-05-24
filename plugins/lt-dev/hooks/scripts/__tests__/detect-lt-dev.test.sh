#!/bin/bash
# Tests for hooks/scripts/detect-lt-dev.sh — verifies the four states
# (active/registered/unregistered-lt/non-lt).
#
# Run: bash hooks/scripts/__tests__/detect-lt-dev.test.sh
#
# The script exits 0 on success, prints failures on stderr.

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
HOOK="$SCRIPT_DIR/detect-lt-dev.sh"

PASS=0
FAIL=0

assert_contains() {
  local actual="$1"
  local needle="$2"
  local label="$3"
  if echo "$actual" | grep -q "$needle"; then
    PASS=$((PASS + 1))
    echo "  ✓ $label"
  else
    FAIL=$((FAIL + 1))
    echo "  ✗ $label"
    echo "    expected to contain: $needle"
    echo "    actual:"
    echo "$actual" | sed 's/^/      /'
  fi
}

assert_silent() {
  local actual="$1"
  local label="$2"
  if [ -z "$actual" ]; then
    PASS=$((PASS + 1))
    echo "  ✓ $label"
  else
    FAIL=$((FAIL + 1))
    echo "  ✗ $label"
    echo "    expected: silent"
    echo "    actual:   $actual"
  fi
}

run_hook() {
  local project_dir="$1"
  local registry="$2"
  CLAUDE_PROJECT_DIR="$project_dir" LT_DEV_REGISTRY_PATH="$registry" bash "$HOOK" 2>/dev/null
}

setup_tmp() {
  TMP=$(mktemp -d -t lt-detect-test-XXXXXX)
  PROJ="$TMP/proj"
  mkdir -p "$PROJ"
  REGISTRY="$TMP/projects.json"
  echo '{"projects":{},"version":1}' > "$REGISTRY"
}

cleanup() {
  rm -rf "$TMP" 2>/dev/null
}

# --- Case 1: Non-lt project → silent ---
echo "Case 1: non-lt project (no @lenne.tech deps)"
setup_tmp
echo '{"name":"random-project","dependencies":{"react":"^18"}}' > "$PROJ/package.json"
out=$(run_hook "$PROJ" "$REGISTRY")
assert_silent "$out" "exits silently when no lt-marker"
cleanup

# --- Case 2: lt project, NOT registered → migration hint ---
echo "Case 2: lt project (uses @lenne.tech/nest-server) but not registered"
setup_tmp
echo '{"name":"crm-thing","dependencies":{"@lenne.tech/nest-server":"^11"}}' > "$PROJ/package.json"
out=$(run_hook "$PROJ" "$REGISTRY")
assert_contains "$out" "not yet migrated" "emits 'not yet migrated' header"
assert_contains "$out" "lt dev init" "instructs to run lt dev init"
assert_contains "$out" "crm-thing" "shows the slug that would be used"
cleanup

# --- Case 3: lt project, registered, no session → URL block + start hint ---
echo "Case 3: registered project, no active session"
setup_tmp
echo '{"name":"crm","dependencies":{"@lenne.tech/nest-server":"^11"}}' > "$PROJ/package.json"
cat > "$REGISTRY" <<EOF
{
  "projects": {
    "crm": {
      "path": "$PROJ",
      "subdomains": { "api": "api.crm.localhost", "app": "crm.localhost" },
      "dbName": "crm-local",
      "internalPorts": { "api": 4010, "app": 4011 }
    }
  },
  "version": 1
}
EOF
out=$(run_hook "$PROJ" "$REGISTRY")
assert_contains "$out" "Active lt-dev project" "emits 'Active lt-dev project' block"
assert_contains "$out" "https://crm.localhost" "shows App URL"
assert_contains "$out" "https://api.crm.localhost" "shows API URL"
assert_contains "$out" "session: no" "shows session: no"
assert_contains "$out" "Run \`lt dev up\`" "instructs to run lt dev up"
cleanup

# --- Case 4: lt project, registered, ACTIVE session ---
echo "Case 4: registered project, active session"
setup_tmp
echo '{"name":"crm","dependencies":{"@lenne.tech/nest-server":"^11"}}' > "$PROJ/package.json"
mkdir -p "$PROJ/.lt-dev"
echo '{"pids":{"api":12345,"app":12346},"startedAt":"2026-05-10T00:00:00Z"}' > "$PROJ/.lt-dev/state.json"
cat > "$REGISTRY" <<EOF
{
  "projects": {
    "crm": {
      "path": "$PROJ",
      "subdomains": { "api": "api.crm.localhost", "app": "crm.localhost" },
      "dbName": "crm-local",
      "internalPorts": { "api": 4010, "app": 4011 }
    }
  },
  "version": 1
}
EOF
out=$(run_hook "$PROJ" "$REGISTRY")
assert_contains "$out" "session: yes" "shows session: yes"
assert_contains "$out" "browser tests" "instructs to use URLs for browser tests"
cleanup

# --- Case 5: lt-monorepo template name → detected even without deps in root pkg ---
echo "Case 5: lt-monorepo by package name"
setup_tmp
echo '{"name":"lt-monorepo"}' > "$PROJ/package.json"
out=$(run_hook "$PROJ" "$REGISTRY")
assert_contains "$out" "not yet migrated" "lt-monorepo template recognized"
cleanup

# --- Case 6: lt project via @lenne.tech/nuxt-extensions ---
echo "Case 6: lt project (uses @lenne.tech/nuxt-extensions)"
setup_tmp
echo '{"name":"web","devDependencies":{"@lenne.tech/nuxt-extensions":"^1"}}' > "$PROJ/package.json"
out=$(run_hook "$PROJ" "$REGISTRY")
assert_contains "$out" "not yet migrated" "detected via devDependencies"
cleanup

# --- Case 7: lt-monorepo subproject (workspace root walk-up) ---
echo "Case 7: lt-monorepo with subproject deps in projects/api"
setup_tmp
echo '{"name":"my-app"}' > "$PROJ/package.json"
mkdir -p "$PROJ/projects/api"
echo '{"name":"api","dependencies":{"@lenne.tech/nest-server":"^11"}}' > "$PROJ/projects/api/package.json"
out=$(run_hook "$PROJ" "$REGISTRY")
assert_contains "$out" "not yet migrated" "detected via projects/api/package.json"
cleanup

echo ""
echo "─────────────────────────────────────────"
echo "Total: $((PASS + FAIL)) | Passed: $PASS | Failed: $FAIL"
[ "$FAIL" -gt 0 ] && exit 1 || exit 0
