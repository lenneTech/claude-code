---
description: Convert an existing vendor-mode API project back to npm mode (@lenne.tech/nest-server as dependency)
allowed-tools: Bash(lt:*), Bash(node:*), Bash(pnpm:*), Bash(git:*), Bash(ls:*), Bash(test:*), Bash(cat:*), Read, Grep, Glob, AskUserQuestion
---

# Convert API Project: vendor → npm Mode

Converts the current API project from vendored framework mode (`src/core/`) back
to the classic npm mode (`@lenne.tech/nest-server` as dependency).

## Execution

1. **Verify prerequisites:**
   - Current directory is inside an API project (`package.json` exists)
   - Project is in vendor mode (`src/core/VENDOR.md` exists)

2. **Read the baseline version** from `src/core/VENDOR.md`:
   ```bash
   grep -oP 'Baseline-Version:\*{0,2}\s+\K\d+\.\d+\.\d+\S*' src/core/VENDOR.md
   ```

3. **Ask the user** which `@lenne.tech/nest-server` version to install:
   - Default: the baseline version from `VENDOR.md`
   - Option: latest available version (check npm registry)
   - Option: custom version

4. **Warn the user** about local patches:
   - Read the "Local changes" table from `VENDOR.md`
   - If there are non-pristine entries, warn that these changes will be lost
   - Suggest running `/lt-dev:backend:contribute-nest-server-core` first to upstream them

5. **Run the CLI command:**
   ```bash
   lt server convert-mode --to npm --version <version> --noConfirm
   ```

6. **Run post-conversion validation:**
   ```bash
   pnpm install
   pnpm exec tsc --noEmit
   pnpm run lint
   ```

7. **Report results** and suggest next steps (run tests, commit changes).

## Important

- This command requires the `lt` CLI to be installed globally or available in PATH.
- **Local patches in `src/core/` will be lost!** The vendored source is deleted during conversion. Make sure any valuable changes have been committed upstream first.
- After conversion, `@lenne.tech/nest-server` is restored as an npm dependency.
- Use `/lt-dev:backend:convert-to-vendor` to reverse the conversion.
