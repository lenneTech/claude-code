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
    command: 'npm run dev',
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
    command: 'npm run dev:test', // Uses test environment
    url: 'http://localhost:3101',
  },
});
```

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
npm run test:e2e

# Run specific test file
npx playwright test tests/e2e/products.spec.ts

# Run with UI mode (debugging)
npm run test:e2e:ui

# Run with visible browser
npm run test:e2e:headed

# Run specific test by name
npx playwright test -g "should create product"

# Generate test report
npx playwright show-report
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
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps

      - name: Start API (test environment)
        run: |
          cd ../api
          npm run start:test &
          npx wait-on http://localhost:3100/api

      - name: Run E2E tests
        run: npm run test:e2e

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

## Related Documentation

- **Fullstack TDD Workflow:** `building-stories-with-tdd` skill -> `fullstack-tdd-workflow.md`
- **Browser Debugging:** Chrome DevTools MCP section in SKILL.md
- **Authentication:** `reference/authentication.md`
- **Troubleshooting:** `reference/troubleshooting.md`
