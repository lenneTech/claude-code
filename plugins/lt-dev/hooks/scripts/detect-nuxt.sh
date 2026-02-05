#!/bin/bash
# Detect Nuxt 4 frontend projects and suggest developing-lt-frontend skill
# Also detects security-related keywords for general-frontend-security skill

check_nuxt() {
  [ -f "$1/nuxt.config.ts" ] || [ -f "$1/nuxt.config.js" ]
}

check_app_dir() {
  [ -d "$1/app/components" ] || [ -d "$1/app/composables" ] || [ -d "$1/app/pages" ]
}

# Check if user prompt contains security keywords
check_security_keywords() {
  local prompt="$CLAUDE_USER_PROMPT"
  if echo "$prompt" | grep -iqE '(security.audit|xss|csrf|csp|owasp|vulnerability|vulnerabilit|sicherheit|injection|sanitize)'; then
    return 0
  fi
  return 1
}

emit_context() {
  if check_security_keywords; then
    echo '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"Nuxt 4 project detected with security context. Use general-frontend-security skill for OWASP/security audits. Use developing-lt-frontend skill for Nuxt-specific implementation."}}'
  else
    echo '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"Nuxt 4 project detected. Use the developing-lt-frontend skill for frontend tasks (.vue files, components, composables, pages)."}}'
  fi
}

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
