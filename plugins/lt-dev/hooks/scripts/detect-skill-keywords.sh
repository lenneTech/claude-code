#!/bin/bash
# Skip in non-interactive headless mode (claude -p)
. "${0%/*}/_headless-skip.sh"
# Sets PROMPT from the hook payload on stdin
. "${0%/*}/_read-prompt.sh"
# Background task / subagent notifications arrive as prompts too: skip them
. "${0%/*}/_skip-task-notification.sh"

# Names the matching lt-dev skill when a prompt carries its vocabulary, independent of the
# skill listing.
#
# Claude Code lists skill descriptions within a character budget of 1 % of the context window,
# shared by every installed plugin. On overflow it drops the descriptions of the least-used
# skills first, and a skill without its description is rarely chosen on its own. The skills in
# this table are the ones no other detector names and no command loads by itself, so this hook
# is their route that works whatever the budget, the model or the user's settings.
#
# One table, one process per prompt: a new skill is one more row, not one more hook entry.
# Each row is "skill|pattern|topic". The pattern is an extended regex matched against the
# prompt in lowercase (ASCII only, so a capital umlaut stays: write Ä/Ö/Ü forms explicitly).

[ -z "$PROMPT" ] && exit 0
# Skip slash commands — they have their own skill associations
[[ "$PROMPT" == /* ]] && exit 0

TABLE='deploying-to-turboops|turbo-?ops|turbo deploy|not found in registry|promotion[- ]?stage|only (the )?app rolled out|TurboOps deployment
rebasing-branches|(^|[^a-z])rebas(e|en|ed|es|ing)?([^a-z]|$)|merge[- ]?konflikt|merge conflicts?|konflikte (lösen|auflösen|beheben)|commits? hinter (dev|develop|main)|commits? behind (dev|develop|main)|branch (aktualisieren|auf (den )?(aktuellen )?stand)|rebasing a feature branch
validating-ci-pipelines-locally|pipeline[a-z]{0,12} [a-z ]{0,20}lokal|lokal[a-z]{0,12} [a-z ]{0,20}(pipeline|ci-?job)|(pipeline|ci job|ci)s? locally|locally [a-z ]{0,20}(pipeline|ci job)|gitlab-runner|(failt|scheitert|schlägt) [a-z ]{0,15}(ci|pipeline)|(ci|pipeline) [a-z ]{0,15}(failt|scheitert|schlägt fehl)|why (does|is) (the )?(ci|pipeline) fail|running a CI pipeline locally
running-load-tests-with-k6|(^|[^a-z0-9])k6([^a-z0-9]|$)|last-?tests?|load[- ]?tests?|stress[- ]?tests?|soak[- ]?tests?|unter last|under (heavy )?load|concurrent users|gleichzeitige[n]? (nutzer|user)|load testing
cleaning-up-disk-space|festplatte|speicherplatz|disk (is )?(full|space)|(platz|speicher) (schaffen|freigeben|frei machen)|speicher (ist )?(fast )?voll|out of disk|no space left|pnpm store (ist )?(riesig|zu groß|huge|too big)|docker belegt|node_modules aufräumen|was belegt|freeing disk space
contributing-to-lt-framework|(pnpm|npm) link|(ins|im|in das|in the|into the) grund-?repo|(nest-server|nuxt-extensions)[a-z ]{0,30}(lokal|locally)|lokale[nrs]? (version (von|of) )?(nest-server|nuxt-extensions)|framework lokal|developing the lt framework libraries locally
modernizing-toolchain|(jest|eslint|prettier)[a-z ,/+-]{0,30}(vitest|oxlint|oxfmt)|(jest|eslint|prettier)[a-z ,/+-]{0,40}(umstellen|ablösen|ersetzen|migrieren|replace|migrate)|toolchain [a-z ]{0,30}(stand|modernis|moderniz|migr|umstell|aktualis|updat)|err_socket_bad_port|migrating the toolchain to vitest, oxlint and oxfmt
validating-production-readiness|produktionsreif|production[- ]?read(y|iness)|ready for production|go[- ]?live|kann (das|es) live|bereit für (die )?produktion|a production-readiness check
maintaining-lt-stack|stack[- ]?release|release all (the )?base repos|(grund-?repos|base repos)[a-z ]{0,40}(aktualisier|releas|veröffentlich|maintain|neuesten stand)|alle [a-z ]{0,10}grund-?repos|maintaining and releasing the lt base repos
unslop|(^|[^a-z])unslop|entschwurbel|klingt [a-z ]{0,20}(nach|wie) (ki|ai|chatgpt|einer ki)|sounds [a-z ]{0,20}like (ai|chatgpt|a bot)|ki-?sprech|ai[- ]?slop|ai tells|menschlicher (klingen|machen|formulieren)|mach [a-z ]{0,20}menschlicher|removing AI tells from text
validating-changes-in-browser|im browser (prüfen|testen|checken|validieren|durchklicken|ansehen)|im browser [a-z ]{0,20}(durch|prüf|test|check|anseh)|(prüf|test|check)[a-z]{0,12} [a-z ]{0,25}im browser|durchklicken|klick[a-z]{0,12} [a-z ]{0,30}durch([^a-z]|$)|browser[- ]?walk|(check|test|verify|validate)[a-z]{0,12} [a-z ]{0,25}in the browser|click through|a browser validation walk
checking-upstream-first|workaround|work-around|monkey-?patch|patch-package|wir bauen (uns )?[a-z ]{0,25}selbst|eigene[nrs]? (lösung|workaround|wrapper|shim|polyfill)|(shim|polyfill) (bauen|schreiben)|building a workaround around a dependency'

# One lowercase line, so a phrase broken across lines still matches.
PROMPT_LC=$(printf '%s' "$PROMPT" | tr '\n\r\t' '   ' | tr '[:upper:]' '[:lower:]')

# Remove this plugin's own names and paths first: a prompt about editing the rebasing-branches
# skill, or one that quotes evals/trigger/disk-cleanup/prompt.md, is plugin development and
# must not fire the skill it names. Only hyphenated skill names are removed: a one-word name
# such as "unslop" is also the word users type to ask for the skill.
SKILL_NAMES=$(printf '%s\n' "$TABLE" | cut -d'|' -f1 | grep -- '-' | paste -sd'|' -)
PROMPT_LC=$(printf '%s\n' "$PROMPT_LC" | sed -E \
  -e 's#(plugins|skills|commands|agents|hooks|evals)/[^[:space:]]*##g' \
  -e 's#lt-dev:[a-z0-9:-]+##g' \
  -e "s#(${SKILL_NAMES})##g")

CONTEXT=""
while IFS= read -r row; do
  [ -z "$row" ] && continue
  skill=${row%%|*}
  rest=${row#*|}
  topic=${rest##*|}
  pattern=${rest%|*}
  # Bash's built-in ERE match: no process per row, so the whole table costs one prompt read.
  if [[ "$PROMPT_LC" =~ $pattern ]]; then
    line="Skill hint (lt-dev): this request looks like ${topic}, which the ${skill} skill covers. Load the ${skill} skill with the Skill tool before acting."
    CONTEXT="${CONTEXT:+$CONTEXT\\n}$line"
  fi
done <<EOF
$TABLE
EOF

[ -z "$CONTEXT" ] && exit 0
printf '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"%s"}}\n' "$CONTEXT"
exit 0
