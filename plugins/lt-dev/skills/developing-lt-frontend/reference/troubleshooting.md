# Troubleshooting & Error Recovery

## Table of Contents

- [Type Generation Fails](#type-generation-fails)
- [API Won't Start](#api-wont-start)
- [Frontend Build Fails](#frontend-build-fails)
- [Console Errors in Browser](#console-errors-in-browser)
- [Missing Generated Types](#missing-generated-types)

---

## Type Generation Fails

```
┌────────────────────────────────────────────────────────────────┐
│  npm run generate-types fails?                                 │
│                                                                │
│  1. CHECK if API is actually running:                          │
│     curl -s http://localhost:3000/api                          │
│                                                                │
│  2. CHECK API logs for errors:                                 │
│     docker compose logs api --tail=50                          │
│     OR: Check terminal where API is running                    │
│                                                                │
│  3. COMMON FIXES:                                              │
│     - API not started → Start it first                         │
│     - API crashed → Check logs, fix error, restart             │
│     - Wrong URL → Check openapi-ts.config.ts for correct URL   │
│     - Network issue → Ensure localhost:3000 is accessible      │
│                                                                │
│  4. RETRY after fixing the issue                               │
└────────────────────────────────────────────────────────────────┘
```

---

## API Won't Start

```
┌────────────────────────────────────────────────────────────────┐
│  API won't start on Port 3000?                                 │
│                                                                │
│  1. CHECK if port is already in use:                           │
│     lsof -i :3000                                              │
│                                                                │
│  2. IF port in use by old process:                             │
│     kill $(lsof -t -i :3000)                                   │
│                                                                │
│  3. CHECK for TypeScript/Build errors:                         │
│     cd projects/api && npm run build                           │
│                                                                │
│  4. CHECK environment:                                         │
│     - MongoDB running? (check docker compose ps)               │
│     - .env file exists with correct values?                    │
│                                                                │
│  5. RESTART cleanly:                                           │
│     cd projects/api && npm run start:dev                       │
└────────────────────────────────────────────────────────────────┘
```

---

## Frontend Build Fails

```
┌────────────────────────────────────────────────────────────────┐
│  Frontend build/dev fails?                                     │
│                                                                │
│  1. CHECK for TypeScript errors:                               │
│     npm run typecheck (or check terminal output)               │
│                                                                │
│  2. COMMON ISSUES:                                             │
│     - Missing types → Run npm run generate-types               │
│     - Import errors → Check file paths and exports             │
│     - Nuxt module errors → Check nuxt.config.ts                │
│                                                                │
│  3. CLEAR CACHE if weird errors:                               │
│     rm -rf .nuxt .output node_modules/.cache                   │
│     npm run dev                                                │
│                                                                │
│  4. CHECK dependencies:                                        │
│     npm install (in case packages missing)                     │
└────────────────────────────────────────────────────────────────┘
```

---

## Console Errors in Browser

```
┌────────────────────────────────────────────────────────────────┐
│  JavaScript errors in browser console?                         │
│                                                                │
│  1. GET error details (use Chrome DevTools MCP for debugging):   │
│     mcp__chrome-devtools__list_console_messages(types: error)   │
│                                                                │
│  2. COMMON CAUSES:                                             │
│     - API call failed → Check network requests                 │
│     - Undefined property → Check null/undefined handling       │
│     - Missing composable → Check imports and auto-imports      │
│     - Hydration mismatch → Check SSR compatibility             │
│                                                                │
│  3. FIX before proceeding to next feature!                     │
└────────────────────────────────────────────────────────────────┘
```

---

## Missing Generated Types

**If `types.gen.ts` or `sdk.gen.ts` are missing or outdated:**

```
┌─────────────────────────────────────────────────────────────┐
│  types.gen.ts missing or outdated?                          │
│                                                             │
│  1. ASK USER: "Die generierten Types fehlen oder sind       │
│     veraltet. Läuft die Backend-API unter                   │
│     http://localhost:3000?"                                 │
│                                                             │
│  2. IF API RUNNING:                                         │
│     → Run: npm run generate-types                           │
│     → Wait for completion                                   │
│     → Continue with generated types                         │
│                                                             │
│  3. IF API NOT RUNNING:                                     │
│     → Ask user to start API first:                          │
│       "Bitte starte die API mit: cd projects/api &&         │
│        npm run start:dev"                                   │
│     → Wait for user confirmation                            │
│     → Then run: npm run generate-types                      │
│                                                             │
│  ❌ NEVER create manual interfaces as workaround!           │
│  ❌ NEVER skip this workflow!                               │
│  ❌ NEVER say "I'll create interfaces manually"             │
└─────────────────────────────────────────────────────────────┘
```

**Why this matters:**
- Manual interfaces get out of sync with backend
- Generated types include all validation rules
- SDK functions have correct parameter types
- Prevents runtime type mismatches

---

## Quick Commands Reference

```bash
# Check if API is running
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api

# Check if port is in use
lsof -i :3000
lsof -i :3001

# Kill process on port
kill $(lsof -t -i :3000)

# Clear Nuxt cache
rm -rf .nuxt .output node_modules/.cache

# Regenerate types
npm run generate-types

# Check Docker containers
docker compose ps
docker compose logs api --tail=50
```
