#!/usr/bin/env bash
# Generic launcher for npx-based MCP servers in this plugin.
#
# WHY: Claude Code's sandbox (≈ extension 2.1.19x, mid-2026) starts MCP servers
# with a minimal PATH that excludes Homebrew and every Node version-manager bin
# dir. A bare `"command": "npx"` in .mcp.json then fails with "npx: not found"
# for fnm/nvm/volta/asdf/mise users. Routing those servers through this launcher
# repairs the PATH first (best-effort, no-op when npx already resolves), then
# execs npx exactly as before.
#
# Usage in .mcp.json:
#   "command": "${CLAUDE_PLUGIN_ROOT}/scripts/npx-mcp-launcher.sh",
#   "args": ["<package>@latest", "--any", "--server", "--flags"]
# (the launcher prepends `npx -y`).

set -eu

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -r "$SCRIPT_DIR/lib/ensure-node-path.sh" ]; then
  # shellcheck source=lib/ensure-node-path.sh
  . "$SCRIPT_DIR/lib/ensure-node-path.sh"
  ensure_node_on_path || true
fi

if ! command -v npx >/dev/null 2>&1; then
  printf '%s\n' \
    "npx-mcp-launcher: 'npx' not found on PATH. Node is likely managed by a version manager (fnm/nvm/volta/asdf/mise) whose PATH the Claude Code sandbox does not inherit." \
    "  Fix: symlink node/npm/npx into /usr/local/bin, then restart Claude Code." >&2
fi

exec npx -y "$@"
