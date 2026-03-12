#!/bin/bash
# PreToolUse hook: Block dangerous Bash commands in lenne.tech projects
# Uses permissionDecision to deny destructive operations

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

[ -z "$COMMAND" ] && exit 0

deny() {
  echo "{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"permissionDecision\":\"deny\",\"permissionDecisionReason\":\"$1\"}}"
  exit 0
}

# ── Filesystem destruction ──
echo "$COMMAND" | grep -qE 'rm\s+(-[rfR]+\s+)?(/\s|/\*|/\s*$|~/\s|~/\*|~/?\s*$|\$HOME)' \
  && deny "Blocked: rm -rf on root or home directory is too dangerous."

# ── Git destruction ──
echo "$COMMAND" | grep -qE 'git\s+push\s+.*(--force|-f).*\s+(main|master)\b|git\s+push\s+.*\s+(main|master)\s+.*(--force|-f)' \
  && deny "Blocked: Force push to main/master is not allowed. Use --force-with-lease on feature branches."

echo "$COMMAND" | grep -qE 'git\s+reset\s+--hard\s*$' \
  && deny "Blocked: git reset --hard without target discards all changes. Specify a commit hash."

echo "$COMMAND" | grep -qE 'git\s+clean\s+-[a-z]*f[a-z]*d' \
  && deny "Blocked: git clean -fd removes untracked files permanently. Use git stash instead."

# ── Database destruction ──
echo "$COMMAND" | grep -qiE 'drop\s+(database|collection)|db\.dropDatabase|mongosh.*--eval.*drop' \
  && deny "Blocked: Database drop commands require manual confirmation."

# ── Docker destruction ──
echo "$COMMAND" | grep -qE 'docker\s+system\s+prune\s+-a' \
  && deny "Blocked: docker system prune -a removes all unused images and volumes. Use selective cleanup."

echo "$COMMAND" | grep -qE 'docker\s+volume\s+rm\s+.*mongo|docker\s+volume\s+prune' \
  && deny "Blocked: Removing MongoDB volumes destroys data. Use docker compose down without -v."

# ── Permission escalation ──
echo "$COMMAND" | grep -qE 'chmod\s+777\s' \
  && deny "Blocked: chmod 777 is a security risk. Use least-privilege permissions (644 for files, 755 for dirs)."

echo "$COMMAND" | grep -qE 'sudo\s+rm|sudo\s+chmod|sudo\s+chown.*/' \
  && deny "Blocked: sudo with destructive operations requires manual confirmation."

# ── Secret exposure ──
echo "$COMMAND" | grep -qE 'cat\s+\.env\s*$|cat\s+\.env\s*\|' \
  && deny "Blocked: Printing .env to stdout may expose secrets in logs. Use grep for specific vars."

# ── Code injection vectors ──
echo "$COMMAND" | grep -qE '\beval\s+"?\$\{?(COMMAND|INPUT|ARG|PARAM|QUERY|USER|DATA|BODY|PAYLOAD)\b' \
  && deny "Blocked: eval with user-controlled variable expansion is a code injection risk. Use explicit commands."

echo "$COMMAND" | grep -qE '\bsource\s+/dev/stdin|\.\s+/dev/stdin' \
  && deny "Blocked: Sourcing from stdin can execute injected code."

echo "$COMMAND" | grep -qE 'bash\s+-c\s+"?\$\{?(COMMAND|INPUT|ARG|PARAM|QUERY|USER|DATA|BODY|PAYLOAD)\b' \
  && deny "Blocked: bash -c with user-controlled variable expansion is a code injection risk. Use explicit commands."

# ── System file tampering ──
echo "$COMMAND" | grep -qE '>\s*/etc/|>>\s*/etc/|>\s*/usr/' \
  && deny "Blocked: Writing to system directories requires manual confirmation."

exit 0
