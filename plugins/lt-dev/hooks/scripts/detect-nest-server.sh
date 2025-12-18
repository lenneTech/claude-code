#!/bin/bash
# Detect @lenne.tech/nest-server and suggest generating-nest-servers skill

check_nest_server() {
  [ -f "$1" ] && grep -q '@lenne\.tech/nest-server' "$1" 2>/dev/null
}

# Check project root
if check_nest_server "$CLAUDE_PROJECT_DIR/package.json"; then
  echo '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"@lenne.tech/nest-server detected. Use the generating-nest-servers skill for backend tasks."}}'
  exit 0
fi

# Check monorepo patterns
for pkg in "$CLAUDE_PROJECT_DIR"/projects/*/package.json "$CLAUDE_PROJECT_DIR"/packages/*/package.json "$CLAUDE_PROJECT_DIR"/apps/*/package.json; do
  if check_nest_server "$pkg"; then
    echo '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"@lenne.tech/nest-server detected in monorepo. Use the generating-nest-servers skill for backend tasks."}}'
    exit 0
  fi
done

exit 0
