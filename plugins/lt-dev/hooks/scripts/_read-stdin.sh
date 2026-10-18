#!/bin/bash
# Shared helper: read the hook payload from stdin with a time limit.
#
#   . "${0%/*}/_read-stdin.sh"
#   read_hook_input [seconds]   # sets HOOK_INPUT; default limit 2 s
#
# Claude Code writes the JSON payload and closes stdin, so the read normally returns at
# EOF within milliseconds. An unguarded `INPUT=$(cat)` waits for that EOF forever: a
# wrapper that keeps stdin open (observed in another plugin on Windows, where a
# PowerShell wrapper swallowed EOF and froze sessions) holds the hook until its
# hooks.json timeout, and a UserPromptSubmit hook blocks the model all that time.
#
# Identical copies live in lt-dev, lt-offers and lt-showroom: plugins run in isolation and
# cannot source each other's helpers.
#
# Fail-open: on a timeout HOOK_INPUT keeps what arrived (bash 4+) or stays empty
# (bash 3.2 discards partial input), and each caller treats an empty or truncated
# payload as "nothing to check". A terminal on stdin (manual run) yields "".
#
# Portable to macOS bash 3.2 and Git Bash without GNU `timeout`: the limit is the read
# builtin's own -t, which takes whole seconds on bash 3.2. bash 4.1+ reads with -N,
# which ignores delimiters and on bash 5.1+ reads the pipe in blocks rather than byte by
# byte; measured on bash 5.2 with a 2 MB payload: 1.0 s with -N, 2.2 s with -d ''.

read_hook_input() {
  local secs="${1:-2}"
  HOOK_INPUT=""
  [ -t 0 ] && return 0
  if [ "${BASH_VERSINFO[0]:-3}" -gt 4 ] || { [ "${BASH_VERSINFO[0]:-3}" -eq 4 ] && [ "${BASH_VERSINFO[1]:-0}" -ge 1 ]; }; then
    IFS= read -r -N 268435456 -t "$secs" HOOK_INPUT 2>/dev/null
  else
    IFS= read -r -d '' -t "$secs" HOOK_INPUT 2>/dev/null
  fi
  # read returns non-zero at EOF and on timeout; both are expected here.
  return 0
}
