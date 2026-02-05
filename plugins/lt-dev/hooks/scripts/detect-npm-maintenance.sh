#!/bin/bash
# Detect npm maintenance prompts regardless of framework
# Suggests maintaining-npm-packages skill for any Node.js project

# Skip if no user prompt
[ -z "$CLAUDE_USER_PROMPT" ] && exit 0

# Check for npm maintenance keywords in prompt
if echo "$CLAUDE_USER_PROMPT" | grep -iqE '(npm audit|update.*packages|outdated.*packages|packages.*update|packages.*outdated|dependency.*update|update.*dependenc|security.*fix.*package|vulnerabilit.*package|maintain.*package|package.*maintain|unused.*dependenc|devDependenc|package.json.*(optimiz|aufräum|clean))'; then
  # Check if package.json exists (any Node.js project)
  has_package=false
  for pkg in "$CLAUDE_PROJECT_DIR/package.json" "$CLAUDE_PROJECT_DIR"/projects/*/package.json "$CLAUDE_PROJECT_DIR"/packages/*/package.json; do
    if [ -f "$pkg" ]; then
      has_package=true
      break
    fi
  done

  if [ "$has_package" = true ]; then
    echo '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"npm maintenance context detected. Use the maintaining-npm-packages skill for package updates, audits, and optimization. Run /lt-dev:maintain-check for a dry-run analysis first."}}'
  fi
fi

exit 0
