#!/bin/bash
# Skip in non-interactive headless mode (claude -p)
. "${0%/*}/_headless-skip.sh"

# Detect Nuxt 4 frontend projects and suggest appropriate skill
# Priority: TDD keywords > default frontend

check_nuxt() {
  [ -f "$1/nuxt.config.ts" ] || [ -f "$1/nuxt.config.js" ]
}

check_app_dir() {
  [ -d "$1/app/components" ] || [ -d "$1/app/composables" ] || [ -d "$1/app/pages" ]
}

# Check if user prompt contains TDD keywords
check_tdd_keywords() {
  local prompt="$CLAUDE_USER_PROMPT"
  if echo "$prompt" | grep -iqE '(tdd|test.driven|test.first|story.test|tests?.*(zuerst|first|before)|schreib.*tests?.*(dann|before)|e2e.test|playwright)'; then
    return 0
  fi
  return 1
}

find_nuxt_extensions_path() {
  for candidate in \
    "$CLAUDE_PROJECT_DIR/node_modules/@lenne.tech/nuxt-extensions" \
    "$CLAUDE_PROJECT_DIR/projects/app/node_modules/@lenne.tech/nuxt-extensions" \
    "$CLAUDE_PROJECT_DIR/packages/app/node_modules/@lenne.tech/nuxt-extensions" \
    "$CLAUDE_PROJECT_DIR/apps/app/node_modules/@lenne.tech/nuxt-extensions"; do
    if [ -d "$candidate/dist" ]; then
      echo "$candidate"
      return 0
    fi
  done
  return 1
}

emit_context() {
  local location="$1"  # "" or " in monorepo"

  # Resolve framework source path for concrete hints
  local framework_hint=""
  local ne_path
  ne_path=$(find_nuxt_extensions_path)
  if [ -n "$ne_path" ]; then
    framework_hint=" Framework source: ${ne_path}/. Key file: CLAUDE.md (composables, components, config). ALWAYS read source before guessing."
  fi

  if check_tdd_keywords; then
    echo "{\"hookSpecificOutput\":{\"hookEventName\":\"UserPromptSubmit\",\"additionalContext\":\"Nuxt 4 project detected${location} with TDD intent.${framework_hint} Use the building-stories-with-tdd skill for test-first development. It coordinates with developing-lt-frontend for implementation.\"}}"
  else
    # Default: only inject context when prompt contains frontend-related terms
    if [ -n "$CLAUDE_USER_PROMPT" ]; then
      echo "$CLAUDE_USER_PROMPT" | grep -iqE '(vue|component|composable|page|nuxt|frontend|layout|plugin|middleware|css|tailwind|style|template|ui)' || return 0
    fi
    echo "{\"hookSpecificOutput\":{\"hookEventName\":\"UserPromptSubmit\",\"additionalContext\":\"Nuxt 4 project detected${location}.${framework_hint} Use the developing-lt-frontend skill for frontend tasks (.vue files, components, composables, pages).\"}}"
  fi
}

# Skip slash commands — they have their own skill associations
[[ "$CLAUDE_USER_PROMPT" == /* ]] && exit 0

# Check project root
if check_nuxt "$CLAUDE_PROJECT_DIR" && check_app_dir "$CLAUDE_PROJECT_DIR"; then
  emit_context ""
  exit 0
fi

# Check monorepo patterns
for dir in "$CLAUDE_PROJECT_DIR"/projects/app "$CLAUDE_PROJECT_DIR"/packages/app "$CLAUDE_PROJECT_DIR"/apps/app; do
  if [ -d "$dir" ] && check_nuxt "$dir"; then
    emit_context " in monorepo"
    exit 0
  fi
done

exit 0
