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
# Messages from other Claude sessions on this machine arrive the same way, wrapped in a
# <cross-session-message from="..."> block. Observed 2026-10-18: two peer reports about
# the lt CLI and nest-server fired the lt-cli, plugin-dev, offers ("use offers-api,
# production") and showroom detectors on words in the report, although the user had
# asked for none of it.
#
# Identical copies live in each lt-* plugin (lt-dev, lt-offers, lt-showroom):
# plugins run in isolation and cannot source each other's helpers.

case "${PROMPT:-}" in
  *"<task-notification>"*) exit 0 ;;
  *"<cross-session-message"*) exit 0 ;;
esac
