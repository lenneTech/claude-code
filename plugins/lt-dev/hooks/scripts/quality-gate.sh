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
# - Non-project directory (~/.claude/*)
# - Non-git repository
# - No source files changed
# - Baseline unchanged (no Claude edits this turn)
# - Already reviewed with no new changes (diff-hash match)
# - No build tooling (no lint/build/test scripts)
# - Pass 3+ (counter >= 2)
#
# 2-Pass system with tiered response:
# Pass 1 (counter=0): Tiered by change magnitude:
#   - Light    (<30 lines, ≤3 files): lint + build + TypeScript only
#   - Standard (30-100 lines, 4-10 files): lint + build + security-reviewer
#   - Full     (>100 lines or >10 files): lint + build + parallel review agents
# Pass 2 (counter=1): Verification — lint + build only
# Pass 3+ (counter>=2): Allow stop

INPUT=$(cat)

# ── Diff hash helper ──
calc_diff_hash() {
  (git diff HEAD 2>/dev/null; git ls-files --others --exclude-standard 2>/dev/null) | md5sum 2>/dev/null || md5 2>/dev/null | awk '{print $1}'
}

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

# ── State key ──
DIR_HASH=$(echo "$PWD" | md5sum 2>/dev/null | cut -d' ' -f1 || echo "$PWD" | md5 2>/dev/null)

# ── Skip if working tree unchanged since prompt (no Claude edits this turn) ──
BASELINE_FILE="/tmp/.claude-qg-baseline-${DIR_HASH}"
if [ -f "$BASELINE_FILE" ]; then
  BASELINE_HASH=$(cat "$BASELINE_FILE" 2>/dev/null)
  CURRENT_HASH=$(calc_diff_hash)
  [ "$BASELINE_HASH" = "$CURRENT_HASH" ] && exit 0
fi

# ── Skip if project has no build tooling (lint/build/test scripts) ──
HAS_TOOLING=false
for pkg in "$PWD/package.json" "$PWD"/projects/*/package.json "$PWD"/packages/*/package.json; do
  if [ -f "$pkg" ] && grep -qE '"(build|lint|lint:fix|test)"[[:space:]]*:' "$pkg" 2>/dev/null; then
    HAS_TOOLING=true
    break
  fi
done
[ "$HAS_TOOLING" = false ] && exit 0

# ── State files ──
COUNTER_FILE="/tmp/.claude-qg-${DIR_HASH}"
TIMESTAMP_FILE="/tmp/.claude-qg-ts-${DIR_HASH}"
REVIEWED_FILE="/tmp/.claude-qg-reviewed-${DIR_HASH}"
TIER_FILE="/tmp/.claude-qg-tier-${DIR_HASH}"

# ── Already reviewed with no new changes → allow stop ──
if [ -f "$REVIEWED_FILE" ]; then
  REVIEWED_DIFF_HASH=$(cat "$REVIEWED_FILE" 2>/dev/null)
  CURRENT_DIFF_HASH=$(calc_diff_hash)
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

# Resolve instructions directory (relative to this script)
INSTRUCTIONS_DIR="${CLAUDE_PLUGIN_ROOT}/hooks/scripts/quality-gate-instructions"

# Light tier: only lint + build + TypeScript (small changes, ≤3 files, <30 lines)
if [ "$GATE_TIER" = "light" ]; then
REASON="Quality gate (light): Read ${INSTRUCTIONS_DIR}/light.md for steps, then execute them."

# Standard tier: lint + build + security-reviewer only (medium changes)
elif [ "$GATE_TIER" = "standard" ]; then
REASON="Quality gate (standard): Read ${INSTRUCTIONS_DIR}/standard.md for steps, then execute them."

# Full tier: complete review pipeline (large changes, >100 lines or >10 files)
else
REASON="Quality gate (full): Read ${INSTRUCTIONS_DIR}/full.md for steps, then execute them."
fi
  # Save current state hash so re-review is skipped if nothing changes
  CURRENT_DIFF_HASH=$(calc_diff_hash)
  echo "$CURRENT_DIFF_HASH" > "$REVIEWED_FILE"
  emit_block "$REASON"
  exit 0
fi

# ── PASS 2: Verification after fixes ──
if [ "$PASS_COUNT" -eq 1 ]; then
PREV_TIER="full"
[ -f "$TIER_FILE" ] && PREV_TIER=$(cat "$TIER_FILE" 2>/dev/null || echo "full")

INSTRUCTIONS_DIR="${CLAUDE_PLUGIN_ROOT}/hooks/scripts/quality-gate-instructions"

if [ "$PREV_TIER" = "light" ]; then
REASON="Quality gate pass 2/2 (verification, light): Read ${INSTRUCTIONS_DIR}/pass2-light.md for steps, then execute them."
else
REASON="Quality gate pass 2/2 (verification): Read ${INSTRUCTIONS_DIR}/pass2.md for steps, then execute them."
fi
  emit_block "$REASON"
  exit 0
fi

exit 0
