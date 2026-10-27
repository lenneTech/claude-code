---
name: nest-server-core-vendoring
description: 'Knowledge base for projects that vendored the @lenne.tech/nest-server core into projects/api/src/core/ (no npm dependency): when the core may be touched, the flatten-fix, upstream sync and upstream PRs. Activates on vendored core discussions, "sync core from upstream", or vendor-sync conflicts. NOT for npm-based nest-server updates (use nest-server-updating). NOT for writing new NestJS code (use generating-nest-servers).'
---

# Vendored nest-server core Knowledge Base

## Gotchas

- **Flatten-fix edge case on `core-persistence-model.interface.ts`** — During flatten-fix, most files get `'../../..'` rewritten to `'../..'`. This file is an exception: it sits one directory deeper and needs `'../../..'` → `'../..'` → `'..'`. Missing this step causes a silent `Cannot find module` at runtime, not compile-time.
- **`migrate` CLI disappears after vendoring** — The upstream `@lenne.tech/nest-server` package exports a `migrate` binary in its `package.json`. When vendored (no longer a dependency), that binary is gone from `node_modules/.bin/`. `convert-mode` copies `bin/migrate.js` into the project and repoints the `migrate:*` scripts at it. See "The migrate CLI in a Vendored Project" below — and note that the **production** path (compiled JS) differs from the local path (TypeScript loaded at run time), which is how migrations end up silently never running in the container.
- **Cosmetic commits are tempting upstream PR candidates** — Formatting-only, linting-only, or rename-only commits look substantive but offer no value as upstream PRs. The contributor agent filters these — if authoring manually, verify the commit changes behavior, not just style.
- **Local patches in `src/core/` are invisible to future `/lt-dev:backend:update-nest-server-core` runs** — The updater does AI-driven curation but cannot read your intent. Document every intentional local deviation in `src/core/LOCAL-PATCHES.md` so the next sync doesn't silently undo your work.

This skill provides **knowledge and resources** for lenne.tech projects that have
vendored the @lenne.tech/nest-server core into their source tree. For automated
execution, use the matching agents:

- `lt-dev:nest-server-core-updater` via `/lt-dev:backend:update-nest-server-core` —
  pulls upstream changes into the vendored core, with AI-driven curation against
  local patches
- `lt-dev:nest-server-core-contributor` via `/lt-dev:backend:contribute-nest-server-core` —
  identifies substantial local changes to the vendored core and prepares them as
  Upstream-Pull-Requests to the nest-server repository

## When This Skill Activates

- Discussing the vendored nest-server core pattern
- Asking how to sync from upstream into a vendored project
- Asking how to port a local fix back to the upstream repository
- Troubleshooting import-path or flatten-fix issues in the vendor tree
- Planning an upstream-sync with conflict resolution
- Explaining the difference to the classic npm-based update flow

## Skill Boundaries

| User Intent                                                | Correct Skill                  |
| ---------------------------------------------------------- | ------------------------------ |
| "Sync vendored core from upstream v11.26.0"                | **THIS SKILL**                 |
| "Port this CrudService fix back to nest-server"            | **THIS SKILL**                 |
| "Apply flatten-fix after upstream copy"                    | **THIS SKILL**                 |
| "Update nest-server via npm"                               | nest-server-updating           |
| "Migrate from nest-server 11.17 to 11.24"                  | nest-server-updating           |
| "Create a new NestJS module"                               | generating-nest-servers        |
| "Fix a CVE via npm audit"                                  | maintaining-npm-packages       |
| "Modify @lenne.tech/nest-server itself and test via pnpm link" | contributing-to-lt-framework |

## Detecting a Vendored Project

A project is considered **vendored** if **all** of the following are true:

1. `projects/api/src/core/VENDOR.md` exists
2. `projects/api/package.json` does **not** list `@lenne.tech/nest-server` in
   `dependencies` or `devDependencies`
3. `projects/api/src/core/` contains at least `common/`, `modules/`, `index.ts`,
   `core.module.ts`

A project is **npm-based** (classic) if:

- `@lenne.tech/nest-server` is a regular dependency in `package.json`
- There is no `VENDOR.md` under `src/core/`

The `nest-server-updater` (classic agent) detects this automatically and delegates
to `nest-server-core-updater` for vendored projects.

## Modification Policy (when to touch `src/core/`)

Vendoring copies the framework source into the project tree so Claude Code
can read it directly — this is a **comprehension aid**, not an invitation to
fork. The policy:

1. **FIRST check whether upstream already has the fix — prefer updating over
   hand-patching.** Before changing anything in `src/core/`, confirm the
   vendored baseline is current: compare the version/commit recorded in
   `src/core/VENDOR.md` against the latest `@lenne.tech/nest-server` release
   **and** the upstream `develop` branch, and read the upstream version of the
   exact file you intend to change. If a newer release — or upstream HEAD —
   already contains the fix, optimization, or enhancement, adopt it via
   `/lt-dev:backend:update-nest-server-core` instead of writing a local patch.
   A hand-patch that duplicates or diverges from an upstream fix creates a
   needless merge conflict on the next sync and often reimplements the change
   worse than the maintainers already did. Only hand-patch when the fix
   genuinely does not exist upstream yet — and then still contribute it
   (step 4). Run `pnpm run check:vendor-freshness` (or read `VENDOR.md`) if
   unsure whether the baseline is stale.
2. **Change `src/core/` ONLY when the change is generally useful to all
   nest-server consumers.** Valid reasons:
   - Bugfixes that apply to every consumer
   - Framework enhancements with broad applicability
   - Closing security vulnerabilities
   - Build/TypeScript compatibility fixes that every consumer would hit
3. **Every other change belongs in project code** (outside `src/core/`),
   via modification, inheritance, extension, or `ICoreModuleOverrides`.
   Project-specific business rules, customer enums, or proprietary
   integration adapters must never live in the vendored core.
4. **Generally-useful changes go upstream as a PR** to
   `github.com/lenneTech/nest-server`. Use
   `/lt-dev:backend:contribute-nest-server-core` to prepare the PR. Do not
   let useful fixes rot in a single project's vendor tree — they belong
   upstream so every consumer benefits and the local patch disappears on
   the next sync.
5. **When in doubt, ask before editing `src/core/`.** The contributor
   agent exists precisely to keep the vendor tree close to upstream.

The `nest-server-core-contributor` agent enforces this distinction by
categorizing every local commit as **upstream-candidate** (generic) vs.
**project-specific** (stays local) vs. **unclear** (asks the human).

## The Vendor Model (one-way curation)

The vendored core lives as **first-class project code**. Flow is:

```
Upstream (github.com/lenneTech/nest-server)
    |
    | /lt-dev:backend:update-nest-server-core  (curated, one-way)
    v
Project vendor (projects/api/src/core/)
    |
    | /lt-dev:backend:contribute-nest-server-core  (manual review, cherry-pick)
    v
Upstream PR (via normal GitHub review process)
```

**Local patches are expected.** Projects legitimately modify the vendored core
when business rules, integration adapters, or bugfixes are needed before upstream
ships them. Those patches persist through syncs.

**Changes are never auto-pushed.** The contributor agent prepares PR drafts —
a human reviews and submits them through normal GitHub workflow. No git-subtree
push, no automatic upstream replay.

## The Flatten-Fix Pattern

Upstream organizes its tree as:

```
nest-server/
├── src/
│   ├── index.ts          ← re-export hub (imports './core/common/...')
│   ├── core.module.ts    ← CoreModule factory (imports './core/modules/...')
│   ├── core/
│   │   ├── common/
│   │   └── modules/
│   ├── test/
│   │   └── test.helper.ts  ← imports '../core/common/helpers/db.helper'
│   ├── templates/
│   ├── types/
│   └── ...
└── LICENSE
```

When vendored, the project gets a **flat** structure under `src/core/`:

```
projects/api/src/core/
├── VENDOR.md             ← NEW
├── LICENSE               ← copied for provenance
├── index.ts              ← moved up from upstream src/, imports rewritten
├── core.module.ts        ← moved up from upstream src/, imports rewritten
├── common/               ← copied as-is
├── modules/              ← copied as-is
├── test/                 ← test.helper.ts, with imports rewritten
├── templates/
└── types/
```

This requires a **single one-shot import-path rewrite** on exactly three files:

1. `index.ts` — strip `./core/` prefix from every relative import/export
   specifier. About 161 rewrites. (ts-morph AST-based.)
2. `core.module.ts` — same strip pattern, about 27 rewrites.
3. `test/test.helper.ts` — upstream uses `../core/common/helpers/db.helper`;
   after flatten the correct path is `../common/helpers/db.helper`. The
   `../core/` prefix gets stripped here too, exactly once.

Internal imports inside `common/`, `modules/`, etc. are **not touched** —
their relative paths between each other are identical before and after
the flatten.

One additional edge case:
`src/core/common/interfaces/core-persistence-model.interface.ts` imports
`CorePersistenceModel` from `'../../..'`. Upstream that reached `src/index.ts`
(three levels up), but after the flatten it should be `'../..'` (two levels up
to `src/core/index.ts`). Manual fix, documented in VENDOR.md.

The `nest-server-core-updater` agent knows all three of these edge cases and
reapplies them idempotently on every upstream sync.

## Typical Tsc/Build Adjustments

Vendoring pulls upstream TypeScript that may use modern language features or
imports that the consumer project's `tsconfig.json` does not yet allow.
Common adjustments on the consumer side:

| Symptom                                                  | Fix                                          |
| -------------------------------------------------------- | -------------------------------------------- |
| `new Error(msg, { cause: e })` flagged                   | `target: "es2022"` in tsconfig               |
| `vite.config.ts` cannot find `vite` module               | Exclude `vite.config.ts` from tsc compile    |
| `migration-project.template.ts` flags bad imports        | Exclude `src/core/modules/migrate/templates/**/*.template.ts` |
| `jsonTransport: true` rejected in smtp config            | Widen vendor `smtp?` union to include `JSONTransport.Options` |
| `@types/supertest` old types mismatch test.helper.ts     | Bump `@types/supertest` to match upstream    |

All of these are **legitimate upstream-candidate patches** — they fix
problems that every consumer will hit. The `nest-server-core-contributor`
agent should recognize them and suggest them as Upstream-PR candidates.

**TypeScript 6 (core 12.x) — project config only, never a core patch.** The
vendored core is compiled with the project's `tsconfig.json`, so the compiler
defaults TypeScript 6 changed hit it directly. The core compiles under the
settings of `11.43.x-to-12.0.x.md` §2; the fix belongs in the project config:

| Symptom                                                  | Fix                                          |
| -------------------------------------------------------- | -------------------------------------------- |
| Hundreds of `TS2322` / `TS18048` in `src/core/`          | `"strict": false` (TypeScript 6 default is `true`) |
| `Cannot find name 'process'` / `'Buffer'`                | `"types": ["node", "vitest/globals"]`        |
| `TS5011 … 'rootDir' setting must be explicitly set`      | Set `rootDir` in `tsconfig.build.json`       |
| `TS5011` / `TS5110` from `pnpm run migrate:*` while `build` passes | The migrate bootstrap reads `tsconfig.json`; replace it (see "The migrate CLI in a Vendored Project") |
| `TS5107 Option 'moduleResolution=node10' is deprecated`  | `"module"` and `"moduleResolution"` `"nodenext"` |
| `TS2307` on `@nestjs/…/dist/…` in project code           | Import from the package root (the core already does) |
| `TS2835` on a relative `await import('./x')` in project code | No relative dynamic `import()`: no specifier works everywhere (`tsc` output needs `./x.js`, a ts-node source run does not map it to `.ts`). A static import, or move what a cycle needs into a module of its own; the core has none for that reason |

## The migrate CLI in a Vendored Project

Upstream ships a `migrate` CLI as a `bin` field in `@lenne.tech/nest-server`
package.json. Since vendoring drops that package, the CLI is no longer installed
into `node_modules/.bin/`. `lt fullstack convert-mode` therefore copies
`bin/migrate.js` into the project and repoints every `migrate:*` script at it —
no global install, no hand-written wrapper needed.

Locally the scripts pass `--compiler ts:./migrations-utils/ts-compiler.js`, a
bootstrap the CLI writes into the project. It loads the `.ts` migrations (and,
in the repo layout, the vendored core) at run time. Read the file before touching
the tsconfig; its header tells the form:

- **Legacy, reads the project `tsconfig.json`**: header `ts-node bootstrap for the
  migrate CLI (vendor mode).`, `tsNode.register({ transpileOnly: true,
  compilerOptions: … })` without `skipProject`. This is the file existing vendor
  projects carry. Under TypeScript 6 the options it inherits fail the load:
  `TS5011` (`outDir` without `rootDir`; a `rootDir` in `tsconfig.build.json` does
  not reach it) and `TS5110` (`commonjs` on a `nodenext` config).
- **Current**: header `TypeScript loader for the migrate CLI (vendor mode).` It uses
  the core's own loader, `src/core/modules/migrate/helpers/ts-compiler.js`, where the
  core ships it (core 12.x: an `@swc/core` require hook with the options of the
  `tsc` build, which checks no types and needs `@swc/core` as devDependency; `tsc`
  in `build` and `check` still does), and otherwise registers ts-node with
  `skipProject: true`. It works on core 11 and 12 alike and needs no change on the
  sync.

Replace the legacy file before the core sync into 12.x. From 12.0 the core imports
`./x.js`, which ts-node cannot load at all, so on core 12 the bootstrap has to hand
over to the core's loader; a ts-node bootstrap, with or without `skipProject`,
fails there. `lt fullstack update`, run after the core sync with a CLI that carries
the current form, replaces the file, but only one byte-identical to the one the CLI
once generated (CRLF tolerated); a hand-edited legacy file is left alone on purpose.
Replace that one, or one under an older CLI, by hand. On core 12 in a CommonJS
project the whole file can be `module.exports =
require('../src/core/modules/migrate/helpers/ts-compiler.js');`: requiring the
loader registers it, and its export is the idempotent register function the
`--compiler ts:` contract calls. On core 11 the minimal fix keeps ts-node: add
`skipProject: true`, keep `transpileOnly` and its own `compilerOptions`, and pick
`moduleResolution` by the TypeScript major (`'bundler'` from 6, `'node'` below):
without a project config ts-node falls back to `node`, which TypeScript 6 rejects
(`TS5107`), while TypeScript 5 accepts `bundler` only with ES module output.

ts-node stays a devDependency while the legacy form is in place, and with the
current form while the core is below 12.

### Core 12.x: what the sync has to carry

The 12.x core is written as ES module source (`./x.js` imports) and compiles as
CommonJS in a CommonJS project and as ESM in an ESM project. Four things outside
plain `.ts` changes decide whether a synced project still starts:

| Item | Why | Symptom when missing |
|---|---|---|
| Dev start through the core's loader: `nodemon.json` `"exec": "node -r ./src/core/modules/migrate/helpers/ts-compiler.js src/main.ts"`, the same in `nodemon-debug.json` (`node --inspect-brk -r …`), `docs:ci` and `start:nodemon`; keep a `-r tsconfig-paths/register` where the project declares `paths` | ts-node does not map `./x.js` to `x.ts` | `pnpm start` fails with `Cannot find module './core.module.js'` while build, `migrate:*` and tests pass |
| The non-TypeScript files of `src/core/modules/migrate/helpers/`: `package.json` (`"type": "commonjs"`), `ts-compiler.cjs`, `ts-compiler-hooks.mjs` | the loader is CommonJS in every project, and its hooks reach ES module sources | the loader fails to load, or `.ts` imported from ESM is not compiled |
| `bin/package.json` (`"type": "commonjs"`) next to `bin/migrate.js` | `bin/` is no part of `src/core/`, so no sync brings it; an ESM project would read the CommonJS shim as ESM | every `migrate:*` fails in an ESM project; harmless to add in a CommonJS one |
| `migrate/migration.helper.ts` (moved from `migrate/helpers/`) | the old path forwards, so `migrations-utils/migrate.js` keeps working | nothing, as long as the forwarder is synced too |

Tests: ts-jest does not map `./x.js` either (`moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$':
'$1' }`, or move to vitest), and every vitest config needs `resolve.extensions` with
`.js` before `.mjs`, or Vite loads a second graphql copy (`modernizing-toolchain`).
The `lt` CLI wires the dev start itself when it converts a project to vendor mode
with a 12.x core; a project already vendored needs the edits above on its sync.

### The production trap: migrations that never run

**The dev path (TypeScript loaded at run time) and the container path (compiled JS) are different, and
only the dev path is exercised while you work.** A vendored project must satisfy
all four of these, or the container silently skips every migration — no error,
no failed deploy, just data that was never migrated:

| Requirement | Provided by | Symptom when missing |
|---|---|---|
| Migrations compiled to `.js` | `tsconfig.build.json` includes `migrations/**/*.ts` | CLI cannot load `.ts`: the image has no TypeScript loader (devDependencies are pruned) |
| `dist/bin/migrate.js` exists | `copy:bin` script | entrypoint's `[ -f … ]` guard fails → **silent skip** |
| No `*.d.ts` in `dist/migrations/` | `prune:migrations` script | runner loads the declaration file as a second migration and throws on `export declare` |
| Store works without a TypeScript loader | `migrations-utils/migrate.js` probes for the compiled helper before `require('./ts-compiler')` | `MODULE_NOT_FOUND` under `set -e` → container never starts |
| Shim enters via `runCli()` | `bin/migrate.js` copied from a nest-server that has the fix | migrations run, then the process **never exits** — see below |

Current `lt` versions wire all four up automatically. **When auditing an older
project, verify them explicitly** — the failure is invisible until a real data
migration quietly does not run:

```bash
pnpm run build
ls projects/api/dist/bin/migrate.js        # must exist
ls projects/api/dist/migrations/           # only *.js, no *.d.ts
grep -c ts-compiler projects/api/migrations-utils/migrate.js   # must be guarded, not top-level
```

To prove the whole chain end-to-end, run the entrypoint's exact command against
the built output with `NODE_ENV=production` — that is the only way to catch a
silent skip before the deploy does.

### The stale-shim trap: migrations that run and then hang forever

`bin/migrate.js` is **not** under `src/core/`, so **no core sync ever updates
it**. It is copied once, by `lt fullstack convert-mode`, and from then on it
drifts. That matters because the CLI's entry contract changed: `main()` does the
work, and **`runCli()` is what terminates the process** — it drains stdout and
then exits explicitly, so a handle left behind by MongoDB or GridFS cannot keep
Node alive after the work is done. A stale shim calls `main()`.

The symptom is the opposite of the silent skip above, and it does not look like a
migration problem at all:

```
✓ Migration completed: …
All migrations completed successfully
<nothing, until the CI job's timeout>
```

Observed in lt-crm (DEV-2818): the `app:test` job sat at its **one-hour limit**
having produced no Playwright output whatsoever, so the failure read as a slow
E2E suite. The migrate step had completed its work and simply never returned.

Three things make this hard to spot:

- **It is latent until a sync "fixes" something else.** The stale shim probed only
  `../dist/core/…`, a layout a project with `rootDir: src` never emits, so every
  run fell through to ts-node — which happens to exit. Adding the correct
  `../dist/src/core/…` candidate (necessary: a pruned production image has no
  ts-node) is what activated the hang.
- **Production is usually unaffected**, which removes the loudest signal:
  `docker-entrypoint.sh` invokes the compiled CLI *directly*, so
  `require.main === module` holds and `runCli()` runs. Only the `migrate:*`
  scripts that go through the shim hang.
- **A hang is not a failure.** Nothing is logged, the exit code never arrives, and
  the job that dies is whichever one happened to call migrations.

Check it in one grep, and adopt rather than re-derive:

```bash
tail -4 projects/api/bin/migrate.js        # must reach runCli, not bare main()
curl -fsSL https://raw.githubusercontent.com/lenneTech/nest-server/develop/bin/migrate.js \
  | diff - projects/api/bin/migrate.js     # upstream is authoritative — copy it over
```

Upstream's version resolves `const run = cli.runCli || cli.main`, so it also works
against a `dist` built before `runCli` existed, and it probes all three layouts
(npm package, vendored repo, vendored image). **Do not hand-roll a `process.exit()`
into the shim** — it would discard the buffered completion log, which is exactly
what `flushAndExit()` exists to prevent.

**On every core sync, diff this file against the target tag along with
`src/core/`.** It is part of the same contract and nothing else covers it.

## Upstream Sync Workflow (curated)

When a new upstream version is available, the `nest-server-core-updater` agent:

1. Reads `VENDOR.md` baseline version and baseline commit SHA
2. Clones upstream baseline and upstream target into `/tmp/`
3. Computes three diffs:
   - `upstream-delta.patch`: upstream baseline → upstream target
   - `local-changes.patch`: upstream baseline → current project vendor
   - `conflicts.json`: file-level intersection of both diffs
4. Categorizes each upstream hunk:
   - **Clean pick** — no line overlap with any local change
   - **Conflict** — touches lines we also modified locally
   - **Not applicable** — touches code that no consumer file imports
     (grep of consumer imports against upstream file path)
5. Reapplies the flatten-fix on the freshly pulled `index.ts`, `core.module.ts`,
   `test/test.helper.ts`, and any edge-case files documented in VENDOR.md
6. Shows the curation proposal to the human for review
7. Applies approved clean-picks
8. Interactive 3-way merge for conflicts
9. Raises the project's npm dependencies to **at least** the upstream target's
   versions (semver-max, never downgrade), adds any new runtime helpers from
   `vendor-runtime-deps.json`, then — unless `--no-maintain` — refreshes the
   rest via `/lt-dev:maintenance:maintain`. A vendored project must never ship
   dependencies older than the upstream it mirrors.
10. Runs `pnpm run test` — commits if green
11. Syncs the upstream `CLAUDE.md` into `projects/api/CLAUDE.md` — the
    nest-server CLAUDE.md contains framework-specific instructions that Claude
    Code needs to work correctly with the vendored source. Section-level merge:
    new upstream sections are added, existing project-specific sections are
    preserved. The vendor-mode notice block (`<!-- lt-vendor-marker -->`) is
    always kept.
12. Updates `VENDOR.md` with new baseline + sync history entry

## Upstream PR Workflow (contribution)

When a local change in the vendored core looks generally useful, the
`nest-server-core-contributor` agent:

1. Reads `VENDOR.md` baseline version
2. Runs `git log --oneline src/core/` since baseline
3. **Filters out cosmetic commits:**
   - Commit messages matching `chore: format`, `style:`, `oxfmt`, `lint:fix`, `prettier`
   - Commits whose normalized diff (whitespace, quotes, trailing commas removed)
     is empty
4. Categorizes substantial commits:
   - **Upstream-candidate** — generic bugfix, framework enhancement, framework
     test addition, type correction
   - **Project-specific** — business rules, customer-specific enums, project-name
     references, proprietary integrations
   - **Unclear** — asks the human
5. For each candidate:
   - Cherry-picks the commit onto a fresh branch in the local upstream clone
     (or clones fresh if needed)
   - Writes a PR-body draft explaining why the change is generally useful
     and what project motivated it
6. Presents a summary + link list to the human for review
7. Human pushes and opens the PR via normal GitHub flow
8. After merge, the next `update-nest-server-core` run will pick up the
   change as upstream-delivered and can remove the local patch from
   `VENDOR.md`'s local-changes log

**The ceiling is an open DRAFT PR into `develop` — never a merge.** Never merge
the PR, never advance `develop` → `main`, never tag/release/publish. Always
`gh pr create --draft`; never `gh pr ready`. Taking a PR out of draft is how the
maintainer says they have decided — that signal is theirs to give. This holds even
when an earlier instruction sounded like blanket approval ("merge everything").

### Upstream branch model (lenneTech/nest-server)

The default branch is **`develop`**; feature/fix PRs target `develop`. `main` only
receives merge commits (`Merge pull request #NNN from lenneTech/develop`), one per
release. Consequences:

- **Base contribution branches on `develop`, not `main`.**
- `VENDOR.md` baseline SHAs are **`main` merge commits**, so
  `git merge-base --is-ancestor <baseline> origin/develop` returns **false** even
  when the content matches. To find upstream changes since the baseline, diff by
  path (`git log <baseline>..origin/main -- <path>`) or compare `develop` HEAD
  content directly — do not conclude "no changes" from the ancestor check.

### Verifying an SWC / circular-import fix

nest-server ships no `.swcrc`, but `@swc/core` is installed and `npx madge` works.

- `nest start -b swc` ≈ swc with `module.type=commonjs`, `jsc.target=es2021`,
  `legacyDecorator: true`, `decoratorMetadata: true`, `keepClassNames: true`.
  Supply that as a config file — **swc defaults alone will NOT reproduce
  decorator-driven TDZ crashes**, and you will wrongly conclude there is no bug.
- Compile output must land **inside the repo** (e.g. `./.swc-tdz`), or Node cannot
  resolve `@nestjs/common` / `reflect-metadata` from it. SWC keeps the `src/`
  prefix → require from `<out>/src/core/...`.
- `git stash -u` swallows untracked probe scripts — write the probe **after**
  stashing when A/B-testing baseline vs. patched.
- **Only cycles dereferenced at module-evaluation time are fatal** — e.g. a DI
  token inside `@Inject(...)`, which is evaluated when the class is defined. A cycle
  that merely touches a class lazily inside a method body is benign. Do not "fix"
  those; madge will keep reporting them and that is correct.

## Cosmetic-vs-Substantial: Why Filter

Running `pnpm run format` and `pnpm run lint` on a freshly vendored upstream
often produces a formatting-only commit if the project's formatter config
differs from upstream's. These commits have real line changes but zero
semantic content. Without filtering, the contributor agent would suggest
them as upstream-PRs — wasting reviewer time on upstream and creating
unwanted churn.

The filter lives **in the agent**, not in `.oxlintignore` or `.prettierignore`.
The vendored code should always stay format-compliant with project standards.

In the lenne.tech ecosystem, nest-server and nest-server-starter use the
**same oxfmt configuration**, so the initial format-commit after vendoring
is usually a no-op anyway. If the target consumer uses a different formatter,
the first format-commit may be substantial — and it should be one isolated
commit with a clear `chore: format` prefix so the filter recognizes it.

## Rollback

If the vendor pilot fails or needs to be reverted:

```bash
# In the consumer project:
cd projects/api
git log --oneline | grep -E "vendor|framework" | head -20
# Identify the vendor commit range
git revert <first-vendor-commit>..<last-commit> --no-edit
pnpm install
pnpm run test
```

This restores `@lenne.tech/nest-server` as an npm dependency and removes the
`src/core/` tree. No data loss, no upstream impact.

## References

- nest-server upstream: https://github.com/lenneTech/nest-server
- nest-server-starter: https://github.com/lenneTech/nest-server-starter
- Migration guides (for npm-based upgrades): https://github.com/lenneTech/nest-server/tree/main/migration-guides
- CLI vendor pipeline source: `cli/src/extensions/server.ts#convertCloneToVendored` (https://github.com/lenneTech/cli)

## Related Skills & Commands

| Element | Relationship |
|---------|--------------|
| **Agent**: `nest-server-core-updater` | Executes the upstream-to-project sync |
| **Agent**: `nest-server-core-contributor` | Prepares project-to-upstream PRs |
| `/lt-dev:backend:update-nest-server-core` | User-facing entry point for the sync |
| `/lt-dev:backend:contribute-nest-server-core` | User-facing entry point for the PR prep |
| `nest-server-updating` skill | The npm-mode counterpart to this vendor mode |
| `contributing-to-lt-framework` skill | Editing the framework repo itself via `pnpm link` |
| `nuxt-extensions-core-vendoring` skill | The frontend mirror of this pattern |
