---
description: Sync fullstack project with latest nest-server-starter and nuxt-base-starter
argument-hint: "[--dry-run] [--skip-backend] [--skip-frontend]"
allowed-tools: Read, Grep, Glob, Bash(npm run:*), Bash(pnpm run:*), Bash(yarn run:*), Bash(npx ncu:*), Bash(git:*), Bash(gh:*), Bash(ls:*), Bash(find:*), Bash(cd:*), Bash(cat:*), Bash(rm:*), Write, Edit, Agent, AskUserQuestion, WebFetch, TodoWrite
disable-model-invocation: true
---

# Update Fullstack Project

Coordinated update of backend (nest-server) and frontend (nuxt-extensions) with starter repository synchronization.

## When to Use

| Scenario | Command |
|----------|---------|
| Routine fullstack update | `/lt-dev:fullstack:update` |
| Mode-aware update (npm/vendor detection) | `/lt-dev:fullstack:update-all` |
| Check impact before updating | `/lt-dev:fullstack:update --dry-run` |
| Only update frontend | `/lt-dev:fullstack:update --skip-backend` |
| Only update backend | `/lt-dev:fullstack:update --skip-frontend` |
| Backend-only project | `/lt-dev:backend:update-nest-server` |
| Vendored frontend core sync | `/lt-dev:frontend:update-nuxt-extensions-core` |
| Vendored backend core sync | `/lt-dev:backend:update-nest-server-core` |

## Related Elements

| Element | Purpose |
|---------|---------|
| **Skill**: `nest-server-updating` | Backend update knowledge base |
| **Skill**: `nest-server-core-vendoring` | Backend vendor pattern knowledge |
| **Skill**: `nuxt-extensions-core-vendoring` | Frontend vendor pattern knowledge |
| **Skill**: `developing-lt-frontend` | Frontend patterns and expertise |
| **Skill**: `maintaining-npm-packages` | Package optimization guidance |
| **Agent**: `lt-dev:nest-server-updater` | Backend nest-server version update (npm mode) |
| **Agent**: `lt-dev:nest-server-core-updater` | Backend vendor-mode update |
| **Agent**: `lt-dev:fullstack-updater` | Frontend update + starter synchronization |
| **Agent**: `lt-dev:nuxt-extensions-core-updater` | Frontend vendor-mode update |
| **Command**: `/lt-dev:backend:update-nest-server` | Standalone backend update |
| **Command**: `/lt-dev:backend:update-nest-server-core` | Standalone backend vendor update |
| **Command**: `/lt-dev:frontend:update-nuxt-extensions-core` | Standalone frontend vendor update |
| **Command**: `/lt-dev:fullstack:update-all` | Comprehensive mode-aware fullstack update |

## Architecture

This command is the **direct orchestrator**. Sub-agents cannot spawn sub-sub-agents, so the command coordinates the agents directly.

```
/lt-dev:fullstack:update (this command = orchestrator)
│
│  Phase 1: Project analysis (detect structure, versions)
│  Phase 2: Starter repo analysis (clone, compare)
│  Phase 3: Update plan + user approval
│
│  Phase 4: Backend update via nest-server-updater agent
│           (must complete before frontend — types dependency)
│
│  Phase 5: Frontend update via fullstack-updater --skip-backend agent
│
└── Phase 6: Cross-validation + report
```

Backend must complete before frontend because `generate-types` needs the updated API.

---

## Execution

Parse `$ARGUMENTS` for flags:
- `--dry-run`: Analysis only, no modifications
- `--skip-backend`: Skip backend (API) update
- `--skip-frontend`: Skip frontend (App) update

### Phase 1: Project Analysis

1. **Detect project structure:**
   ```bash
   ls -d projects/api projects/app packages/api packages/app 2>/dev/null
   ```

2. **Detect package manager:**
   ```bash
   ls pnpm-lock.yaml yarn.lock package-lock.json 2>/dev/null
   ```

3. **Identify backend and frontend:**
   ```bash
   find . -name "package.json" -not -path "*/node_modules/*" -exec grep -l "@lenne.tech/nest-server" {} \;
   find . -name "package.json" -not -path "*/node_modules/*" -exec grep -l "@lenne.tech/nuxt-extensions" {} \;
   ```

4. **Detect vendor modes:**
   ```bash
   # Backend vendor mode
   find . -name "VENDOR.md" -path "*/api/src/core/*" -not -path "*/node_modules/*" 2>/dev/null
   # Frontend vendor mode
   find . -name "VENDOR.md" -path "*/app/core/*" -not -path "*/node_modules/*" 2>/dev/null
   ```
   If a `VENDOR.md` is found, that side is in vendor mode. The corresponding
   npm package will NOT be in `package.json`. Note this for Phase 4/5 agent selection.

5. **Get current and target versions:**
   ```bash
   cd <backend-path> && pnpm list @lenne.tech/nest-server --depth=0
   cd <frontend-path> && pnpm list @lenne.tech/nuxt-extensions --depth=0
   pnpm view @lenne.tech/nest-server version
   pnpm view @lenne.tech/nuxt-extensions version
   ```
   For vendored sides, read the baseline version from `VENDOR.md` instead of npm list.

6. **Early exit:** If both already on latest -> "Already up to date"

### Phase 2: Starter Repository Analysis

1. **Clone starters to /tmp:**
   ```bash
   git clone --depth=50 https://github.com/lenneTech/nest-server-starter.git /tmp/nest-server-starter-ref 2>/dev/null
   git clone --depth=50 https://github.com/lenneTech/nuxt-base-starter.git /tmp/nuxt-base-starter-ref 2>/dev/null
   ```

2. **Analyze changes between version tags** for both starters.

3. **Fetch migration guides** for backend:
   ```bash
   gh api repos/lenneTech/nest-server/contents/migration-guides --jq '.[].name'
   ```

### Phase 3: Update Plan + User Approval

1. **Create UPDATE_PLAN.md** with version changes, breaking changes, starter drift, config changes.

2. **Present plan and ask for confirmation:**
   > The update plan has been generated. Please review UPDATE_PLAN.md.
   > Reply "yes" to proceed, "skip backend"/"skip frontend" for partial update, or "no" to abort.

3. **Wait for user confirmation** before proceeding.

**DRY-RUN MODE:** Stop here after generating UPDATE_PLAN.md.

### Phase 4: Backend Update (unless --skip-backend)

**If backend is in vendor mode** (detected in Phase 1), spawn `lt-dev:nest-server-core-updater` instead:

```
Use Agent tool with subagent_type "lt-dev:nest-server-core-updater":

Sync the vendored @lenne.tech/nest-server core in this project from upstream.
Backend path: <backend-path>
Sync to the latest upstream tag.
Work fully autonomously.
```

**If backend is in npm mode** (default), spawn the `nest-server-updater` agent:

```
Use Agent tool with subagent_type "lt-dev:nest-server-updater":

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
Validate: build, lint, test — fix issues until all pass.
```

**Wait for backend to complete** before proceeding to frontend.

### Phase 5: Frontend Update (unless --skip-frontend)

**If frontend is in vendor mode** (detected in Phase 1), spawn `lt-dev:nuxt-extensions-core-updater` instead:

```
Use Agent tool with subagent_type "lt-dev:nuxt-extensions-core-updater":

Sync the vendored @lenne.tech/nuxt-extensions core in this project from upstream.
Frontend path: <frontend-path>
Sync to the latest upstream tag.
nuxt-extensions tags have NO v-prefix (e.g., 1.5.3 not v1.5.3).
No flatten-fix needed -- direct 1:1 file mapping.
Work fully autonomously.
```

**If frontend is in npm mode** (default), spawn the `fullstack-updater` agent with --skip-backend:

```
Use Agent tool with subagent_type "lt-dev:fullstack-updater":

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
4. Validate: build, lint — fix issues until all pass
```

### Phase 6: Cross-Validation & Report

1. **Build both projects:**
   ```bash
   cd <backend-path> && pnpm run build
   cd <frontend-path> && pnpm run build
   ```

2. **Run tests:**
   ```bash
   cd <backend-path> && pnpm test
   ```

3. **Generate unified report** — see "Report Format" section below. Capture each spawned updater agent's complete output into named buffers (`backend_core_report`, `backend_npm_report`, `frontend_core_report`, `frontend_npm_report`) and embed them verbatim in the report.

4. **Cleanup:**
   ```bash
   rm -rf /tmp/nest-server-starter-ref /tmp/nuxt-base-starter-ref
   ```

## Report Format

**OUTPUT REQUIREMENTS:**

1. All sections below are MANDATORY.
2. Section "Detailed Updater Reports" MUST contain the verbatim full output of every spawned updater agent. Do NOT summarize. Wrap each in a details block.
3. Action Roadmap — derive from updater warnings, build errors, test failures, and migration steps still required.
4. No-Loss Guarantee — every manual step / warning / error in any verbatim updater report MUST appear in the Action Roadmap below.
5. No Placeholders — replace every N, X.Y.Z, X min with concrete values.

```markdown
## Fullstack Update Report

### Executive Summary
- **Status:** ✅ Erfolgreich / ⚠️ Mit manuellen Schritten / ❌ Blockiert
- **Backend:** vX.Y.Z → vA.B.C (Mode: npm/vendor)
- **Frontend:** vX.Y.Z → vA.B.C (Mode: npm/vendor)
- **Build:** Backend ✅ | Frontend ✅ | Tests ✅
- **Top 3 nächste Schritte:**
  1. ...
  2. ...
  3. ...
- **My Recommendation:** **Standard** (alle Critical/High aus Migration anwenden) — [Begründung in einem Satz]
- **Steps at a Glance:** 🔴 Manual Critical: N | 🟠 Manual High: N | 🟡 Optional: N | **Total: N** — ⏱️ ≈ X min für Komplett

### Decision Helper
- 🚀 **Minimal** — nur Build-Blocker beheben, Migration sonst pausieren — N Schritte, ≈ X min
- 🎯 **Standard (Empfohlen)** — alle Critical + High Migrations-Schritte umsetzen — N Schritte, ≈ X min
- 💎 **Komplett** — zusätzlich alle Medium/Low Tipps + Codebase-Cleanup — N Schritte, ≈ X min
- ⏭️ **Nichts** — Update-Status melden, manuelle Schritte als Tickets, ≈ X min

After printing the report, **ask via `AskUserQuestion`** which option to execute (skip if zero manual steps required). Then execute the chosen migration steps, propose code changes, apply after confirmation. End with a "Result"-Block: chosen option, steps performed, files modified, remaining steps, suggested next step (`/lt-dev:check`, `/lt-dev:review`, oder PR erstellen).

### Action Roadmap
#### 🔴 Must Fix (Critical)
1. ...
#### 🟠 Must Fix (High)
1. ...
#### 🟡 Should Fix (Medium)
1. ...
#### 🟢 Nice to Have (Low / Info)
1. ...

### Version Overview
Subproject | From | To | Mode | Migration Guides Applied
- api: x.y.z → a.b.c (npm), 1 guide applied
- app: x.y.z → a.b.c (vendor), 2 guides applied

### Validation Results
- Build: Backend ✅ | Frontend ✅
- Tests: Backend ✅ N/M | Frontend —
- Lint:  Backend ✅ | Frontend ✅

### Detailed Updater Reports

<details>
<summary>🔧 Backend Core Updater — full report</summary>

[Paste verbatim, OR "Not spawned — backend in npm mode."]

</details>

<details>
<summary>📦 Backend NPM Updater — full report</summary>

[Paste verbatim, OR "Not spawned — backend in vendor mode."]

</details>

<details>
<summary>🎨 Frontend Core Updater — full report</summary>

[Paste verbatim, OR "Not spawned — frontend in npm mode."]

</details>

<details>
<summary>🔄 Frontend NPM Updater — full report</summary>

[Paste verbatim, OR "Not spawned — frontend in vendor mode."]

</details>
```
