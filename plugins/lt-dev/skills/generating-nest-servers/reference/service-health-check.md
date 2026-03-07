# Service Health Check

**Before starting ANY backend work, check if services are running:**

```bash
# Check if API is running (Port 3000)
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api

# Check if port is in use (alternative)
lsof -i :3000
```

**Workflow:**

```
┌────────────────────────────────────────────────────────────────┐
│  BEFORE starting backend work:                                 │
│                                                                │
│  1. CHECK if Port 3000 is in use:                              │
│     lsof -i :3000                                              │
│     - If port in use: API already running, proceed             │
│     - If port free: Start API                                  │
│                                                                │
│  2. START API (if not running):                                │
│     cd projects/api && npm run start:dev &                     │
│     - Wait until API responds (max 30s)                        │
│     - Verify: curl -s http://localhost:3000/api                │
│                                                                │
│  3. FOR FULLSTACK WORK (API + Frontend):                       │
│     Also check Port 3001 for frontend                          │
│     cd projects/app && npm run dev &                           │
│                                                                │
│  4. ONLY THEN proceed with development                         │
└────────────────────────────────────────────────────────────────┘
```

**Starting Services (if not running):**

```bash
# Start API in background (from monorepo root)
cd projects/api && npm run start:dev &

# Optional: Start Frontend too (Port 3001)
cd projects/app && npm run dev &
```

**Important:**
- Always check with `lsof -i :3000` BEFORE starting to avoid duplicate processes
- If port is in use but service not responding, kill the process first: `kill $(lsof -t -i :3000)`
- For tests that require running server, ensure API is started first

## Prerequisites Check

```bash
lt --version  # Check CLI installation
npm install -g @lenne.tech/cli  # If needed
ls src/server/modules  # Verify project structure
```

**Creating New Server:**
```bash
lt server create <server-name>
```

**Post-creation verification:** Check `src/config.env.ts` for replaced secrets and correct database URIs.
