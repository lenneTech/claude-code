#!/bin/bash
# Detect Claude Code plugin development context

# Only inject context when prompt mentions plugin-related topics
[ -z "$CLAUDE_USER_PROMPT" ] && exit 0
# Skip slash commands — they have their own skill associations
[[ "$CLAUDE_USER_PROMPT" == /* ]] && exit 0

if echo "$CLAUDE_USER_PROMPT" | grep -iqE '(plugin|skill|SKILL\.md|command|agent|hook|frontmatter|marketplace|permissions\.json)'; then
  # Check if working in a plugin directory
  if [ -f "$CLAUDE_PROJECT_DIR/.claude-plugin/plugin.json" ] || [ -f "$CLAUDE_PROJECT_DIR/.claude-plugin/marketplace.json" ]; then
    echo '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"Claude Code plugin project detected. Use the developing-claude-plugins skill for plugin development (skills, commands, agents, hooks, plugin.json)."}}'
    exit 0
  fi

  # Check for plugins/ subdirectory with plugin.json
  for manifest in "$CLAUDE_PROJECT_DIR"/plugins/*/.claude-plugin/plugin.json; do
    if [ -f "$manifest" ]; then
      echo '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"Claude Code marketplace project detected. Use the developing-claude-plugins skill for plugin development (skills, commands, agents, hooks, plugin.json)."}}'
      exit 0
    fi
  done
fi

exit 0
