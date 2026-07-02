#!/bin/bash
# SessionStart hook: reap stale chrome-devtools-mcp process chains.
#
# Every Claude Code session spawns its own chrome-devtools-mcp server (per
# plugin!), each holding a Chrome instance. Sessions left open in forgotten
# terminal tabs accumulate these chains for days and eat RAM. Claude Code
# never kills them for still-open sessions, so we do it here.
#
# Killed are chains that are:
#   (a) orphaned — their starter (claude process) died, so they were
#       reparented to PID 1, or
#   (b) stale — running longer than CHROME_MCP_MAX_AGE_HOURS (default 72).
#       If such a session is still in use, its next tool call reconnects in
#       under a second thanks to the launcher's fast path.
#
# Chains belonging to THIS session (our own process ancestry) are never
# touched, no matter their age — long-running sessions keep their connection.
#
# Must stay fast: single ps scan + a few walk-ups, TERM then KILL, <3s total.

set -u

MAX_AGE_HOURS="${CHROME_MCP_MAX_AGE_HOURS:-72}"
MAX_AGE_SECS=$(( MAX_AGE_HOURS * 3600 ))

# Ancestor PIDs of this hook process, up to and INCLUDING our session's claude
# process — and no further. Ancestors above claude (login shell, iTerm/Terminal,
# launchd) are shared with every other session on the machine; including them
# would make every session look like our own and protect all of them.
own_ancestors=" "
pid=$$
while [ "$pid" -gt 1 ] 2>/dev/null; do
  own_ancestors="$own_ancestors$pid "
  case "$(ps -o comm= -p "$pid" 2>/dev/null)" in
    *claude*) break ;;
  esac
  pid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')
  [ -n "$pid" ] || break
done

# True if $1 or any of its ancestors is one of our own ancestors.
belongs_to_this_session() {
  local p="$1" depth=0
  while [ -n "$p" ] && [ "$p" -gt 1 ] 2>/dev/null && [ "$depth" -lt 15 ]; do
    case "$own_ancestors" in
      *" $p "*) return 0 ;;
    esac
    p=$(ps -o ppid= -p "$p" 2>/dev/null | tr -d ' ')
    depth=$(( depth + 1 ))
  done
  return 1
}

# etime is [[dd-]hh:]mm:ss
etime_to_secs() {
  echo "$1" | awk -F'[-:]' '{
    if (NF == 4)      print $1*86400 + $2*3600 + $3*60 + $4
    else if (NF == 3) print $1*3600 + $2*60 + $3
    else if (NF == 2) print $1*60 + $2
    else              print 0
  }'
}

victims=""
while IFS= read -r line; do
  pid=$(echo "$line" | awk '{print $1}')
  ppid=$(echo "$line" | awk '{print $2}')
  etime=$(echo "$line" | awk '{print $3}')
  [ "$pid" != "$$" ] || continue

  age=$(etime_to_secs "$etime")
  if [ "$ppid" -eq 1 ] || [ "$age" -ge "$MAX_AGE_SECS" ]; then
    belongs_to_this_session "$pid" && continue
    victims="$victims $pid"
  fi
done < <(ps -axo pid=,ppid=,etime=,command= \
  | grep -F 'chrome-devtools-mcp' \
  | grep -vE 'grep|cleanup-stale-chrome-mcp')

[ -n "$victims" ] || exit 0

# shellcheck disable=SC2086  # word splitting intended
kill $victims 2>/dev/null
sleep 1
for pid in $victims; do
  kill -0 "$pid" 2>/dev/null && kill -9 "$pid" 2>/dev/null
done

echo "cleanup-stale-chrome-mcp: reaped stale chrome-devtools-mcp processes:$victims" >&2
exit 0
