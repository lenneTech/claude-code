#!/bin/bash
# Skip in non-interactive headless mode (claude -p)
. "${0%/*}/_headless-skip.sh"
# Sets PROMPT from the hook payload on stdin
. "${0%/*}/_read-prompt.sh"
# Background task / subagent notifications arrive as prompts too: skip them
. "${0%/*}/_skip-task-notification.sh"

# Detect Claude Code plugin development context

# Only inject context when prompt mentions plugin-related topics
[ -z "$PROMPT" ] && exit 0
# Skip slash commands — they have their own skill associations
[[ "$PROMPT" == /* ]] && exit 0

# Resolve the project root once. CLAUDE_PROJECT_DIR is normally set by Claude Code,
# but an unset value would turn every "$PROJECT_DIR/..." check below into an absolute
# path from the filesystem root (e.g. /app/core), so the hook would silently never fire.
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$PWD}"

# One lowercase line, so a verb and its noun on neighbouring lines still match.
PROMPT_LC=$(printf '%s' "$PROMPT" | tr '\n\r\t' '   ' | tr '[:upper:]' '[:lower:]')

# Vocabulary that means plugin development on its own.
STRONG='skill|frontmatter|marketplace|claude-plugin|(plugin|hooks|permissions)\.json|\.mcp\.json|pretooluse|posttooluse|userpromptsubmit|sessionstart|subagentstop|allowed-tools|argument-hint|(skills|commands|agents|hooks)/[^[:space:]]+\.(md|sh|json)'

# plugin / hook / agent / command also turn up in unrelated text: a Vite plugin, a Vue
# composable "hook", a CI agent, a shell command, a subagent's report. On their own
# they fired this hook on nearly every prompt in a plugin repo, so they count only in
# a plugin-dev phrase: after an editing verb ("fix the hook", "create a command",
# "passe den Agent an"), before a German infinitive or a fault word ("den Hook
# anpassen", "the hook doesn't fire"), after "new" ("einen neuen Hook"), with an
# element noun ("agent definition", "hook script"), or after "lt-dev"/"Claude Code".
NOUN='(plugin|hook|agent|sub-?agent|command)s?'
GAP='([[:space:]]+[^[:space:]]+)'
# Sentence-initial German verbs keep their capital umlaut where tr lowercases only
# ASCII (C locale), hence Änder/Füg/Lösch/Überarbeit. "add" is matched as a whole
# word below (add|adds|added|adding) so "address" stays out.
VERB_STEMS='creat|writ|rewrit|fix|updat|edit|chang|renam|remov|delet|refactor|optimi[sz]|improv|review|debug|validat|regist|implement|build|extend|adjust|tweak|erstell|anleg|änder|aender|anpass|füg|fueg|hinzuf|schreib|umschreib|lösch|loesch|entfern|korrigier|reparier|verbesser|optimier|überarbeit|ueberarbeit|implementier|erweiter|umbenenn|registrier|bau|Änder|Füg|Lösch|Überarbeit'
# Infinitive stems for the German verb-final order; conjugated forms ("der Agent
# schreibt Tests") describe what something did and stay out.
INFINITIVE_STEMS='anpass|erstell|änder|aender|schreib|umschreib|lösch|loesch|entfern|korrigier|reparier|verbesser|optimier|überarbeit|ueberarbeit|implementier|erweiter|umbenenn|registrier|anleg|hinzufüg|hinzufueg|bau|fix'
VERB_THEN_NOUN="(^|[^a-z])((${VERB_STEMS})[^[:space:]]*|add|adds|added|adding|passe|lege)${GAP}{0,3}[[:space:]]+[^a-z[:space:]]?${NOUN}([^a-z]|\$)"
NOUN_THEN_VERB="(^|[^a-z])${NOUN}${GAP}{0,4}[[:space:]]+((${INFINITIVE_STEMS})(en|n)|fire[sd]?|firing|feuert|broken|kaputt)([^a-z]|\$)"
NEW_NOUN="(^|[^a-z])(new|neue[nmrs]?)${GAP}{0,2}[[:space:]]+[^a-z[:space:]]?${NOUN}([^a-z]|\$)"
ELEMENT_NOUN="(^|[^a-z])${NOUN}[- ]?(file|script|definition|description|matcher|manifest|event)|(lt-dev|claude[- ]?code)[- ]?${NOUN}([^a-z]|\$)"

is_plugin_dev_prompt() {
  local re
  for re in "$STRONG" "$VERB_THEN_NOUN" "$NOUN_THEN_VERB" "$NEW_NOUN" "$ELEMENT_NOUN"; do
    printf '%s\n' "$PROMPT_LC" | grep -iqE -- "$re" && return 0
  done
  return 1
}

if is_plugin_dev_prompt; then
  # Check if working in a plugin directory
  if [ -f "$PROJECT_DIR/.claude-plugin/plugin.json" ] || [ -f "$PROJECT_DIR/.claude-plugin/marketplace.json" ]; then
    echo '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"Claude Code plugin project detected. Use the developing-claude-plugins skill for plugin development (skills, commands, agents, hooks, plugin.json)."}}'
    exit 0
  fi

  # Check for plugins/ subdirectory with plugin.json
  for manifest in "$PROJECT_DIR"/plugins/*/.claude-plugin/plugin.json; do
    if [ -f "$manifest" ]; then
      echo '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"Claude Code marketplace project detected. Use the developing-claude-plugins skill for plugin development (skills, commands, agents, hooks, plugin.json)."}}'
      exit 0
    fi
  done
fi

exit 0
