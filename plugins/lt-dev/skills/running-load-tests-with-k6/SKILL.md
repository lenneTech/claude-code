---
name: running-load-tests-with-k6
description: 'Single source of truth for designing, running, and interpreting k6 load tests against lenne.tech fullstack APIs. Defines installation paths (brew, docker, npm), the three canonical scenarios (smoke / load / soak), endpoint discovery from the generated SDK, realistic Better-Auth login flows, threshold defaults for ~10 concurrent users (p95 < 500ms, error rate < 1%, http_req_failed < 1%), result interpretation, and the optimisation ladder when the system fails (DB indices, query rewrites, caching, connection pool sizing, rate-limit relaxation, payload trimming). Activates whenever an agent or command needs to validate that the API is stable for ~10 concurrent users performing many actions in short time, or to detect performance regressions via k6. Currently used by /lt-dev:production-ready, lt-dev:production-readiness-orchestrator, and lt-dev:performance-reviewer. NOT for Lighthouse frontend performance (use a11y-reviewer). NOT for unit performance assertions (use the test runner directly).'
user-invocable: false
---

# Running Load Tests with k6

This skill is the **single source of truth** for k6 load tests in the lenne.tech stack. It exists so every consumer (command, agent, reviewer) produces comparable scenarios with the same thresholds, the same auth flow, and the same optimisation ladder.

> **Goal:** Prove the API is stable for **10 concurrent users performing many actions in a short time window** — and surface concrete optimisation steps when it is not.

## When to Use This Skill

| Caller | Phase | Trigger |
|--------|-------|---------|
| `/lt-dev:production-ready` | Phase 3 | Mandatory load-test gate before sign-off |
| `lt-dev:production-readiness-orchestrator` | Phase 3 | Runs the scenarios, owns the optimisation loop |
| `lt-dev:performance-reviewer` | Phase 7 (optional) | Regression check vs baseline JSON |
| Manual user invocation | Ad-hoc | Reproducing a customer-reported slowness |

## Step 1 — Ensure k6 is available

Detect first, install only when missing.

```bash
command -v k6 >/dev/null 2>&1 && k6 version || echo "missing"
```

Install paths in order of preference:

| Platform | Command |
|----------|---------|
| macOS | `brew install k6` |
| Linux (deb) | `sudo gpg -k; sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69; echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list; sudo apt-get update; sudo apt-get install k6` |
| Any (no install) | `docker run --rm -i --network host grafana/k6:latest run -` (pipes script via stdin) |
| CI / no sudo | Download static binary from `https://github.com/grafana/k6/releases/latest` and place on `$PATH` |

Never call `npm install -g k6` — that package is a placeholder and not the real binary.

If k6 cannot be installed at all, the consumer must classify Phase 3 as **BLOCKED — k6 unavailable** and stop. Never silently skip the load test.

## Step 2 — Resolve the API base URL and warm-up the server

The base URL must come from a deterministic source — pick the first that resolves:

1. `$API_BASE_URL` environment variable
2. `lt.config.json` → `ports.api` → `http://localhost:<port>`
3. `~/.lenneTech/ports.json` registry entry for the current project slug
4. `projects/api/src/config.env.ts` default (`PORT`)
5. Fallback `http://localhost:3000`

The API must already be running when k6 starts. If the consumer detects no listening server, start it via the `managing-dev-servers` skill (`lt dev up` preferred, otherwise `pnpm run dev` with `run_in_background: true`) and wait for `GET /meta` (or `/health`) to return 200 before calling k6.

## Step 3 — Discover the endpoint surface

Pull the realistic endpoint list from the generated SDK so the load test exercises actual code paths, not invented URLs.

```bash
# Backend (NestJS) — Swagger contract
curl -s "${API_BASE_URL}/api-json" | jq -r '.paths | keys[]'

# Frontend SDK — generated REST client
test -f projects/app/app/api/sdk.gen.ts && grep -E "url: '/" projects/app/app/api/sdk.gen.ts | sort -u
```

Pick a representative subset for the scenario (typically 5–8 endpoints). Always include:

- One auth endpoint (`POST /auth/sign-in`)
- One read-heavy list endpoint (e.g. `GET /users` with paging)
- One read-heavy detail endpoint (`GET /users/:id` or similar)
- One write endpoint (POST/PATCH) that exercises a realistic mutation
- One filter/search endpoint if available

## Step 4 — Authenticate via Better-Auth (the realistic path)

The lt-stack ships Better-Auth in cookie mode. Don't bypass it — load tests that hit `/auth/sign-in` and propagate the session cookie find real bugs (DB pool exhaustion under login storm, refresh-token contention, etc).

Test users come from the seed script. Either reuse the deterministic seeded credentials or call the seed script before the run:

```bash
test -f projects/api/scripts/seed.ts && pnpm --filter @projects/api run seed
```

In the k6 script, log in once per VU in `setup()` and pass the cookie via shared state to keep auth out of the per-iteration timing. Default test users follow the seed convention (`user-1@example.com … user-10@example.com`, password `Password!23`) — verify against the actual seed script before relying on this.

## Step 5 — Three canonical scenarios

Use exactly these three scenarios. The default for `/lt-dev:production-ready` Phase 3 is **load**; **smoke** is the pre-check; **soak** runs only when the user passes `--include-soak`.

### Smoke (1 VU, 1 minute) — sanity check before the real run

```js
// k6/scenarios/smoke.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 1,
  duration: '1m',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
  },
};
```

### Load (10 VUs ramp + steady, ~5 minutes) — the production-ready gate

```js
// k6/scenarios/load.js
export const options = {
  stages: [
    { duration: '30s', target: 10 },  // ramp up
    { duration: '4m',  target: 10 },  // steady state
    { duration: '30s', target: 0  },  // ramp down
  ],
  thresholds: {
    http_req_failed:   ['rate<0.01'],
    http_req_duration: ['p(95)<500', 'p(99)<1500'],
    checks:            ['rate>0.99'],
  },
};
```

### Soak (10 VUs, 30 minutes) — long-running stability check

```js
// k6/scenarios/soak.js
export const options = {
  vus: 10,
  duration: '30m',
  thresholds: {
    http_req_failed:   ['rate<0.01'],
    http_req_duration: ['p(95)<500'],
  },
};
```

The **soak** scenario detects memory leaks, connection-pool exhaustion, and slow-growing GC pressure that load misses. Run it as a long-running background process via `run_in_background: true` and re-poll its summary file at the end.

## Step 6 — A complete script template

Place all k6 scripts under `tests/load/` (create the directory if missing). One scenario per file plus a shared `helpers.js`.

```js
// tests/load/helpers.js
import http from 'k6/http';
import { check } from 'k6';

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:3000';

export function login(email, password) {
  const res = http.post(`${BASE_URL}/auth/sign-in/email`, JSON.stringify({ email, password }), {
    headers: { 'Content-Type': 'application/json' },
  });
  check(res, { 'login 200': (r) => r.status === 200 });
  return res.cookies; // propagate as Cookie header in subsequent calls
}

export function authedHeaders(cookies) {
  const cookieHeader = Object.entries(cookies)
    .flatMap(([name, arr]) => arr.map((c) => `${name}=${c.value}`))
    .join('; ');
  return { 'Content-Type': 'application/json', Cookie: cookieHeader };
}

export { BASE_URL };
```

```js
// tests/load/load.js
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { BASE_URL, login, authedHeaders } from './helpers.js';

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '4m',  target: 10 },
    { duration: '30s', target: 0  },
  ],
  thresholds: {
    http_req_failed:   ['rate<0.01'],
    http_req_duration: ['p(95)<500', 'p(99)<1500'],
    checks:            ['rate>0.99'],
  },
};

export function setup() {
  const cookies = login(`user-${(__VU % 10) + 1}@example.com`, 'Password!23');
  return { cookies };
}

export default function (data) {
  const headers = authedHeaders(data.cookies);

  group('list users', () => {
    const r = http.get(`${BASE_URL}/users?take=20`, { headers });
    check(r, { 'list 200': (x) => x.status === 200 });
  });

  group('user detail', () => {
    const r = http.get(`${BASE_URL}/users/me`, { headers });
    check(r, { 'me 200': (x) => x.status === 200 });
  });

  group('write action', () => {
    const r = http.patch(
      `${BASE_URL}/users/me`,
      JSON.stringify({ lastSeen: new Date().toISOString() }),
      { headers },
    );
    check(r, { 'patch 200/204': (x) => x.status === 200 || x.status === 204 });
  });

  sleep(Math.random() * 1); // 0–1s think time, keeps it spiky
}
```

Run it:

```bash
API_BASE_URL=http://localhost:3000 k6 run --summary-export=tests/load/summary-load.json tests/load/load.js
```

## Step 7 — Default thresholds (10 concurrent users, many actions, short window)

| Metric | Target | Rationale |
|--------|--------|-----------|
| `http_req_failed` rate | < 1% | One in a hundred is the edge of acceptable for a production API |
| `http_req_duration` p95 | < 500 ms | Keeps perceived UI latency below the 1s rule |
| `http_req_duration` p99 | < 1500 ms | Tail latency must not be catastrophic |
| `checks` pass rate | > 99% | Functional assertions in the script must hold |
| `iteration_duration` p95 | < scenario-specific | Compute as p95(durations of all groups in one iteration) |
| `vus_max` reached | exactly the configured target | If k6 cannot ramp to target, the runtime is the bottleneck — investigate first |

Override via CLI: `k6 run -e P95_MAX=300 ...` and read in the script with `__ENV.P95_MAX`.

## Step 8 — Optimisation ladder (when thresholds fail)

The consumer (command/agent) MUST iterate this ladder, re-running the load scenario after each step, until thresholds pass or all steps are exhausted.

| # | Investigation | Typical Fix |
|---|---------------|-------------|
| 1 | **MongoDB profiler** — `db.setProfilingLevel(1, { slowms: 100 })`, run scenario, inspect `system.profile` for missing index hits | Add compound index covering the slow query; set TTL where appropriate |
| 2 | **Slow query analysis** — review aggregation pipelines for `$lookup` on unindexed fields, full collection scans (`COLLSCAN`) | Rewrite with `$match` first, project narrow fields, paginate |
| 3 | **N+1 detection** — log Mongoose query count per request (`mongoose.set('debug', true)` in dev) | Use `populate({ select })`, batch with `Promise.all` or a single aggregation |
| 4 | **Connection pool sizing** — Mongoose default `maxPoolSize=100`; under 10 VUs you should see < 30 active connections | Increase `maxPoolSize` only if logs show pool exhaustion; otherwise the pool is not the bottleneck |
| 5 | **Caching** — add CrudService cache layer for read-heavy endpoints (`@CacheTTL`); use Redis where shared state matters | Be explicit about invalidation on write paths |
| 6 | **Payload size** — measure `Content-Length` on the slowest endpoints; if > 50 KB per response under 10 VUs, the bottleneck is serialisation | Use `select` projections, paginate, return references not deep populates |
| 7 | **Rate-limit interference** — check `@nestjs/throttler` ttl/limit; load tests must not be blocked by rate limiting | Whitelist the test client IP in dev, or temporarily disable for the run via env var |
| 8 | **CPU saturation** — `top` shows node process pegged near 100% during the run | Profile with `clinic flame` or `0x`; offload heavy work to a queue (BullMQ) |
| 9 | **External API contention** — load test reveals upstream bottleneck (mailer, payment, etc) | Mock the external in load mode (`NODE_ENV=load` env switch), document the assumption |

If steps 1–9 are exhausted and thresholds still fail, the system is **not production-ready for 10 concurrent users** — that is the report the consumer must surface.

## Step 9 — Result interpretation

After every run, read the `--summary-export` JSON. The consumer must extract and report:

```
Scenario:           load
Duration:           5m
VUs (max reached):  10 / 10
Iterations:         <n>
Requests:           <n>
http_req_failed:    <rate>   (threshold: <1%)        [PASS|FAIL]
http_req_duration:
  avg:              <ms>
  p95:              <ms>     (threshold: <500ms)     [PASS|FAIL]
  p99:              <ms>     (threshold: <1500ms)    [PASS|FAIL]
checks pass rate:   <rate>   (threshold: >99%)       [PASS|FAIL]
```

Compare against the previous run's `summary-load.json` (commit it under `tests/load/baselines/`) to detect regression. A regression of >15% on p95 or any threshold flip from PASS to FAIL counts as a **blocker**.

## Step 10 — Reporting block (canonical)

Every consumer ends Phase 3 with this block in its report so downstream tooling can parse it:

```
### Load Test Report (k6)

- Scenario: <smoke|load|soak>
- VUs: <max>
- Duration: <wallclock>
- Thresholds: <PASS|FAIL>  (failed: <comma-separated metrics or "none">)
- Optimisation steps applied: <#1, #3, #5 ...>
- Baseline delta (p95): <+X%|-X%|n/a>
- Verdict: <READY|NOT-READY|BLOCKED-K6-MISSING>
- Summary file: tests/load/summary-<scenario>.json
```

## Cross-Skill References

- **Server lifecycle:** `managing-dev-servers` (always start the API before k6, stop it after)
- **Backend optimisation patterns:** `generating-nest-servers` (CrudService cache hooks, query patterns)
- **Production gates:** `validating-production-readiness` (k6 PASS is one of the entry criteria there)
- **Performance review baseline:** `lt-dev:performance-reviewer` (consumes the baseline JSON for regression detection)
