#!/usr/bin/env bash
# vs-tab-title.sh
#
# Sets or clears the VStab window-tab title for the current Claude Code
# session, so the VS Code window tab shows the ticket being worked on
# (e.g. "VST: DEV-123 Login-Fix") during /lt-dev:take-ticket / ticket-cycle.
#
# Delegates to the helper installed by the VStab extension. When VStab is not
# installed this is a silent no-op — the ticket workflow must never depend on
# an optional UI extension.
#
# Usage:
#   vs-tab-title.sh "<title>"   set / replace the title
#   vs-tab-title.sh --clear     remove the title
set -euo pipefail

HELPER="${HOME}/Library/Application Support/vs-tab/hooks/set-title.sh"
[ -f "$HELPER" ] || exit 0
exec bash "$HELPER" "$@"
