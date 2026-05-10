---
name: validating-production-readiness
description: 'Single source of truth for the lenne.tech fullstack production-readiness checklist. Defines the eight pillars (configuration & secrets, observability & logging, health & lifecycle, security hardening, data durability, resilience under load, deployment hygiene, runbook & rollback) with concrete file/line evidence requirements per pillar, severity classification (Critical / Major / Minor), and a canonical machine-parseable report block. Activates whenever an agent or command needs to gate a release on production-readiness — currently used by /lt-dev:production-ready, lt-dev:production-readiness-orchestrator, and the devops-reviewer (read-only). NOT for OWASP-style code-level security review (use security-reviewer). NOT for npm dependency audits (use maintaining-npm-packages).'
user-invocable: false
---

# Validating Production Readiness

This skill is the **single source of truth** for the production-readiness gate in the lt-stack. Every consumer applies the same eight pillars, the same severity classification, and produces the same report block — so multiple runs across time can be compared.

> **Goal:** Decide, with evidence, whether the system is safe to deploy to production. Anything Critical is a hard blocker. Anything Major must be tracked. Minor findings are advisory.

## When to Use This Skill

| Caller | Phase | Trigger |
|--------|-------|---------|
| `/lt-dev:production-ready` | Phase 4 | Hard release gate |
| `lt-dev:production-readiness-orchestrator` | Phase 4 | Owns the audit + remediation loop |
| `lt-dev:devops-reviewer` | (cross-reference) | Cites this checklist when flagging deployment-relevant gaps |
| Manual user invocation | Pre-deploy | Final sign-off before tagging a release |

## Severity Classification

| Severity | Meaning | Effect on the release |
|----------|---------|------------------------|
| **Critical** | Loss of data, security breach, or undetectable downtime is plausible | **BLOCK** the release until fixed |
| **Major** | Operability is degraded; recovery requires manual intervention | Tracked finding; release may proceed only with explicit owner sign-off |
| **Minor** | Cosmetic, missing nice-to-have, or hygienic gap with no operational impact | Advisory only |

A pillar with even a single Critical finding makes the whole release **NOT READY**.

## The Eight Pillars

Each pillar lists the concrete checks to perform, the file paths to inspect, and the typical fix when the check fails.

### Pillar 1 — Configuration & Secrets

| Check | How | Severity if missing |
|-------|-----|----------------------|
| Env validation at boot | `projects/api/src/config.env.ts` (or equivalent) parses with class-validator / Valibot and crashes on missing required keys | Critical |
| `.env*` excluded from VCS | `.gitignore` covers `.env`, `.env.*`, **except** `.env.example` | Critical |
| `.env.example` exists & is current | All keys read by code are present with placeholder values | Major |
| Secrets are runtime-injected (not baked) | Production Dockerfile does NOT `COPY .env`; secrets come from CI vault | Critical |
| `NODE_ENV` taxonomy respected | `e2e` (local tests), `ci` (pipeline tests), `develop` (dev server), `test` (customer staging — NOT a test env), `production` (live) | Major |
| Per-env DB URI / database name | `nsc.mongoose.uri` ends with the env-specific DB (no shared "test" DB across envs) | Critical |
| Default-credentials guard | Production refuses to boot with `password === 'admin'` / `JWT_SECRET === 'change-me'` etc | Critical |

### Pillar 2 — Observability & Logging

| Check | How | Severity if missing |
|-------|-----|----------------------|
| Structured logs (JSON) in production | `pino-http` or NestJS Logger configured with JSON transport when `NODE_ENV=production` | Major |
| No `console.log` in shipped server code | `grep -nR "console\.log" projects/api/src` returns 0 (`console.error` for boot failures is acceptable) | Major |
| Request ID / correlation ID | Middleware emits and propagates `x-request-id` to outgoing calls | Major |
| Error tracking wired up | Sentry (or equivalent) initialised on both API and App when DSN is set | Major |
| Metrics endpoint or APM | `/metrics` (Prometheus) OR APM agent (NewRelic/Datadog) instrumented | Minor |
| Frontend error boundary | Nuxt `error.vue` renders a useful message and reports to Sentry | Major |
| Log levels controlled by env | `LOG_LEVEL` env var read; defaults to `info` in prod, `debug` in dev | Minor |

### Pillar 3 — Health & Lifecycle

| Check | How | Severity if missing |
|-------|-----|----------------------|
| Liveness endpoint | `GET /health` (or `/meta`) returns 200 without DB dependency, suitable for k8s liveness probe | Critical |
| Readiness endpoint | `GET /ready` performs DB ping; returns 503 when DB is unreachable | Major |
| Graceful shutdown | NestJS `app.enableShutdownHooks()` enabled; in-flight requests drain before process exit | Critical |
| Frontend SSR health | `GET /` returns 200 in SSR with mocked-or-real backend; no unhandled rejections in server log | Major |
| Docker `HEALTHCHECK` declared | Production Dockerfile includes `HEALTHCHECK` instruction calling `/health` | Major |
| Process isolation | Container runs as non-root user (`USER node` or similar) | Major |

### Pillar 4 — Security Hardening

| Check | How | Severity if missing |
|-------|-----|----------------------|
| Helmet (or equivalent) on API | `app.use(helmet())` for REST mode; CSP set explicitly | Major |
| CORS allowlist | `cors.origin` is an explicit list, NOT `*` in production | Critical |
| HTTPS enforced | Reverse proxy / Nuxt config redirects http → https in production | Critical |
| Cookies secure | Better-Auth cookies have `secure: true`, `httpOnly: true`, `sameSite: 'lax'` (or stricter) in production | Critical |
| Rate limiting on auth | `@nestjs/throttler` (or equivalent) on `/auth/*`, `/forgot-password`, etc | Major |
| Restricted decorators on every controller | `@Restricted` / `@Roles` / `securityCheck()` present per backend-dev guidelines | Critical |
| `pnpm audit` clean (or audit ladder exhausted) | Per `running-check-script` skill rules | Major |
| No secrets in client bundle | `grep -nR "JWT_SECRET\|MONGO_URI\|API_KEY" projects/app/.output/` returns 0 after build | Critical |

### Pillar 5 — Data Durability

| Check | How | Severity if missing |
|-------|-----|----------------------|
| Indexes for hot queries | All queries seen in load-test profiler (Pillar 6 / k6 phase) hit an index | Major |
| Migrations / seed scripts deterministic | `pnpm run migrate` is idempotent; replaying it on production data does not corrupt | Critical |
| Backup strategy documented | `README.md` or `docs/runbook.md` describes backup cadence + restore drill | Major |
| No destructive migrations on boot | Server does NOT run `dropDatabase` / `dropCollection` on startup in production | Critical |
| Soft-delete or audit trail where data loss matters | Models flagged as critical have `deletedAt` / version trail | Minor |
| Connection retry / backoff | Mongoose connect uses exponential backoff, not infinite tight loop | Major |

### Pillar 6 — Resilience Under Load

The k6 results from the `running-load-tests-with-k6` skill feed directly into this pillar. Don't re-run k6 here — read the report block.

| Check | How | Severity if missing |
|-------|-----|----------------------|
| k6 load scenario PASSED | `tests/load/summary-load.json` thresholds all PASS | Critical |
| k6 baseline regression < 15% | p95 delta vs `tests/load/baselines/` within bounds | Major |
| No memory leak in soak (when run) | `summary-soak.json` shows flat memory at end | Major |
| Connection pool not exhausted | Mongoose log shows < 80% of `maxPoolSize` at peak | Major |
| Timeouts everywhere | All HTTP / DB calls have explicit timeouts (no infinite waits) | Major |
| Idempotency keys on critical writes | Payment / email / external write endpoints have idempotency-key handling | Major |

### Pillar 7 — Deployment Hygiene

| Check | How | Severity if missing |
|-------|-----|----------------------|
| Dockerfile multi-stage | Builder + runtime stages; runtime image contains only built artefacts + prod deps | Major |
| Image base pinned | `FROM node:22.11.0-alpine` (concrete version), not `node:latest` | Major |
| `.dockerignore` complete | `.git`, `node_modules`, `tests/`, `.env*` excluded | Major |
| CI builds from main with tag | Tag-triggered pipeline builds the production image; never `latest`-only | Major |
| Build is reproducible | Lockfiles (`pnpm-lock.yaml`) committed; CI uses `--frozen-lockfile` | Major |
| Image scan in CI | `trivy` / `grype` / GitLab container scan stage exists | Major |
| Image size reasonable | Final image < 500 MB (alpine) / < 1 GB (debian-slim) | Minor |

### Pillar 8 — Runbook & Rollback

| Check | How | Severity if missing |
|-------|-----|----------------------|
| Runbook exists | `docs/runbook.md` (or equivalent) describes deploy, rollback, common incidents | Major |
| Rollback path documented | Tagged previous image is deployable in < 5 min | Critical |
| On-call ownership clear | README or runbook names the responsible team / Slack channel | Minor |
| Migration reversibility | Each migration has a documented rollback (or is annotated as one-way) | Major |
| Feature flags for risky changes | Risky paths gated by env var or runtime flag | Minor |
| Monitoring alerts configured | At least: API down, error rate > 5%, p95 > 1s, DB connection lost | Major |

## Audit Procedure

For each pillar, in order:

1. **Inspect** the listed files / configs / endpoints. Use `Read`, `Grep`, `Glob` only — no destructive Bash.
2. **Classify each finding** as Critical / Major / Minor with file:line evidence.
3. **Record the verdict per pillar** as `PASS` (no findings ≥ Major), `WARN` (Major only), `FAIL` (any Critical).
4. **Roll up the global verdict:** `READY` (all pillars PASS), `READY-WITH-NOTES` (≥1 WARN, 0 FAIL), `NOT-READY` (any FAIL).

## Remediation Loop (when called from production-ready command)

When called from `/lt-dev:production-ready`, the orchestrator MUST attempt remediation for each Critical / Major finding:

| Finding type | Default fix |
|--------------|-------------|
| Missing `.env.example` key | Add the placeholder key with a comment describing the value |
| Missing `enableShutdownHooks` | Add to `main.ts` |
| Missing `helmet` / CORS allowlist | Add to bootstrap module |
| Missing `HEALTHCHECK` in Dockerfile | Add `HEALTHCHECK CMD wget -qO- http://localhost:3000/health || exit 1` |
| Missing rate limiting on `/auth/*` | Add `@Throttle` decorator with sane defaults |
| `console.log` in shipped code | Replace with NestJS `Logger` / `pino` instance |
| Missing index | Add `@Index` decorator + migration to backfill |
| Missing runbook | Scaffold `docs/runbook.md` from the runbook template |

If a finding cannot be auto-fixed (architectural change, missing infra access, business decision), classify it as **needs-human** and surface it in the report rather than guessing.

After every remediation pass, re-run the relevant pillar check.

## Report Block (canonical)

Every consumer ends Phase 4 with this block:

```
### Production Readiness Report

| Pillar | Verdict | Critical | Major | Minor | Auto-fixed |
|--------|---------|----------|-------|-------|-------------|
| 1. Configuration & Secrets | <PASS|WARN|FAIL> | <n> | <n> | <n> | <n> |
| 2. Observability & Logging | …
| 3. Health & Lifecycle      | …
| 4. Security Hardening      | …
| 5. Data Durability         | …
| 6. Resilience Under Load   | …
| 7. Deployment Hygiene      | …
| 8. Runbook & Rollback      | …

Global verdict: <READY|READY-WITH-NOTES|NOT-READY>
Auto-fixed total: <n>
Needs-human findings: <n>
Blocking issues:
- <pillar/severity/file:line> — short description
```

## Cross-Skill References

- **Code-level security:** `general-frontend-security` (frontend XSS/CSRF) and `lt-dev:security-reviewer` agent (OWASP-aligned diff review)
- **DevOps configuration:** `lt-dev:devops-reviewer` agent (Docker / Compose / CI/CD specifics)
- **Load resilience evidence:** `running-load-tests-with-k6` (k6 results feed Pillar 6)
- **Runnability gate:** `running-check-script` (must already be GREEN before this skill runs)
- **Server lifecycle for health checks:** `managing-dev-servers`
