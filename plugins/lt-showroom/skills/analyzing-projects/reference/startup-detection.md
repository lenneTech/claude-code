# Startup Detection Reference

Detailed recipes for detecting how a project starts, what it needs to run, and how to seed demo data. Consumed by the `analyzing-projects` skill to produce a complete `startupInfo` block.

The analysis MUST produce a complete, actionable recipe to start the project from scratch. Without it, screenshots cannot be taken and features cannot be verified.

## 1. Project Structure & Package Manager

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

## 2. Dependency Installation

Check if `node_modules` exist. If missing or broken, document the install command:
- Lerna: `npm run init` (preferred) or `npx lerna bootstrap`
- pnpm: `pnpm install`
- npm: `npm install`

Verify key binaries after install:
```bash
[ -f "projects/app/node_modules/.bin/nuxt" ] || echo "BROKEN: nuxt not found"
[ -f "projects/api/node_modules/.bin/nest" ] || echo "BROKEN: nest not found"
```

## 3. Environment Configuration

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

## 4. Database & External Services

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

## 5. Start Command

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

**Port conflicts:** Most lenne.tech projects hardcode port 3000 (API) and 3001 (App) in `config.env.ts`. Only one project can run at a time.

## 6. First User / Authentication Setup

Determine how to create the first usable account:

| Method | Detection | Command |
|---|---|---|
| system-setup/init | `CoreSystemSetupModule` in imports | `POST /system-setup/init {"email":"...","password":"..."}` |
| Seed migration | `migrations/` with admin seed | Runs automatically on first start |
| Better Auth sign-up | `CoreBetterAuthModule` | `POST /iam/sign-up/email` (may require Terms acceptance) |
| Legacy Auth signup | `auth/signup` route | `POST /auth/signup` |
| No auth needed | Public-only site | Skip |

Read migration files to check if an admin account is auto-created.

## 7. Demo Data / Seed

Check for seed mechanisms:
- `package.json` scripts: `seed`, `db:seed`, `demo`, `fixtures`, `init:data`
- Migration files that insert test data (e.g., `seed-test-sellers-and-buyers.ts`)
- README instructions for populating data
- If no seed exists: document that demo data must be created manually via UI or API

## 8. Auth Routes & Login Pages

Find the actual login route (varies per project):
- `/auth/login` (lenne.tech standard with Better Auth)
- `/auth/signin` (legacy auth)
- Login embedded in landing page (no separate route)
- Registration at `/auth/register` or `/auth/registrierung`

Check for Terms & Privacy acceptance requirements that block sign-up.

## startupInfo Output Block

```yaml
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
      required: false
      setup: "docker compose up -d qdrant"
    - name: "Directus CMS"
      required: true
      setup: "external — URL in .env.example"
  seedCommand: "npm run seed" | "auto (migration)"
  seedCredentials: { email: "admin@lenne.tech", password: "Test1234!" }
  authMethod: "system-setup" | "better-auth-signup" | "legacy-signup" | "seed-migration" | "none"
  authRoute: "/auth/login" | "/auth/signin" | "embedded in landing page"
  authNotes: "Terms acceptance required" | "Admin auto-created by migration"
  envSetup: "cp .env.example .env"
  envRequired: ["OPENAI_API_KEY"]
  envOptional: ["SENTRY_DSN", "PLAUSIBLE_URL"]
  screenshottable: true
  screenshotNotes: "Python NLP service can be skipped — UI works without vector matching"
```
