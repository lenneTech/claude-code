#!/bin/bash
# TeammateIdle hook - validates teammate produced meaningful output before going idle
# Exit 0 = allow idle (default, conservative)
# Exit 2 = send feedback + keep working
#
# EXPERIMENTAL: Environment variables for teammate context are not fully documented.
# This script is intentionally conservative - defaults to allowing idle.
# Adjust heuristics as the Agent Teams API stabilizes.

# Default: allow idle
exit 0
