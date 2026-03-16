#!/bin/bash
# Detect Nuxt 4 frontend projects and suggest developing-lt-frontend skill

check_nuxt() {
  [ -f "$1/nuxt.config.ts" ] || [ -f "$1/nuxt.config.js" ]
}

check_app_dir() {
  [ -d "$1/app/components" ] || [ -d "$1/app/composables" ] || [ -d "$1/app/pages" ]
}

emit_context() {
  echo '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"Nuxt 4 project detected. Use the developing-lt-frontend skill for frontend tasks (.vue files, components, composables, pages)."}}'
}

# Skip slash commands — they have their own skill associations
[[ "$CLAUDE_USER_PROMPT" == /* ]] && exit 0

# Keyword guard: only inject context when prompt contains frontend-related terms
if [ -n "$CLAUDE_USER_PROMPT" ]; then
  echo "$CLAUDE_USER_PROMPT" | grep -iqE '(vue|component|composable|page|nuxt|frontend|layout|plugin|middleware|css|tailwind|style|template|ui)' || exit 0
fi

# Check project root
if check_nuxt "$CLAUDE_PROJECT_DIR" && check_app_dir "$CLAUDE_PROJECT_DIR"; then
  emit_context
  exit 0
fi

# Check monorepo patterns
for dir in "$CLAUDE_PROJECT_DIR"/projects/app "$CLAUDE_PROJECT_DIR"/packages/app "$CLAUDE_PROJECT_DIR"/apps/app; do
  if [ -d "$dir" ] && check_nuxt "$dir"; then
    emit_context
    exit 0
  fi
done

exit 0
