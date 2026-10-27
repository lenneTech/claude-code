---
name: nest-server-updating
description: 'Updates @lenne.tech/nest-server in npm mode: version-specific breaking changes, stepwise major upgrades and error fixes, executed by the lt-dev:nest-server-updater agent. Activates on "update nest-server", "nest-server aktualisieren", "auf die neueste nest-server-Version heben", "pnpm run update", or TypeScript errors after an upgrade. NOT for vendored cores (use nest-server-core-vendoring). NOT for writing NestJS code (use generating-nest-servers). NOT for general npm updates (use maintaining-npm-packages).'
---

# @lenne.tech/nest-server Update Knowledge Base

This skill provides **knowledge and resources** for updating @lenne.tech/nest-server. For automated execution, use the `lt-dev:nest-server-updater` agent via `/lt-dev:backend:update-nest-server`.

**Important:** After updating nest-server, also check if `@lenne.tech/nuxt-extensions` in `projects/app/` needs a compatible update, as nuxt-extensions is aligned with nest-server.

## Gotchas

- **Crossing the jest→vitest boundary** — At some point on the upstream `nest-server-starter` timeline the test runner migrated from jest+ts-jest to vitest+unplugin-swc (check the starter's `package.json` for the current truth — if `vitest-e2e.config.ts` exists, the boundary is behind you). Updating an existing project across that boundary needs more than a `pnpm install`: every `@Prop` whose property is a TypeScript union (`'a' | 'b'`, `null | string`, an alias for either) must add `type: String` (or `type: Object` for record-likes), every `import * as supertest` must become a default import, every `jest.*` call must become `vi.*`, and `jest-e2e.json` + `babel.config.js` must be removed. Without these, vitest fails with "Cannot determine a type for the X field" from Mongoose, or "is not a function" from supertest. The full recipe lives in the `modernizing-toolchain` skill — apply Phases 2 and 3 before running `pnpm test`. A project still on jest when it reaches 12.x must migrate first: the NestJS 12 packages are ESM-only, and jest loads them only on Node 24.9+ (`ERR_REQUIRE_ASYNC_MODULE` below that).
- **The 12.0 step (NestJS 12, TypeScript 6) breaks builds without a single source change** — `11.43.x-to-12.0.x.md` is the guide; four things in it catch most projects. (1) Raise every NestJS-family pin and `typescript` together with nest-server (`pnpm run update` raises the pins the project already declares): one `@nestjs/*` package left on 11 installs a second NestJS copy, and the build fails with `Class 'X' incorrectly extends base class 'CoreX'`. (2) TypeScript 6 turns `strict` on, resolves `rootDir` to the tsconfig's directory and defaults `types` to `[]`, so `tsconfig.json` needs `"strict": false`, `"types": ["node", "vitest/globals"]` and a `rootDir` the `start:prod` path expects; an explicit `"moduleResolution": "node"` is error TS5107. (3) `@nestjs/{jwt,mongoose,passport,schedule,swagger,terminus}` resolve only from their package root, so a deep `…/dist/…` import fails with `TS2307` or `ERR_PACKAGE_PATH_NOT_EXPORTED`. (4) A subclass that redeclares its constructor no longer inherits the parent's `@Optional()` flags; the symptom is `Nest can't resolve dependencies of the XService (…, ?)`. nest-server itself is an ES module from 12.0 on, like every `@nestjs/*` package, and CommonJS projects stay CommonJS: Node loads them all through `require(esm)`, which is why the Node floor matters (22.12+, nest-server's `engines.node` names the exact one). A vendor-mode project has one more required step: its dev start moves from ts-node to the framework's loader (`node -r ./src/core/modules/migrate/helpers/ts-compiler.js src/main.ts`, guide §14), because the 12.x core imports `./x.js` and ts-node cannot load it; without it `pnpm start` fails with `Cannot find module './core.module.js'` while build, `migrate:*` and tests pass (details in `nest-server-core-vendoring`).
- **ESM projects are optional, never part of the update** — Converting a project to `"type": "module"` (guide §17 "Converting a project to ESM") is worth it only for a package that loads from an ES module alone (top-level `await`, `ERR_REQUIRE_ASYNC_MODULE` under `require(esm)`) or to match `nest new`. Do it as its own step after the update is green, with `lt server convert-esm --noConfirm` in the API project or a workspace root with `projects/api` (`--dry-run` previews; it refuses nest-server below 12 and, unless `--force`, a dirty git tree, so the conversion is one diff). What has no exact rewrite (a named import from a CommonJS package, a decorated field on an import cycle, a leftover `require`) comes with file:line and exit 1: fix it by hand (`generating-nest-servers` → ESM rules) and run the same command again, which on an ESM project re-checks without a clean tree. It ends with build, start of the BUILT server, `migrate:list` and dev start, because vitest passes code that Node's ESM loader refuses; with `--skip-verify`, or by the guide's steps on a CLI without the command, start the built server yourself.
- **`useDefineForClassFields` mismatch** — When migrating to vitest, both the `tsconfig.json` `compilerOptions.useDefineForClassFields` and the swc plugin in `vitest-e2e.config.ts` must be set to `true`. Mixing them (e.g. swc=false, ts=true) silently breaks NestJS DI: `securityCheck` gets the wrong `currentUser`, so user `signUp` returns `createdBy: null` even though the override service set it. There is no error, only test failures that look like business logic regressions.
- **Minor version bumps are treated as MAJOR** — `@lenne.tech/nest-server` follows a "stepwise update" policy even on minor versions. Jumping from `7.5.x` directly to `7.9.x` in one step is likely to miss breaking changes that were introduced sub-minor. Always run the update step-by-step via `pnpm run update`, even if the version gap looks small.
- **`pnpm run update` requires the target version in `package.json` FIRST** — The update script reads the current/target from `package.json`. Running it before bumping the version does nothing or produces confusing errors. Order: (1) bump `package.json` → (2) `pnpm install` → (3) `pnpm run update`.
- **`nuxt-extensions` alignment breaks silently** — `@lenne.tech/nuxt-extensions` is version-aligned with `@lenne.tech/nest-server`. Updating nest-server to `7.19.0` without also updating nuxt-extensions to `7.19.x` leaves the frontend consuming an outdated API contract. Types generated via `generate-types` may still pass locally but break at runtime on production.
- **Migration guides are cumulative — read ALL between old and new version** — If you jump from `7.12` to `7.19`, migration guides for `7.13`, `7.14`, `7.15`, `7.16`, `7.17`, `7.18`, `7.19` ALL apply. Don't skip reading them — each introduces non-trivial behavior changes.
- **Starter project is the ground truth for constellations** — When a migration is ambiguous (e.g., which package.json override to add, which config value to change), check `nest-server-starter`'s current `package.json` via GitHub raw. It reflects the canonical working constellation for the target version.

## Scope: npm mode vs vendored mode

This skill covers the **npm-mode** update flow (bumping `@lenne.tech/nest-server` in `package.json`, applying migration guides from the upstream repo, re-running tests). Its companion for **vendored projects** (those where `<api-root>/src/core/VENDOR.md` exists) is the `nest-server-core-vendoring` skill + the `nest-server-core-updater` agent via `/lt-dev:backend:update-nest-server-core`.

**The two flows share one migration-guide corpus** (the upstream `migration-guides/` directory applies to code regardless of consumption mode — it describes API deltas in the framework, not in the distribution channel). Everything in this skill about per-version breaking changes, error patterns, and error messages is equally valid in vendored mode. What differs is:

| Aspect | npm mode | vendored mode |
|--------|----------|---------------|
| Detection | no `src/core/VENDOR.md` | `src/core/VENDOR.md` exists |
| Bump command | `pnpm update @lenne.tech/nest-server` | `/lt-dev:backend:update-nest-server-core --target <v>` |
| Framework source location | `node_modules/@lenne.tech/nest-server/src/core/...` | `<api-root>/src/core/...` |
| Baseline version lookup | `pnpm list @lenne.tech/nest-server --depth=0` | `grep Baseline-Version <api-root>/src/core/VENDOR.md` |
| Source of truth for framework code | npm package `dist/` + shipped `src/` | local `src/core/` (committed, may carry patches) |
| Local patches | not persisted (lost on `pnpm install`) | expected; logged in `VENDOR.md` |
| Import statements in consumer code | `from '@lenne.tech/nest-server'` | relative: `from '../../src/core'` etc. |

The `nest-server-updater` agent auto-detects the project mode (Phase 0 in its workflow) and delegates to `nest-server-core-updater` when `VENDOR.md` is present, so users only ever need to invoke `/lt-dev:backend:update-nest-server` — the right flow kicks in automatically.

## When This Skill Activates

- Discussing nest-server updates or upgrades
- Asking about breaking changes between versions
- Troubleshooting update-related errors
- Planning migration strategies
- Comparing versions or checking compatibility

## Skill Boundaries

| User Intent | Correct Skill |
|------------|---------------|
| "Update nest-server to v14" | **THIS SKILL** |
| "Migrate to latest nest-server" | **THIS SKILL** |
| "Breaking changes in nest-server" | **THIS SKILL** |
| "Create a NestJS module" | generating-nest-servers |
| "Update all npm packages" | maintaining-npm-packages |
| "npm audit fix" | maintaining-npm-packages |

## Related Skills

| Element | Purpose |
|---------|---------|
| **Agent**: `lt-dev:nest-server-updater` | Automated execution of updates |
| **Command**: `/lt-dev:backend:update-nest-server` | User invocation |
| **Skill**: `generating-nest-servers` | Code modifications after update |
| **Skill**: `maintaining-npm-packages` | Package optimization |

---

## Core Resources

### GitHub Repositories

| Resource | URL | Purpose |
|----------|-----|---------|
| **nest-server** | https://github.com/lenneTech/nest-server | Main package repository |
| **Releases** | https://github.com/lenneTech/nest-server/releases | Release notes, changelogs |
| **Migration Guides** | https://github.com/lenneTech/nest-server/tree/main/migration-guides | Version-specific migration instructions |
| **Reference Project** | https://github.com/lenneTech/nest-server-starter | Current compatible code & package versions |

### npm Package

```bash
# Package info
pnpm view @lenne.tech/nest-server

# Current installed version
pnpm list @lenne.tech/nest-server --depth=0

# All available versions
pnpm view @lenne.tech/nest-server versions --json
```

---

## Migration Guide System

**Complete guide selection logic, fallback strategy, and fetch commands: [reference/migration-guides.md](reference/migration-guides.md)**

---

## Version Update Strategies

In @lenne.tech/nest-server, **Major versions are reserved for NestJS Major versions**.
Therefore, **Minor versions are treated like Major versions** and may contain breaking changes.

### Patch Updates (X.Y.Z → X.Y.W)

- Usually safe, no breaking changes
- Use the standard update workflow (see Quick Reference → Update Workflow)
- Apply the patch guides in the range (`X.Y.Z-to-X.Y.W.md`); a patch that needs action has one
- Run tests to verify
- **Example:** `11.42.5 → 11.42.9` - direct update OK, with guides `11.42.5-to-11.42.6.md` … `11.42.8-to-11.42.9.md`

### Minor Updates (X.Y.Z → X.W.0): Treat as Major

- **May contain breaking changes** (Minor = Major in this package)
- **Always stepwise**: Update through each minor version
- Each minor step requires full validation cycle
- Migration guides are essential
- **Example:** `11.6.0 → 11.8.0` becomes `11.6 → 11.7 → 11.8`

### Major Updates (X.Y.Z → W.0.0)

- Reserved for NestJS major version changes
- **Always stepwise**: Update through each major AND minor version
- Example: `11.6.0 → 12.2.0` becomes:
  1. `11.6 → 11.7 → ... → 11.latest` (all minors)
  2. `11.latest → 12.0` (major jump)
  3. `12.0 → 12.1 → 12.2` (all minors)
- Migration guides are critical

---

## Common Error Patterns

**TypeScript errors, runtime errors, and test failures after update: [reference/error-patterns.md](reference/error-patterns.md)**

---

## Reference Project Usage

**How to use nest-server-starter as source of truth: [reference/reference-project.md](reference/reference-project.md)**

---

## API Mode Awareness

**Impact of Rest/GraphQL/Both modes on updates: [reference/api-modes.md](reference/api-modes.md)**

---

## Update Modes

The `lt-dev:nest-server-updater` agent supports these modes:

| Mode | Flag | Behavior |
|------|------|----------|
| **Full** | (default) | Complete update with all migrations |
| **Dry-Run** | `--dry-run` | Analysis only, no changes |
| **Target Version** | `--target-version X.Y.Z` | Update to specific version |
| **Skip Packages** | `--skip-packages` | Skip npm-package-maintainer optimization |

---

## Quick Reference

### Commands

```bash
# Check current version
pnpm list @lenne.tech/nest-server --depth=0

# Check latest version
pnpm view @lenne.tech/nest-server version

# List migration guides
gh api repos/lenneTech/nest-server/contents/migration-guides --jq '.[].name'
```

### Update Workflow

The `pnpm run update` script requires this order:

1. **First:** Update the version in `package.json` to the desired target version
   ```
   "@lenne.tech/nest-server": "^X.Y.Z"
   ```

2. **Then:** Run the update script
   ```bash
   pnpm run update
   ```

**What `pnpm run update` does:**
- Verifies the specified version is available on npm
- Installs `@lenne.tech/nest-server` at the version from package.json
- Analyzes which packages inside `@lenne.tech/nest-server` were updated
- Installs those updated dependencies if they don't exist or have a lower version
- Ensures version consistency between nest-server and its peer dependencies

**Manual update (only if `pnpm run update` script is not available):**
```bash
pnpm add -E @lenne.tech/nest-server@X.Y.Z
pnpm install
```
Note: This skips the automatic dependency synchronization that `pnpm run update` provides.

### Package Optimization (after pnpm run update)

After `pnpm run update` completes, run comprehensive package maintenance:

```bash
# Via command (recommended)
/lt-dev:maintenance:maintain

# Or via agent (Agent tool with lt-dev:npm-package-maintainer in FULL MODE)
```

This ensures:
- Unused dependencies are removed
- Packages are correctly categorized (dependencies vs devDependencies)
- All packages are updated to their latest compatible versions
- Security vulnerabilities are addressed

### Validation Sequence

```bash
pnpm run build    # Must pass
pnpm run lint     # Must pass
pnpm test         # Must pass (no skips)
pnpm audit        # Should show no new vulnerabilities
```

---

## When to Use the Agent vs. Manual Update

| Scenario | Recommendation |
|----------|----------------|
| Routine update to latest | Use agent: `/lt-dev:backend:update-nest-server` |
| Check what would change | Use agent with `--dry-run` |
| Update to specific version | Use agent with `--target-version X.Y.Z` |
| Complex issues during update | Use this skill's knowledge + manual fixes |
| Understanding breaking changes | Read this skill + migration guides |
