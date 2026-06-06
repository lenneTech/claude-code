# E2E Testing with Playwright

This document describes End-to-End (E2E) testing for Nuxt/Vue frontend applications using Playwright.

## TDD Approach for Frontend

**CRITICAL: Write E2E tests BEFORE implementing frontend features!**

```
┌────────────────────────────────────────────────────────────────────────────┐
│  FRONTEND TDD WORKFLOW                                                     │
│                                                                            │
│  1. Backend is complete (API tests pass)                                   │
│  2. Write E2E tests for user workflows                                     │
│  3. Run tests (expect failures - Red phase)                                │
│  4. Implement components/pages until tests pass (Green phase)              │
│  5. Refactor with tests passing (Refactor phase)                           │
│  6. Debug with Chrome DevTools MCP                                         │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

## Playwright Configuration

### Basic Setup

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:3001',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Start dev server before tests
  webServer: {
    command: 'pnpm run dev',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
```

### Test Environment Separation

```typescript
// playwright.config.ts for test environment
export default defineConfig({
  use: {
    baseURL: 'http://localhost:3101', // Different port for tests
  },
  webServer: {
    command: 'pnpm run dev:test', // Uses test environment
    url: 'http://localhost:3101',
  },
});
```

## Running in three environments (classic ports / lt dev / CI)

The **same** Playwright suite must run in three setups. The key: read all URLs
from env vars with `localhost` fallbacks — never hardcode ports in specs.

| Environment | App URL | API URL | Protocol |
|---|---|---|---|
| Classic (manual `pnpm start` + `pnpm dev`) | `http://localhost:3001` | `http://localhost:3000` | HTTP |
| `lt dev up` (manual / dev) | `https://<slug>.localhost` | `https://api.<slug>.localhost` | HTTPS (Caddy) |
| `lt dev test` (isolated E2E) | `https://<slug>-test.localhost` | `https://api.<slug>-test.localhost` | HTTPS (Caddy) |
| CI (GitLab / GitHub) | `http://localhost:3001` | `http://localhost:3000` | HTTP |

**Env-driven config** — `playwright.config.ts` and every spec/helper:

```typescript
baseURL: process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3001',
const API_BASE = process.env.NUXT_PUBLIC_API_URL || process.env.API_URL || 'http://localhost:3000';
```

**The `.lt-dev/.env` bridge** — `lt dev init` injects a block at the top of
`playwright.config.ts` that loads `<root>/.lt-dev/.env` (written by `lt dev up`)
into `process.env`. Any Playwright invocation — `pnpm test:e2e`, `lt dev test`,
the VS Code extension — then picks up the active `lt dev` URLs.

**Isolated E2E suite (`lt dev test`, preferred)** — for the full suite, `lt dev test`
brings up a SEPARATE parallel stack (`<slug>-test.localhost`) on a dedicated DB
`<slug>-test` (reset once before the first test by global-setup), runs Playwright
via a `.lt-dev/.env.test` bridge, and auto-tears-down residue-free — so it never
touches your `lt dev up` dev session or its `<slug>-local` DB. Prefer it over running
the suite against `lt dev up`; `lt dev test down` stops a `--keep`-ed stack
(`--keep` leaves it up for browser debugging).

Both halves run BUILT for speed + prod-fidelity (compiled API + `nuxt build` →
`node .output/server/index.mjs`, no Vite cold-compile), and the stack is **cross-origin
split-host** (`NUXT_PUBLIC_API_PROXY=false`, App on `<slug>-test.localhost` ↔ API on
`api.<slug>-test.localhost`) — the SAME topology as a deployment. That is exactly why
the cross-subdomain cookie rule below matters: the same-origin `/api` proxy is only a
CI artifact, never how `lt dev test` (or prod) runs.

**Cookie injection gotcha** — when a test injects a captured `Set-Cookie`
header into the browser context, it MUST:

- preserve the `Secure` attribute — under `lt dev` (HTTPS) Better-Auth issues
  `Secure` (often `__Secure-`-prefixed) cookies; a `__Secure-`-prefixed cookie
  injected without `secure` is silently rejected by the browser → the test
  lands on `/auth/login`;
- derive the cookie `domain` from the app host (`localhost` for classic/CI,
  `<slug>.localhost` / `<slug>-test.localhost` for `lt dev`) instead of a
  hardcoded `'localhost'`;
- **on split-host `lt dev` / deployed, inject it as a cross-subdomain DOMAIN
  cookie (leading dot).** The session must reach BOTH the app origin (for SSR)
  and the API subdomain (for the client-side cross-origin data fetch). A real
  Better-Auth `Set-Cookie: Domain=<slug>-test.localhost` is — per RFC 6265 — a
  DOMAIN cookie that is also sent to `api.<slug>-test.localhost`, which is why a
  real browser login works cross-origin. But Playwright
  `addCookies({ domain: '<slug>-test.localhost' })` with a BARE domain (no
  leading dot) is stored **HOST-ONLY** → NOT sent to the API subdomain → the
  cross-origin `GET /iam/get-session` returns `null` → the app auto-logs-out to
  `/auth/login` (the classic split-host E2E auth break). Prefix a leading dot
  for multi-label hosts (`.<slug>-test.localhost`) so the cookie covers the API
  subdomain; single-label hosts (CI / `localhost`, IPs) stay host-only — there
  the app + API share one origin via the `/api` proxy, so no subdomain crossing
  happens. Misleading symptom: `context.cookies(['https://api.<host>'])` LISTS
  the cookie, yet the browser never sends it cross-origin.

**API test-mode flags** — E2E suites promote a fresh user to admin via a direct
DB write. The API must skip its rate limiter and Better-Auth user-cache so the
new role is seen immediately. The API honours `VITEST`, `PLAYWRIGHT` and
`LT_DEV_ACTIVE` (the last exported automatically by `lt dev up`). In CI, set
`PLAYWRIGHT=true` on the job.

### package.json Scripts

```json
{
  "scripts": {
    "dev": "nuxi dev --port 3001",
    "dev:test": "NODE_ENV=test nuxi dev --port 3101",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:headed": "playwright test --headed"
  }
}
```

## Writing E2E Tests

### Test Structure

```typescript
// tests/e2e/products.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Product Management', () => {
  // Track created entities for cleanup
  const createdProductIds: string[] = [];

  test.beforeAll(async ({ request }) => {
    // Optional: Setup test data via API
  });

  test.afterAll(async ({ request }) => {
    // CRITICAL: Cleanup all created entities
    for (const id of createdProductIds) {
      await request.delete(`/api/products/${id}`);
    }
  });

  test.beforeEach(async ({ page }) => {
    // Login before each test (if required)
    await loginAsUser(page, 'test@test.com', 'password');
  });

  test('should display product list', async ({ page }) => {
    await page.goto('/products');

    // Wait for data to load
    await expect(page.locator('[data-testid="product-list"]')).toBeVisible();

    // Verify content
    const items = page.locator('[data-testid="product-item"]');
    await expect(items).toHaveCount(await items.count());
  });

  test('should create new product', async ({ page }) => {
    await page.goto('/products');

    // Click create button
    await page.click('[data-testid="create-product"]');

    // Fill form
    await page.fill('[data-testid="product-name"]', `Test-${Date.now()}`);
    await page.fill('[data-testid="product-price"]', '99.99');

    // Submit
    await page.click('[data-testid="submit"]');

    // Verify success (capture ID for cleanup)
    await expect(page.locator('text=erfolgreich')).toBeVisible();

    // Track for cleanup
    const url = page.url();
    const match = url.match(/\/products\/([a-f0-9]+)/);
    if (match) createdProductIds.push(match[1]);
  });
});
```

### Helper Functions

```typescript
// tests/e2e/helpers/auth.ts
import { Page } from '@playwright/test';

export async function loginAsUser(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.goto('/login');
  await page.fill('[data-testid="email"]', email);
  await page.fill('[data-testid="password"]', password);
  await page.click('[data-testid="login-submit"]');

  // Wait for redirect
  await page.waitForURL(/(?!.*login)/);
}

export async function logout(page: Page): Promise<void> {
  await page.click('[data-testid="user-menu"]');
  await page.click('[data-testid="logout"]');
  await page.waitForURL('/login');
}
```

### API Fixtures

```typescript
// tests/e2e/fixtures/api.ts
import { test as base, APIRequestContext } from '@playwright/test';

interface ApiFixtures {
  apiClient: APIRequestContext;
  authToken: string;
}

export const test = base.extend<ApiFixtures>({
  apiClient: async ({ playwright }, use) => {
    const context = await playwright.request.newContext({
      baseURL: 'http://localhost:3000',
    });
    await use(context);
    await context.dispose();
  },

  authToken: async ({ apiClient }, use) => {
    const response = await apiClient.post('/api/auth/signin', {
      data: {
        email: 'test@test.com',
        password: 'password',
      },
    });
    const data = await response.json();
    await use(data.accessToken);
  },
});
```

## Test Data Management

### Unique Test Data

```typescript
// ALWAYS use unique identifiers
const uniqueEmail = `user-${Date.now()}-${crypto.randomUUID().slice(0, 8)}@test.com`;
const uniqueName = `Product-${Date.now()}`;

// NEVER use hardcoded values that could collide
// BAD:  const email = 'test@test.com';
// GOOD: const email = `test-${Date.now()}@test.com`;
```

### Cleanup Patterns

```typescript
test.describe('Feature Tests', () => {
  const cleanup: Array<() => Promise<void>> = [];

  test.afterAll(async () => {
    // Execute all cleanup functions
    for (const cleanupFn of cleanup) {
      await cleanupFn();
    }
  });

  test('creates data', async ({ page, request }) => {
    // ... create data ...

    // Register cleanup
    cleanup.push(async () => {
      await request.delete(`/api/resource/${createdId}`);
    });
  });
});
```

### Database Isolation

```
┌────────────────────────────────────────────────────────────────────────────┐
│  DATABASE SEPARATION                                                       │
│                                                                            │
│  Development: mongodb://localhost:27017/app-dev                            │
│  Testing:     mongodb://localhost:27017/app-test  ← E2E tests use this    │
│  Production:  mongodb://atlas/app-prod                                     │
│                                                                            │
│  Configure via environment variables:                                      │
│  - .env.development: MONGODB_URI=...app-dev                                │
│  - .env.test:        MONGODB_URI=...app-test                               │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

## Testing Authentication Flows

### Login Test

```typescript
test('should login successfully', async ({ page }) => {
  await page.goto('/login');

  await page.fill('[data-testid="email"]', 'admin@test.com');
  await page.fill('[data-testid="password"]', 'password');
  await page.click('[data-testid="login-submit"]');

  // Should redirect to dashboard
  await expect(page).toHaveURL('/dashboard');

  // User info should be visible
  await expect(page.locator('[data-testid="user-name"]')).toBeVisible();
});
```

### Protected Route Test

```typescript
test('should redirect unauthenticated users to login', async ({ page }) => {
  // Try to access protected route without login
  await page.goto('/dashboard');

  // Should redirect to login
  await expect(page).toHaveURL(/\/login/);
});
```

### 2FA Test

```typescript
test('should complete 2FA verification', async ({ page }) => {
  await loginAsUser(page, '2fa-user@test.com', 'password');

  // Should show 2FA input
  await expect(page.locator('[data-testid="2fa-input"]')).toBeVisible();

  // Enter TOTP code (use test secret in test environment)
  const totpCode = generateTOTP(TEST_2FA_SECRET);
  await page.fill('[data-testid="2fa-input"]', totpCode);
  await page.click('[data-testid="2fa-verify"]');

  // Should complete login
  await expect(page).toHaveURL('/dashboard');
});
```

## Debugging with Chrome DevTools MCP

**CRITICAL: For direct browser testing and debugging, always use the Chrome DevTools MCP (`mcp__chrome-devtools__*`) unless the user explicitly requests otherwise.** The Playwright-based Browser MCP (`mcp__MCP_DOCKER__browser_*`) is used for creating and running Playwright E2E tests.

### During Test Development

Use Chrome DevTools MCP to debug failing tests:

```typescript
// 1. Navigate to the page
mcp__chrome-devtools__navigate_page({ url: 'http://localhost:3001/products' });

// 2. Take snapshot to understand structure
mcp__chrome-devtools__take_snapshot();

// 3. Check for console errors
mcp__chrome-devtools__list_console_messages({ types: ['error'] });

// 4. Verify API calls
mcp__chrome-devtools__list_network_requests();

// 5. Interact with elements
mcp__chrome-devtools__click({ uid: 'button-create' });
mcp__chrome-devtools__fill({ uid: 'input-name', value: 'Test' });
```

### Common Debugging Scenarios

| Issue | MCP Tool | What to Check |
|-------|----------|---------------|
| Page blank | `take_snapshot` | Element structure, loading states |
| API errors | `list_network_requests` | Failed requests (4xx, 5xx) |
| JS errors | `list_console_messages` | Error messages, stack traces |
| Auth issues | `list_network_requests` | Token in headers, 401 responses |
| Missing elements | `take_snapshot` | Correct selectors, element visibility |

## Best Practices

### 1. Use data-testid Attributes

```vue
<!-- Component with test identifiers -->
<template>
  <div>
    <UButton data-testid="create-product" @click="onCreate">
      Erstellen
    </UButton>

    <UInput
      v-model="name"
      data-testid="product-name"
      label="Name"
    />
  </div>
</template>
```

### 2. Wait for Conditions, Not Time

```typescript
// BAD: Fixed wait times
await page.waitForTimeout(3000);

// GOOD: Wait for specific conditions
await page.waitForSelector('[data-testid="product-list"]');
await expect(page.locator('text=Geladen')).toBeHidden();
await page.waitForResponse(resp => resp.url().includes('/api/products'));
```

### 3. Isolate Tests

```typescript
// Each test should be independent
test('test A', async ({ page }) => {
  // Creates its own data
  // Cleans up after itself
});

test('test B', async ({ page }) => {
  // Does NOT depend on test A
  // Creates its own data
});
```

### 4. Test User Journeys

```typescript
// Test complete workflows, not individual actions
test('complete order workflow', async ({ page }) => {
  // 1. Browse products
  await page.goto('/products');
  await page.click('[data-testid="product-1"]');

  // 2. Add to cart
  await page.click('[data-testid="add-to-cart"]');

  // 3. Checkout
  await page.goto('/checkout');
  await page.fill('[data-testid="address"]', 'Test Street 1');

  // 4. Complete order
  await page.click('[data-testid="place-order"]');
  await expect(page.locator('text=Bestellung erfolgreich')).toBeVisible();
});
```

## Running Tests

### Commands

```bash
# Run all E2E tests
pnpm run test:e2e

# Run specific test file
pnpm dlx playwright test tests/e2e/products.spec.ts

# Run with UI mode (debugging)
pnpm run test:e2e:ui

# Run with visible browser
pnpm run test:e2e:headed

# Run specific test by name
pnpm dlx playwright test -g "should create product"

# Generate test report
pnpm dlx playwright show-report
```

### CI/CD Integration

```yaml
# .github/workflows/e2e.yml
name: E2E Tests

on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Install Playwright browsers
        run: pnpm dlx playwright install --with-deps

      - name: Start API (test environment)
        run: |
          cd ../api
          pnpm run start:test &
          pnpm dlx wait-on http://localhost:3100/api

      - name: Run E2E tests
        run: pnpm run test:e2e

      - name: Upload report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
```

## Checklist

### Before Writing Tests
- [ ] Backend API is complete and tested
- [ ] Playwright is configured
- [ ] Test database is set up
- [ ] data-testid attributes planned

### Test Quality
- [ ] Tests written BEFORE implementation
- [ ] Complete user journeys covered
- [ ] Unique test data with timestamps
- [ ] Cleanup in afterAll hooks
- [ ] No hardcoded waits (use conditions)
- [ ] Authentication flows tested

### After Tests Pass
- [ ] Tests run twice without failures
- [ ] No orphaned test data in database
- [ ] CI/CD pipeline configured
- [ ] Test report reviewed

## Parallel / sharded E2E (`lt dev test --shard N`) — rollout

`lt dev test --shard N` runs the suite split across **N fully-isolated stacks**
in parallel (each its own URLs/ports/Caddy block AND its own DB
`<db>-test-<i>`), the local equivalent of the CI `parallel: N` + `--shard=i/N`
matrix. NEVER use in-process `workers > 1` against one stack — the suite's global
cleanup / "pick any active season" helpers collide and produce false results.

**Choosing N — local shards share ONE machine (unlike CI's per-shard containers).**
Each shard runs a built Nuxt/Nitro server + headless Chromium + a compiled API,
peaking at ~2 **perf** cores during SSR render. Once N shards' demand reaches the
perf-core count there is no headroom, SSR slows 2-3x, and timing-sensitive
navigations FAIL regardless of timeout (true over-subscription). Measured on an
M2 Max (8 perf cores) with a heavy built-SSR suite: **N=2 → 7.4 min, 0 failures
(stable); N=3 → flaky; N=4 → 6-10 min, flaky + high variance**. So:

- `--shard auto` picks a conservative machine default (`perfCores/4 ≈ logical/6`)
  that favours a green, repeatable run. Override with an explicit `--shard N`.
- **Heavy built-SSR suites: start at N=2.** Lighter suites / bigger boxes can go
  higher. Always measure N vs N±1 (wall-clock AND flakes).
- CI is unaffected — each CI shard gets its own container, so keep CI's N as-is.

**Timeouts must stay CI-fast.** Relax ONLY under sharded local load, gated on the
CLI-exported `LT_DEV_TEST_SHARDS` (never set in CI), so CI's fast-failure feedback
is unchanged:

```ts
// playwright.config.ts
const SHARDED = Number(process.env.LT_DEV_TEST_SHARDS || '0') > 1;
export default defineConfig({
  timeout: isWindows ? 60_000 : SHARDED ? 180_000 : 90_000,
  expect: { timeout: SHARDED ? 30_000 : 10_000 },
  use: { navigationTimeout: SHARDED ? 60_000 : undefined, actionTimeout: SHARDED ? 30_000 : undefined },
});
// for explicit per-call waitForURL overrides (they ignore navigationTimeout):
export const SHARD_NAV_TIMEOUT = SHARDED ? 60_000 : 15_000; // tight in CI, generous under shard
```

**Rollout checklist**

- **Per machine (once):** `lt dev install` (Caddy + local CA).
- **New projects (from `nuxt-base-starter`):** the template `playwright.config.ts`
  already ships the shard-aware block + `ignoreHTTPSErrors` + the `LT_DEV_ACTIVE`
  webServer guard, and the starter has **no DB-wiping `global-setup`** — so sharded
  AND per-ticket E2E work out of the box. Just `lt dev init` to register + done.
  (If you later ADD a DB-reset `global-setup`, use the ticket+shard-safe allow-list
  from the next bullet from the start — the canonical regex already accepts any
  future ticket id / shard, so it never needs a per-feature update.)
- **Existing projects — to enable `--shard`:**
  1. **`lt dev init`** — now auto-applies (idempotently) everything in the
     `playwright.config`: env-aware URLs, the webServer `LT_DEV_ACTIVE` guard,
     **`ignoreHTTPSErrors`** (Caddy cert), the shard-aware `LT_DEV_TEST_SHARDS`
     timeout block, and `slowMo: 0` + registration. One command, no manual edits.
  2. **(Only if the project has a DB-wiping `global-setup`)** make its test-DB
     allow-list accept every `…-test` database `lt dev test` / `lt ticket` may
     create — the per-shard **and** the per-ticket variants:
     - per-shard:  `<base>-test-<n>`   (`lt dev test --shard N`)
     - per-ticket: `<base>-<id>-test[-<n>]`   (`lt ticket`)

     Canonical, ticket+shard-safe predicate — matches ONLY names ending in
     `test`, so it can NEVER wipe a dev `…-local` DB nor a ticket's DEV DB
     (`<base>-<id>`):

     ```ts
     function isAllowedDb(name: string): boolean {
       return ALLOWED_DBS.includes(name)                          // exact: <base>-local|-ci|-e2e|-test
         || /^<base>-(?:[a-z0-9-]+-)?test(?:-\d+)?$/.test(name);  // <base>-[<id>-]test[-<shard>]
     }
     ```

     Also widen any `assertLocalMongoUri`-style guard to allow the `-test` suffix
     (`/-(local|ci|e2e|test)(-\d+)?$/`). This is **deliberately NOT auto-patched**
     by `lt dev init` (bespoke global-setups vary too much to edit safely) — add
     it once by hand. `svl`'s `tests/global-setup.ts#isAllowedDb` is the reference.
  3. **(Optional, for explicit per-call `waitForURL` timeouts)** gate them via a
     `SHARD_NAV_TIMEOUT` constant (tight in CI / generous under shard) — the
     config-level `navigationTimeout` from step 1 already covers waits without an
     explicit timeout.
  4. Build scripts present (`build` → `.output` / `dist`) — lt projects have these.
- **Cross-project:** multiple projects' `lt dev test` isolate ports/DBs but share
  CPU/RAM — run heavy suites one project at a time.

## Related Documentation

- **Fullstack TDD Workflow:** `building-stories-with-tdd` skill -> `fullstack-tdd-workflow.md`
- **Browser Debugging:** Chrome DevTools MCP section in SKILL.md
- **Authentication:** `reference/authentication.md`
- **Troubleshooting:** `reference/troubleshooting.md`
