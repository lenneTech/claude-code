# Release performance: diagnosing slow publishes

Part of the [`maintaining-lt-stack`](SKILL.md) skill.

## Diagnosing a slow release: separate QUEUE from WORK

`gh run list` reports a run's duration as `createdAt → updatedAt`, which includes the time the job
spent **waiting for a GitHub-hosted runner**. Comparing releases on that number diagnoses the wrong
thing: a 2026-08-19 nest-server publish looked like a 44-minute outlier against a 17-minute norm and
was in fact **25m queue + 18m work** — identical work to every neighbouring release, nothing in the
repo to fix, and nothing in the repo that could have fixed it.

Split them before drawing any conclusion:

```bash
for id in $(gh run list --workflow=publish.yml --limit 10 --json databaseId -q '.[].databaseId'); do
  gh api repos/<owner>/<repo>/actions/runs/$id \
    -q '"\((((.run_started_at|fromdate)-(.created_at|fromdate))/60)|floor)m queue + \((((.updated_at|fromdate)-(.run_started_at|fromdate))/60)|floor)m work   \(.display_title[0:34])"'
done
```

Then attribute the *work* half to a step before optimising anything:

```bash
gh api repos/<owner>/<repo>/actions/jobs/<jobId> \
  -q '.steps[] | select(.conclusion != null) | "\(((.completed_at|fromdate)-(.started_at|fromdate)))s\t\(.name)"' | sort -rn
```

## Where a publish's time actually goes (nest-server)

Measured 2026-08-22, and counter-intuitive enough to be worth writing down:

| Step | Share of an 18-minute publish |
|---|---|
| Regression evidence (`check:mutations`) | **~13 min** |
| Optimize and check (full suite + build) | ~2.5 min |
| Consumer gate (tarball into the starter) | ~1.5 min |
| **The npm publish itself** | **5 seconds** |

The 3-minute publishes up to 11.33.1 became 17-minute ones at 11.34.0 — that is when the mutation
check joined the publish path. It is a deliberate cost, not a regression.

**And the cost is not the tests.** The specs behind all 29 e2e mutations add up to ~40 seconds; the
rest is vitest's cold start paid once per mutation, 49 times. That work is largely single-threaded
I/O and barely scales with cores — the registry measures 744s on a 12-core laptop and 777s on a
4-vCPU CI runner. So **do not reach for a bigger runner first**; it buys almost nothing here.
Parallelism does: `check:mutations --jobs=4` measured 744s → 399s, with all 49 verdicts diffed
against a sequential run to prove the verdicts did not move.

Whatever you change here, that diff is the acceptance test. A faster gate that reports a different
verdict is not an optimisation — it is a broken safety net that now fails faster.
