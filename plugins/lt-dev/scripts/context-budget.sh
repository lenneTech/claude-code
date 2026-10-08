#!/usr/bin/env bash
# context-budget.sh — runs context-budget.mjs with Node resolved on PATH.
#
# Commands invoke plugin helpers as `bash "${CLAUDE_PLUGIN_ROOT}/scripts/<name>.sh"`, which the
# plugin's existing Bash permission pattern already covers; this wrapper keeps the Node script
# reachable through that pattern and repairs the minimal PATH Claude Code gives subprocesses.
#
# Usage: bash context-budget.sh [plugin-dir] [--check] [--update] [--details] [--json] [--top <n>]
# See context-budget.mjs for what is measured and why.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib/ensure-node-path.sh
. "$SCRIPT_DIR/lib/ensure-node-path.sh"
ensure_node_on_path || true

exec node "$SCRIPT_DIR/context-budget.mjs" "$@"
