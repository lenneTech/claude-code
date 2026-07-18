---
description: 'Vollautomatisches Maintaining ALLER lt-Grund-Repos in Abhängigkeits-Reihenfolge: Welle 1 (nuxt-extensions, nest-server, lt-monorepo, cli) maintainen + releasen (npm via GitHub-Release/publish.yml bzw. Template-Tagging), npm-Propagation abwarten, Welle 2 (nuxt-base-starter, nest-server-starter) auf die neuen Versionen heben + releasen, dann den kompletten /lt-dev:fullstack:smoke-test als Release-Gate fahren (inkl. TurboOps-Deploy + Online-Verifikation + restlosem Cleanup). Befunde werden im verursachenden Grund-Repo gefixt, als Patch nachreleased und der Smoke-Test wiederholt, bis der Stack befundfrei ist. Hinterlässt keine Test-Artefakte.'
argument-hint: '[--only=<repo,repo>] [--skip-smoke-test] [--smoke-rounds=1] [--release-as=patch|minor|major] [--dry-run]'
allowed-tools: Read, Edit, Write, Grep, Glob, Bash, Agent, AskUserQuestion, SlashCommand, TodoWrite, ToolSearch
disable-model-invocation: true
effort: max
---

# Maintain Stack

Orchestriert das Stack-weite Maintaining nach Skill **`maintaining-lt-stack`**
(Single Source of Truth für Reihenfolge, Rezepte, Wartemuster, Fallstricke —
zuerst laden!). Dieser Command beschreibt nur die Orchestrierung.

## Wann verwenden

- Regelmäßiger Stack-Release-Zyklus (alle Grund-Repos aktuell + published)
- Nach größeren Framework-Änderungen, bevor Kundenprojekte updaten
- Als Vorstufe: einzelne Repos → `/lt-dev:maintenance:maintain` im Repo

## Ablauf

### Phase 0 — Preflight (hart, kein Weiterlaufen bei Rot)

- `gh auth status` (github.com, repo-Scope) und `timeout 5 ssh-add -l`
  (bei leerem Agent: HTTPS-Push-Fallback aus dem Skill aktivieren).
- Alle 6 Repos: korrekter Branch (nest-server: `develop`, sonst `main`),
  Arbeitsverzeichnis clean, `git pull` aktuell. Dirty Repo ⇒ STOPP mit
  Befundliste (niemals fremde Änderungen in Release-Commits einsammeln).
- Smoke-Test-Voraussetzungen (Phase-0-Tabelle im smoke-test-Command), sofern
  nicht `--skip-smoke-test`.

### Phase 1 — Welle 1 (nuxt-extensions ∥ nest-server ∥ lt-monorepo ∥ cli)

Pro Repo: `lt-dev:npm-package-maintainer`-Agent (FULL, ohne Commit) →
Orchestrator committet, versioniert und released nach Skill-Rezept.
Parallelisierung erlaubt (getrennte Verzeichnisse); CPU-schwere `check`-Läufe
max. 2 gleichzeitig. `--release-as` steuert die Version (Default: aus
Diff-Analyse ableiten; Dependency-only ⇒ patch).

**Release-Gate pro Repo (Skill-Regel "No change → no release"):** Nach der
Maintenance entscheiden — nur bei echter Änderung am veröffentlichten
Artefakt (Dependencies/Code/Scaffold-Dateien) wird versioniert + released.
Reine Tooling-Metadaten (z. B. pnpm-Pin) werden committet, aber NICHT
released; unveränderte Repos werden als "already current — no release"
übersprungen.

### Phase 2 — npm-Propagation

`npm view <pkg> version` pollen (30-s-Intervall, Timeout 15 min) für
`@lenne.tech/nuxt-extensions`, `@lenne.tech/nest-server`, `@lenne.tech/cli`.
Timeout ⇒ `gh run list --workflow publish.yml` prüfen, Action-Fehler beheben
(re-run), NICHT neuen Tag stapeln.

### Phase 3 — Welle 2 (nuxt-base-starter ∥ nest-server-starter)

Nach Skill-Rezept: Dependency-Version heben, `pnpm run update` +
Migration-Guides (nest-server-starter), Maintenance-Agent, Doppel-`check`
(Repo-Root + Template), Commit-Konvention beachten, Release.

### Phase 4 — Release-Gate: Smoke-Test

`/lt-dev:fullstack:smoke-test` mit `--rounds=<--smoke-rounds>` (Default 1)
komplett fahren. Der Test klont die frisch released Stände von GitHub — er
validiert also exakt das, was Kunden bekommen.

### Phase 5 — Befunde → Patch-Releases (Schleife)

Jeder Smoke-Test-Befund wird im **verursachenden** Grund-Repo gefixt
(niemals nur im Wegwerf-Projekt), per Repo-Rezept als Patch released,
npm-Propagation abgewartet und die Smoke-Test-Phase wiederholt — bis
befundfrei (max. 3 Iterationen, danach Report mit offenen Punkten).

### Phase 6 — Sauberkeit + Report

- Smoke-Test-Cleanup verifizieren (Stage-URLs offline, GitLab-Repo weg,
  TurboOps-Projekt weg, lokale Registry/Caddy leer, Projektordner gelöscht).
- Policy-Reste (DB-Drop-Hook, Server-Volume-Blocklist) als manuelle
  Einzeiler listen — NICHT umgehen.
- Keine Maintenance-Reste: keine Stashes, keine Arbeits-Branches, keine
  halben Releases (Tag ⇒ npm-Version existiert).
- Abschlussbericht: pro Repo alte→neue Version, Release-Links,
  Smoke-Test-Ergebnis, Befunde + Fixes, offene manuelle Punkte.

## Flags

- `--only=<repos>` — Teilmenge (Abhängigkeits-Regeln bleiben aktiv: ein
  Starter zieht sein npm-Paket als Voraussetzung).
- `--skip-smoke-test` — nur Maintaining + Releases (z. B. reiner Security-Fix).
- `--smoke-rounds=<n>` — MR-Durchläufe im Smoke-Test (Default 1).
- `--release-as=patch|minor|major` — Versionssprung erzwingen statt Ableitung.
- `--dry-run` — nur analysieren + Plan ausgeben; keine Writes/Releases.

## Related

- Skill `maintaining-lt-stack` — **zuerst laden**; alle Rezepte + Fallstricke.
- `/lt-dev:fullstack:smoke-test` — das Release-Gate (Phase 4).
- `/lt-dev:maintenance:maintain` — Einzel-Repo-Maintenance.
- Agent `lt-dev:npm-package-maintainer` — Dependency-Arbeit pro Repo.
