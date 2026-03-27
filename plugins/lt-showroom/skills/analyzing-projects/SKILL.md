---
name: analyzing-projects
description: |
  Analyzes software projects to extract technology stack, architecture, features, API surface,
  testing strategy, UI/UX patterns, security measures, and performance optimizations. Produces
  structured, evidence-based reports where every claim is backed by a source code reference.
  Also detects how the application is started (scripts, Docker, database requirements) and
  enumerates all pages and views for screenshot planning. Outputs a structured report that
  feeds directly into SHOWCASE.md creation and screenshot automation.
  Activates when analyzing a project for showroom showcases, portfolio entries, project
  documentation, or when a user asks what a project does or how it is built.
  NOT for creating or publishing showcases (use creating-showcases). NOT for platform development (use generating-nest-servers).
effort: high
---

# Analyzing Software Projects

This skill enables Claude Code to perform deep, evidence-based analysis of software projects and produce structured reports suitable for SHOWCASE.md creation and showcase publishing on showroom.lenne.tech.

## When to Use This Skill

- User asks to analyze a project for a showcase or portfolio entry
- User wants to understand what a codebase does or how it is structured
- Running `/showroom:analyze`, `/showroom:create`, or `/showroom:update` commands
- Working inside the showroom platform repository on analysis features
- User asks about a project's technology stack, features, or architecture

## Skill Boundaries

| User Intent | Correct Skill |
|------------|---------------|
| Analyze project source code | **THIS SKILL** |
| Create or update a showcase | `creating-showcases` |
| Develop the showroom platform itself | `generating-nest-servers` / `developing-lt-frontend` |

## Related Skills

**Works closely with:**
- `creating-showcases` — Consumes analysis reports to build SHOWCASE.md and showcase content
- `generating-nest-servers` — For backend development on the showroom API

## Analysis Dimensions

Every project analysis covers exactly 8 dimensions. Read the full guide in `${CLAUDE_SKILL_DIR}/reference/analysis-dimensions.md`.

| # | Dimension | Purpose |
|---|-----------|---------|
| 1 | Technology Stack | Languages, frameworks, key libraries, runtimes |
| 2 | Architecture | Structure, patterns, separation of concerns |
| 3 | Core Features | User-facing capabilities backed by endpoints/components |
| 4 | API Surface | REST endpoints, GraphQL schema, auth mechanisms |
| 5 | Testing Strategy | Test types, frameworks, coverage breadth |
| 6 | UI/UX Patterns | Component libraries, responsive design, accessibility |
| 7 | Security Measures | Auth, validation, rate limiting, encryption |
| 8 | Performance Optimizations | Caching, query optimization, async patterns |

## Additional Analysis (Required for Phase 2+3)

Beyond the 8 dimensions, every analysis MUST also produce:

### Feature List with Evidence

For each feature, record:
- **Name** — short, action-oriented label (e.g. "Role-based Access Control")
- **Description** — 1-2 sentences describing what the feature does
- **Evidence** — `file:line` reference to the implementing code
- **Screenshot candidate** — which page/view best demonstrates this feature

Apply heuristics from `${CLAUDE_SKILL_DIR}/reference/feature-extraction.md` to detect features systematically.

### How to Get the Project Running (CRITICAL)

The analysis MUST produce a complete, actionable recipe to start the project from scratch. This is not optional — without it, screenshots cannot be taken and features cannot be verified.

**Investigate every aspect needed to make the project launchable:**

#### 1. Project Structure & Package Manager

```bash
# Detect monorepo type
[ -f "lerna.json" ] && echo "Lerna monorepo"
[ -f "pnpm-workspace.yaml" ] && echo "pnpm workspace"
[ -d "projects/api" ] && [ -d "projects/app" ] && echo "Fullstack monorepo"

# Detect package manager
[ -f "pnpm-lock.yaml" ] && PM="pnpm"
[ -f "package-lock.json" ] && PM="npm"
[ -f "yarn.lock" ] && PM="yarn"

# Count subprojects (some have 3+: api, app, landing-page)
ls -d projects/*/ 2>/dev/null
```

#### 2. Dependency Installation

Check if `node_modules` exist. If missing or broken, document the install command:
- Lerna: `npm run init` (preferred) or `npx lerna bootstrap`
- pnpm: `pnpm install`
- npm: `npm install`

Verify key binaries after install:
```bash
[ -f "projects/app/node_modules/.bin/nuxt" ] || echo "BROKEN: nuxt not found"
[ -f "projects/api/node_modules/.bin/nest" ] || echo "BROKEN: nest not found"
```

#### 3. Environment Configuration

```bash
# Check for .env files in root and all subprojects
for dir in . projects/api projects/app; do
  [ -f "$dir/.env" ] && echo "$dir/.env exists"
  [ -f "$dir/.env.example" ] && echo "$dir/.env.example exists — copy to .env"
done
```

Read `.env.example` to identify:
- **Required variables** (no defaults, app won't start without them)
- **Optional variables** (have defaults or are non-critical)
- **Secret variables** (API keys, passwords — note that they need real values)

#### 4. Database & External Services

Check what the project needs beyond Node.js:

| What to check | Where to look |
|---|---|
| MongoDB | `MONGO_URI` in .env.example, `mongoose` in package.json |
| Redis | `REDIS_URL` in .env.example, `redis`/`ioredis` in package.json |
| Qdrant | `QDRANT_URL`, docker-compose.yml services |
| Directus CMS | `DIRECTUS_URL` in nuxt.config.ts or .env |
| Python Service | `projects/python-service/` directory, `requirements.txt` |
| PostgreSQL | `DATABASE_URL=postgres://` in .env.example |

For each service, document:
- Whether it's in docker-compose.yml (preferred startup)
- The standalone Docker command if not in compose
- Whether it's external (like a hosted Directus CMS)
- Whether it can be skipped for screenshot purposes

#### 5. Start Command

Determine the exact command to start the project:

| Pattern | Detection | Start Command |
|---|---|---|
| Lerna monorepo | `lerna.json` exists | `npm run start` (runs `lerna run --parallel start`) |
| pnpm workspace | `pnpm-workspace.yaml` | `pnpm run start` (runs `pnpm -r --parallel run start`) |
| Docker Compose | `docker-compose.yml` | `docker compose up -d` |
| Tauri desktop | `src-tauri/` directory | `npx nuxt dev` (ignore Tauri, web-only) |
| Frontend-only with CMS | `directus`/`strapi` in deps | `npm run dev` (CMS is external) |
| Backend-only | no frontend directory | `npm run start` (screenshot Swagger/GraphQL) |
| Single Nuxt app | `nuxt.config.ts` at root | `npx nuxt dev` |

**Port conflicts:** Note that most lenne.tech projects hardcode port 3000 (API) and 3001 (App) in `config.env.ts`. Only one project can run at a time.

#### 6. First User / Authentication Setup

Determine how to create the first usable account:

| Method | Detection | Command |
|---|---|---|
| system-setup/init | `CoreSystemSetupModule` in imports | `POST /system-setup/init {"email":"...","password":"..."}` |
| Seed migration | `migrations/` with admin seed | Runs automatically on first start |
| Better Auth sign-up | `CoreBetterAuthModule` | `POST /iam/sign-up/email` (may require Terms acceptance) |
| Legacy Auth signup | `auth/signup` route | `POST /auth/signup` |
| No auth needed | Public-only site | Skip |

Read migration files to check if an admin account is auto-created (common in Volksbank projects).

#### 7. Demo Data / Seed

Check for seed mechanisms:
- `package.json` scripts: `seed`, `db:seed`, `demo`, `fixtures`, `init:data`
- Migration files that insert test data (e.g., `seed-test-sellers-and-buyers.ts`)
- README instructions for populating data
- If no seed exists: document that demo data must be created manually via UI or API

#### 8. Auth Routes & Login Pages

Find the actual login route (varies per project):
- `/auth/login` (lenne.tech standard with Better Auth)
- `/auth/signin` (legacy auth)
- Login embedded in landing page (no separate route)
- Registration at `/auth/register` or `/auth/registrierung`

Check for Terms & Privacy acceptance requirements that block sign-up.

Output all findings as a `startupInfo` block:
```
startupInfo:
  projectType: "lerna-monorepo" | "pnpm-monorepo" | "headless-cms" | "tauri-desktop" | "backend-only" | "nuxt" | "library"
  packageManager: "pnpm" | "npm" | "yarn"
  installCommand: "npm run init" | "pnpm install" | "npm install"
  subprojects: ["api", "app"] | ["api", "app", "landing-page"]
  startCommand: "npm run start" | "pnpm run start" | "npx nuxt dev"
  apiPort: 3000
  appPort: 3001
  additionalPorts: { "landing-page": 3002 }
  requiresDatabase: true
  databaseType: "mongodb"
  databaseSetup: "local MongoDB on 27017" | "docker compose up -d"
  externalServices:
    - name: "Qdrant"
      required: false  # app works without it, just no vector matching
      setup: "docker compose up -d qdrant"
    - name: "Directus CMS"
      required: true
      setup: "external — URL in .env.example"
  seedCommand: "npm run seed" | "auto (migration)"
  seedCredentials: { email: "admin@lenne.tech", password: "Test1234!" }  # from migration
  authMethod: "system-setup" | "better-auth-signup" | "legacy-signup" | "seed-migration" | "none"
  authRoute: "/auth/login" | "/auth/signin" | "embedded in landing page"
  authNotes: "Terms acceptance required" | "Admin auto-created by migration"
  envSetup: "cp .env.example .env" | "cp projects/api/.env.example projects/api/.env && cp projects/app/.env.example projects/app/.env"
  envRequired: ["OPENAI_API_KEY"]
  envOptional: ["SENTRY_DSN", "PLAUSIBLE_URL"]
  screenshottable: true
  screenshotNotes: "Python NLP service can be skipped — UI works without vector matching"
```

### Pages and Views Inventory

List all navigable pages and views in the application for screenshot planning:

1. **Frontend Projects** (Nuxt, Next.js, Vue, React, Angular):
   - Glob for `pages/`, `app/`, `views/`, `routes/` directories
   - Read router files to enumerate all routes
   - Classify each route: public, authenticated, admin
   - Note the primary feature each page exposes

2. **Backend-only Projects** (NestJS, Express, Fastify):
   - Enumerate controller route prefixes
   - Identify any swagger/API docs endpoint

Output a `pagesInventory` list:
```
pagesInventory:
  - path: "/"
    name: "Landing Page"
    auth: "public"
    feature: "Homepage"
  - path: "/dashboard"
    name: "Dashboard"
    auth: "authenticated"
    feature: "Overview & Analytics"
  - path: "/projects/:id"
    name: "Project Detail"
    auth: "authenticated"
    feature: "Project Management"
```

## Execution Protocol

1. **Discover** — Read manifest files to detect tech stack (`${CLAUDE_SKILL_DIR}/reference/framework-detection.md`)
2. **Map** — Glob for controllers, services, models, components, test files
3. **Deep-read** — Follow imports, read implementations for key findings
4. **Extract features** — Apply heuristics from `${CLAUDE_SKILL_DIR}/reference/feature-extraction.md`
5. **Detect startup** — Check docker-compose, package scripts, env requirements
6. **Inventory pages** — Enumerate all routes and views
7. **Compile** — Structure output according to `${CLAUDE_SKILL_DIR}/reference/report-schema.md`
8. **Validate** — Verify every claim has a `file:line` reference

## Validation Rules

- **No speculation** — Every feature claim needs a code reference
- **No marketing language** — Describe what the code does, not potential
- **Accurate names** — Use exact package names from dependency files
- **Honest coverage** — If tests are sparse, say so
- **No duplication** — Each finding in exactly one dimension

## Output Format

Produce a structured report following `${CLAUDE_SKILL_DIR}/reference/report-schema.md`.

The report MUST include:
- All 8 analysis dimensions
- Feature list with evidence and screenshot candidates
- `startupInfo` block
- `pagesInventory` list

Source references use the format: `path/to/file.ts:42`

Unknown or undeterminable items are marked as `unknown` — never guessed.

## Reference Files

- `${CLAUDE_SKILL_DIR}/reference/analysis-dimensions.md` — Detailed guide for each of the 8 dimensions
- `${CLAUDE_SKILL_DIR}/reference/framework-detection.md` — Framework detection lookup table
- `${CLAUDE_SKILL_DIR}/reference/feature-extraction.md` — Feature heuristics (auth, uploads, realtime, etc.)
- `${CLAUDE_SKILL_DIR}/reference/report-schema.md` — TypeScript interface for the structured report
