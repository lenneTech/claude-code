#!/bin/bash
# Stop hook: Automatic quality gate with specialized reviewers
#
# Uses Stop hook decision control:
# - exit 0 with no JSON → allow stop
# - exit 0 with {"decision":"block","reason":"..."} → force continue
#
# 2-Pass system:
# Pass 1 (counter=0): Full quality gate — lint, build, parallel reviews via Agent Team
# Pass 2 (counter=1): Verification — lint + build only
# Pass 3+ (counter>=2): Allow stop

INPUT=$(cat)

# Skip non-project directories
case "$PWD" in
  "$HOME/.claude"*) exit 0 ;;
esac

git rev-parse --is-inside-work-tree &>/dev/null || exit 0

# ── Check for modified source files ──
CHANGED_FILES=$(
  {
    git diff --name-only HEAD 2>/dev/null
    git diff --cached --name-only 2>/dev/null
    git ls-files --others --exclude-standard 2>/dev/null
  } | grep -E '\.(ts|vue|tsx|jsx|js|mjs)$' | sort -u
)

# No source files changed → allow stop
[ -z "$CHANGED_FILES" ] && exit 0

# ── Counter logic ──
DIR_HASH=$(echo "$PWD" | md5 2>/dev/null || echo "$PWD" | md5sum 2>/dev/null | cut -d' ' -f1)
COUNTER_FILE="/tmp/.claude-qg-${DIR_HASH}"
TIMESTAMP_FILE="/tmp/.claude-qg-ts-${DIR_HASH}"

date +%s > "$TIMESTAMP_FILE"

PASS_COUNT=0
[ -f "$COUNTER_FILE" ] && PASS_COUNT=$(cat "$COUNTER_FILE" 2>/dev/null || echo "0")

# Pass 3+: allow stop
[ "${PASS_COUNT:-0}" -ge 2 ] && exit 0

FILE_COUNT=$(echo "$CHANGED_FILES" | wc -l | tr -d ' ')
NEW_COUNT=$((PASS_COUNT + 1))
echo "$NEW_COUNT" > "$COUNTER_FILE"

# ── Detect affected domains from changed files ──
HAS_BACKEND=$(echo "$CHANGED_FILES" | grep -qE 'projects/api/|packages/api/|src/server/' && echo "true" || echo "false")
HAS_FRONTEND=$(echo "$CHANGED_FILES" | grep -qE '\.vue$|projects/app/|packages/app/|app/components/|app/pages/|app/composables/' && echo "true" || echo "false")

# ── PASS 1: Full quality gate with Agent Team reviews ──
if [ "$PASS_COUNT" -eq 0 ]; then
REASON=$(cat <<'ENDOFPASS1'
## Automatic Quality Gate — Pass 1/2

Source files were modified. Running full quality gate.

### Step 1: Build, Lint & Test

Detect the package manager (pnpm/yarn/npm via lockfile), then run in each affected subproject:

1. `npm run lint:fix` (or equivalent) — auto-fix lint issues
2. `npm run format` (if available) — auto-format code
3. `npx tsc --noEmit` (in each subproject) — zero TypeScript errors, no implicit any
4. `npm run build` — verify build succeeds
5. `npm test` (if test script exists) — run test suite, report failures but do NOT block on test failures (tests may need updates after code changes)

**TypeScript errors are blocking** — fix all TS errors before proceeding to reviews.

### Step 2: Parallel Reviews via Agent Team

Launch ALL applicable reviewers simultaneously using Agent tool calls in a single message:

1. **Security Reviewer** — Agent tool with `subagent_type: "lt-dev:security-reviewer"`:
   - Prompt: "Quick security review of recent code changes. Focus on: injection risks, auth bypass, data exposure, missing input validation, hardcoded secrets, missing @Restricted/@Roles/securityCheck. Only report Critical and High severity findings. Be concise."

2. **Frontend Reviewer** (only if .vue or app/ files changed) — Agent tool with `subagent_type: "lt-dev:frontend-reviewer"`:
   - Prompt: "Quick frontend review of recent code changes. Focus on: missing types on refs/computed, SSR safety violations, accessibility gaps, hardcoded colors, console.log usage, missing Loading/Error/Empty states. Only report High severity findings. Be concise."

3. **Backend Reviewer** (only if api/ or src/server/ files changed) — Agent tool with `subagent_type: "lt-dev:backend-reviewer"`:
   - Prompt: "Quick backend review of recent code changes. Focus on: missing @Restricted/@Roles, missing securityCheck, implicit any, missing input validation, blind serviceOptions passthrough. Only report High severity findings. Be concise."

4. **UX Reviewer** (only if .vue or app/ files changed) — Agent tool with `subagent_type: "lt-dev:ux-reviewer"`:
   - Prompt: "Quick UX pattern review of recent code changes. Focus on: missing Loading/Empty/Error states, missing toast feedback after actions, dead-end navigation, forms without loading on submit, destructive actions without confirmation. Only report High severity findings. Be concise."

### Step 3: Handle Review Findings

After all reviews complete:

**Critical/High security findings:**
- Fix them immediately. These are non-negotiable.

**Critical/High code review findings:**
- Auto-fix: lint issues, formatting, missing type annotations, dead code
- Report to user (do NOT auto-fix): architectural concerns, design decisions, missing tests
ENDOFPASS1
)
  jq -n --arg reason "$REASON" '{"decision":"block","reason":$reason}'
  exit 0
fi

# ── PASS 2: Verification after fixes ──
if [ "$PASS_COUNT" -eq 1 ]; then
REASON=$(cat <<'ENDOFPASS2'
## Automatic Quality Gate — Pass 2/2 (Verification)

Fixes were applied from review findings. Verify everything is clean.

### Step 1: Verify Build, Lint & Test

1. `npm run lint` — must pass with zero errors
2. `npx tsc --noEmit` — must pass with zero TypeScript errors
3. `npm run build` — must succeed
4. `npm test` (if available) — run tests, report results

### Step 2: Summary Report

Present a final summary to the user:

| Check           | Status |
|-----------------|--------|
| Lint            | .../... |
| TypeScript      | .../... |
| Build           | .../... |
| Tests           | .../... |
| Security Review | .../... |
| Code Review     | .../... |

### Security Fixes Applied
- [list what was fixed, or "No critical findings"]

### Code Review Fixes Applied
- [list auto-fixes applied]

### Remaining Items (user decision needed)
- [list items that need user input, or "None"]
ENDOFPASS2
)
  jq -n --arg reason "$REASON" '{"decision":"block","reason":$reason}'
  exit 0
fi

exit 0
