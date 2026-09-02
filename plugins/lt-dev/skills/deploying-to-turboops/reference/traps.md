# TurboOps Traps

The recurring failure modes of a TurboOps go-live, each with the symptom you actually see, the cause behind it, and the fix. Referenced from [SKILL.md](../SKILL.md).

### The image build fails long after every test went green

The Docker build is the LAST gate before a deploy, and it exercises things no
test touches. Two traps seen in the wild:

**`patches/` is not copied into the image.** The deps stage copies manifests,
`pnpm-lock.yaml`, `pnpm-workspace.yaml` and `.npmrc` — but `pnpm-workspace.yaml`
also references `patchedDependencies: patches/<pkg>.patch`, and pnpm reads those
files during install. Without them `pnpm install --frozen-lockfile` dies with
`ENOENT: … patches/<pkg>.patch`. Since those patches usually close CVEs, an
image built without them would not be what was tested anyway. Both starter
Dockerfiles copy `patches/` now — check for it when a project's Dockerfile
predates that.

**A migration step that never returns.** `migrate up` used to leave a GridFS
connection open, so the CLI printed "All migrations completed successfully" and
then hung forever. In a container entrypoint of the shape
`migrate up && node main.js` the server is never reached; in CI the job blocks
until its timeout. Fixed in `@lenne.tech/nest-server` — if a vendored core
predates the fix, `uploadFileToGridFS` is the place to look.

**Build the image locally before pushing a Dockerfile change.**
`docker build --target deps -f projects/api/Dockerfile .` reproduces the exact
stage CI runs in under a minute. A pipeline round trip to learn the same thing
costs ten.


These are empirically verified failures. The first two are **the same root cause
as above** seen through MCP tools that look right but skip the compose upload —
the CLI `--compose docker-compose.yml` path bypasses both.

### Trap 1 — `create_deployment_stage` (MCP) builds a SINGLE-service stage

The MCP `create_deployment_stage` tool takes only **one** `primaryDomain` and
registers only **that one** service into `stage.services`. Because no compose is
uploaded, TurboOps has only that single service to roll out — so a fullstack
project created this way rolls out **only `app`**; `api` and `mongo` are never
scheduled (`0/1 containers healthy`, a lone `Creating service <stack>_app` line).

There is **no MCP tool to add a service to an existing stage afterwards** —
`update_service_domain` only finds services already registered in the stage, so
it returns `Service "api" not found`.

**Fix:** don't repair it service-by-service. Just let a CI `turbo deploy
<stageSlug> --compose docker-compose.yml` upload the real compose — the server's
`syncServicesFromCompose` re-registers all three services and derives the
domains, turning the single-service stage multi-service. (Creating the stage in
the web UI is the equivalent manual alternative.)

### Trap 2 — MCP `redeploy_stack` / `repositoryUrl`-without-Git-creds build broken image refs

For `pipeline`-type projects, the MCP `redeploy_stack` tool (and a project
configured with a `repositoryUrl` but no Git credentials, so the server can't
read the repo compose) fall back to `generateFallback` and construct an image
reference like `registry.turbo-ops.de/<slug>-<sha>:<sha>` — **hyphen-joined,
without the `/api` or `/app` suffix**. That image does not exist, so the deploy
fails at the image-fetch step with `not found in registry`. This is the exact
signature described in [Root Cause + Fix](#root-cause--fix-uploading-the-compose-is-what-makes-a-stage-multi-service).

**Fix:** roll the stage via the **CI deploy job with `--compose
docker-compose.yml`** (push the gating branch / re-run the pipeline job). The
uploaded compose resolves the per-service images (`.../api:<sha>`,
`.../app:<sha>`) correctly. Do **not** use MCP `redeploy_stack` for pipeline
projects.

### Trap 3 — MongoDB URI must use the full swarm service name

`NSC__MONGOOSE__URI` in the deployed stage must target
`mongodb://<stack>_mongo:27017/<db>` (stack-qualified), **not** the short
`mongodb://mongo:27017/<db>`.

The bare host does **not** produce a startup failure — it resolves to a FOREIGN
stack's MongoDB over the shared overlay, so the api boots healthy and serves
data while its own database stays empty. See "MongoDB URI" above for the full
failure picture.

**Verify it, do not assume it** (a green stage proves nothing here):

```bash
# 1. Which mongo does the api actually reach?
docker exec $(docker ps -q -f name=<stack>_api | head -1) getent hosts mongo
docker exec $(docker ps -q -f name=<stack>_api | head -1) getent hosts <stack>_mongo
#    Two different IPs, and the URI uses the short name → you are on a foreign DB.

# 2. The decisive check — is YOUR mongo actually being used?
docker exec $(docker ps -q -f name=<stack>_mongo | head -1) \
  mongosh --quiet --eval 'db.adminCommand({listDatabases:1}).databases.forEach(d=>print(d.name))'
#    Only admin/config/local = your database is empty and the data is elsewhere.
```

TurboOps rejects bare DB hosts and isolates bare-named DB services from the shared
overlay **since v1.72.0** (DEV-2140). Check the running version (bottom left of the
TurboOps UI, or `GET api.turbo-ops.de/meta`) — on an older instance nothing stops
you, and existing stacks keep their old networking until they are redeployed.

### Trap 4 — DNS must point at the server before the first deploy

Let's Encrypt issuance happens on deploy. If the root and `api.` records are not
resolving to the server yet, cert issuance fails and the stage comes up without
valid TLS. Create + verify DNS first, then deploy.

### Trap 5 — a green `--wait` does NOT prove external reachability (foreign-Traefik servers)

Empirically hit during the 2026-07 smoke-test run, on a host that had been
provisioned before TurboOps managed it (the concrete host is named in the internal
marketplace, `lt-ops` → `reference/lt-smoke-test-environment.md`): the deploy job goes green (`3/3 containers healthy`), but
every stage URL answers **404**. `--wait` checks container health only — it never
performs an external HTTP probe.

**The tell is the 404, NOT the certificate.** This page used to describe the
symptom as "404 with `CN=TRAEFIK DEFAULT CERT`". That is one of two shapes, and
the smoke-test runs of 2026-09-01 and 2026-09-02 both hit the other one: a
**valid Let's Encrypt certificate for the exact host**, and a 404 behind it. The
ACME TLS challenge is answered at the entrypoint and does not need a router, so
the certificate can be issued while no route to the service exists. Reading the
certificate as an all-clear rules the trap out and sends you looking for the
fault in the project, where it is not. Probe the URL; treat any 404 on a stage
whose containers are healthy as this trap until proven otherwise.

**Root cause:** the server's Traefik was provisioned by **deploy.party**, not by
TurboOps. TurboOps writes its per-stage routing config to
`/opt/traefik/dynamic/{slug}.yml`, but the deploy.party Traefik's file provider
watches `/etc/traefik/dynamic` ← host-mount `/var/opt/deploy-party/dynamic`
(read-only) and routes its own stacks via **swarm service labels** gated by
`--providers.swarm.constraints=Label(traefik.constraint-label, traefik-public)`
with `exposedByDefault=false`. TurboOps' config files land nowhere Traefik looks,
and TurboOps-deployed services carry no labels → no router, 404.

**Diagnose** (all via MCP `exec_in_container` on the traefik container):
`cat /proc/1/cmdline` (which providers/constraints?) and
`grep dynamic /proc/1/mountinfo` (which host dir actually backs the file
provider?). `reload_traefik_config` "succeeds" but changes nothing — it writes
to the path nobody reads.

**Workaround (per deploy — labels are wiped by every `docker stack deploy`):**
add the deploy.party-style labels directly to the swarm services, via a
container that has the docker CLI + RW socket (on Turbo-Dev:
`deploy-party_api`):

```
docker service update <stack>_app -d \
  --label-add traefik.enable=true \
  --label-add traefik.constraint-label=traefik-public \
  --label-add traefik.docker.network=traefik-public \
  --label-add 'traefik.http.routers.<name>-http.entrypoints=http' \
  --label-add 'traefik.http.routers.<name>-http.rule=Host("<domain>")' \
  --label-add 'traefik.http.routers.<name>-http.middlewares=https-redirect@swarm' \
  --label-add 'traefik.http.routers.<name>-https.entrypoints=https' \
  --label-add 'traefik.http.routers.<name>-https.rule=Host("<domain>")' \
  --label-add 'traefik.http.routers.<name>-https.tls=true' \
  --label-add 'traefik.http.routers.<name>-https.tls.certresolver=le' \
  --label-add 'traefik.http.services.<name>.loadbalancer.server.port=3000' \
  --label-add 'traefik.http.services.<name>.loadbalancer.passhostheader=true'
```

(same for `<stack>_api` with `api.<domain>`). Notes: use `Host("…")` with double
quotes — backticks die in the SSH/exec shell layer; the TurboOps-prepared stack
already attaches services to `traefik-public`, so no network change is needed;
Let's Encrypt issues the cert within seconds once the router exists.

**Real fix (infra decision, not per-project):** migrate the server to the
TurboOps-provisioned Traefik (`install_service` with `serviceType: TRAEFIK`) —
but ONLY with a migration plan: the deploy.party Traefik owns ports 80/443 and
serves that server's existing deploy.party stacks. Until then, treat every
TurboOps pipeline deploy to such a server as "needs the label pass afterwards".

**Verify-checklist addition:** after ANY deploy, curl the real stage URLs
(expect the app 200/302 and `GET api.<root>/health-check` 200 with a Let's
Encrypt issuer) — never trust the green deploy job alone.

### CI completeness (mirrors `pnpm run check`)

A complete pipeline is not just lint + build. In addition to `lint`, `api:test`,
`app:test` (Playwright E2E), and `build`, it must also run:

- **Frontend unit tests** — `cd projects/app && pnpm run test:unit`.
- **An `audit` job** — `pnpm audit`, and it must **BLOCK**. This page previously said
  the opposite (`allow_failure: true` / `continue-on-error: true`), which directly
  contradicts the templates: `lt-monorepo`'s own `scripts/check-ci-consistency.mjs`
  carries a rule that FAILS a pipeline holding those flags, because they suppress
  every advisory including ones nobody has assessed yet. Following the old advice
  reddened the guard. Unresolvable advisories belong in `auditConfig.ignoreGhsas`
  (pnpm-workspace.yaml), one entry each with its rationale — that is what keeps a red
  audit meaningful.

This mirrors what `pnpm run check` covers locally. The current lt-monorepo
templates already include both; if an older project's pipeline is missing them,
add them.

