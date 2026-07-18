#!/usr/bin/env bash
# Sicherheits-Scanner für den ÖFFENTLICHEN Marktplatz claude-code.
# Findet: .env-Dateien, Secrets/Tokens, private Keys, lokale /Users/-Pfade und
# "Kunden-Roster"-Daten (echte Firmennamen mit Rechtsform). Blockiert Commits/Pushes/CI.
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
    scripts/scan-secrets.sh|.githooks/*|.github/workflows/secrets-guard.yml) return 0 ;;
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
done < <(list_files "$@")

if [[ "$violations" -gt 0 ]]; then
  printf '\n❌ %s sicherheitsrelevante Fund(e). Commit/Push blockiert.\n' "$violations"
  printf '   Kundendaten/Secrets gehören NICHT in den öffentlichen Marktplatz.\n'
  printf '   Echte Stammdaten leben lokal (~/.lt-time) oder im privaten Repo.\n'
  printf '   Fehlalarm? Datei/Muster in .secrets-allow eintragen (mit Bedacht).\n'
  exit 1
fi
echo "✓ scan-secrets: keine sensiblen Daten gefunden."
exit 0
