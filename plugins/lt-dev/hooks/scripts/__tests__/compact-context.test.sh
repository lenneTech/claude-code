#!/bin/bash
# Tests for the post-compaction context hook (post-compact-context.sh):
# - registered on SessionStart with matcher "compact" (SessionStart adds stdout to
#   Claude's context; PostCompact stdout only reaches the debug log)
# - reads the SessionStart payload (`source`), not PostCompact's `trigger`
# - resolves the project from CLAUDE_PROJECT_DIR before the payload's cwd, so a
#   compaction after `cd projects/api` still reports the monorepo layout
#
# Run: bash hooks/scripts/__tests__/compact-context.test.sh
#
# Exits 0 on success, prints failures on stdout.

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
HOOK="$SCRIPT_DIR/post-compact-context.sh"
HOOKS_JSON="$SCRIPT_DIR/../hooks.json"

PASS=0
FAIL=0

pass() { PASS=$((PASS + 1)); echo "  ✓ $1"; }
fail() { FAIL=$((FAIL + 1)); echo "  ✗ $1"; }

assert_contains() {
  if printf '%s' "$1" | grep -qF -- "$2"; then pass "$3"; else fail "$3"; echo "    expected to contain: $2"; echo "    actual: $1"; fi
}
assert_not_contains() {
  if printf '%s' "$1" | grep -qF -- "$2"; then fail "$3"; echo "    expected NOT to contain: $2"; echo "    actual: $1"; else pass "$3"; fi
}
assert_silent() {
  if [ -z "$1" ]; then pass "$2"; else fail "$2"; echo "    expected: silent"; echo "    actual: $1"; fi
}

TMP_ROOT="$(mktemp -d)"
trap 'rm -rf "$TMP_ROOT"' EXIT

# A PATH without jq, so the script takes its grep/sed fallback.
NOJQ_BIN="$TMP_ROOT/nojq-bin"; mkdir -p "$NOJQ_BIN"
for t in cat grep head sed tr basename git; do
  command -v "$t" >/dev/null 2>&1 || continue
  printf '#!/bin/sh\nexec "%s" "$@"\n' "$(command -v "$t")" > "$NOJQ_BIN/$t"
  chmod +x "$NOJQ_BIN/$t"
done

PROJ="$TMP_ROOT/proj"
mkdir -p "$PROJ/projects/api" "$PROJ/projects/app"
echo '{"dependencies":{"@lenne.tech/nest-server":"11.2.0"}}' > "$PROJ/projects/api/package.json"
touch "$PROJ/pnpm-lock.yaml"

payload() {
  node -e 'process.stdout.write(JSON.stringify({ hook_event_name: "SessionStart", source: process.argv[1], cwd: process.argv[2] }))' "$1" "$2"
}
run_hook() {
  env CLAUDE_PROJECT_DIR="$PROJ" LT_DEV_REGISTRY_PATH="$TMP_ROOT/none.json" PATH="${HOOK_PATH:-$PATH}" \
    "$BASH" "$HOOK" 2>/dev/null
}

echo "hooks.json: post-compaction context runs on SessionStart compact"
REG=$(node -e '
  const h = JSON.parse(require("fs").readFileSync(0, "utf8")).hooks;
  const uses = (g) => g.hooks.some((x) => (x.command || "").includes("post-compact-context.sh"));
  const fires = (g, src) => new RegExp("^(?:" + (g.matcher || ".*") + ")$").test(src);
  const ss = h.SessionStart || [];
  const n = ss.filter((g) => uses(g) && fires(g, "compact")).length;
  console.log([
    "compact:" + n,
    ss.some((g) => uses(g) && ["startup", "resume", "clear"].some((s) => fires(g, s))) ? "other:yes" : "other:no",
    (h.PostCompact || []).some(uses) ? "postcompact:yes" : "postcompact:no",
  ].join(" "));' < "$HOOKS_JSON")
assert_contains "$REG" "compact:1" "registered exactly once on SessionStart for source compact"
assert_contains "$REG" "other:no" "not registered for startup/resume/clear"
assert_contains "$REG" "postcompact:no" "no PostCompact registration left (its output never reaches Claude)"

echo "SessionStart payload"
OUT=$(payload compact "$PROJ" | run_hook)
assert_contains "$OUT" "Post-Compaction Project Context" "emits the context block for source compact"
assert_contains "$OUT" "nest-server v11.2.0" "context carries the detected backend"
assert_contains "$OUT" "Package Manager: pnpm" "context carries the package manager"
assert_not_contains "$OUT" "unknown" "no PostCompact trigger placeholder in the header"
assert_silent "$(payload startup "$PROJ" | run_hook)" "silent for source startup"

OUT=$(payload compact "$PROJ" | HOOK_PATH="$NOJQ_BIN" run_hook)
assert_contains "$OUT" "Post-Compaction Project Context" "without jq: emits the context block"
assert_silent "$(payload resume "$PROJ" | HOOK_PATH="$NOJQ_BIN" run_hook)" "without jq: silent for source resume"

echo "project dir: CLAUDE_PROJECT_DIR wins over a subfolder cwd"
# After a `cd projects/api` the payload's cwd is the subfolder; the monorepo layout and
# the root lockfile are only visible from the project root in CLAUDE_PROJECT_DIR.
OUT=$(payload compact "$PROJ/projects/api" | run_hook)
assert_contains "$OUT" "fullstack monorepo (projects/api + projects/app)" "subfolder cwd: monorepo layout detected from CLAUDE_PROJECT_DIR"
assert_contains "$OUT" "nest-server v11.2.0 (projects/api)" "subfolder cwd: backend reported relative to the root"
assert_contains "$OUT" "Package Manager: pnpm" "subfolder cwd: root lockfile found"
OUT=$(payload compact "$PROJ/projects/api" | HOOK_PATH="$NOJQ_BIN" run_hook)
assert_contains "$OUT" "fullstack monorepo (projects/api + projects/app)" "subfolder cwd without jq: monorepo layout detected"
# Fallbacks: the payload's cwd when CLAUDE_PROJECT_DIR is unset, then the handler's $PWD.
OUT=$(payload compact "$PROJ" | env -u CLAUDE_PROJECT_DIR LT_DEV_REGISTRY_PATH="$TMP_ROOT/none.json" "$BASH" "$HOOK" 2>/dev/null)
assert_contains "$OUT" "fullstack monorepo (projects/api + projects/app)" "no CLAUDE_PROJECT_DIR: payload cwd is used"
OUT=$(printf '{"hook_event_name":"SessionStart","source":"compact"}' | (cd "$PROJ" && env -u CLAUDE_PROJECT_DIR LT_DEV_REGISTRY_PATH="$TMP_ROOT/none.json" "$BASH" "$HOOK" 2>/dev/null))
assert_contains "$OUT" "fullstack monorepo (projects/api + projects/app)" "no CLAUDE_PROJECT_DIR and no cwd: \$PWD is used"

echo ""
echo "─────────────────────────────────────────"
echo "Total: $((PASS + FAIL)) | Passed: $PASS | Failed: $FAIL"
[ "$FAIL" -gt 0 ] && exit 1 || exit 0
