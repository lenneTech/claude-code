# Quality Gate — Pass 2/2 (Verification)

Fixes were applied from review findings. Verify everything is clean.

## Step 1: Verify Build, Lint & Test

Detect the package manager (pnpm/yarn/npm via lockfile), then run ALL checks as **parallel Bash calls in one message** (all are read-only verification):

1. **lint** script — must pass with zero errors
2. **tsc --noEmit** (via local binary) — must pass with zero TypeScript errors
3. **build** script — must succeed
4. **test** script (if available) — run tests, ALL must pass

**CRITICAL:** Send all 4 checks in a **single message** with multiple Bash tool calls so they execute in parallel. Do NOT run them sequentially — they are all read-only and independent.

**Test failures are blocking** — failing tests are ALWAYS a problem. Fix the root cause of every failing test before allowing stop.

## Step 2: Summary Report

Present a final summary to the user:

| Check           | Status |
|-----------------|--------|
| Lint            | .../... |
| TypeScript      | .../... |
| Build           | .../... |
| Tests           | .../... |
| Security Review | .../... |
| Code Review     | .../... |

### Security Fixes Applied
- [list what was fixed, or "No critical findings"]

### Code Review Fixes Applied
- [list auto-fixes applied]

### Remaining Items (user decision needed)
- [list items that need user input, or "None"]
