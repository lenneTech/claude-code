---
name: validating-ci-pipelines-locally
description: 'Single source of truth for executing GitLab CI/CD pipelines locally with the same image, env vars, and service containers as the real runner — so pipeline failures are caught before push. Defines pipeline discovery (.gitlab-ci.yml + includes), per-job execution via gitlab-runner exec, service-container orchestration (Mongo, Redis, MailHog), env injection without secrets, cache/artifact handling, and a job-by-job verdict report. Also describes the GitHub Actions equivalent via act for projects that mirror to GitHub. Activates whenever an agent or command needs to validate that the CI pipeline will pass — currently used by /lt-dev:production-ready and lt-dev:production-readiness-orchestrator. NOT for running the local check script (use running-check-script). NOT for writing or refactoring CI configs (use the devops agent).'
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
| GitLab | `gitlab-runner` | `brew install gitlab-runner` | `curl -L https://packages.gitlab.com/install/repositories/runner/gitlab-runner/script.deb.sh \| sudo bash; sudo apt-get install gitlab-runner` | `docker run --rm -v $(pwd):/builds gitlab/gitlab-runner exec docker <job>` |
| GitHub Actions | `act` | `brew install act` | `curl -L https://raw.githubusercontent.com/nektos/act/master/install.sh \| sudo bash` | n/a |

If the local toolchain cannot be installed, fall back to the image-only path. If even that is impossible (no Docker), the consumer must classify Phase 7 as **BLOCKED — runner toolchain unavailable** and stop.

Verification:

```bash
gitlab-runner --version
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

Each job declares an image. The local execution MUST use the **same** image so dependency versions match:

```yaml
# Example .gitlab-ci.yml job
test:
  image: node:22.11.0-alpine
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

### Path A — `gitlab-runner exec docker` (preferred, full fidelity)

```bash
gitlab-runner exec docker <job-name> \
  --docker-pull-policy if-not-present \
  --env CI_PROJECT_DIR=/builds/project \
  --env-file .env.ci  # only if you genuinely need extra env; never commit this file
```

Caveats:

- `gitlab-runner exec docker` does not natively support `services:` in newer runner versions (deprecated in 16+). For modern runners, use Path B.
- Cache and artifacts are best-effort — they do not round-trip through GitLab's storage.
- `CI_*` predefined variables are partially populated; some integration tests that branch on `CI_COMMIT_REF_NAME` etc may need explicit `--env CI_COMMIT_REF_NAME=local`.

### Path B — Manual reproduction with Docker Compose (modern runner, full services support)

When `gitlab-runner exec` cannot mount the services, build a minimal `docker-compose.ci.yml` per pipeline run:

```yaml
# docker-compose.ci.yml (generated on the fly, do not commit)
services:
  mongo:
    image: mongo:7.0
    healthcheck: { test: ["CMD", "mongosh", "--eval", "db.runCommand('ping')"], interval: 5s }
  redis:
    image: redis:7-alpine
    healthcheck: { test: ["CMD", "redis-cli", "ping"], interval: 5s }
  job:
    image: node:22.11.0-alpine
    depends_on:
      mongo: { condition: service_healthy }
      redis: { condition: service_healthy }
    working_dir: /builds/project
    volumes:
      - .:/builds/project
    environment:
      NODE_ENV: ci
      NSC__MONGOOSE__URI: mongodb://mongo:27017/lt-test
      REDIS_URL: redis://redis:6379
    command: sh -c "<job script joined with && >"
```

```bash
docker compose -f docker-compose.ci.yml run --rm job
```

This is the most faithful reproduction and works for any runner version.

### Path C — `act` for GitHub Actions

```bash
act -j <job-name> \
  --env-file .env.ci.example \
  --container-architecture linux/amd64    # required on Apple Silicon for x86 actions
```

Use the medium image (`-P ubuntu-latest=catthehacker/ubuntu:act-latest`) for parity with GitHub-hosted runners.

## Step 6 — Env-var handling (never commit secrets)

CI jobs reference secrets via `$CI_TOKEN`, `$DEPLOY_KEY`, etc. For local reproduction:

1. **List required secrets** — `grep -E "\\$[A-Z_]+" .gitlab-ci.yml | sort -u`.
2. **Source from existing local env** — `~/.lenneTech/ci-secrets.env` (gitignored, user-maintained) is the convention.
3. **Generate placeholders for non-sensitive vars only** — `CI_COMMIT_REF_NAME`, `CI_PIPELINE_ID`, etc.
4. **Skip jobs that require unavailable secrets** — classify as `SKIPPED — secret unavailable: <NAME>` rather than fabricating values.

The consumer NEVER writes a real secret into a tracked file or into the prompt.

## Step 7 — Cache & Artifact handling

Local runs do not have GitLab's cache/artifact storage. Substitute as follows:

| Concern | Local strategy |
|---------|----------------|
| `cache.paths` (e.g. `node_modules/`) | Persist across runs in a host-mounted volume; warm before first job |
| `artifacts.paths` (e.g. `coverage/`, `dist/`) | Copy out of the container after the job to `tmp/ci-artifacts/<job>/` |
| `dependencies:` (downstream job consumes upstream artifacts) | Stage artifacts on the host between jobs; mount into next job |

If the pipeline depends on a stage's artifact, run the prior stage first, copy artifacts out, then run the dependent stage with that directory mounted.

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

Re-run the failed job after each remediation. Stop when GREEN or after the configured `--max-iterations` limit.

## Step 9 — Output & evidence

Save the following to `tmp/ci-local/`:

- `<job-name>.log` — full stdout/stderr per job
- `<job-name>.exit` — exit code per job
- `report.md` — the canonical report block (below)

The directory is gitignored; treat it as scratch state.

## Step 10 — Report block (canonical)

Every consumer ends Phase 7 with this block:

```
### Local CI Pipeline Report

Format: <gitlab|github|both>
Runner: <gitlab-runner|act|docker-compose>
Image parity: <PASS|FAIL>  (mismatch: <comma-separated jobs>)

| Job | Stage | Image | Result | Duration | Iterations | Notes |
|-----|-------|-------|--------|----------|-------------|-------|
| install      | build | node:22.11.0-alpine | PASS    | 42s | 1 | — |
| lint         | test  | node:22.11.0-alpine | PASS    | 18s | 1 | — |
| typecheck    | test  | node:22.11.0-alpine | PASS    | 33s | 1 | — |
| test         | test  | node:22.11.0-alpine | FAIL    | 2m  | 3 | flaky DB seed — fixed in commit abc123 |
| build        | build | node:22.11.0-alpine | PASS    | 1m  | 1 | — |
| audit        | test  | node:22.11.0-alpine | SKIPPED | —   | — | requires CI_TOKEN |

Global verdict: <PASS|PARTIAL|FAIL>
Failing jobs: <comma-separated or "none">
Skipped jobs: <comma-separated or "none">
```

## Cross-Skill References

- **Runnability:** `running-check-script` (called from inside any `pnpm run check` job)
- **DevOps configuration baseline:** `lt-dev:devops-reviewer` agent (architectural review of CI configs)
- **Server lifecycle (when a job needs an API up):** `managing-dev-servers`
- **Production gate (parent):** `validating-production-readiness` (CI PASS is one of the entry criteria)
