#!/usr/bin/env bash
# Launches chrome-devtools-mcp. On macOS machines that have Google Chrome Canary
# installed, automatically appends --channel=canary so the automated browser is
# distinguishable from the developer's daily-driver Chrome (yellow icon in the
# window switcher). On all other systems behaves exactly like
#   npx -y chrome-devtools-mcp@latest "$@"
#
# Override the auto-detection with CHROME_MCP_CHANNEL=stable|canary.
#
# KEEP IN SYNC with the twin under the other plugin's scripts/ directory
# (lt-dev <-> lt-showroom). Plugin isolation forbids sharing files between
# plugins. The canonical copy lives in lt-dev; mirror via:
#   .claude/scripts/sync-chrome-mcp-launcher.sh
# CI check:
#   .claude/scripts/sync-chrome-mcp-launcher.sh --check

set -eu

# ensure_node_on_path — make `npx`/`node` resolvable before we exec npx.
#
# Claude Code's sandbox (≈ extension 2.1.19x, mid-2026) runs MCP subprocesses
# with a minimal PATH that excludes Homebrew and every Node version-manager bin
# dir. For fnm/nvm/volta/asdf/mise users `npx` is then missing and this launcher
# would die with "npx: not found". This best-effort, idempotent resolver probes
# the common version-manager locations and prepends the first one that has a real
# `node`. NO-OP when npx already resolves. INLINED (not sourced) on purpose:
# plugin isolation forbids cross-plugin file sharing and this script must stay
# byte-identical to its lt-showroom twin. Canonical copy:
#   plugins/lt-dev/scripts/lib/ensure-node-path.sh  (keep both in sync).
ensure_node_on_path() {
  if command -v npx >/dev/null 2>&1 && command -v node >/dev/null 2>&1; then
    return 0
  fi
  _enp_candidates="${VOLTA_HOME:-$HOME/.volta}/bin
${FNM_DIR:-$HOME/.local/share/fnm}/aliases/default/bin
$HOME/.asdf/shims
${MISE_DATA_DIR:-$HOME/.local/share/mise}/shims
/opt/homebrew/bin
/usr/local/bin"
  if [ -f "$HOME/.nvm/alias/default" ]; then
    _enp_nvm_v="$(cat "$HOME/.nvm/alias/default" 2>/dev/null)"
    if [ -n "$_enp_nvm_v" ]; then
      _enp_candidates="$_enp_candidates
$HOME/.nvm/versions/node/$_enp_nvm_v/bin
$HOME/.nvm/versions/node/v$_enp_nvm_v/bin"
    fi
  fi
  _enp_last_fnm="$(ls -d "${FNM_DIR:-$HOME/.local/share/fnm}"/node-versions/*/installation/bin 2>/dev/null | sort -V | tail -n1)"
  _enp_last_nvm="$(ls -d "$HOME/.nvm/versions/node"/*/bin 2>/dev/null | sort -V | tail -n1)"
  _enp_candidates="$_enp_candidates
$_enp_last_fnm
$_enp_last_nvm"
  _enp_old_ifs="$IFS"
  IFS='
'
  for _enp_dir in $_enp_candidates; do
    [ -n "$_enp_dir" ] || continue
    if [ -x "$_enp_dir/node" ]; then
      case ":$PATH:" in
        *":$_enp_dir:"*) ;;
        *) PATH="$_enp_dir:$PATH"; export PATH ;;
      esac
      if command -v npx >/dev/null 2>&1; then
        IFS="$_enp_old_ifs"
        return 0
      fi
    fi
  done
  IFS="$_enp_old_ifs"
  if command -v npx >/dev/null 2>&1; then
    return 0
  fi
  return 1
}

resolve_channel() {
  if [ -n "${CHROME_MCP_CHANNEL:-}" ]; then
    case "$CHROME_MCP_CHANNEL" in
      canary|stable) printf '%s\n' "$CHROME_MCP_CHANNEL"; return ;;
      *)
        printf 'chrome-devtools-mcp-launcher: ignoring invalid CHROME_MCP_CHANNEL=%s (expected stable|canary)\n' \
          "$CHROME_MCP_CHANNEL" >&2
        ;;
    esac
  fi

  [ "$(uname -s)" = "Darwin" ] || { printf 'stable\n'; return; }

  if [ -d "/Applications/Google Chrome Canary.app" ] \
     || [ -d "${HOME}/Applications/Google Chrome Canary.app" ]; then
    printf 'canary\n'; return
  fi

  if command -v mdfind >/dev/null 2>&1; then
    if [ -n "$(mdfind "kMDItemCFBundleIdentifier == 'com.google.Chrome.canary'" 2>/dev/null | head -n 1)" ]; then
      printf 'canary\n'; return
    fi
  fi

  printf 'stable\n'
}

ensure_node_on_path || true

if ! command -v npx >/dev/null 2>&1; then
  printf '%s\n' \
    "chrome-devtools-mcp-launcher: 'npx' not found on PATH. Node is likely managed by a version manager (fnm/nvm/volta/asdf/mise) whose PATH the Claude Code sandbox does not inherit." \
    "  Fix: symlink node/npm/npx into /usr/local/bin, e.g." \
    "    sudo ln -sf \"\$(command -v node || echo ~/.local/share/fnm/aliases/default/bin/node)\" /usr/local/bin/node" \
    "  or add an env.PATH entry in ~/.claude/settings.json, then restart Claude Code." >&2
fi

channel="$(resolve_channel)"

if [ "$channel" = "canary" ]; then
  exec npx -y chrome-devtools-mcp@latest --channel=canary "$@"
else
  exec npx -y chrome-devtools-mcp@latest "$@"
fi
