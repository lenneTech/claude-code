#!/bin/bash
# shellcheck disable=SC1111  # the scanner reports words in German typographic quotes
# Tests for scripts/scan-secrets.sh — the name checks: the internal denylist (check 7) and
# new proper names next to a customer cue word (check 8), in a throwaway git repository.
#
# Run: bash scripts/__tests__/scan-secrets.test.sh

set -u

SCANNER="$(cd "$(dirname "$0")/.." && pwd)/scan-secrets.sh"
PASS=0
FAIL=0

assert_contains() {
  local actual="$1" needle="$2" label="$3"
  if printf '%s' "$actual" | grep -qF -- "$needle"; then
    PASS=$((PASS + 1)); echo "  ✓ $label"
  else
    FAIL=$((FAIL + 1)); echo "  ✗ $label"; echo "    expected to contain: $needle"; echo "    actual: $actual"
  fi
}

assert_not_contains() {
  local actual="$1" needle="$2" label="$3"
  if printf '%s' "$actual" | grep -qF -- "$needle"; then
    FAIL=$((FAIL + 1)); echo "  ✗ $label"; echo "    expected NOT to contain: $needle"; echo "    actual: $actual"
  else
    PASS=$((PASS + 1)); echo "  ✓ $label"
  fi
}

assert_eq() {
  local actual="$1" expected="$2" label="$3"
  if [ "$actual" = "$expected" ]; then
    PASS=$((PASS + 1)); echo "  ✓ $label"
  else
    FAIL=$((FAIL + 1)); echo "  ✗ $label"; echo "    expected: $expected"; echo "    actual:   $actual"
  fi
}

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
REPO="$TMP/repo"
mkdir -p "$REPO/scripts" "$REPO/docs"
cp "$SCANNER" "$REPO/scripts/scan-secrets.sh"
cd "$REPO" || exit 1
git init -q
git config user.email test@test.com
git config user.name Test
cat >docs/base.md <<'MD'
# Base

The Customer reads this. Linear tickets carry the work.
MD
git add -A
git commit -qm base

scan() {
  OUT=$(bash scripts/scan-secrets.sh "$@" 2>&1)
  CODE=$?
}

stage_line() {
  printf '%s\n' "$1" >docs/new.md
  git add docs/new.md
}

echo "scan-secrets.sh — name checks"

echo "— check 8: an unknown name next to a customer cue blocks the commit"
stage_line "The pattern: the Zyxtechnik concept folder keeps a generator (in that customer project, not here)."
scan --staged
assert_eq "$CODE" "1" "exit 1"
assert_contains "$OUT" "docs/new.md:1" "names file and line"
assert_contains "$OUT" "„Zyxtechnik“" "names the word"
assert_not_contains "$OUT" "„The“" "words already in the repo are not reported"

echo "— check 8: German cue words, compounds included"
stage_line "Im Kundenprojekt Quorvax liegt der Generator."
scan --staged
assert_contains "$OUT" "„Quorvax“" "Kundenprojekt counts as a cue"
stage_line "Für den Kunden Brelitz bauen wir das."
scan --staged
assert_contains "$OUT" "„Brelitz“" "Kunden counts as a cue"

echo "— check 8: no cue, no finding"
stage_line "The Zyxtechnik generator walks the diagram data."
scan --staged
assert_eq "$CODE" "0" "exit 0 without a cue word"

echo "— check 8: known words next to a cue pass"
stage_line "A Customer opens Linear and reads the customer view."
scan --staged
assert_eq "$CODE" "0" "exit 0 when every capitalised word is known"

echo "— check 8: word: entries in .secrets-allow silence a term"
stage_line "The customer reads the Druckfassung."
scan --staged
assert_contains "$OUT" "„Druckfassung“" "flagged before allowlisting"
printf 'word:Druckfassung\n' >.secrets-allow
git add .secrets-allow
scan --staged
assert_eq "$CODE" "0" "exit 0 once allowlisted"
git rm -q --cached .secrets-allow && rm .secrets-allow

echo "— check 8: line numbers point at the added line"
printf 'line one\nline two\nOur customer Velmora signed.\n' >docs/new.md
git add docs/new.md
scan --staged
assert_contains "$OUT" "docs/new.md:3" "third line reported as :3"
git reset -q docs/new.md && rm docs/new.md

echo "— check 8: --range compares against the range start"
stage_line "The customer Torvexa runs it."
git commit -qm "add name"
scan --range HEAD~1..HEAD
assert_contains "$OUT" "„Torvexa“" "found in a pushed range"
git reset -q --hard HEAD~1

echo "— check 8 stays off for --all and explicit files"
stage_line "The customer Torvexa runs it."
scan --all
assert_not_contains "$OUT" "Neuer Eigenname" "--all does not run check 8"
git reset -q docs/new.md && rm docs/new.md

echo "— check 7: a denylisted name blocks, with or without a cue"
printf '# test list\nzyxtechnik\n' >"$TMP/denylist.txt"
stage_line "The Zyxtechnik generator walks the diagram data."
LT_PUBLIC_DENYLIST="$TMP/denylist.txt" scan --staged
assert_eq "$CODE" "1" "exit 1"
assert_contains "$OUT" "internen Sperrliste" "reported as a denylist hit"
git reset -q docs/new.md && rm docs/new.md

echo "— check 7: live patterns from the private generator (--print), and the fallback"
if command -v bun >/dev/null 2>&1; then
  INTERNAL="$TMP/claude-code-internal"
  mkdir -p "$INTERNAL/scripts"
  printf '# file list\nzyxfile\n' >"$INTERNAL/public-denylist.txt"
  # A generator that knows --print adds a pattern the file does not have yet (the live master data).
  cat >"$INTERNAL/scripts/build-public-denylist.ts" <<'TS'
if (process.argv.includes('--print')) { console.log('zyxfile'); console.log('zyxlive'); }
TS
  stage_line "The Zyxlive generator walks the diagram data."
  scan --staged
  assert_contains "$OUT" "internen Sperrliste" "a name only the live data knows is blocked"
  # An older generator without --print would rewrite the file and print a status line: not used.
  printf 'console.log("✓ public-denylist.txt: 1 manual + 2 generated patterns.")\n' >"$INTERNAL/scripts/build-public-denylist.ts"
  stage_line "The Zyxfile generator walks the diagram data."
  scan --staged
  assert_contains "$OUT" "internen Sperrliste" "without --print the file still applies"
  assert_eq "$(cat "$INTERNAL/public-denylist.txt")" "$(printf '# file list\nzyxfile')" "the file is left untouched"
  git reset -q docs/new.md && rm docs/new.md
  rm -rf "$INTERNAL"
else
  echo "  (skipped: bun not installed)"
fi

echo
echo "passed: $PASS, failed: $FAIL"
[ "$FAIL" -eq 0 ]
