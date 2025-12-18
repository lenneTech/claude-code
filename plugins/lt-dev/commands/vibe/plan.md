---
description: Create detailed implementation plan from SPEC.md
argument-hint: [spec-file]
---

# Plan

## When to Use This Command

- You have a `SPEC.md` with feature requirements
- You want to create a detailed implementation plan before coding
- You need to review and approve the plan before execution
- Use `/vibe:build` afterwards to execute the plan

**Related commands:**
- `/vibe:build` - Execute an existing IMPLEMENTATION_PLAN.md
- `/vibe:build-plan` - Plan + Build in one go (no interruption)

## Description
Create detailed implementation plan from SPEC.md.

**ABORT HANDLING:** If the user wants to cancel at any point (e.g., "abbrechen", "stop", "cancel"), acknowledge: "Planning abgebrochen." and stop the process.

## Prompt

### Prerequisites

1. **Check SPEC.md exists**
   - If SPEC.md is missing, ask: "Keine SPEC.md gefunden. Soll ich helfen eine zu erstellen, oder einen anderen Dateinamen verwenden?"

Read SPEC.md and create a comprehensive implementation plan.

### CRITICAL: Implementation Order

**ALWAYS follow this sequence for each feature:**
1. **Backend first** - Models, Services, Controllers
2. **Start Docker** - `docker compose up -d` (API + DB)
3. **Generate types** - `npm run generate-types`
4. **Frontend last** - Using generated types, NO mock data

**All development runs in Docker!**

### Docker Check

If no `docker-compose.yml` exists in the project:
- Ask: "Kein Docker-Setup gefunden. Soll ich eines erstellen, oder möchtest du ohne Docker entwickeln?"
- If user chooses non-Docker: Skip Docker phases, use local `npm run dev` commands instead

### Plan Structure

Create **IMPLEMENTATION_PLAN.md** with checkboxes:

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
- [ ] Initial user migration (for testing login)

## Phase 3: Backend Features
- [ ] Feature A - Backend
- [ ] Feature B - Backend
- [ ] ...

## Phase 4: Types Generation
- [ ] Verify API running (`docker compose logs api`)
- [ ] Generate types (`npm run generate-types`)

## Phase 5: Frontend Integration
- [ ] Feature A - Frontend (with real API)
- [ ] Feature B - Frontend (with real API)
- [ ] ...

## Phase 6: Quality Assurance
- [ ] Run lint (`npm run lint`)
- [ ] Fix lint errors
- [ ] Run build (`npm run build`)
- [ ] Fix build errors

## Phase 7: Browser Testing (Chrome MCP)
- [ ] Open app in browser (http://localhost:3001)
- [ ] Login with initial user
- [ ] Test all implemented features
- [ ] Fix any discovered bugs
- [ ] Re-test after fixes

## Phase 8: Final Verification
- [ ] All features working
- [ ] No console errors
- [ ] Lint passes
- [ ] Build passes
```

### Docker Services Required

| Service | Port | Purpose |
|---------|------|---------|
| api | 3000 | NestJS Backend (hot reload) |
| app | 3001 | Nuxt Frontend (hot reload) |
| db | 27017/5432 | MongoDB or PostgreSQL |
| db-ui | 8081 | Mongo Express or Adminer |
| mailhog | 1025/8025 | SMTP + Web UI for emails |

### Initial User (for Testing)

Create a migration/seed that creates an initial user:

```typescript
// Example initial user
{
  email: 'admin@test.local',
  password: 'Test1234!',
  role: 'admin'
}
```

**Document credentials in IMPLEMENTATION_PLAN.md** for browser testing.

### Browser Testing with Chrome MCP

After all features are implemented:

1. **Navigate** to http://localhost:3001
2. **Take snapshot** to see current page
3. **Login** with initial user credentials
4. **Test each feature** - click, fill forms, verify results
5. **Check console** for errors (`list_console_messages`)
6. **Fix bugs** discovered during testing
7. **Re-test** until everything works

### Requirements

1. **Docker setup first** - Hot reload, DB UI, Mailhog
2. **Initial user migration** - For browser testing
3. **Architecture & Tech Stack** decisions with rationale
4. **File/folder structure** for both backend and frontend
5. **Implementation phases** with explicit Docker → Backend → Types → Frontend → Test order
6. **Every task as checkbox** `- [ ]` for tracking
7. **No mock data** - Frontend always connects to real backend
8. **Browser testing** - Test with Chrome MCP after implementation
9. **Quality gates** - Lint and build must pass

Ultrathink. Be thorough - this planning will guide the entire build.

Save as **IMPLEMENTATION_PLAN.md**

### Troubleshooting

| Problem | Lösung |
|---------|--------|
| `generate-types` fails | Check if API is running: `docker compose logs api` |
| Docker won't start | Check ports: `lsof -i :3000 -i :3001` |
| Lint errors | Run `npm run lint:fix` first, then re-run lint |
| Build fails | Check console output, often missing imports or type errors |
| API not responding | `docker compose restart api` and check logs |
