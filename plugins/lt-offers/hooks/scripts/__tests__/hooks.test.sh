#!/bin/bash
# Tests for the lt-offers hooks:
# - the plugin registers only its prompt detector; it keeps no context tied to the
#   platform's own source tree, so nothing fires differently inside that repository
# - detect-offers-project.sh ignores <task-notification> turns and the marketplace's
#   own plugin names / paths, so neither the keyword guard nor the demo-stage check
#   can fire on text the user did not write
# - the prompt comes from the stdin payload only (no CLAUDE_USER_PROMPT fallback), and
#   without jq it is still read in full across escaped quotes and newlines
# - detect-offers-project.sh fires only on offers intent named in the prompt; generic
#   analytics and UI words stay quiet in every project, and the demo stage needs a
#   user-written "demo"
#
# Run: bash hooks/scripts/__tests__/hooks.test.sh
#
# Exits 0 on success, prints failures on stdout.

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
HOOKS_JSON="$SCRIPT_DIR/../hooks.json"

PASS=0
FAIL=0

pass() { PASS=$((PASS + 1)); echo "  ✓ $1"; }
fail() { FAIL=$((FAIL + 1)); echo "  ✗ $1"; }

assert_contains() {
  if printf '%s' "$1" | grep -qF -- "$2"; then pass "$3"; else fail "$3"; echo "    expected to contain: $2"; echo "    actual: $1"; fi
}
assert_not_contains() {
  if printf '%s' "$1" | grep -qF -- "$2"; then fail "$3"; echo "    expected NOT to contain: $2"; echo "    actual: $1"; else pass "$3"; fi
}
assert_silent() {
  if [ -z "$1" ]; then pass "$2"; else fail "$2"; echo "    expected: silent"; echo "    actual: $1"; fi
}
# $1 = hook output, $2 = expected hookEventName, $3 = text additionalContext must contain, $4 = label
assert_hook_output() {
  local got
  got=$(printf '%s' "$1" | node -e '
    const o = JSON.parse(require("fs").readFileSync(0, "utf8")).hookSpecificOutput;
    process.stdout.write(o.hookEventName + "\n" + o.additionalContext);' 2>/dev/null)
  if [ "$(printf '%s' "$got" | head -1)" = "$2" ] && printf '%s' "$got" | grep -qF -- "$3"; then
    pass "$4"
  else
    fail "$4"; echo "    expected hookEventName $2 with context containing: $3"; echo "    actual: $1"
  fi
}

TMP_ROOT="$(mktemp -d)"
trap 'rm -rf "$TMP_ROOT"' EXIT

# A PATH without jq, so the scripts take their grep/sed fallback.
NOJQ_BIN="$TMP_ROOT/nojq-bin"; mkdir -p "$NOJQ_BIN"
for t in cat grep head sed tr; do
  printf '#!/bin/sh\nexec "%s" "$@"\n' "$(command -v "$t")" > "$NOJQ_BIN/$t"
  chmod +x "$NOJQ_BIN/$t"
done

prompt_payload() {
  node -e 'process.stdout.write(JSON.stringify({ hook_event_name: "UserPromptSubmit", prompt: process.argv[1] }))' "$1"
}

# $1 = script, $2 = project dir; payload on stdin. CLAUDE_USER_PROMPT is cleared unless
# a test sets it through EXTRA_PROMPT_ENV.
run_script() {
  local extra=()
  [ -n "${EXTRA_PROMPT_ENV:-}" ] && extra=("CLAUDE_USER_PROMPT=$EXTRA_PROMPT_ENV")
  env -u CLAUDE_USER_PROMPT CLAUDE_CODE_ENTRYPOINT= LT_PLUGIN_HOOKS_SKIP= \
    ${extra[@]+"${extra[@]}"} \
    CLAUDE_PROJECT_DIR="$2" PATH="${HOOK_PATH:-$PATH}" "$BASH" "$SCRIPT_DIR/$1" 2>/dev/null
}
detect() { prompt_payload "$2" | run_script detect-offers-project.sh "$1"; }

# A checkout of the offers platform itself: the hook must behave there exactly as elsewhere.
OFFERS="$TMP_ROOT/offers"
mkdir -p "$OFFERS/projects/api/src/server/modules/offer"
touch "$OFFERS/projects/api/src/server/modules/offer/offer.service.ts"

OTHER="$TMP_ROOT/other"
mkdir -p "$OTHER"

NOTE='<task-notification><task-id>a1b2</task-id><status>completed</status><result>Reviewed plugins/lt-offers and plugins/lt-showroom hooks; the Angebot demo flow works.</result></task-notification>'

echo "hooks.json: only the prompt detector is registered"
REG=$(node -e '
  const h = JSON.parse(require("fs").readFileSync(0, "utf8")).hooks;
  const cmds = Object.values(h).flat().flatMap((g) => g.hooks.map((x) => x.command || ""));
  console.log([
    Object.keys(h).join(","),
    cmds.some((c) => c.includes("detect-offers-project.sh")) ? "detect:yes" : "detect:no",
    cmds.length,
  ].join(" "));' < "$HOOKS_JSON")
assert_contains "$REG" "UserPromptSubmit detect:yes 1" "UserPromptSubmit runs detect-offers-project.sh and nothing else"
assert_hook_output "$(detect "$OTHER" 'erstelle ein Angebot für den Kunden')" "UserPromptSubmit" "creating-offers" "UserPromptSubmit output shape"
assert_hook_output "$(HOOK_PATH="$NOJQ_BIN" detect "$OTHER" 'erstelle ein Angebot für den Kunden')" "UserPromptSubmit" "creating-offers" "UserPromptSubmit output shape without jq"

echo "detect-offers-project.sh: genuine prompts"
OUT=$(detect "$OFFERS" 'erstelle ein Angebot für den Kunden')
assert_contains "$OUT" "Offer-related keywords detected" "offer prompt fires inside the platform checkout too"
assert_contains "$OUT" "Default stage" "no demo mention routes to production"
assert_contains "$(detect "$OFFERS" 'erstelle ein Angebot auf der Demo')" "Demo stage requested" "a user-written demo mention routes to demo"
assert_contains "$(detect "$OTHER" 'erstelle ein Angebot für den Kunden')" "Offer-related keywords detected" "offer prompt outside the project still fires"
assert_contains "$(detect "$OFFERS" '/lt-offers:create-offer für Muster-Kunde')" "Offer-related keywords detected" "the plugin's own slash command still fires"

echo "detect-offers-project.sh: system-generated turns"
assert_silent "$(detect "$OFFERS" "$NOTE")" "task-notification turn is ignored"
assert_silent "$(HOOK_PATH="$NOJQ_BIN" detect "$OFFERS" "$NOTE")" "task-notification turn is ignored without jq"

echo "detect-offers-project.sh: marketplace self-references"
assert_silent "$(detect "$OTHER" 'bump the lt-offers version')" "plugin name alone does not fire"
assert_silent "$(detect "$OTHER" 'review plugins/lt-offers/skills/creating-offers/SKILL.md')" "plugin path alone does not fire"
OUT=$(detect "$OFFERS" 'erstelle ein Angebot, Notizen in plugins/lt-offers/skills/demo-notes.md')
assert_contains "$OUT" "Default stage" "demo inside a plugin path does not route to demo"
assert_not_contains "$OUT" "Demo stage requested" "demo inside a plugin path is not a demo request"
OUT=$(detect "$OFFERS" 'erstelle ein Angebot mit lt-offers')
assert_contains "$OUT" "Default stage" "genuine offer prompt that names the plugin still fires"

echo "detect-offers-project.sh: generic words stay quiet in every project"
assert_silent "$(detect "$OTHER" 'add analytics for page views and downloads')" "analytics / views / downloads"
assert_silent "$(detect "$OTHER" 'fix the scroll position in the sources panel')" "scroll / sources"
assert_silent "$(detect "$OTHER" 'update the knowledge base briefing and the pricing template')" "knowledge base / briefing / pricing / template"
assert_silent "$(detect "$OTHER" 'show Aufrufe und Verweildauer in der Statistik')" "German analytics words"
assert_silent "$(detect "$OTHER" 'the API offers a pagination option, which this offers too')" "offer used as a verb"
assert_silent "$(detect "$OTHER" 'set up demo data for the unit test')" "demo alone"
assert_silent "$(detect "$OFFERS" 'refactor the views and downloads helpers')" "views / downloads stay quiet even in the offers project"
assert_silent "$(detect "$OFFERS" 'set up demo data for the unit test')" "demo alone stays quiet in the offers project"

assert_silent "$(detect "$OFFERS" 'show Aufrufe und Verweildauer in der Statistik')" "German analytics words stay quiet in the platform checkout"
assert_silent "$(detect "$OFFERS" 'add a pricing table content block')" "pricing table / content block stay quiet in the platform checkout"

echo "detect-offers-project.sh: offers intent fires anywhere"
assert_contains "$(detect "$OTHER" 'Erstelle ein Angebot für Beispielkunde')" "Offer-related keywords detected" "German: Angebot"
assert_contains "$(detect "$OTHER" 'Die Angebote von Muster-Kunde aktualisieren')" "Offer-related keywords detected" "German: Angebote"
assert_contains "$(detect "$OTHER" 'create an offer for Beispielkunde')" "Offer-related keywords detected" "English: an offer"
assert_contains "$(detect "$OTHER" 'draft a new offer with a pricing table')" "Offer-related keywords detected" "English: a new offer"
assert_contains "$(detect "$OTHER" 'add a pricing-table block')" "Offer-related keywords detected" "distinctive content block type"
assert_contains "$(detect "$OTHER" 'check angebote.lenne.tech')" "Offer-related keywords detected" "offers platform domain"
assert_contains "$(detect "$OTHER" '/lt-offers:create-offer für Muster-Kunde')" "Offer-related keywords detected" "/lt-offers:create-offer outside the project"
assert_contains "$(detect "$OTHER" '/lt-offers:offers:create Muster-Kunde')" "Offer-related keywords detected" "/lt-offers:offers:create"
assert_silent "$(detect "$OTHER" 'the docs for /lt-offers:offers:create need a typo fix')" "a mid-prompt mention of the command is not an invocation"

echo "detect-offers-project.sh: demo stage only on request"
assert_contains "$(detect "$OTHER" 'create an offer on the demo stage')" "Demo stage requested" "English demo request"
assert_contains "$(detect "$OTHER" 'Angebot auf demo-angebote.lenne.tech anlegen')" "Demo stage requested" "demo platform domain"
assert_contains "$(detect "$OTHER" '/lt-offers:create-offer demo')" "Demo stage requested" "slash command with demo"
OUT=$(detect "$OTHER" 'erstelle ein Demonstrations-Angebot')
assert_contains "$OUT" "Default stage" "Demonstrations-Angebot stays on production"
assert_not_contains "$OUT" "Demo stage requested" "Demonstrations-Angebot is not a demo request"

echo "detect-offers-project.sh: prompt parsing without jq"
# JSON.stringify escapes the quotes and the newline; a plain "[^"]*" match stopped at
# the first \" and never saw the rest of the prompt.
ESCAPED=$(printf 'Kunde schrieb "bitte dringend"\nErstelle ein Angebot auf der Demo')
OUT=$(HOOK_PATH="$NOJQ_BIN" detect "$OTHER" "$ESCAPED")
assert_contains "$OUT" "Demo stage requested" "without jq: text after an escaped quote and a newline is read"
assert_silent "$(HOOK_PATH="$NOJQ_BIN" detect "$OTHER" "$(printf 'the "views" and "downloads"\nare slow')")" "without jq: generic words stay quiet"
assert_contains "$(HOOK_PATH="$NOJQ_BIN" detect "$OTHER" "$(printf 'Kunde: "A"\ncreate an offer')")" "Default stage" "without jq: English offer after an escaped quote, default stage"

echo "detect-offers-project.sh: prompt source"
assert_silent "$(printf '{"hook_event_name":"UserPromptSubmit","prompt":""}' | EXTRA_PROMPT_ENV='erstelle ein Angebot auf der demo' run_script detect-offers-project.sh "$OFFERS")" "CLAUDE_USER_PROMPT is not read"

echo ""
echo "─────────────────────────────────────────"
echo "Total: $((PASS + FAIL)) | Passed: $PASS | Failed: $FAIL"
[ "$FAIL" -gt 0 ] && exit 1 || exit 0
