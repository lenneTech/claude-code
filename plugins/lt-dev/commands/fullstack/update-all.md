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

Backend must complete before frontend because — when the frontend actually imports the generated api-client — `generate-types` needs the updated API running. Projects using hand-written interfaces skip this step (see Phase 5/7 detection logic).

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

### Phase 0: CLI Self-Heals (unless --dry-run)

Run the lt CLI's deterministic self-heals FIRST — they are NOT covered by any
agent phase below and take ~2 seconds:

```bash
lt fullstack update
```

This idempotently (a) syncs `scripts/check.mjs` to the CLI's canonical version
(idle-watchdog, hoisted install, summed test metrics — skips the sync when the
file has UNCOMMITTED local edits and says so), (b) adds `.lt-dev/` to
`.gitignore` if missing, and (c) refreshes the CLAUDE.md vendor-notice blocks.
It also prints the mode detection, which cross-checks Phase 1. Report anything
it changed (or skipped) in the final report's summary.

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
- Update tsconfig.json, nest-cli.json, .oxlintrc.json (rule config incl. the
  no-underscore-dangle allow-list), .oxlintignore if needed
- Add new scripts from starter package.json AND update existing check/test
  chains (check:raw, check:fix, check:naf, test, test:ci) to the starter
  shape, preserving project-specific steps
- Sync scripts/check.mjs (and the other scripts/ helpers) verbatim from the
  starter — compare against the starter's CURRENT state, not just the tag
  delta, so projects that missed earlier syncs converge too
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

Also sync the starter toolchain alongside the core: compare scripts/check.mjs
(and the other scripts/ helpers) plus the check/test script chains in
package.json against the latest nest-server-starter and adopt upstream changes,
preserving project-specific steps (e.g. check:vendor-freshness, check:swc-tdz).
The check wrapper drifts silently otherwise — an outdated copy loses upstream
fixes like the wedged-test watchdog and multi-vitest test counting.

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
Backend path: <backend-path> (for generate-types, only if api-client is imported)

Execute frontend update:
1. Install @lenne.tech/nuxt-extensions@latest
2. Sync with nuxt-base-starter (config, components, middleware) — including
   the toolchain: scripts/check.mjs verbatim from nuxt-base-template, and the
   check chains (check:raw, check:fix, check:naf) at script-entry level,
   preserving project-specific steps. Compare against the template's CURRENT
   state, not just the tag delta. Convert a direct `check` chain to the
   wrapper + `check:raw` pattern if the project still has the old shape.
3. Detect whether the frontend imports the generated api-client:
     grep -REq "from ['\"](~|\.|app)/api-client" app/
   If matches: run `pnpm run generate-types` (needs backend on port 3000).
   If no match: skip -- the project uses hand-written interfaces
   (`app/interfaces/*.ts`) and the generated output is an unused reference
   artifact. Note the skip in the report.
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

Also sync the template toolchain alongside the core: compare scripts/check.mjs
(and the other scripts/ helpers) plus the check/test script chains in
package.json against the latest nuxt-base-starter (nuxt-base-template/) and
adopt upstream changes, preserving project-specific steps (e.g.
check:vendor-freshness). Older projects may still carry a direct `check` chain
without the scripts/check.mjs wrapper — convert them to the wrapper +
`check:raw` pattern the template ships.

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
- Run security audit and fix vulnerabilities — including TRANSITIVE advisories that
  require a scoped override (audit --fix cannot close these). Apply the Vulnerability
  Resolution Workflow: group by root advisory, target the fixed-in version (target MUST
  be >= the advisory's fixed-in version — an exact-but-too-low target silently leaves it
  open), then re-audit and confirm 0 / expected residual.
- Remove unused packages — including unused direct deps that are the root of an advisory
  chain (removal is a valid security fix and may eliminate overrides).

Audit with the project's OWN package manager (npm vs pnpm resolve transitive trees
differently). Validate after each change. Do not touch framework packages
(@lenne.tech/nest-server, @lenne.tech/nuxt-extensions) as they
were already updated in previous phases.
```

### Phase 6: CLAUDE.md + Workspace Toolchain Sync

Sync CLAUDE.md files from upstream starters:

| Source | Target |
|--------|--------|
| `lenneTech/nest-server` -> `CLAUDE.md` | `<backend-path>/CLAUDE.md` |
| `lenneTech/nuxt-base-starter` -> `nuxt-base-template/CLAUDE.md` | `<frontend-path>/CLAUDE.md` |
| `lenneTech/lt-monorepo` -> `CLAUDE.md` | `./CLAUDE.md` (root) |

Only sync the targets that were actually updated. Use section-level merge
(keep project-specific customizations, add new upstream sections).

Then sync the workspace-ROOT toolchain from `lenneTech/lt-monorepo` — no other
phase covers the root level, and it drifts silently otherwise (a real case:
projects whose root check.mjs predated the wrapper-member fix ran the root
check with the api project silently dropped — "api tests never ran"):

| Source (`lt-monorepo`) | Target (root) |
|------------------------|---------------|
| `scripts/check.mjs` | `scripts/check.mjs` |
| `scripts/check-workspace-consistency.mjs` | `scripts/check-workspace-consistency.mjs` |
| `scripts/check-packagemanager-pin.mjs` | `scripts/check-packagemanager-pin.mjs` |
| `package.json` -> check/check:raw/check:fix/check:naf/check:workspace/check:pin | root `package.json` scripts (merge, keep project-specific entries) |

Copy the scripts/ files verbatim (they are generic and carry no project
customizations). For package.json, merge at the script-entry level. Verify
afterwards that `pnpm run check:workspace` and `pnpm run check:pin` pass —
if check:pin fails on CI files, align them with the corepack-free derive-line
pattern from the current starters.

### Phase 7: Cross-Validation

1. **Run the canonical workspace check** (from the workspace root):
   ```bash
   pnpm run check
   ```
   This supersedes separate per-project build/test runs: the report-driven
   wrapper executes audit + format + lint + unit/API tests + build +
   server-start for BOTH subprojects, with the idle-watchdog guarding the test
   steps and the e2e-run governor queuing against parallel sessions. A run
   printing `[e2e-governor] waiting for a free e2e slot` every 15s is QUEUED
   behind another session's tests, not hung — let it wait. Must exit 0; apply
   the `running-check-script` skill's iterate-until-green loop on failures.

2. **Confirm the security audit** (use the project's own package manager) in each subproject — the residual vulnerability count must match what Phase 5 reported as expected. A package that received an override but still appears means the override target is too low or mis-scoped; do not sign off the update until it is fixed or explicitly accepted with a documented reason.

3. **Verify type generation works — conditional:**
   ```bash
   cd <frontend-path>
   if grep -REq "from ['\"](~|\.|app)/api-client" app/; then
     pnpm run generate-types
   else
     echo "Skipped: api-client not imported (project uses hand-written interfaces)."
   fi
   ```
   Rationale: running `generate-types` on a project that does not import
   the generated api-client is pure noise — the output is an unused
   reference artifact, and the prettier/oxfmt format difference surfaces
   as a false `check` failure the operator has to chase.

4. **Run the environment diagnostics** (from the workspace root):
   ```bash
   lt dev doctor
   ```
   Post-update it verifies exactly what the update was supposed to fix:
   `scripts/check.mjs` matches the canonical CLI version (drift warning),
   the Playwright global-setup allow-list is ticket/shard-safe, and the
   slug/registry/Caddy state is consistent. Treat every WARN as a report
   item — fix what the update caused; pre-existing environment WARNs
   (e.g. Caddy service issues) are reported but do not block sign-off.

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
