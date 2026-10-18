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

echo "— tokens in scripts: a shebang or a .py file must not hide a token"
# `file` calls a script with a shebang "text executable"; a skip on "executable" scanned none of them.
TOKEN="glpat-$(printf 'Ab3dEf7hIj9kLm1nOp5q')"
printf '#!/usr/bin/env bash\nTOKEN="%s"\n' "$TOKEN" >"$TMP/probe.sh"
printf '#!/usr/bin/env python3\nTOKEN = "%s"\n' "$TOKEN" >"$TMP/probe.py"
chmod +x "$TMP/probe.sh" "$TMP/probe.py"
scan "$TMP/probe.sh" "$TMP/probe.py"
assert_eq "$CODE" "1" "exit 1 for tokens in executable scripts"
assert_contains "$OUT" "probe.sh" "a bash script with a shebang is scanned"
assert_contains "$OUT" "probe.py" "a python script with a shebang is scanned"
printf '\211PNG\000\001 TOKEN="%s"\000' "$TOKEN" >"$TMP/screenshot.png"
scan "$TMP/screenshot.png"
assert_eq "$CODE" "0" "a known binary format is excluded by its extension"

echo "— files with NUL bytes: no binary exception lets them through"
# `grep -I` treats any file with a NUL byte as binary; a skip on it let these through, while
# the scanner before it still reported them (2026-10-18).
printf 'A\0P\0I\0_\0K\0E\0Y\0=\0x\0\n\0' >"$TMP/prod.env"
scan "$TMP/prod.env"
assert_contains "$OUT" "prod.env" "a UTF-16 .env (as PowerShell 5.1 writes it) is reported by name"
printf 'header\000\000data TOKEN="%s"\n' "$TOKEN" >"$TMP/cache.db"
scan "$TMP/cache.db"
assert_contains "$OUT" "GitLab-Token" "a token in a file with NUL bytes is reported"
mkdir -p "$TMP/keydir"
printf -- '-----BEGIN OPENSSH PRIVATE KEY-----\nabc\n-----END OPENSSH PRIVATE KEY-----\n' >"$TMP/keydir/id_ed25519"
tar -cf "$TMP/backup.tar" -C "$TMP/keydir" id_ed25519
scan "$TMP/backup.tar"
assert_contains "$OUT" "privaten Schlüssel" "a private key inside a .tar is reported"
# The checks that read grep output (3 and 5) need -a under GNU grep, which prints nothing for a
# binary match; BSD grep prints "Binary file matches", so only the Linux CI run catches a lost -a.
printf 'hdr\000\000 API_KEY = "Zq9Xw8Vu7Ts6Rq5Po4Nm" path /Users/realperson/x\n' >"$TMP/blob.db"
scan "$TMP/blob.db"
assert_contains "$OUT" "quotiertes Literal" "a quoted secret in a file with NUL bytes is reported"
assert_contains "$OUT" "/Users/<name>/" "a user path in a file with NUL bytes is reported"
# A secret in a .tar sits behind the entry header, whose `0000000` used to match the placeholder
# `000000` once grep read the header and the secret as one line.
printf 'ustar 0000000 00000000055\000PASSWORD = "Zq9Xw8Vu7Ts6Rq5Po4Nm"\n' >"$TMP/header.bin"
scan "$TMP/header.bin"
assert_contains "$OUT" "quotiertes Literal" "a secret behind a tar-style header with zeros is reported"
mkdir -p "$TMP/cfgdir" && printf 'password: "Zq9Xw8Vu7Ts6Rq5Po4Nm"\n' >"$TMP/cfgdir/settings.yml"
tar -cf "$TMP/config.tar" -C "$TMP/cfgdir" settings.yml
scan "$TMP/config.tar"
assert_contains "$OUT" "quotiertes Literal" "a quoted secret inside a .tar is reported"

echo "— check 7 in a binary file under a UTF-8 locale"
# The BSD cut stops at an invalid UTF-8 byte in the matching line and printed nothing, so the
# name passed on macOS while the old scanner had blocked it (review 2026-10-18).
printf '# test list\nzyxtechnik\n' >"$TMP/denylist.txt"
printf 'hdr\000\n\351 Zyxtechnik export\n' >"$TMP/export.db"
OUT=$(LC_ALL=C.UTF-8 LT_PUBLIC_DENYLIST="$TMP/denylist.txt" bash scripts/scan-secrets.sh "$TMP/export.db" 2>&1)
assert_contains "$OUT" "internen Sperrliste" "a denylisted name next to a Latin-1 byte in a binary file is reported"

echo "— file names git would quote, and names that look like options"
# Without -z, git quotes a name with an umlaut ("Kunden\303\274bersicht.txt") and the scanner
# skipped the file in every mode; `-f` and `-` were read as a grep option and as stdin.
printf 'TOKEN="%s"\n' "$TOKEN" >"docs/Kundenübersicht.txt"
printf 'TOKEN="%s"\n' "$TOKEN" >"./-f"
: >"./-"
git add -- "docs/Kundenübersicht.txt" ./-f ./-
scan --staged
assert_contains "$OUT" "Kundenübersicht.txt" "a staged file with an umlaut in its name is scanned"
assert_contains "$OUT" "./-f" "a staged file named -f is scanned"
assert_eq "$CODE" "1" "a file named - does not swallow the rest of the list"
git reset -q -- "docs/Kundenübersicht.txt" ./-f ./- && rm -f -- "docs/Kundenübersicht.txt" ./-f ./-

echo "— many hits: pipefail must not swallow a check"
# Under `set -o pipefail` a `grep -o … | grep -q .` ends with 141 once `grep -q` closes early,
# and with enough matches the check reported nothing. It is a race: measured with GNU grep 3.11 the
# old pipe already lost some runs from about 4 KB of -o output, on macOS above its 16 KB pipe buffer,
# and from about 160 KB it lost every run on both. Each file here produces several hundred KB, so
# the test fails the old pipes every time (measured 2026-10-18; keep the files this large).
awk -v t="$TOKEN" 'BEGIN { for (i = 0; i < 10000; i++) print t }' >"$TMP/many-tokens.txt"
scan "$TMP/many-tokens.txt"
assert_contains "$OUT" "GitLab-Token" "10,000 tokens in one file are reported"
awk 'BEGIN { for (i = 0; i < 10000; i++) print "API_KEY = \"Zq9Xw8Vu7Ts6Rq5Po4Nm\"" }' >"$TMP/many-secrets.ts"
scan "$TMP/many-secrets.ts"
assert_contains "$OUT" "quotiertes Literal" "10,000 quoted secret assignments are reported"
awk 'BEGIN { for (i = 0; i < 10000; i++) print "path /Users/realperson-0123456789abcdef0123456789abcdef/x" }' >"$TMP/many-paths.txt"
scan "$TMP/many-paths.txt"
assert_contains "$OUT" "/Users/<name>/" "10,000 local user paths are reported"

echo
echo "passed: $PASS, failed: $FAIL"
[ "$FAIL" -eq 0 ]
