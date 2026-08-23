#!/bin/bash
# Tests for scripts/check-push-channel.sh — host parsing from both remote forms, the
# ssh-verdict mapping, and the error exits.
#
# The network call is stubbed by putting a fake `ssh` (and `timeout`) earlier on PATH, so the
# tests are hermetic and assert the DECISION LOGIC rather than this machine's SSH setup. That
# separation is the point: the bug this script exists for was a wrong inference from a real
# agent, and a test that consults the real agent could not have caught it either.
#
# Run: bash scripts/__tests__/check-push-channel.test.sh

set -u

SCRIPT="$(cd "$(dirname "$0")/.." && pwd)/check-push-channel.sh"
PASS=0
FAIL=0

assert_field() {
  local actual="$1" field="$2" expected="$3" label="$4"
  local got; got="$(printf '%s' "$actual" | cut -f"$field")"
  if [ "$got" = "$expected" ]; then
    PASS=$((PASS + 1)); echo "  ✓ $label"
  else
    FAIL=$((FAIL + 1)); echo "  ✗ $label"
    echo "    expected field $field: $expected"
    echo "    actual:              $got"
  fi
}

assert_exit() {
  local expected="$1" label="$2"; shift 2
  "$@" >/dev/null 2>&1; local got=$?
  if [ "$got" = "$expected" ]; then
    PASS=$((PASS + 1)); echo "  ✓ $label"
  else
    FAIL=$((FAIL + 1)); echo "  ✗ $label (expected exit $expected, got $got)"
  fi
}

TMP_ROOT="$(mktemp -d)"; TMP_ROOT="$(cd "$TMP_ROOT" && pwd -P)"
cleanup() { rm -rf "$TMP_ROOT"; }
trap cleanup EXIT

# A fake ssh whose output is whatever $FAKE_SSH_OUTPUT says, plus a passthrough `timeout` so the
# real one does not shadow it.
STUB_BIN="$TMP_ROOT/bin"; mkdir -p "$STUB_BIN"
cat > "$STUB_BIN/ssh" <<'STUB'
#!/bin/bash
printf '%s\n' "${FAKE_SSH_OUTPUT:-}"
exit 1
STUB
cat > "$STUB_BIN/timeout" <<'STUB'
#!/bin/bash
shift
exec "$@"
STUB
# gh / glab presence and auth state are what decide whether a fallback EXISTS, so both are
# stubbed too — otherwise the tests would assert this machine's login state, not the logic.
cat > "$STUB_BIN/gh" <<'STUB'
#!/bin/bash
exit "${FAKE_GH_AUTH_EXIT:-0}"
STUB
cat > "$STUB_BIN/glab" <<'STUB'
#!/bin/bash
exit "${FAKE_GLAB_AUTH_EXIT:-1}"
STUB
chmod +x "$STUB_BIN/ssh" "$STUB_BIN/timeout" "$STUB_BIN/gh" "$STUB_BIN/glab"
export PATH="$STUB_BIN:$PATH"

# Cut the tests off from the developer's real git configuration. Without this,
# `git credential fill` consults the actual macOS keychain — which HAS entries for both hosts —
# so every "no fallback" case would silently become "https" and the blocked branch would never
# be exercised. That is the same class of mistake as the invented test fixture: a green test
# measuring the machine rather than the code.
# GIT_CONFIG_GLOBAL/SYSTEM alone are NOT enough: Apple Git compiles `osxkeychain` in as a
# default, so it answers `credential fill` even with every config file neutralised. Only an
# empty `credential.helper` entry resets that list — and each test repo gets one, so no test
# ever reaches the developer's real keychain. (Verified 2026-08-23: without this, the "no
# fallback" cases silently passed as `https` because the machine happened to have credentials
# stored — a green test measuring the machine instead of the code.)
export GIT_CONFIG_GLOBAL=/dev/null
export GIT_CONFIG_SYSTEM=/dev/null

# Opt a single case back into "credentials exist", via a helper that just prints one.
CRED_STUB="$TMP_ROOT/cred-helper.sh"
cat > "$CRED_STUB" <<'STUB'
#!/bin/bash
[ "${1:-}" = "get" ] && printf 'username=someone\npassword=stored-token\n'
STUB
chmod +x "$CRED_STUB"

make_repo() {
  local dir="$1" url="$2"
  rm -rf "$dir"; mkdir -p "$dir"
  git -C "$dir" init --quiet
  git -C "$dir" remote add origin "$url"
  git -C "$dir" config credential.helper ''   # reset the compiled-in osxkeychain default
  printf '%s' "$dir"
}

echo "check-push-channel.sh"

echo "host parsing"
SCP_REPO="$(make_repo "$TMP_ROOT/scp" 'git@github.com:lenneTech/nuxt-extensions.git')"
URL_REPO="$(make_repo "$TMP_ROOT/url" 'https://github.com/lenneTech/nuxt-extensions.git')"
GL_REPO="$(make_repo "$TMP_ROOT/gl" 'git@gitlab.lenne.tech:intern/claude-code-internal.git')"
AUTH_REPO="$(make_repo "$TMP_ROOT/auth" 'https://user@gitlab.lenne.tech/intern/x.git')"

export FAKE_SSH_OUTPUT="Hi kaihaase! You've successfully authenticated, but GitHub does not provide shell access."
assert_field "$(bash "$SCRIPT" "$SCP_REPO")" 2 'github.com' 'scp-form remote (git@host:owner/repo)'
assert_field "$(bash "$SCRIPT" "$URL_REPO")" 2 'github.com' 'url-form remote (https://host/owner/repo)'
assert_field "$(bash "$SCRIPT" "$GL_REPO")"  2 'gitlab.lenne.tech' 'self-hosted GitLab host'
assert_field "$(bash "$SCRIPT" "$AUTH_REPO")" 2 'gitlab.lenne.tech' 'url with userinfo strips the user'

echo "verdict mapping"
assert_field "$(bash "$SCRIPT" "$SCP_REPO")" 1 'ssh' 'GitHub success banner -> ssh'

export FAKE_SSH_OUTPUT="Welcome to GitLab, @kaihaase!"
assert_field "$(bash "$SCRIPT" "$GL_REPO")" 1 'ssh' 'GitLab welcome banner -> ssh'

export FAKE_SSH_OUTPUT="git@github.com: Permission denied (publickey)."
assert_field "$(bash "$SCRIPT" "$SCP_REPO")" 1 'https' 'permission denied -> not ssh'

export FAKE_SSH_OUTPUT=""
assert_field "$(bash "$SCRIPT" "$SCP_REPO")" 1 'https' 'silence (timeout/unreachable) -> not ssh'

export FAKE_SSH_OUTPUT="ssh: connect to host github.com port 22: Operation timed out"
assert_field "$(bash "$SCRIPT" "$SCP_REPO")" 1 'https' 'unknown banner -> never a guessed ssh'

echo "fallback availability — the point of the blocked verdict"
export FAKE_SSH_OUTPUT="git@host: Permission denied (publickey)."

export FAKE_GH_AUTH_EXIT=0
assert_field "$(bash "$SCRIPT" "$SCP_REPO")" 1 'https' 'GitHub + gh authenticated -> https'
assert_field "$(bash "$SCRIPT" "$SCP_REPO")" 4 "-c credential.helper='!gh auth git-credential'" 'GitHub fallback names the ready-to-use helper'

export FAKE_GH_AUTH_EXIT=1
assert_field "$(bash "$SCRIPT" "$SCP_REPO")" 1 'blocked' 'GitHub + gh NOT authenticated -> blocked, not a broken https'

# The case this whole verdict exists for: the lt stack pushes to gitlab.lenne.tech, where no
# fallback is configured. Reporting `https` there would hand back a GitHub-only command.
export FAKE_GLAB_AUTH_EXIT=1
assert_field "$(bash "$SCRIPT" "$GL_REPO")" 1 'blocked' 'GitLab without a helper -> blocked'
assert_field "$(bash "$SCRIPT" "$GL_REPO")" 4 'no credentials for gitlab.lenne.tech — fix SSH, or store them (glab auth login / git credential approve)' 'GitLab blocked names the actual remedy'

export FAKE_GLAB_AUTH_EXIT=0
assert_field "$(bash "$SCRIPT" "$GL_REPO")" 1 'https' 'GitLab + glab authenticated for THIS host -> https'
assert_field "$(bash "$SCRIPT" "$GL_REPO")" 4 "-c credential.helper='!glab auth git-credential'" 'GitLab fallback uses glab, never gh'

# Stored credentials win over both CLIs: a plain https push already works, so the caller should
# not be handed a `-c credential.helper=…` it does not need. This is the osxkeychain case, which
# is exactly how gitlab.lenne.tech is reachable on a real machine.
export FAKE_GLAB_AUTH_EXIT=1
git -C "$GL_REPO" config --add credential.helper "$CRED_STUB"
assert_field "$(bash "$SCRIPT" "$GL_REPO")" 1 'https' 'stored credentials -> https'
assert_field "$(bash "$SCRIPT" "$GL_REPO")" 4 '(credentials already available — plain https push works)' 'stored credentials need no extra helper flag'
git -C "$GL_REPO" config --unset-all credential.helper; git -C "$GL_REPO" config credential.helper ''

echo "error exits"
assert_exit 2 'not a git repository -> exit 2' bash "$SCRIPT" "$TMP_ROOT"
assert_exit 2 'missing remote -> exit 2' bash "$SCRIPT" "$SCP_REPO" nope
assert_exit 2 'nonexistent directory -> exit 2' bash "$SCRIPT" "$TMP_ROOT/does-not-exist"

echo
echo "  $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
