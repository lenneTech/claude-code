---
name: generating-nest-servers
description: Handles ALL NestJS and @lenne.tech/nest-server development tasks including module creation, service implementation, controller/resolver development, model definition, and debugging. Covers lt server commands, @Roles/@Restricted security, CrudService patterns, and API tests. Supports monorepos (projects/api/, packages/api/). Activates when working with src/server/ files, NestJS modules, services, controllers, resolvers, models, DTOs, guards, decorators, or REST/GraphQL endpoints. NOT for Vue/Nuxt frontend (use developing-lt-frontend). NOT for nest-server version updates (use nest-server-updating). NOT for TDD workflow orchestration (use building-stories-with-tdd).
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

## Gotchas

- **`declare` keyword on Model properties kills decorators** — `declare name: string` tells TypeScript "this property exists but isn't emitted at runtime" — which means Mongoose/Typegoose decorators (`@Prop`, `@Field`) attached to it are lost. Always use `name!: string` (definite assignment) or `name: string = ''` (default value) on model fields. Tests pass silently in memory but production MongoDB writes drop the field.
- **`securityCheck()` returning `this` unchanged is a red flag** — A trivial `return this;` implementation means no permission boundary exists on the model. The decorator system requires `@Restricted`/`@Roles` + an actual check (usually filtering sensitive fields or verifying ownership). If the model genuinely has nothing to restrict, add a comment explaining why — otherwise it will be flagged in every security review.
- **`--controller` flag generates REST — even in GraphQL projects** — `lt server object <name> --controller` produces a REST controller by default. For GraphQL projects, use `--resolver` instead. The CLI does not auto-detect from the project's existing pattern.
- **`CrudService` is the default — always extend it** — New modules often get hand-rolled service classes instead of `extends CrudService`. The framework's pagination, filtering, population, and permission integration all depend on CrudService inheritance. Hand-rolled services break `/api/<entity>/find` queries silently for consumers.
- **Alphabetical property order is enforced in reviews** — Class fields, DTO properties, and model definitions are reviewed for alphabetical ordering. Generated code from `lt server` usually respects this; hand-edited additions often break it. Run a final pass before committing.

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

### Prefer CrudService Over Direct Model Access (Informed-Trade-off Pattern — Rule 14)

**Prefer CrudService methods over direct access to your own Mongoose Model** (`this.mainDbModel.xxx` / `this.<modelName>Model.xxx` inside the owning Service). Direct own-Model access is an instance of the [Informed-Trade-off Pattern](${CLAUDE_SKILL_DIR}/reference/informed-trade-off-pattern.md) (see also `reference/security-rules.md` Rule 14): allowed with a good reason, but every use must be analyzed for unintentionally bypassed processes, skipped authorization, or missing side-effects.

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

**Legitimate reasons to opt out (direct own-Model access):**
- MongoDB atomic operators (`$push`, `$pull`, `$inc`, `$addToSet`) via `findByIdAndUpdate` — CrudService.update() doesn't expose these
- Aggregation pipelines (`.aggregate([...])`) for reporting/stats
- Setting internal fields that CrudService doesn't expose (password hashes, verification tokens, internal flags)
- Bulk operations (`bulkWrite`, `insertMany`, `deleteMany`) for migrations or cleanup
- Performance hot-paths where `process()` overhead is measurable
- SubDocument array operations that must avoid Proxy/process() (Rule 9)

**Mandatory check before every direct own-Model access — ensure nothing is unintentionally bypassed or a side-effect is missed:**
1. **Authorization still covered?** `checkRestricted()` is skipped. If the result reaches a user and the Model has role-restricted `@UnifiedField({ roles })` fields: either follow up with `super.update(id, {}, serviceOptions)` to run the pipeline, or manually apply the filter.
2. **Input validation still covered?** `process()` is skipped. Validate any service-built payload shapes explicitly.
3. **Side-effects still fired?** Events/hooks dispatched by CrudService are skipped — trigger manually if downstream code depends on them (relation updates, cache invalidation, notifications).
4. **Mixing consistency?** Direct access mixed with CrudService calls in the same method creates divergent code paths — note when intentional.

**Documentation in code:** comment the reason + which CrudService logic is safely bypassed OR manually replicated. Preferred follow-up patterns:
- Atomic op + full pipeline rerun: `this.mainDbModel.findByIdAndUpdate(id, { $push: {...} }); await super.update(id, {}, serviceOptions);`
- Direct query + framework helper: `const doc = await this.mainDbModel.findById(id).exec(); return this.processResult(doc, serviceOptions);` (`processResult` runs population + `prepareOutput`/secret removal but requires YOU to authorize upstream)
- Aggregation with hydration: `const raw = await this.mainDbModel.aggregate(pipeline); return raw.map(r => this.mainModelConstructor.map(r));` or `raw.map(r => this.mainDbModel.hydrate(r))`.

**`Force` and `Raw` variants — Rule 15:** every CrudService method has `*Force` (disables `checkRights` + `removeSecrets` + RoleGuard) and `*Raw` (additionally disables `prepareInput`/`prepareOutput` entirely) variants. Use `getForce`/`findForce`/`createForce`/etc. for system-internal flows where no user exists. **Results may contain passwords, tokens, and hidden fields** — they MUST NOT reach a user response without explicit field stripping. `*Raw` returns closest-to-DB shape, no translations, no type mapping. See `reference/security-rules.md` Rule 15.

**Native driver access — Rules 5-6:** `mainDbModel.collection` and `mainDbModel.db` are blocked at the type level via `SafeModel<T>`. Use `this.getNativeCollection(reason)` or `this.getNativeConnection(reason)` — both require ≥20-char reasons and log `[SECURITY]` warnings. Bypasses ALL Mongoose plugins.

**Informed-Trade-off Pattern:** several framework conventions have a standard safe path AND an opt-out for good reasons. Opt-outs require: (1) a documented reason in code, (2) analysis of what the standard path does that the opt-out skips, (3) either safe-skip justification or manual replication of bypassed logic. Applies to: foreign `@InjectModel` (Rule 12), plain-object responses (Rule 13), direct own-Model access (Rule 14), `Force`/`Raw` variants (Rule 15), native-driver access (Rules 5-6), deprecated-API use (Deprecation-scan phase). Full pattern definition: [`reference/informed-trade-off-pattern.md`](${CLAUDE_SKILL_DIR}/reference/informed-trade-off-pattern.md).

**Foreign Model Rule — Rule 12 instance of the Informed-Trade-off Pattern (applies ONLY to Models that do NOT belong to this Service):** `@InjectModel(X.name)` for the Service's OWN primary Model (passed to `super({ mainDbModel })`) is the standard pattern — no extra requirements. Injecting any OTHER Model is allowed but requires (1) good reason in a code comment, (2) analysis of the corresponding Service (`securityCheck()`, `@Restricted`/`@Roles`, ownership, field filtering, hooks, events, side-effects). See `reference/security-rules.md` Rule 12.

**Model Instances vs. Plain Objects — Rule 13 instance of the Informed-Trade-off Pattern:** the `CheckSecurityInterceptor` calls each response object's `securityCheck(user, force)` after the controller returns. Plain objects (from `.lean()`, `toObject()`, spreads `{ ...doc }`, raw `aggregate()` output, native-driver results) **lose the Model-specific `securityCheck` logic** — ownership checks and role-based field clearing do not run. Framework `removeSecrets()` still strips configured `secretFields` and `processDeep` still recurses to nested Model instances, so plain objects are a trade-off, not an automatic leak. See `reference/security-rules.md` Rule 13. Rule 12 and Rule 13 share the same bypass vectors on `securityCheck`; a single call site can hit both.

**`CoreModel.securityCheck` default `return this` is intentional** when the Model has nothing to filter. Before accepting a trivial implementation, **actively evaluate** whether `securityCheck` is the only place where required authorization can live — ownership-based field visibility, relationship-based visibility, state-dependent exposure, conditional record hiding (`return undefined` in list responses), cross-field visibility rules. None of these can be expressed via `@Roles`/`@Restricted`/controller guards.

**Details: [reference/framework-guide.md](${CLAUDE_SKILL_DIR}/reference/framework-guide.md#prefer-crudservice-over-direct-model-access)**

### Error Handling — Always Use `ErrorCode` (NON-NEGOTIABLE)

**NEVER throw NestJS exceptions with raw string messages.** Every project MUST use the framework's structured `ErrorCode` registry (`src/core/modules/error-code/`).

```typescript
// WRONG — raw string, no code, not translatable
throw new NotFoundException('Buyer not found');
throw new BadRequestException('Invalid ObjectId format');

// CORRECT — typed code with #CODE: marker + auto-translation
import { ErrorCode } from '../../common/errors/project-errors';
throw new NotFoundException(ErrorCode.RESOURCE_NOT_FOUND);
throw new BadRequestException(ErrorCode.INVALID_FIELD_FORMAT);
```

**Mandatory baseline per project:**
1. `src/server/common/errors/project-errors.ts` with `ProjectErrors` registry + `ErrorCode = mergeErrorCodes(ProjectErrors)` export
2. `errorCode: { additionalErrorRegistry: ProjectErrors }` in EVERY env block of `src/config.env.ts`
3. Import `ErrorCode` from the project file (NOT from `@lenne.tech/nest-server`) to get LTNS_* + PROJ_* combined
4. Reuse `LTNS_*` core codes when generic (not-found, validation, unauthorized); define `PROJ_XXXX` only for domain-specific semantics
5. Pick ONE project prefix (`PROJ_`, `APP_`, …) and never mix

**Complete rules, ranges, HTTP mapping & migration pattern: [reference/error-handling.md](${CLAUDE_SKILL_DIR}/reference/error-handling.md)** | **Integration scenarios: `src/core/modules/error-code/INTEGRATION-CHECKLIST.md`**

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
- [ ] **ALL exceptions use `ErrorCode`** from `src/server/common/errors/project-errors.ts` — zero raw-string `throw new XxxException('...')` outside tests
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
- [ ] All thrown exceptions use typed `ErrorCode` keys (no raw string messages)
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
| Error Handling (ErrorCode) | [reference/error-handling.md](${CLAUDE_SKILL_DIR}/reference/error-handling.md) |
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
