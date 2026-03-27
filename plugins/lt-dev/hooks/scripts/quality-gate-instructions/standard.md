# Quality Gate — Standard (medium change detected)

Moderate changes detected. Running build checks and security review.

## Step 1: Build, Lint & Test

Detect the package manager (pnpm/yarn/npm via lockfile), then run in each affected subproject:

**Phase A (sequential — these modify files):**
1. **lint:fix** script (or equivalent) — auto-fix lint issues
2. **format** script (if available) — auto-format code

**Phase B (parallel Bash calls in one message — read-only):**
3. **tsc --noEmit** (via local binary, in each subproject) — zero TypeScript errors, no implicit any
4. **build** script — verify build succeeds
5. **test** script (if exists) — run test suite

**TypeScript errors are blocking** — fix all TS errors before proceeding.
**Test failures are blocking** — failing tests are ALWAYS a problem. Fix the root cause of every failing test, even if the failure predates the current changes or seems unrelated. A green test suite is a non-negotiable prerequisite.

## Step 2: Security Review

Launch security reviewer only:

1. **Security Reviewer** — Agent tool with `subagent_type: "lt-dev:security-reviewer"`:
   - Prompt: "Quick security review of recent code changes. Focus on: injection risks, auth bypass, data exposure, missing input validation, hardcoded secrets, missing @Restricted/@Roles/securityCheck. Only report Critical and High severity findings. Be concise."

## Step 3: Handle Findings

**Critical/High security findings:** Fix immediately. These are non-negotiable.
**Lint/TS issues:** Auto-fix where possible.
