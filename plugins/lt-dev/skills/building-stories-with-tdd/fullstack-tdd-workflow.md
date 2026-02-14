# Fullstack TDD Workflow

This document describes the recommended Test-Driven Development approach for fullstack projects (Backend + Frontend).

## Core Principle

**Tests drive the implementation, not vice versa.**

```
┌────────────────────────────────────────────────────────────────────────────┐
│  FULLSTACK TDD WORKFLOW                                                    │
│                                                                            │
│  Phase 1: BACKEND                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 1. Write Backend Tests (API Tests)                                  │   │
│  │    - REST endpoint tests (using TestHelper)                         │   │
│  │    - GraphQL mutation/query tests (if applicable)                   │   │
│  │    - Test all expected API behavior BEFORE implementation           │   │
│  │                                                                     │   │
│  │ 2. Implement Backend Against Tests                                  │   │
│  │    - Create modules, services, controllers                          │   │
│  │    - Iterate until ALL tests pass                                   │   │
│  │    - Use `generating-nest-servers` skill                            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                            │
│  Phase 2: FRONTEND                                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 3. Write Frontend Tests (E2E Tests)                                 │   │
│  │    - Playwright E2E tests for user workflows                        │   │
│  │    - Test complete user journeys BEFORE implementation              │   │
│  │    - Include authentication flows                                   │   │
│  │                                                                     │   │
│  │ 4. Implement Frontend Against Tests                                 │   │
│  │    - Create components, pages, composables                          │   │
│  │    - Iterate until ALL E2E tests pass                               │   │
│  │    - Use `developing-lt-frontend` skill                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                            │
│  Phase 3: DEBUGGING & VERIFICATION                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 5. Browser Debugging (Chrome DevTools MCP)                          │   │
│  │    - Use Chrome DevTools MCP (mcp__chrome-devtools__*) for direct   │   │
│  │      testing/debugging (default unless user requests otherwise)     │   │
│  │    - Verify API calls in Network tab                                │   │
│  │    - Check Console for errors                                       │   │
│  │    - Take snapshots/screenshots for visual verification             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

## Test Cleanup & Isolation

**CRITICAL: Tests must be repeatable without side effects!**

### Principles

1. **Every test run must be independent** - No test should depend on state from a previous run
2. **Complete cleanup after each test** - All created data must be removed in `afterAll`
3. **Unique test data** - Use timestamps and random suffixes to avoid collisions
4. **Separate environments** - Use dedicated test databases and environments

### Backend Test Cleanup

```typescript
// tests/stories/feature.story.test.ts

describe('Feature Story', () => {
  let testHelper: TestHelper;
  let createdIds: string[] = [];

  beforeAll(async () => {
    testHelper = await TestHelper.create();
  });

  afterAll(async () => {
    // CRITICAL: Clean up ALL created entities
    const db = testHelper.getDb();

    // Delete all test-created entities
    for (const id of createdIds) {
      await db.collection('entities').deleteOne({ _id: new ObjectId(id) });
    }

    // Delete test users (emails ending with @test.com)
    await db.collection('users').deleteMany({
      email: { $regex: /@test\.com$/ }
    });

    await testHelper.close();
  });

  it('should create entity', async () => {
    const result = await testHelper.rest('/api/entities', {
      method: 'POST',
      payload: { name: `Test-${Date.now()}` },
      token: userToken,
      statusCode: 201
    });

    // Track for cleanup
    createdIds.push(result.body.id);
  });
});
```

### Frontend E2E Test Cleanup

```typescript
// tests/e2e/feature.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Feature E2E', () => {
  const createdEntities: string[] = [];

  test.afterAll(async ({ request }) => {
    // Clean up via API
    for (const id of createdEntities) {
      await request.delete(`/api/entities/${id}`);
    }
  });

  test('should complete user workflow', async ({ page }) => {
    // Test implementation...
  });
});
```

### Test Data Best Practices

```typescript
// UNIQUE DATA GENERATION
const uniqueEmail = `user-${Date.now()}-${Math.random().toString(36).substring(2, 8)}@test.com`;
const uniqueName = `Test-Entity-${Date.now()}`;

// NEVER reuse data across test files
// NEVER rely on specific IDs or pre-existing data
// ALWAYS generate fresh test data
```

## Test Environment Configuration

### NODE_ENV Values

**CRITICAL: Understand the NODE_ENV values and their purpose!**

| NODE_ENV | Purpose | Used By |
|----------|---------|---------|
| `e2e` | **Local tests** (vitest, e2e-spec) | Developers running tests locally |
| `ci` | **CI/CD tests** | GitHub Actions, GitLab CI pipelines |
| `develop` | **Development server** | Deployed server for developers |
| `test` | **Customer staging server** | Deployed server for customer testing |
| `production` | **Production server** | Live production deployment |

**Key rule: `NODE_ENV=e2e` for ALL local backend tests!**
- `NODE_ENV=test` is **NOT** for running tests - it configures the customer-facing staging server
- `NODE_ENV=ci` is for CI/CD pipelines only, not for local execution

### Separate Test Database

```
┌────────────────────────────────────────────────────────────────────────────┐
│  ENVIRONMENT SEPARATION                                                    │
│                                                                            │
│  Local Development:                                                        │
│  ├── Database: mongodb://localhost:27017/app-dev                           │
│  ├── Port: 3000 (API), 3001 (App)                                          │
│  └── NODE_ENV=develop (or unset)                                           │
│                                                                            │
│  Local Testing (vitest):                                                   │
│  ├── Database: mongodb://localhost:27017/app-e2e (SEPARATE!)               │
│  ├── Port: assigned by TestHelper (random)                                 │
│  └── NODE_ENV=e2e                                                          │
│                                                                            │
│  CI/CD Testing:                                                            │
│  ├── Database: mongodb://localhost:27017/app-ci                            │
│  ├── Port: assigned by TestHelper (random)                                 │
│  └── NODE_ENV=ci                                                           │
│                                                                            │
│  Customer Staging Server:                                                  │
│  ├── Database: Staging MongoDB                                             │
│  ├── Port: configured                                                      │
│  └── NODE_ENV=test                                                         │
│                                                                            │
│  Production:                                                               │
│  ├── Database: Production MongoDB (Atlas/Self-hosted)                      │
│  ├── Port: 3000 (or configured)                                            │
│  └── NODE_ENV=production                                                   │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### npm Scripts for Test Environments

#### Backend (projects/api/package.json)

```json
{
  "scripts": {
    "start:dev": "NODE_ENV=develop nest start --watch",
    "test": "NODE_ENV=e2e vitest run",
    "test:watch": "NODE_ENV=e2e vitest",
    "test:cov": "NODE_ENV=e2e vitest run --coverage",
    "test:e2e": "NODE_ENV=e2e vitest run --config ./vitest.e2e.config.ts",
    "test:stories": "NODE_ENV=e2e vitest run --dir tests/stories"
  }
}
```

**Note:** `NODE_ENV=e2e` is for local test execution. CI/CD pipelines override this with `NODE_ENV=ci`.

#### Frontend (projects/app/package.json)

```json
{
  "scripts": {
    "dev": "nuxi dev --port 3001",
    "dev:test": "NODE_ENV=test nuxi dev --port 3101",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:headed": "playwright test --headed",
    "generate-types": "openapi-typescript http://localhost:3000/swagger-json -o ./app/api-client/types.gen.ts"
  }
}
```

#### Root (package.json) - Monorepo

```json
{
  "scripts": {
    "test:backend": "npm test --workspace=projects/api",
    "test:frontend": "npm run test:e2e --workspace=projects/app",
    "test:all": "npm run test:backend && npm run test:frontend"
  }
}
```

### Backend Test Environment (@lenne.tech/nest-server)

#### Configuration File (src/config.env.ts)

```typescript
import { ConfigEnv } from '@lenne.tech/nest-server';

// Environment-specific configuration
// NODE_ENV values: e2e (local tests), ci (CI/CD tests), develop, test (staging), production
const envConfig: Record<string, Partial<ConfigEnv>> = {
  develop: {
    mongoose: {
      uri: 'mongodb://localhost:27017/app-dev',
    },
    port: 3000,
  },
  e2e: {
    // Local test execution (vitest)
    mongoose: {
      uri: 'mongodb://localhost:27017/app-e2e',
    },
    // Port assigned by TestHelper (random) - do not hardcode
  },
  ci: {
    // CI/CD pipeline tests (GitHub Actions, GitLab CI)
    mongoose: {
      uri: 'mongodb://localhost:27017/app-ci',
    },
  },
  test: {
    // Customer-facing staging server (NOT for running tests!)
    mongoose: {
      uri: process.env.MONGODB_URI,
    },
    port: parseInt(process.env.PORT) || 3000,
  },
  production: {
    mongoose: {
      uri: process.env.MONGODB_URI,
    },
    port: parseInt(process.env.PORT) || 3000,
  },
};

export function getConfig(): ConfigEnv {
  const env = process.env.NODE_ENV || 'develop';
  return {
    ...defaultConfig,
    ...envConfig[env],
  };
}
```

#### Test Helper Configuration (tests/test.helper.ts)

```typescript
import { TestHelper } from '@lenne.tech/nest-server/test';

// TestHelper automatically uses NODE_ENV=e2e configuration (set via npm scripts)
export async function createTestHelper(): Promise<TestHelper> {
  const testHelper = await TestHelper.create({
    // Uses src/config.env.ts with NODE_ENV=e2e
  });
  return testHelper;
}
```

### Frontend Test Environment (Playwright)

#### playwright.config.ts

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html'], ['list']],

  use: {
    // Use test environment port
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:3101',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Start both API and App for E2E tests
  webServer: [
    {
      command: 'NODE_ENV=e2e npm run start:dev --workspace=projects/api',
      url: 'http://localhost:3000/api',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
    {
      command: 'npm run dev --workspace=projects/app',
      url: 'http://localhost:3001',
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
    },
  ],
});
```

### Docker Test Environment (Optional)

#### docker-compose.test.yml

```yaml
version: '3.8'

services:
  mongodb-test:
    image: mongo:7
    ports:
      - '27018:27017'  # Different port for test DB
    volumes:
      - mongodb_test_data:/data/db
    environment:
      MONGO_INITDB_DATABASE: app-test

  mailhog:
    image: mailhog/mailhog
    ports:
      - '1025:1025'    # SMTP
      - '8025:8025'    # Web UI

volumes:
  mongodb_test_data:
```

```bash
# Start test infrastructure
docker compose -f docker-compose.test.yml up -d

# Run tests
npm run test:all
```

## Workflow Steps in Detail

### Step 1: Write Backend Tests

**Location:** `tests/stories/` or `tests/api/`

**Goals:**
- Define expected API behavior
- Cover all endpoints (CRUD operations)
- Include authentication/authorization tests
- Test error cases and edge cases

**Example:**
```typescript
describe('Product API', () => {
  describe('Happy Path', () => {
    it('should create product as admin', async () => { /* ... */ });
    it('should list products as user', async () => { /* ... */ });
    it('should update own product', async () => { /* ... */ });
    it('should delete own product', async () => { /* ... */ });
  });

  describe('Error Cases', () => {
    it('should reject unauthorized access (401)', async () => { /* ... */ });
    it('should reject forbidden action (403)', async () => { /* ... */ });
    it('should validate input (400)', async () => { /* ... */ });
  });
});
```

### Step 2: Implement Backend

**Use `generating-nest-servers` skill for:**
- Module creation (`lt server module`)
- Object creation (`lt server object`)
- Property addition (`lt server addProp`)

**Iterate until all tests pass:**
```bash
npm test -- tests/stories/product.story.test.ts
```

### Step 3: Write Frontend E2E Tests

**Location:** `tests/e2e/` or `e2e/`

**Goals:**
- Test complete user workflows
- Cover critical user journeys
- Include authentication flows
- Test responsive behavior (optional)

**Example:**
```typescript
test.describe('Product Management', () => {
  test('should complete product creation workflow', async ({ page }) => {
    // 1. Login
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'admin@test.com');
    await page.fill('[data-testid="password"]', 'password');
    await page.click('[data-testid="submit"]');

    // 2. Navigate to products
    await page.goto('/products');
    await expect(page.locator('h1')).toContainText('Produkte');

    // 3. Create new product
    await page.click('[data-testid="create-product"]');
    await page.fill('[data-testid="product-name"]', 'Test Product');
    await page.click('[data-testid="save"]');

    // 4. Verify creation
    await expect(page.locator('text=Test Product')).toBeVisible();
  });
});
```

### Step 4: Implement Frontend

**Use `developing-lt-frontend` skill for:**
- Component creation
- Composable implementation
- Page layouts
- API integration

**Iterate until all E2E tests pass:**
```bash
npm run test:e2e
```

### Step 5: Browser Debugging

**For direct browser testing and debugging, always use the Chrome DevTools MCP (`mcp__chrome-devtools__*`) unless the user explicitly requests otherwise.** The Playwright-based Browser MCP (`mcp__MCP_DOCKER__browser_*`) is used for creating and running Playwright E2E tests.

**Use Chrome DevTools MCP for:**
- Live debugging during development
- Network request inspection
- Console error checking
- Visual verification with snapshots

**MCP Tools:**
| Tool | Use Case |
|------|----------|
| `navigate_page` | Go to specific URL |
| `take_snapshot` | Get page structure |
| `take_screenshot` | Visual capture |
| `list_console_messages` | Check JS errors |
| `list_network_requests` | Debug API calls |
| `click`, `fill` | Interact with elements |

## Running the Complete Test Suite

### Backend Tests
```bash
# All backend tests
npm test

# Specific story test
npm test -- tests/stories/product.story.test.ts

# With coverage
npm test -- --coverage
```

### Frontend E2E Tests
```bash
# All E2E tests
npm run test:e2e

# Specific test file
npx playwright test tests/e2e/product.spec.ts

# With UI mode (debugging)
npx playwright test --ui

# With headed browser
npx playwright test --headed
```

### Full Suite
```bash
# Run everything (CI)
npm run test:all
# or
npm test && npm run test:e2e
```

## Checklist

### Before Starting
- [ ] Test environment configured (separate database)
- [ ] Test utilities available (TestHelper for backend)
- [ ] Playwright configured for E2E tests
- [ ] Chrome DevTools MCP available for debugging

### During Development
- [ ] Tests written BEFORE implementation
- [ ] Tests fail initially (Red phase)
- [ ] Minimal implementation to pass tests (Green phase)
- [ ] Refactoring with tests passing (Refactor phase)

### After Completion
- [ ] All tests pass (`npm test && npm run test:e2e`)
- [ ] Test cleanup verified (run tests twice without issues)
- [ ] No hardcoded test data in production code
- [ ] Coverage acceptable (aim for >80%)

## Related Documentation

- **Backend TDD:** `workflow.md` (detailed 7-step process)
- **Backend Test Patterns:** `examples.md`, `reference.md`
- **Frontend E2E Testing:** `developing-lt-frontend` skill -> `reference/e2e-testing.md`
- **Security in Tests:** `security-review.md`
