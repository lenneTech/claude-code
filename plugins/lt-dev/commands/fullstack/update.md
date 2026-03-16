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
| Check impact before updating | `/lt-dev:fullstack:update --dry-run` |
| Only update frontend | `/lt-dev:fullstack:update --skip-backend` |
| Only update backend | `/lt-dev:fullstack:update --skip-frontend` |
| Backend-only project | `/lt-dev:backend:update-nest-server` |

## Related Elements

| Element | Purpose |
|---------|---------|
| **Skill**: `nest-server-updating` | Backend update knowledge base |
| **Skill**: `developing-lt-frontend` | Frontend patterns and expertise |
| **Skill**: `maintaining-npm-packages` | Package optimization guidance |
| **Agent**: `lt-dev:nest-server-updater` | Backend nest-server version update |
| **Agent**: `lt-dev:fullstack-updater` | Frontend update + starter synchronization |
| **Command**: `/lt-dev:backend:update-nest-server` | Standalone backend update |

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

4. **Get current and target versions:**
   ```bash
   cd <backend-path> && pnpm list @lenne.tech/nest-server --depth=0
   cd <frontend-path> && pnpm list @lenne.tech/nuxt-extensions --depth=0
   pnpm view @lenne.tech/nest-server version
   pnpm view @lenne.tech/nuxt-extensions version
   ```

5. **Early exit:** If both already on latest → "Already up to date"

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

Spawn the `nest-server-updater` agent:

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

Spawn the `fullstack-updater` agent with --skip-backend:

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

3. **Generate report** with version changes, files modified, validation results.

4. **Cleanup:**
   ```bash
   rm -rf /tmp/nest-server-starter-ref /tmp/nuxt-base-starter-ref
   ```
