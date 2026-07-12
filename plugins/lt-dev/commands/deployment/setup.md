---
description: Take an lt fullstack project live on TurboOps via GitLab CI/CD — guided end-to-end (deploy contract, lt deployment create, CI variables, multi-service stage via turbo deploy --compose upload, DNS, CI deploy, verification)
argument-hint: "[--slug=<slug>] [--stage=<dev|production>]"
allowed-tools: Read, Grep, Glob, Write, Edit, AskUserQuestion, TodoWrite, Bash(lt:*), Bash(git:*), Bash(gh:*), Bash(glab:*), Bash(docker:*), Bash(docker compose:*), Bash(dig:*), Bash(nslookup:*), Bash(curl:*), Bash(cat:*), Bash(ls:*), Bash(test:*), mcp__turboops__list_deployment_projects, mcp__turboops__get_deployment_status, mcp__turboops__get_deployment_logs, mcp__turboops__list_deployment_containers, mcp__turboops__get_container_status
disable-model-invocation: true
---

# Deploy an lt Fullstack Project to TurboOps

## When to Use This Command

- First-time go-live of an `lt fullstack init` project on TurboOps (turbo-ops.de)
- Adding a `dev` or `production` stage to an existing TurboOps project
- Recovering a deploy that rolled out only the App (api/mongo missing) — Trap 1
- Recovering a `redeploy_stack` failure (`not found in registry`) — Trap 2

## Related Commands

| Command | Purpose |
|---------|---------|
| `/lt-dev:docker:gen-setup` | Generate the Docker/compose setup when the deploy contract is missing |
| `/lt-dev:production-ready` | Full production-readiness gate to run before go-live |
| `/lt-dev:review` | Comprehensive code review across all quality dimensions |

---

## Instructions

Follow the **`deploying-to-turboops` skill** end to end — it is the single source
of truth for this flow, including the deploy contract, the exact traps, and the
verification checklist. This command orchestrates it; do not improvise steps that
the skill defines.

Parse `$ARGUMENTS` for the optional `--slug=<slug>` (TurboOps project slug;
defaults to the repo's `package.json` name) and `--stage=<dev|production>`
(defaults to inferring from the current branch: `dev` → `dev`, `main` →
`production`).

Create a TodoWrite plan covering the skill's step sequence, then execute:

1. **Prerequisites** — Confirm the repo is an lt fullstack project with the deploy
   contract (`docker-compose.yml` with `mongo`/`api`/`app`, `.gitlab-ci.yml` with
   `test → turboops-build → deploy`). If missing, stop and point to
   `/lt-dev:docker:gen-setup`. Reproduce the CI locally first via the
   `validating-ci-pipelines-locally` skill.
2. **`lt deployment create`** — Generate/verify `.turboops.json` = `{ "project":
   "<slug>" }` at the repo root (run non-interactively with `--noConfirm`). Commit it.
3. **GitLab CI/CD variables** — Ensure `TURBOOPS_PROJECT` (= `<slug>`) and
   `TURBOOPS_TOKEN` exist. The token is minted **only in the TurboOps web UI**
   (Project → Settings → Tokens) — there is no CLI/MCP path; ask the user to
   create + paste it. It must be **masked** and **Protected = false** (the `dev`
   branch is unprotected and must see it).
4. **Make the stage multi-service — ensure `turbo deploy` uploads the compose** —
   The stage becomes multi-service the moment TurboOps receives the repo's
   `docker-compose.yml` (`syncServicesFromCompose` registers `mongo`/`api`/`app`
   and derives the domains). Confirm the CI deploy command carries **`--compose
   docker-compose.yml`** (the recommended, fully automatic path — no web UI
   step); it is maintained in the lt-monorepo CI template, so add it if an older
   `.gitlab-ci.yml` / GitHub `deploy.yml` omits it. Equivalents that also upload
   the compose: a project with `detectedConfig.composePath` set (bare `turbo
   deploy`), or creating the stage in the web UI (one alternative, not required).
   **Never** rely on the MCP `create_deployment_stage` alone (single-service →
   Trap 1; the `--compose` upload repairs it). Set the stage env vars including
   `NSC__MONGOOSE__URI=mongodb://<stack>_mongo:27017/<db>` (full swarm service
   name — Trap 3). Use `AskUserQuestion` to gate on "does the deploy command
   include `--compose docker-compose.yml` (or is the compose otherwise
   registered)?".
5. **DNS** — Have the user create + verify `A`/`CNAME` records for the root domain
   and `api.<root>` pointing at the server **before** deploying (Let's Encrypt
   issues on first deploy — Trap 4). Confirm resolution with `dig`/`nslookup`.
6. **Trigger the deploy via CI** — Push to the gating branch (`dev` →
   `deploy-dev`, `main` → `deploy-prod`; `turbo deploy <stageSlug> --compose
   docker-compose.yml --wait`). The `--compose docker-compose.yml` flag uploads
   the compose so all three services roll out. The CI deploy job is the supported
   way to roll a pipeline stage — never MCP `redeploy_stack` (Trap 2).
7. **Verify** — CI `deploy-*` job green; the deploy log shows all three services
   created and `X/X containers healthy` (not a lone `app`); `GET
   https://api.<root>/health-check` OK; the app root loads over HTTPS; `/admin/system`
   shows no App/API commit drift. Use the read-only TurboOps MCP tools
   (`get_deployment_status`, `get_deployment_logs`, `list_deployment_containers`,
   `get_container_status`) to confirm rollout topology and health.

## Hard Rules

- **A stage becomes multi-service by uploading the compose** — the CI `turbo
  deploy <stageSlug> --compose docker-compose.yml` is the recommended, fully
  automatic path (no web UI). Never rely on MCP `create_deployment_stage` alone
  (it builds a single-service stage → api/mongo missing → red health check); the
  `--compose` upload registers all services.
- **Rolling a pipeline stage happens via the CI deploy job with `--compose
  docker-compose.yml`**, never via MCP `redeploy_stack` (it builds a hyphen-
  joined, suffix-less image ref → `not found in registry`).
- **`NSC__MONGOOSE__URI` uses the full swarm host** `<stack>_mongo`, not `mongo`.
- **DNS must resolve to the server before the first deploy**, or cert issuance fails.
- **`TURBOOPS_TOKEN` is masked + unprotected**; it is created only in the web UI.
