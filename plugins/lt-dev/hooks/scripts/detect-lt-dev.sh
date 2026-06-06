#!/bin/bash
# Skip in non-interactive headless mode (claude -p)
. "${0%/*}/_headless-skip.sh"

# Inject lt-dev context into the prompt so Claude knows whether the
# current project is an lt-Stack project and which URLs / migration
# state apply.
#
# Three states are reported:
#
#   1. ACTIVE    — project is registered + a `lt dev up` session is alive
#                  → emit URL block + "session: yes"
#   2. REGISTERED — project is registered but no active session
#                  → emit URL block + "session: no" + start hint
#   3. UNREGISTERED-LT — project IS an lt-Stack project (uses @lenne.tech/*
#                  in package.json) but has no registry entry yet
#                  → emit "needs migration" hint so Claude proactively
#                    runs `lt dev init`
#   4. NON-LT    — not an lt project → silent exit (untouched)

set -u

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"

find_workspace_root() {
  local dir="$1"
  for _ in 1 2 3 4 5 6; do
    if [ -f "$dir/pnpm-workspace.yaml" ] || [ -d "$dir/projects" ] || [ -f "$dir/lt.config.json" ]; then
      echo "$dir"
      return 0
    fi
    local parent
    parent=$(dirname "$dir")
    [ "$parent" = "$dir" ] && break
    dir="$parent"
  done
  return 1
}

ROOT=$(find_workspace_root "$PROJECT_DIR" || echo "$PROJECT_DIR")

# Slug derivation — same as cli/src/lib/dev-identity.ts#projectSlug.
slug_for() {
  local p="$1"
  local raw=""
  if [ -f "$p/package.json" ] && command -v jq >/dev/null 2>&1; then
    raw=$(jq -r '.name // empty' "$p/package.json" 2>/dev/null)
    raw="${raw##*/}"
  fi
  if [ -z "$raw" ]; then
    raw=$(basename "$p")
  fi
  echo "$raw" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//'
}

# Detect whether this is an lt-Stack project by inspecting:
#   - package.json deps for @lenne.tech/*
#   - lt.config.json presence
#   - subprojects/api or subprojects/app each with @lenne.tech/* deps (monorepo)
#   - lt-monorepo / nest-server-starter / nuxt-base-starter as package name
is_lt_project() {
  local p="$1"
  if [ -f "$p/lt.config.json" ]; then return 0; fi
  if has_lt_dep "$p/package.json"; then return 0; fi
  if has_lt_dep "$p/projects/api/package.json"; then return 0; fi
  if has_lt_dep "$p/projects/app/package.json"; then return 0; fi
  # Template marker
  if [ -f "$p/package.json" ] && command -v jq >/dev/null 2>&1; then
    local name
    name=$(jq -r '.name // empty' "$p/package.json" 2>/dev/null)
    case "$name" in
      lt-monorepo|nest-server-starter|nuxt-base-starter|@lenne.tech/*) return 0 ;;
    esac
  fi
  return 1
}

has_lt_dep() {
  local pkg="$1"
  [ -f "$pkg" ] || return 1
  command -v jq >/dev/null 2>&1 || return 1
  local hit
  hit=$(jq -r '
    [(.dependencies // {}) + (.devDependencies // {})]
    | first
    | keys
    | map(select(startswith("@lenne.tech/")))
    | length
  ' "$pkg" 2>/dev/null)
  [ "$hit" != "0" ] && [ -n "$hit" ]
}

SLUG=$(slug_for "$ROOT")

# Ticket worktree? A `.lt-dev/ticket` marker (written by `lt ticket start`) tags
# this worktree with its ticket id, so the effective stack is the SUFFIXED
# identity `<slug>-<id>` with its OWN URLs + database. Surface it so Claude knows
# it is working inside an isolated, per-ticket environment that runs parallel to
# (and must never influence) the other tickets.
TICKET=""
if [ -f "$ROOT/.lt-dev/ticket" ]; then
  TICKET=$(tr -d '[:space:]' < "$ROOT/.lt-dev/ticket" 2>/dev/null)
  [ -n "$TICKET" ] && SLUG="${SLUG}-${TICKET}"
fi

REGISTRY_PATH="${LT_DEV_REGISTRY_PATH:-$HOME/.lenneTech/projects.json}"

API_URL=""
APP_URL=""
DB_NAME=""
SESSION_ACTIVE="no"
REGISTERED="no"

# Active session?
if [ -f "$ROOT/.lt-dev/state.json" ]; then
  SESSION_ACTIVE="yes"
fi

# Registry lookup
if [ -f "$REGISTRY_PATH" ] && command -v jq >/dev/null 2>&1; then
  API_URL=$(jq -r --arg s "$SLUG" '(.projects[$s].subdomains.api // empty) | if . == "" then "" else "https://" + . end' "$REGISTRY_PATH" 2>/dev/null)
  APP_URL=$(jq -r --arg s "$SLUG" '(.projects[$s].subdomains.app // empty) | if . == "" then "" else "https://" + . end' "$REGISTRY_PATH" 2>/dev/null)
  DB_NAME=$(jq -r --arg s "$SLUG" '.projects[$s].dbName // empty' "$REGISTRY_PATH" 2>/dev/null)
  if [ -n "$API_URL" ] || [ -n "$APP_URL" ]; then
    REGISTERED="yes"
  fi
fi

# Decide: registered → URL block; lt project but unregistered → migration hint; otherwise silent.
if [ "$REGISTERED" = "yes" ]; then
  echo ""
  echo "## Active lt-dev project"
  echo ""
  echo "- slug: \`$SLUG\`"
  [ -n "$TICKET" ] && echo "- ticket: \`$TICKET\` — ISOLATED worktree; work ONLY here, never touch another ticket's folder/DB; all tickets: \`lt ticket list\`"
  [ -n "$APP_URL" ] && echo "- App: \`$APP_URL\`"
  [ -n "$API_URL" ] && echo "- API: \`$API_URL\`"
  [ -n "$DB_NAME" ] && echo "- DB:  \`mongodb://127.0.0.1/$DB_NAME\`"
  echo "- session: $SESSION_ACTIVE"
  echo ""
  if [ "$SESSION_ACTIVE" = "no" ]; then
    echo "**Project is registered but no \`lt dev up\` session is active. For Playwright/E2E use \`lt dev test\` — it spins up an ISOLATED, parallel stack on its own \`<slug>-test.localhost\` URLs and a dedicated \`<slug>-test\` database (reset once before the first test), never touches your dev data, and tears itself down automatically (\`lt dev test down\` stops a \`--keep\`-ed stack). For manual browser/API/Chrome-DevTools work, run \`lt dev up\` first. Use these URLs (never \`localhost:3000\`/\`localhost:3001\`).**"
  else
    echo "**For Playwright/E2E run \`lt dev test\` — an ISOLATED parallel stack on a dedicated \`<slug>-test\` DB that runs alongside this dev session and never pollutes it (do NOT run E2E against this dev session). For manual browser tests / API calls / Chrome DevTools, use these URLs as \`baseURL\`. Never assume \`localhost:3000\`/\`localhost:3001\`.**"
  fi
  echo ""
  exit 0
fi

# Ticket worktree whose isolated stack is not up yet → guide to `lt dev up` here.
if [ -n "$TICKET" ]; then
  echo ""
  echo "## lt-dev ticket worktree (\`$TICKET\`) — stack not up yet"
  echo ""
  echo "- slug: \`$SLUG\`  ·  root: \`$ROOT\`"
  echo ""
  echo "**This is an ISOLATED per-ticket worktree (\`lt ticket\`). Run \`lt dev up\` here to serve it on \`https://$SLUG.localhost\` + \`https://api.$SLUG.localhost\` with its own empty database. Work ONLY in this folder; never touch another ticket's folder or database. List all tickets with \`lt ticket list\`; for E2E use \`lt dev test\` (its DB is the per-ticket \`<slug>-test\`).**"
  echo ""
  exit 0
fi

if is_lt_project "$ROOT"; then
  echo ""
  echo "## lt-Stack project detected — not yet migrated to \`lt dev\`"
  echo ""
  echo "- slug (would be): \`$SLUG\`"
  echo "- root: \`$ROOT\`"
  echo ""
  echo "**Before starting any dev server in this project: run \`lt dev init\` (idempotent — also runs \`lt dev install\` automatically if this machine isn't set up yet; registers the project, patches legacy hardcoded ports, injects URL block into CLAUDE.md). Then \`lt dev up\` to serve under \`https://$SLUG.localhost\` + \`https://api.$SLUG.localhost\`. Do NOT start \`pnpm dev\` / \`pnpm start\` directly — multi-project parallelism + auth cross-wiring guards depend on \`lt dev\`.**"
  echo ""
  exit 0
fi

# Non-lt project → silent
exit 0
