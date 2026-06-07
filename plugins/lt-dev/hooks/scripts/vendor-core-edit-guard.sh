#!/bin/bash
# PostToolUse hook (Write|Edit): remind about the Vendor Modification Policy
# when a file inside a vendored framework core was just edited.
#
# A vendored core (backend: src/core/, frontend: app/core/) mirrors upstream
# @lenne.tech/nest-server or @lenne.tech/nuxt-extensions. It is a comprehension
# aid, NOT a fork: it may only be edited for changes that are generally useful
# to every consumer — and those changes MUST flow back upstream so they survive
# the next sync. Project-specific code belongs OUTSIDE the core.
#
# This hook fires AFTER the edit (non-blocking) and injects a short reminder
# with the correct contribute command. It only triggers when the edited file
# actually lives under a vendored core (an adjacent VENDOR.md confirms it), so
# it stays silent in npm-mode projects and for non-vendored src/core/ trees.
#
# Fail-open: on any error (missing jq, bad JSON), stay silent.
# Opt-out: LT_SKIP_VENDOR_CORE_GUARD=1

. "${0%/*}/_headless-skip.sh"

[ -n "${LT_SKIP_VENDOR_CORE_GUARD:-}" ] && exit 0

INPUT=$(cat)

# ── Extract file_path from JSON input ──
if command -v jq &>/dev/null; then
  FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
else
  FILE_PATH=$(echo "$INPUT" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"file_path"[[:space:]]*:[[:space:]]*"//;s/"$//')
fi

[ -z "$FILE_PATH" ] && exit 0

# Never nag about edits to VENDOR.md itself — that's where logging is expected.
case "$FILE_PATH" in
  */VENDOR.md) exit 0 ;;
esac

emit() {
  local context="$1"
  if command -v jq &>/dev/null; then
    jq -n --arg ctx "$context" '{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":$ctx}}'
  else
    local escaped
    escaped=$(printf '%s' "$context" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')
    printf '{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"%s"}}\n' "$escaped"
  fi
  exit 0
}

# ── Backend vendored core: …/src/core/… with an adjacent VENDOR.md ──
case "$FILE_PATH" in
  */src/core/*)
    core_root="${FILE_PATH%%/src/core/*}/src/core"
    if [ -f "$core_root/VENDOR.md" ]; then
      emit "You edited the VENDORED @lenne.tech/nest-server core (${core_root}/). Vendor Modification Policy: only edit src/core/ for changes that are generally useful to EVERY consumer (bugfixes, security, broad enhancements) — project-specific logic belongs OUTSIDE the core (inheritance, extension, ICoreModuleOverrides). If this change is generally useful, log it in src/core/VENDOR.md and run /lt-dev:backend:contribute-nest-server-core to send it upstream so it survives the next sync. See the nest-server-core-vendoring skill."
    fi
    ;;
esac

# ── Frontend vendored core: …/app/core/… with an adjacent VENDOR.md ──
case "$FILE_PATH" in
  */app/core/*)
    core_root="${FILE_PATH%%/app/core/*}/app/core"
    if [ -f "$core_root/VENDOR.md" ]; then
      emit "You edited the VENDORED @lenne.tech/nuxt-extensions core (${core_root}/). Vendor Modification Policy: only edit app/core/ for changes that are generally useful to EVERY consumer (bugfixes, security, broad enhancements, SSR fixes) — project-specific logic belongs OUTSIDE the core (app/composables/, app/components/, plugin overrides). If this change is generally useful, log it in app/core/VENDOR.md and run /lt-dev:frontend:contribute-nuxt-extensions-core to send it upstream so it survives the next sync. See the nuxt-extensions-core-vendoring skill."
    fi
    ;;
esac

exit 0
