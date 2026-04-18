---
name: nest-server-core-vendoring
description: 'Provides knowledge and resources for projects that have vendored the @lenne.tech/nest-server core directly into their source tree (under projects/api/src/core/ instead of consuming via npm). Covers the vendor model, the flatten-fix pattern, the Upstream-to-Project sync workflow, the Project-to-Upstream PR workflow, typical conflicts, and how cosmetic changes are distinguished from substantial upstream candidates. Activates for vendored nest-server core discussions, "sync core from upstream", "port local core change to upstream", conflict resolution during vendor sync, or questions about the vendor pattern. Delegates execution to lt-dev:nest-server-core-updater (for syncs) and lt-dev:nest-server-core-contributor (for upstream PR preparation). NOT for npm-based nest-server updates (use nest-server-updating). NOT for writing new NestJS code (use generating-nest-servers).'
effort: high
---

# Vendored nest-server core Knowledge Base

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
| "Sync vendored core from upstream v11.25.0"                | **THIS SKILL**                 |
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

1. **Change `src/core/` ONLY when the change is generally useful to all
   nest-server consumers.** Valid reasons:
   - Bugfixes that apply to every consumer
   - Framework enhancements with broad applicability
   - Closing security vulnerabilities
   - Build/TypeScript compatibility fixes that every consumer would hit
2. **Every other change belongs in project code** (outside `src/core/`),
   via modification, inheritance, extension, or `ICoreModuleOverrides`.
   Project-specific business rules, customer enums, or proprietary
   integration adapters must never live in the vendored core.
3. **Generally-useful changes MUST be submitted as an upstream PR** to
   `github.com/lenneTech/nest-server`. Use
   `/lt-dev:backend:contribute-nest-server-core` to prepare the PR. Do not
   let useful fixes rot in a single project's vendor tree — they belong
   upstream so every consumer benefits and the local patch disappears on
   the next sync.
4. **When in doubt, ask before editing `src/core/`.** The contributor
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
package.json. Since we drop that package, the CLI is no longer auto-installed
into `node_modules/.bin/`. Two workarounds:

1. **Recommended:** Keep a global `migrate` CLI available
   (`npm i -g @lenne.tech/nest-server` once per dev machine). The vendored
   store/compiler files are resolved locally — the CLI itself is a thin
   wrapper.
2. **Alternative:** Add a thin wrapper script in `migrations-utils/cli.js`
   that imports the vendored `migrate-runner` directly. More robust, more work.

The `migrate:*` scripts in `package.json` should use a **local ts-node bootstrap**
because the project-level `tsconfig.json` usually restricts `types` to
`vitest/globals` only, which strips out `@types/node` and crashes the ts-node
compile of vendored core files:

```js
// migrations-utils/ts-compiler.js
const tsNode = require('ts-node');
tsNode.register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    target: 'es2022',
    esModuleInterop: true,
    experimentalDecorators: true,
    emitDecoratorMetadata: true,
    skipLibCheck: true,
    types: ['node'],
  },
});
```

Then in `package.json` scripts: `--compiler ts:./migrations-utils/ts-compiler.js`.

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
9. Runs `pnpm run test` — commits if green
10. Syncs the upstream `CLAUDE.md` into `projects/api/CLAUDE.md` — the
    nest-server CLAUDE.md contains framework-specific instructions that Claude
    Code needs to work correctly with the vendored source. Section-level merge:
    new upstream sections are added, existing project-specific sections are
    preserved. The vendor-mode notice block (`<!-- lt-vendor-marker -->`) is
    always kept.
11. Updates `VENDOR.md` with new baseline + sync history entry

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
