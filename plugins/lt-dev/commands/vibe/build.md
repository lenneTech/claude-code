---
description: Execute IMPLEMENTATION_PLAN.md completely
---

# Build

## Description
Execute IMPLEMENTATION_PLAN.md completely.

**ABORT HANDLING:** If the user wants to cancel at any point (e.g., "abbrechen", "stop", "cancel"), acknowledge: "Build abgebrochen." and stop the process.

## Prompt
Read IMPLEMENTATION_PLAN.md and SPEC.md.

### CRITICAL: Execution Rules

1. **Follow the order** - Docker → Backend → Types → Frontend → QA → Browser Test
2. **Docker setup first** - Hot reload, DB UI, Mailhog before any code
3. **Initial user migration** - Create test user for browser testing
4. **No mock data** - Frontend always uses real backend API
5. **Checkbox after EVERY task** - Mark `- [x]` immediately after completing each item
6. **DO NOT STOP** until all checkboxes are checked AND browser testing passes
7. **Only interrupt** for critical blockers (missing credentials, major ambiguities)

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

### Browser Testing Commands (Chrome MCP)

| Command | Purpose |
|---------|---------|
| `navigate_page` | Go to URL |
| `take_snapshot` | Get page elements |
| `fill` | Enter text in input |
| `click` | Click element |
| `list_console_messages` | Check for errors |
| `list_network_requests` | Debug API calls |

### Completion Criteria

**DO NOT STOP until:**
- All `- [ ]` in IMPLEMENTATION_PLAN.md are `- [x]`
- All features from SPEC.md are implemented
- `npm run lint` passes
- `npm run build` passes
- Browser testing completed with Chrome MCP
- All bugs found during testing are fixed
- App works end-to-end (login → use features → logout)

Ultrathink.

**START IMPLEMENTATION NOW. CONTINUE UNTIL 100% COMPLETE INCLUDING BROWSER TESTING.**

### Troubleshooting

| Problem | Lösung |
|---------|--------|
| `generate-types` fails | Check if API is running: `docker compose logs api` |
| Docker won't start | Check ports: `lsof -i :3000 -i :3001` |
| Lint errors | Run `npm run lint:fix` first, then re-run lint |
| Build fails | Check console output, often missing imports or type errors |
| API not responding | `docker compose restart api` and check logs |
