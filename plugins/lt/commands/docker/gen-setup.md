---
description: Generate Docker setup for development and production
---

# Docker Development & Production Setup

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

### 2. Docker Compose Setup

Create two compose files:

**docker-compose.yml** (Base/Production):

- Optimized production containers
- Restart policies
- Health checks
- Network configuration

**docker-compose.override.yml** (Local Development):

- Hot reload via volume mounts for source code
- node_modules in named volume (not mounted from host)
- Ports exposed for debugging
- Helper services (local only)

### 3. Hot Reload & node_modules Handling

- Source code as bind mount for live changes
- node_modules as separate named volume to:
  - Improve performance
  - Keep platform-specific dependencies correct
- On package.json/lock changes: trigger container rebuild
- Use `npm ci` in container for consistent installs

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

### 5. SSR Awareness (CRITICAL!)

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

**NEVER use a single API_URL pointing to a Docker service!**

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
NODE_ENV=development
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
	docker compose exec app npm run db:migrate

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
3. **Volumes on Problems**: When in doubt, `docker compose down -v` and restart fresh
4. **SSR Debug**: For API issues, always check BOTH browser console AND server logs