#!/bin/bash
# Detect lenne.tech CLI and suggest using-lt-cli skill

if command -v lt &>/dev/null; then
  echo '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"lenne.tech CLI detected. Use the using-lt-cli skill for Git operations (lt git get, lt git reset) and Fullstack initialization (lt fullstack init)."}}'
  exit 0
fi

exit 0
