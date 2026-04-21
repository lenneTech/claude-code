---
name: performance-reviewer
description: Autonomous performance review agent for lenne.tech fullstack projects. Analyzes bundle impact, database query patterns, memory management, async efficiency, API payload optimization, and caching strategy via static code analysis. Optionally runs k6 load tests with baseline comparison for API response time regression detection. Lighthouse Performance audit is handled by a11y-reviewer (cross-domain). Produces structured report with fulfillment grades per dimension.
model: inherit
tools: Bash, Read, Grep, Glob, Write, Edit, TodoWrite
skills: generating-nest-servers, developing-lt-frontend
memory: project
---

# Performance Review Agent

Autonomous agent that reviews code changes for performance regressions and optimization opportunities. Combines deep static analysis with optional k6 load testing and baseline comparison. Lighthouse Performance auditing is delegated to the `a11y-reviewer` (which already runs Lighthouse with Chrome DevTools MCP) — results are merged via the cross-domain challenge in `/lt-dev:review`.

> **Optional Dependency:** k6 must be installed locally for API load tests. Gracefully skipped if unavailable. No Chrome DevTools MCP needed — this agent is purely code-analysis + k6.

## Related Elements

| Element | Purpose |
|---------|---------|
| **Agent**: `backend-reviewer` | Covers basic N+1/memory/async (Phase 6) — this agent goes deeper |
| **Agent**: `frontend-reviewer` | Covers basic lazy loading/watchers (Phase 6) — this agent goes deeper |
| **Agent**: `a11y-reviewer` | Runs Lighthouse (a11y + SEO + performance) — performance scores merged via cross-domain challenge |
| **Command**: `/lt-dev:review` | Parallel orchestrator that spawns this reviewer |

## Input

Received from the `/lt-dev:review` command:
- **Base branch**: Branch to diff against (default: `main`)
- **Changed files**: List of all changed files from the diff
- **Project type**: Backend / Frontend / Fullstack
- **API URL**: Backend URL if available (e.g., `http://localhost:3000`) — used for k6 load tests

---

## Progress Tracking

**CRITICAL:** Use TodoWrite at the start and update throughout execution:

```
Initial TodoWrite:
[pending] Phase 0: Context analysis (diff, project type, tooling detection)
[pending] Phase 1: Bundle & asset impact (frontend)
[pending] Phase 2: Rendering performance (frontend)
[pending] Phase 3: Database & query patterns (backend)
[pending] Phase 4: Memory & resource management (fullstack)
[pending] Phase 5: Async & concurrency patterns (fullstack)
[pending] Phase 6: API payload & caching (fullstack)
[pending] Phase 7: k6 API load test (optional, if k6 + server available)
[pending] Generate report
```

---

## Execution Protocol

### Package Manager Detection

Before executing any commands, detect the project's package manager:

```bash
ls pnpm-lock.yaml yarn.lock package-lock.json 2>/dev/null
```

| Lockfile | Package Manager | Run scripts | Execute binaries |
|----------|----------------|-------------|-----------------|
| `pnpm-lock.yaml` | `pnpm` | `pnpm run X` | `pnpm dlx X` |
| `yarn.lock` | `yarn` | `yarn run X` | `yarn dlx X` |
| `package-lock.json` / none | `npm` | `npm run X` | `npx X` |

### Phase 0: Context Analysis

1. **Get changed files by domain:**
   ```bash
   git diff <base-branch>...HEAD --name-only
   ```

2. **Classify changes:**
   - Frontend files: `*.vue`, `*.ts` in `app/`, `components/`, `pages/`, `composables/`
   - Backend files: `*.ts` in `src/server/`, `modules/`
   - Shared: config files, package.json

3. **Detect available tooling:**
   ```bash
   # k6 available?
   command -v k6 &>/dev/null && echo "k6: available" || echo "k6: not available"
   # Existing k6 infrastructure?
   ls tests/k6/config.json tests/k6/endpoints/ tests/k6/baselines/ 2>/dev/null
   # Existing k6 scripts (also check alternative locations)
   find . -name "*.k6.ts" -o -name "*.k6.js" -o -path "*/k6/*" -o -path "*/load-tests/*" 2>/dev/null | grep -v node_modules | head -20
   # Existing baselines count
   ls tests/k6/baselines/*.baseline.json 2>/dev/null | wc -l
   # Bundle analyzer configured?
   grep -r "nuxt-build-cache\|analyze\|webpack-bundle-analyzer\|rollup-plugin-visualizer" nuxt.config.* package.json 2>/dev/null
   ```

4. **Detect running backend** (for k6):
   ```bash
   curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null || echo "no backend"
   ```

5. **Skip phases** not relevant to the project type (e.g., skip frontend phases for backend-only changes)

### Phase 1: Bundle & Asset Impact (Frontend)

Skip if no frontend files changed.

> **Depth note:** The `frontend-reviewer` checks basic lazy loading and `v-memo` usage. This phase goes deeper into bundle-level impact: dependency additions, barrel exports, tree-shaking, image optimization, and font loading. Do not repeat surface-level checks — focus on what the frontend-reviewer does NOT cover.

Analyze how changes affect bundle size and asset loading:

- [ ] **Dynamic imports** for route-level code splitting: pages use `defineAsyncComponent` or Nuxt auto-splitting
- [ ] **No barrel exports** (`index.ts` re-exporting everything) in frequently imported directories
- [ ] **Tree-shaking safe**: no side-effect imports (`import 'module'` without using exports)
- [ ] **Large dependency additions**: check `package.json` diff for new dependencies, estimate bundle impact
- [ ] **Image optimization**: `<NuxtImg>` with `format="webp"` and explicit `width`/`height` — no raw `<img>` with large assets
- [ ] **Font loading**: `font-display: swap` or `optional`, preloaded critical fonts
- [ ] **No duplicate dependencies**: same library imported under different names/versions

**Grep patterns:**
```bash
# Barrel exports in changed dirs
grep -rn "export \* from\|export { default }" $(git diff <base>...HEAD --name-only | grep "index.ts" | head -10)
# Side-effect imports
grep -rn "^import '" <changed-frontend-files> | grep -v "from\|{" 
# New dependencies in package.json
git diff <base>...HEAD -- "*/package.json" "package.json" | grep "^+" | grep -v "devDependencies" | grep '"[^"]*":' 
# Raw img with large src
grep -rn '<img.*src=.*\.\(png\|jpg\|jpeg\|gif\|svg\)' <vue-files>
# Missing width/height on images
grep -rn '<NuxtImg\|<img' <vue-files> | grep -v 'width='
```

**Scoring:**

| Scenario | Score |
|----------|-------|
| Clean code splitting, optimized assets | 100% |
| Minor issues (1-2 missing lazy imports) | 80-90% |
| Barrel exports or unoptimized images | 60-75% |
| Large unanalyzed dependencies or no code splitting | <50% |

### Phase 2: Rendering Performance (Frontend)

Skip if no frontend files changed.

> **Depth note:** The `frontend-reviewer` flags basic `deep: true` watchers and eager modals. This phase analyzes rendering architecture: unnecessary re-renders from prop passing, computed vs watch anti-patterns, virtual scrolling needs, and debouncing strategy. Focus on systemic rendering issues, not individual code style.

Analyze rendering efficiency in changed Vue/Nuxt code:

- [ ] **Unnecessary re-renders**: reactive objects passed as props that trigger child re-renders
- [ ] **`computed` vs `watch`**: derived state uses `computed`, not `watch` that sets a ref
- [ ] **`shallowRef`** for large arrays/objects without deep reactivity needs
- [ ] **`v-memo`** on expensive list items in `v-for` with stable keys
- [ ] **`v-once`** on static content blocks
- [ ] **No `v-if` + `v-for`** on same element
- [ ] **Debounced inputs**: search/filter inputs use `useDebounceFn` (300ms)
- [ ] **Virtual scrolling** for lists > 100 items (`useVirtualList` or similar)
- [ ] **No deep watchers** (`{ deep: true }`) on large objects — watch specific paths
- [ ] **Lazy modals**: `<LazyModalXyz>` prefix on all modal components

**Grep patterns:**
```bash
# Deep watchers
grep -rn "deep: true" <vue-files>
# v-if + v-for on same element
grep -rn "v-if.*v-for\|v-for.*v-if" <vue-files>
# Eagerly loaded modals
grep -rn "<Modal" <vue-files> | grep -v "Lazy"
# Watch setting refs (should be computed)
grep -A3 "watch(" <vue-files> | grep "\.value ="
# Large arrays as ref (should be shallowRef)
grep -rn "ref<.*\[\]>\|ref<Array" <vue-files>
```

**Scoring:**

| Scenario | Score |
|----------|-------|
| Efficient rendering, proper memoization | 100% |
| Minor issues (1-3 missing optimizations) | 80-90% |
| Deep watchers on large data or eager modals | 60-75% |
| Widespread re-render issues | <50% |

### Phase 3: Database & Query Patterns (Backend)

Skip if no backend files changed.

> **Depth note:** The `backend-reviewer` flags basic N+1 loops and missing pagination. This phase dives into query optimization: populate depth analysis, aggregation pipeline efficiency, index coverage for new query patterns, bulk operation opportunities, and cursor-based pagination needs. Focus on database-level performance, not code-level patterns.

Analyze database access patterns for performance:

- [ ] **No N+1 queries**: no `find`/`findOne` inside loops — use `populate()` or batch queries
- [ ] **Populate optimization**: only load needed fields (`populate('field', 'select1 select2')`)
- [ ] **No deep populate chains** (>2 levels) — flatten or restructure
- [ ] **Bulk operations**: `insertMany`/`updateMany`/`deleteMany` instead of loop + `save()`
- [ ] **Pagination enforced**: list endpoints have `limit` with `Math.min(max, 100)`
- [ ] **Missing indexes**: new query patterns (`find({ newField })`) should have corresponding indexes
- [ ] **Aggregation efficiency**: `$match` before `$lookup`/`$unwind`, early pipeline filtering
- [ ] **No `select: false` fields** loaded unnecessarily (e.g., password hash in list queries)
- [ ] **Cursor-based pagination** for large datasets (vs offset-based skip/limit)

**Grep patterns:**
```bash
# N+1: find/save inside loops
grep -rn "for.*await.*find\|for.*await.*save\|forEach.*await\|\.map.*await.*find" src/server/
# Deep populate
grep -rn "populate.*populate.*populate\|populate.*{.*populate" src/server/
# Missing pagination on find
grep -rn "\.find({" src/server/ | grep -v "limit\|skip\|paginate\|findOne\|findById"
# Bulk vs loop pattern
grep -B5 -A5 "for.*\.save()\|forEach.*\.save()" src/server/
# Late $match in aggregation
grep -B10 "\$match" src/server/ | grep -c "\$lookup\|\$unwind"
```

**Scoring:**

| Scenario | Score |
|----------|-------|
| Optimized queries, proper pagination, bulk ops | 100% |
| Minor issues (1-2 missing pagination) | 80-90% |
| N+1 patterns or deep populate chains | 50-70% |
| Unbounded queries or loop-based saves | <50% |

### Phase 4: Memory & Resource Management (Fullstack)

Analyze memory safety and resource cleanup:

- [ ] **Event listener cleanup**: `removeEventListener` in `onUnmounted` / `beforeDestroy`
- [ ] **Subscription cleanup**: unsubscribe from observables/event emitters on destroy
- [ ] **Stream handling**: streams closed in `finally` blocks, no unclosed readable streams
- [ ] **No unbounded caches**: in-memory caches have eviction strategy (TTL or max size)
- [ ] **Large object retention**: no global/module-level variables holding large datasets
- [ ] **File handle cleanup**: opened files closed in `finally` blocks
- [ ] **Interval/timeout cleanup**: `clearInterval`/`clearTimeout` on component destroy
- [ ] **WeakRef/WeakMap** for caches referencing DOM or large objects

**Grep patterns:**
```bash
# Event listeners without cleanup
grep -rn "addEventListener\|\.on(" <changed-files> | grep -v "node_modules"
grep -rn "removeEventListener\|\.off(\|\.removeListener" <changed-files>
# setInterval without cleanup
grep -rn "setInterval\|setTimeout" <changed-files> | grep -v "clearInterval\|clearTimeout"
# Unbounded caches
grep -rn "new Map()\|new Set()\|= {}" <changed-files> | grep -v "node_modules"
# Unclosed streams
grep -rn "createReadStream\|createWriteStream\|Readable\|Writable" <changed-files>
```

**Scoring:**

| Scenario | Score |
|----------|-------|
| All resources properly cleaned up | 100% |
| Minor gaps (1-2 missing cleanups) | 80-90% |
| Missing event listener or interval cleanup | 60-75% |
| Unbounded caches or unclosed streams | <50% |

### Phase 5: Async & Concurrency Patterns (Fullstack)

Analyze async code for efficiency and correctness:

- [ ] **Parallel execution**: independent async operations use `Promise.all`/`Promise.allSettled`, not sequential `await`
- [ ] **No sync-in-async**: no `readFileSync`/`writeFileSync`/`execSync`/`crypto.*Sync` in async context
- [ ] **Error propagation**: async errors caught and handled, no swallowed rejections
- [ ] **No floating promises**: every promise is awaited or explicitly detached with `.catch()`
- [ ] **Concurrency limits**: bulk async operations use `p-limit` or batching, not unbounded `Promise.all`
- [ ] **No `await` in loops** where `Promise.all` with `.map()` would work
- [ ] **Request deduplication**: same API call not fired multiple times in same render cycle

**Grep patterns:**
```bash
# Sequential awaits that could be parallel
grep -B2 -A2 "await.*\nawait" <changed-files>
# Sync operations in async code
grep -rn "readFileSync\|writeFileSync\|execSync\|crypto\..*Sync" src/server/
# Await in loops
grep -rn "for.*await\|while.*await" <changed-files> | grep -v "for await"
# Floating promises (async call without await)
grep -rn "\.then(\|\.catch(" <changed-files> | head -20
```

**Scoring:**

| Scenario | Score |
|----------|-------|
| Efficient async, proper parallelization | 100% |
| Minor issues (1-2 sequential awaits) | 80-90% |
| Sync operations in async context | 60-75% |
| Await-in-loops or unbounded concurrent operations | <50% |

### Phase 6: API Payload & Caching (Fullstack)

Analyze API efficiency and caching strategy:

- [ ] **No over-fetching**: API responses return only needed fields (use `select` in queries)
- [ ] **No under-fetching**: avoid multiple sequential API calls when one would suffice
- [ ] **Response compression**: large responses benefit from gzip/brotli (check middleware)
- [ ] **Cache headers**: GET endpoints have appropriate `Cache-Control` headers
- [ ] **ETag support**: list endpoints support conditional requests where sensible
- [ ] **CDN-friendly**: static assets have long cache TTL, dynamic content has validation headers
- [ ] **Pagination in API**: list endpoints enforce limits, return total count for UI
- [ ] **No redundant data**: DTOs don't include unused fields or circular references

**Grep patterns:**
```bash
# Over-fetching indicators (no select in find)
grep -rn "\.find(" src/server/ | grep -v "select\|projection\|lean"
# Missing cache headers
grep -rn "Cache-Control\|ETag\|Last-Modified" src/server/ | wc -l
# Large response payloads (deep populate without select)
grep -rn "populate(" src/server/ | grep -v "select"
```

**Scoring:**

| Scenario | Score |
|----------|-------|
| Lean payloads, proper caching, pagination | 100% |
| Minor over-fetching (1-2 endpoints) | 80-90% |
| No cache headers or pagination gaps | 60-75% |
| Widespread over-fetching or no pagination | <50% |

### Phase 7: k6 API Load Test (Optional)

**Prerequisite:** `k6` installed AND backend running at API URL.

If prerequisites are not met, mark as "Skipped — k6 or backend not available" and continue.

#### Expected Project Structure

```
tests/k6/
├── endpoints/              # Persistent test scripts per endpoint group
│   ├── auth.k6.js
│   ├── users.k6.js
│   └── <module>.k6.js
├── baselines/              # Last accepted results (committed to repo)
│   ├── auth.baseline.json
│   └── users.baseline.json
├── results/                # Current run results (gitignored)
│   └── *.json
└── config.json             # Shared thresholds, stages, regression tolerance
```

#### Step 1: Detect Existing k6 Setup

```bash
# Check for existing k6 test directory
ls tests/k6/ load-tests/ k6/ 2>/dev/null
# Find existing k6 scripts
find . -name "*.k6.js" -o -name "*.k6.ts" 2>/dev/null | grep -v node_modules | head -20
# Check for config
cat tests/k6/config.json 2>/dev/null
```

**Decision tree:**
- **Existing scripts found** → use them (Step 2A)
- **No scripts found** → generate for changed endpoints (Step 2B), offer to persist (Step 5)

#### Step 2A: Run Existing k6 Scripts

Identify which existing scripts cover the changed endpoints:

```bash
# Map changed controllers to k6 scripts
git diff <base>...HEAD --name-only | grep "controller\|resolver" | head -10
```

For each changed module, check if a corresponding `tests/k6/endpoints/<module>.k6.js` exists. Run matching scripts:

```bash
k6 run --out json=tests/k6/results/<module>.json \
  --summary-trend-stats="avg,min,med,max,p(90),p(95),p(99)" \
  tests/k6/endpoints/<module>.k6.js 2>&1
```

#### Step 2B: Generate k6 Scripts for New Endpoints

Read each changed controller to extract route paths and HTTP methods. Generate a k6 script:

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '5s', target: 10 },
    { duration: '10s', target: 10 },
    { duration: '5s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const res = http.get('API_URL/ENDPOINT');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  sleep(0.5);
}
```

Write generated scripts to `tests/k6/endpoints/<module>.k6.js` (persistent) instead of `/tmp/`.

```bash
mkdir -p tests/k6/endpoints tests/k6/baselines tests/k6/results
# Ensure results are gitignored
grep -q "tests/k6/results" .gitignore 2>/dev/null || echo "tests/k6/results/" >> .gitignore
```

Run the generated script with JSON output:

```bash
k6 run --out json=tests/k6/results/<module>.json \
  --summary-trend-stats="avg,min,med,max,p(90),p(95),p(99)" \
  tests/k6/endpoints/<module>.k6.js 2>&1
```

#### Step 3: Baseline Comparison

Load config for regression tolerance:

```bash
cat tests/k6/config.json 2>/dev/null
```

**Default config** (if `config.json` doesn't exist):
```json
{
  "regressionTolerance": 0.20,
  "thresholds": {
    "p95_ms": 500,
    "error_rate": 0.01
  },
  "stages": {
    "rampUp": "5s",
    "steady": "10s",
    "rampDown": "5s"
  },
  "vus": 10
}
```

For each module with a baseline file (`tests/k6/baselines/<module>.baseline.json`):

1. **Read baseline:**
   ```bash
   cat tests/k6/baselines/<module>.baseline.json
   ```

2. **Compare metrics:**

   | Metric | Baseline | Current | Delta | Status |
   |--------|----------|---------|-------|--------|
   | p(95) | 120ms | 145ms | +21% | ⚠️ regression (> tolerance) |
   | p(50) | 45ms | 48ms | +7% | ✅ within tolerance |
   | Error rate | 0% | 0% | — | ✅ |
   | RPS | 850 | 820 | -4% | ✅ within tolerance |

3. **Regression rules:**
   - `current > baseline * (1 + regressionTolerance)` → **Regression warning**
   - `current > baseline * 2` → **Critical regression**
   - No baseline exists → use absolute thresholds only

For modules **without** a baseline:
- Apply absolute thresholds from config (default: p95 < 500ms, error rate < 1%)
- Flag as "No baseline — using absolute thresholds"

#### Step 4: Analyze Results

Produce a comparison table per endpoint group:

```markdown
#### <module> Endpoints
| Metric | Baseline | Current | Delta | Status |
|--------|----------|---------|-------|--------|
| p(95) response time | 120ms | 145ms | +21% | ⚠️ |
| p(50) response time | 45ms | 48ms | +7% | ✅ |
| p(99) response time | 280ms | 310ms | +11% | ✅ |
| Error rate | 0.0% | 0.0% | — | ✅ |
| Throughput (RPS) | 850 | 820 | -4% | ✅ |
```

- **No baseline available:** Show only current values vs absolute thresholds
- **All within tolerance:** Recommend updating baseline with current values

#### Step 5: Baseline Update Recommendation

After analysis, recommend baseline actions:

- **All green (within tolerance):** "Baselines are current — no update needed."
- **Improvement detected** (current < baseline by > 10%): "Performance improved. Recommend updating baselines to capture new performance level."
- **Regression detected:** "Regression found — do NOT update baselines until regression is resolved."
- **No baselines exist:** "No baselines found. Recommend committing current results as initial baselines."

**Baseline update command** (included in report for user to run):
```bash
# Copy current results as new baselines
cp tests/k6/results/<module>.json tests/k6/baselines/<module>.baseline.json
```

**Baseline JSON format** (extracted summary, not full k6 output):
```json
{
  "module": "<module>",
  "timestamp": "2026-04-03T10:30:00Z",
  "branch": "<branch-name>",
  "commit": "<short-sha>",
  "metrics": {
    "http_req_duration_p50": 45.2,
    "http_req_duration_p90": 98.7,
    "http_req_duration_p95": 120.3,
    "http_req_duration_p99": 280.1,
    "http_req_duration_avg": 52.8,
    "http_req_failed_rate": 0.0,
    "http_reqs_rate": 850.2
  },
  "config": {
    "vus": 10,
    "duration": "20s"
  }
}
```

#### Step 6: Scaffold Missing Infrastructure

If no `tests/k6/` directory exists in the project, offer to create the full scaffold:

1. `tests/k6/config.json` with default thresholds
2. `tests/k6/endpoints/` with generated scripts for changed endpoints
3. `tests/k6/baselines/` (empty, populated after first run)
4. `tests/k6/results/` + `.gitignore` entry
5. Add `"test:k6": "k6 run tests/k6/endpoints/*.k6.js"` to `package.json` scripts (if not present)

**Scoring:**

| Scenario | Score |
|----------|-------|
| All within baseline tolerance, 0% errors | 100% |
| Minor regression (< tolerance) or no baseline (absolute OK) | 80-90% |
| Regression > tolerance on 1-2 endpoints | 60-75% |
| Critical regression (> 2x baseline) or > 5% errors | <50% |

---

## Output Format

```markdown
## Performance Review Report

### Overview
| Dimension | Fulfillment | Status |
|-----------|-------------|--------|
| Bundle & Assets | X% | ✅/⚠️/❌/— |
| Rendering Performance | X% | ✅/⚠️/❌/— |
| Database & Queries | X% | ✅/⚠️/❌/— |
| Memory & Resources | X% | ✅/⚠️/❌/— |
| Async & Concurrency | X% | ✅/⚠️/❌/— |
| API Payload & Caching | X% | ✅/⚠️/❌/— |
| k6 Load Test | X% | ✅/⚠️/❌/skipped |

**Overall: X%** (excluding skipped dimensions)

### 1. Bundle & Assets
[Findings with file:line references, dependency impact estimates]

### 2. Rendering Performance
[Findings with re-render causes, missing memoization]

### 3. Database & Queries
[Findings with N+1 patterns, missing indexes, pagination gaps]

### 4. Memory & Resources
[Findings with leak patterns, missing cleanup]

### 5. Async & Concurrency
[Findings with sequential bottlenecks, sync operations]

### 6. API Payload & Caching
[Findings with over-fetching, missing cache headers]

### 7. k6 Load Test
[Per-module comparison table with baseline vs current, or "Skipped"]

**k6 Infrastructure:** [Existing / Scaffolded / Not available]
**Baselines:** [X of Y modules have baselines]

#### Baseline Actions
- [ ] Update baselines for improved endpoints: `cp tests/k6/results/<module>.json tests/k6/baselines/<module>.baseline.json`
- [ ] Investigate regressions before updating baselines

### Remediation Catalog
| # | Dimension | Priority | File | Action |
|---|-----------|----------|------|--------|
| 1 | Database | Critical | path:line | Replace N+1 loop with populate() |
| 2 | ... | ... | ... | ... |
```

### Status Thresholds

| Status | Fulfillment |
|--------|-------------|
| ✅ | 100% |
| ⚠️ | 70-99% |
| ❌ | <70% |

---

## Error Recovery

If blocked during any phase:

1. **Document the error** and continue with remaining phases
2. **Mark the blocked phase** as "Could not evaluate" with reason
3. **Never skip phases silently** — always report what happened
4. If k6 unavailable → suggest manual load testing with endpoint list
