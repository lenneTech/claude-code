---
description: Generate Docker setup for development and production
allowed-tools: Read, Write, Edit, Glob, Grep, Agent, Bash(docker:*), Bash(docker-compose:*), Bash(curl:*), Bash(ls:*), Bash(mkdir:*), Bash(cp:*), Bash(cat:*), Bash(git:*), Bash(bash ${CLAUDE_PLUGIN_ROOT}/scripts/detect-frontend.sh:*), Bash(bash "${CLAUDE_PLUGIN_ROOT}/scripts/detect-frontend.sh":*)
disable-model-invocation: true
---

# Docker Development & Production Setup

## When to Use This Command

- Setting up a new project with Docker
- Adding Docker support to an existing project
- Configuring development environment with hot reload
- Setting up local helper services (DB, Mailhog, DB UI)

## Related Commands

| Command | Purpose |
|---------|---------|
| `/lt-dev:review` | Comprehensive code review across all quality dimensions |
| `/lt-dev:fullstack:update` | Update fullstack project dependencies |

---

## Project Context

Create a complete Docker setup for this project with the following requirements:

## Phase 1: Analysis

### Step 1: Analyze Project Structure

1. Check if this is a single-project or monorepo
2. Identify the framework (Nuxt, Next.js, SvelteKit, Express, Fastify, Hono, etc.)
3. Identify the package manager (npm, pnpm, yarn)
4. Check package.json for Node.js version and scripts
5. Identify if SSR is being used
6. Find out which ports the app(s) use
7. Check if a database is already configured (Prisma, Drizzle, TypeORM, etc.)
8. Run `bash "${CLAUDE_PLUGIN_ROOT}/scripts/detect-frontend.sh"` for the lt frontend line. On `frontend: angular`
   the app is an Angular app on `@lenne.tech/ng-base` (ng-base-starter), and section 9 of Phase 2 applies on top
   of everything else. On `nuxt`, `none` or no answer, everything below applies as written.

### Step 2: Delegate the configuration to the devops agent

With the analysis in hand, spawn `lt-dev:devops` via the `Agent` tool, passing the detected framework, package manager, ports, database, and monorepo layout. It owns this stack's infrastructure conventions and produces the artefacts Phase 2 describes: multi-stage Dockerfiles with pinned base images and non-root users, a dev compose file with hot reload and volume-based `node_modules`, a hardened production compose file, health checks, and the port conventions (API 3000, App 3001, MongoDB 27017).

It runs as an agent rather than inline because writing a Docker setup means reading a lot of the project first, and that exploration belongs in its own context rather than in this conversation.

Review its output against Phase 2 below before writing anything to disk: Phase 2 is the acceptance criteria for what the agent returns, not a second implementation of it. Phase 3 then starts the stack and validates it.

---

## Phase 2: Create Docker Setup

### 1. Multi-Stage Dockerfile(s)

- **Development Stage**: With all dev dependencies and hot-reload support
- **Production Stage**: Optimized, minimal, production dependencies only
- Node.js version from package.json or engines field
- Use BuildKit features where appropriate
- Cache npm/pnpm dependencies effectively in layers
- Non-root user in container
- Proper signal handling (tini or dumb-init if needed)
- The API's runner stage sets `ENV NODE_ENV=production`, so an image started without the variable runs as
  production and never on the `local` block of `src/config.env.ts`

### 2. Docker Compose Setup

Create two compose files:

**docker-compose.yml** (Base/Production):

- Optimized production containers
- Restart policies
- Health checks
- Network configuration
- `NODE_ENV` for the API written out (`NODE_ENV=production`) or left out for the image default, never passed
  through as `NODE_ENV=${NODE_ENV}`: a host without the variable hands the container an empty string, which
  the API refuses

**docker-compose.override.yml** (Local Development):

- Hot reload via volume mounts for source code
- node_modules in named volume (not mounted from host)
- Ports exposed for debugging
- Helper services (local only)
- The API's `environment` sets `NODE_ENV=local`: Compose merges the base file's `NODE_ENV=production` into the
  local stack, and the runner stage's image default is production too, so without this line the local API
  boots as production and stops on the missing `NSC__*` variables

### 3. Hot Reload & node_modules Handling

- Source code as bind mount for live changes
- node_modules as separate named volume to:
  - Improve performance
  - Keep platform-specific dependencies correct
- On package.json/lock changes: trigger container rebuild
- Use `pnpm install --frozen-lockfile` in container for consistent installs

### 4. Local Helper Services

Add these only in the override:

**Database** (choose based on project or PostgreSQL as default):

- PostgreSQL/MySQL/MongoDB
- Persistent volume for data
- Initialization scripts directory
- Configure health check

**Mailhog**:

- SMTP on port 1025
- Web UI on port 8025
- Configure app to use Mailhog as SMTP

**Database UI**:

- Adminer (lightweight, multi-DB) or pgAdmin (PostgreSQL-specific)
- Pre-configured connection to local DB

### 5. SSR Awareness

For SSR frameworks (Nuxt, Next.js, SvelteKit, Analog, etc.):

**Understand the Problem:**

| Context | Runs Where | Network | Does `http://api:3000` work? |
|---------|------------|---------|------------------------------|
| Server (SSR) | Docker Container | Docker Network |  Yes |
| Browser (Client) | User's Machine | Host Network |  No |

**Implement Solution - One of the following options:**

**Option A: Different URLs for Server/Client**
```yaml
environment:
  # Server-side (SSR) - Docker internal network
  NUXT_API_BASE_SERVER: http://api:3000
  # OR for Next.js (without PUBLIC prefix = server-only)
  API_URL_INTERNAL: http://api:3000
  
  # Client-side (Browser) - MUST be localhost!
  NUXT_PUBLIC_API_BASE: http://localhost:3001
  # OR for Next.js
  NEXT_PUBLIC_API_URL: http://localhost:3001
```

**Option B: Reverse Proxy (Traefik) - Recommended**

Unify everything under one URL so server and client can use the same URL:
```yaml
services:
  traefik:
    image: traefik:v3.0
    command:
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
    ports:
      - "80:80"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro

  web:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.web.rule=PathPrefix(`/`)"
      - "traefik.http.routers.web.priority=1"
      - "traefik.http.services.web.loadbalancer.server.port=3000"

  api:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.api.rule=PathPrefix(`/api`)"
      - "traefik.http.routers.api.priority=2"
      - "traefik.http.services.api.loadbalancer.server.port=3000"
```

**Option C: Built-in Proxy (Nuxt Nitro / Next.js Rewrites)**
```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  nitro: {
    devProxy: {
      '/api': {
        target: 'http://api:3000',
        changeOrigin: true
      }
    }
  },
  routeRules: {
    '/api/**': { proxy: 'http://api:3000' }
  }
})
```

Never use a single API_URL pointing to a Docker service: the browser cannot reach Docker-internal hostnames (see the table above).

### 6. Environment Handling

- `.env.example` with all required variables
- Different defaults for dev/prod
- Don't bake secrets into images
- Correctly separate SSR-specific URLs
```bash
# .env.example Template

# === Database ===
DATABASE_URL=postgresql://postgres:postgres@db:5432/app
DB_HOST=db
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=app

# === API Service ===
API_PORT=3000

# === Web/Frontend Service ===
WEB_PORT=3000

# === API URLs (SSR Setup) ===
# Server-Side (Docker internal)
API_URL_INTERNAL=http://api:3000
NUXT_API_BASE_SERVER=http://api:3000

# Client-Side (Browser) - MUST be localhost!
NUXT_PUBLIC_API_BASE=http://localhost:3001
NEXT_PUBLIC_API_URL=http://localhost:3001

# === Mail (Mailhog) ===
SMTP_HOST=mailhog
SMTP_PORT=1025
MAIL_FROM=noreply@localhost

# === Development ===
# NODE_ENV is not set here: docker-compose.override.yml sets NODE_ENV=local for the API, and a run on the
# host leaves it unset, which also means local. Every value the API gets needs a block in
# src/config.env.ts: it refuses an unknown or empty NODE_ENV (`development` has no block).
```

### 7. Additional Files

**.dockerignore:**
```
node_modules
.git
.gitignore
*.md
.env
.env.*
!.env.example
dist
.output
.nuxt
.next
coverage
.nyc_output
*.log
```

**Makefile or package.json Scripts:**
```makefile
.PHONY: dev build logs shell db-reset clean

dev:
	docker compose up -d --build

build:
	docker compose -f docker-compose.yml build

logs:
	docker compose logs -f

shell:
	docker compose exec app sh

db-reset:
	docker compose down -v
	docker compose up -d db
	sleep 5
	docker compose exec app pnpm run db:migrate

clean:
	docker compose down -v --remove-orphans
	docker system prune -f
```

### 8. Documentation

Create a `DOCKER.md` with:

- Quick start guide
- Architecture explanation
- Service URLs and ports
- Common problems & solutions
- How to add new services

### 9. Angular Apps (ng-base-starter)

Only on `frontend: angular` from Phase 1, step 8. Pass the answer to the `lt-dev:devops` agent together with the
rest of the analysis. The sections above stay the acceptance criteria; this one replaces their Nuxt-specific
examples for the app service.

- **Production image:** ng-base-starter ships a multi-stage `Dockerfile` (deps, builder, runner on a digest-pinned
  `node:24-alpine`, non-root `nodejs` user, `HEALTHCHECK` with busybox `wget` on `http://127.0.0.1:3000/`,
  `CMD ["node", ".output/server/index.mjs"]`). Keep it instead of writing another one. It builds standalone
  (`APP_DIR=.`) and in a monorepo from the repository root (`--build-arg APP_DIR=projects/app`), and it takes the
  commit as `APP_VERSION_COMMIT`; the lt-monorepo `docker-compose.yml` already passes both.
- **Ports:** the built server listens on `PORT` (3000 in the image); a local compose file maps host 3001 to
  container 3000, so the app keeps the port the API trusts (`http://localhost:3001`; another origin fails 2FA and passkeys with
  `403 INVALID_ORIGIN`).
- **Runtime config, never build args:** the SSR server reads every `NG_*` value at request time and writes the
  public ones into the page, so one image serves every stage. The SSR side reaches the API as
  `NG_API_URL=http://api:3000` (never sent to the browser), the browser as `NG_PUBLIC_API_URL` on the host
  (`http://localhost:3000`). With `NG_PUBLIC_API_PROXY=true` the server proxies `/api/*` to `NG_API_URL` instead
  (the counterpart of Option C); set it to `false` when the browser calls the API directly.
- **Host guard:** Angular's SSR engine answers `400 Bad Request` to every `Host` it does not know. `angular.json`
  allows `localhost`, `127.0.0.1` and `*.localhost`; any other host comes from `NG_PUBLIC_SITE_URL` (required
  outside local) or the comma-separated `NG_ALLOWED_HOSTS`.
- **Dev service with hot reload:** `pnpm run dev` (`scripts/dev.mjs`) runs `ng serve` on `PORT` (default 3001) and
  `HOST`; inside a container it needs `HOST=0.0.0.0` (the starter's `start:extern` script). It refuses a busy port
  instead of moving to another one, and it loads `.env` when present.
- **`.dockerignore`:** add `**/.angular` and `**/.output*` next to the list in section 7. Docker reads only the
  file at the build context root, so in a monorepo the root file counts and every pattern needs the `**/` prefix;
  ng-base-starter's own `.dockerignore` shows the full list.
- **Checks in Phase 3:** the runner image has no `curl`, so the SSR check runs
  `wget -qO- http://api:3000/health-check` inside the app container. The API's `NODE_ENV` rules from sections 1, 2 and 6 apply unchanged.

| Symptom | Cause | Fix |
|---------|-------|-----|
| App answers `400 Bad Request` for its domain, the container is healthy | Host not in the SSR engine's allowed hosts | Set `NG_PUBLIC_SITE_URL` to the site URL, or add the host to `NG_ALLOWED_HOSTS` |
| `[@lenne.tech/ng-base] No API URL configured` in the logs | `NG_PUBLIC_API_URL` (browser) or `NG_API_URL` (SSR) missing | Set both on the app service |
| `dev: port 3001 is already in use` | Another process holds the dev port | Free the port; never move the app to another one |

---

## Phase 3: Startup & Validation

### Step 1: Prepare Environment
```bash
# Create .env from .env.example if not present
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi
```

### Step 2: Start Docker Setup
```bash
# Stop and remove old containers and volumes
docker compose down -v --remove-orphans

# Build and start fresh
docker compose build --no-cache
docker compose up -d
```

### Step 3: Wait for Startup
```bash
# Wait for containers to start
echo "Waiting for containers to start..."
sleep 15

# Check container status
docker compose ps
```

### Step 4: Analyze Logs
```bash
# Check logs of all services
docker compose logs --tail=200
```

**Check for the following patterns:**

 Success:
- "listening on port"
- "ready in"
- "server started"
- "database connection established"
- "connected to"

 Errors:
- "ECONNREFUSED"
- "connection refused"
- "Module not found"
- "Cannot find module"
- "Permission denied"
- "EACCES"
- "port already in use"
- "EADDRINUSE"
- "error"
- "failed"
- "exited with code"

### Step 5: Run Health Checks
```bash
echo "=== Health Checks ==="

# App/Frontend
if curl -sf http://localhost:3000 > /dev/null 2>&1; then
  echo " Frontend reachable (localhost:3000)"
else
  echo " Frontend NOT reachable"
fi

# API (if separate service)
if curl -sf http://localhost:3001/health > /dev/null 2>&1 || curl -sf http://localhost:3001 > /dev/null 2>&1; then
  echo " API reachable (localhost:3001)"
else
  echo "  API not on localhost:3001 (maybe different port or integrated)"
fi

# Database UI (Adminer)
if curl -sf http://localhost:8080 > /dev/null 2>&1; then
  echo " DB UI reachable (localhost:8080)"
else
  echo " DB UI NOT reachable"
fi

# Mailhog
if curl -sf http://localhost:8025 > /dev/null 2>&1; then
  echo " Mailhog reachable (localhost:8025)"
else
  echo " Mailhog NOT reachable"
fi

# Database Connection Check
if docker compose exec -T db pg_isready -U postgres > /dev/null 2>&1; then
  echo " PostgreSQL ready"
else
  echo " PostgreSQL NOT ready"
fi
```

### Step 6: SSR-Specific Checks (if SSR framework)
```bash
echo "=== SSR Checks ==="

# Server-to-API connection (inside container)
if docker compose exec -T web curl -sf http://api:3000/health > /dev/null 2>&1; then
  echo " SSR -> API connection OK (Docker internal)"
else
  echo "  Check SSR -> API connection"
fi

# Check that no Docker-internal URLs end up in client bundle
if docker compose exec -T web sh -c 'find .output .next dist -name "*.js" 2>/dev/null | head -20 | xargs grep -l "api:3000" 2>/dev/null'; then
  echo " WARNING: 'api:3000' found in client bundle! SSR URLs misconfigured."
else
  echo " No Docker-internal URLs in client bundle"
fi
```

---

## Phase 4: Error Analysis & Auto-Fix

### Iterative Fix Loop

When errors are found, analyze and fix them:
```
WHILE errors exist AND attempts < 5:
    1. Identify the specific error from logs/health checks
    2. Determine the cause (see table below)
    3. Apply the appropriate fix
    4. Restart affected services: docker compose up -d --build <service>
    5. Wait for startup (sleep 10-15)
    6. Run health checks again
    7. attempts++
```

### Error Diagnosis Table

| Symptom | Cause | Fix |
|---------|-------|-----|
| Container won't start | Missing env vars | Check/complete `.env` file |
| API exits: `NODE_ENV='<x>' has no block in src/config.env.ts` | `NODE_ENV` names an environment the config does not know (`development`) | Leave it unset locally, use a known block name, or add a block |
| API exits: `NODE_ENV is set but empty` | `NODE_ENV=${NODE_ENV}` in compose on a host without the variable | Write the value, or remove the key |
| Container won't start | Syntax error in code | Check logs, fix code |
| Container crash loop | Wrong Node version | Adjust Node version in Dockerfile |
| "Module not found" | node_modules problem | Delete volume, rebuild |
| "EADDRINUSE" / Port in use | Port already used | Change port in compose |
| "ECONNREFUSED" to DB | DB not ready yet | Add depends_on + healthcheck |
| "ECONNREFUSED api:3000" in browser | SSR URL problem | Change client URL to localhost |
| API works in SSR, not in browser | Wrong PUBLIC env var | Use NUXT_PUBLIC_* / NEXT_PUBLIC_* |
| Permission denied | User/permissions wrong | Adjust Dockerfile user |
| CORS errors in browser | API CORS not configured | Add CORS headers or use proxy |

### Specific Fixes

**node_modules Problem:**
```bash
# Identify and delete volume
docker compose down
docker volume ls | grep node_modules
docker volume rm <volume_name>
docker compose up -d --build
```

**DB Connection Timing:**
```yaml
# docker-compose.yml - add healthcheck
services:
  db:
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  app:
    depends_on:
      db:
        condition: service_healthy
```

**SSR URL Fix:**
```yaml
# Wrong:
environment:
  API_URL: http://api:3000

# Correct:
environment:
  NUXT_API_BASE_SERVER: http://api:3000      # Server
  NUXT_PUBLIC_API_BASE: http://localhost:3001 # Client
```

---

## Phase 5: Final Validation & Output

### Successful Completion

When all checks pass, output the following summary:
```
╔══════════════════════════════════════════════════════════════╗
║                 Docker Setup Successful!                     ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  Container Status:                                           ║
║  ├── app/web      Running                                  ║
║  ├── api          Running (if separate service)            ║
║  ├── db           Running                                  ║
║  ├── adminer      Running                                  ║
║  └── mailhog      Running                                  ║
║                                                              ║
║  Available Services:                                         ║
║  ├── Frontend:    http://localhost:3000                      ║
║  ├── API:         http://localhost:3001 (if separate)        ║
║  ├── DB UI:       http://localhost:8080                      ║
║  │   └── Login:   postgres / postgres / app                  ║
║  └── Mailhog:     http://localhost:8025                      ║
║                                                              ║
║  Commands:                                                   ║
║  ├── Logs:        docker compose logs -f                     ║
║  ├── Stop:        docker compose down                        ║
║  ├── Rebuild:     docker compose up -d --build               ║
║  └── Shell:       docker compose exec app sh                 ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
```

### List Created Files

List all created/modified files:

- `Dockerfile`
- `docker-compose.yml`
- `docker-compose.override.yml`
- `.dockerignore`
- `.env.example`
- `.env` (copied from example)
- `DOCKER.md`
- `Makefile` (optional)

### If Fixes Were Necessary

Document what was fixed:
```
Fixed Issues:
1. [Problem]: API URL in client bundle was Docker-internal
   [Fix]: Set NUXT_PUBLIC_API_BASE to localhost:3001
   
2. [Problem]: Container started before DB was ready
   [Fix]: Added healthcheck and depends_on condition
```

---

## Important Notes

1. **Test Hot Reload**: After setup, make a small change and verify it's picked up live
2. **node_modules Sync**: On package.json changes, always run `docker compose up -d --build`
3. **Volumes on Problems**: If problems persist, `docker compose down -v` (removes the volumes, including local DB data) and restart fresh
4. **SSR Debug**: For API issues, check both the browser console and the server logs