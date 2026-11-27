#!/bin/bash
# PostToolUse hook (Write|Edit on *.vue): flag a width cap that an edit puts on text.
#
# The model caps headings, section intros and paragraphs at max-w-2xl / max-w-3xl / max-w-prose
# out of habit ("readable line length"), even when no design and no existing page asks for it.
# When asked to widen a heading, it moves the cap onto the paragraph below instead of removing
# it, and gives a cap to text that loses its narrow column in the same change. The rule lives in
# developing-lt-frontend (Gotchas), but a small layout fix often runs without that skill loaded:
# in the nuxt-text-width-edit eval case the skill loaded in none of 10 runs, with and without the
# rule, and every run moved the cap. With this hook all 5 runs removed it (2026-11-27). It fires at
# the edit itself, so it reaches that case too.
#
# It fires only when the edit adds a text cap that was not in the replaced text: a max-w-* on a
# <p> or <h1>–<h6>, or on an element whose first child is one. Page containers (max-w-5xl and
# wider), images, modals and edits that only remove or keep a cap stay silent.
#
# Not skipped in headless mode: it guards an edit, like protect-files.sh, rather than routing to
# a skill. Fail-open: without jq, or on a payload it cannot read, it stays silent.
# Opt-out: LT_SKIP_TEXT_WIDTH_GUARD=1 (or LT_PLUGIN_HOOKS_SKIP=1 for all lt-dev hooks)

[ -n "${LT_SKIP_TEXT_WIDTH_GUARD:-}" ] && exit 0
[ -n "${LT_PLUGIN_HOOKS_SKIP:-}" ] && exit 0
command -v jq &>/dev/null || exit 0
# Byte-wise matching: the payload carries umlauts and typographic quotes
export LC_ALL=C

# Read hook input from stdin, time-limited (see _read-stdin.sh)
. "${0%/*}/_read-stdin.sh"
read_hook_input 2
INPUT=$HOOK_INPUT
[ -z "$INPUT" ] && exit 0

FILE_PATH=$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
case "$FILE_PATH" in
  *.vue) ;;
  *) exit 0 ;;
esac

# Write carries the whole file in content (nothing replaced), Edit the replaced and the new text.
NEW_TEXT=$(printf '%s' "$INPUT" | jq -r '.tool_input.new_string // .tool_input.content // empty' 2>/dev/null)
OLD_TEXT=$(printf '%s' "$INPUT" | jq -r '.tool_input.old_string // empty' 2>/dev/null)
[ -z "$NEW_TEXT" ] && exit 0

CAP='max-w-(prose|xs|sm|md|lg|xl|2xl|3xl|4xl|\[[^]]*\])'
# A cap on the text element itself, or on an element whose first child is a heading or paragraph.
TEXT_CAP_RE="<(p|h[1-6])[[:space:]][^>]*${CAP}"
WRAPPER_CAP_RE="${CAP}[^>]*>[[:space:]]*(<!--[^>]*-->[[:space:]]*)?<(p|h[1-6])[[:space:]>]"

# Tags span lines, so match on the flattened text. A hit is the whole capped <p>/<h*> tag, or the
# wrapper's classes from the cap up to its first child.
hits_in() {
  printf '%s' "$1" | tr '\n\r\t' '   ' \
    | grep -oE "${TEXT_CAP_RE}[^>]*>|${WRAPPER_CAP_RE}" 2>/dev/null \
    | sed -E 's/[[:space:]]+/ /g'
}

# Old and new hits are compared by key: a capped tag up to its cap, so changing another class on an
# already capped paragraph stays silent, while a cap that moved from the wrapper onto the paragraph
# is a new key. Keys are counted, not just collected: three intros that each get the cap one
# paragraph elsewhere already had are three new caps.
key_of() {
  case "$1" in
    "<"*) printf '%s\n' "$1" | sed -E "s/(${CAP}).*/\1/" ;;
    *) printf '%s\n' "$1" ;;
  esac
}

NEW_HITS=$(hits_in "$NEW_TEXT")
[ -z "$NEW_HITS" ] && exit 0
OLD_KEYS=$(hits_in "$OLD_TEXT" | while IFS= read -r hit; do key_of "$hit"; done)
NEW_KEYS=$(printf '%s\n' "$NEW_HITS" | while IFS= read -r hit; do key_of "$hit"; done)

ADDED=""
while IFS= read -r hit; do
  [ -z "$hit" ] && continue
  key=$(key_of "$hit")
  new_count=$(printf '%s\n' "$NEW_KEYS" | grep -cxF -- "$key")
  old_count=$(printf '%s\n' "$OLD_KEYS" | grep -cxF -- "$key")
  [ "$new_count" -le "$old_count" ] && continue
  ADDED="${ADDED}${hit}"$'\n'
done <<EOF
$NEW_HITS
EOF
[ -z "$ADDED" ] && exit 0

SHOWN=$(printf '%s' "$ADDED" | awk '!seen[$0]++' | head -3 | cut -c1-120 | sed 's/^/  /')

CONTEXT="Text width check: this edit puts a max-w-* on a heading or paragraph, or on the element around one:
${SHOWN}
Text runs as wide as its container unless a source asks for a cap: the design shows it, the project's existing pages cap the same kind of text, or it is long single-column running text (article body, legal page). If the task was to make something wider, remove the cap instead of moving it to the neighbouring element, and do not give one to text that just lost its narrow column. Without a source, remove the cap now; if you keep it on your own judgement, name it in your handover as an open question, not as a fact. Details: developing-lt-frontend, Gotchas."

jq -n --arg ctx "$CONTEXT" '{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":$ctx}}'
exit 0
