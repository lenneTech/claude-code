---
name: modernizing-toolchain
description: 'Migrates lenne.tech projects from the legacy jest+eslint+prettier toolchain to the current vitest+oxlint+oxfmt baseline used by nest-server-starter and nuxt-base-starter. Covers swc decoratorMetadata config, the @Prop union-type fix, supertest default-import correction, the Nitro PORT-vs-NITRO_PORT bug, and the config.env.ts + check-envs.sh patterns. Activates when migrating a project to the current toolchain, debugging Mongoose union-type errors or ERR_SOCKET_BAD_PORT crashes, or aligning a project with current starter conventions. NOT for dependency version bumps (use maintaining-npm-packages). NOT for nest-server major upgrades (use nest-server-updating).'
---

# Modernizing the lenne.tech Toolchain

## When This Skill Activates

- Migrating an existing API/App from jest → vitest, eslint → oxlint, prettier → oxfmt
- Adopting the `check` / `check:fix` / `check:envs` pipeline used by the starters
- Debugging Mongoose `"Cannot determine a type for the X field (union/intersection/ambiguous type was used)"` after switching to vitest+SWC
- Debugging `ERR_SOCKET_BAD_PORT` from `node .output/server/index.mjs` in any check pipeline
- Debugging missing or stale `types.gen.ts` after a Nuxt update
- Aligning a project with the current `config.env.ts` shape (NSC__-only + fail-fast + helper functions)
- Cleaning up phantom Unix-domain-sockets named `[33m12345[39m` in the project root

## Reference Repositories (public)

All references in this skill are to the public lenne.tech repos. **Never reference local clone paths in skill output**:

- API starter: <https://github.com/lenneTech/nest-server-starter>
- API framework: <https://github.com/lenneTech/nest-server>
- App starter: <https://github.com/lenneTech/nuxt-base-starter>
- App framework: <https://github.com/lenneTech/nuxt-extensions>
- Monorepo template: <https://github.com/lenneTech/lt-monorepo>
- CLI: <https://github.com/lenneTech/cli>

## The Migration Checklist (full pipeline)

Eleven phases in fixed order, each assuming the previous one landed. Every phase has a clear "done" signal — proceed only when it is met.

| Phase | Subject |
|---|---|
| 1 | Inventory |
| 2 | API: jest to vitest |
| 3 | API: eslint to oxlint, prettier to oxfmt |
| 4 | App: jest/eslint/prettier to vitest/oxlint/oxfmt |
| 5 | `check` pipeline |
| 6 | `scripts/check-server-start.sh` (port-robust, ANSI-safe) |
| 7 | `config.env.ts` |
| 8 | `scripts/check-envs.sh` + `tests/fixtures/.env.deployed-test` |
| 9 | `main.ts` |
| 10 | GitLab CI |
| 11 | `docker-compose.yml` |

Full commands, file contents and per-phase traps: [`reference/migration-checklist.md`](reference/migration-checklist.md).

## Done Signals

After all phases, both must be true:

1. `<pm> run check` from the monorepo root prints
   ```
   Lerna (powered by Nx)   Successfully ran target check for 2 projects
   ```
   with both api and app green (audit + format:check + lint + test + build + check-server-start).

2. `<pm> run check:envs` (api) prints `All env configurations OK.` (six envs across two phases).

3. **No tests skipped, no warnings tolerated**: pre-existing failures in either subproject must be
   fixed as part of the migration, not silenced. The `check` pipeline is intentionally strict —
   silencing it here defeats the purpose of bringing the project to the current baseline.

## Skill Boundaries

| User Intent | Correct Skill |
|------------|---------------|
| "Migrate to vitest" / "switch to oxlint" / "modernize the toolchain" | **THIS SKILL** |
| "Bump nest-server to a newer minor" | `nest-server-updating` |
| "Update all packages" / "audit + fix" | `maintaining-npm-packages` |
| "Run my check pipeline" / "check failed" | `running-check-script` (this skill cross-references it) |
| "Build a new feature" / "add a service" | `generating-nest-servers` or `developing-lt-frontend` |

## Related Skills & Commands

| Element | Relationship |
|---------|--------------|
| `running-check-script` skill | Defers the `ERR_SOCKET_BAD_PORT` / ANSI-strip hazards to this skill's Phase 6 |
| `maintaining-npm-packages` skill | Handles version bumps; this skill handles the toolchain switch itself |
| `nest-server-updating` skill | nest-server major upgrades, which often surface the same swc/decorator issues |
| `/lt-dev:fullstack:update-all` | Syncs the workspace-root toolchain from `lt-monorepo` |
| `/lt-dev:check` | Verifies the migrated toolchain actually runs green |
