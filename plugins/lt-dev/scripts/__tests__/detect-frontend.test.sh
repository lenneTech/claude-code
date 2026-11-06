#!/bin/bash
# Tests for scripts/detect-frontend.sh — the one answer every Nuxt/Angular branch in lt-dev reads.
#
# The Nuxt cases pin the path every Nuxt project has always taken (frontend: nuxt, its app
# directory, npm or vendor mode); the Angular cases pin the new branch next to it.
#
# Run: bash scripts/__tests__/detect-frontend.test.sh

set -u

SCRIPT="$(cd "$(dirname "$0")/.." && pwd)/detect-frontend.sh"
PASS=0
FAIL=0

expect() {
  # $1 = output, $2 = expected line, $3 = label
  if printf '%s\n' "$1" | grep -qxF "$2"; then
    PASS=$((PASS + 1)); echo "  ✓ $3"
  else
    FAIL=$((FAIL + 1)); echo "  ✗ $3"
    echo "    expected line: $2"
    echo "    actual:"; printf '%s\n' "$1" | sed 's/^/      /'
  fi
}

setup() { TMP=$(mktemp -d -t lt-detect-frontend-XXXXXX); P="$TMP/proj"; mkdir -p "$P"; }
cleanup() { rm -rf "$TMP"; }
run() { bash "$SCRIPT" "$P" 2>/dev/null; }

echo "Nuxt: npm-mode monorepo"
setup
echo '{"name":"lt-monorepo"}' > "$P/package.json"
mkdir -p "$P/projects/app/app/components" "$P/projects/app/node_modules/@lenne.tech/nuxt-extensions"
: > "$P/projects/app/nuxt.config.ts"
echo '{"name":"app","dependencies":{"nuxt":"^4","@lenne.tech/nuxt-extensions":"1.25.0"}}' > "$P/projects/app/package.json"
out=$(run)
expect "$out" "frontend: nuxt" "Nuxt app detected"
expect "$out" "app: projects/app" "app directory"
expect "$out" "library: @lenne.tech/nuxt-extensions" "library"
expect "$out" "mode: npm" "npm mode"
expect "$out" "core: projects/app/node_modules/@lenne.tech/nuxt-extensions" "installed library path"
cleanup

echo "Nuxt: vendored monorepo"
setup
mkdir -p "$P/projects/app/app/core"
: > "$P/projects/app/nuxt.config.ts"
echo '{"name":"app","dependencies":{"nuxt":"^4"}}' > "$P/projects/app/package.json"
echo '# Vendored @lenne.tech/nuxt-extensions, baseline 1.25.0' > "$P/projects/app/app/core/VENDOR.md"
out=$(run)
expect "$out" "frontend: nuxt" "vendored Nuxt app detected"
expect "$out" "mode: vendor" "vendor mode"
expect "$out" "core: projects/app/app/core" "vendored core path"
cleanup

echo "Nuxt: standalone app at the root, detected by its dependency alone"
setup
echo '{"name":"shop","dependencies":{"nuxt":"^4"}}' > "$P/package.json"
out=$(run)
expect "$out" "frontend: nuxt" "plain Nuxt app"
expect "$out" "app: ." "root app"
expect "$out" "mode: none" "no lt library"
cleanup

echo "Nuxt: never read as Angular, even with an Angular dependency next to it"
setup
mkdir -p "$P/projects/app"
: > "$P/projects/app/nuxt.config.ts"
echo '{"dependencies":{"nuxt":"^4","@angular/core":"^22"}}' > "$P/projects/app/package.json"
out=$(run)
expect "$out" "frontend: nuxt" "Nuxt wins inside one directory"
cleanup

echo "Angular: npm-mode monorepo"
setup
echo '{"name":"lt-monorepo"}' > "$P/package.json"
mkdir -p "$P/projects/app/src/app" "$P/projects/app/node_modules/@lenne.tech/ng-base"
echo '{}' > "$P/projects/app/angular.json"
echo '{"name":"app","dependencies":{"@angular/core":"^22","@lenne.tech/ng-base":"22.0.0"}}' > "$P/projects/app/package.json"
out=$(run)
expect "$out" "frontend: angular" "Angular app detected"
expect "$out" "app: projects/app" "app directory"
expect "$out" "library: @lenne.tech/ng-base" "library"
expect "$out" "mode: npm" "npm mode"
expect "$out" "core: projects/app/node_modules/@lenne.tech/ng-base" "installed library path"
cleanup

echo "Angular: vendored monorepo"
setup
mkdir -p "$P/projects/app/src/core"
echo '{}' > "$P/projects/app/angular.json"
echo '{"name":"app","dependencies":{"@angular/core":"^22"}}' > "$P/projects/app/package.json"
echo '# Vendored @lenne.tech/ng-base, baseline 22.0.0' > "$P/projects/app/src/core/VENDOR.md"
out=$(run)
expect "$out" "frontend: angular" "vendored Angular app detected"
expect "$out" "mode: vendor" "vendor mode"
expect "$out" "core: projects/app/src/core" "vendored core path"
cleanup

echo "Angular: a nest-server VENDOR.md under src/core is not the ng-base core"
setup
mkdir -p "$P/src/core"
echo '{}' > "$P/angular.json"
echo '{"dependencies":{"@angular/core":"^22"}}' > "$P/package.json"
echo '# Vendored @lenne.tech/nest-server' > "$P/src/core/VENDOR.md"
out=$(run)
expect "$out" "frontend: angular" "Angular app"
expect "$out" "mode: none" "not vendored ng-base"
cleanup

echo "Angular: standalone starter at the root"
setup
echo '{}' > "$P/angular.json"
echo '{"name":"ng-base-starter","dependencies":{"@lenne.tech/ng-base":"22.0.0"}}' > "$P/package.json"
out=$(run)
expect "$out" "frontend: angular" "standalone Angular app"
expect "$out" "app: ." "root app"
expect "$out" "mode: npm" "npm mode"
expect "$out" "core: none" "library not installed yet"
cleanup

echo "No frontend"
setup
mkdir -p "$P/projects/api/src"
echo '{"dependencies":{"@lenne.tech/nest-server":"12.5.0"}}' > "$P/projects/api/package.json"
out=$(run)
expect "$out" "frontend: none" "backend-only project"
expect "$out" "mode: none" "no mode"
cleanup

echo ""
echo "─────────────────────────────────────────"
echo "Total: $((PASS + FAIL)) | Passed: $PASS | Failed: $FAIL"
[ "$FAIL" -gt 0 ] && exit 1 || exit 0
