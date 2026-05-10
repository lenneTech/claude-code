#!/bin/bash
# PostCompact hook: Re-inject critical project context after context compaction.
# This ensures Claude retains awareness of the project type, package manager,
# and active conventions even after the conversation context is compressed.

# Read hook input from stdin
INPUT=$(cat)

# Extract fields from JSON (jq with fallback to grep/sed)
if command -v jq &>/dev/null; then
  TRIGGER=$(echo "$INPUT" | jq -r '.trigger // "unknown"')
  CWD=$(echo "$INPUT" | jq -r '.cwd // ""')
else
  TRIGGER=$(echo "$INPUT" | grep -o '"trigger"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*"trigger"[[:space:]]*:[[:space:]]*"//;s/"$//' || echo "unknown")
  CWD=$(echo "$INPUT" | grep -o '"cwd"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*"cwd"[[:space:]]*:[[:space:]]*"//;s/"$//' || echo "")
fi

# Use CWD from hook input, fall back to CLAUDE_PROJECT_DIR
PROJECT_DIR="${CWD:-${CLAUDE_PROJECT_DIR:-$(pwd)}}"

# --- Detect project structure ---
CONTEXT_LINES=()

# Detect monorepo structure
if [ -d "$PROJECT_DIR/projects/api" ] && [ -d "$PROJECT_DIR/projects/app" ]; then
  CONTEXT_LINES+=("Project: lenne.tech fullstack monorepo (projects/api + projects/app)")
elif [ -d "$PROJECT_DIR/packages/api" ] && [ -d "$PROJECT_DIR/packages/app" ]; then
  CONTEXT_LINES+=("Project: lenne.tech fullstack monorepo (packages/api + packages/app)")
fi

# Detect backend (NestJS / nest-server)
for dir in "$PROJECT_DIR" "$PROJECT_DIR/projects/api" "$PROJECT_DIR/packages/api"; do
  if [ -f "$dir/package.json" ]; then
    if grep -q "@lenne.tech/nest-server" "$dir/package.json"; then
      VERSION=$(grep -oE '"@lenne.tech/nest-server"[[:space:]]*:[[:space:]]*"[^"]*"' "$dir/package.json" | head -1 | grep -o '[0-9][^"]*' || echo "unknown")
      REL_DIR="${dir#$PROJECT_DIR/}"
      [ "$REL_DIR" = "$dir" ] && REL_DIR="."
      CONTEXT_LINES+=("Backend: NestJS with @lenne.tech/nest-server v${VERSION} (${REL_DIR})")
      break
    fi
  fi
done

# Detect frontend (Nuxt / nuxt-extensions)
for dir in "$PROJECT_DIR" "$PROJECT_DIR/projects/app" "$PROJECT_DIR/packages/app"; do
  if [ -f "$dir/package.json" ]; then
    REL_DIR="${dir#$PROJECT_DIR/}"
    [ "$REL_DIR" = "$dir" ] && REL_DIR="."
    if grep -q "@lenne.tech/nuxt-extensions" "$dir/package.json"; then
      CONTEXT_LINES+=("Frontend: Nuxt 4 with @lenne.tech/nuxt-extensions (${REL_DIR})")
      break
    elif [ -f "$dir/nuxt.config.ts" ]; then
      CONTEXT_LINES+=("Frontend: Nuxt project detected (${REL_DIR})")
      break
    fi
  fi
done

# Detect package manager
if [ -f "$PROJECT_DIR/pnpm-lock.yaml" ]; then
  CONTEXT_LINES+=("Package Manager: pnpm")
elif [ -f "$PROJECT_DIR/yarn.lock" ]; then
  CONTEXT_LINES+=("Package Manager: yarn")
elif [ -f "$PROJECT_DIR/package-lock.json" ]; then
  CONTEXT_LINES+=("Package Manager: npm")
fi

# Detect plugin development context
if [ -f "$PROJECT_DIR/.claude-plugin/marketplace.json" ] || [ -f "$PROJECT_DIR/.claude-plugin/plugin.json" ]; then
  CONTEXT_LINES+=("Context: Claude Code plugin/marketplace development")
fi

# Detect git branch
BRANCH=$(git -C "$PROJECT_DIR" branch --show-current 2>/dev/null || true)
if [ -n "$BRANCH" ]; then
  CONTEXT_LINES+=("Branch: ${BRANCH}")
fi

# Detect lt-dev URLs (from registry) so Claude does not regress to the
# legacy 3000/3001 assumption after compaction.
LT_REGISTRY="${LT_DEV_REGISTRY_PATH:-$HOME/.lenneTech/projects.json}"
# Slug = package.json "name" (scope stripped) or directory basename, slugified.
LT_SLUG=""
if [ -f "$PROJECT_DIR/package.json" ] && command -v jq >/dev/null 2>&1; then
  LT_RAW=$(jq -r '.name // empty' "$PROJECT_DIR/package.json" 2>/dev/null)
  LT_RAW="${LT_RAW##*/}"
  LT_SLUG=$(echo "$LT_RAW" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//')
fi
if [ -z "$LT_SLUG" ]; then
  LT_SLUG=$(basename "$PROJECT_DIR" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//')
fi
LT_API_HOST=""
LT_APP_HOST=""
if command -v jq >/dev/null 2>&1 && [ -f "$LT_REGISTRY" ]; then
  LT_API_HOST=$(jq -r --arg s "$LT_SLUG" '.projects[$s].subdomains.api // empty' "$LT_REGISTRY" 2>/dev/null)
  LT_APP_HOST=$(jq -r --arg s "$LT_SLUG" '.projects[$s].subdomains.app // empty' "$LT_REGISTRY" 2>/dev/null)
fi
if [ -n "$LT_API_HOST" ] || [ -n "$LT_APP_HOST" ]; then
  LT_CTX="lt-dev URLs:"
  [ -n "$LT_APP_HOST" ] && LT_CTX="$LT_CTX App=https://${LT_APP_HOST}"
  [ -n "$LT_API_HOST" ] && LT_CTX="$LT_CTX API=https://${LT_API_HOST}"
  CONTEXT_LINES+=("$LT_CTX (use \`lt dev up\` — never assume 3000/3001)")
fi

# --- Output context summary ---
if [ ${#CONTEXT_LINES[@]} -gt 0 ]; then
  echo "--- Post-Compaction Project Context (${TRIGGER}) ---"
  for line in "${CONTEXT_LINES[@]}"; do
    echo "- ${line}"
  done
  echo "---"
  echo "Tip: Use skill auto-detection (UserPromptSubmit hooks) for full context on next prompt."
fi

exit 0
