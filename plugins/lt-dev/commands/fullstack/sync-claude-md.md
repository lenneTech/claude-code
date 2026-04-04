---
description: Sync CLAUDE.md files from lenne.tech starter templates into an existing fullstack project
allowed-tools: Read, Write, Edit, Grep, Glob, Bash(git:*), Bash(gh:*), Bash(ls:*), Bash(base64:*), WebFetch, AskUserQuestion
disable-model-invocation: true
---

# Sync CLAUDE.md Files

Fetches the latest CLAUDE.md files from lenne.tech starter repositories and integrates them into the current fullstack project.

## Source Mapping

| Source Repository | Branch | Target Path |
|-------------------|--------|-------------|
| `lenneTech/lt-monorepo` → `CLAUDE.md` | `main` | `./CLAUDE.md` (project root) |
| `lenneTech/nuxt-base-starter` → `nuxt-base-template/CLAUDE.md` | `main` | `./projects/app/CLAUDE.md` |
| `lenneTech/nest-server` → `CLAUDE.md` | `develop` | `./projects/api/CLAUDE.md` |

## Execution

### Phase 1: Detect Project Structure

1. **Verify this is a lenne.tech fullstack project:**
   ```bash
   ls -d projects/api projects/app 2>/dev/null
   ```
   If neither exists, check for `packages/api` and `packages/app` instead.
   If no matching structure found → abort with error message.

2. **Determine actual paths:**
   - `API_DIR` = `projects/api` or `packages/api` (whichever exists)
   - `APP_DIR` = `projects/app` or `packages/app` (whichever exists)

3. **Detect project metadata** for template variable replacement in the monorepo CLAUDE.md:
   - `PROJECT_NAME`: Read from root `package.json` → `name` field. Fallback: directory name.
   - `PROJECT_DIR`: Use the directory name of the project root.
   - `FRONTEND_FRAMEWORK`: Check `${APP_DIR}/package.json` for framework. Default: `Nuxt 4`.
   - `API_MODE`: Check `${API_DIR}/package.json` or config for GraphQL vs REST. If `@nestjs/graphql` is a dependency → `GraphQL + REST`, otherwise `REST`.

### Phase 2: Fetch Latest CLAUDE.md Files

Fetch all three files from GitHub using the GitHub API:

```bash
gh api repos/lenneTech/lt-monorepo/contents/CLAUDE.md --jq '.content' | base64 -d
gh api repos/lenneTech/nuxt-base-starter/contents/nuxt-base-template/CLAUDE.md --jq '.content' | base64 -d
gh api repos/lenneTech/nest-server/contents/CLAUDE.md?ref=develop --jq '.content' | base64 -d
```

If `gh` is not available, fall back to WebFetch with raw GitHub URLs:
- `https://raw.githubusercontent.com/lenneTech/lt-monorepo/main/CLAUDE.md`
- `https://raw.githubusercontent.com/lenneTech/nuxt-base-starter/main/nuxt-base-template/CLAUDE.md`
- `https://raw.githubusercontent.com/lenneTech/nest-server/develop/CLAUDE.md`

### Phase 3: Process Each Target

For each of the three targets (root, app, api), execute the integration logic:

#### 3a: Root CLAUDE.md (`./CLAUDE.md`)

1. **Replace template variables** in the fetched monorepo CLAUDE.md:
   - `{{PROJECT_NAME}}` → detected project name
   - `{{PROJECT_DIR}}` → detected directory name
   - `{{FRONTEND_FRAMEWORK}}` → detected framework (e.g., `Nuxt 4`)
   - `{{API_MODE}}` → detected API mode (e.g., `GraphQL + REST` or `REST`)

2. **Check if `./CLAUDE.md` already exists:**
   - **Does NOT exist** → Write the processed template directly.
   - **Already exists** → Merge (see Phase 4).

#### 3b: Frontend CLAUDE.md (`${APP_DIR}/CLAUDE.md`)

1. **Check if `${APP_DIR}/CLAUDE.md` already exists:**
   - **Does NOT exist** → Write the fetched content directly.
   - **Already exists** → Merge (see Phase 4).

#### 3c: Backend CLAUDE.md (`${API_DIR}/CLAUDE.md`)

1. **Check if `${API_DIR}/CLAUDE.md` already exists:**
   - **Does NOT exist** → Write the fetched content directly.
   - **Already exists** → Merge (see Phase 4).

### Phase 4: Merge Strategy (when CLAUDE.md already exists)

When a CLAUDE.md already exists at the target path:

1. **Read the existing file** completely.
2. **Compare sections** (H2 headings `## ...`) between existing and template.
3. **Apply these rules:**

   | Situation | Action |
   |-----------|--------|
   | Section exists in template but NOT in existing | **Add** the section at the appropriate position |
   | Section exists in BOTH template and existing | **Keep existing** — it may contain project-specific customizations |
   | Section exists in existing but NOT in template | **Keep existing** — it's project-specific content |
   | Existing file has no clear section structure | **Ask the user** how to proceed (replace or append) |

4. **Present a summary** to the user showing:
   - Which sections were added
   - Which sections were kept as-is
   - Which sections exist only in the project (preserved)

5. **Ask for confirmation** before writing the merged result.

### Phase 5: Report

After processing all three files, show a summary:

```
## CLAUDE.md Sync Complete

| Target | Status | Details |
|--------|--------|---------|
| ./CLAUDE.md | ✅ Created / 🔄 Merged | (details) |
| projects/app/CLAUDE.md | ✅ Created / 🔄 Merged | (details) |
| projects/api/CLAUDE.md | ✅ Created / 🔄 Merged | (details) |
```

## Important

- **Never overwrite** existing project-specific content without user confirmation
- **Template variables** are only replaced in the root monorepo CLAUDE.md (the other two files have no placeholders)
- **The nest-server CLAUDE.md** references `.claude/rules/` which exists in the nest-server npm package — these paths are informational for the framework, not for the project
- If only `projects/app/` OR `projects/api/` exists (not a full monorepo), only sync the applicable files
