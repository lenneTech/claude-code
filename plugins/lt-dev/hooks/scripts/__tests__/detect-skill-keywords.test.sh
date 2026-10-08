#!/bin/bash
# Tests for detect-skill-keywords.sh, the keyword table that names a skill to Claude without
# going through the skill listing. Every row must fire on the phrases its skill is for and stay
# silent on everything else; system turns, slash commands and the plugin's own names never fire.
#
# Run: bash hooks/scripts/__tests__/detect-skill-keywords.test.sh
#
# Exits 0 on success, prints failures on stdout.

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
EVAL_DIR="$(cd "$SCRIPT_DIR/../../evals/trigger" && pwd)"
HOOK="$SCRIPT_DIR/detect-skill-keywords.sh"

PASS=0
FAIL=0

pass() { PASS=$((PASS + 1)); echo "  ✓ $1"; }
fail() { FAIL=$((FAIL + 1)); echo "  ✗ $1"; }

TMP_ROOT="$(mktemp -d)"
trap 'rm -rf "$TMP_ROOT"' EXIT

# A PATH without jq, so _read-prompt.sh takes its grep/sed fallback.
NOJQ_BIN="$TMP_ROOT/nojq-bin"; mkdir -p "$NOJQ_BIN"
for t in cat grep head sed tr; do
  printf '#!/bin/sh\nexec "%s" "$@"\n' "$(command -v "$t")" > "$NOJQ_BIN/$t"
  chmod +x "$NOJQ_BIN/$t"
done

payload() {
  node -e 'process.stdout.write(JSON.stringify({ hook_event_name: "UserPromptSubmit", prompt: process.argv[1] }))' "$1"
}

# $1 = prompt. Runs the hook the way Claude Code does: payload on stdin, interactive entrypoint.
run_hook() {
  payload "$1" | env -u CLAUDE_USER_PROMPT CLAUDE_CODE_ENTRYPOINT= LT_PLUGIN_HOOKS_SKIP= \
    CLAUDE_PROJECT_DIR="$TMP_ROOT" PATH="${HOOK_PATH:-$PATH}" "$BASH" "$HOOK" 2>/dev/null
}

# The additionalContext of a hook output, or "INVALID-JSON" when the output does not parse.
context_of() {
  [ -z "$1" ] && return 0
  printf '%s' "$1" | node -e '
    let o;
    try { o = JSON.parse(require("fs").readFileSync(0, "utf8")); } catch { process.stdout.write("INVALID-JSON"); process.exit(0); }
    process.stdout.write(o.hookSpecificOutput.additionalContext)'
}

# $1 = expected skill, $2 = prompt
expect_skill() {
  local ctx
  ctx=$(context_of "$(run_hook "$2")")
  if printf '%s' "$ctx" | grep -qF -- "the $1 skill"; then pass "$1 ← $2"; else fail "$1 ← $2"; echo "    actual: ${ctx:-<silent>}"; fi
}

# $1 = prompt
expect_silent() {
  local out
  out=$(run_hook "$1")
  if [ -z "$out" ]; then pass "silent: $1"; else fail "silent: $1"; echo "    actual: $(context_of "$out")"; fi
}

echo "each row fires on its own vocabulary (German and English)"
expect_skill deploying-to-turboops 'Ich will unser Projekt auf TurboOps live bringen'
expect_skill deploying-to-turboops 'turbo deploy says the image was not found in registry'
expect_skill deploying-to-turboops 'Wie richte ich die .turboops.json ein?'
expect_skill rebasing-branches 'Mein Branch ist 40 Commits hinter dev, bitte rebasen'
expect_skill rebasing-branches 'rebase my feature branch onto develop'
expect_skill rebasing-branches 'Ich habe Merge-Konflikte, kannst du die lösen?'
expect_skill validating-ci-pipelines-locally 'Kannst du die GitLab-Pipeline lokal laufen lassen?'
expect_skill validating-ci-pipelines-locally 'warum failt die CI bei api:test?'
expect_skill validating-ci-pipelines-locally 'run the gitlab-runner job for the build stage'
expect_skill running-load-tests-with-k6 'Schreib einen k6-Test für den Login'
expect_skill running-load-tests-with-k6 'Hält die API das unter Last aus? Mach einen Lasttest'
expect_skill running-load-tests-with-k6 'run a load test with 10 concurrent users'
expect_skill cleaning-up-disk-space 'Meine Festplatte ist fast voll'
expect_skill cleaning-up-disk-space 'no space left on device when building'
expect_skill cleaning-up-disk-space 'Der pnpm store ist riesig, schaff Platz'
expect_skill contributing-to-lt-framework 'Ich will die Änderung in nest-server per pnpm link im Starter testen'
expect_skill contributing-to-lt-framework 'Der Fix gehört eigentlich ins Grund-Repo'
expect_skill contributing-to-lt-framework 'test my nuxt-extensions change locally in the starter'
expect_skill modernizing-toolchain 'Stell das Projekt von jest auf vitest um'
expect_skill modernizing-toolchain 'migrate eslint and prettier to oxlint and oxfmt'
expect_skill modernizing-toolchain 'Nitro crasht mit ERR_SOCKET_BAD_PORT'
expect_skill validating-production-readiness 'Ist das produktionsreif?'
expect_skill validating-production-readiness 'Können wir nächste Woche Go-Live machen?'
expect_skill validating-production-readiness 'is this production ready?'
expect_skill maintaining-lt-stack 'Mach einen Stack-Release für alle Grund-Repos'
expect_skill maintaining-lt-stack 'Grund-Repos aktualisieren und veröffentlichen'
expect_skill maintaining-lt-stack 'release all base repos'
expect_skill unslop 'Der Text klingt nach KI, bitte entschwurbeln'
expect_skill unslop 'unslop this README'
expect_skill unslop 'this paragraph sounds like ChatGPT'
expect_skill validating-changes-in-browser 'Prüf das bitte im Browser'
expect_skill validating-changes-in-browser 'Klick die neue Seite einmal durch'
expect_skill validating-changes-in-browser 'verify the change in the browser'
expect_skill checking-upstream-first 'Ich bau mir dafür einen Workaround um den MailService'
expect_skill checking-upstream-first 'monkey-patch the library so the header survives'
expect_skill checking-upstream-first 'Wir bauen uns den Upload selbst'

echo "near misses and unrelated prompts stay silent"
for p in 'what time is it' 'Erklär mir den Unterschied zwischen TCP und UDP' \
         'the database is under heavy maintenance tonight' 'rename the base class' \
         'add a load balancer to the compose file' 'the browser tab title is wrong' \
         'Füg ein Feld für die Rechnungsnummer hinzu' 'fix the failing unit test in user.service' \
         'deploy the docs to the wiki' 'patch the version in package.json' \
         'the job queue retries three times' 'run pnpm run check' 'where is the stack trace' \
         'check the slope of the chart' 'release notes for the customer'; do
  expect_silent "$p"
done

echo "several matching rows are all named, in one valid JSON object"
CTX=$(context_of "$(run_hook 'Rebase den Branch und prüf das danach im Browser')")
if printf '%s' "$CTX" | grep -qF 'the rebasing-branches skill' && printf '%s' "$CTX" | grep -qF 'the validating-changes-in-browser skill'; then
  pass "two rows fire together"
else
  fail "two rows fire together"; echo "    actual: $CTX"
fi

echo "system turns, slash commands, headless runs and the plugin's own names never fire"
NOTE='<task-notification><task-id>a1</task-id><status>completed</status><result>rebased onto dev, ran the k6 load test, disk is full, workaround added</result></task-notification>'
expect_silent "$NOTE"
expect_silent '/lt-dev:git:rebase onto dev'
expect_silent 'tighten the description of plugins/lt-dev/skills/rebasing-branches/SKILL.md'
expect_silent 'the running-load-tests-with-k6 and cleaning-up-disk-space skills need shorter descriptions'
expect_silent 'review evals/trigger/disk-cleanup/prompt.md'
expect_silent 'lt-dev:validating-production-readiness should keep its NOT boundary'
OUT=$(payload 'rebase onto dev' | env CLAUDE_CODE_ENTRYPOINT=sdk-cli CLAUDE_PROJECT_DIR="$TMP_ROOT" "$BASH" "$HOOK" 2>/dev/null)
if [ -z "$OUT" ]; then pass "headless (claude -p) stays silent"; else fail "headless (claude -p) stays silent"; fi
OUT=$(payload 'rebase onto dev' | env CLAUDE_CODE_ENTRYPOINT= LT_PLUGIN_HOOKS_SKIP=1 CLAUDE_PROJECT_DIR="$TMP_ROOT" "$BASH" "$HOOK" 2>/dev/null)
if [ -z "$OUT" ]; then pass "LT_PLUGIN_HOOKS_SKIP stays silent"; else fail "LT_PLUGIN_HOOKS_SKIP stays silent"; fi

echo "without jq"
HOOK_PATH="$NOJQ_BIN" expect_skill rebasing-branches 'bitte "rebase" auf dev'

echo "every trigger-eval prompt for a table skill fires one of the skills its grader accepts"
# The eval runs headless, so hooks never fire there; this ties the hook to the same phrasing.
for dir in "$EVAL_DIR"/*/; do
  grader="$dir/graders/skill-fired.md"
  [ -f "$grader" ] || continue
  accepted=""
  for skill in deploying-to-turboops rebasing-branches validating-ci-pipelines-locally running-load-tests-with-k6 \
               cleaning-up-disk-space contributing-to-lt-framework modernizing-toolchain validating-production-readiness \
               maintaining-lt-stack unslop validating-changes-in-browser checking-upstream-first; do
    grep -qE "[\"(|:?]$skill[\")|]" "$grader" && accepted="$accepted $skill"
  done
  [ -z "$accepted" ] && continue
  prompt=$(awk 'f>=2{print} /^---$/{f++}' "$dir/prompt.md" | tr '\n' ' ')
  ctx=$(context_of "$(run_hook "$prompt")")
  hit=""
  for skill in $accepted; do printf '%s' "$ctx" | grep -qF "the $skill skill" && hit=$skill; done
  if [ -n "$hit" ]; then pass "$(basename "$dir") → $hit"; else fail "$(basename "$dir") → one of:$accepted"; echo "    actual: ${ctx:-<silent>}"; fi
done

echo ""
echo "─────────────────────────────────────────"
echo "Total: $((PASS + FAIL)) | Passed: $PASS | Failed: $FAIL"
[ "$FAIL" -gt 0 ] && exit 1 || exit 0
