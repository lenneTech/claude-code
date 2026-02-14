---
description: Plan + Build in one go (no interruption)
argument-hint: [spec-file]
---

# Full Build (Plan + Build in One Go)

## When to Use This Command

- You have a `SPEC.md` and want complete implementation without interruption
- You trust the automated planning and don't need to review before execution
- You want the fastest path from spec to working implementation

**Related commands:**
- `/vibe:plan` - Create plan only (for review before execution)
- `/vibe:build` - Execute existing plan only

**For higher quality (recommended):**
- Use `building-stories-with-tdd` skill for Test-Driven Development
- TDD workflow: Backend tests → Backend → Frontend E2E tests → Frontend
- TDD ensures comprehensive test coverage and catches bugs early

## Description
Plan + Build in one go (no interruption).

**ABORT HANDLING:** If the user wants to cancel at any point (e.g., "abbrechen", "stop", "cancel"), acknowledge: "Build abgebrochen." and stop the process.

## Prompt

### Prerequisites

1. **Check SPEC.md exists**
   - If SPEC.md is missing, ask: "Keine SPEC.md gefunden. Soll ich helfen eine zu erstellen, oder einen anderen Dateinamen verwenden?"

Complete implementation of SPEC.md from scratch.

### STEP 1: PLANNING

Read SPEC.md deeply and create **IMPLEMENTATION_PLAN.md**.

#### CRITICAL: Implementation Order

**ALWAYS follow this sequence:**
1. **Docker setup first** - Hot reload, DB UI, Mailhog
2. **Backend second** - Models, Services, Controllers + Initial User
3. **Generate types** - `npm run generate-types`
4. **Frontend** - Using generated types, NO mock data
5. **Quality Assurance** - Lint + Build must pass
6. **Browser Testing** - Test with Chrome MCP using initial user

#### Package Manager

Detect from lockfile (`pnpm-lock.yaml` / `yarn.lock` / `package-lock.json`).
All examples use `npm` notation - adapt to detected package manager.
`npx` → `pnpm dlx` / `yarn dlx`.

**All development runs in Docker!**

#### Docker Check

If no `docker-compose.yml` exists in the project:
- Ask: "Kein Docker-Setup gefunden. Soll ich eines erstellen, oder möchtest du ohne Docker entwickeln?"
- If user chooses non-Docker: Skip Docker phases, use local `npm run dev` commands instead

#### Plan Structure (with checkboxes!)

```markdown
# Implementation Plan

## Phase 1: Docker Setup
- [ ] Create docker-compose.yml with hot reload
- [ ] API service (NestJS with volume mounts)
- [ ] Database service (MongoDB/PostgreSQL)
- [ ] DB UI (Mongo Express for MongoDB / Adminer for SQL)
- [ ] Mailhog for email testing
- [ ] Frontend service (Nuxt with hot reload)
- [ ] Verify all services start (`docker compose up -d`)

## Phase 2: Backend Foundation
- [ ] Database models
- [ ] Core services
- [ ] Controllers & endpoints
- [ ] Initial user migration (admin@test.local / Test1234!)

## Phase 3: Backend Features
- [ ] Feature A - Backend
- [ ] Feature B - Backend

## Phase 4: Types Generation
- [ ] Verify API running (`docker compose logs api`)
- [ ] Generate types (`npm run generate-types`)

## Phase 5: Frontend Integration
- [ ] Feature A - Frontend (with real API)
- [ ] Feature B - Frontend (with real API)

## Phase 6: Quality Assurance
- [ ] Run lint (`npm run lint`)
- [ ] Fix lint errors
- [ ] Run build (`npm run build`)
- [ ] Fix build errors

## Phase 7: Browser Testing (Chrome MCP)
- [ ] Open app (http://localhost:3001)
- [ ] Login with initial user
- [ ] Test all features
- [ ] Fix discovered bugs
- [ ] Re-test after fixes

## Phase 8: Final Verification
- [ ] All features working
- [ ] No console errors
- [ ] Lint passes
- [ ] Build passes
```

#### Docker Services Required

| Service | Port | Purpose |
|---------|------|---------|
| api | 3000 | NestJS Backend (hot reload) |
| app | 3001 | Nuxt Frontend (hot reload) |
| db | 27017/5432 | MongoDB or PostgreSQL |
| db-ui | 8081 | Mongo Express or Adminer |
| mailhog | 1025/8025 | SMTP + Web UI for emails |

Include: Architecture decisions, file structure, edge cases, testing strategy.

Ultrathink: What's the cleanest, most maintainable way to build this?

---

### STEP 2: EXECUTION

#### CRITICAL: Execution Rules

1. **Follow the order** - Docker → Backend → Types → Frontend → QA → Browser Test
2. **Docker setup first** - Hot reload, DB UI, Mailhog before any code
3. **Initial user migration** - Create test user for browser testing
4. **No mock data** - Frontend always uses real backend API
5. **Checkbox after EVERY task** - Mark `- [x]` immediately after completing
6. **DO NOT STOP** until all checkboxes are checked AND browser testing passes

#### Package Manager

Detect from lockfile (`pnpm-lock.yaml` / `yarn.lock` / `package-lock.json`).
All examples use `npm` notation - adapt to detected package manager.
`npx` → `pnpm dlx` / `yarn dlx`.

#### Workflow

```
Phase 1: Docker Setup
1. Create docker-compose.yml with all services
2. Verify: docker compose up -d && docker compose ps

Phase 2-3: Backend
1. Implement backend (models, services, controllers)
2. Create initial user migration (admin@test.local / Test1234!)
3. Docker rebuilds automatically (hot reload)
4. Mark checkboxes after each feature

Phase 4: Types
1. Verify API: docker compose logs api
2. Generate: npm run generate-types

Phase 5: Frontend
1. Implement using ~/api-client/ types
2. Mark checkboxes after each feature

Phase 6: Quality Assurance
1. Run: npm run lint
2. Fix all lint errors
3. Run: npm run build
4. Fix all build errors

Phase 7: Browser Testing (Chrome MCP)
1. Navigate to http://localhost:3001
2. Take snapshot to see page
3. Login with initial user (admin@test.local / Test1234!)
4. Test each implemented feature
5. Check console: list_console_messages
6. Fix any bugs found
7. Re-test until everything works

Phase 8: Final Verification
1. All features working in browser
2. No console errors
3. Lint passes
4. Build passes
5. ALL checkboxes marked [x]
```

#### Docker Commands

| Command | Purpose |
|---------|---------|
| `docker compose up -d` | Start all services |
| `docker compose logs -f api` | Watch API logs |
| `docker compose logs -f app` | Watch Frontend logs |
| `docker compose restart api` | Restart API |
| `docker compose ps` | Check running containers |

#### Service URLs (Development)

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3001 |
| API | http://localhost:3000 |
| API Docs | http://localhost:3000/api |
| DB UI | http://localhost:8081 |
| Mailhog | http://localhost:8025 |

#### Execution

- Work through phases **sequentially**
- Build **complete features**, not stubs
- Update IMPLEMENTATION_PLAN.md checkboxes **after each task**
- Use `generating-nest-servers` skill for backend
- Use `developing-lt-frontend` skill for frontend
- Make smart decisions **autonomously**

#### Initial User Credentials

```
Email:    admin@test.local
Password: Test1234!
Role:     admin
```

#### Browser Testing Commands (Chrome DevTools MCP)

**For direct browser testing and debugging, always use the Chrome DevTools MCP (`mcp__chrome-devtools__*`) unless the user explicitly requests otherwise.**

| Command | Purpose |
|---------|---------|
| `mcp__chrome-devtools__navigate_page` | Go to URL |
| `mcp__chrome-devtools__take_snapshot` | Get page elements |
| `mcp__chrome-devtools__fill` | Enter text in input |
| `mcp__chrome-devtools__click` | Click element |
| `mcp__chrome-devtools__list_console_messages` | Check for errors |
| `mcp__chrome-devtools__list_network_requests` | Debug API calls |

#### Completion Criteria

**DO NOT STOP until:**
- All `- [ ]` in IMPLEMENTATION_PLAN.md are `- [x]`
- All features from SPEC.md are implemented
- `npm run lint` passes
- `npm run build` passes
- Browser testing completed with Chrome MCP
- All bugs found during testing are fixed
- App works end-to-end (login → use features → logout)

Only interrupt for critical blockers.

**BEGIN PLANNING NOW. THEN EXECUTE UNTIL 100% COMPLETE INCLUDING BROWSER TESTING.**

### Troubleshooting

| Problem | Lösung |
|---------|--------|
| `generate-types` fails | Check if API is running: `docker compose logs api` |
| Docker won't start | Check ports: `lsof -i :3000 -i :3001` |
| Lint errors | Run `npm run lint:fix` first, then re-run lint |
| Build fails | Check console output, often missing imports or type errors |
| API not responding | `docker compose restart api` and check logs |
