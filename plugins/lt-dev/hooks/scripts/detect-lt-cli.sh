#!/bin/bash
# Detect lenne.tech CLI and suggest using-lt-cli skill

# Only inject context when prompt mentions lt CLI topics
[ -z "$CLAUDE_USER_PROMPT" ] && exit 0

if echo "$CLAUDE_USER_PROMPT" | grep -iqE '(^lt |[^a-z]lt |lt fullstack|lt server|lt git|lenne.?tech.?cli|fullstack init)'; then
  if command -v lt &>/dev/null; then
    echo '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"lenne.tech CLI detected. Use the using-lt-cli skill for lt commands (lt fullstack init, lt git get/reset, lt server create). NOT for NestJS code - use generating-nest-servers skill instead. When running lt commands, prefer explicit parameters (--name, --frontend, --api-mode, --noConfirm) over interactive prompts where possible. See docs/commands.md for all flags."}}'
    exit 0
  fi
fi

exit 0
