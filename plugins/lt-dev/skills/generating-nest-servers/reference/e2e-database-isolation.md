# E2E Test Database Isolation (the shared-DB 401 flake)

A recurring, hard-to-diagnose flake in lenne.tech nest-server projects: e2e tests that pass in
isolation fail intermittently under the full parallel run — most visibly as a **spurious 401**
(`expected 200 to be 401` on an authenticated request), or missing/altered data. It reads like
flakiness; it is a **real concurrency bug** in the test-database lifecycle. This doc explains the
mechanism, the fix, and — critically — why the cleanup must be pid-guarded.

## The mechanism

The e2e config runs spec **files in parallel forks** (`fileParallelism: true`, `pool: 'forks'`).
`tests/global-setup.ts` gives the whole **run** one database and exports it via `MONGODB_URI`
(or `NSC__MONGOOSE__URI` in NSC-config projects) *before the forks spawn*. So every parallel file
shares **one** database.

That is fine until a spec **mutates a GLOBAL collection** — one that other files depend on
implicitly. The canonical trigger is BetterAuth's `jwks` collection (the JWT signing keys, used by
*every* BetterAuth instance):

```typescript
// better-auth-integration.story.test.ts — runs in a parallel fork
beforeAll(async () => {
  await db.collection('jwks').deleteMany({}); // clears the signing keys for the WHOLE shared DB
});
```

While that runs, a parallel `better-auth-*` file has a user signed in with a token signed by those
keys. The clear wipes the keys → that file's next authenticated request fails verification → **401**.
Same class of bug for any `deleteMany({})` / `dropDatabase()` / `.drop()` on a collection another
parallel file reads: `users`, `session`, framework collections like `ratelimitstates`, etc.

**It only manifests under parallel load**, so it is routinely misfiled as "flaky test — just re-run".
It is not. Isolated, the file passes; in parallel, it collides.

## The fix — per-worker database isolation

Give each **concurrent fork** its own database, so parallel files can never share collections. The
hook is `tests/setup.ts` (a `setupFiles` entry): it runs **in every fork, before the test file and
therefore before `config.env.ts` is imported**, so it can rewrite the DB URI:

```typescript
// tests/setup.ts  (registered via `setupFiles: ['tests/setup.ts']` in vitest-e2e.config.ts)
if (process.env.MONGODB_URI && !/-w\d+(\?|$)/.test(process.env.MONGODB_URI)) {
  const poolId = process.env.VITEST_POOL_ID || process.env.VITEST_WORKER_ID || '0';
  // …/dbname?opts → …/dbname-wN?opts
  process.env.MONGODB_URI = process.env.MONGODB_URI.replace(/(\/[^/?]+)(\?|$)/, `$1-w${poolId}$2`);
}
```

Result: fork 1 uses `<base>-run-<ts>-p<pid>-w1`, fork 2 `-w2`, etc. Files that share a fork run
**sequentially** (safe); files in **different** forks can no longer collide. Use the exact env var
your `global-setup.ts` sets — `MONGODB_URI` (framework) or `NSC__MONGOOSE__URI` (NSC-config
projects). It must run before the config is imported, so keep `setup.ts` free of imports that pull
in `config.env.ts`.

> A project may instead derive the DB name in `config.env.ts` from `VITEST_POOL_ID` directly — same
> effect. What matters is that concurrent forks get distinct DBs.

## The cleanup MUST be pid-guarded (or you delete a live run's data)

`tests/db-lifecycle.reporter.ts` runs at the **end** of a run and drops that run's databases. The
trap: it also collects *other* runs' leftover DBs. It may drop a foreign DB **only** if its creating
process is dead or it is very old:

```typescript
} else if (name.startsWith(`${base}-run-`)) {
  const match = name.match(/-run-(\d+)-p(\d+)/);
  stale = match
    ? !isPidAlive(Number(match[2])) || Date.now() - Number(match[1]) > STALE_MAX_AGE_MS // 7 days
    : false;
}
// …and it drops THIS run's own per-worker forks via `name.startsWith(`${dbName}-`)`.
```

This is what makes concurrent runs safe: two runs (two `lt ticket` worktrees, CI + local) get
distinct pids → distinct DB names, and the `isPidAlive` guard means a finishing run **cannot** drop a
DB whose owning run is still alive. Verified empirically: run A's cleanup executing while run B is
live left B's 137 tests untouched, zero orphaned DBs afterwards.

**Anti-pattern to reject on sight** — an unguarded pattern-drop in `global-setup.ts`:

```typescript
// UNSAFE: wipes every sibling DB with no pid/age guard. A concurrent run's LIVE fork DBs get dropped.
for (const { name } of databases) {
  if (name.startsWith('platform-e2e')) await connection.db(name).dropDatabase();
}
```

If per-fork DBs are **fixed-named** (`platform-e2e-<poolId>`, reused every run) instead of
per-run-unique (`…-run-<ts>-p<pid>-w<poolId>`), an unguarded drop in one run's *startup* wipes
another run's *live* worker DBs. Always: per-run-unique names **and** an `isPidAlive`/age-guarded
reporter.

## Startup sweep — cleanup that survives SIGKILL and `--reporter` overrides

The end-of-run reporter can NEVER run when the process is SIGKILLed (check-script watchdog
escalation, closed terminal) or when vitest was started with an explicit `--reporter` CLI flag
(which **replaces** the config reporters). Relying on "the next successful run collects leftovers"
means leaks persist exactly when runs keep failing. The fix: `global-setup.ts` sweeps **before** the
run starts — same `isPidAlive`/age predicate (shared `isStaleTestDb()` export in the reporter), same
`SAFE_TEST_DB_PATTERN` guard. Restarting a suite therefore always restores a clean state, no matter
how its predecessor died. Reference: `tests/global-setup.ts` + `tests/db-lifecycle.reporter.ts` in
nest-server/nest-server-starter (11.29.0+).

## Machine-wide e2e run governor (`tests/e2e-run-slots.ts`)

vitest's default fork count (`numCpus - 1`) assumes an EXCLUSIVE machine. Two overlapping full-speed
e2e runs (two `lt ticket` sessions running `check`) saturate the box — measured: load 30 on 12
cores, spurious 401s, hard failures. The governor is a cross-process slot directory
(`<tmpdir>/lt-e2e-run-slots`, shared by ALL lt projects): each running suite holds one PID-named
slot file; further runs **wait** (logging every 15s — which also keeps the check-script watchdog
fed, so a queued run is never mistaken for a hang). Crash-safe without a daemon: slots of dead PIDs
are reclaimed by liveness checks. Additionally the vitest config counts foreign slots at load time —
a second run starting seconds after the first deterministically drops to low-resource mode (reduced
forks, raised timeouts), which the 1-minute load average structurally cannot catch. Env knobs:
`LT_E2E_MAX_RUNS` (0 disables), `LT_E2E_SLOT_DIR`, `LT_E2E_SLOT_TIMEOUT` (fail-open).

## Keep `retry` low — retry multiplies a broken file into a fake deadlock

Observed with `retry: 5`: one spec file whose app/socket state broke under resource pressure ground
through (1+5) attempts × 30s `testTimeout` × 22 tests ≈ an hour at 0% CPU — indistinguishable from a
deadlocked run (this is what the check-script watchdog kills as "workers idle at 0% CPU"). The
governor removes the pressure trigger; `retry: 2` caps the worst-case multiplier at 3×. Never raise
`retry` to paper over contention — fix the contention.

## Debug ergonomics

On a **failed** run the reporter keeps the DBs for inspection — but the data is in the `-w<N>` fork
DBs, not the base. The failure message must list the fork DBs (`${dbName}-w*`), or a developer
connects to the empty base DB. The kept DBs are collected when the **next** run starts (startup
sweep, dead pid) — inspect them before re-running.

## Checklist when writing / reviewing nest-server e2e tests

- [ ] `fileParallelism: true`? Then per-worker DB isolation is required if any spec mutates a shared collection.
- [ ] Any `deleteMany({})` / `dropDatabase()` / `.drop()` on a collection another file reads (`jwks`, `users`, `session`, `ratelimitstates`, …)? → isolate per worker, or scope the delete by a per-test filter.
- [ ] `tests/setup.ts` appends `-w<poolId>` to the **correct** env var (`MONGODB_URI` / `NSC__MONGOOSE__URI`) and is registered in `setupFiles`.
- [ ] `db-lifecycle.reporter.ts` cleanup of other runs' DBs is `isPidAlive` + age guarded (NEVER an unconditional pattern-drop).
- [ ] Per-fork DB names are per-run-unique (carry `-run-<ts>-p<pid>`), not fixed.
- [ ] Failure-path message points at the `-w<N>` fork DBs.
- [ ] Extra per-spec DBs go through `deriveTestDbUri('<suffix>')` — NEVER `\`<base>-something-${Date.now()}\`` (escapes the per-run cleanup scheme; leaked 2 DBs per run in nest-server until 11.29.0).
- [ ] Spec-level teardown drops its DB **after** `app.close()` — dropping while the app is alive races async module init (AI module collection creation) re-creating the database.
- [ ] `global-setup.ts` runs the startup sweep and acquires an e2e-governor slot; `retry` is ≤ 2.

## Reference implementation

`@lenne.tech/nest-server` and `nest-server-starter`: `tests/setup.ts`, `tests/global-setup.ts`,
`tests/db-lifecycle.reporter.ts`, `vitest-e2e.config.ts`. `lt fullstack init` copies these verbatim
from nest-server-starter, so keeping the starter correct fixes new projects automatically; existing
consumers must adopt the pattern.
