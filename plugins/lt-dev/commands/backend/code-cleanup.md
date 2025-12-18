---
description: Clean up and optimize code quality
allowed-tools: Read, Grep, Glob, Edit, Bash(npm run build:*), Bash(npm run lint:*), Bash(git diff:*), Bash(git status:*)
---

# Code Cleanup

## When to Use This Command

- After completing a feature implementation
- Before creating a merge request
- When preparing for code review
- To enforce consistent code style across modified files

## Related Commands

| Command | Purpose |
|---------|---------|
| `/lt-dev:backend:sec-review` | Security review of code changes |
| `/lt-dev:backend:test-generate` | Generate tests for changes |

**Recommended workflow:** `test-generate` → `sec-review` → `code-cleanup`

---

Perform a complete code cleanup:

##  1. Import Optimization

For all modified TypeScript files:
- [ ] Sort imports alphabetically
- [ ] Grouping: External → @lenne.tech → Local
- [ ] Remove unused imports
- [ ] Remove duplicate imports

## 🔤 2. Property Ordering

For all Model/Input/Object files:
- [ ] Sort properties alphabetically
- [ ] Decorators consistently ordered
- [ ] Same order in Model, CreateInput, UpdateInput

##  3. Description Management

Check all descriptions:
- [ ] Format: "ENGLISH (DEUTSCH)" for German terms
- [ ] Format: "ENGLISH" for English terms
- [ ] Consistency: Same description in Model + Inputs
- [ ] Class-level descriptions present (@ObjectType, @InputType)
- [ ] No missing descriptions

##  4. Code Refactoring

Search for duplicated code:
- [ ] Is code repeated 2+ times?
- [ ] Can it be extracted into private methods?
- [ ] Are similar code paths consolidatable?
- [ ] Helper functions useful?

## 🧹 5. Debug Code Removal

Remove development code:
- [ ] All console.log() statements
- [ ] All console.debug/warn/error (except production logging)
- [ ] Commented-out code
- [ ] Review TODO/FIXME comments

##  6. Formatting

Check code formatting:
- [ ] Consistent indentation (2 or 4 spaces)
- [ ] No extra blank lines
- [ ] Add missing blank lines between sections
- [ ] Remove trailing whitespace

##  7. Build & Lint

Run automatic checks:
```bash
# TypeScript Compilation
npm run build

# Linting
npm run lint

# Optional: Auto-Fix
npm run lint:fix
```

Fix all errors and warnings!

##  Final Check

- [ ] All imports optimized
- [ ] All properties sorted
- [ ] All descriptions correct
- [ ] Code refactored (DRY)
- [ ] Debug code removed
- [ ] Build successful
- [ ] Lint successful
- [ ] Tests still passing

**Only when everything is : Cleanup completed!**
