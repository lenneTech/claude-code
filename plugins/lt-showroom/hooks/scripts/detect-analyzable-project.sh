#!/bin/bash
# Skip in non-interactive headless mode (claude -p)
. "${0%/*}/_headless-skip.sh"

# Injects analyzing-projects / creating-showcases context when the user asks for a
# showroom entry or a showcase of the current software project.
#
# Showroom or showcase intent is required: the prompt names the showroom or a showcase
# (or SHOWCASE.md, a portfolio entry, showroom.lenne.tech), or starts with a
# /lt-showroom: command. Words such as "demo", "screenshot", "analysis", "presentation"
# or "tech stack" alone are ordinary dev vocabulary ("take a screenshot of the failing
# page", "demo data for the test") and fired this hook in every project with a
# package.json, so they no longer count on their own.

# Sets PROMPT from the stdin payload (jq, or an escape-aware fallback without it)
. "${0%/*}/_read-prompt.sh"
# Background task / subagent notifications arrive as prompts too: skip them
. "${0%/*}/_skip-task-notification.sh"
# Defines strip_self_refs (removes lt-offers / lt-showroom / plugins/lt-* mentions)
. "${0%/*}/_strip-self-refs.sh"

# The stable project root: the agent's working directory changes mid-session (see the
# CwdChanged event), so after a `cd projects/api` the manifest checks below would run
# in a subfolder. CLAUDE_PROJECT_DIR stays put; the handler's own working directory
# (the payload's cwd) is the fallback.
CWD="${CLAUDE_PROJECT_DIR:-$PWD}"

CONTEXT=""

RAW_LOWER=$(printf '%s' "$PROMPT" | tr '[:upper:]' '[:lower:]')
# Match on the prompt with the marketplace's own plugin names removed ("lt-showroom"
# contains "showroom"), so only what the user actually wrote counts.
PROMPT_LOWER=$(strip_self_refs "$RAW_LOWER")

INTENT=0
# The plugin's own slash commands. Checked on the raw prompt because strip_self_refs
# removes "lt-showroom"; only an invocation at the start counts, not a mention.
case "${RAW_LOWER#"${RAW_LOWER%%[![:space:]]*}"}" in
  /lt-showroom:*) INTENT=1 ;;
esac
if [ "$INTENT" -eq 0 ] && printf '%s\n' "$PROMPT_LOWER" | grep -qE 'showroom|showcase|portfolio[- ]?(entry|eintrag|page|seite)'; then
  INTENT=1
fi

if [ "$INTENT" -eq 1 ]; then

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
  if command -v jq >/dev/null 2>&1; then
    jq -n --arg ctx "$CONTEXT" '{hookSpecificOutput: {hookEventName: "UserPromptSubmit", additionalContext: $ctx}}'
  else
    escaped=$(printf '%s' "$CONTEXT" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')
    printf '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"%s"}}\n' "$escaped"
  fi
fi

exit 0
