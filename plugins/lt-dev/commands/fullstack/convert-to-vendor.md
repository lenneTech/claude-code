---
description: Convert an existing npm-mode fullstack project (backend + frontend) to vendor mode with automatic migration guide and changelog application. Detects version gaps and applies all breaking-change migrations for both sides.
argument-hint: "[--dry-run] [--skip-backend] [--skip-frontend] [--api-target-version vX.Y.Z] [--app-target-version X.Y.Z]"
allowed-tools: Read, Grep, Glob, Bash(lt:*), Bash(node:*), Bash(pnpm:*), Bash(pnpm run:*), Bash(npm:*), Bash(npm run:*), Bash(yarn:*), Bash(yarn run:*), Bash(git:*), Bash(gh:*), Bash(ls:*), Bash(find:*), Bash(cd:*), Bash(cat:*), Bash(test:*), Agent, AskUserQuestion, TodoWrite
disable-model-invocation: true
---

# Convert Fullstack Project: npm to Vendor Mode

Mode-aware orchestrator that converts both backend (`@lenne.tech/nest-server`) and
frontend (`@lenne.tech/nuxt-extensions`) from npm mode to vendor mode in one coordinated
run — including automatic application of all migration guides / changelogs for the
version gaps on both sides.

**Key feature:** Structural conversion is done in a single `lt fullstack convert-mode`
invocation. Migration guides (backend) and changelog entries (frontend) are then
applied by the respective dedicated agents on top of the already-vendored tree.

## Before You Convert — Vendor Modification Policy

Vendoring copies framework code into the project (`projects/api/src/core/` for backend,
`projects/app/app/core/` for frontend) as first-class project code. This is a
**comprehension aid**, not a fork. After the conversion, edit vendored code **only**
when the change is generally useful to every @lenne.tech consumer (bugfixes, broad
enhancements, security fixes, build/TS-compat). All project-specific behavior stays
outside the vendored cores. Generally useful changes MUST flow back upstream via the
dedicated contribute commands — otherwise they rot in one project's vendor tree and
re-conflict on every sync.

The generated `VENDOR.md` files contain the full policy text for each side; read them
once right after the conversion.

## Usage

```
/lt-dev:fullstack:convert-to-vendor [options]
```

## Options

| Option | Description |
|--------|-------------|
| `--dry-run` | Analysis only — show version gaps and planned `lt` invocation without modifications |
| `--skip-backend` | Convert only the frontend side |
| `--skip-frontend` | Convert only the backend side |
| `--api-target-version vX.Y.Z` | Vendor the backend at a specific upstream version instead of latest |
| `--app-target-version X.Y.Z` | Vendor the frontend at a specific upstream version instead of latest |

## Examples

```bash
# Full fullstack conversion to latest versions with migrations + changelogs
/lt-dev:fullstack:convert-to-vendor

# Check impact on both sides before converting
/lt-dev:fullstack:convert-to-vendor --dry-run

# Convert only the backend (frontend stays on npm)
/lt-dev:fullstack:convert-to-vendor --skip-frontend

# Pin specific upstream versions on both sides
/lt-dev:fullstack:convert-to-vendor --api-target-version v11.22.0 --app-target-version 1.5.3
```

## Related Elements

| Element | Purpose |
|---------|---------|
| **Agent**: `lt-dev:vendor-mode-converter` | Backend migration-guide application (spawned by this command) |
| **Agent**: `lt-dev:vendor-mode-converter-frontend` | Frontend changelog application (spawned by this command) |
| **Skill**: `nest-server-core-vendoring` | Backend vendor pattern knowledge |
| **Skill**: `nuxt-extensions-core-vendoring` | Frontend vendor pattern knowledge |
| **Skill**: `nest-server-updating` | Backend migration guide resources |
| **Skill**: `using-lt-cli` | lt CLI reference (convert-mode semantics) |
| **Skill**: `developing-lt-frontend` | Frontend patterns and expertise |
| **Command**: `/lt-dev:fullstack:convert-to-npm` | Reverse conversion (vendor back to npm) |
| **Command**: `/lt-dev:backend:convert-to-vendor` | Single-side backend conversion |
| **Command**: `/lt-dev:frontend:convert-to-vendor` | Single-side frontend conversion |
| **Command**: `/lt-dev:fullstack:update-all` | Update already-vendored fullstack project |

## When to Use

| Scenario | Command |
|----------|---------|
| Convert both sides to vendor mode | `/lt-dev:fullstack:convert-to-vendor` |
| Check impact before converting | `/lt-dev:fullstack:convert-to-vendor --dry-run` |
| Convert only backend | `/lt-dev:fullstack:convert-to-vendor --skip-frontend` |
| Convert only frontend | `/lt-dev:fullstack:convert-to-vendor --skip-backend` |
| Single-side backend conversion (non-fullstack) | `/lt-dev:backend:convert-to-vendor` |
| Single-side frontend conversion (non-fullstack) | `/lt-dev:frontend:convert-to-vendor` |
| Convert back to npm mode | `/lt-dev:fullstack:convert-to-npm` |

## Prerequisites

- `lt` CLI must be installed (`npm i -g @lenne.tech/cli`)
- Fullstack monorepo layout with both `projects/api/` (or `packages/api/`) and `projects/app/` (or `packages/app/`)
- Backend must be in npm mode (`@lenne.tech/nest-server` in `package.json`, no `src/core/VENDOR.md`) — unless `--skip-backend` is set
- Frontend must be in npm mode (`@lenne.tech/nuxt-extensions` in `package.json`, no `app/core/VENDOR.md`) — unless `--skip-frontend` is set
- `gh` CLI for fetching migration guides, changelogs, and latest release tags from GitHub
- Working tree should be clean — the conversion rewrites significant parts of the source tree

## Architecture

This command is the **direct orchestrator**. Sub-agents cannot spawn sub-sub-agents,
so the command coordinates both the `lt` CLI and the follow-up agents directly.
Structural conversion is handled by the `lt` CLI; migration-guide / changelog
application is handled by the respective agents on top of the already-vendored tree.

### lt CLI usage

| Scope | CLI Invocation |
|-------|----------------|
| Full fullstack conversion (both sides) | `lt fullstack convert-mode --to vendor --api-ref <v> --app-ref <v> --noConfirm` |
| Fullstack conversion, frontend only | `lt fullstack convert-mode --to vendor --skip-api --app-ref <v> --noConfirm` |
| Fullstack conversion, backend only | `lt fullstack convert-mode --to vendor --skip-app --api-ref <v> --noConfirm` |
| Dry-run (any scope) | add `--dry-run` |

The `lt fullstack convert-mode` CLI is preferred over two separate `lt server` /
`lt frontend` calls because it shares version resolution, confirms a single plan,
and keeps the vendor baseline detection consistent across both sides.

### Orchestration flow

```
/lt-dev:fullstack:convert-to-vendor (this command = orchestrator)
│
│  Phase 1: Prerequisite detection (monorepo layout, current modes, versions)
│  Phase 2: Plan + user approval (unless --dry-run)
│
│  Phase 3: Structural conversion — single `lt fullstack convert-mode --to vendor ...` call
│           (respects --skip-backend / --skip-frontend via --skip-api / --skip-app)
│
│  Phase 4: Backend migration-guide application via vendor-mode-converter agent
│           (skipped if --skip-backend; must complete before Phase 5 — generated
│            types for the frontend depend on the migrated API)
│
│  Phase 5: Frontend changelog application via vendor-mode-converter-frontend agent
│           (skipped if --skip-frontend)
│
│  Phase 6: Cross-validation (both sides build/lint)
│  Phase 7: Report
```

## Execution

1. **Parse arguments**
   - Detect `--dry-run`, `--skip-backend`, `--skip-frontend`
   - Extract `--api-target-version` and `--app-target-version` if present

2. **Detect project structure**
   - Locate backend path: `projects/api/` or `packages/api/`
   - Locate frontend path: `projects/app/` or `packages/app/`
   - Abort with a clear error message if the expected fullstack monorepo layout cannot be found

3. **Verify current modes**
   - Backend: `@lenne.tech/nest-server` in `dependencies` AND absence of `src/core/VENDOR.md`
   - Frontend: `@lenne.tech/nuxt-extensions` in `dependencies` AND absence of `app/core/VENDOR.md`
   - If either side is already in vendor mode, suggest using `/lt-dev:fullstack:update-all` or the respective single-side command instead

4. **Resolve target versions**
   - Backend: use `--api-target-version` if provided, else fetch latest tag via `gh release list --repo lenneTech/nest-server --limit 1`
   - Frontend: use `--app-target-version` if provided, else fetch latest tag via `gh release list --repo lenneTech/nuxt-extensions --limit 1`

5. **Show execution plan** (both dry-run and real run)
   - Which side will be converted (respecting `--skip-*` flags)
   - Current npm versions, resolved target versions, resulting version gaps
   - The concrete `lt fullstack convert-mode` invocation that will be executed
   - For `--dry-run`: stop here and report only (no CLI call, no agents)

6. **Confirm with the user** (skipped for `--dry-run`)
   - Use `AskUserQuestion` to confirm before touching the source tree
   - Warn that uncommitted changes will become part of the conversion commit

7. **Phase 3 — Structural conversion via `lt` CLI** (real run only)
   - Run exactly one `lt fullstack convert-mode --to vendor` invocation, built from the resolved state:
     - Both sides: `lt fullstack convert-mode --to vendor --api-ref <api-target> --app-ref <app-target> --noConfirm`
     - `--skip-backend`: `lt fullstack convert-mode --to vendor --skip-api --app-ref <app-target> --noConfirm`
     - `--skip-frontend`: `lt fullstack convert-mode --to vendor --skip-app --api-ref <api-target> --noConfirm`
   - Abort on non-zero exit; suggest `git reset --hard` to roll back

8. **Phase 4 — Backend migration-guide application** (skipped if `--skip-backend`)
   - Spawn `lt-dev:vendor-mode-converter` agent with the following prompt:
     ```
     The structural vendor conversion for this API project has ALREADY been
     performed via `lt fullstack convert-mode --to vendor`. Do NOT re-run the
     CLI conversion. Verify the conversion succeeded (src/core/VENDOR.md exists)
     and then apply all migration guides for the version gap.

     Project path: <backend path>
     Baseline version (now vendored): <api-target>
     Previous npm version: <previous backend npm version>
     Arguments: <forwarded args>

     Execute the migration-guide application workflow fully autonomously
     without asking questions.
     ```
   - Wait for agent completion; abort the fullstack run on failure

9. **Phase 5 — Frontend changelog application** (skipped if `--skip-frontend`)
   - Spawn `lt-dev:vendor-mode-converter-frontend` agent with the following prompt:
     ```
     The structural vendor conversion for this frontend project has ALREADY been
     performed via `lt fullstack convert-mode --to vendor`. Do NOT re-run the
     CLI conversion. Verify the conversion succeeded (app/core/VENDOR.md exists)
     and then apply all changelog entries for the version gap.

     Project path: <frontend path>
     Baseline version (now vendored): <app-target>
     Previous npm version: <previous frontend npm version>
     Arguments: <forwarded args>

     Execute the changelog application workflow fully autonomously
     without asking questions.
     ```
   - Wait for agent completion

10. **Cross-validation**
    - Backend: `pnpm install && pnpm exec tsc --noEmit && pnpm run lint`
    - Frontend: `pnpm install && pnpm run build && pnpm run lint`
    - Report any remaining errors that need manual attention

11. **Report results**
    - The exact `lt fullstack convert-mode` invocation that was executed
    - Summary of both agent runs (applied migrations, applied changelog entries)
    - List of `VENDOR.md` files and "Local changes" tables to review
    - Suggested next steps: inspect diff, run tests, commit changes

## Important

- **The `lt` CLI is called exactly once** for the structural conversion (Phase 3) via
  `lt fullstack convert-mode`. The agents in Phase 4/5 must NOT re-run the CLI — their
  job is strictly migration-guide / changelog application on the already-vendored tree.
- **Backend must complete before frontend.** The frontend's generated API client types
  depend on the API's current shape; running them in parallel risks type drift mid-conversion.
- **Local changes under `src/core/` and `app/core/` will be created from scratch** — there
  is no pre-existing vendored code in npm mode, so no patches can be lost.
- The conversion touches many files in one go. Commit before starting so `git reset`
  remains a safe rollback path.
- Use `/lt-dev:fullstack:convert-to-npm` to reverse the conversion.
