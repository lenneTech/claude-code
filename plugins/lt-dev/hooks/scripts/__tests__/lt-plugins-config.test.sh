#!/bin/bash
# Tests for hooks/scripts/_lt-plugins-config.sh — lt_plugins_file_mtime must return a
# plain epoch number under BSD and GNU stat alike, otherwise the lock-age arithmetic
# breaks and the update lock logic stops working on Linux and Git Bash.
#
# Run: bash hooks/scripts/__tests__/lt-plugins-config.test.sh
#
# Exits 0 on success, prints failures on stdout.

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG="$SCRIPT_DIR/_lt-plugins-config.sh"

PASS=0
FAIL=0

check() {
  # $1 = label, rest = command that must succeed
  local label="$1"; shift
  if "$@"; then
    PASS=$((PASS + 1)); echo "  ✓ $label"
  else
    FAIL=$((FAIL + 1)); echo "  ✗ $label"
  fi
}
not() { ! "$@"; }
is_epoch() { case "$1" in ''|*[!0-9]*) return 1 ;; *) [ "$1" -gt 1000000000 ] ;; esac; }
# Subshells, so an arithmetic error inside the helper fails the check instead of
# aborting the test script. $$ stays the parent's pid inside them.
acquire() { ( lt_plugins_acquire_lock ); }

TMP_ROOT="$(mktemp -d)"
trap 'rm -rf "$TMP_ROOT"' EXIT

export CLAUDE_PLUGIN_DATA="$TMP_ROOT/state"
mkdir -p "$CLAUDE_PLUGIN_DATA"
# shellcheck source=../_lt-plugins-config.sh
. "$CONFIG"

# Stubs answer BOTH stat spellings the way the other platform's stat does, so each
# branch is exercised wherever the test runs. GNU `stat -f` reports the file system.
make_stubs() {
  local dir="$1" os="$2"
  mkdir -p "$dir"
  printf '#!/bin/sh\necho %s\n' "$os" > "$dir/uname"
  if [ "$os" = Linux ]; then
    cat > "$dir/stat" <<'STUB'
#!/bin/sh
case "$1" in
  -f) printf '  File: "%s"\n    ID: 0        Namelen: 255     Type: ext2/ext3\n' "$3"; exit 1 ;;
  -c) echo 1700000000 ;;
esac
STUB
  else
    cat > "$dir/stat" <<'STUB'
#!/bin/sh
case "$1" in
  -f) echo 1700000001 ;;
  -c) echo "stat: illegal option -- c" >&2; exit 1 ;;
esac
STUB
  fi
  chmod +x "$dir/uname" "$dir/stat"
}

echo "lt_plugins_file_mtime on this platform"
touch "$TMP_ROOT/file"
m=$(lt_plugins_file_mtime "$TMP_ROOT/file")
check "returns a plain epoch number ($m)" is_epoch "$m"
is_epoch "$m" && check "is within a minute of now" [ $(( $(date +%s) - m )) -lt 60 ]
check "falls back to 0 for a missing file" [ "$(lt_plugins_file_mtime "$TMP_ROOT/missing")" = 0 ]

echo "GNU stat (Linux, Git Bash)"
make_stubs "$TMP_ROOT/gnu" Linux
m=$(export PATH="$TMP_ROOT/gnu:$PATH"; hash -r; lt_plugins_file_mtime "$TMP_ROOT/file")
check "uses stat -c %Y, never the stat -f file-system output" [ "$m" = 1700000000 ]

echo "BSD stat (macOS)"
make_stubs "$TMP_ROOT/bsd" Darwin
m=$(export PATH="$TMP_ROOT/bsd:$PATH"; hash -r; lt_plugins_file_mtime "$TMP_ROOT/file")
check "uses stat -f %m" [ "$m" = 1700000001 ]

echo "lock handling"
sh -c 'exit 0' & dead_pid=$!
wait "$dead_pid"
mkdir -p "$LT_PLUGINS_LOCK_DIR"
echo "$dead_pid" > "$LT_PLUGINS_LOCK_DIR/pid"
check "a lock left by a dead process is reclaimed" acquire
check "the reclaimed lock carries this process's pid" [ "$(cat "$LT_PLUGINS_LOCK_DIR/pid" 2>/dev/null)" = "$$" ]
check "a fresh lock held by a live process is respected" not acquire

echo ""
echo "─────────────────────────────────────────"
echo "Total: $((PASS + FAIL)) | Passed: $PASS | Failed: $FAIL"
[ "$FAIL" -gt 0 ] && exit 1 || exit 0
