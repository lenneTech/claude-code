---
description: 'Kompletter End-to-End-Smoke-Test des lt-Stacks: Fullstack-Projekt im Vendor-Mode erstellen, lokal vollständig validieren (Playwright-E2E + pnpm run check), GitLab-Repo + TurboOps-Deployment (Stages dev/production) vollautomatisch einrichten, Deployment-Pipeline via MRs (feature→dev→main) durchfahren, Online-Stände beider Stages verifizieren, gefundene Fehler direkt in den Grund-Repos fixen (uncommitted), und am Ende alles restlos aufräumen (TurboOps, GitLab, lokal, DBs, Registry).'
argument-hint: '[--name=lt-smoke-test] [--domain=lt-smoke-test.lenne.tech] [--group=intern] [--server=Turbo-Dev] [--rounds=1] [--keep] [--skip-deploy] [--skip-cleanup]'
allowed-tools: Read, Edit, Write, Grep, Glob, Bash, Agent, AskUserQuestion, SlashCommand, TodoWrite, ToolSearch
disable-model-invocation: true
effort: max
---

# Fullstack Smoke-Test

Fährt den kompletten Lebenszyklus eines lt-Fullstack-Projekts durch — von
`lt fullstack init` bis zum produktiven TurboOps-Deployment und zurück — und
behandelt jeden Fehler unterwegs als **Grund-Repo-Befund**: Der Fix gehört in
`nest-server` / `nest-server-starter` / `nuxt-extensions` / `nuxt-base-starter`
/ `lt-monorepo` / `cli` / `lt-dev` (uncommitted, aktueller Branch), nicht ins
Wegwerf-Projekt. Ziel: Ein frisches Projekt funktioniert ohne jede
Nachbesserung.

**Referenz-Durchlauf:** 2026-07-17 (`lt-smoke-test`), Befunde: unhead-
Doppelversion (SSR-500 der gebauten App), Standalone-Layout-Annahmen in den
pnpm-Pin-Contract-Tests beider Starter, unvollständige oxlint-allow-Liste,
Turbo-Dev-Traefik-Mismatch (siehe `deploying-to-turboops` Trap 5).

## Voraussetzungen (Phase 0 — hart prüfen, nicht annehmen)

| Prüfung | Kommando |
|---------|----------|
| lt CLI global verlinkt | `lt --version` |
| glab auf gitlab.lenne.tech authentifiziert | `glab auth status` |
| TurboOps-MCP erreichbar | `list_workspaces` (MCP) |
| turbo CLI + Login | `turbo whoami` — bei „Unauthorized": `turbo login` (Browser-Flow; User-Token landet in `~/Library/Preferences/turboops-cli-nodejs/config.json`) |
| MongoDB lokal | `pgrep mongod` |
| mongosh vorhanden (DB-Cleanup!) | `which mongosh` — sonst `brew install mongosh` |
| Caddy-Daemon (lt dev) | `curl -s http://localhost:2019/config/` |
| DNS: Apex + Wildcard → Zielserver-IP | `dig +short <domain>` und `dig +short api.dev.<domain>` — ein Wildcard `*.<domain>` deckt per RFC 4592 auch `api.dev.<domain>` ab, solange kein expliziter Zwischeneintrag existiert |

## Ablauf

### Phase 1 — Scaffold (Vendor-Mode)

```bash
mkdir -p ~/code/tmp && cd ~/code/tmp
lt fullstack init --name <name> --frontend nuxt --api-mode Rest \
  --framework-mode vendor --frontend-framework-mode vendor --noConfirm
cd <name> && git add -A && git commit -m "chore: lt dev URL blocks"
```

### Phase 2 — Lokale Validierung (Fehler ⇒ Grund-Repo-Fix, dann weiter)

1. `lt dev up` → beide URLs proben (`https://<slug>.localhost`, `https://api.<slug>.localhost/health-check`).
2. `lt dev test` — **alle** Playwright-E2E müssen grün sein (25/25 im Starter-Stand 2026-07). Der Test-Stack fährt die App **gebaut** — genau hier zeigen sich Build-only-Fehler (z. B. SSR-500 durch doppelte unhead-Version), die der Dev-Mode verschluckt.
3. `pnpm run check` — komplett grün inkl. audit (0 Vulns), Lint **clean** (0 Warnungen — Warnungsflut im vendored Core = oxlintrc-Lücke im Starter).
4. Jeden Befund SOFORT im passenden Grund-Repo fixen (lokale Repos unter `~/code/lenneTech/`), in das Smoke-Projekt spiegeln, Schritt wiederholen bis grün. Grund-Repos: **nichts committen** — der User reviewt.

### Phase 3 — GitLab

```bash
GITLAB_HOST=gitlab.lenne.tech glab repo create <group>/<name> --private \
  --description "Temporärer Fullstack-Smoke-Test (wird gelöscht)"
```

SSH-Agent-Falle: Hängt `git push` mit `communication with agent failed`, auf
HTTPS ausweichen: `git remote set-url origin https://gitlab.lenne.tech/<group>/<name>.git`
und `git config credential.helper '!glab auth git-credential'`.

### Phase 4 — TurboOps (vollautomatisch, kein Web-UI-Schritt)

Alles per TurboOps-MCP + CLI-API (Details + Payloads: Skill
`deploying-to-turboops`):

1. `create_deployment_project` (Slug = `<name>`, Customer lenne.tech).
2. Projekt-Token minten: `POST /cli/deployment/tokens` `{project: <id>, name: "gitlab-ci"}` → `plainToken`.
3. GitLab-CI-Variablen: `TURBOOPS_PROJECT` (plain) + `TURBOOPS_TOKEN` (masked, **unprotected**) via `glab variable set`.
4. `create_deployment_stage` ×2: `dev` (development, `dev.<domain>`, Branch `dev`) + `production` (production, `<domain>`, Branch `main`) auf dem Zielserver; Branch via `update_stage_settings`.
5. Compose hochladen: `POST /cli/deployment/projects/<id>/compose` → registriert alle 3 Services an beiden Stages (entschärft die Single-Service-Falle VOR dem ersten Deploy).
6. `update_service_domain` je Stage: `api` → `api.<stage-domain>` (App läuft über die Stage-Root-Primary).
7. Stage-ENVs **service-scoped** setzen (`update_deployment_envs` mit `serviceName`): api = `NODE_ENV` (develop/production), `NSC__BASE_URL`, `NSC__APP_URL`, `NSC__MONGOOSE__URI=mongodb://<stack>_mongo:27017/<db>` (stack-qualifiziert!), `NSC__BETTER_AUTH__SECRET`, `NSC__AI__ENCRYPTION_SECRET`, `NSC__EMAIL__SMTP__*`, `NSC__EMAIL__DEFAULT_SENDER__EMAIL`, `SMTP_PORT`; app = `NUXT_PUBLIC_APP_ENV`, `NUXT_API_URL`, `NUXT_PUBLIC_API_URL`, `NUXT_PUBLIC_SITE_URL`, `NUXT_PUBLIC_API_PROXY=false`. Die Pflichtliste stammt aus dem Fail-fast-Guard in `projects/api/src/config.env.ts` (`REQUIRED_DEPLOYED_ENV_VARS`).
8. `lt deployment create --noConfirm` im Projekt → `.turboops.json` committen.

### Phase 5 — Baseline-Deploys + Online-Check

1. `git push -u origin dev` → Pipeline (test → turboops-build → deploy-dev) via `glab api` überwachen.
2. `git branch main dev && git push -u origin main` → deploy-prod.
3. **Nach JEDEM Deploy die echten URLs proben** — grüner `--wait` beweist keine Erreichbarkeit (Trap 5!): App 200/302, `api.<domain>/health-check` 200, `/meta`-Commit == CI-SHA, Cert-Issuer Let's Encrypt.
3b. **Sign-up-Deep-Check mit LAUF-EINDEUTIGER E-Mail** (z. B. `smoke-test+<runid>@lenne.tech`): Verwaiste `<stack>_mongo_data`-Volumes aus früheren Läufen (Blocklist verhindert deren Löschung) werden vom neuen Stack wiederverwendet — eine feste Test-Mail liefert dann fälschlich `400 Email already registered`, obwohl die API gesund ist.
4. 404 + `TRAEFIK DEFAULT CERT` ⇒ Fremd-Traefik-Server (z. B. Turbo-Dev): Label-Pass nach `deploying-to-turboops` Trap 5 ausführen — und nach **jedem** weiteren Deploy wiederholen.

### Phase 6 — MR-Durchläufe (× `--rounds`)

Pro Runde:
1. Feature-Branch von `dev`, sichtbare Änderung (z. B. Badge `SMOKE-R<n>` mit `data-testid="smoke-marker"` auf der Landing-Page).
2. `glab mr create --source-branch … --target-branch dev` → `glab mr merge --auto-merge --remove-source-branch` (Tests gaten den Merge).
3. dev-Pipeline abwarten → ggf. Label-Pass → Online-Check: Marker via `curl -s https://dev.<domain>/ | grep SMOKE-R<n>` + `/meta`-Commit == neuer SHA.
4. MR `dev` → `main`, Auto-Merge, deploy-prod abwarten → ggf. Label-Pass → gleicher Online-Check auf `<domain>`.

### Phase 7 — Cleanup (restlos, in dieser Reihenfolge)

1. TurboOps: `delete_deployment_stage` ×2 (confirmName!), dann `delete_deployment_project` (kaskadiert Tokens/Deployments; Registry-Images hängen am Projekt).
2. Prüfen, dass die Swarm-Stacks vom Server verschwunden sind (`list_server_containers`); Reste via `docker stack rm <stack>` (exec_in_container).
3. GitLab: `glab repo delete <group>/<name> --yes`.
4. Lokal: `lt dev down` im Projekt, `lt dev test down` (falls Reste), Projektordner löschen, Registry-Eintrag prüfen (`~/.lenneTech/projects.json` — `lt dev down` räumt Caddy-Block; verwaiste Einträge via `lt dev prune`/Registry-Check).
5. Mongo lokal: `lt dev prune --noConfirm` räumt verwaiste Smoke-Test-DBs (reserviertes `lt-smoke-test`-Präfix) seit CLI 1.38.0 automatisch mit — derselbe Sweep läuft zusätzlich bei jedem `lt dev up` beliebiger Projekte. Direkte Drop-Kommandos können von einer Hook-Policy geblockt sein — dann NICHT umgehen; prune ist der kanonische Weg.
5b. Server-Volumes: `docker volume ls --filter name=<name>` — verwaiste `<stack>_mongo_data`-Volumes bleiben nach Stage-Löschung zurück und werden vom NÄCHSTEN Lauf wiederverwendet (Daten-Leak zwischen Läufen!). `docker volume rm` ist über das exec-Tool geblockt (Blocklist). Wenn SSH-Zugang zum Stage-Server besteht (`ssh root@<server-ip>` — nach der Turbo-Dev-Migration DEV-2551 bzw. autorisiertem Key), die Volumes DIREKT löschen: `ssh root@<server-ip> "docker volume rm <name>-dev_mongo_data <name>-production_mongo_data"`; sonst als manuellen Einzeiler ausweisen.
6. `turbo logout` NICHT nötig (User-Login bleibt); geminteter Projekt-Token stirbt mit dem Projekt.
7. Schlussprüfung: alle vier Stage-URLs müssen wieder 404/Default-Cert liefern, `glab repo view` 404, TurboOps-Projektliste ohne `<name>`, keine `<name>`-DBs, kein `~/code/tmp/<name>`.

### Phase 8 — Report

Abschlussbericht: Befunde je Grund-Repo (mit uncommitted-Diff-Zusammenfassung),
Pipeline-/Deploy-Zeiten, Online-Verifikationen, offene Infra-Empfehlungen
(z. B. Traefik-Migration des Zielservers). Grund-Repo-Änderungen bleiben
uncommitted zur Review.

## Flags

- `--keep` — Cleanup überspringen (Debugging); Projekt + Stages bleiben stehen.
- `--skip-deploy` — nur Phasen 0–2 (lokale Validierung), kein GitLab/TurboOps.
- `--skip-cleanup` — wie `--keep`, aber Report erwähnt die offenen Ressourcen explizit.
- `--rounds=<n>` — Anzahl MR-Durchläufe (Default 1; der Referenz-Durchlauf fuhr 2).

## Related Skills / Commands

- Skill `deploying-to-turboops` — Deploy-Vertrag, Token-API, Compose-Upload, **Trap 5** (Fremd-Traefik).
- Skill `using-lt-cli` — `lt fullstack init`, `lt dev`, `--noConfirm`-Regel.
- Skill `validating-ci-pipelines-locally` — Pipeline lokal reproduzieren, bevor gepusht wird.
- `/lt-dev:production-ready` — tiefes Release-Gate für ECHTE Projekte (nicht für den Wegwerf-Smoke-Test).
