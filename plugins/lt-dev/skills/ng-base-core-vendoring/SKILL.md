---
name: ng-base-core-vendoring
description: 'Knowledge base for Angular apps that vendored @lenne.tech/ng-base into src/core/: modification policy, tsconfig paths, upstream sync and PRs. Activates on "sync angular core" or ng-base vendor-sync conflicts. NOT for npm mode or Nuxt cores (use nuxt-extensions-core-vendoring).'
---

# Vendored ng-base core Knowledge Base

## Gotchas

- **Both cores live under `src/core/`, and only VENDOR.md tells them apart.** An Angular app vendors ng-base to
  `projects/app/src/core/`, the API vendors nest-server to `projects/api/src/core/`. Decide by the package the
  `VENDOR.md` names (`@lenne.tech/ng-base` vs `@lenne.tech/nest-server`), never by the path.
  `bash "${CLAUDE_PLUGIN_ROOT}/scripts/detect-frontend.sh"` does exactly that.
- **No import is rewritten.** The app imports `@lenne.tech/ng-base` and `@lenne.tech/ng-base/<entry>` in both
  modes; `tsconfig.json` `compilerOptions.paths` maps every specifier onto `src/core/`. A project file that
  imports a relative path into `src/core/` works only in vendor mode and breaks the way back to npm.
- **The mapping follows the entry points and is derived, never hand-written.** One key per `ng-package.json`
  (its `lib.entryFile`), nested entries included (`@lenne.tech/ng-base/ui/provide`,
  `@lenne.tech/ng-base/files/ui`). After every sync run
  `node "${CLAUDE_PLUGIN_ROOT}/scripts/ng-base-paths.mjs" <app> --check`; a missing key is a TS2307 on every
  import of that entry. Keep every `ng-package.json` in the copy: without it the mapping cannot be derived.
- **Tags carry a `v`, the npm version does not:** tag `v22.0.0`, package `22.0.0`. The MAJOR digit is the
  Angular major, so a major sync is an Angular upgrade, not a core sync.
- **Stylesheets are imported relative to `src/core/` in vendor mode** (the theme is
  `@lenne.tech/ng-base/ui/styles/theme.css` on npm). There is no `node_modules/@lenne.tech/ng-base` to fall
  back on, so a stylesheet still importing the package specifier fails the build.
- **Testing an unreleased ng-base in npm mode is an injected `file:` dependency, never `pnpm link`.**
  `"@lenne.tech/ng-base": "file:../ng-base/dist/ng-base"` plus
  `"dependenciesMeta": { "@lenne.tech/ng-base": { "injected": true } }`, and `pnpm install` after every
  ng-base build. A linked `dist` resolves `@angular/core` from ng-base's own `node_modules`, two Angular copies
  run, and SSR fails with `NG0203`; `--preserve-symlinks` breaks the Angular CLI itself. Such a pin never
  ships: a release refuses it (`maintaining-lt-stack`, ng-base-starter recipe).

## When This Skill Activates

- The app has `src/core/VENDOR.md` naming `@lenne.tech/ng-base`
- Syncing the core from upstream, resolving a sync conflict, contributing a core fix back
- An `@lenne.tech/ng-base/...` import fails with TS2307 in a vendored app

## Skill Boundaries

| Situation | Use instead |
| --- | --- |
| App consumes ng-base from npm | raise the exact pin (`pnpm add @lenne.tech/ng-base@<version>`) |
| Vendored Nuxt core (`app/core/`) | `nuxt-extensions-core-vendoring` |
| Vendored nest-server core (`projects/api/src/core/`) | `nest-server-core-vendoring` |
| Converting between npm and vendor mode | the lt CLI (`lt fullstack convert-mode`, `lt frontend convert-mode`) |

## Detecting a Vendored Angular App

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/detect-frontend.sh"
# frontend: angular · app: projects/app · library: @lenne.tech/ng-base · mode: vendor · core: projects/app/src/core
```

## Modification Policy (when to touch `src/core/`)

`src/core/` is first-class project code, but **not a fork**. Edit it only for changes useful to every consumer:

- bug fixes every consumer would hit
- broad enhancements (new services, better defaults, SSR fixes)
- security fixes
- type or config compatibility fixes

Everything else stays outside `src/core/` (in `src/app/`, the app's own providers and components). A
generally useful change **must** go upstream: `/lt-dev:frontend:contribute-ng-base-core`. Before hand-patching,
check whether a newer upstream already contains the fix (compare the VENDOR.md baseline with the latest
release and with `main`); if it does, adopt it with `/lt-dev:frontend:update-ng-base-core` instead. A
`PostToolUse` hook (`vendor-core-edit-guard.sh`) reminds of this after every edit inside the core.

## The Vendor Model

| Upstream (`lenneTech/ng-base`) | App |
| --- | --- |
| `projects/ng-base/` (the `ng g library` layout) | `src/core/` |
| `projects/ng-base/src/public-api.ts` | `src/core/src/public-api.ts` → `@lenne.tech/ng-base` |
| `projects/ng-base/<entry>/ng-package.json` + `src/public-api.ts` | `src/core/<entry>/...` → `@lenne.tech/ng-base/<entry>` |
| `*.spec.ts`, `package.json`, `tsconfig*.json`, `test-setup.ts`, karma/vitest config, `README.md`, `CLAUDE.md`, `AGENTS.md`, `.claude/`, `dist/`, `node_modules/` | not copied |
| (none) | `src/core/VENDOR.md`: baseline, sync history, local changes |

The library's `CLAUDE.md` and `AGENTS.md` address people working on ng-base and stay out of the app; the app's
own CLAUDE.md comes from ng-base-starter. The library's dependencies and peers become dependencies of the app.

## VENDOR.md

Written by the lt CLI at conversion (`buildNgBaseVendorMd`, cli `src/lib/ng-base-vendor.ts`):

- `## Modification Policy`, the rules above
- `## Baseline`: `Upstream-Repo`, `Baseline-Version` (`22.0.0`), `Baseline-Commit` (full SHA), date, source
- `## Sync history`: date, from, to, notes, one row per sync
- `## Local changes`: date, commit, scope, reason, status, one row per local core change

Log every substantial local change in "Local changes": the updater classifies conflicts by it, the
contributor finds the candidates by it. `pnpm run check:vendor-freshness` warns when npm has a release newer
than the baseline.

## Upstream Sync Workflow (curated)

`/lt-dev:frontend:update-ng-base-core` → agent `ng-base-core-updater`: baseline and target cloned to `/tmp`,
upstream delta against local changes, hunks categorized and reviewed, approved hunks applied 1:1, tsconfig
paths and stylesheet imports re-derived, dependencies raised to the library's manifest (wire-critical peers
such as `better-auth` only together with the API), the app's `check` green, VENDOR.md updated.

## Upstream PR Workflow (contribution)

`/lt-dev:frontend:contribute-ng-base-core` → agent `ng-base-core-contributor`: local core commits since the
baseline, cosmetic and project-specific ones filtered out, the rest prepared as branches in a clone of
upstream with the spec each change needs and the repo's `check` green. ng-base has only `main`: a
contribution is a **draft** PR into `main`, pushed and opened by the user. Never tag: a `v*` tag publishes the
package.

## Rollback

```bash
git log --oneline -- src/core/            # find the sync commits
git revert --no-edit <sync-commit>^..<vendor-md-commit>   # the ^ includes the core sync itself
node "${CLAUDE_PLUGIN_ROOT}/scripts/ng-base-paths.mjs" . --check   # the mapping matches the restored core
```

## Related Skills & Commands

- `/lt-dev:frontend:update-ng-base-core`, `/lt-dev:frontend:contribute-ng-base-core`
- `nuxt-extensions-core-vendoring`: the Nuxt counterpart (`app/core/`)
- `nest-server-core-vendoring`: the backend core, also under `src/core/`
- `maintaining-lt-stack`: releasing ng-base and ng-base-starter
