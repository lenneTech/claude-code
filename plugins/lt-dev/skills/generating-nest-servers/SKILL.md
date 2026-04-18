---
name: generating-nest-servers
description: Handles ALL NestJS and @lenne.tech/nest-server development tasks including module creation, service implementation, controller/resolver development, model definition, and debugging. Covers lt server commands, @Roles/@Restricted security, CrudService patterns, and API tests. Supports monorepos (projects/api/, packages/api/). Activates when working with src/server/ files, NestJS modules, services, controllers, resolvers, models, DTOs, guards, decorators, or REST/GraphQL endpoints. NOT for Vue/Nuxt frontend (use developing-lt-frontend). NOT for nest-server version updates (use nest-server-updating). NOT for TDD workflow orchestration (use building-stories-with-tdd).
effort: high
paths:
  - "**/src/server/**"
  - "**/projects/api/**"
  - "**/packages/api/**"
  - "**/*.module.ts"
  - "**/*.service.ts"
  - "**/*.controller.ts"
  - "**/*.resolver.ts"
  - "**/*.model.ts"
---

# NestJS Server Development Expert

## Ecosystem Context

Developers typically work in a **Lerna fullstack monorepo** created via `lt fullstack init`:

```
project/
├── projects/
│   ├── api/    ← nest-server-starter (depends on @lenne.tech/nest-server)
│   └── app/    ← nuxt-base-starter (depends on @lenne.tech/nuxt-extensions)
├── lerna.json
└── package.json (workspaces: ["projects/*"])
```

**Package relationships:**
- **nest-server-starter** (template) → depends on **@lenne.tech/nest-server** (core package)
- **nuxt-base-starter** (template) → depends on **@lenne.tech/nuxt-extensions** → aligned with nest-server
- This skill covers `projects/api/` and any code depending on `@lenne.tech/nest-server`

## When to Use This Skill

- Creating/modifying NestJS modules, services, controllers, resolvers, models
- Running/debugging the NestJS server (`pnpm start`, `pnpm run dev`, `pnpm test`)
- Using `lt server module`, `lt server object`, `lt server addProp`, `lt server create`
- Creating API tests for controllers/resolvers
- Analyzing existing NestJS code, architecture, relationships
- Answering NestJS/@lenne.tech/nest-server questions

**Rule: If it involves NestJS or @lenne.tech/nest-server in ANY way, use this skill!**

## Skill Boundaries

| User Intent | Correct Skill |
|------------|---------------|
| "Create a NestJS module" | **THIS SKILL** |
| "Debug a service error" | **THIS SKILL** |
| "Add a REST endpoint" | **THIS SKILL** |
| "Update nest-server to v14" | nest-server-updating |
| "Write tests first, then implement" | building-stories-with-tdd |
| "Update npm packages" | maintaining-npm-packages |
| "Build a Vue component" | developing-lt-frontend |
| "Run lt fullstack init" | using-lt-cli |

## Related Skills & Commands

- `developing-lt-frontend` - For ALL Nuxt/Vue frontend development (projects/app/)
- `building-stories-with-tdd` - For TDD workflow (tests first, then implementation)
- `using-lt-cli` - For Git operations and Fullstack initialization
- `nest-server-updating` - For updating @lenne.tech/nest-server versions
- `contributing-to-lt-framework` - When modifying `@lenne.tech/nest-server` itself and testing via `pnpm link`
- `/lt-dev:review` - General security review of branch diff
- `/lt-dev:backend:sec-review` - Security review after implementing endpoints or modifying auth/authz
- `/lt-dev:backend:sec-audit` - Full OWASP security audit for dependencies, config, and code

**In monorepo projects:**
- `projects/api/` or `packages/api/` → This skill
- `projects/app/` or `packages/app/` → `developing-lt-frontend`

## Dev Server Lifecycle

When starting `nest start` / `pnpm dev` (or any long-running process) for manual API testing, debugging, or E2E tests: **always** use `run_in_background: true` and `pkill -f "nest start"` afterwards. Leaving dev servers orphaned blocks the Claude Code session ("Unfurling..."). Full rules: `managing-dev-servers` skill.

## CRITICAL RULES

### CLI-First Development

When creating new modules, objects, or adding properties, **use `lt server` CLI commands first** before writing code manually. The CLI generates complete, standards-compliant scaffolding with all decorators, imports, and module integration.

```bash
# Always add --noConfirm --skipLint for non-interactive execution
lt server module --name Product --controller Rest --noConfirm --skipLint \
  --prop-name-0 name --prop-type-0 string \
  --prop-name-1 price --prop-type-1 number

lt server object --name Address --noConfirm --skipLint \
  --prop-name-0 city --prop-type-0 string

lt server addProp --type Module --element User --noConfirm --skipLint \
  --prop-name-0 avatar --prop-type-0 string --prop-nullable-0 true
```

**After CLI scaffolding**, customize the generated code: business logic, security rules (`securityCheck`), descriptions, and custom methods.

**Complete flag reference: [reference/configuration.md](${CLAUDE_SKILL_DIR}/reference/configuration.md#property-flags-reference)**

### Security (NON-NEGOTIABLE)

1. **NEVER** remove/weaken `@Restricted()` or `@Roles()` decorators
2. **NEVER** modify `securityCheck()` to bypass security
3. **ALWAYS** analyze permissions BEFORE writing tests
4. **ALWAYS** test with the LEAST privileged authorized user
5. **VERIFY** decorator coverage with `lt server permissions` after creating modules

**Complete security rules: [reference/security-rules.md](${CLAUDE_SKILL_DIR}/reference/security-rules.md)** | **OWASP checklist: [reference/owasp-checklist.md](${CLAUDE_SKILL_DIR}/reference/owasp-checklist.md)**

### Prefer CrudService Over Direct Model Access

**ALWAYS prefer CrudService methods over direct Mongoose model calls.**

```typescript
// AVOID - Direct model access bypasses security and permissions
const product = await this.productModel.findOne({ _id: id });
const users = await this.mainDbModel.find({ active: true });
await this.orderModel.updateOne({ _id: id }, { status: 'done' });

// PREFERRED - CrudService methods handle security, permissions, population
const product = await this.findOne({ id }, serviceOptions);
const users = await this.find({ filterQuery: { active: true }, currentUser });
await this.update(id, input, serviceOptions);
await this.userService.findOne({ id: userId }, { currentUser });
```

**Why CrudService first:**
- `checkRestricted()` enforces field-level `@Restricted` permissions (set via `@UnifiedField({ roles })`) — direct model access bypasses this
- Handles population, filtering, validation, and sanitization automatically
- `@Roles` is enforced by RolesGuard at controller level; field-level `@Restricted` goes through `checkRestricted()` in the service layer

**Legitimate exceptions for direct model access:**
- Setting fields that CrudService doesn't expose (e.g., password hashes directly in DB)
- Aggregation pipelines or bulk operations not supported by CrudService
- Performance-critical bulk migrations

When using direct model access, **add a comment explaining why** CrudService can't be used.

**Details: [reference/framework-guide.md](${CLAUDE_SKILL_DIR}/reference/framework-guide.md#prefer-crudservice-over-direct-model-access)**

### Never Use `declare` Keyword

```typescript
// WRONG - Decorator won't work!
declare name: string;

// CORRECT
@UnifiedField({ description: 'Product name' })
name: string;
```

**Details: [reference/declare-keyword-warning.md](${CLAUDE_SKILL_DIR}/reference/declare-keyword-warning.md)**

### Description Management

Apply descriptions consistently to EVERY component (Model, CreateInput, UpdateInput, Objects, Class-level decorators). Format: `'English text'` or `'English (Deutsch)'` for German input.

**Complete guide: [reference/description-management.md](${CLAUDE_SKILL_DIR}/reference/description-management.md)**

## Quick Command Reference

```bash
# Create module (REST is default!) — always use --noConfirm --skipLint
lt server module --name Product --controller Rest --noConfirm --skipLint

# Create SubObject
lt server object --name Address --noConfirm --skipLint

# Add properties
lt server addProp --type Module --element User --noConfirm --skipLint

# New project
lt server create <server-name> --noConfirm

# Permissions report (audit @Roles, @Restricted, securityCheck)
lt server permissions --format html --open
lt server permissions --format json --output permissions.json
lt server permissions --failOnWarnings  # CI/CD mode
```

**API Style:** REST is default. Use `--controller GraphQL` only when explicitly requested.

**Complete configuration & property flags: [reference/configuration.md](${CLAUDE_SKILL_DIR}/reference/configuration.md)**

## TDD Recommendation

```
1. Detect test framework BEFORE writing or running any test (see below)
2. Write API tests FIRST (REST/GraphQL endpoint tests)
3. Implement backend code until tests pass
4. Iterate until all tests green
5. Then proceed to frontend (E2E tests first)
```

### Detect Test Framework First (CRITICAL)

**BEFORE writing or running ANY test**, detect which framework and import style the project uses. Vitest vs. Jest, plus `globals: true/false` in `vitest.config.ts`, determines whether `describe`/`it`/`expect` must be imported.

**Details: [reference/workflow-process.md](${CLAUDE_SKILL_DIR}/reference/workflow-process.md#phase-7-api-test-creation)**

For full TDD workflow orchestration, use `building-stories-with-tdd` skill.

### Test Cleanup (CRITICAL)

```typescript
afterAll(async () => {
  await db.collection('entities').deleteMany({ createdBy: testUserId });
  await db.collection('users').deleteMany({ email: /@test\.com$/ });
});
```

**Use separate test database:** `app-test` instead of `app-dev`

## Framework Source Files (MUST READ before guessing)

**ALWAYS read actual source code** before guessing framework behavior. lenne.tech projects ship the framework source in one of two consumption modes:

- **npm mode** — `@lenne.tech/nest-server` installed as a dependency. Source lives in `node_modules/@lenne.tech/nest-server/`.
- **vendored mode** — `src/core/VENDOR.md` exists in the api project. Source lives DIRECTLY in `<api-root>/src/core/` as first-class project code (no `@lenne.tech/nest-server` npm dependency). Detect via `test -f <api-root>/src/core/VENDOR.md`.

All paths in the table below use the npm-mode base. **In vendored projects, substitute**:
- `node_modules/@lenne.tech/nest-server/src/core/` → `src/core/`
- `node_modules/@lenne.tech/nest-server/src/core.module.ts` → `src/core/core.module.ts`
- `node_modules/@lenne.tech/nest-server/CLAUDE.md` → `src/core/VENDOR.md` (vendored projects document the baseline + local patches here instead)
- `node_modules/@lenne.tech/nest-server/FRAMEWORK-API.md` → same concept in upstream repo; vendored projects may copy it into `src/core/` during sync, else consult the upstream GitHub repo at the baseline tag recorded in `VENDOR.md`.
- `node_modules/@lenne.tech/nest-server/.claude/rules/` → not shipped into vendored projects; read from the upstream repo if needed.

Generated imports MUST match the project mode:
- npm: `import { CrudService } from '@lenne.tech/nest-server';`
- vendored: `import { CrudService } from '../../../core';` (relative depth varies by file location)

| File (in `node_modules/@lenne.tech/nest-server/`) | When to Read |
|---------------------------------------------------|-------------|
| `CLAUDE.md` | Start of any backend task — framework rules and architecture |
| `FRAMEWORK-API.md` | Quick API reference — all interfaces, method signatures |
| `src/core.module.ts` | Module registration, `CoreModule.forRoot()` parameters |
| `src/core/common/interfaces/server-options.interface.ts` | ALL config interfaces (`IServerOptions`, `IBetterAuth`, `ICoreModuleOverrides`) |
| `src/core/common/interfaces/service-options.interface.ts` | `ServiceOptions` interface for service method calls |
| `src/core/common/services/crud.service.ts` | CrudService base class — ALL services extend this |
| `src/core/modules/*/INTEGRATION-CHECKLIST.md` | Integration steps when extending core modules |
| `src/core/modules/*/README.md` | Per-module documentation and usage |
| `docs/REQUEST-LIFECYCLE.md` | Complete request flow, interceptors, decorators |
| `.claude/rules/` | 11 rule files (architecture, security, testing, modules, etc.) |

## Framework Essentials

- [ ] Read CrudService before modifying any Service
- [ ] **Prefer CrudService methods** (`this.findOne()`, `this.find()`, `this.update()`) over direct model access (`this.someModel.findOne()`, `mainDbModel.find()`) — direct model access only with comment explaining why
- [ ] NEVER blindly pass all serviceOptions to other Services (only pass `currentUser`)
- [ ] Check if CrudService already provides needed functionality
- [ ] Read `FRAMEWORK-API.md` for quick overview of available interfaces and methods

**Complete framework guide: [reference/framework-guide.md](${CLAUDE_SKILL_DIR}/reference/framework-guide.md)**

## Workflow (7 Phases)

1. **Analysis & Planning** - Parse spec, create todo list
2. **SubObject Creation** - Create in dependency order
3. **Module Creation** - Create with all properties
4. **Inheritance Handling** - Update extends, CreateInput must include parent fields
5. **Description Management** - Extract from comments, apply everywhere
6. **Enum File Creation** - Manual creation in `src/server/common/enums/`
7. **API Test Creation** - Analyze permissions first, use least privileged user

**Complete workflow: [reference/workflow-process.md](${CLAUDE_SKILL_DIR}/reference/workflow-process.md)**

## Property Ordering

**ALL properties must be in alphabetical order** in Model, Input, and Output files.

## Permissions Report

The `@lenne.tech/nest-server` includes a built-in permissions scanner that audits `@Roles`, `@Restricted`, and `securityCheck()` usage across all modules.

- **CLI**: `lt server permissions` (generates MD/JSON/HTML report via AST scan — preferred)
- **Runtime**: Enable `permissions: true` in `config.env.ts` for a live dashboard at `GET /permissions`

The scanner detects: missing class-level `@Restricted`, endpoints without `@Roles`, models without `securityCheck()`, unrestricted fields, and unrestricted methods. **Use after creating new modules** to verify decorator coverage.

## Verification Checklist

- [ ] All components created with descriptions (Model + CreateInput + UpdateInput)
- [ ] Properties in alphabetical order
- [ ] Permission analysis BEFORE writing tests
- [ ] Least privileged user used in tests
- [ ] Security validation tests (401/403 failures)
- [ ] Permissions report shows no new warnings (`lt server permissions --failOnWarnings`)
- [ ] Security review passed (`/lt-dev:backend:sec-review`)
- [ ] All tests pass

**Complete checklist: [reference/verification-checklist.md](${CLAUDE_SKILL_DIR}/reference/verification-checklist.md)**

## Reference Files

| Topic | File |
|-------|------|
| Permissions Report | Built-in: `lt server permissions` / `GET /permissions` |
| Service Health Check | [reference/service-health-check.md](${CLAUDE_SKILL_DIR}/reference/service-health-check.md) |
| Framework Guide | [reference/framework-guide.md](${CLAUDE_SKILL_DIR}/reference/framework-guide.md) |
| Configuration & Commands | [reference/configuration.md](${CLAUDE_SKILL_DIR}/reference/configuration.md) |
| Specification Format | [reference/reference.md](${CLAUDE_SKILL_DIR}/reference/reference.md) |
| Examples | [reference/examples.md](${CLAUDE_SKILL_DIR}/reference/examples.md) |
| Workflow Process | [reference/workflow-process.md](${CLAUDE_SKILL_DIR}/reference/workflow-process.md) |
| Description Management | [reference/description-management.md](${CLAUDE_SKILL_DIR}/reference/description-management.md) |
| Security Rules | [reference/security-rules.md](${CLAUDE_SKILL_DIR}/reference/security-rules.md) |
| OWASP Checklist | [reference/owasp-checklist.md](${CLAUDE_SKILL_DIR}/reference/owasp-checklist.md) |
| Declare Keyword Warning | [reference/declare-keyword-warning.md](${CLAUDE_SKILL_DIR}/reference/declare-keyword-warning.md) |
| Quality Review | [reference/quality-review.md](${CLAUDE_SKILL_DIR}/reference/quality-review.md) |
| Verification Checklist | [reference/verification-checklist.md](${CLAUDE_SKILL_DIR}/reference/verification-checklist.md) |
| TypeScript Conventions | [reference/typescript-conventions.md](${CLAUDE_SKILL_DIR}/reference/typescript-conventions.md) |
| MCP Integration | [reference/mcp-integration.md](${CLAUDE_SKILL_DIR}/reference/mcp-integration.md) |

## TypeScript Language Server (Recommended)

| Operation | Use Case |
|-----------|----------|
| `goToDefinition` | Find where a class/function/type is defined |
| `findReferences` | Find all usages of a symbol |
| `hover` | Get type info and documentation |
| `documentSymbol` | List all symbols in a file |
| `workspaceSymbol` | Search symbols across the project |
| `goToImplementation` | Find implementations of interfaces |
| `incomingCalls` / `outgoingCalls` | Analyze call dependencies |
