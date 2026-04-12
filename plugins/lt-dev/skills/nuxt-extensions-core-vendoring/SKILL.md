---
name: nuxt-extensions-core-vendoring
description: 'Provides knowledge and resources for projects that have vendored the @lenne.tech/nuxt-extensions module directly into their source tree (under app/core/ instead of consuming via npm). Covers the vendor model, the Upstream-to-Project sync workflow, the Project-to-Upstream PR workflow, typical conflicts, and how cosmetic changes are distinguished from substantial upstream candidates. Activates for vendored nuxt-extensions discussions, "sync frontend core from upstream", "port local frontend core change to upstream", conflict resolution during frontend vendor sync, or questions about the frontend vendor pattern. Delegates execution to lt-dev:nuxt-extensions-core-updater (for syncs) and lt-dev:nuxt-extensions-core-contributor (for upstream PR preparation). NOT for npm-based nuxt-extensions updates (use developing-lt-frontend). NOT for writing new Nuxt code (use developing-lt-frontend).'
effort: high
---

# Vendored nuxt-extensions core Knowledge Base

This skill provides **knowledge and resources** for lenne.tech projects that have
vendored the @lenne.tech/nuxt-extensions module into their source tree. For automated
execution, use the matching agents:

- `lt-dev:nuxt-extensions-core-updater` via `/lt-dev:frontend:update-nuxt-extensions-core` --
  pulls upstream changes into the vendored core, with AI-driven curation against
  local patches
- `lt-dev:nuxt-extensions-core-contributor` via `/lt-dev:frontend:contribute-nuxt-extensions-core` --
  identifies substantial local changes to the vendored core and prepares them as
  Upstream-Pull-Requests to the nuxt-extensions repository

## When This Skill Activates

- Discussing the vendored nuxt-extensions pattern
- Asking how to sync frontend core from upstream into a vendored project
- Asking how to port a local frontend fix back to the upstream repository
- Troubleshooting nuxt.config.ts module registration after vendoring
- Planning an upstream-sync with conflict resolution for the frontend core
- Explaining the difference to the classic npm-based update flow for nuxt-extensions

## Skill Boundaries

| User Intent                                                | Correct Skill                         |
| ---------------------------------------------------------- | ------------------------------------- |
| "Sync vendored frontend core from upstream 1.5.3"          | **THIS SKILL**                        |
| "Port this composable fix back to nuxt-extensions"         | **THIS SKILL**                        |
| "Update nuxt-extensions via npm"                           | developing-lt-frontend                |
| "Create a new Nuxt composable"                             | developing-lt-frontend                |
| "Fix a CVE via npm audit"                                  | maintaining-npm-packages              |
| "Sync vendored backend core from upstream"                 | nest-server-core-vendoring            |

## Detecting a Vendored Frontend Project

A project is considered **vendored** if **all** of the following are true:

1. `app/core/VENDOR.md` exists (in the frontend subproject root, e.g. `projects/app/app/core/VENDOR.md`)
2. `package.json` does **not** list `@lenne.tech/nuxt-extensions` in
   `dependencies` or `devDependencies`
3. `app/core/` contains the nuxt-extensions source (composables, components, plugins, etc.)

A project is **npm-based** (classic) if:

- `@lenne.tech/nuxt-extensions` is a regular dependency in `package.json`
- There is no `VENDOR.md` under `app/core/`

The `fullstack-updater` (classic agent) detects this automatically and delegates
to `nuxt-extensions-core-updater` for vendored projects.

## The Frontend Vendor Model (one-way curation)

The vendored frontend core lives as **first-class project code**. Flow is:

```
Upstream (github.com/lenneTech/nuxt-extensions)
    |
    | /lt-dev:frontend:update-nuxt-extensions-core  (curated, one-way)
    v
Project vendor (app/core/)
    |
    | /lt-dev:frontend:contribute-nuxt-extensions-core  (manual review, cherry-pick)
    v
Upstream PR (via normal GitHub review process)
```

**Local patches are expected.** Projects legitimately modify the vendored core
when business rules, integration adapters, or bugfixes are needed before upstream
ships them. Those patches persist through syncs.

**Changes are never auto-pushed.** The contributor agent prepares PR drafts --
a human reviews and submits them through normal GitHub workflow. No git-subtree
push, no automatic upstream replay.

## No Flatten-Fix Needed

Unlike the backend vendor model (nest-server), the nuxt-extensions source structure
is **already flat**. The upstream repository organizes its code directly in `src/`
without a nested `core/` subdirectory, so when vendored into `app/core/`, no
import-path rewriting is needed for internal files.

This is an explicit simplification compared to the backend vendoring pattern:
- **Backend (nest-server):** Requires flatten-fix on `index.ts`, `core.module.ts`,
  `test/test.helper.ts`, and `core-persistence-model.interface.ts` after every sync
- **Frontend (nuxt-extensions):** No flatten-fix needed -- direct copy works

The only import changes required are in the **consumer project**, not in the
vendored code itself:
1. `nuxt.config.ts` -- remove the `@lenne.tech/nuxt-extensions` module entry,
   replace with local module registration pointing to `app/core/`
2. Up to 4 explicit type/testing imports that reference the npm package name
   need rewriting to relative paths

## Vendor Directory Structure

After vendoring, the frontend subproject looks like:

```
projects/app/
├── app/
│   ├── core/
│   │   ├── VENDOR.md             <- NEW (marker + baseline metadata)
│   │   ├── LICENSE               <- copied for provenance
│   │   ├── composables/          <- copied from upstream src/runtime/composables/
│   │   ├── components/           <- copied from upstream src/runtime/components/
│   │   ├── plugins/              <- copied from upstream src/runtime/plugins/
│   │   ├── middleware/           <- copied from upstream src/runtime/middleware/
│   │   ├── utils/                <- copied from upstream src/runtime/utils/
│   │   ├── types/                <- copied from upstream src/runtime/types/
│   │   └── ...                   <- other runtime directories
│   ├── components/               <- project components
│   ├── composables/              <- project composables
│   └── ...
├── nuxt.config.ts                <- module entry rewritten
├── package.json                  <- @lenne.tech/nuxt-extensions removed
└── ...
```

Nuxt's auto-import mechanism handles composables and components from `app/core/`
automatically -- no consumer-import codemod is needed for auto-imported items.

## nuxt.config.ts Rewrite Pattern

When converting from npm to vendor mode, the `nuxt.config.ts` module registration
changes:

**Before (npm mode):**
```typescript
export default defineNuxtConfig({
  modules: [
    '@lenne.tech/nuxt-extensions',
    // other modules...
  ],
})
```

**After (vendor mode):**
```typescript
export default defineNuxtConfig({
  modules: [
    // '@lenne.tech/nuxt-extensions' removed -- vendored into app/core/
    // other modules...
  ],
})
```

The `lt frontend convert-mode --to vendor` CLI command handles this rewrite
automatically.

## Upstream Sync Workflow (curated)

When a new upstream version is available, the `nuxt-extensions-core-updater` agent:

1. Reads `VENDOR.md` baseline version and baseline commit SHA
2. Clones upstream baseline and upstream target into `/tmp/`
3. Computes three diffs:
   - `upstream-delta.patch`: upstream baseline -> upstream target
   - `local-changes.patch`: upstream baseline -> current project vendor
   - `conflicts.json`: file-level intersection of both diffs
4. Categorizes each upstream hunk:
   - **Clean pick** -- no line overlap with any local change
   - **Conflict** -- touches lines we also modified locally
   - **Not applicable** -- touches code that no consumer file imports
5. Shows the curation proposal to the human for review
6. Applies approved clean-picks
7. Interactive 3-way merge for conflicts
8. Runs `nuxt build` + `pnpm run lint` -- commits if green
9. Syncs the upstream `CLAUDE.md` into the frontend project's `CLAUDE.md` --
   section-level merge preserving project-specific content
10. Updates `VENDOR.md` with new baseline + sync history entry

**IMPORTANT -- Tag format:** nuxt-extensions tags have **no** `v` prefix. Use
`--branch 1.5.3`, not `--branch v1.5.3`.

## Upstream PR Workflow (contribution)

When a local change in the vendored core looks generally useful, the
`nuxt-extensions-core-contributor` agent:

1. Reads `VENDOR.md` baseline version
2. Runs `git log --oneline app/core/` since baseline
3. **Filters out cosmetic commits:**
   - Commit messages matching `chore: format`, `style:`, `oxfmt`, `lint:fix`, `prettier`
   - Commits whose normalized diff (whitespace, quotes, trailing commas removed)
     is empty
4. Categorizes substantial commits:
   - **Upstream-candidate** -- generic bugfix, framework enhancement, framework
     test addition, type correction
   - **Project-specific** -- business rules, customer-specific enums, project-name
     references, proprietary integrations
   - **Unclear** -- asks the human
5. For each candidate:
   - Cherry-picks the commit onto a fresh branch in the local upstream clone
     (1:1 path mapping, no reverse flatten-fix needed)
   - Writes a PR-body draft explaining why the change is generally useful
     and what project motivated it
6. Presents a summary + link list to the human for review
7. Human pushes and opens the PR via normal GitHub flow
8. After merge, the next `update-nuxt-extensions-core` run will pick up the
   change as upstream-delivered and can remove the local patch from
   `VENDOR.md`'s local-changes log

## No Reverse Flatten-Fix Needed

Unlike backend contributions (where `./common/` must become `./core/common/`
before submitting upstream), nuxt-extensions uses a 1:1 path mapping between
the vendored tree and upstream. Files can be cherry-picked directly without
any import-path transformation.

## Cosmetic-vs-Substantial: Why Filter

Running `pnpm run format` and `pnpm run lint` on a freshly vendored upstream
often produces a formatting-only commit if the project's formatter config
differs from upstream's. These commits have real line changes but zero
semantic content. Without filtering, the contributor agent would suggest
them as upstream-PRs -- wasting reviewer time on upstream and creating
unwanted churn.

The filter lives **in the agent**, not in `.oxlintignore` or `.prettierignore`.
The vendored code should always stay format-compliant with project standards.

## Rollback

If the vendor pilot fails or needs to be reverted:

```bash
# In the consumer project frontend:
cd projects/app
git log --oneline | grep -E "vendor|framework" | head -20
# Identify the vendor commit range
git revert <first-vendor-commit>..<last-commit> --no-edit
pnpm install
pnpm run build
```

This restores `@lenne.tech/nuxt-extensions` as an npm dependency and removes the
`app/core/` vendor tree. No data loss, no upstream impact.

## References

- nuxt-extensions upstream: https://github.com/lenneTech/nuxt-extensions
- Changelog: https://github.com/lenneTech/nuxt-extensions/blob/main/CHANGELOG.md
- Releases: https://github.com/lenneTech/nuxt-extensions/releases
- Backend vendor skill (for comparison): `nest-server-core-vendoring`
