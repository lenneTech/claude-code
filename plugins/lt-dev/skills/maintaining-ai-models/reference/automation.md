# Running the Check on a Schedule

The check needs no Claude, so it runs where nobody has to be present: a GitLab scheduled pipeline
per project. A developer machine is the wrong place: a password manager prompt that nobody
answers ends in a timeout exactly when the run is unattended (observed twice with 1Password).

## Two stages, two owners

| Stage | Runs | On a finding |
|-------|------|--------------|
| **Report** (automatic) | Weekly, `ai-models.mjs check` in CI | One Linear ticket in Triage, labelled as an AI proposal, deduplicated by fingerprint |
| **Change** (human decision) | When someone takes the ticket | `/lt-dev:backend:ai-model-review` measures the candidates; the swap ships as a normal ticket with review and approval |

Nothing in the automatic stage changes a model, a route or a parameter. Routing and switching an
option off are product decisions; a swap with a clear measured margin is prepared, not applied.

## GitLab job

```yaml
ai-models:check:
  stage: test        # any stage from the project's `stages:`; a pipeline of only .pre/.post jobs never starts
  image: node:22-alpine
  rules:
    - if: $CI_PIPELINE_SOURCE == "schedule" && $AI_MODELS_CHECK == "1"
  variables:
    # Pin the script to a commit AND its checksum: it runs with the provider key in the
    # environment, so a moved tag or branch must not be able to swap the code.
    AI_MODELS_REF: "<commit SHA of lenneTech/claude-code>"
    AI_MODELS_SHA256: "<sha256 of plugins/lt-dev/scripts/ai-models.mjs at that commit>"
  script:
    - wget -qO ai-models.mjs "https://raw.githubusercontent.com/lenneTech/claude-code/${AI_MODELS_REF}/plugins/lt-dev/scripts/ai-models.mjs"
    - echo "${AI_MODELS_SHA256}  ai-models.mjs" | sha256sum -c -
    - code=0; node ai-models.mjs check --no-runtime --since-days 8 --out ai-models-report || code=$?
    - if [ "$code" -ge 1 ]; then node ai-models.mjs ticket --report ai-models-report/report.json --team "$LINEAR_TEAM_KEY"; fi
    - if [ "$code" -ge 3 ]; then exit 1; fi
  artifacts:
    when: always
    paths: [ai-models-report/]
    expire_in: 30 days
```

The checksum for a commit: `curl -sL <raw URL at that SHA> | sha256sum`. Updating the script
is a deliberate change of both variables.

### Keep the project's own jobs out of the schedule

A scheduled pipeline runs every job whose rules match its branch. In the lt-monorepo template
that is lint, tests, build, `turboops-build` and `deploy-dev` on `dev`, and `deploy-prod` on a
protected `main`: a weekly check would redeploy a stage every week with nobody watching. Exclude
every other job from this schedule before creating it:

```yaml
# Jobs and templates with `rules:` (turboops-build, deploy-dev, deploy-prod, …): first rule
  rules:
    - if: $AI_MODELS_CHECK == "1"
      when: never
    - if: …                       # the job's existing rules follow unchanged

# Jobs and templates with `only:` (e.g. `.distributed`)
  except:
    variables:
      - $AI_MODELS_CHECK == "1"
```

Then trigger the schedule once by hand (CI/CD → Schedules → run) and confirm that the pipeline
contains `ai-models:check` and nothing else.

### CI/CD variables

| Variable | Masked | Purpose |
|----------|--------|---------|
| The adapter's `keyEnv` (e.g. `MITTWALD_API_KEY`) | yes | Catalog and probes. A test key works for the catalog when the provider offers both keys the same models; check that once |
| `LINEAR_API_KEY` | yes | Filing the ticket (personal API key of a service account) |
| `LINEAR_TEAM_KEY` | no | Team the ticket goes to, e.g. `DEV` |
| `AI_MODELS_CHECK` | no | `1` on the schedule that should run the check |
| `GITHUB_TOKEN` | yes, optional | Only when the runner's IP hits GitHub's unauthenticated API limit (60 requests per hour) |

### Schedule

CI/CD → Schedules → weekly, on the default branch, with `AI_MODELS_CHECK=1`. `--since-days 8`
overlaps the weekly interval by a day, so no provider documentation change falls between two
runs. Add `--probe` when the key may spend a few tokens per usage and week.

## The ticket

`ai-models.mjs ticket` follows the rules of the `filing-ai-proposed-tickets` skill: Triage state
(the unstarted state when the team has no Triage), the team's AI label (`KI-Vorschlag` and the
other recognised names; created once when none exists), unassigned, no priority. Its description
lists the findings and ends with an `ai-models-fingerprint` comment.

A later run with the same findings files nothing while a ticket with that fingerprint is open or
was declined (canceled): Triage said no to these facts, and repeating them weekly is noise. A
completed ticket lets the same findings through again, because the fix did not remove them.
Changed facts (a new date, another model) give a new fingerprint and a new ticket. `--dry-run`
prints the ticket instead of filing it.

## Costs

Measured on one project with five usages (2026-10-13):

| Part | Cost |
|------|------|
| `check` without probes | About 1 second; one `GET /models` per provider, one raw file and one GitHub API call for the mittwald lifecycle; no tokens |
| `check --probe` | Per usage two to eight small chat calls (the reasoning probe allows up to 2,048 tokens per call); provider tokens only |
| Report | About 1.9 KB Markdown, 4.3 KB JSON |
| Claude | None in the automatic stage. The measurement is a normal `/lt-dev:backend:ai-model-review` session, started when someone takes the ticket |

## Several projects at once

Each project carries its own job and adapter, so findings land in the right team. A central
operations repository looping over a project list is an alternative when many projects share one
provider key; it then needs read access to each project's adapter and one ticket per project.
