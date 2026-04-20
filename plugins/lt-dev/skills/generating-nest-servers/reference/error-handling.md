---
name: nest-server-error-handling
description: Rules for using and extending the @lenne.tech/nest-server ErrorCode system (LTNS_* core codes + project-specific PROJ_* codes) — mandatory for all NestJS exceptions in lenne.tech projects
---

# Error Handling with @lenne.tech/nest-server ErrorCode

The framework ships a structured, i18n-ready error-code registry. All server-side exceptions in lenne.tech projects MUST use it — raw string messages are forbidden in production code.

## Core Rule

**NEVER throw NestJS exceptions with a raw string message.**

```typescript
// WRONG — raw string, no code, not translatable, untyped
throw new NotFoundException('Buyer not found');
throw new BadRequestException('Invalid ObjectId format');
throw new ForbiddenException('You do not have access to this resource');

// CORRECT — typed ErrorCode, machine-parseable marker, auto-translated
import { ErrorCode } from '../../common/errors/project-errors';

throw new NotFoundException(ErrorCode.RESOURCE_NOT_FOUND);
throw new BadRequestException(ErrorCode.INVALID_FIELD_FORMAT);
throw new ForbiddenException(ErrorCode.RESOURCE_FORBIDDEN);
```

The framework emits the response as `#LTNS_0400: Resource not found`. The `#CODE:` prefix is the machine-parseable marker the frontend uses to look up the localized user message via `GET /i18n/errors/:locale`.

## Framework Source

| File | Purpose |
|------|---------|
| `src/core/modules/error-code/error-codes.ts` | `LtnsErrors` registry + `ErrorCode` export + `mergeErrorCodes()` helper + `IErrorRegistry` / `IErrorDefinition` interfaces |
| `src/core/modules/error-code/INTEGRATION-CHECKLIST.md` | Scenario A (config), B (custom service), C (custom controller) integration steps |
| `src/core/modules/error-code/core-error-code.service.ts` | `CoreErrorCodeService` — serves `/i18n/errors/:locale` |
| `src/core/modules/error-code/core-error-code.controller.ts` | `CoreErrorCodeController` — REST endpoint |
| `src/core/modules/error-code/interfaces/error-code.interfaces.ts` | `IErrorCode` config interface (`additionalErrorRegistry`, `autoRegister`) |
| `src/core/common/interfaces/server-options.interface.ts` | `errorCode?: IErrorCode` field on `IServerOptions` |

**In vendored-mode projects** (`src/core/VENDOR.md` exists), substitute `node_modules/@lenne.tech/nest-server/src/core/` → `src/core/`. Import path becomes relative (`from '../../../core'` instead of `from '@lenne.tech/nest-server'`).

## Error Code Format

```
#PREFIX_XXXX: English technical description
```

| Part | Meaning |
|------|---------|
| `#` | Machine-parsing marker — must be first char |
| `PREFIX` | `LTNS` for core framework errors, project-specific prefix otherwise (3–5 uppercase letters) |
| `XXXX` | Four-digit number, zero-padded |
| `:` | Separator |
| Message | English developer-facing description (end users see the translation) |

**Project prefix examples:** `PROJ_`, `APP_`, `SHOP_`, `CRM_`. Pick one at project start and never mix within the same project.

## Core Error Ranges (LTNS_*)

Reserved by the framework — do NOT reuse these numbers in project errors.

| Range | Category |
|-------|----------|
| `LTNS_0001–0099` | Authentication |
| `LTNS_0050–0059` | System Setup (sub-range) |
| `LTNS_0100–0199` | Authorization |
| `LTNS_0200–0299` | User |
| `LTNS_0300–0399` | Validation |
| `LTNS_0400–0499` | Resource (not-found, conflict) |
| `LTNS_0500–0599` | File |
| `LTNS_0900–0999` | Internal |

Read `src/core/modules/error-code/error-codes.ts` → `LtnsErrors` for the canonical list before defining project codes. **Reuse LTNS_* when a generic error already fits** (`RESOURCE_NOT_FOUND`, `VALIDATION_FAILED`, `ACCESS_DENIED`, `UNAUTHORIZED`) — only create project codes for domain-specific semantics.

## Project Registry Setup (Scenario A — Required Baseline)

Every new project must have a project-specific registry, even when empty at first. This guarantees the infrastructure exists the moment a domain-specific code is needed.

### 1. Registry file

**Create:** `src/server/common/errors/project-errors.ts`

```typescript
import { IErrorRegistry, mergeErrorCodes } from '@lenne.tech/nest-server';
// vendored mode: import { IErrorRegistry, mergeErrorCodes } from '../../../core';

/**
 * Project-specific error codes.
 *
 * Prefix: PROJ_ (pick ONE prefix per project and stick to it)
 *
 * Suggested ranges (mirror LTNS_* for clarity):
 * - PROJ_0001–0099: Domain resources (not found, already exists, invalid state)
 * - PROJ_0100–0199: Business-rule violations (quota, not permitted, state transition)
 * - PROJ_0200–0299: Domain-specific user/account errors
 */
export const ProjectErrors = {
  // Keep entries grouped by range, NOT alphabetical (matches LtnsErrors convention).
} as const satisfies IErrorRegistry;

/**
 * Merged ErrorCode — use this everywhere in src/server/**.
 * Contains LTNS_* core errors AND PROJ_* project errors, fully type-safe.
 */
export const ErrorCode = mergeErrorCodes(ProjectErrors);
```

### 2. Register in config

**Update:** `src/config.env.ts` — in EVERY environment config (dev, test, staging, prod, local, ...):

```typescript
import { ProjectErrors } from './server/common/errors/project-errors';

const config: IServerOptions = {
  // ... other config ...
  errorCode: {
    additionalErrorRegistry: ProjectErrors,
  },
};
```

Forgetting even ONE environment silently drops project translations in that environment. Grep for `additionalErrorRegistry` after any config refactor to verify coverage.

### 3. Use the merged ErrorCode

**Always import from the PROJECT file**, not from the framework:

```typescript
// CORRECT — merged registry, contains LTNS_* AND PROJ_*
import { ErrorCode } from '../../common/errors/project-errors';

// WRONG — only LTNS_*, no project codes, diverges over time
import { ErrorCode } from '@lenne.tech/nest-server';
```

## Defining a New Error Code

### Checklist per entry

- [ ] **Key:** `UPPER_SNAKE_CASE`, describes the failure semantically (`REQUEST_INVALID_STATUS_TRANSITION`, not `BAD_STATUS`)
- [ ] **Code:** `PROJ_XXXX`, unique across the registry, in the correct range
- [ ] **Message:** English developer message, imperative/factual ("Order already completed", not "The order is already completed by the user")
- [ ] **Translations:** At minimum `de` + `en`. Keep translations end-user-friendly (no technical jargon, no stack traces)
- [ ] **Placeholders:** Use `{paramName}` for runtime values (`'Order with ID {orderId} not found.'`). The frontend interpolates them
- [ ] **No duplicates:** grep for existing semantically-similar codes before adding

### Example

```typescript
export const ProjectErrors = {
  REQUEST_NOT_FOUND: {
    code: 'PROJ_0001',
    message: 'Request not found',
    translations: {
      de: 'Die Anfrage wurde nicht gefunden.',
      en: 'The request was not found.',
    },
  },
  REQUEST_INVALID_STATUS_TRANSITION: {
    code: 'PROJ_0003',
    message: 'Invalid request status transition',
    translations: {
      de: 'Der Anfragestatus kann nicht von {from} nach {to} geändert werden.',
      en: 'The request status cannot change from {from} to {to}.',
    },
  },
} as const satisfies IErrorRegistry;
```

## HTTP Status Code Mapping

Match the NestJS exception class to the semantic of the error code:

| Exception | When | Typical codes |
|-----------|------|---------------|
| `BadRequestException` | Malformed input, validation | `VALIDATION_FAILED`, `INVALID_FIELD_FORMAT`, `REQUIRED_FIELD_MISSING` |
| `UnauthorizedException` | Not authenticated | `UNAUTHORIZED`, `TOKEN_EXPIRED`, `INVALID_CREDENTIALS` |
| `ForbiddenException` | Authenticated but not allowed | `ACCESS_DENIED`, `RESOURCE_FORBIDDEN`, `OPERATION_NOT_PERMITTED` |
| `NotFoundException` | Resource does not exist | `RESOURCE_NOT_FOUND`, domain-specific `X_NOT_FOUND` |
| `ConflictException` | Duplicate / state conflict | `RESOURCE_ALREADY_EXISTS`, `EMAIL_ALREADY_EXISTS` |
| `UnprocessableEntityException` | Semantically valid but unprocessable | Business-rule codes (`QUOTA_EXCEEDED`, `REQUEST_INVALID_STATUS_TRANSITION`) |
| `InternalServerErrorException` | Unexpected server failure | `INTERNAL_ERROR`, `SERVICE_UNAVAILABLE` |

## When to Extend (Scenarios B/C)

Scenario A (`additionalErrorRegistry`) covers ~95 % of projects. Use B or C only when:

- **Scenario B (custom service):** project needs more locales than the default `de`/`en`, OR a custom translation-lookup strategy (e.g. from DB, from CMS).
- **Scenario C (custom controller):** project needs additional endpoints (`/codes` listing, custom routes, non-standard path prefix).

Both require `errorCode: { autoRegister: false }` in config AND the corresponding `overrides: { errorCode: { service, controller } }` in `CoreModule.forRoot()`. See `src/core/modules/error-code/INTEGRATION-CHECKLIST.md` for the exact steps.

## Review Rules

Enforce during code review:

1. **No raw strings in exceptions.** `throw new XxxException('...')` with a literal string argument is forbidden outside of `*.test.ts` files. Grep regex:
   ```
   throw new (BadRequest|Unauthorized|Forbidden|NotFound|Conflict|UnprocessableEntity|InternalServerError)Exception\(\s*['"`]
   ```
2. **`ErrorCode` imported from project file**, not from framework. Grep:
   ```
   import .*ErrorCode.* from '@lenne.tech/nest-server'
   ```
   should yield zero hits in `src/server/`.
3. **Every `throw` uses an existing key** — TypeScript enforces this because `ErrorCode` is a strongly-typed object.
4. **Translations present for every configured locale.** `satisfies IErrorRegistry` catches missing `de`/`en` at compile time.
5. **No duplicate codes across `LtnsErrors` + `ProjectErrors`.** A post-build assertion or test should verify uniqueness.
6. **Error codes are NEVER renamed or recycled.** Once shipped, a code is a public API contract (frontend translations, logs, analytics). Deprecate instead — add a new code and mark the old one as deprecated in a comment.

## Migration Pattern (Adopting ErrorCode in an Existing Project)

For projects with legacy raw-string throws:

1. **Inventory:** `grep -rn "throw new .*Exception('" src/server/` → list every raw-string throw.
2. **Classify each message:**
   - Generic → map to existing `LTNS_*` code.
   - Domain-specific → define new `PROJ_*` code in `project-errors.ts`.
3. **Replace throws** with `ErrorCode.KEY`, add imports.
4. **Add i18n translations** for any new project codes (de + en minimum).
5. **Run permissions scanner & tests** (`lt server permissions`, `pnpm test`) — translations don't break tests, but ensure no regression.
6. **Verify endpoint:** `curl /i18n/errors/de` — new project codes must appear.

Do the migration per module, not across the whole codebase at once — easier review, smaller PRs.

## Anti-Patterns

| Anti-pattern | Why wrong | Fix |
|--------------|-----------|-----|
| `throw new Error('foo')` (plain `Error`) | Not a NestJS exception — no HTTP status, no JSON response | Use `BadRequestException` etc. with `ErrorCode` |
| `throw new NotFoundException({ message: '...', error: 'foo' })` | Bypasses `#CODE:` marker, breaks frontend translation lookup | Pass `ErrorCode.KEY` as the first argument |
| Embedding user input in the message string | XSS vector if message is echoed unescaped; also makes codes non-unique | Use placeholders (`{id}`) in translations, interpolate on frontend |
| German-only message in the `en` translation | Frontend in English shows German text | Always provide genuine `en` and `de` translations |
| Reusing an LTNS_* number in project registry | Collision; last-wins depending on merge order | Use a project-specific prefix (`PROJ_*`) and a unique range |
| Importing `ErrorCode` from `@lenne.tech/nest-server` in project code | Misses all project codes; future project additions silently ignored | Import from `src/server/common/errors/project-errors.ts` |
| Storing error messages in the database | Duplication, no i18n, diverges from registry | Store only the code, look up message via frontend i18n |

## Quick Reference

```typescript
// Define
export const ProjectErrors = {
  ORDER_NOT_FOUND: {
    code: 'PROJ_0001',
    message: 'Order not found',
    translations: { de: 'Bestellung nicht gefunden.', en: 'Order not found.' },
  },
} as const satisfies IErrorRegistry;

export const ErrorCode = mergeErrorCodes(ProjectErrors);

// Register (every env in config.env.ts)
errorCode: { additionalErrorRegistry: ProjectErrors }

// Use
import { ErrorCode } from '../../common/errors/project-errors';
throw new NotFoundException(ErrorCode.ORDER_NOT_FOUND);

// Frontend receives
{ "statusCode": 404, "message": "#PROJ_0001: Order not found" }

// Frontend fetches translations
GET /i18n/errors/de
→ { "errors": { "PROJ_0001": "Bestellung nicht gefunden.", ... } }
```
