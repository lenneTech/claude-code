#!/bin/bash
# Skip in non-interactive headless mode (claude -p)
. "${0%/*}/_headless-skip.sh"

# Detects if the current project is the offers platform or if the user prompt
# mentions offer-related keywords, injecting skill context accordingly.

INPUT=$(cat)

PROMPT=$(echo "$INPUT" | jq -r '.user_prompt // empty' 2>/dev/null || echo "")
CWD=$(echo "$INPUT" | jq -r '.cwd // empty' 2>/dev/null || echo "$PWD")

CONTEXT=""

# Check if we're inside the offers project
if [ -f "$CWD/projects/api/src/server/modules/offer/offer.service.ts" ] || \
   [ -f "$CWD/projects/app/app/interfaces/offer.interface.ts" ]; then
  CONTEXT="Offers project detected (local development). The project-level .mcp.json overrides offers-api to http://localhost:3000/mcp — MCP tools will use the local API server. Use the creating-offers skill for offer-related tasks."
fi

# Check for offer-related keywords in the prompt
PROMPT_LOWER=$(echo "$PROMPT" | tr '[:upper:]' '[:lower:]')
if echo "$PROMPT_LOWER" | grep -qE '(angebot|offer|content.?block|preistabelle|pricing|vorlage|template.*angebot|angebote\.lenne|analytics|statistik|aufrufe|views|downloads|verweildauer|scroll|wissensdatenbank|knowledge|quellen|sources|briefing|unterlagen)'; then
  if [ -z "$CONTEXT" ]; then
    CONTEXT="Offer-related keywords detected. Use the creating-offers skill for creating and managing offers on angebote.lenne.tech."
  fi
fi

if [ -n "$CONTEXT" ]; then
  # Output context as additional information for the conversation
  cat <<EOF
$CONTEXT
EOF
fi

exit 0
