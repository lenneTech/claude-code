#!/bin/bash
# TaskCompleted hook - validates task deliverables before allowing completion
# Exit 0 = allow completion (default, conservative)
# Exit 2 = reject completion + send feedback
#
# EXPERIMENTAL: Environment variables for task context are not fully documented.
# This script is intentionally conservative - defaults to allowing completion.

# Default: allow completion
exit 0
