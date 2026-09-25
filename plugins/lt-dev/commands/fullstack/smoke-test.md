---
description: 'Complete end-to-end smoke test of the lt stack. Creates a fullstack project in vendor mode, validates it fully on the local machine (Playwright E2E + pnpm run check), sets up a GitLab repo and a TurboOps deployment (stages dev/production) fully automatically, drives the deployment pipeline through MRs (feature→dev→main), and verifies the online state of both stages. Fixes every error it finds directly in the base repos (uncommitted), and finishes with a complete cleanup (TurboOps, GitLab, local, DBs, registry).'
argument-hint: '[--name=<name>] [--domain=<smoke-domain>] [--group=<gitlab-group>] [--server=<turboops-server>] [--rounds=1] [--keep] [--skip-deploy] [--skip-cleanup]'
allowed-tools: Read, Edit, Write, Grep, Glob, Bash, Agent, AskUserQuestion, Skill, ToolSearch
disable-model-invocation: false
---

# Fullstack Smoke Test

> **Invocation policy.** Start this command only when the user asks for it explicitly
> (`/lt-dev:fullstack:smoke-test`) **or** when an orchestrating lt-dev command invokes it as a
> documented step — `/lt-dev:maintenance:maintain-stack` runs it as its Phase-4 release gate,
> and `/lt-dev:publish` runs it on `--smoke-test`. Never start it off your own initiative: it
> scaffolds a throwaway workspace and deploys it.
>
> This rule replaces a former `disable-model-invocation: true`, which left `maintain-stack`
> without the release gate its own description promises.

> **Effort policy.** No `effort` in the frontmatter: the command runs at the session's level, so a developer who
> raises effort for a risky smoke test gets it here too. This gate cannot run in an eval (it deploys real stages), so
> the decision rests on the work it consists of: in every lt-dev measurement of that work (Opus 5.5,
> `plugins/lt-dev/evals`, 2026-09-25), code review, planning and builds, the default `medium` reached the quality of
> `high` and `xhigh`, which took 1.3 to more than 3 times as long. Pin a level only when a measurement shows it adds quality.

**Why unrestricted `Bash`:** this command drives a full project lifecycle —
`lt` CLI, `docker`/`docker-compose`, `git`, `glab`, the TurboOps `turbo` CLI,
`mongosh`, `dig`, `ssh` and `curl` — through scaffold, deploy and cleanup; the
CLI surface is too broad and too dependent on what each phase discovers to
enumerate as individual patterns.

Runs the complete lifecycle of an lt fullstack project, from
`lt fullstack init` to a production TurboOps deployment and back. Every error
on the way counts as a **base-repo finding** (base repos = Grund-Repos): the fix
belongs in `nest-server` / `nest-server-starter` / `nuxt-extensions` /
`nuxt-base-starter` / `lt-monorepo` / `cli` / `lt-dev` (uncommitted, current
branch), not in the throwaway project. The goal: a fresh project works without
any rework.

**Reference run:** 2026-07-17 (`lt-smoke-test`). Findings: duplicate unhead
version (SSR 500 in the built app), standalone-layout assumptions in the pnpm
pin contract tests of both starters, incomplete oxlint allow list, Turbo-Dev
Traefik mismatch (see `deploying-to-turboops` Trap 5).

## Prerequisites (Phase 0 — verify each one strictly, do not assume)

| Check | Command |
|-------|---------|
| lt CLI linked globally | `lt --version` |
| glab authenticated on gitlab.lenne.tech | `glab auth status` |
| TurboOps MCP reachable | `list_workspaces` (MCP) |
| turbo CLI + login | `turbo whoami` — on "Unauthorized": `turbo login` (browser flow; the user token lands in `~/Library/Preferences/turboops-cli-nodejs/config.json`) |
| MongoDB running locally | `pgrep mongod` |
| mongosh installed (needed for DB cleanup) | `which mongosh` — otherwise `brew install mongosh` |
| Caddy daemon (lt dev) | `curl -s http://localhost:2019/config/` |
| DNS: apex + wildcard → target server IP | `dig +short <domain>` and `dig +short api.dev.<domain>` — per RFC 4592 a wildcard `*.<domain>` also covers `api.dev.<domain>`, as long as no explicit intermediate record exists |

### Fixed assignment — record it once instead of asking every run

A team typically runs the smoke test against the same wildcard domain and the
same target server every time. Record this assignment once instead of asking
for it on each run:

```
A   *.<smoke-domain>   <server-ip>
```

| | |
|---|---|
| Domain | `<smoke-domain>` |
| Target server | Name + provider + IP, and the TurboOps server ID for the MCP calls |
| Workspace | TurboOps workspace ID |
| Stages | dev → `dev.<smoke-domain>` · production → `<smoke-domain>` |
| API per stage | `api.dev.<smoke-domain>` · `api.<smoke-domain>` |

> **Where the concrete values live.** Server addresses, TurboOps server and workspace IDs,
> and the real domain are infrastructure assignments. They therefore do **not** belong in
> this public marketplace, but in the internal one
> (`claude-code-internal`, plugin `lt-ops` → `reference/lt-smoke-test-environment.md`).
> This document describes only the procedure.

**Run the `dig` check every time anyway.** Not out of distrust of the record, but
because a missing name otherwise only surfaces at the Let's Encrypt challenge. By
then the stage is already up, and the online check is worthless instead of red. If
the target server runs its own Traefik instance, Trap 5 from `deploying-to-turboops`
applies as well, after **every** deploy.

## Workflow

### Turn endings

This command runs to completion without check-ins. A message without a tool call ends the turn and stops the run, so status notes and recommendations go in the same message as the next tool call, and work that does not depend on the user carries on; waiting on a pipeline or a deploy means polling again, not reporting, and a base-repo fix is followed by the repeated step. The run stops only at the handoff points this command defines (a Phase 0 prerequisite the run cannot establish itself, such as the `turbo login` browser flow or a missing DNS record, and the Phase 8 report; when an orchestrating command invoked this one, the report returns to that caller, which carries on), when a step is blocked by something only the user can resolve, or before a destructive or irreversible action that needs confirmation. Deleting the throwaway resources this run created, and the leftovers of earlier smoke-test runs under the same `<name>` (a `-deletion_scheduled-` GitLab project, orphaned `<stack>_mongo_data` volumes), is part of the job, not such an action — Phase 7 must end with zero hits, earlier runs included.

### Phase 1 — Scaffold (vendor mode)

```bash
SMOKE_DIR="${LT_SMOKE_DIR:-$HOME/lt-smoke}"   # no fixed workspace path — differs per machine
mkdir -p "$SMOKE_DIR" && cd "$SMOKE_DIR"
lt fullstack init --name <name> --frontend nuxt --api-mode Rest \
  --framework-mode vendor --frontend-framework-mode vendor --noConfirm
cd <name> && git add -A && git commit -m "chore: lt dev URL blocks"
```

### Phase 2 — Local validation (error ⇒ base-repo fix, then continue)

1. `lt dev up` → probe both URLs (`https://<slug>.localhost`, `https://api.<slug>.localhost/health-check`).
2. `lt dev test` — **all** Playwright E2E tests must pass (25/25 in the starter state of 2026-07). The test stack runs the **built** app, which is exactly where build-only errors show up (e.g. SSR 500 from a duplicate unhead version) that dev mode swallows.
3. `pnpm run check` — fully green including audit (0 vulns) and a **clean** lint (0 warnings; a flood of warnings in the vendored core means a gap in the starter's oxlintrc).
4. Fix each finding right away in the matching base repo, in its local clone. The path differs per machine, so search for it (`find "$HOME" -maxdepth 5 -type d -name nest-server-starter -not -path '*/node_modules/*'`) or ask instead of guessing. Mirror the fix into the smoke project and repeat the step until it is green. Commit nothing in the base repos, because the user reviews the changes.

### Phase 3 — GitLab

```bash
GITLAB_HOST=gitlab.lenne.tech glab repo create <group>/<name> --private \
  --description "Temporärer Fullstack-Smoke-Test (wird gelöscht)"
```

SSH agent trap: if `git push` hangs with `communication with agent failed`, fall
back to HTTPS: `git remote set-url origin https://gitlab.lenne.tech/<group>/<name>.git`
and `git config credential.helper '!glab auth git-credential'`.

### Phase 4 — TurboOps (fully automated, no web UI step)

Everything runs through the TurboOps MCP and the CLI API (details and payloads:
skill `deploying-to-turboops`):

1. `create_deployment_project` (slug = `<name>`, customer lenne.tech).
2. Mint a project token: `POST /cli/deployment/tokens` `{project: <id>, name: "gitlab-ci"}` → `plainToken`.
3. GitLab CI variables: `TURBOOPS_PROJECT` (plain) + `TURBOOPS_TOKEN` (masked, **unprotected**) via `glab variable set`.
   **`TURBOOPS_PROJECT` is the slug, not the project ID.** `scripts/turboops-guard.sh` compares it with
   `.turboops.json` (which carries the slug) and otherwise aborts `turboops-build`. The abort is correct: the
   images would go into one namespace while the other project would be deployed. The ID from
   `create_deployment_project` is not needed here.
4. `create_deployment_stage` ×2: `dev` (development, `dev.<domain>`, branch `dev`) + `production` (production, `<domain>`, branch `main`) on the target server; set the branch via `update_stage_settings`.
5. Upload the compose file: `POST /cli/deployment/projects/<id>/compose` → registers all 3 services on both stages (defuses the single-service trap before the first deploy).
6. `update_service_domain` per stage: `api` → `api.<stage-domain>` (the app runs on the stage root primary).
7. Set the stage ENVs **service-scoped** (`update_deployment_envs` with `serviceName`): api = `NODE_ENV` (develop/production), `NSC__BASE_URL`, `NSC__APP_URL`, `NSC__MONGOOSE__URI=mongodb://<stack>_mongo:27017/<db>` (stack-qualified), `NSC__BETTER_AUTH__SECRET`, `NSC__AI__ENCRYPTION_SECRET`, `NSC__EMAIL__SMTP__*`, `NSC__EMAIL__DEFAULT_SENDER__EMAIL`, `SMTP_PORT`; app = `NUXT_PUBLIC_APP_ENV`, `NUXT_API_URL`, `NUXT_PUBLIC_API_URL`, `NUXT_PUBLIC_SITE_URL`, `NUXT_PUBLIC_API_PROXY=false`. The required list comes from the fail-fast guard in `projects/api/src/config.env.ts` (`REQUIRED_DEPLOYED_ENV_VARS`).
8. `lt deployment create --noConfirm` in the project → commit `.turboops.json`.

### Phase 5 — Baseline deploys + online check

1. `git push -u origin dev` → watch the pipeline (test → turboops-build → deploy-dev) via `glab api`.
2. **Set `main` as a protected branch first**, otherwise `deploy-prod` never runs:
   ```bash
   GITLAB_HOST=gitlab.lenne.tech glab api --method POST \
     "projects/<group>%2F<name>/protected_branches?name=main&push_access_level=40&merge_access_level=40"
   ```
   The template gates the production stage with
   `$CI_COMMIT_BRANCH == "main" && $CI_COMMIT_REF_PROTECTED == "true"`. This is deliberate,
   because a branch name is no authorization. Without protection the rule fails **closed**:
   the pipeline runs green, but the deploy job is missing entirely. That looks like a
   broken template and is the opposite. Protect first, then run
   `git branch main dev && git push -u origin main` → deploy-prod.
3. **Probe the real URLs after every deploy.** A green `--wait` does not prove reachability (Trap 5): app 200/302, `api.<domain>/health-check` 200, `/meta` commit == CI SHA, cert issuer Let's Encrypt.
3b. **Sign-up deep check with a run-unique email** (e.g. `smoke-test+<runid>@lenne.tech`): orphaned `<stack>_mongo_data` volumes from earlier runs (see Phase 7, step 5b; they survive stage deletion) are reused by the new stack. A fixed test email then wrongly returns `400 Email already registered`, although the API is healthy.
4. 404 + `TRAEFIK DEFAULT CERT` ⇒ a server with its own Traefik (e.g. Turbo-Dev): run the label pass from `deploying-to-turboops` Trap 5, and repeat it after **every** further deploy.

### Phase 6 — MR rounds (× `--rounds`)

Per round:
1. Feature branch from `dev` with a visible change (e.g. a badge `SMOKE-R<n>` with `data-testid="smoke-marker"` on the landing page).
2. `glab mr create --source-branch … --target-branch dev` → `glab mr merge --auto-merge --remove-source-branch`.

   **Wait until the branch pipeline is running, then set `--auto-merge`.** The flag is
   no guarantee: if `glab` finds no running pipeline when the command is issued, it
   reports `! No pipeline running on <branch>` and merges **immediately and ungated**.
   The tests then never checked the merge, although the command looks as if it waits.
   The run on 2026-09-01 did exactly that; on 2026-09-02, after a short wait, GitLab
   acknowledged with `✓ Will auto-merge`, and the merge really did wait for the green
   pipeline. The only difference is the timing between push and command:

   ```bash
   for i in $(seq 1 30); do
     n=$(glab api "projects/<id>/pipelines?ref=<branch>&per_page=1" | node -e "…length…")
     [ "$n" = "1" ] && break; sleep 5
   done
   glab mr merge <iid> --auto-merge --remove-source-branch --yes
   ```

   Check instead of assuming: `✓ Will auto-merge` in the output, or
   `auto_merge_enabled: true` on the MR. A direct `merged` without a prior pipeline is
   the ungated case. (A 405 `Method Not Allowed` on a direct merge, by contrast, is a
   good sign: it means the project enforces a green pipeline before merging.)
3. Wait for the dev pipeline → label pass if needed → online check: marker via `curl -s https://dev.<domain>/ | grep SMOKE-R<n>` + `/meta` commit == new SHA.
4. MR `dev` → `main`, auto-merge, wait for deploy-prod → label pass if needed → same online check on `<domain>`.

### Phase 7 — Cleanup (complete, in this order)

1. TurboOps: `delete_deployment_stage` ×2 (confirmName is required), then `delete_deployment_project` (cascades tokens/deployments; registry images belong to the project).
2. Check that the swarm stacks are gone from the server (`list_server_containers`); remove leftovers via `docker stack rm <stack>` (exec_in_container).
3. GitLab: `glab repo delete <group>/<name> --yes` — **this does not delete, it only schedules deletion.**
   GitLab renames the project to `<name>-deletion_scheduled-<id>` and keeps it during the
   delay period; `glab repo view <group>/<name>` then returns 404 and suggests success. The
   run on 2026-08-22 left such a project behind, and it was only noticed on the next day
   during a recount. So always remove it permanently, then search for leftovers:
   ```bash
   GITLAB_HOST=gitlab.lenne.tech glab api --method DELETE \
     "projects/<id>?permanently_remove=true&full_path=<group>/<name>-deletion_scheduled-<id>"
   # Check — must return 0 hits, including from EARLIER runs:
   GITLAB_HOST=gitlab.lenne.tech glab api "projects?search=<name>"
   ```
   The search belongs in every run, not only for the current one: a project scheduled for
   deletion by an earlier run otherwise blocks the name and stays unnoticed.
4. Local: `lt dev down` in the project, `lt dev test down` (if anything is left), delete the project folder, check the registry entry (`~/.lenneTech/projects.json`; `lt dev down` removes the Caddy block; clean orphaned entries via `lt dev prune`/registry check).
5. Local Mongo: `lt dev prune --noConfirm` also removes orphaned smoke-test DBs (reserved `lt-smoke-test` prefix) automatically since CLI 1.38.0; the same sweep also runs on every `lt dev up` of any project. Direct drop commands may be blocked by a hook policy. In that case do not work around it; prune is the canonical way.
5b. Server volumes: orphaned `<stack>_mongo_data` volumes remain after stage deletion and are reused by the next run. That is a data leak between runs, and the reason a fixed test email wrongly returns `400 Email already registered`. **They can be deleted through the TurboOps MCP, without SSH** (verified 2026-08-23): `exec_in_container` in a container with the Docker CLI and a read-write socket (on Turbo-Dev `deploy-party_api`), with `allowWrite: true` and `confirmHostname: <server-IP>`. Pass **the IP, not the server name**; a server name is rejected with "confirmHostname mismatch". First list with `volume ls --filter name=<name>`, then run `volume rm` on the two stack volumes. An earlier version of this document claimed this was blocked by a blocklist and required SSH. That is not (or no longer) true: the command is classified as `needs-write` and runs with `allowWrite`. SSH remains the fallback when the MCP is unreachable.
6. `turbo logout` is not needed (the user login stays); the minted project token dies with the project.
7. Final check: all four stage URLs must return 404/default cert again, `glab repo view` 404, the TurboOps project list without `<name>`, no `<name>` DBs, no `$SMOKE_DIR/<name>`.

### Phase 8 — Report

Final report: findings per base repo (with a summary of the uncommitted diff),
pipeline/deploy times, online verifications, open infrastructure
recommendations (e.g. Traefik migration of the target server). Base-repo changes
stay uncommitted for review.

## Flags

- `--keep` — skip the cleanup (debugging); project and stages stay up.
- `--skip-deploy` — phases 0–2 only (local validation), no GitLab/TurboOps.
- `--skip-cleanup` — like `--keep`, but the report lists the remaining resources explicitly.
- `--rounds=<n>` — number of MR rounds (default 1; the reference run did 2).

## Related Skills / Commands

- Skill `deploying-to-turboops` — deploy contract, token API, compose upload, **Trap 5** (a server with its own Traefik).
- Skill `using-lt-cli` — `lt fullstack init`, `lt dev`, `--noConfirm` rule.
- Skill `validating-ci-pipelines-locally` — reproduce the pipeline locally before pushing.
- `/lt-dev:production-ready` — the in-depth release gate for real projects (not for the throwaway smoke test).
