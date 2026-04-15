#!/bin/bash
# Skip in non-interactive headless mode (claude -p)
. "${0%/*}/_headless-skip.sh"

# Detects if the current directory contains an analyzable software project and the user prompt
# mentions showroom-related keywords, injecting skill context accordingly.

INPUT=$(cat)

PROMPT=$(echo "$INPUT" | jq -r '.user_prompt // empty' 2>/dev/null || echo "")
CWD=$(echo "$INPUT" | jq -r '.cwd // empty' 2>/dev/null || echo "$PWD")

CONTEXT=""

# Check for showroom-related keywords in the prompt
PROMPT_LOWER=$(echo "$PROMPT" | tr '[:upper:]' '[:lower:]')
if echo "$PROMPT_LOWER" | grep -qE '(showroom|showcase|portfolio|analys|screenshot|demo|präsentation|presentation|feature.?overview|tech.?stack|project.?page)'; then

  # Check if the current directory is a recognizable software project
  IS_PROJECT=0
  [ -f "$CWD/package.json" ] && IS_PROJECT=1
  [ -f "$CWD/Cargo.toml" ] && IS_PROJECT=1
  [ -f "$CWD/requirements.txt" ] && IS_PROJECT=1
  [ -f "$CWD/pyproject.toml" ] && IS_PROJECT=1
  [ -f "$CWD/go.mod" ] && IS_PROJECT=1
  [ -f "$CWD/pom.xml" ] && IS_PROJECT=1
  [ -f "$CWD/build.gradle" ] && IS_PROJECT=1
  [ -f "$CWD/Gemfile" ] && IS_PROJECT=1
  [ -f "$CWD/composer.json" ] && IS_PROJECT=1
  [ -f "$CWD/pubspec.yaml" ] && IS_PROJECT=1

  # Also check common monorepo patterns
  [ -f "$CWD/lerna.json" ] && IS_PROJECT=1
  [ -f "$CWD/nx.json" ] && IS_PROJECT=1
  [ -f "$CWD/pnpm-workspace.yaml" ] && IS_PROJECT=1

  if [ "$IS_PROJECT" -eq 1 ]; then
    CONTEXT="Software project detected with showroom-related intent. Use the analyzing-projects skill to analyze the codebase. Use the creating-showcases skill to create or update a showcase on showroom.lenne.tech."
  fi
fi

if [ -n "$CONTEXT" ]; then
  jq -n --arg ctx "$CONTEXT" '{
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: $ctx
    }
  }'
fi

exit 0
