---
description: Execute IMPLEMENTATION_PLAN.md completely
argument-hint: [plan-file]
allowed-tools: Read, Write, Edit, Glob, Grep, Agent, Bash(docker:*), Bash(docker-compose:*), Bash(pnpm:*), Bash(npm:*), Bash(yarn:*), Bash(git:*), Bash(curl:*), mcp__plugin_lt-dev_chrome-devtools__take_screenshot, mcp__plugin_lt-dev_chrome-devtools__navigate_page, mcp__plugin_lt-dev_chrome-devtools__evaluate_script, AskUserQuestion
disable-model-invocation: true
---

# Build

## When to Use This Command

- You already have an `IMPLEMENTATION_PLAN.md` (created manually or via `/vibe:plan`)
- You want to execute the plan completely without interruption
- You've reviewed and approved the implementation plan

**Related commands:**
- `/vibe:plan` - Create a plan first (if you don't have one)
- `/vibe:build-plan` - Plan + Build in one go (no interruption)

**For higher quality (recommended):**
- Use `building-stories-with-tdd` skill for Test-Driven Development
- TDD workflow: Backend tests → Backend → Frontend E2E tests → Frontend
- TDD ensures tests exist BEFORE implementation, catching bugs early

## Description
Execute IMPLEMENTATION_PLAN.md completely.

**ABORT HANDLING:** If the user wants to cancel at any point (e.g., "abbrechen", "stop", "cancel"), acknowledge: "Build abgebrochen." and stop the process.

## Prompt
Read IMPLEMENTATION_PLAN.md and SPEC.md.

### CRITICAL: Execution Rules

1. **Follow the order** - Docker → Backend → Types → Frontend → Security Review → QA → Browser Test
2. **Docker setup first** - Hot reload, DB UI, Mailhog before any code
3. **Initial user migration** - Create test user for browser testing
4. **No mock data** - Frontend always uses real backend API
5. **Checkbox after EVERY task** - Mark `- [x]` immediately after completing each item
6. **DO NOT STOP** until all checkboxes are checked AND browser testing passes
7. **Only interrupt** for critical blockers (missing credentials, major ambiguities)

### Package Manager

Detect from lockfile (`pnpm-lock.yaml` / `yarn.lock` / `package-lock.json`).
All examples use `pnpm` notation - adapt to detected package manager.
`pnpm dlx` → `npx` / `yarn dlx`.

### Workflow

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
2. Generate: pnpm run generate-types

Phase 5: Frontend
1. Implement using ~/api-client/ types
2. Mark checkboxes after each feature

Phase 6: Security Review
1. Run /security-review for general security scan of branch diff
2. Run /lt-dev:backend:sec-review on backend changes (nest-server specific)
3. Fix any Critical/Warning findings

Phase 7: Quality Assurance
1. Run: pnpm run lint
2. Fix all lint errors
3. Run: pnpm run build
4. Fix all build errors

Phase 8: Browser Testing (Chrome MCP)
1. Navigate to http://localhost:3001
2. Take snapshot to see page
3. Login with initial user (admin@test.local / Test1234!)
4. Test each implemented feature
5. Check console: list_console_messages
6. Fix any bugs found
7. Re-test until everything works

Phase 9: Final Verification
1. All features working in browser
2. No console errors
3. Security review passed
4. Lint passes
5. Build passes
6. ALL checkboxes marked [x]
```

### Docker Commands

| Command | Purpose |
|---------|---------|
| `docker compose up -d` | Start all services |
| `docker compose logs -f api` | Watch API logs |
| `docker compose logs -f app` | Watch Frontend logs |
| `docker compose restart api` | Restart API |
| `docker compose ps` | Check running containers |

### Service URLs (Development)

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3001 |
| API | http://localhost:3000 |
| API Docs | http://localhost:3000/api |
| DB UI | http://localhost:8081 |
| Mailhog | http://localhost:8025 |

### Execution

- Work through IMPLEMENTATION_PLAN.md **sequentially**
- Build **complete features**, not stubs
- Update checkboxes in IMPLEMENTATION_PLAN.md **after each task**
- Make reasonable decisions **autonomously**
- Use `generating-nest-servers` skill for backend
- Use `developing-lt-frontend` skill for frontend

### Initial User Credentials

```
Email:    admin@test.local
Password: Test1234!
Role:     admin
```

### Browser Testing Commands (Chrome DevTools MCP)

**For direct browser testing and debugging, always use the Chrome DevTools MCP (`mcp__chrome-devtools__*`) unless the user explicitly requests otherwise.**

| Command | Purpose |
|---------|---------|
| `mcp__chrome-devtools__navigate_page` | Go to URL |
| `mcp__chrome-devtools__take_snapshot` | Get page elements |
| `mcp__chrome-devtools__fill` | Enter text in input |
| `mcp__chrome-devtools__click` | Click element |
| `mcp__chrome-devtools__list_console_messages` | Check for errors |
| `mcp__chrome-devtools__list_network_requests` | Debug API calls |

### Completion Criteria

**DO NOT STOP until:**
- All `- [ ]` in IMPLEMENTATION_PLAN.md are `- [x]`
- All features from SPEC.md are implemented
- Security review passed (`/lt-dev:backend:sec-review`)
- `pnpm run lint` passes
- `pnpm run build` passes
- Browser testing completed with Chrome MCP
- All bugs found during testing are fixed
- App works end-to-end (login → use features → logout)

**After all criteria met:** Ask the user: "Soll ich eine PR erstellen?" — If yes, create PR with `gh pr create`, then suggest running `/review` for a final PR-level check.

Ultrathink.

**START IMPLEMENTATION NOW. CONTINUE UNTIL 100% COMPLETE INCLUDING BROWSER TESTING.**

### Troubleshooting

| Problem | Lösung |
|---------|--------|
| `generate-types` fails | Check if API is running: `docker compose logs api` |
| Docker won't start | Check ports: `lsof -i :3000 -i :3001` |
| Lint errors | Run `pnpm run lint:fix` first, then re-run lint |
| Build fails | Check console output, often missing imports or type errors |
| API not responding | `docker compose restart api` and check logs |
