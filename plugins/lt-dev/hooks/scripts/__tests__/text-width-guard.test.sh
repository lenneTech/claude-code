#!/bin/bash
# Tests for hooks/scripts/text-width-guard.sh — verifies the hint fires when an edit to a .vue
# file adds or moves a max-w-* cap onto text, and stays silent otherwise.
#
# Run: bash hooks/scripts/__tests__/text-width-guard.test.sh
#
# Exits 0 on success, prints failures on stderr.

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
HOOK="$SCRIPT_DIR/text-width-guard.sh"

PASS=0
FAIL=0

if ! command -v jq &>/dev/null; then
  echo "SKIP: jq not installed (the hook is silent without it)"
  exit 0
fi

assert_contains() {
  local actual="$1" needle="$2" label="$3"
  if printf '%s' "$actual" | grep -qF -- "$needle"; then
    PASS=$((PASS + 1)); echo "  ✓ $label"
  else
    FAIL=$((FAIL + 1)); echo "  ✗ $label"
    echo "    expected to contain: $needle"
    echo "    actual: $actual"
  fi
}

assert_silent() {
  local actual="$1" label="$2"
  if [ -z "$actual" ]; then
    PASS=$((PASS + 1)); echo "  ✓ $label"
  else
    FAIL=$((FAIL + 1)); echo "  ✗ $label"
    echo "    expected: silent"
    echo "    actual:   $actual"
  fi
}

# $1 = file path, $2 = old_string, $3 = new_string
run_edit() {
  jq -n --arg f "$1" --arg o "$2" --arg n "$3" \
    '{tool_name:"Edit",tool_input:{file_path:$f,old_string:$o,new_string:$n}}' \
    | LT_SKIP_TEXT_WIDTH_GUARD="" LT_PLUGIN_HOOKS_SKIP="" bash "$HOOK" 2>/dev/null
}

# $1 = file path, $2 = content
run_write() {
  jq -n --arg f "$1" --arg c "$2" '{tool_name:"Write",tool_input:{file_path:$f,content:$c}}' \
    | LT_SKIP_TEXT_WIDTH_GUARD="" LT_PLUGIN_HOOKS_SKIP="" bash "$HOOK" 2>/dev/null
}

PAGE=/project/app/pages/presse.vue

WRAPPED='        <div class="flex max-w-3xl flex-col gap-4">
          <h2 id="logos-title">Das passende Logo für deinen Beitrag</h2>
          <p class="sm:text-lg!">
            Hier findest du das Logo.
          </p>
        </div>'

echo "Case 1: the cap moves from the wrapper onto the paragraph"
MOVED='        <div class="flex flex-col gap-4">
          <h2 id="logos-title">Das passende Logo für deinen Beitrag</h2>
          <p class="max-w-3xl sm:text-lg!">
            Hier findest du das Logo.
          </p>
        </div>'
out=$(run_edit "$PAGE" "$WRAPPED" "$MOVED")
assert_contains "$out" '"hookEventName": "PostToolUse"' "emits PostToolUse context"
assert_contains "$out" 'max-w-3xl sm:text-lg!' "names the capped paragraph"
assert_contains "$out" 'remove the cap instead of moving it' "says to remove, not move"

echo "Case 2: the cap is removed"
REMOVED='        <div class="flex flex-col gap-4">
          <h2 id="logos-title">Das passende Logo für deinen Beitrag</h2>
          <p class="sm:text-lg!">
            Hier findest du das Logo.
          </p>
        </div>'
assert_silent "$(run_edit "$PAGE" "$WRAPPED" "$REMOVED")" "silent when the cap goes"

echo "Case 3: text that leaves its column gets a cap it never had"
OLD_CONTACT='      <div class="container mx-auto grid gap-8 px-4 md:grid-cols-2">
        <div class="flex flex-col gap-4">
          <h2 id="kontakt-title">Du brauchst weiteres Material?</h2>
          <p class="text-lg">Schreib uns.</p>
        </div>'
NEW_CONTACT='      <div class="container mx-auto flex flex-col gap-4 px-4">
        <h2 id="kontakt-title">Du brauchst weiteres Material?</h2>
        <p class="max-w-3xl text-lg">Schreib uns.</p>'
out=$(run_edit "$PAGE" "$OLD_CONTACT" "$NEW_CONTACT")
assert_contains "$out" 'max-w-3xl text-lg' "flags the added paragraph cap"

echo "Case 4: an edit elsewhere keeps an existing wrapper cap unchanged"
OLD_KEEP='        <div class="mx-auto max-w-2xl text-center">
          <h2>Titel</h2>
          <p class="text-lg">Alt</p>'
NEW_KEEP='        <div class="mx-auto max-w-2xl text-center">
          <h2>Titel</h2>
          <p class="text-lg">Neu</p>'
assert_silent "$(run_edit "$PAGE" "$OLD_KEEP" "$NEW_KEEP")" "silent when the cap was already there"

echo "Case 5: a new page with a section intro wrapper cap"
PAGE_NEW='<template>
  <section class="py-16">
    <div class="container mx-auto px-4">
      <div class="mx-auto max-w-2xl text-center">
        <!-- Intro -->
        <h2 class="text-3xl">Pressebereich</h2>
        <p>Alles für deinen Bericht.</p>
      </div>
    </div>
  </section>
</template>'
out=$(run_write "$PAGE" "$PAGE_NEW")
assert_contains "$out" 'max-w-2xl text-center' "flags the wrapper around heading and paragraph"

echo "Case 6: page containers, images and modals stay silent"
PAGE_OK='<template>
  <div class="mx-auto max-w-7xl px-4">
    <h1 class="text-4xl">Presse</h1>
    <p class="text-lg">Alles für deinen Bericht.</p>
    <img src="/logo.svg" alt="Logo" class="max-h-full max-w-full" />
    <NuxtImg src="/team.jpg" alt="Team" class="max-w-sm" />
    <UModal :ui="{ content: '\''max-w-2xl'\'' }" />
  </div>
</template>'
assert_silent "$(run_write "$PAGE" "$PAGE_OK")" "silent for container, images and modal"

echo "Case 7: multi-line tags and arbitrary values"
MULTI='<p
  id="intro"
  class="max-w-[65ch] text-lg"
>Text</p>'
out=$(run_write "$PAGE" "$MULTI")
assert_contains "$out" 'max-w-[65ch]' "flags a cap on a tag that spans lines"

echo "Case 8: files other than .vue are ignored"
assert_silent "$(run_write /project/README.md '<p class="max-w-3xl">x</p>')" "silent for a .md file"

echo "Case 9: opt-out"
out=$(jq -n --arg f "$PAGE" --arg c '<p class="max-w-3xl">x</p>' '{tool_input:{file_path:$f,content:$c}}' \
  | LT_SKIP_TEXT_WIDTH_GUARD=1 bash "$HOOK" 2>/dev/null)
assert_silent "$out" "LT_SKIP_TEXT_WIDTH_GUARD=1 silences it"

echo "Case 10: empty or broken payload fails open"
assert_silent "$(printf '' | bash "$HOOK" 2>/dev/null)" "silent on empty stdin"
assert_silent "$(printf 'not json' | bash "$HOOK" 2>/dev/null)" "silent on invalid JSON"

echo
echo "Passed: $PASS  Failed: $FAIL"
[ "$FAIL" -eq 0 ] || exit 1
exit 0
