---
description: Full maintenance — framework updates (npm + vendor core) followed by npm package maintenance
allowed-tools: Agent, Bash, Read, Grep, Glob
disable-model-invocation: true
---

# Full Project Maintenance

Brings a project up to date **completely**: the lenne.tech frameworks first, then the
package ecosystem around them. Works for plain Node projects, fullstack monorepos
(`projects/api` + `projects/app`), and vendor-mode projects that carry the framework
core in their own source tree.

## Why frameworks come first

`@lenne.tech/nest-server` and `@lenne.tech/nuxt-extensions` **pin** their own
dependencies (e.g. nest-server pins `better-auth` to an exact version, and the
`@nestjs/*` family to an exact minor). Two consequences:

- A CVE inside a framework-pinned dependency **cannot be fixed with an override**.
  Overriding it merely overrules the framework and produces a version combination
  nobody tested. The fix is to raise the framework, which ships the patched version.
- Raising the framework moves its peer requirements. Any package maintenance done
  *before* that is wasted work — it gets re-resolved anyway.

Real incident (offers, 2026-07): a critical `better-auth` advisory was "fixed" by
overriding `better-auth` past the version nest-server pinned. Audit went green, and
an API test went red. The actual fix was nest-server `11.25.2 → 11.27.6`, which
pins the patched `better-auth` itself. Order matters.

## Phase 0 — Detect topology (before spawning anything)

Never assume the layout. Determine, with Bash/Glob:

**Which projects exist**
- Fullstack monorepo: `projects/api` + `projects/app` (also `packages/api` / `packages/app`)
- Single project: `package.json` at root

**Which mode each project is in** — this decides who does the framework update:

| Check | Result |
| --- | --- |
| `projects/api/src/core/` exists | API is **vendor mode** (framework core lives in the repo) |
| `@lenne.tech/nest-server` in `projects/api/package.json` | API is **npm mode** |
| `projects/app/app/core/` exists | APP is **vendor mode** |
| `@lenne.tech/nuxt-extensions` in `projects/app/package.json` | APP is **npm mode** |

A project can be vendor on one side and npm on the other. Report the detected
topology before doing anything.

**Which framework versions are current**
```bash
npm view @lenne.tech/nest-server version
npm view @lenne.tech/nuxt-extensions version
```

## Phase 1 — Framework updates

Route by mode. Do **not** hand vendor-mode work to the package maintainer — it must
not touch `src/core/` / `app/core/`.

| Project | Mode | Version jump | Who |
| --- | --- | --- | --- |
| API | vendor | any | `lt-dev:nest-server-core-updater` agent |
| API | npm | **major** | `lt-dev:nest-server-updater` agent (owns the migration guides) |
| API | npm | minor / patch | raise in `package.json` directly, migration guides not needed |
| APP | vendor | any | `lt-dev:nuxt-extensions-core-updater` agent |
| APP | npm | any | raise in `package.json` directly; read the package CHANGELOG for breaking changes first |

For npm-mode minor/patch bumps, read the framework CHANGELOG and check whether the
breaking changes listed actually touch this project (grep for the renamed symbols)
before raising. Record what you checked.

## Phase 2 — Align the framework's ecosystem

**This step is mandatory after every framework update and is routinely forgotten.**

A framework pins peers. If the project pins them differently, you get *two* copies
of the same package and a build that fails with type errors that look unrelated.

Real incident (offers): after nest-server `11.25.2 → 11.27.6`, the build failed with
`Class 'CronJobs' incorrectly extends base class 'CoreCronJobs'` — because
`@nestjs/schedule` existed twice, once resolved against `@nestjs/common@11.1.19`
(the project's pin) and once against `11.1.23` (the framework's). The fix is
mechanical: read the framework's own `package.json` and align.

```bash
# what does the framework actually require?
node -e "const p=require('@lenne.tech/nest-server/package.json');
  for (const [k,v] of Object.entries({...p.dependencies, ...p.peerDependencies}))
    if (k.startsWith('@nestjs/')) console.log(k, v);"
```

Align every shared package (`@nestjs/*`, `nuxt`, `vue`, …) to the framework's
version, then `pnpm install` and **build both projects** before moving on.

## Phase 3 — Package maintenance

Now hand off to the `lt-dev:npm-package-maintainer` agent (FULL mode). Pass it
explicitly:

- the framework versions that are now in place (it must not fight them),
- that overrides are **raised, never deleted** (see the agent's Priority 4),
- that it must not touch `src/core/` or `app/core/` in vendor projects.

## Phase 4 — Verify

- `pnpm run check` (or the project's equivalent) must exit 0 — it typically bundles
  audit, format, lint, tests, build and a server-start smoke test.
- If the project has E2E tests, run them. Framework updates change auth, SSR and
  cookie behaviour; unit tests will not catch that. In lt projects: `lt dev test`.
- Report what changed, what is still open, and why.

## Rollback

Before Phase 1, snapshot every `package.json` and the lockfile. If any phase leaves
the build or tests broken and cannot be repaired within the phase, restore the
snapshot and report — **never** leave a half-migrated dependency tree behind. That
is worse than not having run at all: the lockfile no longer matches any tested state.

## Related commands

| Command | Scope |
| --- | --- |
| `/lt-dev:maintenance:maintain` | Frameworks + packages (this command) |
| `/lt-dev:maintenance:maintain-check` | Analysis only, no changes |
| `/lt-dev:maintenance:maintain-security` | Security-only, fast path |
| `/lt-dev:maintenance:maintain-pre-release` | Conservative, patch-only |
| `/lt-dev:maintenance:maintain-post-feature` | Cleanup after feature work |
