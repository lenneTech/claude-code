#!/bin/bash
# Stop hook: Automatic quality gate with specialized reviewers
#
# Uses Stop hook decision control:
# - exit 0 with no JSON → allow stop
# - exit 0 with {"decision":"block","reason":"..."} → force continue
#
# Opt-out: CLAUDE_SKIP_QUALITY_GATE=1
#
# Skip conditions:
# - CLAUDE_SKIP_QUALITY_GATE=1
# - No source files changed
# - /lt-dev:review already ran and no new changes since (diff-hash match)
#
# 2-Pass system with tiered response:
# Pass 1 (counter=0): Tiered by change magnitude:
#   - Light    (<30 lines, ≤3 files): lint + build + TypeScript only
#   - Standard (30-100 lines, 4-10 files): lint + build + security-reviewer
#   - Full     (>100 lines or >10 files): lint + build + parallel review agents
# Pass 2 (counter=1): Verification — lint + build only
# Pass 3+ (counter>=2): Allow stop

INPUT=$(cat)

# ── Recursion guard: skip if this stop was triggered by a previous hook block ──
STOP_HOOK_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false' 2>/dev/null)
if [ "$STOP_HOOK_ACTIVE" = "true" ]; then
  exit 0
fi

# ── JSON output helper (jq with fallback) ──
emit_block() {
  local reason="$1"
  if command -v jq &>/dev/null; then
    jq -n --arg reason "$reason" '{"decision":"block","reason":$reason}'
  else
    # Manual JSON escaping: backslashes, quotes, newlines, tabs
    local escaped
    escaped=$(printf '%s' "$reason" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e ':a' -e 'N' -e '$!ba' -e 's/\n/\\n/g' -e 's/\t/\\t/g')
    printf '{"decision":"block","reason":"%s"}\n' "$escaped"
  fi
}

# ── Opt-out via environment variable ──
[ "${CLAUDE_SKIP_QUALITY_GATE:-0}" = "1" ] && exit 0

# Skip non-project directories
case "$PWD" in
  "$HOME/.claude"*) exit 0 ;;
esac

git rev-parse --is-inside-work-tree &>/dev/null || exit 0

# ── Check for modified source files ──
# git diff HEAD covers both staged and unstaged vs HEAD; ls-files adds untracked
CHANGED_FILES=$(
  {
    git diff --name-only HEAD 2>/dev/null
    git ls-files --others --exclude-standard 2>/dev/null
  } | grep -E '\.(ts|vue|tsx|jsx|js|mjs)$' | sort -u
)

# No source files changed → allow stop
[ -z "$CHANGED_FILES" ] && exit 0

# ── State files ──
DIR_HASH=$(echo "$PWD" | md5 2>/dev/null || echo "$PWD" | md5sum 2>/dev/null | cut -d' ' -f1)
COUNTER_FILE="/tmp/.claude-qg-${DIR_HASH}"
TIMESTAMP_FILE="/tmp/.claude-qg-ts-${DIR_HASH}"
REVIEWED_FILE="/tmp/.claude-qg-reviewed-${DIR_HASH}"
TIER_FILE="/tmp/.claude-qg-tier-${DIR_HASH}"

# ── Already reviewed with no new changes → allow stop ──
if [ -f "$REVIEWED_FILE" ]; then
  REVIEWED_DIFF_HASH=$(cat "$REVIEWED_FILE" 2>/dev/null)
  CURRENT_DIFF_HASH=$(git diff HEAD 2>/dev/null | md5 2>/dev/null || git diff HEAD 2>/dev/null | md5sum 2>/dev/null | cut -d' ' -f1)
  [ "$REVIEWED_DIFF_HASH" = "$CURRENT_DIFF_HASH" ] && exit 0
fi

# ── Counter logic ──
date +%s > "$TIMESTAMP_FILE"

PASS_COUNT=0
[ -f "$COUNTER_FILE" ] && PASS_COUNT=$(cat "$COUNTER_FILE" 2>/dev/null || echo "0")

# Pass 3+: allow stop
[ "${PASS_COUNT:-0}" -ge 2 ] && exit 0

FILE_COUNT=$(echo "$CHANGED_FILES" | wc -l | tr -d ' ')
NEW_COUNT=$((PASS_COUNT + 1))
echo "$NEW_COUNT" > "$COUNTER_FILE"

# ── Determine change magnitude ──
LINE_COUNT=$(git diff HEAD 2>/dev/null | grep -c '^[+-][^+-]' || echo "0")
# GATE_TIER: light (<30 lines, ≤3 files), standard (30-100 lines or 4-10 files), full (>100 lines or >10 files)
GATE_TIER="full"
if [ "$LINE_COUNT" -lt 30 ] && [ "$FILE_COUNT" -le 3 ]; then
  GATE_TIER="light"
elif [ "$LINE_COUNT" -lt 100 ] && [ "$FILE_COUNT" -le 10 ]; then
  GATE_TIER="standard"
fi

# ── PASS 1: Quality gate (tiered by change magnitude) ──
if [ "$PASS_COUNT" -eq 0 ]; then
echo "$GATE_TIER" > "$TIER_FILE"

# Light tier: only lint + build + TypeScript (small changes, ≤3 files, <30 lines)
if [ "$GATE_TIER" = "light" ]; then
REASON=$(cat <<'ENDOFLIGHT'
## Automatic Quality Gate — Light (small change detected)

Only a few files with minor changes. Running lint, TypeScript check, and build only.

### Steps

Detect the package manager (pnpm/yarn/npm via lockfile), then run:

**Phase A (sequential — these modify files):**
1. **lint:fix** script (or equivalent) — auto-fix lint issues
2. **format** script (if available) — auto-format code

**Phase B (parallel Bash calls in one message — read-only):**
3. **tsc --noEmit** (via local binary) — zero TypeScript errors
4. **build** script — verify build succeeds

**TypeScript errors are blocking** — fix all TS errors before allowing stop.

If all pass, present a short summary. No agent reviews needed for this change size.
ENDOFLIGHT
)

# Standard tier: lint + build + security-reviewer only (medium changes)
elif [ "$GATE_TIER" = "standard" ]; then
REASON=$(cat <<'ENDOFSTANDARD'
## Automatic Quality Gate — Standard (medium change detected)

Moderate changes detected. Running build checks and security review.

### Step 1: Build, Lint & Test

Detect the package manager (pnpm/yarn/npm via lockfile), then run in each affected subproject:

**Phase A (sequential — these modify files):**
1. **lint:fix** script (or equivalent) — auto-fix lint issues
2. **format** script (if available) — auto-format code

**Phase B (parallel Bash calls in one message — read-only):**
3. **tsc --noEmit** (via local binary, in each subproject) — zero TypeScript errors, no implicit any
4. **build** script — verify build succeeds
5. **test** script (if exists) — run test suite, report failures but do NOT block on test failures

**TypeScript errors are blocking** — fix all TS errors before proceeding.

### Step 2: Security Review

Launch security reviewer only:

1. **Security Reviewer** — Agent tool with `subagent_type: "lt-dev:security-reviewer"`:
   - Prompt: "Quick security review of recent code changes. Focus on: injection risks, auth bypass, data exposure, missing input validation, hardcoded secrets, missing @Restricted/@Roles/securityCheck. Only report Critical and High severity findings. Be concise."

### Step 3: Handle Findings

**Critical/High security findings:** Fix immediately. These are non-negotiable.
**Lint/TS issues:** Auto-fix where possible.
ENDOFSTANDARD
)

# Full tier: complete review pipeline (large changes, >100 lines or >10 files)
else
REASON=$(cat <<'ENDOFFULL'
## Automatic Quality Gate — Full (large change detected)

Significant changes detected. Running full quality gate with parallel reviews.

### Step 1: Build, Lint & Test

Detect the package manager (pnpm/yarn/npm via lockfile), then run in each affected subproject:

**Phase A (sequential — these modify files):**
1. **lint:fix** script (or equivalent) — auto-fix lint issues
2. **format** script (if available) — auto-format code

**Phase B (parallel Bash calls in one message — read-only):**
3. **tsc --noEmit** (via local binary, in each subproject) — zero TypeScript errors, no implicit any
4. **build** script — verify build succeeds
5. **test** script (if exists) — run test suite, report failures but do NOT block on test failures (tests may need updates after code changes)

**TypeScript errors are blocking** — fix all TS errors before proceeding to reviews.

### Step 2: Parallel Code Reviews (no browser)

Launch ALL applicable code-only reviewers simultaneously using Agent tool calls in a **single message**:

1. **Security Reviewer** — Agent tool with `subagent_type: "lt-dev:security-reviewer"`:
   - Prompt: "Quick security review of recent code changes. Focus on: injection risks, auth bypass, data exposure, missing input validation, hardcoded secrets, missing @Restricted/@Roles/securityCheck. Only report Critical and High severity findings. Be concise."

2. **Backend Reviewer** (only if api/ or src/server/ files changed) — Agent tool with `subagent_type: "lt-dev:backend-reviewer"`:
   - Prompt: "Quick backend review of recent code changes. Focus on: missing @Restricted/@Roles, missing securityCheck, implicit any, missing input validation, blind serviceOptions passthrough. Only report High severity findings. Be concise."

3. **Documentation Reviewer** — Agent tool with `subagent_type: "lt-dev:docs-reviewer"`:
   - Prompt: "Quick documentation review of recent code changes. Focus on: missing README updates for new features, missing JSDoc on new public interfaces, missing migration guide for breaking changes or new config options, new env vars not in .env.example. Only report High severity findings. Be concise."

### Step 3: Sequential Browser Reviews (Chrome DevTools MCP)

**IMPORTANT:** Browser reviewers use Chrome DevTools MCP which has global page state (`select_page`). They MUST run one at a time — never in parallel.

Launch each reviewer **after the previous one completes**:

1. **Frontend Reviewer** (only if .vue or app/ files changed) — Agent tool with `subagent_type: "lt-dev:frontend-reviewer"`:
   - Prompt: "Review recent frontend code changes with browser testing via Chrome DevTools MCP. Focus on: missing types on refs/computed, SSR safety violations, accessibility gaps, hardcoded colors, console.log usage, missing Loading/Error/Empty states. Navigate to affected pages and verify rendering. Only report High severity findings. Be concise."

2. **UX Reviewer** (only if .vue or app/ files changed) — Agent tool with `subagent_type: "lt-dev:ux-reviewer"`:
   - Prompt: "Review UX patterns of recent code changes with browser testing via Chrome DevTools MCP. Focus on: missing Loading/Empty/Error states, missing toast feedback after actions, dead-end navigation, forms without loading on submit, destructive actions without confirmation. Navigate to affected pages and verify behavior. Only report High severity findings. Be concise."

3. **A11y Reviewer** (only if .vue or app/ files changed) — Agent tool with `subagent_type: "lt-dev:a11y-reviewer"`:
   - Prompt: "Review accessibility of recent code changes with browser testing via Chrome DevTools MCP. Run Lighthouse audit on affected pages. Check ARIA labels, semantic HTML, keyboard navigation, contrast. Only report High severity findings. Be concise."

### Step 4: Handle Review Findings

After all reviews complete:

**Critical/High security findings:**
- Fix them immediately. These are non-negotiable.

**Critical/High code review findings:**
- Auto-fix: lint issues, formatting, missing type annotations, dead code
- Report to user (do NOT auto-fix): architectural concerns, design decisions, missing tests
ENDOFFULL
)
fi
  emit_block "$REASON"
  exit 0
fi

# ── PASS 2: Verification after fixes ──
if [ "$PASS_COUNT" -eq 1 ]; then
PREV_TIER="full"
[ -f "$TIER_FILE" ] && PREV_TIER=$(cat "$TIER_FILE" 2>/dev/null || echo "full")

if [ "$PREV_TIER" = "light" ]; then
REASON=$(cat <<'ENDOFPASS2LIGHT'
## Automatic Quality Gate — Pass 2/2 (Verification, Light)

Verify lint/build fixes are clean.

### Steps

Detect the package manager (pnpm/yarn/npm via lockfile), then run ALL checks as **parallel Bash calls in one message** (all are read-only verification):

1. **lint** script — must pass with zero errors
2. **tsc --noEmit** (via local binary) — must pass with zero TypeScript errors
3. **build** script — must succeed

### Summary

Present a short summary:

| Check      | Status |
|------------|--------|
| Lint       | .../... |
| TypeScript | .../... |
| Build      | .../... |
ENDOFPASS2LIGHT
)
else
REASON=$(cat <<'ENDOFPASS2'
## Automatic Quality Gate — Pass 2/2 (Verification)

Fixes were applied from review findings. Verify everything is clean.

### Step 1: Verify Build, Lint & Test

Detect the package manager (pnpm/yarn/npm via lockfile), then run ALL checks as **parallel Bash calls in one message** (all are read-only verification):

1. **lint** script — must pass with zero errors
2. **tsc --noEmit** (via local binary) — must pass with zero TypeScript errors
3. **build** script — must succeed
4. **test** script (if available) — run tests, report results

**CRITICAL:** Send all 4 checks in a **single message** with multiple Bash tool calls so they execute in parallel. Do NOT run them sequentially — they are all read-only and independent.

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
fi
  emit_block "$REASON"
  exit 0
fi

exit 0
