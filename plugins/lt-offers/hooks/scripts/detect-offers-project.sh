#!/bin/bash
# Skip in non-interactive headless mode (claude -p)
. "${0%/*}/_headless-skip.sh"

# Injects creating-offers context when the user's prompt shows real offers intent: it
# names the offers domain ("Angebot"/"Angebote", "offer" used as a noun about a
# business offer, a distinctive content block type, the offers-api MCP server,
# angebote.lenne.tech) or starts with a /lt-offers: command.
# Generic analytics or UI words (views, downloads, scroll, sources, analytics ...)
# never fire: they occur in every web project, and firing on them put offers context
# and a stage instruction into unrelated sessions.

# Sets PROMPT from the stdin payload (jq, or an escape-aware fallback without it)
. "${0%/*}/_read-prompt.sh"
# Background task / subagent notifications arrive as prompts too: skip them
. "${0%/*}/_skip-task-notification.sh"
# Defines strip_self_refs (removes lt-offers / lt-showroom / plugins/lt-* mentions)
. "${0%/*}/_strip-self-refs.sh"

CONTEXT=""
RAW_LOWER=$(printf '%s' "$PROMPT" | tr '[:upper:]' '[:lower:]')
# Every keyword check below and the demo-stage check run on the prompt with the
# marketplace's own plugin names removed, so only what the user actually wrote counts.
PROMPT_LOWER=$(strip_self_refs "$RAW_LOWER")

# ── Offers-domain intent ──
# "offer" alone is also an English verb ("the API offers pagination"), so it counts only
# as a noun: after an article, possessive or business qualifier, after a verb that
# creates or edits one, or as the head of an offer-specific compound.
DOMAIN_RE='angebot'
DOMAIN_RE="$DOMAIN_RE|(^|[^a-z])(an?|the|new|our|my|your|client|customer|sales|commercial|business|draft|existing|published)[[:space:]]+offers?([^a-z]|$)"
DOMAIN_RE="$DOMAIN_RE|(^|[^a-z])(this|that|each|every|which)[[:space:]]+offer([^a-z]|$)"
DOMAIN_RE="$DOMAIN_RE|(^|[^a-z])(create|draft|write|send|prepare|update|edit|publish|duplicate|generate)[[:space:]]+offers?([^a-z]|$)"
DOMAIN_RE="$DOMAIN_RE|(^|[^a-z])offers?[- ](page|link|pdf|template|document|platform|analytics|statistics|stats)"
DOMAIN_RE="$DOMAIN_RE|offers-api|angebote\\.lenne|(^|[^a-z-])(pricing-table|global-ref|rich-component|html-embed)([^a-z-]|$)"

INTENT=0
# The plugin's own slash commands. Checked on the raw prompt because strip_self_refs
# removes "lt-offers"; only an invocation at the start counts, not a mention.
case "${RAW_LOWER#"${RAW_LOWER%%[![:space:]]*}"}" in
  /lt-offers:*) INTENT=1 ;;
esac
if [ "$INTENT" -eq 0 ] && printf '%s\n' "$PROMPT_LOWER" | grep -qE "$DOMAIN_RE"; then
  INTENT=1
fi

if [ "$INTENT" -eq 1 ]; then

  # Stage routing — `offers-api` (prod, default) vs `offers-api-demo` (demo).
  # Trigger: any explicit mention of "demo" inside an offers-related prompt the user
  # wrote. Notification turns exited above and plugin names / plugin paths were
  # stripped, so a "demo" in a subagent result or in a path such as
  # plugins/lt-offers/.../demo-notes.md cannot reach this check.
  # The whole-word match avoids false positives like "Demonstrations-Angebot"
  # being routed to the demo stage when the author meant production.
  if printf '%s\n' "$PROMPT_LOWER" | grep -qE '(^|[^a-z0-9])demo([^a-z0-9]|$)|demo-angebote\.lenne|demo[- ]?(stage|umgebung|instanz|server|deployment)'; then
    STAGE_HINT="Demo stage requested. Use the **offers-api-demo** MCP server (https://api.demo-angebote.lenne.tech/mcp) for all offer operations in this prompt. Do NOT call tools on the default \`offers-api\` server — that one is production."
  else
    STAGE_HINT="Default stage. Use the **offers-api** MCP server (https://api.angebote.lenne.tech/mcp, production). The sibling \`offers-api-demo\` is available but should only be used when the user explicitly mentions the demo stage."
  fi

  CONTEXT="Offer-related keywords detected. ${STAGE_HINT} Use the creating-offers skill for creating and managing offers."
fi

# ── Emit structured hookSpecificOutput JSON (consistent with other detect scripts) ──
if [ -n "$CONTEXT" ]; then
  if command -v jq >/dev/null 2>&1; then
    jq -n --arg ctx "$CONTEXT" '{hookSpecificOutput: {hookEventName: "UserPromptSubmit", additionalContext: $ctx}}'
  else
    escaped=$(printf '%s' "$CONTEXT" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')
    printf '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"%s"}}\n' "$escaped"
  fi
fi

exit 0
