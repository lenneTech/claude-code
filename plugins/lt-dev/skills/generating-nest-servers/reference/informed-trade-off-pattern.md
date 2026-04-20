---
name: informed-trade-off-pattern
description: Meta-rule for framework conventions with a standard safe path and a documented opt-out — applies to foreign @InjectModel, plain-object responses, deprecated-API usage, and similar trade-offs
---

# Informed-Trade-off Pattern (Meta-Rule)

Several framework conventions in this codebase have a **standard safe path** and an **opt-out for good reasons**. The opt-out is not forbidden, but it is never implicit — it requires a documented justification and an explicit analysis of what the opt-out bypasses.

This document defines the common shape that specific rules instantiate. Individual rules (linked below) inherit this shape and add domain-specific checks.

## The Pattern

The pattern has **five elements**. Every instance of the pattern — whether in code, in a review, or in a plan — must honor all five.

### 1. Standard path

The framework-default, safe-by-construction choice. Using this path requires no extra work, no documentation, no review-time justification. Examples:
- CrudService methods (`create`/`find`/`findOne`/`findAndCount`/`update`/`delete`)
- Injecting the Service that owns a foreign Model instead of the Model itself
- Returning Model instances (not plain objects) from user-facing endpoints
- Using the current non-deprecated API surface

### 2. Opt-out legitimacy

Deviating is **allowed** when there is a concrete, documented reason. Typical legitimate reasons:
- Performance-critical path (hot-path, high-frequency, latency budget)
- Bulk operation (migrations, imports, exports)
- Feature not exposed by the default (atomic operators, specific aggregation shapes, native driver capabilities)
- System-internal context (cron, processor, queue handler, WebSocket internal — no user-facing response)
- No Service/API exists yet (gradual introduction of a missing abstraction)
- Gradual migration (legacy code being rewritten in increments)

Typical **illegitimate** reasons:
- "Simpler code" / "Service feels like overhead"
- "Avoiding a circular import" (resolve the cycle instead)
- "Quick fix" (the quick fix is the opt-out — the justification explains why it is necessary, not why it is quick)

### 3. Mandatory pre-use analysis

Before choosing the opt-out, analyze what the standard path does that the opt-out **skips**. Each instance lists the concrete items. Generic categories:
- **Processes:** CrudService pipeline, `process()` normalization, hooks, events, audit, notifications
- **Security measures:** `securityCheck()`, `@Restricted` / `@Roles` pre-checks, ownership checks (`S_CREATOR`, `equalIds`), field-level permissions, secret-field removal, input validation
- **Side-effects:** relation updates, cache invalidation, tenant-scope propagation, soft-delete cascades

For each skipped item, decide:
- **Safe to skip in this context?** Document why.
- **Must be manually replicated?** Implement the replication at the call site, comment the source.

### 4. Documentation in code

Add a comment at the opt-out site naming:
- The **reason** (matching one of the legitimate reasons in §2)
- Which **standard-path logic** is either safely skippable in this context or manually replicated
- Where the replication lives (if applicable)

Template:
```typescript
// <OPT-OUT> used instead of <STANDARD> because:
//   - <reason from §2>
// Standard-path logic considered:
//   - <measure 1>: <skipped safely because ...> | <replicated below via ...>
//   - <measure 2>: ...
```

### 5. Review treatment

Severity is a function of **what is actually bypassed**, not the presence of the opt-out.

| Situation | Severity |
|-----------|----------|
| Opt-out with documented reason AND completed analysis AND no silent bypass | Allowed |
| Opt-out without documentation or analysis | **Finding** (typically Medium) |
| Opt-out silently bypasses a security measure | **High / Critical** (domain-specific) |
| Standard path used everywhere | Default — no action |

Findings in the "trade-off" category do not block merges in themselves, but silent security bypasses detected via a trade-off site always escalate into the regular remediation catalog at their true severity.

## Instances of the Pattern

Rules in this codebase that instantiate the pattern:

| Instance | Scope | Standard Path | Opt-out | Full Rule |
|----------|-------|---------------|---------|-----------|
| **Foreign `@InjectModel`** | Backend services injecting Models not owned by them | Inject the corresponding `XService` | `@InjectModel(ForeignModel.name)` | `security-rules.md` Rule 12 |
| **Plain-object responses** | Controller / service return paths to user-facing endpoints | Return Model instances (CrudService default) | `.lean()`, `toObject()`, spreads, raw `aggregate()`, native-driver, manual literals | `security-rules.md` Rule 13 |
| **Direct own-Model access** | Service method calling its own `this.mainDbModel.xxx` / `this.<modelName>Model.xxx` instead of the inherited CrudService methods | `this.create` / `this.find` / `this.findOne` / `this.update` / `this.delete` / or wrap direct call with `this.processResult(...)` | `this.mainDbModel.findOneAndUpdate`, `.aggregate`, `.bulkWrite`, etc. without processResult | `security-rules.md` Rule 14 |
| **`Force`/`Raw` CrudService variants** | Disabling checkRights/secret-removal/preparations via `*Force` or `*Raw` methods | Standard non-`Force` variant with full pipeline | `getForce` / `createForce` / `findRaw` / etc. | `security-rules.md` Rule 15 |
| **Native driver access** | Bypassing all Mongoose plugins via `getNativeCollection(reason)` / `getNativeConnection(reason)` | Mongoose Model methods (preserves all plugins) | Native driver calls — must have reason ≥20 chars, logs [SECURITY] warning | `security-rules.md` Rules 5-6 |
| **Deprecated-API use** | Any framework/library surface marked `@deprecated` | Use the current non-deprecated API | Continued call to the deprecated symbol | Deprecation-Scan phase in each review agent |
| **Combined opt-outs** | Same call site hits multiple trade-offs | All relevant standard paths | Multiple opt-outs simultaneously | Each rule evaluated independently |

## Framework-provided helpers for direct-query paths

When opting out of the full CrudService pipeline, the framework provides helpers that still run useful parts of the output processing. Prefer these over raw returns:

| Helper | What it does | What it does NOT do |
|--------|--------------|---------------------|
| `this.processResult(result, serviceOptions)` (in `ModuleService`) | Runs `processFieldSelection` (GraphQL population) and `prepareOutput` (secret removal, translations, type mapping, `targetModel` conversion) | Does NOT run `checkRights` — caller must authorize upstream |
| `this.mainDbModel.hydrate(rawDoc)` (Mongoose native) | Converts a plain object back to a proper Mongoose document | No processing — just hydration |
| `YourModel.map(rawDoc)` (CoreModel static helper) | Converts plain data to a Model instance with proper types | No processing — just type mapping |
| `getNativeCollection(reason)` / `getNativeConnection(reason)` | Grants native-driver access; logs `[SECURITY]` warning; requires ≥20-char reason | Bypasses ALL Mongoose plugins (Tenant, Audit, RoleGuard, Password) |

`processResult` is the canonical framework pattern for Rule 14 opt-outs where the query was direct but the return value should still be cleaned. Using it closes the "I bypassed CrudService and therefore also bypassed `prepareOutput`" gap.

## `Force` and `Raw` variants — critical distinction

Every CrudService method has three variants (see `crud.service.ts`). Understanding exactly what each disables is mandatory:

| Variant | `checkRights` | `removeSecrets` | `prepareInput` | `prepareOutput` | RoleGuard plugin | Typical risk |
|---------|:-------------:|:---------------:|:--------------:|:---------------:|:----------------:|-------------|
| Standard (`get`, `find`, `create`, …) | ✓ | ✓ | ✓ | ✓ | ✓ | Safe by default |
| `*Force` (`getForce`, `findForce`, …) | ✗ | ✗ | ✓ | ✓ (without removeSecrets) | ✗ | **Secrets (password hashes, tokens) may leak if result reaches a user** |
| `*Raw` (`getRaw`, `findRaw`, …) | ✗ | ✗ | ✗ (null) | ✗ (null) | ✗ | **Raw DB shape; no translations, no type mapping, no secret removal** |

Both `Force` and `Raw` variants return data with the model's hidden/secret fields intact. They are intended for system-internal flows (credential verification, migrations, admin tooling where ADMIN is already verified upstream). Using either without an explicit upstream authorization check and without a documented reason is a review finding. A Force/Raw result reaching a user-facing response is Critical.

**Cross-site composition:** a single call site can instantiate multiple trade-offs at once (for example, a service method that injects a foreign Model AND returns `.lean()` results). Each instance must be independently justified, analyzed, and documented — the justifications do not compound. When reviewing, verify each instance against its own rule.

## Consolidated Review Output

The `/lt-dev:review` command aggregates trade-off findings from individual reviewers into a single **"Informed Trade-offs"** section, independent of the main remediation catalog. Seven categories are aggregated — matching the `review.md` Consolidated Catalog:

| # | Category | Origin Reviewers | Instance Rule |
|---|----------|------------------|---------------|
| 1 | **Deprecations (source code)** | `code-reviewer`, `backend-reviewer`, `frontend-reviewer`, `devops-reviewer` | Deprecation-Scan phase per reviewer |
| 2 | **Deprecations (test APIs)** | `test-reviewer` | Deprecation-Scan phase (test framework focus) |
| 3 | **Foreign `@InjectModel`** | `backend-reviewer`, `security-reviewer` | Rule 12 |
| 4 | **Plain-object response paths** | `backend-reviewer`, `security-reviewer` | Rule 13 |
| 5 | **Direct own-Model access** | `backend-reviewer` (Layer 5b), `security-reviewer` (Layer 7), `code-reviewer` (Phase 4) | Rule 14 |
| 6 | **CrudService `*Force`/`*Raw` variants** | `backend-reviewer`, `security-reviewer` (Layer 8), `code-reviewer` (Phase 3) | Rule 15 |
| 7 | **Frontend trade-offs** | `frontend-reviewer`, `code-reviewer` | `developing-lt-frontend/reference/informed-trade-off-pattern.md` |

Native-driver access (Rules 5-6) is folded into category 5 when it appears in a Service-owned context, otherwise it is reported under the regular Security Native-Driver layer — the compile-time `SafeModel<T>` guard plus the ≥20-char reason requirement make silent native-driver bypass impossible, so it rarely needs its own aggregated row.

Each row in the aggregated section lists:
- Category (one of the seven above)
- Origin reviewer
- File:line of the opt-out site
- Opt-out used (concrete API call)
- Documented reason (empty = missing)
- Analysis performed (empty = missing)
- Default-path logic bypassed (per the rule's list)
- Severity (usually Low/Medium; escalations go to the main catalog)
- Action (migrate, inject Service, hydrate, replicate, field-strip, etc.)

Silent security bypasses are additionally added to the main Consolidated Remediation Catalog at the appropriate severity — the trade-off section alone never hides a High/Critical finding. Severity escalations for each category:
- Category 1-2 (Deprecations): never higher than Medium based on deprecation alone; security gaps from the deprecation go to the domain's regular findings.
- Category 3 (Foreign `@InjectModel`): silently bypassing a Service security measure = High/Critical.
- Category 4 (Plain-object responses): unjustified path on a Model with non-trivial overridden `securityCheck` = High.
- Category 5 (Direct own-Model access): silent bypass of field-level `@Restricted` on a user-facing response = High.
- Category 6 (`*Force`/`*Raw`): result (possibly with password hashes/tokens) reaching a user response without explicit field stripping = **Critical** (OWASP A02).
- Category 7 (Frontend): unjustified `v-html` = High (XSS class); SSR escape without compensation = Medium.

## When Designing New Features

Architects and developers planning new work should apply the pattern proactively:

1. Default to the standard path in the blueprint/implementation plan.
2. If a performance, API-surface, or context constraint requires the opt-out, state it in the plan alongside the reason.
3. Specify the analysis of the standard-path logic affected.
4. Specify where the documentation comment will live and whether manual replication is needed.
5. During review, the plan's justifications become the starting point for the review-time analysis.

This prevents opt-outs from appearing first at review time, when redesign is expensive.
