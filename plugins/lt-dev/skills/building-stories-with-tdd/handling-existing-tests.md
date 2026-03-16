---
name: story-tdd-handling-existing-tests
description: Complete guide for handling existing tests when modifying code in TDD workflow - decision trees, git analysis, examples, and guidelines for determining when to update tests vs fix code
---

#  Handling Existing Tests When Modifying Code

## Table of Contents
- [Analysis Decision Tree](#analysis-decision-tree)
- [Using Git for Analysis (ALLOWED)](#using-git-for-analysis-allowed)
- [Examples](#examples)
- [Guidelines](#guidelines)
- [Process](#process)
- [Red Flags](#red-flags)
- [Remember](#remember)

**CRITICAL RULE:** When your code changes cause existing (non-story) tests to fail, you MUST analyze and handle this properly. Failing tests are ALWAYS a problem — fix the root cause of every failure, even if it predates the current changes or seems unrelated. A green test suite is a non-negotiable prerequisite for completing any work.

## Analysis Decision Tree

When existing tests fail after your changes:

```
Existing test fails
    │
    ├─► Was this change intentional and breaking?
    │   │
    │   ├─► YES: Change was deliberate and it's clear why tests break
    │   │   └─►  Update the existing tests to reflect new behavior
    │   │       - Modify test expectations
    │   │       - Update test data/setup if needed
    │   │       - Document why test was changed
    │   │
    │   └─► NO/UNCLEAR: Not sure why tests are breaking
    │       └─►  Investigate potential side effect
    │           │
    │           ├─► Use git to review previous state:
    │           │   - git show HEAD:path/to/file.ts
    │           │   - git diff HEAD path/to/test.ts
    │           │   - git log -p path/to/file.ts
    │           │
    │           ├─► Compare old vs new behavior
    │           │
    │           └─►  Likely unintended side effect!
    │               └─► Fix code to satisfy BOTH old AND new tests
    │                   - Refine implementation
    │                   - Add conditional logic if needed
    │                   - Ensure backward compatibility
    │                   - Keep existing functionality intact
```

## Using Git for Analysis (ALLOWED)

** Git commands are EXPLICITLY ALLOWED for analysis:**

```bash
# View old version of a file
git show HEAD:src/server/modules/user/user.service.ts

# See what changed in a file
git diff HEAD src/server/modules/user/user.service.ts

# View file from specific commit
git show abc123:path/to/file.ts

# See commit history for a file
git log -p --follow path/to/file.ts

# Compare branches
git diff main..HEAD path/to/file.ts
```

**These commands help you understand:**
- What the code looked like before your changes
- What the previous test expectations were
- Why existing tests were written a certain way
- Whether your change introduces regression

## Examples

### Example 1: Intentional Breaking Change

```typescript
// Scenario: You added a required field to User model
// Old test expects: { email, firstName }
// New behavior requires: { email, firstName, lastName }

//  CORRECT: Update the test
it('should create user', async () => {
  const user = await userService.create({
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe', //  Added required field
  });
  // ...
});
```

### Example 2: Unintended Side Effect

```typescript
// Scenario: You changed authentication logic for new feature
// Old tests for different feature now fail unexpectedly

//  WRONG: Just update the failing tests
//  CORRECT: Investigate and fix the code

// 1. Use git to see old implementation
// git show HEAD:src/server/modules/auth/auth.service.ts

// 2. Identify the unintended side effect
// 3. Refine your code to avoid breaking existing functionality

// Example fix: Add conditional logic
async authenticate(user: User, options?: AuthOptions) {
  // Your new feature logic
  if (options?.useNewBehavior) {
    return this.newAuthMethod(user);
  }

  // Preserve existing behavior for backward compatibility
  return this.existingAuthMethod(user);
}
```

## Guidelines

** DO update existing tests when:**
- You intentionally changed an API contract
- You removed deprecated functionality
- You renamed fields/methods
- The old behavior is being replaced (not extended)
- It's documented in your story requirements

** DON'T update existing tests when:**
- You're not sure why they're failing
- The failure seems unrelated to your story
- Multiple unrelated tests are breaking
- The test was testing important existing functionality

** INVESTIGATE when:**
- More than 2-3 existing tests fail
- Tests in unrelated modules fail
- Test failure messages are unclear
- You suspect a side effect

## Process

1. **Run ALL tests** (not just story tests)
   ```bash
   pnpm test
   ```

2. **If existing tests fail:**
   ```bash
   # Identify which tests failed
   # For each failing test, decide:
   ```

3. **For intentional changes:**
   - Update test expectations
   - Document change in commit message (when developer commits)
   - Verify all tests pass

4. **For unclear failures:**
   - Use `git show` to see old code
   - Use `git diff` to see your changes
   - Compare old vs new behavior
   - Refine code to fix both old AND new tests

5. **Validate:**
   ```bash
   # All tests (old + new) should pass
   pnpm test
   ```

## Red Flags

🚩 **Warning signs of unintended side effects:**
- Tests in different modules failing
- Security/auth tests failing
- Tests that worked in `main` branch now fail
- Tests with names unrelated to your story failing

**When you see red flags:**
1. STOP updating tests
2. Use git to investigate
3. Fix the code, not the tests
4. Ask developer if uncertain

## Remember

- **Existing tests are documentation** of expected behavior
- **Don't break working functionality** to make new tests pass
- **Use git freely** for investigation (NOT for commits)
- **When in doubt, preserve backward compatibility**
- **Failing tests are ALWAYS a problem** — never ignore, skip, or defer them, even if they predate the current work
- **A green test suite is non-negotiable** — all tests must pass before any work is considered complete
