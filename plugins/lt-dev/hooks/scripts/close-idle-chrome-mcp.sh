#!/bin/bash
# PostToolUse hook on mcp__plugin_lt-dev_chrome-devtools__close_page: closes this
# session's automation Chrome as soon as no page of a walk is left open.
#
# chrome-devtools-mcp never closes its last page ("The last open page cannot be
# closed"), so after every walk a Canary window with about:blank stayed open until
# the session ended, one per live session. Observed 2026-11-25: six such windows,
# each held by a session one to two days old.
#
# When a close_page leaves only about:blank pages, or answers that the last page
# cannot be closed, this hook ends the Chrome instance this session's
# chrome-devtools-mcp launched. The server keeps running: it drops the handle on
# the disconnect, and its next tool call (new_page, navigate_page) launches a
# fresh browser. Puppeteer removes the temporary profile when Chrome exits.
#
# Only Chrome main processes are touched that
#   - run on a temporary puppeteer profile (--user-data-dir=…puppeteer_dev_chrome_profile-…,
#     which --isolated creates), so the developer's own browser profile is never hit, and
#   - descend from this session's claude process, so a peer session's browser is never hit.
# Subagents run inside the same claude process and share its browser; the page
# list decides, so a walk of the main session keeps the browser while a subagent
# closes its own page.
#
# CHROME_MCP_KEEP_BROWSER=1 keeps the browser open (debugging a walk by hand).
# Fail-open: no jq, no ps (Windows Git Bash), no match, nothing happens.

set -u

[ "${CHROME_MCP_KEEP_BROWSER:-0}" = "1" ] && exit 0
command -v jq >/dev/null 2>&1 || exit 0

. "${0%/*}/_read-stdin.sh"
read_hook_input 2
[ -n "$HOOK_INPUT" ] || exit 0

# Every string of the tool response, whatever shape Claude Code hands an MCP result in.
text="$(printf '%s' "$HOOK_INPUT" | jq -r '[.tool_response | .. | strings] | join("\n")' 2>/dev/null)" || exit 0

idle=false
case "$text" in
  *"last open page cannot be closed"*) idle=true ;;
esac
if ! $idle; then
  # "## Pages" lists the remaining pages as "<id>: <title> (<url>)" or "<id>: <url>",
  # optionally followed by " [selected]" and " isolatedContext=<name>".
  pages="$(printf '%s\n' "$text" | awk '/^## Pages/ { f = 1; next } /^## / { f = 0 } f && /^[0-9]+: /')"
  if [ -n "$pages" ] \
     && ! printf '%s\n' "$pages" | grep -qvE '^[0-9]+: (about:blank|.*\(about:blank\))( \[selected\])?( isolatedContext=[^ ]*)?$'; then
    idle=true
  fi
fi
$idle || exit 0

# This session's claude process: the first ancestor whose command name contains "claude".
own_claude=""
pid=$$
depth=0
while [ -n "$pid" ] && [ "$pid" -gt 1 ] 2>/dev/null && [ "$depth" -lt 20 ]; do
  case "$(ps -o comm= -p "$pid" 2>/dev/null)" in
    *claude*) own_claude="$pid"; break ;;
  esac
  pid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')
  depth=$((depth + 1))
done
[ -n "$own_claude" ] || exit 0

descends_from_own_claude() {
  local p="$1" d=0
  while [ -n "$p" ] && [ "$p" -gt 1 ] 2>/dev/null && [ "$d" -lt 20 ]; do
    [ "$p" = "$own_claude" ] && return 0
    p=$(ps -o ppid= -p "$p" 2>/dev/null | tr -d ' ')
    d=$((d + 1))
  done
  return 1
}

victims=""
while read -r cpid cmd; do
  [ -n "$cpid" ] || continue
  case "$cmd" in
    *--type=*) continue ;;  # renderer, GPU and utility helpers end with their main process
  esac
  descends_from_own_claude "$cpid" && victims="$victims $cpid"
done < <(ps -A -o pid=,command= 2>/dev/null \
  | grep -F -- '--remote-debugging-pipe' \
  | grep -F 'puppeteer_dev_chrome_profile-' \
  | grep -vF 'grep')

[ -n "$victims" ] || exit 0

# Alive and not a zombie: an exited Chrome stays a zombie until its server reaps it.
running() {
  local s
  s="$(ps -o stat= -p "$1" 2>/dev/null | tr -d ' ')"
  [ -n "$s" ] && [ "${s#Z}" = "$s" ]
}

# shellcheck disable=SC2086  # word splitting intended
kill $victims 2>/dev/null
alive="$victims"
for _ in 1 2 3 4 5 6; do
  still=""
  for v in $alive; do
    running "$v" && still="$still $v"
  done
  alive="$still"
  [ -n "$alive" ] || break
  sleep 0.5
done
# shellcheck disable=SC2086
[ -n "$alive" ] && kill -9 $alive 2>/dev/null

jq -cn '{hookSpecificOutput: {hookEventName: "PostToolUse", additionalContext: "lt-dev closed this session'"'"'s automation browser: no page of the walk was left open, so the whole Chrome window is gone. The next chrome-devtools call (new_page, navigate_page) starts a fresh browser with an empty profile, so sign in again there."}}'
exit 0
