#!/bin/bash
# Tests for scripts/find-vault-logins.sh — host matching against a stage,
# personal-vault exclusion, the private link, and the guarantee that no secret
# is ever requested from 1Password.
#
# A stub `op` on PATH answers from fixtures and logs every call, so the tests
# run without a 1Password account.
#
# Run: bash scripts/__tests__/find-vault-logins.test.sh

set -u

SCRIPT="$(cd "$(dirname "$0")/.." && pwd)/find-vault-logins.sh"
PASS=0
FAIL=0

assert_eq() {
  local actual="$1" expected="$2" label="$3"
  if [ "$actual" = "$expected" ]; then
    PASS=$((PASS + 1)); echo "  ✓ $label"
  else
    FAIL=$((FAIL + 1)); echo "  ✗ $label"
    echo "    expected: $expected"
    echo "    actual:   $actual"
  fi
}

assert_contains() {
  local actual="$1" needle="$2" label="$3"
  if echo "$actual" | grep -qF -- "$needle"; then
    PASS=$((PASS + 1)); echo "  ✓ $label"
  else
    FAIL=$((FAIL + 1)); echo "  ✗ $label"
    echo "    expected to contain: $needle"
    echo "    actual: $actual"
  fi
}

assert_not_contains() {
  local actual="$1" needle="$2" label="$3"
  if echo "$actual" | grep -qF -- "$needle"; then
    FAIL=$((FAIL + 1)); echo "  ✗ $label"
    echo "    expected NOT to contain: $needle"
  else
    PASS=$((PASS + 1)); echo "  ✓ $label"
  fi
}

TMP_ROOT="$(mktemp -d)"
trap 'rm -rf "$TMP_ROOT"' EXIT
BIN="$TMP_ROOT/bin"
FIX="$TMP_ROOT/fixtures"
mkdir -p "$BIN" "$FIX"
OP_LOG="$TMP_ROOT/op.log"

cat >"$FIX/accounts.json" <<'JSON'
[
  {"url": "team.1password.example", "email": "dev@example.test", "account_uuid": "ACCTEAM"},
  {"url": "home.1password.example", "email": "me@example.test", "account_uuid": "ACCHOME"}
]
JSON

cat >"$FIX/items-team.json" <<'JSON'
[
  {"id": "itmadmin", "title": "Beispielprojekt Dev Admin", "tags": ["dev"],
   "vault": {"id": "vltproj", "name": "Beispielprojekt"}, "category": "LOGIN",
   "additional_information": "admin@example.test",
   "urls": [{"primary": true, "href": "https://app.dev.example.com/login"}]},
  {"id": "itmuser", "title": "Beispielprojekt Dev User", "tags": [],
   "vault": {"id": "vltproj", "name": "Beispielprojekt"}, "category": "LOGIN",
   "additional_information": "user@example.test",
   "urls": [{"href": "api.dev.example.com:443/iam"}]},
  {"id": "itmprod", "title": "Beispielprojekt Prod Admin", "tags": [],
   "vault": {"id": "vltproj", "name": "Beispielprojekt"}, "category": "LOGIN",
   "additional_information": "admin@example.com",
   "urls": [{"href": "https://example.com/login"}]},
  {"id": "itmother", "title": "Anderes Projekt Dev", "tags": [],
   "vault": {"id": "vltother", "name": "Anderes"}, "category": "LOGIN",
   "additional_information": "x@example.test",
   "urls": [{"href": "https://app.dev.other.test"}]},
  {"id": "itmnourl", "title": "Beispielprojekt Notiz", "tags": [],
   "vault": {"id": "vltproj", "name": "Beispielprojekt"}, "category": "LOGIN",
   "additional_information": "n@example.test"}
]
JSON

cat >"$FIX/items-home.json" <<'JSON'
[
  {"id": "itmpriv", "title": "Mein Dev Admin", "tags": [],
   "vault": {"id": "vltpriv", "name": "Private"}, "category": "LOGIN",
   "additional_information": "mine@example.test",
   "urls": [{"href": "https://app.dev.example.com"}]}
]
JSON

# Stub op. OP_STUB_MODE switches failure shapes per case.
cat >"$BIN/op" <<STUB
#!/bin/bash
echo "\$*" >>"$OP_LOG"
case "\${OP_STUB_MODE:-ok}" in
  noaccounts) [ "\$1 \$2" = "account list" ] && { echo "[]"; exit 0; } ;;
  listfail) [ "\$1 \$2" = "item list" ] && { echo "[ERROR] account is not signed in" >&2; exit 1; } ;;
esac
if [ "\$1 \$2" = "account list" ]; then cat "$FIX/accounts.json"; exit 0; fi
if [ "\$1 \$2" = "item list" ]; then
  acct=""
  while [ \$# -gt 0 ]; do [ "\$1" = "--account" ] && acct="\$2"; shift; done
  case "\$acct" in
    team.1password.example) cat "$FIX/items-team.json" ;;
    home.1password.example) cat "$FIX/items-home.json" ;;
    *) echo "[]" ;;
  esac
  exit 0
fi
if [ "\$1 \$2" = "item get" ]; then
  id="\$3"; vault=""
  while [ \$# -gt 0 ]; do [ "\$1" = "--vault" ] && vault="\$2"; shift; done
  echo "https://start.1password.com/open/i?a=ACC&v=\${vault}&i=\${id}&h=team.1password.example"
  exit 0
fi
echo "unexpected op call: \$*" >&2
exit 3
STUB
chmod +x "$BIN/op"

run() {
  : >"$OP_LOG"
  OUT=$(PATH="$BIN:$PATH" bash "$SCRIPT" "$@" 2>"$TMP_ROOT/err")
  CODE=$?
  ERR=$(cat "$TMP_ROOT/err")
}

echo "find-vault-logins.sh"

echo "— exact host and subdomain items match, parent domain does not"
run --host app.dev.example.com --host api.dev.example.com
assert_eq "$CODE" "0" "exit 0 on a match"
assert_contains "$OUT" '"itemId":"itmadmin"' "app host item matches"
assert_contains "$OUT" '"itemId":"itmuser"' "api host item with port and no scheme matches"
assert_not_contains "$OUT" '"itemId":"itmprod"' "production item on the parent domain is never offered"
assert_not_contains "$OUT" '"itemId":"itmother"' "other project's item does not match"
assert_not_contains "$OUT" '"itemId":"itmnourl"' "item without URL does not match"
assert_contains "$OUT" '"login":"admin@example.test"' "login name comes from additional_information"
assert_contains "$OUT" '"link":"https://start.1password.com/open/i?a=ACC&v=vltproj&i=itmadmin' "private link is attached"
assert_contains "$OUT" '"account":"team.1password.example"' "account is reported"
assert_eq "$(echo "$OUT" | wc -l | tr -d ' ')" "2" "one line per matching login"

echo "— a stage base host matches items on its subdomains"
run --host dev.example.com
assert_contains "$OUT" '"itemId":"itmadmin"' "app.dev item matches stage host dev.example.com"
assert_not_contains "$OUT" '"itemId":"itmprod"' "example.com item still excluded"

echo "— a full URL as --host is reduced to its host"
run --host "https://APP.dev.example.com/admin?tab=1"
assert_contains "$OUT" '"itemId":"itmadmin"' "URL and case are normalised"

echo "— personal vaults are skipped unless asked for"
run --host app.dev.example.com
assert_not_contains "$OUT" '"itemId":"itmpriv"' "Private vault item skipped by default"
run --host app.dev.example.com --include-personal
assert_contains "$OUT" '"itemId":"itmpriv"' "Private vault item kept with --include-personal"

echo "— title filter narrows the result"
run --host dev.example.com --title-contains "dev user"
assert_contains "$OUT" '"itemId":"itmuser"' "matching title kept"
assert_not_contains "$OUT" '"itemId":"itmadmin"' "non-matching title dropped"

echo "— --account restricts the search to one account"
run --host app.dev.example.com --account home.1password.example --include-personal
assert_contains "$OUT" '"itemId":"itmpriv"' "item from the named account"
assert_not_contains "$OUT" '"itemId":"itmadmin"' "other account not searched"
assert_not_contains "$(cat "$OP_LOG")" "account list" "no account discovery when --account is given"

echo "— no match exits 1 without output"
run --host app.dev.nothing.test
assert_eq "$CODE" "1" "exit 1 when nothing matches"
assert_eq "$OUT" "" "no output when nothing matches"

echo "— op unavailable or not signed in exits 2"
: >"$OP_LOG"
OUT=$(PATH="/usr/bin:/bin" bash "$SCRIPT" --host app.dev.example.com 2>&1); CODE=$?
assert_eq "$CODE" "2" "exit 2 without op on PATH"
assert_contains "$OUT" "not installed" "says op is missing"
OP_STUB_MODE=noaccounts run --host app.dev.example.com
assert_eq "$CODE" "2" "exit 2 when no account is configured"
OP_STUB_MODE=listfail run --host app.dev.example.com
assert_eq "$CODE" "2" "exit 2 when no account can be listed"
assert_contains "$ERR" "not signed in" "names the sign-in problem"
run
assert_eq "$CODE" "2" "exit 2 without --host"

echo "— no secret is ever requested"
OP_STUB_MODE=ok run --host dev.example.com --include-personal
LOG=$(cat "$OP_LOG")
assert_not_contains "$LOG" "--reveal" "never --reveal"
assert_not_contains "$LOG" "--fields" "never --fields"
assert_not_contains "$LOG" "--otp" "never --otp"
assert_not_contains "$LOG" "read " "never op read"
assert_not_contains "$LOG" "item share" "never op item share (public link)"
assert_contains "$LOG" "--share-link" "uses the private link flag"

echo
echo "passed: $PASS, failed: $FAIL"
[ "$FAIL" -eq 0 ]
