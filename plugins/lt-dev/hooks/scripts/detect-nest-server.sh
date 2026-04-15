#!/bin/bash
# Skip in non-interactive headless mode (claude -p)
. "${0%/*}/_headless-skip.sh"

# Detect @lenne.tech/nest-server and suggest appropriate skill
# Priority: update keywords > TDD keywords > default backend

# Skip slash commands — they have their own skill associations
[[ "$CLAUDE_USER_PROMPT" == /* ]] && exit 0

check_nest_server() {
  [ -f "$1" ] && grep -q '@lenne\.tech/nest-server' "$1" 2>/dev/null
}

# Vendored detection: project has vendored the nest-server core directly into
# its source tree under src/core/ instead of consuming it via npm. Detected
# by the presence of a VENDOR.md file.
check_nest_server_vendored() {
  local project_dir="$1"
  [ -f "$project_dir/src/core/VENDOR.md" ] && \
    grep -q '@lenne.tech/nest-server' "$project_dir/src/core/VENDOR.md" 2>/dev/null
}

find_nest_server_vendor_path() {
  for candidate in \
    "$CLAUDE_PROJECT_DIR/src/core" \
    "$CLAUDE_PROJECT_DIR/projects/api/src/core" \
    "$CLAUDE_PROJECT_DIR/packages/api/src/core" \
    "$CLAUDE_PROJECT_DIR/apps/api/src/core"; do
    if [ -f "$candidate/VENDOR.md" ]; then
      echo "$candidate"
      return 0
    fi
  done
  return 1
}

# Check if user prompt contains update/migration keywords
check_update_keywords() {
  local prompt="$CLAUDE_USER_PROMPT"
  if echo "$prompt" | grep -iqE '(update.*nest.server|upgrade.*nest.server|nest.server.*update|nest.server.*upgrade|nest.server.*migrat|migrat.*nest.server|breaking.changes.*nest|nest.*version)'; then
    return 0
  fi
  return 1
}

# Check if user prompt contains TDD keywords
check_tdd_keywords() {
  local prompt="$CLAUDE_USER_PROMPT"
  if echo "$prompt" | grep -iqE '(tdd|test.driven|test.first|story.test|tests?.*(zuerst|first|before)|schreib.*tests?.*(dann|before))'; then
    return 0
  fi
  return 1
}

find_nest_server_path() {
  for candidate in \
    "$CLAUDE_PROJECT_DIR/node_modules/@lenne.tech/nest-server" \
    "$CLAUDE_PROJECT_DIR/projects/api/node_modules/@lenne.tech/nest-server" \
    "$CLAUDE_PROJECT_DIR/packages/api/node_modules/@lenne.tech/nest-server" \
    "$CLAUDE_PROJECT_DIR/apps/api/node_modules/@lenne.tech/nest-server"; do
    if [ -d "$candidate/src" ]; then
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
    vendor_path=$(find_nest_server_vendor_path)
    if [ -n "$vendor_path" ]; then
      framework_hint=" Framework core is VENDORED at: ${vendor_path}/. This is normal project code (not node_modules), edit directly. Key files: ${vendor_path}/VENDOR.md (baseline version + patch log), ${vendor_path}/index.ts (re-export hub), ${vendor_path}/core.module.ts, ${vendor_path}/common/interfaces/server-options.interface.ts, ${vendor_path}/common/services/crud.service.ts. ALWAYS read the real source here before guessing."
    fi
  else
    local ns_path
    ns_path=$(find_nest_server_path)
    if [ -n "$ns_path" ]; then
      framework_hint=" Framework source: ${ns_path}/. Key files: CLAUDE.md, FRAMEWORK-API.md, src/core.module.ts, src/core/common/interfaces/server-options.interface.ts, src/core/common/services/crud.service.ts. ALWAYS read source before guessing."
    fi
  fi

  local detection_prefix
  if [ "$mode" = "vendored" ]; then
    detection_prefix="@lenne.tech/nest-server (vendored core) detected${location}"
  else
    detection_prefix="@lenne.tech/nest-server detected${location}"
  fi

  local update_skill_hint
  if [ "$mode" = "vendored" ]; then
    update_skill_hint="Use the nest-server-core-vendoring skill for the vendored workflow. Use /lt-dev:backend:update-nest-server-core to sync from upstream."
  else
    update_skill_hint="Use the nest-server-updating skill for version updates, migrations, and breaking changes. Use /lt-dev:backend:update-nest-server for automated execution."
  fi

  if check_update_keywords; then
    echo "{\"hookSpecificOutput\":{\"hookEventName\":\"UserPromptSubmit\",\"additionalContext\":\"${detection_prefix}.${framework_hint} ${update_skill_hint}\"}}"
  elif check_tdd_keywords; then
    echo "{\"hookSpecificOutput\":{\"hookEventName\":\"UserPromptSubmit\",\"additionalContext\":\"${detection_prefix} with TDD intent.${framework_hint} Use the building-stories-with-tdd skill for test-first development. It coordinates with generating-nest-servers for implementation.\"}}"
  else
    # Default: only inject context when prompt contains backend-related terms
    if [ -n "$CLAUDE_USER_PROMPT" ]; then
      echo "$CLAUDE_USER_PROMPT" | grep -iqE '(module|service|controller|resolver|guard|decorator|dto|model|graphql|rest|api|endpoint|migration|database|backend|server|nestjs|nest)' || return 0
    fi
    echo "{\"hookSpecificOutput\":{\"hookEventName\":\"UserPromptSubmit\",\"additionalContext\":\"${detection_prefix}.${framework_hint} Use the generating-nest-servers skill for backend tasks (modules, services, controllers, resolvers). For version updates, use nest-server-updating or nest-server-core-vendoring skill instead.\"}}"
  fi
}

# Check for vendored state FIRST (takes priority over npm-based detection)
# Project root
if check_nest_server_vendored "$CLAUDE_PROJECT_DIR"; then
  emit_context "" "vendored"
  exit 0
fi
# Monorepo subprojects
for subproject in "$CLAUDE_PROJECT_DIR"/projects/* "$CLAUDE_PROJECT_DIR"/packages/* "$CLAUDE_PROJECT_DIR"/apps/*; do
  if check_nest_server_vendored "$subproject"; then
    emit_context " in monorepo" "vendored"
    exit 0
  fi
done

# Fall back to classic npm-based detection
if check_nest_server "$CLAUDE_PROJECT_DIR/package.json"; then
  emit_context "" "npm"
  exit 0
fi

# Check monorepo patterns for npm-based
for pkg in "$CLAUDE_PROJECT_DIR"/projects/*/package.json "$CLAUDE_PROJECT_DIR"/packages/*/package.json "$CLAUDE_PROJECT_DIR"/apps/*/package.json; do
  if check_nest_server "$pkg"; then
    emit_context " in monorepo" "npm"
    exit 0
  fi
done

exit 0
