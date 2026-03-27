# Quality Gate — Light (small change detected)

Only a few files with minor changes. Running lint, TypeScript check, and build only.

## Steps

Detect the package manager (pnpm/yarn/npm via lockfile), then run:

**Phase A (sequential — these modify files):**
1. **lint:fix** script (or equivalent) — auto-fix lint issues
2. **format** script (if available) — auto-format code

**Phase B (parallel Bash calls in one message — read-only):**
3. **tsc --noEmit** (via local binary) — zero TypeScript errors
4. **build** script — verify build succeeds

**TypeScript errors are blocking** — fix all TS errors before allowing stop.

If all pass, present a short summary. No agent reviews needed for this change size.
