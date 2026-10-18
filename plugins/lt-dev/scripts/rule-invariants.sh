#!/usr/bin/env bash
# rule-invariants.sh — runs rule-invariants.mjs with Node resolved on PATH.
#
# Commands invoke plugin helpers as `bash "${CLAUDE_PLUGIN_ROOT}/scripts/<name>.sh"`, which the
# plugin's existing Bash permission pattern already covers; this wrapper keeps the Node script
# reachable through that pattern and repairs the minimal PATH Claude Code gives subprocesses.
#
# Usage: bash rule-invariants.sh [plugin-dir] [--json]
# See rule-invariants.mjs for what is checked and why.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib/ensure-node-path.sh
. "$SCRIPT_DIR/lib/ensure-node-path.sh"
ensure_node_on_path || true

exec node "$SCRIPT_DIR/rule-invariants.mjs" "$@"
