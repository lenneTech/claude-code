#!/bin/bash
# Shared guard for UserPromptSubmit hooks: exit early on system-generated turns.
# Source it after PROMPT is set (e.g. by _read-prompt.sh).
#
# Claude Code delivers background task and subagent completion notifications as
# UserPromptSubmit turns whose prompt carries a <task-notification> block
# (<task-id>, <status>, <result> ...). The hook payload has no field that tells such
# a turn apart from a human prompt, so the block itself is the marker.
#
# Observed live in the claude-code marketplace repo (2026-09-24): notification turns
# whose result text mentioned "plugins/lt-offers" and "plugins/lt-showroom" fired
# both plugins' keyword detectors, and one that contained "demo" switched lt-offers
# to its demo-stage instruction although no user had asked for the demo stage.
#
# Identical copies live in each lt-* plugin (lt-dev, lt-offers, lt-showroom):
# plugins run in isolation and cannot source each other's helpers.

case "${PROMPT:-}" in
  *"<task-notification>"*) exit 0 ;;
esac
