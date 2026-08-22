#!/bin/bash
# peer-ledger.sh — persistent coordination state for parallel Claude Code sessions.
#
# Cross-session messages are NOT history: a session that starts later never
# learns what was sent before it existed, and a claim dies silently with the
# session that made it. This ledger persists the two things where that loss is
# expensive and no other system records them:
#
#   claims  — who is working a cross-cutting topic (a CVE, a broken CI config,
#             a lockfile migration) so it is not fixed four times in parallel
#   notes   — a diagnosis worth more than the session that produced it
#
# Everything else stays in its own system: tickets in Linear, branches in Git,
# and LANDED / READY / CONFLICT / ASK as messages, because they are genuinely
# about this moment.
#
# A claim is bound to the claiming session's PID. When that session is gone the
# claim reads as stale and is free to take, so nothing stays blocked by a
# session that crashed or was closed.
#
# State lives outside every repository (never in a customer project):
#   ${CLAUDE_PLUGIN_DATA:-~/.claude/lt-dev}/peer-ledger/<repo-key>.tsv
#
# Usage:
#   peer-ledger.sh claim   <topic> [detail]   claim a topic for this session
#   peer-ledger.sh release <topic> [detail]   release a claim this session holds
#   peer-ledger.sh note    <topic> <detail>   record a diagnosis
#   peer-ledger.sh read    [--notes-days N]   open claims + recent notes
#   peer-ledger.sh prune   [--days N]         drop entries older than N days
#
# Records are tab-separated (ts, kind, pid, topic, detail); tabs and newlines
# in arguments collapse to spaces, so no escaping layer is needed and a partial
# write can never corrupt a neighbouring record.

set -u

STATE_DIR="${CLAUDE_PLUGIN_DATA:-$HOME/.claude/lt-dev}/peer-ledger"
NOTES_DAYS_DEFAULT=30
PRUNE_DAYS_DEFAULT=30

die() { echo "peer-ledger: $*" >&2; exit 2; }

# One ledger per repository, keyed by the repo root (or the cwd outside a repo).
# The basename keeps the file recognisable; the hash keeps two same-named
# clones apart.
resolve_ledger() {
  local root
  root="$(git rev-parse --show-toplevel 2>/dev/null)" || root=""
  [ -n "$root" ] || root="$PWD"
  root="$(cd "$root" 2>/dev/null && pwd -P)" || root="$PWD"

  local base hash
  base="$(basename "$root" | tr -c 'A-Za-z0-9._-' '-')"
  hash="$(printf '%s' "$root" | cksum | awk '{print $1}')"
  LEDGER_ROOT="$root"
  LEDGER_FILE="$STATE_DIR/${base}-${hash}.tsv"
}

# The session that owns a claim. CLAUDE_PID is the session process; falling back
# to the shell's own PID would bind the claim to a process that exits at once,
# so a missing CLAUDE_PID means claims are recorded as unbound (pid 0) and never
# read as live.
session_pid() { echo "${CLAUDE_PID:-0}"; }

sanitize() { printf '%s' "$1" | tr '\t\n\r' '   ' | sed 's/  */ /g; s/^ *//; s/ *$//'; }

append() {
  local kind="$1" topic="$2" detail="$3"
  mkdir -p "$STATE_DIR" || die "cannot create $STATE_DIR"
  printf '%s\t%s\t%s\t%s\t%s\n' \
    "$(date +%s)" "$kind" "$(session_pid)" "$(sanitize "$topic")" "$(sanitize "$detail")" \
    >> "$LEDGER_FILE"
}

human_age() {
  local secs="$1"
  if   [ "$secs" -lt 3600 ]  ; then echo "$((secs / 60))m ago"
  elif [ "$secs" -lt 86400 ] ; then echo "$((secs / 3600))h ago"
  else                              echo "$((secs / 86400))d ago"
  fi
}

cmd_claim() {
  local topic="${1:-}" detail="${2:-}"
  [ -n "$topic" ] || die "claim needs a topic"

  # Refuse a claim another LIVE session already holds; report it so the caller
  # can coordinate instead of duplicating the work.
  local holder
  holder="$(open_claim_holder "$topic")"
  if [ -n "$holder" ] && [ "$holder" != "$(session_pid)" ]; then
    echo "HELD by pid $holder — do not start; coordinate with that session"
    return 1
  fi

  if [ -n "$holder" ]; then
    echo "ALREADY YOURS $topic"
    return 0
  fi

  append claim "$topic" "$detail"
  echo "CLAIMED $topic"
}

cmd_release() {
  local topic="${1:-}" detail="${2:-}"
  [ -n "$topic" ] || die "release needs a topic"
  append release "$topic" "$detail"
  echo "RELEASED $topic"
}

cmd_note() {
  local topic="${1:-}" detail="${2:-}"
  [ -n "$topic" ] || die "note needs a topic"
  [ -n "$detail" ] || die "note needs a detail (the cause and the fix)"
  append note "$topic" "$detail"
  echo "NOTED $topic"
}

# PID of the session holding an open claim on a topic, empty when free.
# A claim whose session is gone is not a holder: it is stale and takeable.
open_claim_holder() {
  local topic="$1"
  [ -f "$LEDGER_FILE" ] || return 0
  local pid
  pid="$(awk -F'\t' -v t="$(sanitize "$topic")" '
    $4 == t && $2 == "claim"   { held = $3 }
    $4 == t && $2 == "release" { held = "" }
    END { print held }
  ' "$LEDGER_FILE")"
  [ -n "$pid" ] || return 0
  [ "$pid" != "0" ] || return 0
  kill -0 "$pid" 2>/dev/null && echo "$pid"
}

cmd_read() {
  local notes_days="$NOTES_DAYS_DEFAULT"
  while [ $# -gt 0 ]; do
    case "$1" in
      --notes-days) notes_days="${2:-$NOTES_DAYS_DEFAULT}"; shift 2 ;;
      *) shift ;;
    esac
  done

  echo "repo: $LEDGER_ROOT"
  if [ ! -f "$LEDGER_FILE" ]; then
    echo "no ledger yet — nothing claimed, nothing recorded"
    return 0
  fi

  local now; now="$(date +%s)"

  echo ""
  echo "open claims:"
  local any=0
  # awk resolves claim/release pairing by RECORD ORDER (NR), not by timestamp:
  # the log is append-only, and a claim and its release can share a whole
  # second, which would make a timestamp comparison read a re-claim as closed.
  # It emits one line per still-open topic; liveness is decided here, because
  # awk cannot signal a process.
  while IFS=$'\t' read -r ts pid topic detail; do
    [ -n "$topic" ] || continue
    if [ "$pid" != "0" ] && kill -0 "$pid" 2>/dev/null; then
      echo "  [held]  $topic  (pid $pid, $(human_age $((now - ts))))${detail:+  — $detail}"
    else
      echo "  [stale] $topic  (claiming session gone, $(human_age $((now - ts)))) — free to take${detail:+  — $detail}"
    fi
    any=1
  done < <(awk -F'\t' '
    $2 == "claim"   { cn[$4] = NR; cts[$4] = $1; cpid[$4] = $3; cdet[$4] = $5 }
    $2 == "release" { rn[$4] = NR }
    END {
      for (t in cn)
        if (!(t in rn) || rn[t] < cn[t])
          printf "%s\t%s\t%s\t%s\n", cts[t], cpid[t], t, cdet[t]
    }
  ' "$LEDGER_FILE" | sort -n)
  [ "$any" -eq 1 ] || echo "  none"

  echo ""
  echo "notes (last ${notes_days}d):"
  local cutoff=$((now - notes_days * 86400))
  if ! awk -F'\t' -v c="$cutoff" -v now="$now" '
      $2 == "note" && $1 >= c {
        age = now - $1
        unit = age < 3600 ? int(age/60) "m" : (age < 86400 ? int(age/3600) "h" : int(age/86400) "d")
        printf "  %s (%s ago)\n      %s\n", $4, unit, $5
        found = 1
      }
      END { exit found ? 0 : 1 }
    ' "$LEDGER_FILE"; then
    echo "  none"
  fi
}

cmd_prune() {
  local days="$PRUNE_DAYS_DEFAULT"
  while [ $# -gt 0 ]; do
    case "$1" in
      --days) days="${2:-$PRUNE_DAYS_DEFAULT}"; shift 2 ;;
      *) shift ;;
    esac
  done
  [ -f "$LEDGER_FILE" ] || { echo "nothing to prune"; return 0; }
  local cutoff tmp before after
  cutoff=$(( $(date +%s) - days * 86400 ))
  before="$(wc -l < "$LEDGER_FILE" | tr -d ' ')"
  tmp="$LEDGER_FILE.tmp.$$"
  awk -F'\t' -v c="$cutoff" '$1 >= c' "$LEDGER_FILE" > "$tmp" && mv "$tmp" "$LEDGER_FILE"
  after="$(wc -l < "$LEDGER_FILE" | tr -d ' ')"
  echo "pruned $((before - after)) record(s) older than ${days}d"
}

[ $# -ge 1 ] || die "usage: peer-ledger.sh {claim|release|note|read|prune} [args]"
COMMAND="$1"; shift
resolve_ledger

case "$COMMAND" in
  claim)   cmd_claim   "$@" ;;
  release) cmd_release "$@" ;;
  note)    cmd_note    "$@" ;;
  read)    cmd_read    "$@" ;;
  prune)   cmd_prune   "$@" ;;
  *)       die "unknown command: $COMMAND" ;;
esac
