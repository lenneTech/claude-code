#!/bin/bash
# Detect @lenne.tech/nest-server and suggest appropriate skill
# Priority: update keywords > TDD keywords > default backend

# Skip slash commands — they have their own skill associations
[[ "$CLAUDE_USER_PROMPT" == /* ]] && exit 0

check_nest_server() {
  [ -f "$1" ] && grep -q '@lenne\.tech/nest-server' "$1" 2>/dev/null
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

  # Resolve framework source path for concrete hints
  local framework_hint=""
  local ns_path
  ns_path=$(find_nest_server_path)
  if [ -n "$ns_path" ]; then
    framework_hint=" Framework source: ${ns_path}/. Key files: CLAUDE.md, FRAMEWORK-API.md, src/core.module.ts, src/core/common/interfaces/server-options.interface.ts, src/core/common/services/crud.service.ts. ALWAYS read source before guessing."
  fi

  if check_update_keywords; then
    echo "{\"hookSpecificOutput\":{\"hookEventName\":\"UserPromptSubmit\",\"additionalContext\":\"@lenne.tech/nest-server detected${location}.${framework_hint} Use the nest-server-updating skill for version updates, migrations, and breaking changes. Use /lt-dev:backend:update-nest-server for automated execution.\"}}"
  elif check_tdd_keywords; then
    echo "{\"hookSpecificOutput\":{\"hookEventName\":\"UserPromptSubmit\",\"additionalContext\":\"@lenne.tech/nest-server detected${location} with TDD intent.${framework_hint} Use the building-stories-with-tdd skill for test-first development. It coordinates with generating-nest-servers for implementation.\"}}"
  else
    # Default: only inject context when prompt contains backend-related terms
    if [ -n "$CLAUDE_USER_PROMPT" ]; then
      echo "$CLAUDE_USER_PROMPT" | grep -iqE '(module|service|controller|resolver|guard|decorator|dto|model|graphql|rest|api|endpoint|migration|database|backend|server|nestjs|nest)' || return 0
    fi
    echo "{\"hookSpecificOutput\":{\"hookEventName\":\"UserPromptSubmit\",\"additionalContext\":\"@lenne.tech/nest-server detected${location}.${framework_hint} Use the generating-nest-servers skill for backend tasks (modules, services, controllers, resolvers). For version updates, use nest-server-updating skill instead.\"}}"
  fi
}

# Check project root
if check_nest_server "$CLAUDE_PROJECT_DIR/package.json"; then
  emit_context ""
  exit 0
fi

# Check monorepo patterns
for pkg in "$CLAUDE_PROJECT_DIR"/projects/*/package.json "$CLAUDE_PROJECT_DIR"/packages/*/package.json "$CLAUDE_PROJECT_DIR"/apps/*/package.json; do
  if check_nest_server "$pkg"; then
    emit_context " in monorepo"
    exit 0
  fi
done

exit 0
