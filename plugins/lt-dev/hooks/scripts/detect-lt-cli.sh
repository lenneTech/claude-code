#!/bin/bash
# Detect lenne.tech CLI and suggest using-lt-cli skill

if command -v lt &>/dev/null; then
  echo '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"lenne.tech CLI detected. Use the using-lt-cli skill for lt commands (lt fullstack init, lt git get/reset, lt server create). NOT for NestJS code - use generating-nest-servers skill instead."}}'
  exit 0
fi

exit 0
