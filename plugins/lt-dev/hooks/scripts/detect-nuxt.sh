#!/bin/bash
# Skip in non-interactive headless mode (claude -p)
. "${0%/*}/_headless-skip.sh"

# Detect Nuxt 4 frontend projects and suggest appropriate skill.
# Priority: vendored core update keywords > TDD keywords > default frontend
#
# Mirrors detect-nest-server.sh: a project can consume @lenne.tech/nuxt-extensions
# either as an npm dependency (node_modules) or vendored directly into app/core/.
# The vendored state is detected by an app/core/VENDOR.md file and takes
# priority because the update/contribute workflow differs (core sync instead of
# a plain pnpm update).

# Skip slash commands — they have their own skill associations
[[ "$CLAUDE_USER_PROMPT" == /* ]] && exit 0

check_nuxt() {
  [ -f "$1/nuxt.config.ts" ] || [ -f "$1/nuxt.config.js" ]
}

check_app_dir() {
  [ -d "$1/app/components" ] || [ -d "$1/app/composables" ] || [ -d "$1/app/pages" ]
}

# Vendored detection: project has vendored the nuxt-extensions module directly
# into its source tree under app/core/ instead of consuming it via npm. Detected
# by the presence of a VENDOR.md file.
check_nuxt_extensions_vendored() {
  local project_dir="$1"
  [ -f "$project_dir/app/core/VENDOR.md" ] && \
    grep -q '@lenne.tech/nuxt-extensions' "$project_dir/app/core/VENDOR.md" 2>/dev/null
}

find_nuxt_extensions_vendor_path() {
  for candidate in \
    "$CLAUDE_PROJECT_DIR/app/core" \
    "$CLAUDE_PROJECT_DIR/projects/app/app/core" \
    "$CLAUDE_PROJECT_DIR/packages/app/app/core" \
    "$CLAUDE_PROJECT_DIR/apps/app/app/core"; do
    if [ -f "$candidate/VENDOR.md" ]; then
      echo "$candidate"
      return 0
    fi
  done
  return 1
}

# Check if user prompt contains update/sync keywords for the vendored core
check_update_keywords() {
  local prompt="$CLAUDE_USER_PROMPT"
  if echo "$prompt" | grep -iqE '(update.*nuxt.extensions|upgrade.*nuxt.extensions|nuxt.extensions.*(update|upgrade|migrat)|migrat.*nuxt.extensions|sync.*(frontend|nuxt).*core|update.*(frontend|nuxt).*core|(frontend|nuxt).*core.*(update|sync|upgrade))'; then
    return 0
  fi
  return 1
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
  local mode="${2:-npm}" # "npm" or "vendored"

  # Resolve framework source path for concrete hints
  local framework_hint=""
  if [ "$mode" = "vendored" ]; then
    local vendor_path
    vendor_path=$(find_nuxt_extensions_vendor_path)
    if [ -n "$vendor_path" ]; then
      framework_hint=" Framework module is VENDORED at: ${vendor_path}/. This is normal project code (not node_modules), edit directly. Key files: ${vendor_path}/VENDOR.md (baseline version + patch log), ${vendor_path}/module.ts, ${vendor_path}/runtime/. ALWAYS read the real source here before guessing."
    fi
  else
    local ne_path
    ne_path=$(find_nuxt_extensions_path)
    if [ -n "$ne_path" ]; then
      framework_hint=" Framework source: ${ne_path}/. Key file: CLAUDE.md (composables, components, config). ALWAYS read source before guessing."
    fi
  fi

  local detection_prefix
  if [ "$mode" = "vendored" ]; then
    detection_prefix="Nuxt 4 project with @lenne.tech/nuxt-extensions (vendored core) detected${location}"
  else
    detection_prefix="Nuxt 4 project detected${location}"
  fi

  # Vendored projects always get the core update/contribute routing appended.
  local vendor_workflow_hint=""
  if [ "$mode" = "vendored" ]; then
    vendor_workflow_hint=" For framework core updates use the nuxt-extensions-core-vendoring skill and run /lt-dev:frontend:update-nuxt-extensions-core to sync from upstream (this also raises npm packages to at least the upstream baseline, e.g. via /lt-dev:maintenance:maintain). To send local core fixes back upstream use /lt-dev:frontend:contribute-nuxt-extensions-core."
  fi

  if [ "$mode" = "vendored" ] && check_update_keywords; then
    echo "{\"hookSpecificOutput\":{\"hookEventName\":\"UserPromptSubmit\",\"additionalContext\":\"${detection_prefix}.${framework_hint}${vendor_workflow_hint}\"}}"
  elif check_tdd_keywords; then
    echo "{\"hookSpecificOutput\":{\"hookEventName\":\"UserPromptSubmit\",\"additionalContext\":\"${detection_prefix} with TDD intent.${framework_hint} Use the building-stories-with-tdd skill for test-first development. It coordinates with developing-lt-frontend for implementation.\"}}"
  else
    # Default: only inject context when prompt contains frontend-related terms
    if [ -n "$CLAUDE_USER_PROMPT" ]; then
      echo "$CLAUDE_USER_PROMPT" | grep -iqE '(vue|component|composable|page|nuxt|frontend|layout|plugin|middleware|css|tailwind|style|template|ui)' || return 0
    fi
    echo "{\"hookSpecificOutput\":{\"hookEventName\":\"UserPromptSubmit\",\"additionalContext\":\"${detection_prefix}.${framework_hint} Use the developing-lt-frontend skill for frontend tasks (.vue files, components, composables, pages).${vendor_workflow_hint}\"}}"
  fi
}

# Check for vendored state FIRST (takes priority over npm-based detection)
# Project root
if check_nuxt "$CLAUDE_PROJECT_DIR" && check_app_dir "$CLAUDE_PROJECT_DIR"; then
  if check_nuxt_extensions_vendored "$CLAUDE_PROJECT_DIR"; then
    emit_context "" "vendored"
  else
    emit_context "" "npm"
  fi
  exit 0
fi

# Check monorepo patterns
for dir in "$CLAUDE_PROJECT_DIR"/projects/app "$CLAUDE_PROJECT_DIR"/packages/app "$CLAUDE_PROJECT_DIR"/apps/app; do
  if [ -d "$dir" ] && check_nuxt "$dir"; then
    if check_nuxt_extensions_vendored "$dir"; then
      emit_context " in monorepo" "vendored"
    else
      emit_context " in monorepo" "npm"
    fi
    exit 0
  fi
done

exit 0
