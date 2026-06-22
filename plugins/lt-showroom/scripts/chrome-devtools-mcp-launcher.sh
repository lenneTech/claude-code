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

channel="$(resolve_channel)"

if [ "$channel" = "canary" ]; then
  exec npx -y chrome-devtools-mcp@latest --channel=canary "$@"
else
  exec npx -y chrome-devtools-mcp@latest "$@"
fi
