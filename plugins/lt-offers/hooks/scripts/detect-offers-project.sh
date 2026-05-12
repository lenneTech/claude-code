#!/bin/bash
# Skip in non-interactive headless mode (claude -p)
. "${0%/*}/_headless-skip.sh"

# Detects if the current project is the offers platform or if the user prompt
# mentions offer-related keywords, injecting skill context accordingly.

INPUT=$(cat)

# ── Extract prompt and cwd with jq fallback ──
if command -v jq >/dev/null 2>&1; then
  PROMPT=$(echo "$INPUT" | jq -r '.prompt // .user_prompt // empty' 2>/dev/null)
  CWD=$(echo "$INPUT" | jq -r '.cwd // empty' 2>/dev/null)
else
  PROMPT=$(echo "$INPUT" | grep -o '"prompt"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"prompt"[[:space:]]*:[[:space:]]*"//;s/"$//')
  CWD=$(echo "$INPUT" | grep -o '"cwd"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"cwd"[[:space:]]*:[[:space:]]*"//;s/"$//')
fi

# Fallback to CLAUDE_USER_PROMPT env var and PWD
PROMPT="${PROMPT:-${CLAUDE_USER_PROMPT:-}}"
CWD="${CWD:-$PWD}"

CONTEXT=""
PROMPT_LOWER=$(echo "$PROMPT" | tr '[:upper:]' '[:lower:]')

# ── Keyword guard: only check filesystem if prompt mentions offers ──
# This avoids unnecessary filesystem stats on every prompt in unrelated projects
if echo "$PROMPT_LOWER" | grep -qE '(angebot|offer|content.?block|preistabelle|pricing|vorlage|template.*angebot|angebote\.lenne|analytics|statistik|aufrufe|views|downloads|verweildauer|scroll|wissensdatenbank|knowledge|quellen|sources|briefing|unterlagen)'; then

  # Stage routing — `offers-api` (prod, default) vs `offers-api-demo` (demo).
  # Trigger: any explicit mention of "demo" inside an offers-related prompt.
  # The whole-word match avoids false positives like "Demonstrations-Angebot"
  # being routed to the demo stage when the author meant production.
  if echo "$PROMPT_LOWER" | grep -qE '(^|[^a-z0-9])demo([^a-z0-9]|$)|demo-angebote\.lenne|demo[- ]?(stage|umgebung|instanz|server|deployment)'; then
    STAGE_HINT="Demo stage requested. Use the **offers-api-demo** MCP server (https://api.demo-angebote.lenne.tech/mcp) for all offer operations in this prompt. Do NOT call tools on the default \`offers-api\` server — that one is production."
  else
    STAGE_HINT="Default stage. Use the **offers-api** MCP server (https://api.angebote.lenne.tech/mcp, production). The sibling \`offers-api-demo\` is available but should only be used when the user explicitly mentions the demo stage."
  fi

  # Check if we're inside the offers project
  if [ -f "$CWD/projects/api/src/server/modules/offer/offer.service.ts" ] || \
     [ -f "$CWD/projects/app/app/interfaces/offer.interface.ts" ]; then
    CONTEXT="Offers project detected (local development). The project-level .mcp.json overrides \`offers-api\` to http://localhost:3000/mcp — MCP tools will use the local API server. ${STAGE_HINT} Use the creating-offers skill for offer-related tasks."
  else
    CONTEXT="Offer-related keywords detected. ${STAGE_HINT} Use the creating-offers skill for creating and managing offers."
  fi
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
