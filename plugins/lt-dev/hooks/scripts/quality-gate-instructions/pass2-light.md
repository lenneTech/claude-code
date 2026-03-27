# Quality Gate — Pass 2/2 (Verification, Light)

Verify lint/build fixes are clean.

## Steps

Detect the package manager (pnpm/yarn/npm via lockfile), then run ALL checks as **parallel Bash calls in one message** (all are read-only verification):

1. **lint** script — must pass with zero errors
2. **tsc --noEmit** (via local binary) — must pass with zero TypeScript errors
3. **build** script — must succeed

## Summary

Present a short summary:

| Check      | Status |
|------------|--------|
| Lint       | .../... |
| TypeScript | .../... |
| Build      | .../... |
