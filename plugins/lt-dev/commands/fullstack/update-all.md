---
description: Comprehensive fullstack update -- updates backend and frontend frameworks (mode-aware for npm/vendor), applies migrations, updates all packages, syncs CLAUDE.md, and validates everything
argument-hint: "[--dry-run] [--skip-backend] [--skip-frontend] [--skip-packages]"
allowed-tools: Read, Grep, Glob, Bash(npm run:*), Bash(pnpm run:*), Bash(yarn run:*), Bash(git:*), Bash(gh:*), Bash(ls:*), Bash(find:*), Bash(cd:*), Bash(cat:*), Bash(rm:*), Write, Edit, Agent, AskUserQuestion, WebFetch, TodoWrite
disable-model-invocation: true
---

# Comprehensive Fullstack Update

Mode-aware orchestrator that updates both backend and frontend frameworks,
detects whether each side uses npm or vendor mode, and spawns the correct
agent for each combination.

## When to Use

| Scenario | Command |
|----------|---------|
| Full update (both sides, mode-aware) | `/lt-dev:fullstack:update-all` |
| Simple update (npm-only, no vendor awareness) | `/lt-dev:fullstack:update` |
| Check impact before updating | `/lt-dev:fullstack:update-all --dry-run` |
| Only update frontend | `/lt-dev:fullstack:update-all --skip-backend` |
| Only update backend | `/lt-dev:fullstack:update-all --skip-frontend` |
| Skip package maintenance | `/lt-dev:fullstack:update-all --skip-packages` |

## Related Elements

| Element | Purpose |
|---------|---------|
| **Skill**: `nest-server-updating` | Backend update knowledge base |
| **Skill**: `nest-server-core-vendoring` | Backend vendor pattern knowledge |
| **Skill**: `nuxt-extensions-core-vendoring` | Frontend vendor pattern knowledge |
| **Skill**: `developing-lt-frontend` | Frontend patterns and expertise |
| **Skill**: `maintaining-npm-packages` | Package optimization guidance |
| **Agent**: `lt-dev:nest-server-updater` | Backend npm-mode update |
| **Agent**: `lt-dev:nest-server-core-updater` | Backend vendor-mode update |
| **Agent**: `lt-dev:fullstack-updater` | Frontend npm-mode update (with --skip-backend) |
| **Agent**: `lt-dev:nuxt-extensions-core-updater` | Frontend vendor-mode update |
| **Agent**: `lt-dev:npm-package-maintainer` | Package optimization |
| **Command**: `/lt-dev:fullstack:update` | Simpler fullstack update (npm-only) |
| **Command**: `/lt-dev:backend:update-nest-server` | Standalone backend npm update |
| **Command**: `/lt-dev:backend:update-nest-server-core` | Standalone backend vendor update |
| **Command**: `/lt-dev:frontend:update-nuxt-extensions-core` | Standalone frontend vendor update |

## Architecture

This command is the **direct orchestrator**. Sub-agents cannot spawn sub-sub-agents,
so the command coordinates the agents directly.

```
/lt-dev:fullstack:update-all (this command = orchestrator)
|
|  Phase 1: Detect modes (npm vs vendor for each side)
|  Phase 2: Plan + user approval
|
|  Phase 3: Backend update via appropriate agent
|           (must complete before frontend -- types dependency)
|
|  Phase 4: Frontend update via appropriate agent
|
|  Phase 5: Package maintenance (optional)
|
|  Phase 6: CLAUDE.md sync
|
|  Phase 7: Cross-validation
|
|  Phase 8: Report
```

Backend must complete before frontend because `generate-types` needs the updated API.

## Mode Detection Matrix

| Backend | Frontend | Backend Agent | Frontend Agent |
|---------|----------|---------------|----------------|
| npm | npm | `nest-server-updater` | `fullstack-updater --skip-backend` |
| npm | vendor | `nest-server-updater` | `nuxt-extensions-core-updater` |
| vendor | npm | `nest-server-core-updater` | `fullstack-updater --skip-backend` |
| vendor | vendor | `nest-server-core-updater` | `nuxt-extensions-core-updater` |

---

## Execution

Parse `$ARGUMENTS` for flags:
- `--dry-run`: Analysis only, no modifications
- `--skip-backend`: Skip backend (API) update
- `--skip-frontend`: Skip frontend (App) update
- `--skip-packages`: Skip package maintenance phase

### Phase 1: Detect Modes

1. **Detect project structure:**
   ```bash
   ls -d projects/api projects/app packages/api packages/app 2>/dev/null
   ```

2. **Detect package manager:**
   ```bash
   ls pnpm-lock.yaml yarn.lock package-lock.json 2>/dev/null
   ```

3. **Detect backend mode:**
   ```bash
   # Check for vendor mode
   BACKEND_PATH=$(find . -name "VENDOR.md" -path "*/api/src/core/*" -not -path "*/node_modules/*" 2>/dev/null | head -1 | sed 's|/src/core/VENDOR.md||')
   if [ -n "$BACKEND_PATH" ]; then
     echo "BACKEND_MODE=vendor"
   else
     BACKEND_PATH=$(find . -name "package.json" -not -path "*/node_modules/*" -exec grep -l "@lenne.tech/nest-server" {} \; | head -1 | xargs dirname 2>/dev/null)
     if [ -n "$BACKEND_PATH" ]; then
       echo "BACKEND_MODE=npm"
     else
       echo "BACKEND_MODE=none"
     fi
   fi
   ```

4. **Detect frontend mode:**
   ```bash
   # Check for vendor mode
   FRONTEND_PATH=$(find . -name "VENDOR.md" -path "*/app/core/*" -not -path "*/node_modules/*" 2>/dev/null | head -1 | sed 's|/app/core/VENDOR.md||')
   if [ -n "$FRONTEND_PATH" ]; then
     echo "FRONTEND_MODE=vendor"
   else
     FRONTEND_PATH=$(find . -name "package.json" -not -path "*/node_modules/*" -exec grep -l "@lenne.tech/nuxt-extensions" {} \; | head -1 | xargs dirname 2>/dev/null)
     if [ -n "$FRONTEND_PATH" ]; then
       echo "FRONTEND_MODE=npm"
     else
       echo "FRONTEND_MODE=none"
     fi
   fi
   ```

5. **Get current and target versions for each detected side.**

6. **Early exit conditions:**
   - No backend AND no frontend found -> Exit: "Not a lenne.tech fullstack project"
   - Both already on latest -> Exit: "Already up to date"

### Phase 2: Plan + User Approval

1. **Create UPDATE_PLAN.md** summarizing:
   - Detected modes (npm/vendor for each side)
   - Current and target versions
   - Which agents will be spawned
   - Expected breaking changes (from migration guides / changelogs)

2. **Present plan and ask for confirmation:**
   > The update plan has been generated. Detected modes:
   > - Backend: [npm/vendor] at path [path]
   > - Frontend: [npm/vendor] at path [path]
   >
   > Reply "yes" to proceed, "skip backend"/"skip frontend" for partial update, or "no" to abort.

3. **Wait for user confirmation** before proceeding.

**DRY-RUN MODE:** Stop here after generating UPDATE_PLAN.md.

### Phase 3: Backend Update (unless --skip-backend)

Based on detected backend mode, spawn the appropriate agent:

**If backend = npm:**

Spawn `lt-dev:nest-server-updater`:
```
Update @lenne.tech/nest-server in this project.

Backend path: <backend-path>
Current version: <current-version>
Target version: <target-version>

Apply migration guides, update dependencies, fix breaking changes.
Work fully autonomously without asking questions.
After the version update, also sync with nest-server-starter:
- Compare project config files against latest starter
- Update tsconfig.json, nest-cli.json, .eslintrc if needed
- Add new scripts from starter package.json
- Sync .env.example
Validate: build, lint, test -- fix issues until all pass.
```

**If backend = vendor:**

Spawn `lt-dev:nest-server-core-updater`:
```
Sync the vendored @lenne.tech/nest-server core in this project from upstream.

Backend path: <backend-path>

Sync to the latest upstream tag.
Execute the sync workflow: fetch upstream, generate diffs, categorize hunks,
apply approved changes, reapply flatten-fix, validate with tsc/lint/tests.

Remember the flatten-fix edge cases: index.ts, core.module.ts, test/test.helper.ts,
common/interfaces/core-persistence-model.interface.ts.

Work fully autonomously.
```

**Wait for backend to complete** before proceeding to frontend.

### Phase 4: Frontend Update (unless --skip-frontend)

Based on detected frontend mode, spawn the appropriate agent:

**If frontend = npm:**

Spawn `lt-dev:fullstack-updater` with --skip-backend:
```
Update the frontend of this lenne.tech fullstack project.

Arguments: --skip-backend
Frontend path: <frontend-path>
Current nuxt-extensions version: <current-version>
Target nuxt-extensions version: <target-version>
Backend path: <backend-path> (for generate-types)

Execute frontend update:
1. Install @lenne.tech/nuxt-extensions@latest
2. Sync with nuxt-base-starter (config, components, middleware)
3. Run generate-types from updated backend API
4. Validate: build, lint -- fix issues until all pass
```

**If frontend = vendor:**

Spawn `lt-dev:nuxt-extensions-core-updater`:
```
Sync the vendored @lenne.tech/nuxt-extensions core in this project from upstream.

Frontend path: <frontend-path>

Sync to the latest upstream tag.
nuxt-extensions tags have NO v-prefix (e.g., 1.5.3 not v1.5.3).
No flatten-fix needed -- direct 1:1 file mapping.

Execute the sync workflow: fetch upstream, generate diffs, categorize hunks,
apply approved changes, validate with nuxt build + lint.

Work fully autonomously.
```

### Phase 5: Package Maintenance (unless --skip-packages)

Spawn `lt-dev:npm-package-maintainer`:
```
Perform package maintenance on both subprojects:

Backend path: <backend-path>
Frontend path: <frontend-path>

Mode: FULL
- Update all non-framework dependencies to latest compatible versions
- Run security audit and fix vulnerabilities
- Remove unused packages

Validate after each change. Do not touch framework packages
(@lenne.tech/nest-server, @lenne.tech/nuxt-extensions) as they
were already updated in previous phases.
```

### Phase 6: CLAUDE.md Sync

Sync CLAUDE.md files from upstream starters:

| Source | Target |
|--------|--------|
| `lenneTech/nest-server` -> `CLAUDE.md` | `<backend-path>/CLAUDE.md` |
| `lenneTech/nuxt-base-starter` -> `nuxt-base-template/CLAUDE.md` | `<frontend-path>/CLAUDE.md` |
| `lenneTech/lt-monorepo` -> `CLAUDE.md` | `./CLAUDE.md` (root) |

Only sync the targets that were actually updated. Use section-level merge
(keep project-specific customizations, add new upstream sections).

### Phase 7: Cross-Validation

1. **Build both projects:**
   ```bash
   cd <backend-path> && pnpm run build
   cd <frontend-path> && pnpm run build
   ```

2. **Run tests:**
   ```bash
   cd <backend-path> && pnpm test
   ```

3. **Verify type generation works:**
   ```bash
   cd <frontend-path> && pnpm run generate-types
   ```

### Phase 8: Report

Generate a comprehensive report:

```markdown
## Fullstack Update Report (Mode-Aware)

### Detected Modes
| Side | Mode | Path |
|------|------|------|
| Backend | npm/vendor | <path> |
| Frontend | npm/vendor | <path> |

### Version Changes
| Component | Current | Target | Status |
|-----------|---------|--------|--------|
| nest-server | X.Y.Z | A.B.C | Updated |
| nuxt-extensions | X.Y.Z | A.B.C | Updated |

### Agents Spawned
| Phase | Agent | Result |
|-------|-------|--------|
| Backend | nest-server-updater / nest-server-core-updater | Success/Failed |
| Frontend | fullstack-updater / nuxt-extensions-core-updater | Success/Failed |
| Packages | npm-package-maintainer | Success/Skipped |

### Validation Results
| Check | Backend | Frontend |
|-------|---------|----------|
| Build | Pass/Fail | Pass/Fail |
| Lint | Pass/Fail | Pass/Fail |
| Tests | Pass/Fail | N/A |
| Types | N/A | Pass/Fail |

### Next Steps
- Review and commit changes
- Run full E2E test suite manually
- Verify in browser
```

**Cleanup:**
```bash
rm -rf /tmp/nest-server-starter-ref /tmp/nuxt-base-starter-ref
rm -rf /tmp/nest-server-baseline /tmp/nest-server-target
rm -rf /tmp/nuxt-extensions-baseline /tmp/nuxt-extensions-target
```
