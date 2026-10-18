#!/bin/bash
# Tests for scripts/chrome-devtools-mcp-launcher.sh: the global chrome-devtools-mcp binary
# is used only at the pinned version, read from its package.json without starting node, in
# the layouts npm writes (a link chain on macOS/Linux, a shim beside node_modules/ on
# Windows). Anything else starts the pinned version through npx.
# Observed 2026-10-18: a machine with a global 1.4.0 ran that version while the pin said 1.10.1.
#
# Run: bash scripts/__tests__/chrome-devtools-mcp-launcher.test.sh

set -u

LAUNCHER="$(cd "$(dirname "$0")/.." && pwd)/chrome-devtools-mcp-launcher.sh"
PIN=$(sed -n 's/^CHROME_MCP_PINNED_VERSION="\${CHROME_MCP_VERSION:-\([^}]*\)}"$/\1/p' "$LAUNCHER")

PASS=0
FAIL=0
pass() { PASS=$((PASS + 1)); echo "  ✓ $1"; }
fail() { FAIL=$((FAIL + 1)); echo "  ✗ $1"; }

TMP_ROOT="$(mktemp -d)"
trap 'rm -rf "$TMP_ROOT"' EXIT

# A stand-in prints which binary ran and with which arguments, then exits.
stub() { printf '#!/bin/bash\necho "%s $*"\n' "$2" > "$1"; chmod +x "$1"; }
pkg() { mkdir -p "$1"; printf '{\n  "name": "chrome-devtools-mcp",\n  "version": "%s",\n  "bin": {}\n}\n' "$2" > "$1/package.json"; }

# $1 = case dir (its bin/ goes first on PATH), extra env assignments follow.
run_launcher() {
  local dir="$1"; shift
  mkdir -p "$dir/tools"
  stub "$dir/tools/npx" NPX
  stub "$dir/tools/node" NODE
  env "$@" HOME="$TMP_ROOT/home" CHROME_MCP_CHANNEL=stable CHROME_MCP_SUPERVISE=0 \
    PATH="$dir/bin:$dir/tools:/usr/bin:/bin" bash "$LAUNCHER" 2>"$dir/stderr" < /dev/null
}

# npm on macOS/Linux: bin/chrome-devtools-mcp -> ../lib/node_modules/<pkg>/build/src/bin/<file>.js
unix_layout() {
  local root="$1" version="$2" pkgdir="$1/lib/node_modules/chrome-devtools-mcp"
  pkg "$pkgdir" "$version"
  mkdir -p "$pkgdir/build/src/bin" "$root/bin"
  stub "$pkgdir/build/src/bin/chrome-devtools-mcp.js" GLOBAL
  ln -s ../lib/node_modules/chrome-devtools-mcp/build/src/bin/chrome-devtools-mcp.js "$root/bin/chrome-devtools-mcp"
}

echo "pinned version: $PIN"

# npx always gets a prefix of its own in the user's home: without it npm reads the
# working directory's .npmrc, and the server starts in the project Claude Code opened,
# so `node-options=--require=./x.cjs` in a repository would run its code (2026-10-18).
NPX_PREFIX="$TMP_ROOT/home/.cache/lt-dev/npx-prefix"
NPX_START="NPX --prefix $NPX_PREFIX -y chrome-devtools-mcp@$PIN"

echo "global install at the pin (link chain)"
unix_layout "$TMP_ROOT/a" "$PIN"
out=$(run_launcher "$TMP_ROOT/a")
case "$out" in GLOBAL*) pass "the global binary runs" ;; *) fail "the global binary runs (got: $out)" ;; esac

echo "global install behind a linked directory (fnm per-shell bin)"
unix_layout "$TMP_ROOT/real" "$PIN"
mkdir -p "$TMP_ROOT/b"
ln -s "$TMP_ROOT/real/bin" "$TMP_ROOT/b/bin"
# Git Bash on Windows copies instead of linking unless the runner allows native symlinks, and
# a copied bin/ has no lib/ beside it. Observed 2026-10-18: windows-latest passed this case on
# one run of a commit and failed it on the next. The case is about a link, so it needs one.
if [ -L "$TMP_ROOT/b/bin" ]; then
  out=$(run_launcher "$TMP_ROOT/b")
  case "$out" in GLOBAL*) pass "the global binary runs" ;; *) fail "the global binary runs (got: $out)" ;; esac
else
  echo "  - skipped: ln -s made a copy here, not a link"
fi

echo "older global install"
unix_layout "$TMP_ROOT/c" "1.4.0"
out=$(run_launcher "$TMP_ROOT/c")
case "$out" in "$NPX_START"*) pass "the pinned version starts through npx" ;; *) fail "the pinned version starts through npx (got: $out)" ;; esac
grep -q "is 1.4.0, the pin is $PIN" "$TMP_ROOT/c/stderr" && pass "stderr names both versions" || fail "stderr names both versions: $(cat "$TMP_ROOT/c/stderr")"
out=$(run_launcher "$TMP_ROOT/c" CHROME_MCP_VERSION=1.4.0)
case "$out" in GLOBAL*) pass "CHROME_MCP_VERSION moves the pin to the global version" ;; *) fail "CHROME_MCP_VERSION moves the pin (got: $out)" ;; esac

echo "npm on Windows: shim script beside node_modules/"
mkdir -p "$TMP_ROOT/d/bin"
pkg "$TMP_ROOT/d/bin/node_modules/chrome-devtools-mcp" "$PIN"
stub "$TMP_ROOT/d/bin/chrome-devtools-mcp" GLOBAL
out=$(run_launcher "$TMP_ROOT/d")
case "$out" in GLOBAL*) pass "the global binary runs" ;; *) fail "the global binary runs (got: $out)" ;; esac

echo "global binary without a readable version"
mkdir -p "$TMP_ROOT/e/bin"
stub "$TMP_ROOT/e/bin/chrome-devtools-mcp" GLOBAL
out=$(run_launcher "$TMP_ROOT/e")
case "$out" in "$NPX_START"*) pass "the pinned version starts through npx" ;; *) fail "the pinned version starts through npx (got: $out)" ;; esac

echo "no global install"
mkdir -p "$TMP_ROOT/f/bin"
out=$(run_launcher "$TMP_ROOT/f")
case "$out" in "$NPX_START"*) pass "the pinned version starts through npx" ;; *) fail "the pinned version starts through npx (got: $out)" ;; esac
[ -s "$TMP_ROOT/f/stderr" ] && fail "no version notice without a global install" || pass "no version notice without a global install"
[ -d "$NPX_PREFIX" ] && pass "the npx prefix folder exists in the user's home" || fail "the npx prefix folder exists in the user's home"
[ -z "$(ls -A "$NPX_PREFIX" 2>/dev/null)" ] && pass "the npx prefix folder stays empty (no project config inside)" || fail "the npx prefix folder stays empty"

echo ""
echo "─────────────────────────────────────────"
echo "Total: $((PASS + FAIL)) | Passed: $PASS | Failed: $FAIL"
[ "$FAIL" -gt 0 ] && exit 1 || exit 0
