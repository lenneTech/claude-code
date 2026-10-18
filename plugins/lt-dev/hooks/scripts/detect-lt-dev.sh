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
#   3. UNREGISTERED-LT — a project `lt dev init` can serve (see is_lt_project)
#                  but has no registry entry yet
#                  → emit "needs migration" hint so Claude proactively
#                    runs `lt dev init`
#   4. NON-LT    — a project `lt dev` does not serve (no lt dev layout or no lt
#                  evidence, see is_lt_project) → silent exit (untouched)
#
# Deliberately runs on EVERY turn: no prompt keyword guard, no slash-command skip, and
# no _skip-task-notification.sh guard (the other detect-* hooks use all three). The
# injected context is project identity, not a topical skill hint, so it cannot be a
# false positive. Background task / subagent notification turns are included on
# purpose: Claude often resumes work on such a turn (acting on the subagent's result),
# and when compaction has summarized earlier turns away, this block is what keeps it
# on the lt-dev URLs instead of localhost:3000/3001. Re-injecting it on a notification
# turn is redundant at worst.
#
# Two events, one script:
#   (no argument)  UserPromptSubmit — plain stdout, project from CLAUDE_PROJECT_DIR.
#   SubagentStart  hooks.json matcher `^lt-dev:` — the same block as
#                  hookSpecificOutput.additionalContext JSON, project from the `cwd` of the
#                  stdin payload (a worktree subagent has its own). Context from
#                  UserPromptSubmit never reaches a subagent, which starts with a fresh
#                  context window, so lt-dev agents get the block here.

set -u

EVENT="${1:-UserPromptSubmit}"

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
if [ "$EVENT" = "SubagentStart" ]; then
  . "${0%/*}/_read-stdin.sh"
  read_hook_input 2
  SUB_CWD=""
  if [ -n "$HOOK_INPUT" ]; then
    if command -v jq >/dev/null 2>&1; then
      SUB_CWD=$(printf '%s' "$HOOK_INPUT" | jq -r '.cwd // empty' 2>/dev/null)
    else
      SUB_CWD=$(printf '%s' "$HOOK_INPUT" | tr -d '\n' | grep -oE '"cwd"[[:space:]]*:[[:space:]]*"(\\.|[^"\\])*"' | head -1 \
        | sed 's/^"cwd"[[:space:]]*:[[:space:]]*"//;s/"$//;s/\\"/"/g;s/\\\\/\\/g')
    fi
  fi
  # A Windows path (C:\work\app) walks up with forward slashes in Git Bash.
  case "$SUB_CWD" in [A-Za-z]:\\*) SUB_CWD=$(printf '%s' "$SUB_CWD" | tr '\\' '/') ;; esac
  [ -n "$SUB_CWD" ] && [ -d "$SUB_CWD" ] && PROJECT_DIR="$SUB_CWD"
fi

# At "/" the probe paths are built from "" rather than "/": "//name" is a UNC path in
# Git Bash, and each probe of one waits for a network lookup. Observed in Plugin CI on
# windows-latest (2026-10-07): every hook call that walked up to "/" took 3.2 s instead
# of 0.45 s.
find_workspace_root() {
  local dir="$1" base
  for _ in 1 2 3 4 5 6; do
    base="${dir%/}"
    if [ -f "$base/pnpm-workspace.yaml" ] || [ -d "$base/projects" ] || [ -f "$base/lt.config.json" ]; then
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

# Slug derivation — same as cli/src/lib/dev-identity.ts#projectSlug: the package name
# without its scope, unless it is missing or an unchanged template default
# (UNMODIFIED_TEMPLATE_NAMES there: `lt-monorepo`). Then the folder name of the main git
# worktree, so a ticket worktree inherits its base project's name, or the folder itself
# outside git.
slug_for() {
  local p="$1"
  local raw="" common=""
  if [ -f "$p/package.json" ] && command -v jq >/dev/null 2>&1; then
    raw=$(jq -r '.name // empty' "$p/package.json" 2>/dev/null)
    raw="${raw##*/}"
  fi
  if [ -z "$raw" ] || [ "$raw" = "lt-monorepo" ]; then
    common=$(git -C "$p" rev-parse --path-format=absolute --git-common-dir 2>/dev/null)
    if [ -n "$common" ]; then
      raw=$(basename "$(dirname "$common")")
    else
      raw=$(basename "$p")
    fi
  fi
  echo "$raw" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//'
}

# The layout `lt dev` serves, as the lt CLI decides it (src/lib/dev-project.ts#resolveLayout,
# src/lib/dev-identity.ts#detectStandaloneKind): a projects/api or projects/app directory, or
# at the root src/config.env.ts or nest-cli.json (API) or nuxt.config.ts (App). Anywhere else
# `lt dev init` stops with "No lt project detected at this path".
# Observed 2026-10-18: the claude-code plugin marketplace (package `@lenne.tech/claude-code`)
# got 'run lt dev init' on every prompt; lt dev init refuses it.
has_dev_layout() {
  local p="$1"
  [ -d "$p/projects/api" ] || [ -d "$p/projects/app" ] \
    || [ -f "$p/src/config.env.ts" ] || [ -f "$p/nest-cli.json" ] || [ -f "$p/nuxt.config.ts" ]
}

# Detect whether this is an lt-Stack project `lt dev init` can serve: the layout above, plus
# lt evidence, because a plain NestJS or Nuxt app has the same layout:
#   - package.json deps for @lenne.tech/*
#   - lt.config.json presence
#   - subprojects/api or subprojects/app each with @lenne.tech/* deps (monorepo)
#   - lt-monorepo / nest-server-starter / nuxt-base-starter / @lenne.tech/* as package name
is_lt_project() {
  local p="$1"
  has_dev_layout "$p" || return 1
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
  # The marker is a file in the worktree and its content reaches Claude verbatim. A ticket
  # id (DEV-1234) uses letters, digits and . _ - only; anything else, or more than 64
  # characters, is not a ticket id and is ignored.
  case "$TICKET" in
    *[!A-Za-z0-9._-]*) TICKET="" ;;
  esac
  [ ${#TICKET} -gt 64 ] && TICKET=""
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
# Every block also names the skill that governs dev servers: this hook runs on every turn in an
# lt project, so the skill reaches Claude whether or not its description survives the listing budget.
# The SubagentStart block leaves that line out: lt-dev agents have no Skill tool, the one agent that
# manages servers preloads the skill through `skills:`, and the block itself names the commands.
SKILL_LINE="Starting, watching or stopping dev servers, and waiting on a pipeline or deployment: follow the managing-dev-servers skill."
[ "$EVENT" = "SubagentStart" ] && SKILL_LINE=""

render_block() {
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
  [ -n "$SKILL_LINE" ] && echo "$SKILL_LINE"
  echo ""
  return 0
fi

# Ticket worktree whose isolated stack is not up yet → guide to `lt dev up` here.
if [ -n "$TICKET" ]; then
  echo ""
  echo "## lt-dev ticket worktree (\`$TICKET\`) — stack not up yet"
  echo ""
  echo "- slug: \`$SLUG\`  ·  root: \`$ROOT\`"
  echo ""
  echo "**This is an ISOLATED per-ticket worktree (\`lt ticket\`). Run \`lt dev up\` here to serve it on \`https://$SLUG.localhost\` + \`https://api.$SLUG.localhost\` with its own empty database. Work ONLY in this folder; never touch another ticket's folder or database. List all tickets with \`lt ticket list\`; for E2E use \`lt dev test\` (its DB is the per-ticket \`<slug>-test\`).**"
  [ -n "$SKILL_LINE" ] && echo "$SKILL_LINE"
  echo ""
  return 0
fi

if is_lt_project "$ROOT"; then
  echo ""
  echo "## lt-Stack project detected — not yet migrated to \`lt dev\`"
  echo ""
  echo "- slug (would be): \`$SLUG\`"
  echo "- root: \`$ROOT\`"
  echo ""
  echo "**Before starting any dev server in this project: run \`lt dev init\` (idempotent — also runs \`lt dev install\` automatically if this machine isn't set up yet; registers the project, patches legacy hardcoded ports, injects URL block into CLAUDE.md). Then \`lt dev up\` to serve under \`https://$SLUG.localhost\` + \`https://api.$SLUG.localhost\`. Do NOT start \`pnpm dev\` / \`pnpm start\` directly — multi-project parallelism + auth cross-wiring guards depend on \`lt dev\`.**"
  [ -n "$SKILL_LINE" ] && echo "$SKILL_LINE"
  echo ""
  return 0
fi

# Non-lt project → silent
return 0
}

if [ "$EVENT" = "SubagentStart" ]; then
  BLOCK=$(render_block)
  [ -n "$BLOCK" ] || exit 0
  if command -v jq >/dev/null 2>&1; then
    jq -n --arg ctx "$BLOCK" '{hookSpecificOutput: {hookEventName: "SubagentStart", additionalContext: $ctx}}'
  else
    # JSON string escaping without jq: backslash, quote, tab, then newlines joined as \n.
    ctx=$(printf '%s' "$BLOCK" | sed 's/\\/\\\\/g; s/"/\\"/g; s/	/\\t/g' | awk '{ printf "%s%s", (NR > 1 ? "\\n" : ""), $0 }')
    printf '{"hookSpecificOutput":{"hookEventName":"SubagentStart","additionalContext":"%s"}}\n' "$ctx"
  fi
else
  render_block
fi
exit 0
