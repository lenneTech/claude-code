#!/bin/bash
# Detects if the current project is the showroom platform, injecting skill context accordingly.

INPUT=$(cat)

PROMPT=$(echo "$INPUT" | jq -r '.user_prompt // empty' 2>/dev/null || echo "")
CWD=$(echo "$INPUT" | jq -r '.cwd // empty' 2>/dev/null || echo "$PWD")

CONTEXT=""

# Check if we're inside the showroom project (monorepo or standalone)
if [ -f "$CWD/projects/api/src/server/modules/showcase/showcase.service.ts" ] || \
   ([ -f "$CWD/package.json" ] && grep -q '"showroom"' "$CWD/package.json" 2>/dev/null); then
  CONTEXT="Showroom project detected (local development). The project-level .mcp.json overrides showroom-api to http://localhost:3000/mcp — MCP tools will use the local API server. Use the creating-showcases skill for showcase content tasks and MCP operations. Use the analyzing-projects skill for project analysis features."
fi

if [ -n "$CONTEXT" ]; then
  cat <<EOF
$CONTEXT
EOF
fi

exit 0
