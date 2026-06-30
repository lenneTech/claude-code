#!/usr/bin/env bash
# ensure-node-path.sh — make Node.js (node/npm/npx) resolvable on PATH.
#
# WHY THIS EXISTS
# ---------------
# Claude Code's recent sandboxing (≈ extension 2.1.19x, mid-2026) runs tool,
# hook and MCP subprocesses with a deliberately MINIMAL PATH
# (`/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/bin`). That PATH does NOT include
# `/opt/homebrew/bin` (normally added via /etc/paths.d) nor any Node version
# manager's bin dir. For developers whose Node is managed by fnm / nvm / volta /
# asdf / mise (the JS-ecosystem majority), `node`/`npm`/`npx` then vanish from the
# subprocess PATH — breaking every npx-based MCP server, the plugin auto-updater,
# husky hooks and the check scripts. This used to work because the pre-sandbox
# Claude Code inherited the login-shell PATH (with the version manager init).
#
# `ensure_node_on_path` is a best-effort, idempotent repair: it is a NO-OP when
# `node`+`npx` already resolve, otherwise it probes the common version-manager
# locations and prepends the first one that actually contains a `node` binary.
# It never hard-fails — callers should run `ensure_node_on_path || true` and let
# the subsequent node/npm/npx call surface the real error if nothing was found.
#
# Sourceable from any lt-dev script:
#   . "$(dirname "$0")/../scripts/lib/ensure-node-path.sh"   # adjust depth
#   ensure_node_on_path || true
#
# NOTE: the chrome-devtools MCP launcher INLINES an identical copy of this
# function instead of sourcing it — Claude plugin isolation forbids sharing files
# across plugins (lt-dev <-> lt-showroom), and the launcher must stay byte-
# identical between the two (see .claude/scripts/sync-chrome-mcp-launcher.sh).
# Keep the inlined copy and this canonical copy in sync.

ensure_node_on_path() {
  # Already good — nothing to do.
  if command -v npx >/dev/null 2>&1 && command -v node >/dev/null 2>&1; then
    return 0
  fi

  # Ordered candidate bin dirs (explicit env overrides first, then defaults).
  _enp_candidates="${VOLTA_HOME:-$HOME/.volta}/bin
${FNM_DIR:-$HOME/.local/share/fnm}/aliases/default/bin
$HOME/.asdf/shims
${MISE_DATA_DIR:-$HOME/.local/share/mise}/shims
/opt/homebrew/bin
/usr/local/bin"

  # nvm: resolve the 'default' alias (value is a version like 20.11.0 or lts/*).
  if [ -f "$HOME/.nvm/alias/default" ]; then
    _enp_nvm_v="$(cat "$HOME/.nvm/alias/default" 2>/dev/null)"
    if [ -n "$_enp_nvm_v" ]; then
      _enp_candidates="$_enp_candidates
$HOME/.nvm/versions/node/$_enp_nvm_v/bin
$HOME/.nvm/versions/node/v$_enp_nvm_v/bin"
    fi
  fi

  # Last resort: the newest installed fnm / nvm version.
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
      # node present but npx not co-located here — keep probing.
    fi
  done
  IFS="$_enp_old_ifs"

  if command -v npx >/dev/null 2>&1; then
    return 0
  fi
  return 1
}
