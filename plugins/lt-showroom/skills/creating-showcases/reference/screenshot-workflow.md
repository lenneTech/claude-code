# Screenshot Workflow — 7-Phase Guide

This document details the complete screenshot capture workflow for the `screenshot-generator` agent and the `/showroom:screenshot` command.

## Overview

Screenshots are captured by running the project locally, injecting demo data, and using the Chrome DevTools MCP to take full-page and viewport captures at three breakpoints.

## Phase 1: Project Detection

### Detect Package Manager

```bash
[ -f "pnpm-lock.yaml" ] && PM="pnpm"
[ -f "yarn.lock" ] && PM="yarn"
[ -f "package-lock.json" ] && PM="npm"
```

### Detect Dev Port

Check in order:
1. `.env` or `.env.local` for `PORT=` or `NUXT_PORT=` or `VITE_PORT=`
2. `nuxt.config.ts` for `devServer: { port: ... }`
3. `vite.config.ts` for `server: { port: ... }`
4. `next.config.js` for custom port (default: 3000)
5. `nest-cli.json` or `main.ts` for `app.listen(PORT)` (NestJS default: 3000)
6. Fall back to `3000` if not found

### Detect Seed Script

Check `package.json` scripts for: `seed`, `db:seed`, `demo`, `fixtures`, `populate`

### Detect Framework-Specific Start Command

| Framework | Dev Command |
|-----------|-------------|
| Nuxt | `nuxt dev` / `pnpm run dev` |
| Next.js | `next dev` / `pnpm run dev` |
| NestJS | `nest start --watch` / `pnpm run dev` |
| Vite | `vite` / `pnpm run dev` |
| Generic | Use `dev` script from `package.json` |

## Phase 2: Setup

```bash
# Check if dependencies are installed
[ -d "node_modules" ] || ${PM} install

# Check if port is free
lsof -ti :${PORT}
# If occupied, identify the process and ask user before killing
```

## Phase 3: Start Project

Start with `run_in_background: true`. Then poll for readiness:

```bash
# Poll until HTTP 200 or 30s timeout
for i in $(seq 1 15); do
  curl -s -o /dev/null -w "%{http_code}" http://localhost:${PORT} | grep -q "200\|301\|302" && break
  sleep 2
done
```

If the server does not respond after 15 attempts (30 seconds), report the failure and skip to Phase 7 (cleanup).

## Phase 4: Demo Data

### Option A: Seed Script Exists

```bash
${PM} run seed
```

### Option B: No Seed Script — Manual via Chrome DevTools

If the project has authentication, first log in. Look for default credentials in:
- `README.md`
- `.env.example` (admin email/password)
- Seed-related comments in `main.ts` or `app.module.ts`

If no credentials are documented, create a test account via the registration flow.

Then create representative demo content:
- 2-3 representative records (not lorem ipsum — use realistic names and content)
- At least one record per major entity type

## Phase 5: Screenshots

### Viewport Definitions

| Viewport | Width | Height |
|----------|-------|--------|
| desktop | 1440 | 900 |
| tablet | 768 | 1024 |
| mobile | 390 | 844 |

### Pages to Capture

Prioritize in this order:

1. **Landing / home** — `http://localhost:${PORT}/`
2. **Primary feature** — Dashboard, list view, or main workflow (auth required)
3. **Detail view** — Item detail, profile, or settings (if applicable)
4. **Dark mode** — Same as landing page but with dark mode toggled (if supported)

### Capture Process per Page

For each page at each viewport:

1. Set viewport size via Chrome DevTools MCP
2. Navigate to the URL
3. Wait 1500ms for animations and data to settle
4. Dismiss any modals or onboarding overlays if present
5. Take full-page screenshot
6. Take viewport (above-the-fold) screenshot
7. Name files: `{page}-{viewport}-full.png` and `{page}-{viewport}-viewport.png`

### Filename Convention

```
home-desktop-full.png
home-desktop-viewport.png
home-tablet-full.png
home-mobile-full.png
dashboard-desktop-full.png
...
```

## Phase 6: Upload

For each screenshot file:

1. Use `upload_screenshot` MCP tool from `showroom-api`
2. Provide: `showcaseId`, `viewport`, `page`, `width`, `height`
3. Confirm HTTP 201 response for each upload
4. Track which uploads succeeded vs. failed

If all uploads fail (e.g., API unreachable), save files to `./screenshots/` in the project directory and inform the user.

## Phase 7: Cleanup

**Always run cleanup, even if earlier phases failed.**

```bash
# Stop the dev server by process name
pkill -f "nuxt dev"        # Nuxt
pkill -f "next dev"        # Next.js
pkill -f "nest start"      # NestJS
pkill -f "vite"            # Vite

# Verify port is free
lsof -ti :${PORT}
# If still occupied: kill -9 $(lsof -ti :${PORT})
```

Report cleanup status. If orphaned processes remain, provide the user with exact kill commands.

## Error Recovery

| Error | Recovery |
|-------|----------|
| Port already in use | Ask user before killing. Show what process owns the port. |
| Server startup timeout | Capture startup logs, report error, proceed to cleanup |
| Screenshot capture fails | Continue with remaining pages/viewports, report failures in summary |
| Upload fails | Save locally, report paths |
| Seed fails | Continue without demo data, note that screenshots may show empty state |
