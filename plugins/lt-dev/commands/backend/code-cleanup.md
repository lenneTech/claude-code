---
description: Clean up and optimize backend code quality for NestJS / @lenne.tech/nest-server projects
argument-hint: "[--scope=all|modules|services|models] [--dry-run]"
allowed-tools: Read, Grep, Glob, Edit, TodoWrite, Bash(npm run build:*), Bash(npm run lint:*), Bash(npm run test:*), Bash(pnpm run build:*), Bash(pnpm run lint:*), Bash(pnpm run test:*), Bash(yarn run build:*), Bash(yarn run lint:*), Bash(yarn run test:*), Bash(git:*), Bash(ls:*), Bash(find:*), Bash(wc:*)
disable-model-invocation: true
---

# Backend Code Cleanup

**Goal:** Code quality, structure, and conventions — NOT functionality changes. Everything must work exactly as before, just cleaner.

## When to Use This Command

- After completing a feature implementation
- Before creating a merge request
- When preparing for code review
- After `/lt-dev:review` shows backend violations
- To enforce consistent code style across modified files

## Related Elements

| Element | Purpose |
|---------|---------|
| `/lt-dev:review` | Code review — run after cleanup to validate quality |
| `/lt-dev:backend:sec-review` | Security review of code changes |
| `/lt-dev:backend:test-generate` | Generate tests for changes |
| `backend-dev` agent | Development agent whose rules are the cleanup baseline |
| `generating-nest-servers` skill | Backend conventions reference |

**Recommended workflow:** `test-generate` → `sec-review` → `code-cleanup` → `/lt-dev:review`

## What Gets Cleaned Up

| Category | What Changes |
|----------|-------------|
| Import order | Alphabetical, grouped: External → @lenne.tech → Local |
| Property order | Alphabetical in Model, CreateInput, UpdateInput |
| Descriptions | Bilingual format, consistency across Model + Inputs |
| Code duplication | Extract into private methods or helpers |
| Debug artifacts | Remove console.log, commented-out code, TODOs |
| Formatting | Consistent indentation, blank lines, whitespace |

## What MUST NOT Change

- **Functionality** — every feature works identically after cleanup
- **API contracts** — same endpoints, same request/response shapes
- **Security decorators** — never weaken @Restricted/@Roles
- **Test behavior** — existing tests still pass

---

## Execution

### 1. Parse Arguments

From `$ARGUMENTS`:
- **`--scope`** (default: `all`): `all` | `modules` | `services` | `models`
- **`--dry-run`** (optional): Only analyze and report, don't modify files

### 2. Package Manager Detection

```bash
ls pnpm-lock.yaml yarn.lock package-lock.json 2>/dev/null
```

### 3. Progress Tracking

**CRITICAL:** Use TodoWrite at the start and update throughout execution:

```
Initial TodoWrite:
[pending] Phase 1: Import optimization
[pending] Phase 2: Property ordering
[pending] Phase 3: Description management
[pending] Phase 4: Code refactoring (DRY)
[pending] Phase 5: Debug code removal
[pending] Phase 6: Formatting
[pending] Phase 7: Build & Lint
[pending] Verification
```

### Phase 1: Import Optimization

For all modified TypeScript files:
- [ ] Sort imports alphabetically
- [ ] Grouping: External → @lenne.tech → Local
- [ ] Remove unused imports
- [ ] Remove duplicate imports

### Phase 2: Property Ordering

For all Model/Input/Object files:
- [ ] Sort properties alphabetically
- [ ] Decorators consistently ordered
- [ ] Same order in Model, CreateInput, UpdateInput

### Phase 3: Description Management

Check all descriptions:
- [ ] Format: `'English text (Deutsche Übersetzung)'` for German terms
- [ ] Consistency: Same description in Model + Inputs
- [ ] Class-level descriptions present (@ObjectType, @InputType)
- [ ] No missing descriptions

### Phase 4: Code Refactoring

Search for duplicated code:
- [ ] Is code repeated 2+ times?
- [ ] Can it be extracted into private methods?
- [ ] Are similar code paths consolidatable?

### Phase 5: Debug Code Removal

Remove development code:
- [ ] All `console.log()` statements
- [ ] All `console.debug/warn/error` (except production logging)
- [ ] Commented-out code
- [ ] Review TODO/FIXME comments

### Phase 6: Formatting

Check code formatting:
- [ ] Consistent indentation
- [ ] No extra blank lines
- [ ] Remove trailing whitespace

### Phase 7: Build & Lint

```bash
pnpm run lint:fix
pnpm run build
```

Fix all errors and warnings!

---

## Verification (MANDATORY — Blocks Completion)

**The cleanup is NOT complete until ALL checks pass.**

```bash
# 1. Lint
pnpm run lint:fix

# 2. Build
pnpm run build

# 3. Tests
pnpm test 2>/dev/null || pnpm run test 2>/dev/null
```

| Check | Required | On Failure |
|-------|----------|------------|
| Lint | Yes — ZERO errors | Fix lint errors, re-run |
| Build | Yes — must succeed | Fix TS errors, re-run |
| Tests | Yes — ALL must pass | Fix broken tests without changing assertions, re-run |

**CRITICAL:** If tests fail, the cleanup introduced a regression. Fix must restore original behavior, NOT adjust tests.

Max 3 fix attempts per check — if still failing, STOP and report errors to user.

---

## Final Report

```
## Backend Cleanup Abgeschlossen

| Phase | Status |
|-------|--------|
| Import Optimization | ✅/⚠️ |
| Property Ordering | ✅/⚠️ |
| Description Management | ✅/⚠️ |
| Code Refactoring | ✅/⚠️ |
| Debug Code Removal | ✅/⚠️ |
| Formatting | ✅/⚠️ |

### Verification
| Check  | Status |
|--------|--------|
| Lint   | ✅ Keine Fehler |
| Build  | ✅ Erfolgreich |
| Tests  | ✅ X/X bestanden |

### Geänderte Dateien
- path/to/file.ts (imports, property order)
- ...
```
