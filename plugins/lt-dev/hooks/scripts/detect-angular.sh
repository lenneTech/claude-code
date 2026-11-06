#!/bin/bash
# Skip in non-interactive headless mode (claude -p)
. "${0%/*}/_headless-skip.sh"
# Sets PROMPT from the hook payload on stdin
. "${0%/*}/_read-prompt.sh"
# Background task / subagent notifications arrive as prompts too: skip them
. "${0%/*}/_skip-task-notification.sh"

# Detect Angular frontend projects on @lenne.tech/ng-base and suggest the matching skill.
# Priority: vendored core update keywords > TDD keywords > default frontend
#
# The Angular counterpart of detect-nuxt.sh. A project consumes @lenne.tech/ng-base either as
# an npm dependency (node_modules) or vendored into the app's src/core/. The vendored state is
# detected by a src/core/VENDOR.md that names @lenne.tech/ng-base, which takes priority because
# the update and contribute workflow differs (core sync instead of a plain pnpm update).
#
# An Angular app is recognised by angular.json. A Nuxt project has none, so this hook stays
# silent there and detect-nuxt.sh keeps the Nuxt path to itself.

# Skip slash commands — they have their own skill associations
[[ "$PROMPT" == /* ]] && exit 0

# Resolve the project root once (see detect-nuxt.sh for why an unset value must not reach the checks).
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$PWD}"

check_angular() {
  [ -f "$1/angular.json" ]
}

# Vendored detection: the app carries the ng-base library source under src/core/ instead of
# consuming it via npm, with a VENDOR.md naming the package it mirrors.
check_ng_base_vendored() {
  [ -f "$1/src/core/VENDOR.md" ] && grep -q '@lenne.tech/ng-base' "$1/src/core/VENDOR.md" 2>/dev/null
}

check_update_keywords() {
  echo "$PROMPT" | grep -iqE '(update.*ng.base|upgrade.*ng.base|ng.base.*(update|upgrade|migrat)|migrat.*ng.base|sync.*(frontend|angular).*core|update.*(frontend|angular).*core|(frontend|angular).*core.*(update|sync|upgrade))'
}

check_tdd_keywords() {
  echo "$PROMPT" | grep -iqE '(tdd|test.driven|test.first|story.test|tests?.*(zuerst|first|before)|schreib.*tests?.*(dann|before)|e2e.test|playwright)'
}

find_ng_base_path() {
  local dir="$1"
  for candidate in "$dir/node_modules/@lenne.tech/ng-base" "$PROJECT_DIR/node_modules/@lenne.tech/ng-base"; do
    if [ -f "$candidate/package.json" ]; then
      echo "$candidate"
      return 0
    fi
  done
  return 1
}

# Paths go into a hand-built JSON string: strip control characters, escape backslashes and quotes
# (a Windows path such as C:\Users\… would otherwise put an invalid `\U` escape into it).
json_escape() {
  printf '%s' "$1" | tr -d '\000-\037' | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

emit_context() {
  local app_dir="$1"     # the Angular app's directory
  local location="$2"    # "" or " in monorepo"
  local mode="$3"        # "npm" or "vendored"

  local framework_hint=""
  if [ "$mode" = "vendored" ]; then
    local vendor_path
    vendor_path=$(json_escape "$app_dir/src/core")
    framework_hint=" Framework library is VENDORED at: ${vendor_path}/. This is normal project code (not node_modules), edit it only under the vendor policy. Key file: ${vendor_path}/VENDOR.md (baseline version + patch log). Imports stay on the package specifiers (@lenne.tech/ng-base, @lenne.tech/ng-base/<entry>), mapped to this folder by tsconfig paths. ALWAYS read the real source here before guessing."
  else
    local ng_path
    ng_path=$(json_escape "$(find_ng_base_path "$app_dir")")
    if [ -n "$ng_path" ]; then
      framework_hint=" Framework source: ${ng_path}/ (README.md lists the entry points). ALWAYS read source before guessing."
    fi
  fi

  local detection_prefix
  if [ "$mode" = "vendored" ]; then
    detection_prefix="Angular project with @lenne.tech/ng-base (vendored core) detected${location}"
  else
    detection_prefix="Angular project detected${location}"
  fi

  local vendor_workflow_hint=""
  if [ "$mode" = "vendored" ]; then
    vendor_workflow_hint=" For framework core updates use the ng-base-core-vendoring skill and run /lt-dev:frontend:update-ng-base-core to sync from upstream. To send local core fixes back upstream use /lt-dev:frontend:contribute-ng-base-core."
  fi

  if [ "$mode" = "vendored" ] && check_update_keywords; then
    echo "{\"hookSpecificOutput\":{\"hookEventName\":\"UserPromptSubmit\",\"additionalContext\":\"${detection_prefix}.${framework_hint}${vendor_workflow_hint}\"}}"
  elif check_tdd_keywords; then
    echo "{\"hookSpecificOutput\":{\"hookEventName\":\"UserPromptSubmit\",\"additionalContext\":\"${detection_prefix} with TDD intent.${framework_hint} Use the building-stories-with-tdd skill for test-first development. It coordinates with developing-lt-angular-frontend for implementation.\"}}"
  else
    # Default: only inject context when the prompt contains frontend-related terms
    if [ -n "$PROMPT" ]; then
      echo "$PROMPT" | grep -iqE '(angular|component|signal|service|page|route|routing|frontend|layout|form|directive|pipe|css|tailwind|style|template|ui|spartan|ssr)' || return 0
    fi
    echo "{\"hookSpecificOutput\":{\"hookEventName\":\"UserPromptSubmit\",\"additionalContext\":\"${detection_prefix}.${framework_hint} Use the developing-lt-angular-frontend skill for frontend tasks (components, services, routes, forms).${vendor_workflow_hint}\"}}"
  fi
}

# Standalone Angular app at the project root
if check_angular "$PROJECT_DIR"; then
  if check_ng_base_vendored "$PROJECT_DIR"; then
    emit_context "$PROJECT_DIR" "" "vendored"
  else
    emit_context "$PROJECT_DIR" "" "npm"
  fi
  exit 0
fi

# Monorepo patterns
for dir in "$PROJECT_DIR"/projects/app "$PROJECT_DIR"/packages/app "$PROJECT_DIR"/apps/app; do
  if [ -d "$dir" ] && check_angular "$dir"; then
    if check_ng_base_vendored "$dir"; then
      emit_context "$dir" " in monorepo" "vendored"
    else
      emit_context "$dir" " in monorepo" "npm"
    fi
    exit 0
  fi
done

exit 0
