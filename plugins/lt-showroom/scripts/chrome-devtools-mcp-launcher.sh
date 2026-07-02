#!/usr/bin/env bash
# Launches chrome-devtools-mcp. On macOS machines that have Google Chrome Canary
# installed, automatically appends --channel=canary so the automated browser is
# distinguishable from the developer's daily-driver Chrome (yellow icon in the
# window switcher).
#
# Startup strategy (fastest first) — keeps connect time far below Claude Code's
# 30s MCP startup timeout (npx with @latest was measured at 3-22s because every
# start does an npm-registry roundtrip to resolve "latest"):
#   1. Globally installed binary (`npm i -g chrome-devtools-mcp`) — <1s, no
#      npm/npx wrapper chain, so signals reach the server process directly.
#   2. `npx` with an EXACT pinned version — served from the local npx cache
#      without a registry roundtrip. Bump CHROME_MCP_PINNED_VERSION when a new
#      release should roll out to machines without a global install.
#
# Crash resilience: Claude Code never auto-reconnects stdio MCP servers
# (github.com/anthropics/claude-code issue #43177) — a dead server means manual
# /mcp reconnecting. This launcher therefore SUPERVISES the server process:
# if it exits abnormally, it is respawned while the stdio pipe to Claude Code
# stays open, so the session never notices the crash (chrome-devtools-mcp
# answers tool calls without requiring a fresh initialize handshake; verified
# against v1.4.0). A clean exit (EOF on stdin = session closed) ends the
# launcher, and rapid crash loops abort after 5 attempts.
#
# Overrides:
#   CHROME_MCP_CHANNEL=stable|canary   force browser channel
#   CHROME_MCP_VERSION=<exact version> override the pinned npx fallback version
#   CHROME_MCP_SUPERVISE=0             disable the respawn supervisor (debug)
#
# KEEP IN SYNC with the twin under the other plugin's scripts/ directory
# (lt-dev <-> lt-showroom). Plugin isolation forbids sharing files between
# plugins. The canonical copy lives in lt-dev; mirror via:
#   .claude/scripts/sync-chrome-mcp-launcher.sh
# CI check:
#   .claude/scripts/sync-chrome-mcp-launcher.sh --check

set -eu

CHROME_MCP_PINNED_VERSION="${CHROME_MCP_VERSION:-1.4.0}"

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

# run_supervised — respawn the server on abnormal exit so Claude Code's stdio
# pipe survives crashes. The child inherits our stdin explicitly (0<&0): POSIX
# gives backgrounded commands /dev/null as stdin, which would sever the MCP
# channel. Signals from Claude Code (session end, /mcp reconnect) are forwarded
# to the child so no orphaned server/Chrome instances pile up.
run_supervised() {
  _sup_child=""
  _sup_forward() {
    if [ -n "$_sup_child" ]; then
      kill "$_sup_child" 2>/dev/null || true
      wait "$_sup_child" 2>/dev/null || true
    fi
    exit 143
  }
  trap _sup_forward TERM INT HUP

  _sup_rapid=0
  while :; do
    _sup_started=$SECONDS
    "$@" 0<&0 &
    _sup_child=$!
    set +e
    wait "$_sup_child"
    _sup_status=$?
    set -e
    _sup_child=""

    # Clean exit = EOF on stdin (Claude Code closed the session). Done.
    if [ "$_sup_status" -eq 0 ]; then
      exit 0
    fi

    # Rapid-crash guard: >=5 consecutive exits within 3s each means something
    # is fundamentally broken — surface the failure instead of looping.
    if [ $(( SECONDS - _sup_started )) -lt 3 ]; then
      _sup_rapid=$(( _sup_rapid + 1 ))
      if [ "$_sup_rapid" -ge 5 ]; then
        printf 'chrome-devtools-mcp-launcher: server keeps crashing on startup (last exit %s), giving up.\n' \
          "$_sup_status" >&2
        exit "$_sup_status"
      fi
    else
      _sup_rapid=0
    fi

    printf 'chrome-devtools-mcp-launcher: server exited with status %s, respawning...\n' \
      "$_sup_status" >&2
    sleep 1
  done
}

ensure_node_on_path || true

channel="$(resolve_channel)"
if [ "$channel" = "canary" ]; then
  set -- --channel=canary "$@"
fi

# Fast path: globally installed binary (no npm/npx wrapper chain).
if command -v chrome-devtools-mcp >/dev/null 2>&1; then
  if [ "${CHROME_MCP_SUPERVISE:-1}" = "0" ]; then
    exec chrome-devtools-mcp "$@"
  fi
  run_supervised chrome-devtools-mcp "$@"
fi

if ! command -v npx >/dev/null 2>&1; then
  printf '%s\n' \
    "chrome-devtools-mcp-launcher: 'npx' not found on PATH. Node is likely managed by a version manager (fnm/nvm/volta/asdf/mise) whose PATH the Claude Code sandbox does not inherit." \
    "  Fix: symlink node/npm/npx into /usr/local/bin, e.g." \
    "    sudo ln -sf \"\$(command -v node || echo ~/.local/share/fnm/aliases/default/bin/node)\" /usr/local/bin/node" \
    "  or add an env.PATH entry in ~/.claude/settings.json, then restart Claude Code." >&2
fi

# Fallback: exact pinned version resolves from the local npx cache without a
# registry roundtrip (unlike @latest). First-ever run still downloads once.
# Not supervised: killing the npx wrapper chain reliably is messy; the global
# install above is the recommended, resilient path (npm i -g chrome-devtools-mcp).
exec npx -y "chrome-devtools-mcp@${CHROME_MCP_PINNED_VERSION}" "$@"
