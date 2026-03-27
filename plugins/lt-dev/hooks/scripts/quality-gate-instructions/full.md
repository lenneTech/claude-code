# Quality Gate — Full (large change detected)

Significant changes detected. Running full quality gate with parallel reviews.

## Step 1: Build, Lint & Test

Detect the package manager (pnpm/yarn/npm via lockfile), then run in each affected subproject:

**Phase A (sequential — these modify files):**
1. **lint:fix** script (or equivalent) — auto-fix lint issues
2. **format** script (if available) — auto-format code

**Phase B (parallel Bash calls in one message — read-only):**
3. **tsc --noEmit** (via local binary, in each subproject) — zero TypeScript errors, no implicit any
4. **build** script — verify build succeeds
5. **test** script (if exists) — run test suite

**TypeScript errors are blocking** — fix all TS errors before proceeding to reviews.
**Test failures are blocking** — failing tests are ALWAYS a problem. Fix the root cause of every failing test, even if the failure predates the current changes or seems unrelated. A green test suite is a non-negotiable prerequisite.

## Step 2: Parallel Code Reviews (no browser)

Launch ALL applicable code-only reviewers simultaneously using Agent tool calls in a **single message**:

1. **Security Reviewer** — Agent tool with `subagent_type: "lt-dev:security-reviewer"`:
   - Prompt: "Quick security review of recent code changes. Focus on: injection risks, auth bypass, data exposure, missing input validation, hardcoded secrets, missing @Restricted/@Roles/securityCheck. Only report Critical and High severity findings. Be concise."

2. **Backend Reviewer** (only if api/ or src/server/ files changed) — Agent tool with `subagent_type: "lt-dev:backend-reviewer"`:
   - Prompt: "Quick backend review of recent code changes. Focus on: missing @Restricted/@Roles, missing securityCheck, implicit any, missing input validation, blind serviceOptions passthrough. Only report High severity findings. Be concise."

3. **Documentation Reviewer** — Agent tool with `subagent_type: "lt-dev:docs-reviewer"`:
   - Prompt: "Quick documentation review of recent code changes. Focus on: missing README updates for new features, missing JSDoc on new public interfaces, missing migration guide for breaking changes or new config options, new env vars not in .env.example. Only report High severity findings. Be concise."

## Step 3: Sequential Browser Reviews (Chrome DevTools MCP)

**IMPORTANT:** Browser reviewers use Chrome DevTools MCP which has global page state (`select_page`). They MUST run one at a time — never in parallel.

Launch each reviewer **after the previous one completes**:

1. **Frontend Reviewer** (only if .vue or app/ files changed) — Agent tool with `subagent_type: "lt-dev:frontend-reviewer"`:
   - Prompt: "Review recent frontend code changes with browser testing via Chrome DevTools MCP. Focus on: missing types on refs/computed, SSR safety violations, accessibility gaps, hardcoded colors, console.log usage, missing Loading/Error/Empty states. Navigate to affected pages and verify rendering. Only report High severity findings. Be concise."

2. **UX Reviewer** (only if .vue or app/ files changed) — Agent tool with `subagent_type: "lt-dev:ux-reviewer"`:
   - Prompt: "Review UX patterns of recent code changes with browser testing via Chrome DevTools MCP. Focus on: missing Loading/Empty/Error states, missing toast feedback after actions, dead-end navigation, forms without loading on submit, destructive actions without confirmation. Navigate to affected pages and verify behavior. Only report High severity findings. Be concise."

3. **A11y Reviewer** (only if .vue or app/ files changed) — Agent tool with `subagent_type: "lt-dev:a11y-reviewer"`:
   - Prompt: "Review accessibility of recent code changes with browser testing via Chrome DevTools MCP. Run Lighthouse audit on affected pages. Check ARIA labels, semantic HTML, keyboard navigation, contrast. Only report High severity findings. Be concise."

## Step 4: Handle Review Findings

After all reviews complete:

**Critical/High security findings:**
- Fix them immediately. These are non-negotiable.

**Critical/High code review findings:**
- Auto-fix: lint issues, formatting, missing type annotations, dead code
- Report to user (do NOT auto-fix): architectural concerns, design decisions, missing tests
