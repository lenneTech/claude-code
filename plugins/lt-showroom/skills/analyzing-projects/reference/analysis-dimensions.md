# Analysis Dimensions — Detailed Guide

Each of the 8 analysis dimensions has a specific scope, a set of files to read, and expected output fields.

---

## Dimension 1: Technology Stack

**Goal:** Identify every significant technology used in the project with its version.

**Files to read:**
- `package.json` (Node.js)
- `Cargo.toml` (Rust)
- `requirements.txt` / `pyproject.toml` (Python)
- `go.mod` (Go)
- `pom.xml` / `build.gradle` (Java/Kotlin)
- `Gemfile` (Ruby)
- `composer.json` (PHP)
- `pubspec.yaml` (Dart/Flutter)

**Output fields:**
- `language` — Primary programming language(s)
- `runtime` — Node.js version, Python version, JVM version, etc.
- `primaryFramework` — Nuxt, Next.js, NestJS, Django, Rails, Spring Boot, etc.
- `uiLibrary` — React, Vue, Angular, Svelte, etc.
- `database` — MongoDB, PostgreSQL, MySQL, SQLite, Redis, etc.
- `infrastructure` — Docker, Kubernetes, Serverless, etc.
- `keyLibraries` — Array of `{ name, version, purpose }`

---

## Dimension 2: Architecture

**Goal:** Understand how the codebase is organized and what patterns are applied.

**Files to read:**
- Root directory structure (`ls` of project root)
- `src/` or `app/` directory structure
- Module/package boundaries
- Configuration files (`nest-cli.json`, `nuxt.config.ts`, `webpack.config.js`, etc.)

**Output fields:**
- `pattern` — MVC, Clean Architecture, Hexagonal, Microservices, Monolith, etc.
- `structure` — Monorepo vs. single-package, module breakdown
- `layering` — How concerns are separated (controller/service/repository, etc.)
- `notableDecisions` — Array of significant architectural choices with rationale

---

## Dimension 3: Core Features

**Goal:** Extract the product's main user-facing capabilities.

**Files to read:**
- Controllers (`*.controller.ts`, routes files)
- Resolvers (`*.resolver.ts`, `*.graphql`)
- Services (`*.service.ts`)
- Frontend pages and composables

**Output fields:**
- `features` — Array of `{ name, description, evidence: "file:line" }`
- `userRoles` — Roles detected (admin, user, guest, etc.)
- `multiTenancy` — Whether the system supports multiple tenants/organizations

---

## Dimension 4: API Surface

**Goal:** Document the external interface of the application.

**Files to read:**
- REST controllers (look for `@Controller`, `@Get`, `@Post`, `@Put`, `@Delete`, `@Patch`)
- GraphQL resolvers and schema files
- Middleware, guards, and interceptors

**Output fields:**
- `type` — REST, GraphQL, gRPC, WebSocket, or combination
- `endpoints` — Array of `{ method, path, auth, description }` for REST
- `operations` — Array of `{ type, name, auth, description }` for GraphQL
- `authentication` — JWT, OAuth 2.0, session, API key, Better Auth, etc.
- `authorization` — Role-based (RBAC), attribute-based (ABAC), etc.

---

## Dimension 5: Testing Strategy

**Goal:** Assess the breadth and depth of the test suite.

**Files to read:**
- All `*.spec.ts`, `*.test.ts`, `*_test.go`, `test_*.py`, `*_spec.rb` files
- Test configuration (`jest.config.ts`, `vitest.config.ts`, `playwright.config.ts`, etc.)

**Output fields:**
- `frameworks` — Jest, Vitest, Playwright, Cypress, pytest, RSpec, etc.
- `types` — Array of `{ type: "unit"|"integration"|"e2e"|"api", count, coverage }`
- `breadth` — Which modules/features have tests vs. which are untested
- `assessment` — `high` / `medium` / `low` / `minimal`

---

## Dimension 6: UI/UX Patterns

**Goal:** For frontend-containing projects, document the design and interaction system.

**Applies to:** Projects with a `projects/app/`, `frontend/`, `ui/`, or `src/` containing Vue/React/Svelte components.

**Files to read:**
- Component files (`*.vue`, `*.tsx`, `*.svelte`)
- Style files (`tailwind.config.ts`, `*.css`, `*.scss`)
- Layout files
- Composables / hooks for state management

**Output fields:**
- `componentLibrary` — Nuxt UI, shadcn/ui, MUI, Ant Design, Headless UI, etc.
- `styling` — Tailwind CSS, CSS-in-JS, SCSS modules, etc.
- `stateManagement` — Pinia, Redux, Zustand, Jotai, Vuex, etc.
- `responsive` — Whether responsive design patterns are present
- `accessibility` — ARIA usage, keyboard nav patterns, color contrast attention

---

## Dimension 7: Security Measures

**Goal:** Surface security-relevant implementations in the codebase.

**Files to read:**
- Auth guards and middleware
- Input validation (class-validator, zod, joi, express-validator, etc.)
- CORS and security header configuration
- Environment variable usage
- Rate limiting setup

**Output fields:**
- `authentication` — How auth is implemented (JWT claims, session, etc.)
- `authorization` — Guards, decorators, policies
- `inputValidation` — Framework and scope
- `rateLimiting` — Present and configured, or absent
- `secretsManagement` — ConfigService pattern, dotenv, vault, etc.
- `securityHeaders` — Helmet, custom headers, CORS policy
- `encryption` — Data at rest, TLS, bcrypt for passwords, etc.

---

## Dimension 8: Performance Optimizations

**Goal:** Identify performance-conscious implementations.

**Files to read:**
- Cache configurations (Redis, in-memory, HTTP cache headers)
- Database query files (aggregations, indexes, pagination)
- Background job files (queues, workers, cron jobs)
- Frontend build config (code splitting, lazy loading, SSR/SSG)

**Output fields:**
- `caching` — Redis, in-memory, CDN, HTTP caching patterns
- `databaseOptimizations` — Indexes, pagination, projection, aggregation
- `asyncProcessing` — Bull/BullMQ queues, cron jobs, webhooks
- `frontendPerformance` — SSR/SSG, code splitting, lazy loading, image optimization
- `observability` — Logging, metrics, tracing (if present)
