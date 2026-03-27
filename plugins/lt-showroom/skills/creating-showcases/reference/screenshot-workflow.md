# Screenshot Workflow — Feature-Based Guide

This document details the complete screenshot capture workflow for the `screenshot-generator` agent and the `/showroom:screenshot` command. Screenshots are feature-driven: one set of captures per feature defined in `SHOWCASE.md`.

## Overview

```
Phase 1: Read SHOWCASE.md   → features + pages + startup info
Phase 2: Startup Detection  → project type detection, dependency mapping
Phase 3: Environment Setup  → .env, dependencies, database, ports
Phase 4: Start Application  → appropriate method per project type
Phase 5: Demo Data          → seed script, system-setup, or UI creation
Phase 6: Capture            → desktop + mobile per feature
Phase 7: Cleanup            → stop all processes, verify ports
```

## Phase 1: Read SHOWCASE.md

Parse `SHOWCASE.md` (or `docs/showcase/SHOWCASE.md`) to extract:
- Feature list with screenshot candidate pages (from the "Features" sections)
- `startupInfo` block (if present) — startup method, port, database, seed command
- `pagesInventory` list — all routes with auth levels

If `SHOWCASE.md` does not exist yet, detect everything from source files (see Phase 2).

## Phase 2: Startup Detection

### Project Type Detection

Detect the project type BEFORE choosing a startup method:

```bash
# 1. Monorepo with api + app (lenne.tech fullstack)
[ -d "projects/api" ] && [ -d "projects/app" ] && TYPE="lt-monorepo"

# 2. Lerna monorepo (older lenne.tech projects)
[ -f "lerna.json" ] && TYPE="lerna-monorepo"

# 3. pnpm workspace monorepo
[ -f "pnpm-workspace.yaml" ] && TYPE="pnpm-monorepo"

# 4. Frontend-only with external CMS (e.g. Directus)
grep -q "directus\|strapi\|contentful" package.json && TYPE="headless-cms"

# 5. Desktop app (Tauri)
[ -d "src-tauri" ] && TYPE="tauri-desktop"

# 6. Backend-only (no frontend directory)
[ ! -d "projects/app" ] && [ ! -d "src/pages" ] && [ ! -d "app/pages" ] && TYPE="backend-only"

# 7. Single Nuxt/Next/Vite project
[ -f "nuxt.config.ts" ] && TYPE="nuxt"
[ -f "next.config.js" ] && TYPE="next"
[ -f "vite.config.ts" ] && TYPE="vite"

# 8. NPM package / CLI tool / Library
[ -f "tsconfig.build.json" ] && ! [ -d "src/pages" ] && TYPE="library"
```

### Package Manager Detection

```bash
[ -f "pnpm-lock.yaml" ] && PM="pnpm"
[ -f "yarn.lock" ] && PM="yarn"
[ -f "package-lock.json" ] && PM="npm"
# Lerna projects often use npm even without lockfile
[ -f "lerna.json" ] && [ -z "$PM" ] && PM="npm"
```

### Monorepo Structure Detection (lenne.tech Pattern)

Most lenne.tech projects follow this pattern:
```
project/
├── projects/
│   ├── api/         # NestJS backend (port 3000)
│   └── app/         # Nuxt frontend (port 3001)
├── lerna.json       # Older projects use Lerna
├── pnpm-workspace.yaml  # Newer projects use pnpm
└── package.json     # Root with "start" script
```

**Lerna monorepos** (forgecloud, gizeh, volksbank/dna, volksbank/imo, volksbank/RegioKonneX, swaktiv):
```bash
npm run start  # Runs lerna run start --parallel (both api + app)
```

**pnpm monorepos** (offers, showroom):
```bash
pnpm run start  # Runs pnpm -r --parallel run start
```

### External Service Detection

Check for services beyond MongoDB:

| Service | Detection | Docker Run Command |
|---------|-----------|-------------------|
| MongoDB | `MONGO_URI` in .env.example | `docker run -d --name showcase-mongo -p 27018:27017 mongo:7` |
| Redis | `REDIS_URL` in .env.example | `docker run -d --name showcase-redis -p 6380:6379 redis:7` |
| Qdrant | `QDRANT_URL` in .env.example or docker-compose.yml | `docker run -d --name showcase-qdrant -p 6334:6333 qdrant/qdrant:latest` |
| Directus | `DIRECTUS_URL` in .env / nuxt.config.ts | Use the URL from .env.example (external CMS, no local start needed) |
| Python Service | `python-service/` directory in monorepo | `cd projects/python-service && pip install -r requirements.txt && uvicorn main:app --port 8000` |

### Detect Dev Ports

Check in order:
1. `.env` or `.env.example`: `PORT=`, `NUXT_PORT=`, `APP_PORT=`
2. `nuxt.config.ts`: `devServer: { port: ... }`
3. `projects/app/nuxt.config.ts`: (monorepo pattern)
4. `main.ts` (NestJS): `app.listen(PORT)` — default 3000
5. Default: API=3000, App=3001

### Detect Seed Script

Check `package.json` (root AND projects/api/) scripts for:
`seed`, `db:seed`, `demo`, `fixtures`, `populate`, `init:data`

### System Setup Detection (lenne.tech Pattern)

Most lenne.tech projects support initial admin creation:
```bash
curl -s -X POST http://localhost:3000/system-setup/init \
  -H 'Content-Type: application/json' \
  -d '{"email":"showcase@test.com","password":"Showcase123"}'
```

This works ONLY when no users exist in the database. Check the response — if 403 "users already exist", the DB already has data.

## Phase 3: Environment Setup

### Step 0: Install Dependencies (MANDATORY)

**Always check and install dependencies before starting any project.** Missing or broken `node_modules` is the #1 reason projects fail to start.

```bash
# Detect package manager
[ -f "pnpm-lock.yaml" ] && PM="pnpm"
[ -f "yarn.lock" ] && PM="yarn"
[ -f "package-lock.json" ] && PM="npm"
[ -f "lerna.json" ] && PM="npm"  # Lerna projects use npm

# Check if node_modules exist at root
if [ ! -d "node_modules" ]; then
  echo "Root node_modules missing — installing..."
  ${PM} install
fi

# For monorepos: check subprojects
if [ -d "projects/api" ] && [ ! -d "projects/api/node_modules" ]; then
  echo "API node_modules missing — installing..."
  # Lerna projects: use 'npm run init' or 'npx lerna bootstrap'
  if [ -f "lerna.json" ]; then
    npm run init 2>/dev/null || npx lerna bootstrap
  elif [ -f "pnpm-workspace.yaml" ]; then
    pnpm install
  fi
fi

if [ -d "projects/app" ] && [ ! -d "projects/app/node_modules" ]; then
  echo "App node_modules missing — installing..."
  if [ -f "lerna.json" ]; then
    npm run init 2>/dev/null || npx lerna bootstrap
  elif [ -f "pnpm-workspace.yaml" ]; then
    pnpm install
  fi
fi
```

**Repair broken dependencies:**

If `node_modules` exists but binaries are missing (e.g., `nuxt: command not found`):
```bash
# Check for broken bin links
[ -f "projects/app/node_modules/.bin/nuxt" ] || echo "Nuxt binary missing — reinstalling..."

# Force reinstall
rm -rf node_modules projects/*/node_modules
${PM} install
# Or for Lerna: npm run init
```

**Never skip this step.** Even if `node_modules` directories exist, verify that key binaries are present before attempting to start the project.

### Step 1: Create .env from .env.example

```bash
# Check for .env
if [ ! -f ".env" ] && [ -f ".env.example" ]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi

# For monorepos: also check subprojects
for dir in projects/api projects/app; do
  if [ -d "$dir" ] && [ ! -f "$dir/.env" ] && [ -f "$dir/.env.example" ]; then
    cp "$dir/.env.example" "$dir/.env"
    echo "Created $dir/.env from .env.example"
  fi
done
```

### Step 2: Install Dependencies

```bash
# Detect and install
if [ "$PM" = "pnpm" ]; then
  pnpm install
elif [ "$PM" = "npm" ]; then
  npm install
fi

# For Lerna monorepos: lerna bootstrap or npm install at root
[ -f "lerna.json" ] && npm install
```

### Step 3: Check Port Availability

```bash
for port in 3000 3001; do
  if lsof -ti :$port > /dev/null 2>&1; then
    echo "WARNING: Port $port is in use"
    lsof -ti :$port | head -1
  fi
done
```

### Step 4: Start Database (if needed and not running)

```bash
# Check if MongoDB is accessible
if ! mongosh --quiet --eval "db.runCommand({ping:1})" 2>/dev/null; then
  echo "MongoDB not running, starting via Docker..."
  docker run -d --name showcase-mongo -p 27017:27017 mongo:7
fi
```

## Phase 4: Start Application

### Type-Specific Startup

**Lerna Monorepo** (most customer projects):
```bash
npm run start
# This typically runs: lerna run start --parallel
# Starts both API (port 3000) and App (port 3001)
```

**pnpm Monorepo** (newer lenne.tech projects):
```bash
pnpm run start
# This typically runs: pnpm -r --parallel run start
```

**Docker Compose** (when present and complex stack):
```bash
docker compose up -d
# Use this for projects with Qdrant, Redis, Python services
```

**Tauri Desktop App** (bornebusch):
```bash
# Don't start Tauri — start only the Nuxt dev server
cd projects/app  # or root if single project
npx nuxt dev --port 3001
# The app works as a web app without Tauri
```

**Headless CMS Frontend** (swfdigital):
```bash
# Only start the frontend — CMS is external
cp .env.example .env  # Contains the Directus URL
npm run dev  # or pnpm run dev
```

**Backend-Only** (ontavio email-server):
```bash
npm run start
# Screenshots of: Swagger UI (/swagger), GraphQL Playground (/graphql)
```

**Library/CLI/Framework** (nest-server, nuxt-extensions, cli):
```bash
# These are not showcase-screenshottable applications
# Skip screenshot phase, note in SHOWCASE.md that screenshots are not applicable
```

### Readiness Check

Poll until the application responds:
```bash
FRONTEND_PORT=${FRONTEND_PORT:-3001}
API_PORT=${API_PORT:-3000}

# Wait for API
for i in $(seq 1 20); do
  curl -s -o /dev/null -w "%{http_code}" "http://localhost:${API_PORT}" 2>/dev/null | grep -qE "200|301|302|404" && break
  sleep 3
done

# Wait for Frontend
for i in $(seq 1 20); do
  curl -s -o /dev/null -w "%{http_code}" "http://localhost:${FRONTEND_PORT}" 2>/dev/null | grep -qE "200|301|302" && break
  sleep 3
done
```

## Phase 5: Demo Data

### Priority Order

1. **System Setup** (lenne.tech projects with Better Auth or Legacy Auth):
```bash
# Create first admin user
curl -s -X POST "http://localhost:3000/system-setup/init" \
  -H 'Content-Type: application/json' \
  -d '{"email":"showcase@test.com","password":"Showcase123"}'
```

2. **Seed Script** (if exists):
```bash
cd projects/api  # or root
${PM} run seed   # or db:seed, demo, fixtures
```

3. **Chrome DevTools MCP** (manual creation via UI):
   - Log in with the system-setup credentials
   - Create 2-3 realistic records per primary entity
   - Use realistic German names, descriptions, company names
   - Cover the main user workflow

4. **API Calls** (programmatic creation):
```bash
# Login to get session cookie
curl -s -c /tmp/showcase-cookies.txt -X POST "http://localhost:3000/iam/sign-in/email" \
  -H 'Content-Type: application/json' \
  -d '{"email":"showcase@test.com","password":"Showcase123"}'

# Create entities via REST or GraphQL
curl -s -b /tmp/showcase-cookies.txt -X POST "http://localhost:3000/{entity}" \
  -H 'Content-Type: application/json' \
  -d '{"title":"Beispiel","description":"Realistische Beschreibung..."}'
```

### Demo Data Quality

- Use realistic German names (not "Test" or "Lorem ipsum")
- Create enough data to fill the UI (not just 1 record)
- Cover edge cases that demonstrate features (e.g., different statuses)
- If the project has a public-facing page, ensure it has content visible without auth

## Phase 6: Capture Screenshots

### Output Directory

```bash
mkdir -p docs/showcase/screenshots
```

### Viewports

| Viewport | Width | Height |
|----------|-------|--------|
| desktop | 1440 | 900 |
| mobile | 390 | 844 |

### Capture Sequence

**Step 1: Overview Screenshots**
- Landing page / public home: `overview-desktop.png`, `overview-mobile.png`
- Login page (if exists): `login-desktop.png`
- Dashboard (after login): `dashboard-desktop.png`

**Step 2: Feature Screenshots**
For each feature in SHOWCASE.md:
1. Navigate to the page demonstrating the feature
2. Wait 2000ms for animations, data loading, and scroll-reveal
3. Trigger scroll-reveal by scrolling through the page:
```javascript
async () => {
  const steps = Array.from({length: 20}, (_, i) => i * 300);
  for (const y of steps) {
    window.scrollTo({top: y, behavior: 'instant'});
    await new Promise(r => setTimeout(r, 200));
  }
  window.scrollTo({top: 0, behavior: 'instant'});
}
```
4. Set viewport to desktop (1440×900)
5. Take screenshot: `{feature-slug}-desktop.png`
6. Set viewport to mobile (390×844)
7. Take screenshot: `{feature-slug}-mobile.png`

**Step 3: Backend-Only Projects**
For projects without a frontend UI:
- Screenshot Swagger UI: `http://localhost:3000/swagger`
- Screenshot GraphQL Playground: `http://localhost:3000/graphql`
- Save as `api-swagger-desktop.png`, `api-graphql-desktop.png`

### Filename Convention

```
docs/showcase/screenshots/
├── overview-desktop.png
├── overview-mobile.png
├── login-desktop.png
├── dashboard-desktop.png
├── {feature-1-slug}-desktop.png
├── {feature-1-slug}-mobile.png
├── {feature-2-slug}-desktop.png
├── {feature-2-slug}-mobile.png
└── ...
```

## Phase 7: Cleanup

**Always run cleanup, even if earlier phases failed.**

```bash
# Stop Lerna-managed processes
pkill -f "lerna run" 2>/dev/null

# Stop dev servers
pkill -f "nuxt dev" 2>/dev/null
pkill -f "next dev" 2>/dev/null
pkill -f "nest start" 2>/dev/null
pkill -f "nodemon" 2>/dev/null
pkill -f "vite" 2>/dev/null
pkill -f "uvicorn" 2>/dev/null

# Stop Docker Compose services (if started in this session)
[ -f "docker-compose.yml" ] && docker compose down 2>/dev/null

# Stop standalone Docker containers (if started manually)
docker stop showcase-mongo 2>/dev/null && docker rm showcase-mongo 2>/dev/null
docker stop showcase-redis 2>/dev/null && docker rm showcase-redis 2>/dev/null
docker stop showcase-qdrant 2>/dev/null && docker rm showcase-qdrant 2>/dev/null

# Verify ports are free
for port in 3000 3001 6333 6379 8000 27017 27018; do
  if lsof -ti :$port > /dev/null 2>&1; then
    echo "WARNING: Port $port still in use"
  fi
done
```

## Port Conflict Resolution

Most lenne.tech projects hardcode port 3000 in `config.env.ts` and cannot be overridden via environment variable. When another service already occupies port 3000:

**Option A: Stop the conflicting service temporarily**
```bash
# Find what's on port 3000
lsof -ti :3000
# Stop it, start the new project, capture screenshots, then restart the original
```

**Option B: Frontend-only screenshots** (limited but non-disruptive)
```bash
# Start only the frontend on a different port
cd projects/app && npx nuxt dev --port 3002
# Screenshots will show auth/login pages but no data-driven views
```

**Option C: Use Docker with port mapping** (if docker-compose.yml exists)
```bash
# Modify the API port mapping in docker-compose.yml
# api: ports: ["3005:3000"]
docker compose up -d
```

Always prefer Option A when the user allows stopping the conflicting service.

## Error Recovery

| Error | Recovery |
|-------|----------|
| Port already in use | Show what process owns the port. Ask user before killing. |
| Docker not installed | Fall back to npm/pnpm dev server + local MongoDB |
| MongoDB not available | Start via Docker: `docker run -d --name showcase-mongo -p 27017:27017 mongo:7` |
| Lerna not found | Run `npx lerna run start --parallel` or start api + app separately |
| Server startup timeout | Capture startup logs, report error, proceed to cleanup |
| System-setup returns 403 | Database has existing users. Ask user for credentials or use existing admin. |
| External CMS unreachable | Note in SHOWCASE.md that screenshots may be incomplete. Use cached/example data if available. |
| Seed script fails | Continue without demo data; note that screenshots may show empty states |
| Screenshot capture fails | Continue with remaining features, report failures in summary |
| Cleanup fails | Warn user with exact PIDs and `kill -9` commands |

## Project-Specific Notes

### Volksbank RegioKonneX
Requires: MongoDB + Qdrant + Redis + Python NLP Service
**Best approach:** `docker compose up -d` (all services defined in compose file)
Then start api + app with `npm run start`

### Bornebusch Tool
Tauri desktop app — ignore Tauri, start only `nuxt dev` on the web port.
No backend needed (frontend-only with local file storage).

### SWF Digital
Headless CMS (Directus) — only start the Nuxt frontend.
The CMS URL is in `.env.example` and may point to a dev/staging server.

### Ontavio Email Server
Backend-only — no frontend UI. Screenshot Swagger docs and GraphQL playground.

### Libraries/Frameworks (nest-server, nuxt-extensions, cli)
Not screenshottable as applications. Create SHOWCASE.md with code-focused content instead of UI screenshots. Use architecture diagrams or terminal output screenshots if applicable.
