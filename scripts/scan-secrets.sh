#!/usr/bin/env bash
# Sicherheits-Scanner für den ÖFFENTLICHEN Marktplatz claude-code.
# Findet: .env-Dateien, Secrets/Tokens, private Keys, lokale /Users/-Pfade,
# "Kunden-Roster"-Daten (echte Firmennamen mit Rechtsform), Namen der internen Sperrliste
# und neue Eigennamen im Kunden-Kontext. Blockiert Commits/Pushes/CI.
#
# Nutzung:
#   scripts/scan-secrets.sh --staged        # gestagte Dateien (pre-commit)
#   scripts/scan-secrets.sh --range A..B     # Commits eines Push-Bereichs (pre-push)
#   scripts/scan-secrets.sh --all            # gesamter Tree (CI)
#   scripts/scan-secrets.sh file1 file2 …    # konkrete Dateien
#
# Exit 0 = sauber, Exit 1 = Verstoß gefunden.
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT" || exit 2

# ---- Zu prüfende Dateien bestimmen (bash-3.2-kompatibel, ohne mapfile) ---------
mode="${1:---staged}"
RANGE="${2:-HEAD~1..HEAD}"
list_files() {
  case "$mode" in
    --staged) git diff --cached --name-only --diff-filter=ACMR ;;
    --range)  git diff --name-only --diff-filter=ACMR "${2:-HEAD~1..HEAD}" ;;
    --all)    git ls-files ;;
    *)        printf '%s\n' "$@" ;;
  esac
}

# Ausschlüsse: Scanner/Doku selbst, Beispiele, Lockfiles, Binärkram.
is_excluded() {
  case "$1" in
    scripts/scan-secrets.sh|scripts/__tests__/scan-secrets.test.sh|.githooks/*|.github/workflows/secrets-guard.yml) return 0 ;;  # Scanner, seine Tests (erfundene Namen) und Hooks
    .claude/docs-cache/*) return 0 ;;  # extern gecachte Anthropic-Doku (Beispielwerte)
    *.env.example|*.example|*.lock|*.png|*.jpg|*.jpeg|*.gif|*.pdf|*.ico|*.woff*) return 0 ;;
    node_modules/*|*/node_modules/*) return 0 ;;
  esac
  # optionale Allowlist (eine Glob/Pfad pro Zeile)
  if [[ -f .secrets-allow ]]; then
    while IFS= read -r pat; do [[ -z "$pat" || "$pat" == \#* ]] && continue; [[ "$1" == $pat ]] && return 0; done < .secrets-allow
  fi
  return 1
}

violations=0
report() { printf '  ✗ %s\n     → %s\n' "$1" "$2"; violations=$((violations+1)); }

PLACEHOLDER='HIER_|CHANGE_?ME|EXAMPLE|BEISPIEL|MUSTER|<[^>]*>|xxxx|deine?[-_]|dein[-_]|your[-_]|placeholder|\.\.\.|000000'

# ---- Interne Namens-Sperrliste (liegt bewusst NICHT in diesem öffentlichen Repo) ------
# Echte Kunden-/Projektnamen OHNE Rechtsform (Projekt-Kürzel, Ticket-Präfixe) erkennt
# Check 6 nicht. Die Liste liegt im privaten Repo claude-code-internal
# (public-denylist.txt): eine Liste hier würde genau die Namen veröffentlichen, die sie
# schützen soll. Pfad per LT_PUBLIC_DENYLIST überschreibbar. Fehlt die Datei (z. B. in
# CI ohne Zugriff auf das private Repo), wird Check 7 übersprungen und das gemeldet.
# Vorfall 2026-09-25: Kunden- und Projektnamen standen seit v7.6.0 in lt-showroom und
# lt-dev, unbemerkt, weil keiner davon eine Rechtsform trug.
# Dieselbe Liste sperrt interne Infrastruktur (Server-IPs, interne Hosts, Server-/Runner-
# Namen, TurboOps-IDs). Vorfall 2026-10-01: eine Server-IP stand vom 2026-07-18 bis zum
# 2026-08-23 in deploying-to-turboops und ist seitdem in der öffentlichen Historie.
#
# Die Datei allein hinkt hinterher: ein neuer Kunde steht in den lokalen lt-time-Stammdaten,
# lange bevor jemand die Liste neu erzeugt. Darum fragt der Scanner den Generator des privaten
# Repos (--print), der Datei UND lokale Stammdaten zusammenführt. Ohne bun oder ohne den
# Generator gilt die Datei allein. Vorfall 2026-10-06: ein Kundenname stand in einem
# öffentlichen lt-offers-Skill, weil er in den lokalen Stammdaten stand, aber nicht in der Liste.
DENYLIST="${LT_PUBLIC_DENYLIST:-$ROOT/../claude-code-internal/public-denylist.txt}"
DENY_GEN="$(dirname "$DENYLIST")/scripts/build-public-denylist.ts"
DENY_RE=""
if [[ -r "$DENYLIST" ]]; then
  # Nur ein Generator, der --print kennt: ein älterer Checkout ignoriert den Schalter, schreibt die
  # Datei neu und gibt seine Statuszeile aus, die dann als „Muster" die Prüfung lautlos aushebelt.
  if [[ -z "${LT_PUBLIC_DENYLIST:-}" && -f "$DENY_GEN" ]] && grep -q -- "'--print'" "$DENY_GEN" \
      && command -v bun >/dev/null 2>&1; then
    DENY_RE=$(bun "$DENY_GEN" --print | grep -vE '^[[:space:]]*(#|$)' | paste -sd'|' -)
  fi
  [[ -z "$DENY_RE" ]] && DENY_RE=$(grep -vE '^[[:space:]]*(#|$)' "$DENYLIST" | paste -sd'|' -)
fi

while IFS= read -r f; do
  [[ -z "$f" || ! -f "$f" ]] && continue
  is_excluded "$f" && continue
  # Binär überspringen
  if file "$f" | grep -qiE 'binary|executable'; then continue; fi

  base="$(basename "$f")"

  # 1) .env-Dateien (echte, nicht .example)
  if [[ "$base" == ".env" || "$base" == *.env ]]; then
    report "$f" ".env-Datei darf NIE committet werden (nur .env.example)."
    continue
  fi

  # 2) Private Keys
  if grep -qE -- '-----BEGIN [A-Z ]*PRIVATE KEY-----' "$f"; then
    report "$f" "Enthält einen privaten Schlüssel."
  fi

  # 2b) Provider-Token an ihrem Präfix — GitLab, GitHub, npm, Slack, OpenAI/Anthropic.
  #     Bewusst AUCH in Markdown: die .md-Ausnahme unten existiert, weil Tutorials legitim
  #     `API_KEY = "dein-key-hier"` zeigen. Ein Wert mit echtem Provider-Präfix ist dagegen nie
  #     ein Beispiel — diese Präfixe vergibt ausschließlich der Provider.
  #
  #     Der Mindest-Rumpf von 20 Zeichen ist load-bearing: er unterscheidet ein echtes Token von
  #     einer Erwähnung des Präfixes. Ohne ihn schlüge der Guard auf jeder Doku an, die die
  #     Präfixe AUFZÄHLT (z. B. .claude/docs-cache/github-changelog.md, das die GitLab-Familien
  #     `glrt-`, `gloas-`, … listet) — ein Daueralarm, den man wegklickt, ist schlimmer als
  #     kein Alarm.
  #
  #     Anlass: am 2026-08-23 gab ein `git credential fill` beim Debuggen ein echtes glpat- aus.
  #     Es landete in keiner Datei, aber der Guard hätte es auch nicht bemerkt, wenn doch.
  if grep -oE '(glpat|glrt|gloas|glptt|glagent|glimt|glsoat|glcbt|glft|gldt)-[A-Za-z0-9_.-]{20,}' "$f" | grep -q .; then
    report "$f" "Enthält ein GitLab-Token (Provider-Präfix + Wert)."
  fi
  if grep -oE '(gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})' "$f" | grep -q .; then
    report "$f" "Enthält ein GitHub-Token (Provider-Präfix + Wert)."
  fi
  if grep -oE '(npm_[A-Za-z0-9]{30,}|xox[baprs]-[A-Za-z0-9-]{20,}|sk-(ant-)?[A-Za-z0-9_-]{30,})' "$f" | grep -q .; then
    report "$f" "Enthält ein npm-, Slack- oder AI-Provider-Token (Provider-Präfix + Wert)."
  fi

  # Token-/Secret-Checks NICHT in Markdown (Tutorials zeigen legitim Beispielwerte);
  # echte Secrets gehören in .env/Config/Daten, nicht in .md.
  if [[ "$f" != *.md ]]; then
    # 3) Secret-/Token-Zuweisung mit QUOTIERTEM Literal (kein Code-Verweis wie
    #    process.env.X oder keys.secret, kein Platzhalter). Unquotierte Secrets in
    #    .env fängt Check 1 (Dateiname); rohe 32-Hex-Tokens fängt Check 4.
    if grep -inE '(API_?KEY|API_?TOKEN|SECRET|PASSWORD|PASSWD|AUTH_?TOKEN|ACCESS_?TOKEN|PRIVATE_?KEY|CLOCKODO_API_KEY)[[:space:]]*[:=][[:space:]]*["'"'"'][A-Za-z0-9/+_.-]{16,}' "$f" \
        | grep -viE "$PLACEHOLDER|process\.env|import\.meta|\.env\.|getenv" | head -1 | grep -q .; then
      report "$f" "Sieht aus wie ein echter Secret/Token-Wert (quotiertes Literal, kein Platzhalter)."
    fi
    # 4) Freistehende 32-Hex-Tokens (z. B. Clockodo-API-Key = 32 hex). Genau 32,
    #    von Nicht-Hex umgeben → schließt 40-stellige Git-SHAs aus.
    if grep -oE '(^|[^0-9a-zA-Z])[0-9a-f]{32}([^0-9a-zA-Z]|$)' "$f" | grep -q .; then
      report "$f" "Enthält einen 32-stelligen Hex-Token (mögliches API-Secret, z. B. Clockodo)."
    fi
  fi

  # 5) Lokale Benutzerpfade (PII)
  if grep -oE '/Users/[A-Za-z0-9._-]+/' "$f" | grep -qvE '/Users/(runner|user|example)/'; then
    report "$f" "Enthält einen lokalen /Users/<name>/-Pfad (PII/Umgebung)."
  fi

  # 6) Kunden-Roster: ≥3 Firmennamen mit deutscher Rechtsform in EINER Stammdaten-Datei.
  #    Nur .json (echte Roster sind Daten, nicht Doku). Anonyme Beispiele OHNE Rechtsform.
  if [[ "$f" == *.json ]]; then
    hits=$(grep -oE '( GmbH| mbH| GbR| AG"| SE"| KG"| UG"|e\.? ?V\.?|Stiftung)' "$f" 2>/dev/null | wc -l | tr -d ' ')
    if [[ "${hits:-0}" -ge 3 ]]; then
      report "$f" "Sieht aus wie echte Kundendaten ($hits Firmennamen mit Rechtsform). Nur anonymisierte Beispiele (ohne Rechtsform) committen."
    fi
  fi

  # 7) Interne Namens-Sperrliste: echte Kunden-/Projektnamen, auch ohne Rechtsform.
  if [[ -n "$DENY_RE" ]]; then
    hit=$(grep -niwE "$DENY_RE" "$f" 2>/dev/null | head -1 | cut -d: -f1)
    if [[ -n "$hit" ]]; then
      report "$f:$hit" "Enthält einen Eintrag der internen Sperrliste (echter Kunde/Projekt oder interne Infrastruktur). Anonymisieren (z. B. Beispielkunde, ABC-123, shop) bzw. Platzhalter wie <gitlab-host>, <server-ip> verwenden."
    fi
  fi
done < <(list_files "$@")

# 8) Neue Eigennamen im Kunden-Kontext — der Fall, den keine Liste kennen kann.
#    Nur für hinzugefügte Zeilen (--staged, --range) mit einem Kunden-Hinweiswort (customer, Kunde,
#    Kundenprojekt, Auftraggeber …). Kandidaten sind großgeschriebene Wörter, die im bisherigen
#    Repo-Stand nirgends vorkommen, und zwar
#      a) direkt hinter dem Hinweiswort, in jeder Sprache („customer <Name>", „Kundenprojekt <Name>"),
#      b) in englischen Zeilen mitten im Satz, höchstens 15 Wörter vom Hinweiswort entfernt — dort
#         ist ein großgeschriebenes Wort fast immer ein Eigenname.
#    Nie Kandidat: Satzanfänge, Bindestrich-Komposita, Platzhalter (Muster…, Beispiel…). Deutsche
#    Zeilen fallen nur unter a), weil dort jedes Substantiv großgeschrieben ist. Gemessen über die 60
#    Commits vor seiner Einführung: ohne diese Grenzen hätte der Check 6 davon fälschlich blockiert,
#    mit ihnen 2 — beide führten neue deutsche Fachbegriffe in englischem Text ein (Konzeptmappe,
#    Nominalstil). Das ist der Preis: ein neuer Begriff kostet einmal eine word:-Zeile.
#    „client" und „Mandant" fehlen als Hinweiswort bewusst: in technischer Doku (MCP client,
#    Multi-Tenancy) stehen sie neben jedem neuen Produktnamen.
#    Fehlalarm (ein neuer Fachbegriff, kein Name): `word:<Wort>` in .secrets-allow eintragen.
#    Vorfall 2026-10-06: „the <Kunde> concept folder … (in that customer project, not here)".
CUE_RE='customers?|kunde|kundin|kunden[a-zäöüß]*|auftraggeber(in)?|referenzkunden?'
allowed_word() {
  [[ -f .secrets-allow ]] && grep -qixF "word:$1" .secrets-allow
}
# Liest eine Zeile auf stdin, gibt die Kandidaten (a/b oben) aus, einen pro Zeile.
name_candidates() {
  # Zeichenklassen als Variablen statt Regex-Literal mit \047: mawk (CI) und BSD-awk (macOS) lesen
  # Oktal-Escapes in Regex-Literalen nicht gleich.
  awk -v cue="^($CUE_RE)$" -v sq="'" '
    function capital(w) { return w ~ /^[A-Z]/ || w ~ /^(Ä|Ö|Ü)/ }
    function skip(w) { return length(w) < 3 || w ~ /-/ || tolower(w) ~ /^(muster|beispiel|example|sample|acme)/ }
    {
      line = $0; low = tolower(line)
      german = low ~ /(^|[^a-zäöüß])(der|das|und|ist|nicht|für|mit|wird|werden|ein|eine|einen|dem|den|des|im|zum|zur|bei|auf|sich|oder|wir)([^a-zäöüß]|$)/
      n = 0; rest = line; offset = 0
      while (match(rest, /[A-Za-z0-9ÄÖÜäöüß&-]+/)) {
        n++; word[n] = substr(rest, RSTART, RLENGTH); pos[n] = offset + RSTART
        offset += RSTART + RLENGTH - 1; rest = substr(rest, RSTART + RLENGTH)
      }
      for (i = 1; i <= n; i++) {
        w = word[i]
        if (!capital(w) || skip(w) || tolower(w) ~ cue) continue
        # a) directly behind the cue word; only blanks, a colon or quotes may stand between
        gap = i > 1 ? substr(line, pos[i-1] + length(word[i-1]), pos[i] - pos[i-1] - length(word[i-1])) : ""
        after_cue = i > 1 && tolower(word[i-1]) ~ cue && gap ~ ("^[ \t:\"" sq "„“”»«]*$")
        # b) English line, mid-sentence, within 15 words of a cue word
        near_cue = 0
        for (j = i - 15; j <= i + 15; j++) if (j >= 1 && j <= n && j != i && tolower(word[j]) ~ cue) { near_cue = 1; break }
        before = substr(line, 1, pos[i] - 1); sub("[ \t*_`\"" sq "(\\[„“”»«]+$", "", before)
        initial = before == "" || before ~ /[.!?:;|#>]$/ || before ~ /(—|–)$/ || before ~ /(^|[ \t])([-*+]|[0-9]+\.)$/
        if (after_cue || (!german && !initial && near_cue)) print w
      }
    }'
}
check_new_names() {
  local base diff_out file="" lineno=0 line tok
  case "$mode" in
    --staged) base=HEAD; diff_out=$(git diff --cached -U0 --diff-filter=ACMR) ;;
    --range)  base="${RANGE%%..*}"; diff_out=$(git diff -U0 --diff-filter=ACMR "$RANGE") ;;
    *) return 0 ;;
  esac
  git rev-parse -q --verify "$base^{commit}" >/dev/null || return 0
  while IFS= read -r line; do
    case "$line" in
      '+++ b/'*) file="${line#+++ b/}"; continue ;;
      '+++ '*|'--- '*) continue ;;
      '@@ '*) lineno=$(printf '%s' "$line" | sed -E 's/^@@ -[0-9,]+ \+([0-9]+).*/\1/'); continue ;;
      '+'*) ;;
      *) continue ;;
    esac
    line="${line#+}"
    if [[ -n "$file" && "$file" != .secrets-allow ]] && ! is_excluded "$file" \
        && printf '%s' "$line" | grep -qiwE "$CUE_RE"; then
      while IFS= read -r tok; do
        [[ -z "$tok" ]] && continue
        allowed_word "$tok" && continue
        # Scanner und Tests zählen nicht als Wortschatz: ihre Beispielnamen schalten sonst frei.
        git grep -qiwF -e "$tok" "$base" -- . ':(exclude)scripts/scan-secrets.sh' ':(exclude)scripts/__tests__/*' 2>/dev/null && continue
        # shellcheck disable=SC1111  # deutsche Anführungszeichen sind Absicht; ${tok} hält sie aus dem Namen
        report "$file:$lineno" "Neuer Eigenname „${tok}“ neben einem Kunden-Hinweiswort. Kundennamen gehören nicht ins öffentliche Repo: anonymisieren (z. B. Beispielkunde). Sicher kein Kunden- oder Personenname? Dann word:${tok} in .secrets-allow eintragen (öffentlich, im Zweifel Maintainer fragen)."
      done < <(printf '%s\n' "$line" | name_candidates | sort -u)
    fi
    lineno=$((lineno+1))
  done <<< "$diff_out"
}
check_new_names

if [[ "$violations" -gt 0 ]]; then
  printf '\n❌ %s sicherheitsrelevante Fund(e). Commit/Push blockiert.\n' "$violations"
  printf '   Kundendaten/Secrets gehören NICHT in den öffentlichen Marktplatz.\n'
  printf '   Echte Stammdaten leben lokal (~/.lt-time) oder im privaten Repo.\n'
  printf '   Fehlalarm? Datei/Muster in .secrets-allow eintragen (mit Bedacht).\n'
  exit 1
fi
echo "✓ scan-secrets: keine sensiblen Daten gefunden."
[[ -z "$DENY_RE" ]] && echo "  (Check 7 übersprungen: interne Namens-Sperrliste nicht gefunden unter $DENYLIST)" >&2
exit 0
