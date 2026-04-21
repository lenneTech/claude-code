#!/bin/bash
# Shared guard: exit hook early when running in non-interactive headless mode
# or when the user explicitly opts out of plugin hook processing.
#
# Exit triggers:
# - CLAUDE_CODE_ENTRYPOINT=sdk-cli  → Claude Code sets this for `-p`/--print
#                                     (scripted / SDK calls where skill
#                                     auto-detection context is not useful).
# - LT_PLUGIN_HOOKS_SKIP=1          → manual opt-out for fast interactive
#                                     starts (used by the `claudef` shortcut
#                                     in @lenne.tech/cli).

if [ "${CLAUDE_CODE_ENTRYPOINT:-}" = "sdk-cli" ] || [ -n "${LT_PLUGIN_HOOKS_SKIP:-}" ]; then
  exit 0
fi
