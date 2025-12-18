#!/bin/bash
# Detect Nuxt 4 frontend projects and suggest developing-lt-frontend skill

check_nuxt() {
  [ -f "$1/nuxt.config.ts" ] || [ -f "$1/nuxt.config.js" ]
}

check_app_dir() {
  [ -d "$1/app/components" ] || [ -d "$1/app/composables" ] || [ -d "$1/app/pages" ]
}

# Check project root
if check_nuxt "$CLAUDE_PROJECT_DIR" && check_app_dir "$CLAUDE_PROJECT_DIR"; then
  echo '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"Nuxt 4 project detected. Use the developing-lt-frontend skill for frontend tasks."}}'
  exit 0
fi

# Check monorepo patterns
for dir in "$CLAUDE_PROJECT_DIR"/projects/app "$CLAUDE_PROJECT_DIR"/packages/app "$CLAUDE_PROJECT_DIR"/apps/app; do
  if [ -d "$dir" ] && check_nuxt "$dir"; then
    echo '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"Nuxt 4 monorepo detected. Use the developing-lt-frontend skill for frontend tasks."}}'
    exit 0
  fi
done

exit 0
