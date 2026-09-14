#!/bin/bash
# Tests for hooks/scripts/block-dangerous-bash.sh — the rules must hold for the Bash and
# the PowerShell tool alike (both send tool_input.command), with and without jq.
#
# Run: bash hooks/scripts/__tests__/block-dangerous-bash.test.sh
#
# Exits 0 on success, prints failures on stdout.

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
HOOK="$SCRIPT_DIR/block-dangerous-bash.sh"

PASS=0
FAIL=0

TMP_ROOT="$(mktemp -d)"
trap 'rm -rf "$TMP_ROOT"' EXIT

# A PATH without jq, so the grep/sed fallback runs. That fallback is what a bare Git Bash
# on Windows gets, and a broken fallback would silently switch every rule off.
NOJQ_BIN="$TMP_ROOT/nojq-bin"; mkdir -p "$NOJQ_BIN"
for t in cat grep head sed tr; do
  printf '#!/bin/sh\nexec "%s" "$@"\n' "$(command -v "$t")" > "$NOJQ_BIN/$t"
  chmod +x "$NOJQ_BIN/$t"
done

# JSON.stringify escapes backslashes and quotes the way the harness does.
payload() {
  node -e 'const [, tool, command] = process.argv; process.stdout.write(JSON.stringify({ tool_name: tool, tool_input: { command } }))' "$1" "$2"
}

run_hook()      { payload "$1" "$2" | CLAUDE_SKIP_DANGEROUS_BASH_CHECK= bash "$HOOK" 2>/dev/null; }
run_hook_nojq() { payload "$1" "$2" | CLAUDE_SKIP_DANGEROUS_BASH_CHECK= PATH="$NOJQ_BIN" "$BASH" "$HOOK" 2>/dev/null; }

expect() {
  # $1 = deny|allow, $2 = hook output, $3 = label
  local want="$1" out="$2" label="$3" got=allow
  echo "$out" | grep -q '"permissionDecision":"deny"' && got=deny
  if [ "$got" = "$want" ]; then
    PASS=$((PASS + 1)); echo "  ✓ $label"
  else
    FAIL=$((FAIL + 1)); echo "  ✗ $label (expected $want, got $got)"
    echo "    output: $out"
  fi
}

echo "Bash tool"
expect deny  "$(run_hook Bash 'rm -rf /')"   'rm -rf / is denied'
expect allow "$(run_hook Bash 'git status')" 'a harmless command is allowed'

echo "PowerShell tool: the shared rules apply"
expect deny  "$(run_hook PowerShell 'git push --force origin main')" 'force push to main is denied'
expect deny  "$(run_hook PowerShell 'docker system prune -a')"       'docker system prune -a is denied'
expect allow "$(run_hook PowerShell 'Get-ChildItem -Recurse src')"   'a harmless command is allowed'

echo "PowerShell tool: recursive delete of a drive root or home"
expect deny  "$(run_hook PowerShell 'Remove-Item -Recurse -Force $HOME')"  'Remove-Item -Recurse $HOME'
expect deny  "$(run_hook PowerShell 'Remove-Item C:\ -Recurse -Force')"    'path before the flag (C:\)'
expect deny  "$(run_hook PowerShell "Remove-Item -Recurse -Force 'C:\\'")" 'quoted drive root'
expect deny  "$(run_hook PowerShell 'rm -r -fo ~')"                        'alias rm -r ~'
expect deny  "$(run_hook PowerShell 'ri $env:USERPROFILE -Recurse')"       'alias ri on $env:USERPROFILE'
expect allow "$(run_hook PowerShell 'Remove-Item -Recurse -Force .\dist')" 'a relative directory is allowed'
expect allow "$(run_hook PowerShell 'Remove-Item -Recurse -Force $HOME\project\node_modules')" 'a directory below home is allowed'
expect allow "$(run_hook PowerShell 'Get-ChildItem -Recurse C:\; Remove-Item .\tmp.txt')"     'flag and root path in different statements'

echo "without jq (grep/sed fallback)"
expect deny  "$(run_hook_nojq PowerShell 'git push -f origin main')"                  'force push is denied'
expect deny  "$(run_hook_nojq PowerShell 'Remove-Item -Recurse -Force C:\')"          'drive root behind a JSON-escaped backslash'
expect allow "$(run_hook_nojq PowerShell 'Remove-Item -Recurse -Force C:\work\dist')" 'a Windows project path is allowed'
expect deny  "$(run_hook_nojq Bash 'echo "x" && rm -rf ~')"                           'escaped quotes do not hide rm -rf ~'

echo ""
echo "─────────────────────────────────────────"
echo "Total: $((PASS + FAIL)) | Passed: $PASS | Failed: $FAIL"
[ "$FAIL" -gt 0 ] && exit 1 || exit 0
