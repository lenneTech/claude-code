---
name: nest-server-generator-security-rules
description: Critical security and test coverage rules for NestJS development
---

#  CRITICAL SECURITY RULES

## Table of Contents
- [Informed-Trade-off Pattern (Meta-Rule)](#informed-trade-off-pattern-meta-rule)
- [ErrorCode Contract (Meta-Rule)](#errorcode-contract-meta-rule)
- [NEVER Do This](#-never-do-this)
- [ALWAYS Do This](#-always-do-this)
- [Permission Hierarchy (Specific Overrides General)](#-permission-hierarchy-specific-overrides-general)
- [Rule 1: NEVER Weaken Security for Test Convenience](#rule-1-never-weaken-security-for-test-convenience)
- [Rule 2: Understanding Permission Hierarchy](#rule-2-understanding-permission-hierarchy)
- [Rule 3: Adapt Tests to Security, Not Vice Versa](#rule-3-adapt-tests-to-security-not-vice-versa)
- [Rule 4: Test with Least Privileged User](#rule-4-test-with-least-privileged-user)
- [Rule 5: Create Appropriate Test Users](#rule-5-create-appropriate-test-users)
- [Rule 6: Comprehensive Test Coverage](#rule-6-comprehensive-test-coverage)
- [Quick Security Checklist](#quick-security-checklist)
- [Security Decision Protocol](#security-decision-protocol)

**Before you start ANY work, understand these NON-NEGOTIABLE rules.**

---

## Informed-Trade-off Pattern (Meta-Rule)

A framework-wide meta-rule defines the common shape for **standard safe path + documented opt-out** scenarios. Rules 12 (foreign `@InjectModel`), 13 (plain-object responses), 14 (direct own-Model access), 15 (`Force`/`Raw` variants), and the Deprecation-Scan phase of every reviewer all instantiate this pattern.

**Full definition:** [`informed-trade-off-pattern.md`](informed-trade-off-pattern.md)

**Short form:** standard path → opt-out with documented reason → mandatory pre-use analysis of skipped logic → documentation comment → review severity depends on what is actually bypassed.

---

## ErrorCode Contract (Meta-Rule)

All NestJS exceptions MUST use typed `ErrorCode` values from the project's error registry. This is **NON-NEGOTIABLE** — raw-string messages break the i18n contract (`GET /i18n/errors/:locale`), bypass the `#PREFIX_XXXX:` machine-parseable marker consumed by the frontend `useLtErrorTranslation` composable, and are a common OWASP A09 Information Disclosure vector (interpolated SQL, stacktraces, file paths).

**Full definition:** [`error-handling.md`](error-handling.md)

**Short form:** `throw new NotFoundException(ErrorCode.RESOURCE_NOT_FOUND)` — NEVER `throw new NotFoundException('User not found')`. Reuse `LTNS_*` core codes when generic; define `PROJ_*` codes for domain-specific semantics; wire `additionalErrorRegistry: ProjectErrors` in every env config. See Rule 16 below for the complete rule.

---

##  NEVER Do This

1. **NEVER remove or weaken `@Restricted()` decorators** to make tests pass
2. **NEVER change `@Roles()` decorators** to more permissive roles for test convenience
3. **NEVER modify `securityCheck()` logic** to bypass security in tests
4. **NEVER remove class-level `@Restricted(RoleEnum.ADMIN)`** - it's a security fallback
5. **NEVER use `model.collection.*` or `model.db.*` methods** — these bypass ALL Mongoose security plugins (Tenant, Audit, RoleGuard, Password).
   - Use `Model.create(doc)` instead of `collection.insertOne(doc)` — fastest for single docs (3x faster than `save()`, 9x less memory). For batch inserts: `Model.insertMany(docs)`
   - Use `Model.bulkWrite(ops)` instead of `collection.bulkWrite(ops)`
   - Use `Model.findByIdAndUpdate()` instead of `collection.updateOne()`
   - Only exception: `this.getNativeCollection(reason)` or `this.getNativeDb(reason)` from CrudService with documented reason
6. **NEVER use `connection.db.collection()` for write operations on tenant-scoped collections** — Tenant-Plugin is bypassed, causing data leaks between tenants. Use the Mongoose Model instead. Read-only access on schema-less collections (OAuth, BetterAuth, MCP) is allowed.
7. **Bypassing `process()` is ONLY allowed in system-internal code** (processors, crons, service-to-service) — never in user-facing controllers. `CrudService.create/update/get()` provides authorization (`checkRights`, `@Restricted`, `S_CREATOR`) and output filtering (secret removal, field-level permissions). Direct Mongoose methods (`Model.create()`, `findByIdAndUpdate().lean()`, `findById().lean()`) keep all Mongoose plugins active (Tenant, Audit, RoleGuard) but skip authorization. Use them when no user context exists and no response goes to a user.
8. **High-frequency paths** (monitoring, metrics, queue processors): these are always system-internal — no user context. Defer complex logic (incidents, notifications, escalation) to cron/queue. Avoid service cascades (A.create → B.create → C.create) in hot paths. Use lean queries for WebSocket data. Each `getForce()` or `process()` call in a hot path multiplies memory pressure by the number of concurrent operations.
9. **NEVER pass Mongoose SubDocument Arrays through `CrudService.update()`** — applies in ALL contexts, including controllers.
   - **Affected fields:** subdocument arrays like `entity.logs`, `entity.comments`, `entity.history`
   - **Why:** subdocument arrays are Proxy-wrapped. `process()` → `clone()` (rfdc) + `processDeep()` triggers Proxy getters/setters per property, then `mergePlain()` re-clones the array → OOM on long-lived documents
   - **Use instead (preferred):** `CrudService.pushToArray(id, field, items)` / `pullFromArray(id, field, condition)` — bypass `process()` while Mongoose `pre('findOneAndUpdate')` hooks still fire
   - **For combined `$push` + `$set`:** use `Model.findByIdAndUpdate()` directly
10. **Clear timers in `Promise.race` patterns** — if using `Promise.race([operation, timeout])`, always clear the timeout after the race resolves. Leaked timers accumulate memory and cause unhandled rejections in high-frequency paths.
11. **In-memory buffers (Map, Set, Array) need eviction** — any buffer used for caching, dedup, or error tracking must have a size cap and periodic cleanup. Without eviction, buffers grow unbounded over the process lifetime and are never GC'd.
12. **`@InjectModel` for a FOREIGN Model is an informed trade-off** — instantiates the [Informed-Trade-off Pattern](informed-trade-off-pattern.md). See also Rule 13 (plain-object responses share the same bypass vectors) and Deprecation-scan phase (same meta-pattern).
    - **Scope:** applies ONLY to Models that do NOT belong to the injecting Service. The Service's OWN primary Model (passed to `super({ mainDbModel })`) is the standard pattern with no extra requirements.
    - **Standard path:** inject the foreign `XService` — it enforces `securityCheck()`, `@Restricted`/`@Roles` pre-checks, `S_CREATOR` ownership, field-level permissions, secret-field removal, hooks, events, side-effects.
    - **Legitimate reasons to opt out:** performance-critical path, bulk operation, atomic operator not exposed by CrudService, no Service exists yet, system-internal context.
    - **Mandatory pre-use analysis:** open the corresponding Service and enumerate every `securityCheck()`, permission/role pre-check, ownership check, field filter, hook, event, and side-effect. For each, determine whether skipping is safe in this call site's context OR must be manually replicated.
    - **Documentation in code:** comment naming the reason AND which Service logic is safely bypassed (with context justification) or manually replicated (with reference to the Service method).
    - **Review treatment:** unjustified foreign `@InjectModel` = finding (Medium). Silently bypassing a security measure = High/Critical. Justified + analyzed = allowed.
13. **Plain objects in responses are an informed trade-off — Models are the standard, plain objects lose Model-specific `securityCheck`** — instantiates the [Informed-Trade-off Pattern](informed-trade-off-pattern.md). See also Rule 12 (same bypass vectors on the service layer), Rule 14 (direct own-Model access shares process/side-effect concerns) and Deprecation-scan phase (same meta-pattern).
    - **Scope:** applies to response paths returning data to user-facing endpoints. System-internal code (cron, processor, queue, WebSocket hot-path) without user response is out of scope.
    - **Standard path:** return Model instances. CrudService (`create`/`find`/`findOne`/`findAndCount`/`update`/`delete`) returns instances by default — safe by construction. `CheckSecurityInterceptor` invokes `securityCheck(user, force)` on every object providing it, applies framework-level `removeSecrets()` (strips configured `secretFields` — default `password`, `verificationToken`, `passwordResetToken`, `refreshTokens`, `tempTokens`, plus `security.secretFields` overrides), and recurses via `processDeep` into nested objects to reach Model instances.
    - **What is bypassed by plain-object paths:** Model-specific `securityCheck` logic (ownership checks, role-based field clearing, entity-specific rules). Plain objects DO still get `removeSecrets()` and DO still allow reaching nested Model instances — plain objects are therefore a trade-off, not an automatic leak.
    - **Legitimate reasons to opt out** (i.e. use `.lean()` / `toObject()` / spread `{...doc, x}` / raw `aggregate()` / native-driver / manual literal): performance hot-path, large list response where hydration is the bottleneck, intentional projection, Model has only the default pass-through `securityCheck`.
    - **Mandatory pre-use analysis:** read the Model's `securityCheck` implementation. What ownership, role, field-clearing, or record-hiding logic does it contain? Determine whether skipping that logic is safe in this call site OR must be manually replicated OR whether the result should be hydrated back to Model instances (`Model.map(raw)` / `new Model(raw)`).
    - **Documentation in code:** comment naming the reason AND stating that Model-specific `securityCheck` does not run (or that hydration/manual replication compensates).
    - **Review treatment:** unjustified plain-object response path on a Model with non-trivial overridden `securityCheck` = High. Unjustified path on a Model with default pass-through AND no role-restricted fields = Low/Info (framework `removeSecrets` still runs). Silently bypassing documented restrictions = High/Critical.
    - **`securityCheck()` itself:** `CoreModel` default `return this` is the intentional "no per-Model restrictions" state. A trivial/default `securityCheck` is **legitimate when the Model genuinely has nothing to filter**. BEFORE accepting a trivial implementation, actively evaluate whether `securityCheck` is the only place where required authorization logic can live — it covers scenarios `@Roles`/`@Restricted`/controller guards cannot: ownership-based field visibility, relationship-based visibility, state-dependent exposure, conditional record hiding via `return undefined`, cross-field visibility rules. If any such rule applies, overriding is mandatory. Partial grants MUST clear restricted fields (`this.secretField = undefined`) before returning `this`.
14. **Direct access to the Service's OWN Model is an informed trade-off** — instantiates the [Informed-Trade-off Pattern](informed-trade-off-pattern.md). See also Rule 12 (foreign `@InjectModel`), Rule 13 (plain-object returns), Rule 7 (`process()` bypass in system-internal code), and Rule 15 below (`Force`/`Raw` CrudService variants).
    - **Scope:** applies to calls on `this.mainDbModel.xxx` / `this.<modelName>Model.xxx` inside the Service that **owns** the Model. Using your own Service's CrudService methods is the standard path. `this.processResult(result, serviceOptions)` is the framework-provided helper for safely returning direct-query results.
    - **Standard path:** CrudService methods (`this.create` / `this.find` / `this.findOne` / `this.findAndCount` / `this.update` / `this.delete` / `this.aggregate`). They run `process()` which orchestrates `prepareInput`, `checkRights` (input + output), population via `processFieldSelection`, `prepareOutput` (including secret removal), and nested-call coordination.
    - **Framework-provided helper for direct access:** `this.processResult(result, serviceOptions)` — handles population and `prepareOutput` (secret removal, type mapping) WITHOUT `checkRights`. The caller is responsible for authorization before the query. Prefer this over returning raw direct-query results when the plain/Mongoose result should still be cleaned up.
    - **What is bypassed by direct own-Model access (without `processResult`):** the full `process()` pipeline — `prepareInput` (input cloning, type mapping), `checkRights` on INPUT and OUTPUT, field-level `@Restricted` enforcement, `prepareOutput` (including `removeSecrets`, type mapping, translations), `processFieldSelection` (GraphQL population), nested-depth coordination.
    - **What is NOT bypassed:** Mongoose-level plugins (Tenant, Audit, RoleGuard, Password-Hashing) — the `SafeModel<T>` type preserves them. The Model's own `securityCheck()` ALSO still runs IF the return reaches the controller → `CheckSecurityInterceptor`. Framework-level `removeSecrets` in the interceptor still strips configured `secretFields` on plain objects.
    - **Legitimate reasons to opt out:**
      - Atomic MongoDB operators not exposed by `CrudService.update()` (`$push`, `$pull`, `$inc`, `$addToSet`, `$setOnInsert`)
      - Aggregation pipelines (`.aggregate([...])`) for reporting/stats — note that `this.aggregate()` from CrudService runs the full pipeline, so use the direct call only when CrudService cannot be used
      - Bulk operations (`bulkWrite`, `insertMany`, `deleteMany`) for migrations, backfills, cleanup
      - Setting internal fields that CrudService doesn't expose (password hashes, verification tokens, internal flags)
      - Performance hot-paths where `process()` overhead is measurable
      - System-internal code with no user context (cron, processor, queue) — Rule 7 overlaps
      - SubDocument array operations that must avoid Proxy/process() (Rule 9)
      - Same-transaction `.findById(id).lean()` before a `this.process(..., { dbObject, input })` call — this is the framework's own `CrudService.update()` pattern (see `crud.service.ts:617`). It is NOT a bypass; it is the canonical way to retrieve a dbObject for rights checking without recursive process() invocations.
    - **Mandatory pre-use analysis:** for every direct own-Model call, confirm:
      1. **Authorization still covered?** CrudService's `checkRights` input+output is skipped — if the result path reaches a user and the Model has role-restricted `@UnifiedField({ roles })` fields, either (a) use `this.processResult(result, serviceOptions)` which still runs `prepareOutput` (secret removal + translation) but requires YOU to handle authorization before the query, OR (b) call `super.update(id, {}, serviceOptions)` after the direct op so the full pipeline runs on the updated doc, OR (c) add a manual `checkRights(result, currentUser, { processType: ProcessType.OUTPUT })` call.
      2. **Input validation still covered?** `prepareInput` is skipped. Controller-level class-validator already covers user input, but service-built payload shapes need explicit sanitization.
      3. **Side-effects still fired?** CrudService and framework plugins emit audit entries, hooks, relation updates. Mongoose plugins (Tenant, Audit, Password) still fire via the Model. Verify CrudService-level side-effects (events via `pubSub`) — re-emit manually if downstream depends on them.
      4. **Consistency?** Mixing direct access with CrudService calls in the same method creates divergent paths — note when intentional.
      5. **Hydration for returned Models:** if returning to a user, hydrate plain results to Model instances with `this.mainDbModel.hydrate(raw)` (Mongoose native) or `this.mainModelConstructor.map(raw)` (CoreModel static helper). The framework itself uses `hydrate` in `findAndCount` (see `crud.service.ts:298`).
    - **Documentation in code:** comment naming the reason (atomic op / aggregation / bulk / internal field / perf / subdoc array) AND which CrudService logic is either safely bypassed OR manually replicated (or handled via `processResult`). Preferred patterns: (a) atomic op followed by `super.update(id, {}, serviceOptions)` to rerun pipeline, (b) direct query followed by `this.processResult(result, serviceOptions)`.
    - **Review treatment:** direct own-Model access with a documented reason + completed 5-question analysis = allowed. Undocumented direct access = finding (Low/Medium — typically Low when `securityCheck()` still runs via the interceptor AND the Model has no role-restricted fields). Silent bypass of field-level `@Restricted` on a user-facing response = High.
15. **CrudService `Force` and `Raw` variants are informed trade-offs with elevated risk** — instantiates the [Informed-Trade-off Pattern](informed-trade-off-pattern.md). See also Rule 14.
    - **Scope:** calls to CrudService variants that disable parts of the pipeline. Every CrudService method (`create`, `get`, `find`, `findOne`, `findAndCount`, `update`, `delete`, `read`, `aggregate`) has three variants defined in `crud.service.ts`:
      - **Standard** (`this.create`, `this.get`, …) — full pipeline.
      - **`Force`** (`this.createForce`, `this.getForce`, …) — sets `config.force = true` which disables `checkRights`, `checkRoles`, AND `removeSecrets` (see `module.service.ts:147-156`). RoleGuard plugin is also bypassed.
      - **`Raw`** (`this.createRaw`, `this.getRaw`, …) — sets `config.raw = true` on top of `force`, which additionally sets `prepareInput = null` and `prepareOutput = null` (see `module.service.ts:133-137`). No secret removal, no type mapping, no translations, no population.
    - **Standard path:** the non-`Force`, non-`Raw` variant. Use it whenever a user context exists and the result may reach a user.
    - **What is bypassed:**
      - `Force`: authorization (`checkRights` on input + output, role-based field filtering, RoleGuard plugin) AND secret removal (`removeSecrets`). Result objects may contain fields like `password`, `verificationToken`, `refreshTokens` if present on the Model.
      - `Raw`: everything `Force` bypasses, plus `prepareInput` (type mapping, input cloning) and `prepareOutput` entirely (no translation, no field selection processing). Result is the closest-to-DB representation.
    - **Legitimate reasons to opt out:**
      - Server-internal pre-processing where no user exists (cron, processor, queue) — Rule 7 applies
      - System-level authentication flows that must read password hashes / tokens (`getRaw` for credential verification)
      - Migrations, backfills, seed scripts
      - Explicit admin tooling where the caller has already verified ADMIN role and needs unfiltered data (rare)
    - **Mandatory pre-use analysis:** for every `Force`/`Raw` call, confirm:
      1. **No user-facing response?** The result MUST NOT travel to a user response without explicit field stripping. `removeSecrets` (which clears configured `secretFields`: `password`, `verificationToken`, `passwordResetToken`, `refreshTokens`, `tempTokens`) is disabled.
      2. **Authorization handled upstream?** The caller has verified the current user's authorization to access this data via explicit `hasRole`/`equalIds` checks BEFORE the call.
      3. **`Raw` only when necessary:** prefer `Force` if translations and type mapping are still desired. Use `Raw` only when you explicitly need the untouched DB shape (e.g. comparing hashes).
    - **Documentation in code:** comment naming why the standard variant cannot be used. Typical: `// getForce — need to read password hash for credential verification`. Raw variants warrant a stronger comment explaining why `prepareOutput` cannot run.
    - **Review treatment:** `Force`/`Raw` result leaking to a user-facing response = **Critical** (credential exposure). `Force`/`Raw` in system-internal context with documented reason = allowed. `Force`/`Raw` without justification comment = Medium. `Raw` used where `Force` would suffice = Low (over-bypassing). A comment alone is insufficient if the result path reaches a user — reviewers must trace the return value.
16. **ALL NestJS exceptions MUST use typed `ErrorCode` from the project registry — raw-string messages are NON-NEGOTIABLE forbidden** outside `*.spec.ts` / `*.test.ts` files. Rule enforcement by `backend-reviewer` (Phase 4), `code-reviewer` (Phase 4), `security-reviewer` (Phase 5 Layer 5b — OWASP A09 Information Disclosure). Full rule: [`error-handling.md`](error-handling.md).
    - **Scope:** every `throw new (BadRequest|Unauthorized|Forbidden|NotFound|Conflict|UnprocessableEntity|InternalServerError)Exception(...)` in `src/server/**` outside test files.
    - **Standard path:** `throw new NotFoundException(ErrorCode.RESOURCE_NOT_FOUND)` — typed, i18n-ready, machine-parseable via `#PREFIX_XXXX:` marker.
    - **Forbidden:** `throw new NotFoundException('User not found')` — raw string. Breaks the `/i18n/errors/:locale` translation contract, often leaks internal state via interpolation (`` `Query failed: ${error.message}` ``), violates OWASP A09.
    - **Project registry setup (mandatory baseline):**
      1. `src/server/common/errors/project-errors.ts` exports `ProjectErrors` + `ErrorCode = mergeErrorCodes(ProjectErrors)`.
      2. Every env block in `src/config.env.ts` registers `errorCode: { additionalErrorRegistry: ProjectErrors }`.
      3. `ErrorCode` is imported from the **project** file (`from '../../common/errors/project-errors'`), never directly from `@lenne.tech/nest-server` — the project import includes LTNS_* core codes AND PROJ_* project codes; the framework import misses project codes.
    - **Code-selection rule:** reuse `LTNS_*` core codes when generic (`RESOURCE_NOT_FOUND`, `VALIDATION_FAILED`, `ACCESS_DENIED`, `UNAUTHORIZED`). Define new `PROJ_*` codes only for domain-specific semantics (`PROJECT_INVALID_STATUS`, `QUOTA_EXCEEDED`, `ACCOUNT_BLOCKED`). Never recycle or rename shipped codes — they are public API contract (frontend translations, logs, analytics).
    - **Information-Disclosure check:** interpolating `error.message`, `err.stack`, SQL, query strings, file paths, or internal IDs into exception messages is a disclosure vector. The typed code replaces the interpolation — details go to `this.logger.error(...)` for server-side logging.
    - **HTTP status mapping:** match exception class to semantic (`BadRequest` = validation, `Forbidden` = authenticated-but-not-allowed, `NotFound` = resource absence, `UnprocessableEntity` = business-rule violation). See HTTP Status Code Mapping in `error-handling.md`.
    - **Review treatment:**
      - Raw-string with interpolated internal state (SQL, stacktrace, file path) = **Critical** (disclosure).
      - Auth-flow differential messages (`'User not found'` vs `'Invalid password'`) = **High** (user enumeration).
      - Raw static string (e.g. `'Invalid request'`) = **High** — NON-NEGOTIABLE rule breach, breaks i18n contract.
      - `ErrorCode` imported from framework instead of project = **Medium** — project codes invisible.
      - Missing `additionalErrorRegistry` wiring in one env config = **Medium** — silent translation drop.
      - Duplicate code numbers across `LtnsErrors` + `ProjectErrors` = **High** — merge collision.
      - `PROJ_*` code renamed/recycled in release = **High** — contract break.
    - **Architecture-phase requirement:** when a new feature introduces domain-specific failures, the architect's blueprint must enumerate new `PROJ_*` codes (key, number, range, HTTP status, exception class, placeholders, `de` + `en` translations) — deferring to implementation produces ad-hoc inconsistent codes.

---

##  ALWAYS Do This

1. **ALWAYS analyze permissions BEFORE writing tests** (Controller, Model, Service layers)
2. **ALWAYS test with the LEAST privileged user** who is authorized
3. **ALWAYS create appropriate test users** for each permission level
4. **ALWAYS adapt tests to security requirements**, never the other way around
5. **ALWAYS ask developer for approval** before changing ANY security decorator
6. **ALWAYS aim for maximum test coverage** (80-100% depending on criticality)

---

## 🔑 Permission Hierarchy (Specific Overrides General)

```typescript
@Restricted(RoleEnum.ADMIN)  // ← FALLBACK: DO NOT REMOVE
export class ProductController {
  @Roles(RoleEnum.S_USER)    // ← SPECIFIC: This method is more open
  async createProduct() { }   // ← S_USER can access (specific wins)

  async secretMethod() { }    // ← ADMIN only (fallback applies)
}
```

**Why class-level `@Restricted(ADMIN)` MUST stay:**
- If someone forgets `@Roles()` on a new method -> it's secure by default
- Shows the class is security-sensitive
- Fail-safe protection

---

## Rule 1: NEVER Weaken Security for Test Convenience

###  ABSOLUTELY FORBIDDEN

```typescript
// BEFORE (secure):
@Restricted(RoleEnum.ADMIN)
export class ProductController {
  @Roles(RoleEnum.S_USER)
  async createProduct() { ... }
}

// AFTER (FORBIDDEN - security weakened!):
// @Restricted(RoleEnum.ADMIN)  ← NEVER remove this!
export class ProductController {
  @Roles(RoleEnum.S_USER)
  async createProduct() { ... }
}
```

###  CRITICAL RULE

- **NEVER remove or weaken `@Restricted()` decorators** on Controllers, Resolvers, Models, or Objects
- **NEVER change `@Roles()` decorators** to more permissive roles just to make tests pass
- **NEVER modify `securityCheck()` logic** to bypass security for testing

### If tests fail due to permissions

1.  **CORRECT**: Adjust the test to use the appropriate user/token
2.  **CORRECT**: Create test users with the required roles
3.  **WRONG**: Weaken security to make tests pass

### Any security changes MUST

- Be discussed with the developer FIRST
- Have a solid business justification
- Be explicitly approved by the developer
- Be documented with the reason

---

## Rule 2: Understanding Permission Hierarchy

### ⭐ Key Concept: Specific Overrides General

The `@Restricted()` decorator on a class acts as a **security fallback** - if a method/property doesn't specify permissions, it inherits the class-level restriction. This is a **security-by-default** pattern.

### Example - Controller/Resolver

```typescript
@Restricted(RoleEnum.ADMIN)  // ← FALLBACK: Protects everything by default
export class ProductController {

  @Roles(RoleEnum.S_EVERYONE)  // ← SPECIFIC: This method is MORE open
  async getPublicProducts() {
    // Anyone can access this (specific @Roles wins)
  }

  @Roles(RoleEnum.S_USER)  // ← SPECIFIC: Logged-in users
  async createProduct() {
    // S_USER can access (specific wins over fallback)
  }

  async deleteProduct() {
    // ADMIN ONLY (no specific decorator, fallback applies)
  }
}
```

### Example - Model

```typescript
@Restricted(RoleEnum.ADMIN)  // ← FALLBACK
export class Product {

  @Roles(RoleEnum.S_EVERYONE)  // ← SPECIFIC
  @UnifiedField({ description: 'Product name' })
  name: string;  // Everyone can read this

  @UnifiedField({ description: 'Internal cost' })
  cost: number;  // ADMIN ONLY (fallback applies)
}
```

---

## Rule 3: Adapt Tests to Security, Not Vice Versa

###  WRONG Approach

```typescript
// Test fails because user isn't admin
it('should create product', async () => {
  const result = await request(app)
    .post('/products')
    .set('Authorization', regularUserToken)  // Not an admin!
    .send(productData);

  expect(result.status).toBe(201);  // Fails with 403
});

//  WRONG FIX: Removing @Restricted from controller
// @Restricted(RoleEnum.ADMIN)  ← NEVER DO THIS!
```

###  CORRECT Approach

```typescript
// Analyze first: Who is allowed to create products?
// Answer: ADMIN only (based on @Restricted on controller)

// Create admin test user
let adminToken: string;

beforeAll(async () => {
  const admin = await createTestUser({ roles: [RoleEnum.ADMIN] });
  adminToken = admin.token;
});

it('should create product as admin', async () => {
  const result = await request(app)
    .post('/products')
    .set('Authorization', adminToken)  //  Use admin token
    .send(productData);

  expect(result.status).toBe(201);  //  Passes
});

it('should reject product creation for regular user', async () => {
  const result = await request(app)
    .post('/products')
    .set('Authorization', regularUserToken)
    .send(productData);

  expect(result.status).toBe(403);  //  Test security works!
});
```

---

## Rule 4: Test with Least Privileged User

**Always test with the LEAST privileged user who is authorized to perform the action.**

###  WRONG

```typescript
// Method allows S_USER, but testing with ADMIN
@Roles(RoleEnum.S_USER)
async getProducts() { }

it('should get products', async () => {
  const result = await request(app)
    .get('/products')
    .set('Authorization', adminToken);  //  Over-privileged!
});
```

###  CORRECT

```typescript
@Roles(RoleEnum.S_USER)
async getProducts() { }

it('should get products as regular user', async () => {
  const result = await request(app)
    .get('/products')
    .set('Authorization', regularUserToken);  //  Least privilege
});
```

**Why this matters:**
- Tests might pass with ADMIN but fail with S_USER
- You won't catch permission bugs
- False confidence in security

---

## Rule 5: Create Appropriate Test Users

**Create test users for EACH permission level you need to test.**

### Example Test Setup

```typescript
describe('ProductController', () => {
  let adminToken: string;
  let userToken: string;
  let everyoneToken: string;

  beforeAll(async () => {
    // Create admin user
    const admin = await createTestUser({
      roles: [RoleEnum.ADMIN]
    });
    adminToken = admin.token;

    // Create regular user
    const user = await createTestUser({
      roles: [RoleEnum.S_USER]
    });
    userToken = user.token;

    // Create unauthenticated scenario
    const guest = await createTestUser({
      roles: [RoleEnum.S_EVERYONE]
    });
    everyoneToken = guest.token;
  });

  it('admin can delete products', async () => {
    // Use adminToken
  });

  it('regular user can create products', async () => {
    // Use userToken
  });

  it('everyone can view products', async () => {
    // Use everyoneToken or no token
  });

  it('regular user cannot delete products', async () => {
    // Use userToken, expect 403
  });
});
```

---

## Rule 6: Comprehensive Test Coverage

**Aim for 80-100% test coverage depending on criticality:**

- **High criticality** (payments, user data, admin functions): 95-100%
- **Medium criticality** (business logic, CRUD): 80-90%
- **Low criticality** (utilities, formatters): 70-80%

### What to Test

**For each endpoint/method:**

1.  Happy path (authorized user, valid data)
2.  Permission denied (unauthorized user)
3.  Validation errors (invalid input)
4.  Edge cases (empty data, boundaries)
5.  Error handling (server errors, missing resources)

### Example Comprehensive Tests

```typescript
describe('createProduct', () => {
  it('should create product with admin user', async () => {
    // Happy path
  });

  it('should reject creation by regular user', async () => {
    // Permission test
  });

  it('should reject invalid product data', async () => {
    // Validation test
  });

  it('should reject duplicate product name', async () => {
    // Business rule test
  });

  it('should handle missing required fields', async () => {
    // Edge case
  });
});
```

---

## Rule 7: Input Sanitization & XSS Prevention

###  Always Sanitize User Input

```typescript
//  WRONG: Direct HTML rendering without sanitization
@UnifiedField({ description: 'User bio (supports HTML)' })
bio: string;  // Could contain <script> tags!

//  CORRECT: Sanitize HTML input
import * as sanitizeHtml from 'sanitize-html';

@UnifiedField({
  description: 'User bio',
  transform: (value: string) => sanitizeHtml(value, {
    allowedTags: ['b', 'i', 'em', 'strong', 'p', 'br'],
    allowedAttributes: {}
  })
})
bio: string;
```

### URL Parameter Validation

```typescript
//  WRONG: Using URL parameters directly
@Get(':id')
async findOne(@Param('id') id: string) {
  return this.service.findById(id);  // No validation!
}

//  CORRECT: Validate with ParseUUIDPipe or custom validation
@Get(':id')
async findOne(@Param('id', ParseUUIDPipe) id: string) {
  return this.service.findById(id);
}

// Or custom validation
import { ErrorCode } from '../../common/errors/project-errors';

@Get(':id')
async findOne(@Param('id') id: string) {
  if (!Types.ObjectId.isValid(id)) {
    throw new BadRequestException(ErrorCode.INVALID_FIELD_FORMAT);
  }
  return this.service.findById(id);
}
```

> All exception examples in this document use `ErrorCode` from the project registry — raw-string messages are forbidden in production code (see [`error-handling.md`](error-handling.md)).

### Query Parameter Limits

```typescript
//  WRONG: No limits on pagination
@Get()
async findAll(@Query('limit') limit: number) {
  return this.service.find({}, { limit });  // User could request limit=1000000
}

//  CORRECT: Enforce limits
@Get()
async findAll(@Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number) {
  const safeLimit = Math.min(Math.max(1, limit), 100);  // Clamp to 1-100
  return this.service.find({}, { limit: safeLimit });
}
```

---

## Rule 8: File Upload Security

###  Validate File Types (Magic Bytes, not just extension)

```typescript
import * as fileType from 'file-type';

import { ErrorCode } from '../../common/errors/project-errors';

//  WRONG: Trust file extension
async uploadFile(file: Express.Multer.File) {
  if (!file.originalname.endsWith('.pdf')) {
    throw new BadRequestException(ErrorCode.INVALID_FILE_TYPE);
  }
  // Attacker can rename malware.exe to malware.pdf!
}

//  CORRECT: Validate magic bytes
async uploadFile(file: Express.Multer.File) {
  const type = await fileType.fromBuffer(file.buffer);

  const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
  if (!type || !ALLOWED_TYPES.includes(type.mime)) {
    throw new BadRequestException(ErrorCode.INVALID_FILE_TYPE);
  }

  // Also check file size
  const MAX_SIZE = 5 * 1024 * 1024;  // 5MB
  if (file.size > MAX_SIZE) {
    throw new BadRequestException(ErrorCode.FILE_TOO_LARGE);
  }
}
```

### Prevent Path Traversal

```typescript
import * as path from 'path';

//  WRONG: Use user-provided filename directly
async saveFile(file: Express.Multer.File) {
  const filePath = path.join('/uploads', file.originalname);
  // Attacker could use: ../../../etc/passwd
}

//  CORRECT: Sanitize filename and use random names
async saveFile(file: Express.Multer.File) {
  // Option 1: Use only base name
  const safeName = path.basename(file.originalname);

  // Option 2: Generate random filename (recommended)
  const ext = path.extname(file.originalname);
  const randomName = `${randomUUID()}${ext}`;

  const uploadDir = '/uploads';
  const filePath = path.join(uploadDir, randomName);

  // Verify path is within upload directory
  if (!filePath.startsWith(uploadDir)) {
    throw new BadRequestException(ErrorCode.INVALID_FILE_PATH);
  }
}
```

### Serve Files Securely

```typescript
//  WRONG: Execute files or expose directory
app.use('/uploads', express.static('uploads'));  // Could serve malicious HTML

//  CORRECT: Set proper headers
app.use('/uploads', express.static('uploads', {
  setHeaders: (res, filePath) => {
    res.setHeader('Content-Disposition', 'attachment');  // Force download
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', 'application/octet-stream');
  }
}));
```

---

## Rule 9: Communication Security

### HTTPS & TLS Enforcement

```typescript
// main.ts - Production configuration
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Redirect HTTP to HTTPS (via reverse proxy or middleware)
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] !== 'https' && process.env.NODE_ENV === 'production') {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    next();
  });
}
```

### Helmet Security Headers

```typescript
import helmet from 'helmet';

// main.ts
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,  // 1 year
    includeSubDomains: true,
    preload: true
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));
```

### CORS Configuration

```typescript
//  WRONG: Allow all origins
app.enableCors();  // Allows any origin!

//  CORRECT: Restrict origins
app.enableCors({
  origin: [
    'https://app.example.com',
    'https://admin.example.com',
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400,  // Cache preflight for 24 hours
});

// Or dynamic origin validation
app.enableCors({
  origin: (origin, callback) => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
});
```

### Rate Limiting

```typescript
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      ttl: 60,      // Time window in seconds
      limit: 100,   // Max requests per window
    }),
  ],
})
export class AppModule {}

// Apply globally
@UseGuards(ThrottlerGuard)
@Controller('api')
export class ApiController {}

// Or per-endpoint with different limits
@Throttle(5, 60)  // 5 requests per 60 seconds
@Post('auth/login')
async login() {}

@Throttle(3, 3600)  // 3 requests per hour
@Post('auth/forgot-password')
async forgotPassword() {}
```

---

## Quick Security Checklist

Before completing ANY task:

**Authorization & Access Control:**
- [ ] **All @Restricted decorators preserved**
- [ ] **@Roles decorators NOT made more permissive**
- [ ] **Tests use appropriate user roles**
- [ ] **Test users created for each permission level**
- [ ] **Least privileged user tested**
- [ ] **Permission denial tested (403 responses)**
- [ ] **No securityCheck() logic bypassed**
- [ ] **Direct Mongoose access security-verified** — if `Model.find()/.create()/.aggregate()` used instead of CrudService (for performance): authorization check before call, tenant isolation preserved (if multi-tenancy active), no sensitive fields leaked to user
- [ ] **`@InjectModel` usage audited** — every non-primary `@InjectModel` has (1) a justification comment stating the reason, AND (2) evidence of corresponding-Service analysis: each bypassed measure (`securityCheck`, `@Restricted`/`@Roles`, ownership, field filtering, hooks, events) is either safe to skip in this context or manually replicated
- [ ] **Responses prefer Model instances over plain objects** — when `.lean()`, `toObject()`, spread `{ ...doc }`, raw `aggregate()`, or native-driver results are returned to users, a comment documents the reason AND either the result is hydrated back to Model instances OR the Model's authorization rules are manually replicated. Framework still runs `removeSecrets` on plain objects, but Model-specific `securityCheck` logic does not run
- [ ] **`securityCheck()` proactively evaluated** — default `return this` is intentional when the Model genuinely has nothing to filter. For every trivial implementation, confirm no per-instance, ownership-based, relationship-based, state-dependent, list-level (`return undefined`), or cross-field visibility rule applies — those scenarios often have `securityCheck` as their only feasible implementation site. When restrictions apply, override is present and restricted fields are cleared for partial grants (`this.secretField = undefined`) before returning `this`
- [ ] **Permissions report clean** (`lt server permissions --failOnWarnings`)

**Input & Validation:**
- [ ] **All inputs validated and sanitized**
- [ ] **URL parameters validated (UUIDs, ObjectIds)**
- [ ] **Query limits enforced (pagination)**
- [ ] **HTML content sanitized**

**File Uploads:**
- [ ] **File types validated via magic bytes**
- [ ] **File size limits enforced**
- [ ] **Filenames sanitized (no path traversal)**
- [ ] **Files served with safe headers**

**Communication:**
- [ ] **HTTPS enforced in production**
- [ ] **Helmet security headers configured**
- [ ] **CORS restricted to allowed origins**
- [ ] **Rate limiting on sensitive endpoints**

**Testing:**
- [ ] **Test coverage ≥ 80%**
- [ ] **All edge cases covered**

---

## Security Decision Protocol

**When you encounter a security-related decision:**

1. **STOP** - Don't make the change immediately
2. **ANALYZE** - Why does the current security exist?
3. **ASK** - Consult the developer before changing
4. **DOCUMENT** - If approved, document the reason
5. **TEST** - Ensure security still works after change

**Remember:**
- **Security > Convenience**
- **Better to over-restrict than under-restrict**
- **Always preserve existing security mechanisms**
- **When in doubt, ask the developer**
