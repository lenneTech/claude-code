---
description: Convert an existing vendor-mode fullstack project (backend + frontend) back to npm mode — restores @lenne.tech/nest-server and @lenne.tech/nuxt-extensions as npm dependencies.
argument-hint: "[--skip-backend] [--skip-frontend] [--api-version vX.Y.Z] [--app-version X.Y.Z]"
allowed-tools: Read, Grep, Glob, Bash(lt:*), Bash(node:*), Bash(pnpm:*), Bash(pnpm run:*), Bash(npm:*), Bash(npm run:*), Bash(yarn:*), Bash(yarn run:*), Bash(git:*), Bash(ls:*), Bash(find:*), Bash(cd:*), Bash(cat:*), Bash(test:*), AskUserQuestion, TodoWrite
disable-model-invocation: true
---

# Convert Fullstack Project: vendor → npm Mode

Coordinated reverse conversion for a fullstack monorepo. Restores both
`@lenne.tech/nest-server` (backend) and `@lenne.tech/nuxt-extensions` (frontend)
as npm dependencies and removes the vendored source trees
(`projects/api/src/core/` and `projects/app/app/core/`).

## When to Use

| Scenario | Command |
|----------|---------|
| Convert both sides back to npm mode | `/lt-dev:fullstack:convert-to-npm` |
| Only revert backend | `/lt-dev:fullstack:convert-to-npm --skip-frontend` |
| Only revert frontend | `/lt-dev:fullstack:convert-to-npm --skip-backend` |
| Pin specific npm versions | `/lt-dev:fullstack:convert-to-npm --api-version v11.22.0 --app-version 1.5.3` |
| Single-side backend revert (non-fullstack) | `/lt-dev:backend:convert-to-npm` |
| Single-side frontend revert (non-fullstack) | `/lt-dev:frontend:convert-to-npm` |
| Convert back to vendor mode | `/lt-dev:fullstack:convert-to-vendor` |

## Related Elements

| Element | Purpose |
|---------|---------|
| **Command**: `/lt-dev:fullstack:convert-to-vendor` | Forward conversion (npm → vendor) |
| **Command**: `/lt-dev:backend:convert-to-npm` | Single-side backend revert |
| **Command**: `/lt-dev:frontend:convert-to-npm` | Single-side frontend revert |
| **Command**: `/lt-dev:backend:contribute-nest-server-core` | Upstream backend patches before reverting |
| **Command**: `/lt-dev:frontend:contribute-nuxt-extensions-core` | Upstream frontend patches before reverting |
| **Skill**: `nest-server-core-vendoring` | Backend vendor pattern knowledge |
| **Skill**: `nuxt-extensions-core-vendoring` | Frontend vendor pattern knowledge |

## Execution

1. **Parse arguments**
   - Detect `--skip-backend`, `--skip-frontend`
   - Extract `--api-version` and `--app-version` if present

2. **Detect project structure**
   - Locate backend path: `projects/api/` or `packages/api/`
   - Locate frontend path: `projects/app/` or `packages/app/`
   - Abort with a clear error message if the expected fullstack monorepo layout cannot be found

3. **Verify current modes**
   - Backend: must have `src/core/VENDOR.md` (unless `--skip-backend`)
   - Frontend: must have `app/core/VENDOR.md` (unless `--skip-frontend`)

4. **Read baseline versions** from each `VENDOR.md`:
   ```bash
   grep -oP 'Baseline-Version:\*{0,2}\s+\K\d+\.\d+\.\d+\S*' projects/api/src/core/VENDOR.md
   grep -oP 'Baseline-Version:\*{0,2}\s+\K\d+\.\d+\.\d+\S*' projects/app/app/core/VENDOR.md
   ```

5. **Ask the user** which npm versions to install (per side that is being reverted):
   - Default: the baseline version from the respective `VENDOR.md`
   - Option: latest available version (check npm registry)
   - Option: custom version
   - Skip the prompt for a side if `--api-version` / `--app-version` was passed explicitly

6. **Warn the user about local patches**
   - Read the "Local changes" table from each `VENDOR.md` being reverted
   - If there are non-pristine entries, warn that these changes will be lost
   - Suggest running the appropriate contribute command first:
     - Backend: `/lt-dev:backend:contribute-nest-server-core`
     - Frontend: `/lt-dev:frontend:contribute-nuxt-extensions-core`
   - Require explicit user confirmation via `AskUserQuestion` before proceeding

7. **Run the CLI conversion**
   - Single fullstack call (preferred when both sides are being reverted):
     ```bash
     lt fullstack convert-mode --to npm --api-version <v> --app-version <v> --noConfirm
     ```
   - With `--skip-backend`:
     ```bash
     lt fullstack convert-mode --to npm --app-version <v> --skip-api --noConfirm
     ```
   - With `--skip-frontend`:
     ```bash
     lt fullstack convert-mode --to npm --api-version <v> --skip-app --noConfirm
     ```

8. **Run post-conversion validation**
   - Backend (unless skipped): `pnpm install && pnpm exec tsc --noEmit && pnpm run lint`
   - Frontend (unless skipped): `pnpm install && pnpm run build && pnpm run lint`

9. **Report results** and suggest next steps (run tests, commit changes).

## Important

- This command requires the `lt` CLI to be installed globally or available in PATH.
- **Local patches in `src/core/` and `app/core/` will be lost!** The vendored source trees are deleted during conversion. Make sure any valuable changes have been committed upstream first.
- After conversion, `@lenne.tech/nest-server` and `@lenne.tech/nuxt-extensions` are restored as npm dependencies.
- Commit before starting so `git reset` remains a safe rollback path.
- Use `/lt-dev:fullstack:convert-to-vendor` to reverse the conversion.
