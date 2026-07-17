---
name: nest-server-core-vendoring
description: 'Provides knowledge and resources for projects that have vendored the @lenne.tech/nest-server core directly into their source tree (under projects/api/src/core/ instead of consuming via npm). Covers the vendor model, the flatten-fix pattern, the Upstream-to-Project sync workflow, the Project-to-Upstream PR workflow, typical conflicts, and how cosmetic changes are distinguished from substantial upstream candidates. Activates for vendored nest-server core discussions, "sync core from upstream", "port local core change to upstream", conflict resolution during vendor sync, or questions about the vendor pattern. Delegates execution to lt-dev:nest-server-core-updater (for syncs) and lt-dev:nest-server-core-contributor (for upstream PR preparation). NOT for npm-based nest-server updates (use nest-server-updating). NOT for writing new NestJS code (use generating-nest-servers).'
---

# Vendored nest-server core Knowledge Base

## Gotchas

- **Flatten-fix edge case on `core-persistence-model.interface.ts`** — During flatten-fix, most files get `'../../..'` rewritten to `'../..'`. This file is an exception: it sits one directory deeper and needs `'../../..'` → `'../..'` → `'..'`. Missing this step causes a silent `Cannot find module` at runtime, not compile-time.
- **`migrate` CLI disappears after vendoring** — The upstream `@lenne.tech/nest-server` package exports a `migrate` binary in its `package.json`. When vendored (no longer a dependency), that binary is gone from `node_modules/.bin/`. `convert-mode` copies `bin/migrate.js` into the project and repoints the `migrate:*` scripts at it. See "The migrate CLI in a Vendored Project" below — and note that the **production** path differs from the local ts-node path, which is how migrations end up silently never running in the container.
- **Cosmetic commits are tempting upstream PR candidates** — Formatting-only, linting-only, or rename-only commits look substantive but offer no value as upstream PRs. The contributor agent filters these — if authoring manually, verify the commit changes behavior, not just style.
- **Local patches in `src/core/` are invisible to future `/update-nest-server-core` runs** — The updater does AI-driven curation but cannot read your intent. Document every intentional local deviation in `src/core/LOCAL-PATCHES.md` so the next sync doesn't silently undo your work.

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
4. **Generally-useful changes MUST be submitted as an upstream PR** to
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

## The migrate CLI in a Vendored Project

Upstream ships a `migrate` CLI as a `bin` field in `@lenne.tech/nest-server`
package.json. Since vendoring drops that package, the CLI is no longer installed
into `node_modules/.bin/`. `lt fullstack convert-mode` therefore copies
`bin/migrate.js` into the project and repoints every `migrate:*` script at it —
no global install, no hand-written wrapper needed.

Locally the scripts pass `--compiler ts:./migrations-utils/ts-compiler.js`, a
ts-node bootstrap that exists because the project `tsconfig.json` usually
restricts `types` to `vitest/globals`, which strips `@types/node` and crashes
ts-node when it compiles vendored core files.

### The production trap: migrations that never run

**The dev path (ts-node) and the container path (compiled JS) are different, and
only the dev path is exercised while you work.** A vendored project must satisfy
all four of these, or the container silently skips every migration — no error,
no failed deploy, just data that was never migrated:

| Requirement | Provided by | Symptom when missing |
|---|---|---|
| Migrations compiled to `.js` | `tsconfig.build.json` includes `migrations/**/*.ts` | CLI cannot load `.ts`, no ts-node in the image |
| `dist/bin/migrate.js` exists | `copy:bin` script | entrypoint's `[ -f … ]` guard fails → **silent skip** |
| No `*.d.ts` in `dist/migrations/` | `prune:migrations` script | runner loads the declaration file as a second migration and throws on `export declare` |
| Store works without ts-node | `migrations-utils/migrate.js` probes for the compiled helper before `require('./ts-compiler')` | `MODULE_NOT_FOUND` under `set -e` → container never starts |

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
- `pnpm run build` regenerates the checked-in `FRAMEWORK-API.md` (timestamp-only
  diff). Discard it before committing — it is not part of any fix.

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
# In the consumer project (e.g. imo):
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
