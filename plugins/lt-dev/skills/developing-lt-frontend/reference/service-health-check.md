# Service Health Check

**Before starting ANY frontend work, check if required services are running:**

```bash
# Check if API is running (Port 3000)
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api

# Check if App is running (Port 3001)
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001
```

**Workflow:**

```
┌────────────────────────────────────────────────────────────────┐
│  BEFORE starting frontend work:                                │
│                                                                │
│  1. CHECK API (Port 3000):                                     │
│     curl -s -o /dev/null -w "%{http_code}" localhost:3000/api  │
│     - If NOT 200: Start API in background                      │
│       cd projects/api && npm run start:dev &                   │
│     - Wait until API responds (max 30s)                        │
│                                                                │
│  2. CHECK APP (Port 3001):                                     │
│     curl -s -o /dev/null -w "%{http_code}" localhost:3001      │
│     - If NOT 200: Start App in background                      │
│       cd projects/app && npm run dev &                         │
│     - Wait until App responds (max 30s)                        │
│                                                                │
│  3. ONLY THEN proceed with frontend development                │
└────────────────────────────────────────────────────────────────┘
```

**Starting Services (if not running):**

```bash
# Start API in background (from monorepo root)
cd projects/api && npm run start:dev &

# Start App in background (from monorepo root)
cd projects/app && npm run dev &
```

**Important:**
- Always check BEFORE starting to avoid duplicate processes
- Use `lsof -i :3000` or `lsof -i :3001` to check if port is already in use
- If port is in use but service not responding, investigate before starting another instance
