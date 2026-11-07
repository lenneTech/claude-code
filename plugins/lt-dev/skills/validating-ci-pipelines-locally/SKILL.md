---
name: validating-ci-pipelines-locally
description: 'Runs GitLab CI/CD pipelines locally with the real runner''s image, env vars and service containers (gitlab-runner exec; act for GitHub Actions), so failures surface before the push. Activates on "Pipeline lokal testen", "warum failt die CI", .gitlab-ci.yml changes, or before a push that must not break CI. NOT for the local check script (use running-check-script). NOT for authoring CI configs (use the devops agent).'
user-invocable: false
---

# Validating CI Pipelines Locally

This skill is the **single source of truth** for reproducing a GitLab (or GitHub Actions) pipeline locally. The goal is to catch pipeline failures **before** pushing to the remote — using the same Docker image, the same env vars, and the same service containers as the real runner.

> **Goal:** Run every job from `.gitlab-ci.yml` (or `.github/workflows/*.yml`) on the local machine with results that mirror what the remote runner would produce.

## When to Use This Skill

| Caller | Phase | Trigger |
|--------|-------|---------|
| `/lt-dev:production-ready` | Phase 7 | Hard release gate — must pass before sign-off |
| `lt-dev:production-readiness-orchestrator` | Phase 7 | Owns the per-job execution + retry loop |
| Manual user invocation | Pre-push | Reproducing a CI failure locally without the round-trip |

## Step 1 — Detect the pipeline format

The repo may use GitLab, GitHub Actions, or both. Detect first:

```bash
# GitLab
test -f .gitlab-ci.yml && echo "gitlab" || true
ls .gitlab-ci/*.yml 2>/dev/null    # included files

# GitHub Actions
ls .github/workflows/*.yml 2>/dev/null
```

If multiple formats exist, the consumer asks the user which to validate. If `--ci=<gitlab|github|both>` was passed, honour it.

## Step 2 — Ensure the runner toolchain is installed

| Format | Tool | Install (macOS) | Install (Linux) | Image-only fallback |
|--------|------|-----------------|------------------|----------------------|
| GitLab | `gitlab-runner exec` (Runner 16.x only) | none: a current `brew install gitlab-runner` has no `exec` | none: the same holds for the apt package | `gitlab/gitlab-runner:v16.10.1`, see Path A |
| GitHub Actions | `act` | `brew install act` | `curl -L https://raw.githubusercontent.com/nektos/act/master/install.sh \| sudo bash` | n/a |

GitLab jobs need only Docker: Path A runs the pinned runner image, Path B plain Docker Compose. Without Docker, the consumer must classify Phase 7 as **BLOCKED — runner toolchain unavailable** and stop.

Verification:

```bash
gitlab-runner --version    # optional: an installed runner serves Path A only at 16.x
act --version
docker info >/dev/null 2>&1
```

## Step 3 — Parse the pipeline & enumerate jobs

For GitLab:

```bash
# Resolve all included files into a flat job list (yq is the cleanest path)
yq eval '.. | select(has("script") or has("trigger")) | path | .[-1]' .gitlab-ci.yml

# Or, with awk fallback if yq is missing:
grep -E "^[a-zA-Z0-9_-]+:" .gitlab-ci.yml | grep -v "^stages:\|^variables:\|^default:\|^include:" | sed 's/:$//'
```

For GitHub Actions:

```bash
yq eval '.jobs | keys' .github/workflows/*.yml
```

Order the jobs by stage (`stages:` field in GitLab; jobs in GitHub default to graph order via `needs:`). The consumer executes them in that order.

### Check whether a job has *ever* run

A job restricted to `only: merge_requests` (GitLab) or `on: pull_request`
(GitHub) never executes on a direct push. In a repository where everybody pushes
straight to `dev`/`main`, such a job can sit broken for months and nobody
notices — its first real execution is somebody's first merge request, which then
fails for reasons that have nothing to do with their change.

Before trusting a green pipeline history, confirm the test jobs actually ran.
This uses the GitLab CLI `glab` (authenticate once with `glab auth login`) and `jq`:

```bash
proj="<url-encoded-path>"   # e.g. group%2Fsubgroup%2Fproject

# List the job names of the 10 most recent pipelines — do api:test / app:test appear at all?
glab api "projects/$proj/pipelines?per_page=10" | jq -r '.[].id' | while read -r pid; do
  echo "pipeline $pid:"
  glab api "projects/$proj/pipelines/$pid/jobs" | jq -r '.[] | "  \(.name) [\(.status)]"'
done

# Any merge request ever? (jq prints 0 ⇒ none exist ⇒ merge_requests-only jobs have never run)
glab api "projects/$proj/merge_requests?state=all&per_page=1" | jq 'length'
```

If the last command prints `0`, the `merge_requests`-only jobs have never been
executed. Treat them as **unverified**, not as passing. Typical breakage found
this way: service containers addressed as `127.0.0.1` instead of their service
hostname, and `cd x && cmd &` backgrounding the whole compound so the subsequent
`cd ..` walks out of the workspace.

## Step 4 — Resolve the runner image per job

Each job declares an image. The local execution uses the **same** image so dependency versions match:

```yaml
# Example .gitlab-ci.yml job
test:
  image: node:22-alpine
  services:
    - mongo:7.0
    - redis:7-alpine
  variables:
    NODE_ENV: ci
    NSC__MONGOOSE__URI: mongodb://mongo:27017/lt-test
  script:
    - pnpm install --frozen-lockfile
    - pnpm run check
```

Extract:

- `image:` (mandatory)
- `services:` (zero or more)
- `variables:` (job-level + global `variables:` block, merged with job-level winning)
- `before_script:` + `script:` + `after_script:` (concatenate)
- `cache:` (key + paths)
- `artifacts:` (paths + when)

If a job inherits from `default:` or extends another job, resolve the merged result before execution.

## Step 5 — Execute the job locally

### Path A — `gitlab-runner exec docker` (the real runner, committed `HEAD`)

`exec` exists only up to GitLab Runner 16.x; 17.0 removed it ("Remove `gitlab-runner exec` command !4740"), so a
current install has none. Run it from the pinned image. The runner starts the job and service containers on the host
daemon through the socket, and mounts the checkout by its host path, so the path inside must be the same:

```bash
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock -v "$PWD:$PWD" -w "$PWD" \
  gitlab/gitlab-runner:v16.10.1 exec docker <job-name> \
  --docker-pull-policy if-not-present \
  --env CI_COMMIT_REF_NAME=local   # one --env NAME=value per extra variable; exec has no env-file flag
```

An installed 16.x runner takes the same arguments (`gitlab-runner exec docker <job-name> …`). The pin is 16.10.1
because 16.11's `exec` reads `extensions.objectFormat` through `git config` and aborts in every repository that does
not set it.

Caveats:

- `exec` tests the committed `HEAD`: it clones from the checkout (mounted read-only, so it writes nothing there) and
  leaves uncommitted changes out. It reads `.gitlab-ci.yml` without resolving `include:`, `extends:` or `rules:`, and
  it does start `services:`. A job built from those keywords, or a run that has to include uncommitted fixes, goes
  through Path B.
- Cache and artifacts are best-effort — they do not round-trip through GitLab's storage.
- `CI_*` predefined variables are partially populated; some integration tests that branch on `CI_COMMIT_REF_NAME` etc may need explicit `--env CI_COMMIT_REF_NAME=local`.
- Cleanup is the runner's own: it removes its job, service and helper containers and its build volume when the job
  ends, green, red or stopped with `kill -INT` (measured 2026-11-07 with 16.10.1: nothing left, also for a job with
  `cache:`), so the job cache does not outlive the run. Leave out `--docker-volumes /cache`: it creates a
  `runner--project-0-concurrent-0-cache-<hash>` volume that every local `exec` run on the machine shares and nothing
  removes. A natively installed runner stopped with `kill -9` skips its cleanup, and its containers carry only labels a
  peer's local run carries too (`com.gitlab.gitlab-runner.managed=true`), so list them and name them in the report
  instead of removing them by label. The pulled runner, helper and job images stay for the next run; the
  `cleaning-up-disk-space` skill's image guard removes them once unused.

### Path B — Docker Compose on a throwaway copy (any job, uncommitted changes included)

When Path A does not fit, generate a minimal compose file per job run. It lives outside the checkout, runs under a
project name of its own, and mounts a throwaway copy of the checkout. The job's install writes Linux `node_modules`,
`dist` and `coverage` into whatever it mounts, which in the developer's checkout would replace the native binaries
their dev server needs; and without its own `-p` the stack takes the folder name as project name and joins the
developer's compose stack, where an `--remove-orphans` from either side removes the other's containers.

```yaml
# "$ci_dir/docker-compose.ci.yml": generated per job run, never in the checkout
services:
  mongo:
    image: mongo:7.0
    healthcheck: { test: ["CMD", "mongosh", "--eval", "db.runCommand('ping')"], interval: 5s }
  redis:
    image: redis:7-alpine
    healthcheck: { test: ["CMD", "redis-cli", "ping"], interval: 5s }
  job:
    image: node:22-alpine
    depends_on:
      mongo: { condition: service_healthy }
      redis: { condition: service_healthy }
    working_dir: /builds/project
    volumes:
      - ./src:/builds/project   # the throwaway copy next to this file
    environment:
      NODE_ENV: ci
      NSC__MONGOOSE__URI: mongodb://mongo:27017/lt-test
      REDIS_URL: redis://redis:6379
    command: sh -c "<job script joined with && >"
```

The file publishes no `ports:`: the job reaches its services by service name, as on the runner, and no fixed host
port collides with a peer's run. One Bash call per job run creates the copy and the stack and removes both in its
`trap`, so a red job or a failing step cleans up too:

```bash
mkdir -p tmp/ci-local
run="$(date +%s)-$$"; proj="ci-$run"; ci_dir="$(mktemp -d)"
cleanup() {
  docker compose -p "$proj" -f "$ci_dir/docker-compose.ci.yml" down -v --remove-orphans
  # Linux: the container wrote root-owned files into the copy, so remove them through the job image
  rm -rf "$ci_dir" 2>/dev/null || { docker run --rm -v "$ci_dir:/x" <job-image> rm -rf /x/src; rm -rf "$ci_dir"; }
}
trap cleanup EXIT
echo "$proj $ci_dir" >> tmp/ci-local/resources.txt   # for Step 9, when the trap cannot fire
git clone --quiet --no-checkout "$(git rev-parse --show-toplevel)" "$ci_dir/src"
git -C "$ci_dir/src" checkout --quiet --detach "$(git rev-parse HEAD)"
git diff --quiet HEAD || git diff --binary HEAD | git -C "$ci_dir/src" apply   # uncommitted changes to tracked files
# write "$ci_dir/docker-compose.ci.yml" as above, then:
docker compose -p "$proj" -f "$ci_dir/docker-compose.ci.yml" run --rm job > tmp/ci-local/<job-name>.log 2>&1
echo $? > tmp/ci-local/<job-name>.exit
# copy artifacts.paths out of "$ci_dir/src" here, before the trap removes the copy (Step 7)
```

`run --rm` removes only the job container; `down -v --remove-orphans` with the run's `-p` removes the services
`depends_on` started, their anonymous volumes (the `mongo` image declares two) and the network. Files not yet added to
git stay out of the copy, as they would stay out of the push: `git add` new files first. Path B works for any job and
any runner version.

### Path C — `act` for GitHub Actions

```bash
act -j <job-name> --rm \
  --env-file .env.ci.example \
  --container-architecture linux/amd64    # required on Apple Silicon for x86 actions
```

Use the medium image (`-P ubuntu-latest=catthehacker/ubuntu:act-latest`) for parity with GitHub-hosted runners.

act copies the checkout into the job container, so it writes nothing there. A green job's containers and volumes are
removed either way; `--rm` removes those of a failed job too, which act otherwise keeps and the retry loop piles up.
Leave out `--reuse`, which keeps them on purpose. The `act-toolcache` volume is a cache every act run on the machine
shares; it stays.

## Step 6 — Env-var handling (never commit secrets)

CI jobs reference secrets via `$CI_TOKEN`, `$DEPLOY_KEY`, etc. For local reproduction:

1. **List required secrets** — `grep -E "\\$[A-Z_]+" .gitlab-ci.yml | sort -u`.
2. **Source from existing local env** — `~/.lenneTech/ci-secrets.env` (gitignored, user-maintained) is the convention.
3. **Generate placeholders for non-sensitive vars only** — `CI_COMMIT_REF_NAME`, `CI_PIPELINE_ID`, etc.
4. **Skip jobs that require unavailable secrets** — classify as `SKIPPED — secret unavailable: <NAME>` rather than fabricating values.

The consumer never writes a real secret into a tracked file or into the prompt: a tracked file gets pushed, and the prompt ends up in the session transcript.

## Step 7 — Cache & Artifact handling

Local runs do not have GitLab's cache/artifact storage. Substitute as follows:

| Concern | Local strategy |
|---------|----------------|
| `cache.paths` (e.g. `node_modules/`) | Not carried between runs: each job starts cold, like a CI job whose cache missed. A cache volume kept across runs would be shared with every parallel session on the daemon and never removed |
| `artifacts.paths` (e.g. `coverage/`, `dist/`) | Copy out after the job to `tmp/ci-artifacts/<job>/`; in Path B from `"$ci_dir/src/<path>"`, in the same Bash call, before the trap removes the copy |
| `dependencies:` (downstream job consumes upstream artifacts) | Stage artifacts on the host between jobs; copy them into the next job's copy before it runs |

If the pipeline depends on a stage's artifact, run the prior stage first, copy artifacts out, then run the dependent stage with them copied into its copy.

## Step 8 — Per-job verdict & retry loop

After each job finishes:

| Outcome | Action |
|---------|--------|
| Exit 0 | `PASS` |
| Exit non-zero, deterministic | `FAIL` — capture stderr, classify the root cause (env-mismatch / dependency / code) |
| Exit non-zero, transient (network, image pull) | Retry up to 2 times before classifying as `FAIL` |
| Job not runnable locally (missing secret, requires GitLab service like `gitlab-pages`) | `SKIPPED` — surface clearly in the report |

For `FAIL` outcomes, the consumer (when called from `/lt-dev:production-ready`) attempts remediation:

| Failure category | Default fix |
|------------------|-------------|
| Lockfile drift (`pnpm install --frozen-lockfile` fails) | Run `pnpm install`, commit the updated lockfile |
| Wrong Node major in image | Update `.nvmrc` / `package.json#engines` to match the CI image |
| `pnpm run check` fails | Defer to the `running-check-script` skill's iterate-until-green loop |
| Test flake | Re-run; if persistent, mark as `FAIL` and surface to test-reviewer |
| Service health-check timeout | Increase the compose-level `healthcheck.start_period`; investigate slow startup |
| Missing image (`pull error`) | Pre-pull with `docker pull <image>`; check for typo / private registry auth |

Re-run the failed job after each remediation. Each re-run is a new Path B run with its own name, a fresh copy that
picks up the fix, and its own trap. Stop when GREEN or after the configured `--max-iterations` limit.

## Step 9 — Remove what the run created

Run this whatever the outcome: all green, a job still red at the iteration cap, a `BLOCKED` classification, or a stop.
Each Path B run removes its stack and copy in its trap; this step catches the runs whose trap could not fire (a killed
shell, a Bash timeout):

```bash
[ -f tmp/ci-local/resources.txt ] && while read -r proj dir; do
  [ -d "$dir" ] || continue   # the trap already removed this run
  docker compose -p "$proj" -f "$dir/docker-compose.ci.yml" down -v --remove-orphans
  rm -rf "$dir"
done < tmp/ci-local/resources.txt
rm -f tmp/ci-local/resources.txt
```

Paths A and C clean up after themselves (see their notes). Only names this run created are touched: no prune, no
removal by name pattern, no `docker compose down` without the run's own `-p`, because every session on the machine
shares the Docker daemon (the `managing-dev-servers` skill, section Docker resources, worktrees and clones). Whatever
stays, such as the containers of a runner killed hard, goes into the report's `Left behind:` line.

## Step 10 — Output & evidence

Save the following to `tmp/ci-local/`:

- `<job-name>.log` — full stdout/stderr per job
- `<job-name>.exit` — exit code per job
- `resources.txt` — compose project and copy of each Path B run, until Step 9 has removed them
- `report.md` — the canonical report block (below)

The directory is gitignored; treat it as scratch state.

## Step 11 — Report block (canonical)

Every consumer ends Phase 7 with this block:

```
### Local CI Pipeline Report

Format: <gitlab|github|both>
Runner: <gitlab-runner|act|docker-compose>
Image parity: <PASS|FAIL>  (mismatch: <comma-separated jobs>)

| Job | Stage | Image | Result | Duration | Iterations | Notes |
|-----|-------|-------|--------|----------|-------------|-------|
| install      | build | node:22-alpine | PASS    | 42s | 1 | — |
| lint         | test  | node:22-alpine | PASS    | 18s | 1 | — |
| typecheck    | test  | node:22-alpine | PASS    | 33s | 1 | — |
| test         | test  | node:22-alpine | FAIL    | 2m  | 3 | flaky DB seed — fixed in commit abc123 |
| build        | build | node:22-alpine | PASS    | 1m  | 1 | — |
| audit        | test  | node:22-alpine | SKIPPED | —   | — | requires CI_TOKEN |

Global verdict: <PASS|PARTIAL|FAIL>
Failing jobs: <comma-separated or "none">
Skipped jobs: <comma-separated or "none">
Left behind: <"none" or each container, volume or copy that stays, and why>
```

## Related Skills

- **Runnability:** `running-check-script` (called from inside any `pnpm run check` job)
- **DevOps configuration baseline:** `lt-dev:devops-reviewer` agent (architectural review of CI configs)
- **Server lifecycle (when a job needs an API up) and Docker cleanup:** `managing-dev-servers` (section Docker resources, worktrees and clones)
- **Production gate (parent):** `validating-production-readiness` (CI PASS is one of the entry criteria)
- **Deployment:** `deploying-to-turboops` (run this skill before a push that triggers a TurboOps deploy, so a red deploy is never a CI surprise)
- **Authoring CI configs:** `lt-dev:devops` agent (writes and changes `.gitlab-ci.yml`; this skill only runs it)
