#!/bin/bash
# Detect security-related prompts regardless of framework
# Suggests general-frontend-security skill for any web project

# Skip if no user prompt
[ -z "$CLAUDE_USER_PROMPT" ] && exit 0

# Check for security keywords in prompt
if echo "$CLAUDE_USER_PROMPT" | grep -iqE '(security.audit|xss|csrf|csp|owasp|vulnerabilit|sicherheit|injection|sanitize|security.review|security.header|cookie.*(secure|httponly|samesite)|content.security.policy)'; then
  # Check if this is a web project (has package.json with any web framework)
  has_web_project=false
  for pkg in "$CLAUDE_PROJECT_DIR/package.json" "$CLAUDE_PROJECT_DIR"/projects/*/package.json "$CLAUDE_PROJECT_DIR"/packages/*/package.json; do
    if [ -f "$pkg" ]; then
      if grep -qE '(react|vue|angular|nuxt|next|svelte|astro|solid|lit|express|koa|fastify|hapi|nest)' "$pkg" 2>/dev/null; then
        has_web_project=true
        break
      fi
    fi
  done

  if [ "$has_web_project" = true ]; then
    echo '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"Security context detected. Use the general-frontend-security skill for OWASP-based security audits, XSS/CSRF prevention, CSP, and secure coding practices."}}'
  fi
fi

exit 0
