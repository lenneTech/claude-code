---
description: Comprehensive code review with content validation, security, documentation, tests, backend, frontend, UX, a11y, and devops reviewers. Runs package.json check script with auto-fix. Small diffs use single-pass agent; larger diffs spawn parallel domain specialists with cross-domain challenge.
argument-hint: '[issue-id] [--base=main] [--weights="Security:25,..."]'
allowed-tools: Read, Edit, Write, Grep, Glob, Bash(git:*), Bash(echo:*), Bash(grep:*), Bash(wc:*), Bash(jq:*), Bash(cat:*), Bash(ls:*), Bash(test:*), Bash(pnpm run check:*), Bash(npm run check:*), Bash(yarn run check:*), Bash(pnpm check:*), Bash(npm check:*), Bash(yarn check:*), Bash(pnpm run lint:*), Bash(npm run lint:*), Bash(yarn run lint:*), Bash(pnpm run typecheck:*), Bash(npm run typecheck:*), Bash(yarn run typecheck:*), Agent, Skill, AskUserQuestion, mcp__plugin_lt-dev_linear__get_issue, mcp__plugin_lt-dev_linear__list_comments
disable-model-invocation: true
effort: max
---

# Code Review

## When to Use This Command

- Before merging changes to validate overall quality
- After completing a feature or fix implementation
- As a final check after `resolve-ticket`
- When you want a structured assessment across all quality dimensions

## Related Commands

| Command | Purpose |
|---------|---------|
| `/review [PR]` | Claude Code built-in: generic PR-level review (no lt-stack awareness) |
| `/security-review` | Claude Code built-in: generic security review of branch diff — **used internally in Phase 3A as cross-check** |
| `/simplify [focus]` | Claude Code built-in skill: reviews recently changed files AND auto-applies fixes — use BEFORE review, not as part of it |
| `/autofix-pr [prompt]` | Claude Code built-in: cloud session that watches the PR and pushes fixes for CI failures / review comments |
| `/lt-dev:check` | Runnability-only gate (runs the same check-script logic as Phase 1.5 of this command) |
| `/lt-dev:backend:sec-review` | Focused security review (@lenne.tech/nest-server specific) |
| `/lt-dev:backend:code-cleanup` | Code style and formatting cleanup |
| `/lt-dev:backend:test-generate` | Generate tests for changes |
| `/lt-dev:backend:sec-audit` | OWASP security audit for dependencies |
| `/lt-dev:resolve-ticket` | Resolve a ticket (run review after) |
| `/lt-dev:debug` | Adversarial debugging with competing hypotheses |

**Recommended workflow:** `resolve-ticket` → optional `/simplify` → `/lt-dev:review` → address findings → `code-cleanup` → create PR → `/review`

---

## Architecture

This command is the **direct orchestrator** — it spawns all reviewers in parallel without an intermediary agent. Sub-agents cannot spawn sub-sub-agents, so the command itself must be the parallelization point.

```
/lt-dev:review (this command = orchestrator)
│
│  Phase 1: Diff analysis & domain detection
│  Phase 2: Content validation (requirements, scope, edge cases)
│
│  Phase 3A: Code-only reviewers — ALL spawned in parallel (single message):
│  ├── security-reviewer      (always — OWASP, Permissions, Injection, XSS, Auth, Secrets, Dependencies)
│  ├── /security-review       (always — Claude Code built-in, generic diff-based cross-check)
│  ├── docs-reviewer          (always — README, JSDoc, Migration Guides, Config Documentation)
│  ├── performance-reviewer   (always — Bundle, Queries, Memory, Async, Caching, k6 Baselines)
│  ├── test-reviewer          (if source files changed — Coverage, Quality, Isolation, API-First, Flaky Detection)
│  ├── backend-reviewer       (if backend changes — Security Decorators, Models, Controllers, Services, Tests)
│  └── devops-reviewer        (if infra changes — Docker, CI/CD, Environment, .dockerignore)
│
│  Phase 3B: Browser reviewers — sequential (Chrome DevTools MCP has global page state):
│  ├── frontend-reviewer    (if frontend changes — Types, Components, Code Quality, SSR, Performance, Styling)
│  ├── ux-reviewer          (if frontend changes — State Handling, Feedback, Navigation, Form UX, Responsive)
│  └── a11y-reviewer        (if frontend changes — ARIA, Semantic HTML, Keyboard, Contrast, SEO, Lighthouse a11y+perf)
│
│  Phase 4: Cross-domain challenge (filter false positives, deduplicate, annotate)
│
└── Phase 5: Unified report with consolidated remediation catalog
```

---

## Execution

Parse arguments from `$ARGUMENTS`:
- **Issue ID** (optional): Linear issue identifier (e.g., `LIN-123`) for requirement validation
- **`--base=<branch>`** (optional, default: `main`): Base branch for diff comparison
- **`--weights="Domain:N,..."`** (optional): Override default score weights (see Score Weights section)

### Phase 1: Diff Analysis & Domain Detection

1. **Get the full diff:**
   ```bash
   git diff <base-branch>...HEAD --stat
   git diff <base-branch>...HEAD --name-only
   ```

2. **Classify changed files into domains:**
   ```bash
   # Backend files
   git diff <base-branch>...HEAD --name-only | grep -E "projects/api/|packages/api/|src/server/" | head -50
   # Frontend files
   git diff <base-branch>...HEAD --name-only | grep -E "projects/app/|packages/app/|app/components/|app/pages/|app/composables/|\.vue$" | head -50
   # Infrastructure files
   git diff <base-branch>...HEAD --name-only | grep -E "Dockerfile|docker-compose|\.env|\.dockerignore|\.gitlab-ci|\.github/workflows|Jenkinsfile" | head -50
   ```

3. **Detect project type:**
   - `@lenne.tech/nest-server` in package.json → **Backend**
   - `nuxt` or `@lenne.tech/nuxt-extensions` → **Frontend**
   - Both → **Fullstack**
   - Neither → **Generic**

4. **Determine which reviewers to spawn:**

   | Condition | Reviewer |
   |-----------|----------|
   | Always | `security-reviewer`, `docs-reviewer`, `performance-reviewer` |
   | Always (built-in cross-check, not an agent) | `/security-review` — supports the Security cross-challenge only; skipped silently on the small-diff path |
   | Backend files changed | `backend-reviewer` |
   | Frontend files changed | `frontend-reviewer`, `ux-reviewer`, `a11y-reviewer` |
   | Infra files changed | `devops-reviewer` |
   | Source files changed (or source without tests) | `test-reviewer` |

   **Generic project:** Skip `backend-reviewer` and `frontend-reviewer` (framework-specific).

5. **Load issue details** (if Issue ID provided):
   - Use `mcp__plugin_lt-dev_linear__get_issue` to retrieve title, description, acceptance criteria
   - Use `mcp__plugin_lt-dev_linear__list_comments` for additional context

6. **Draft Change Summary:** What changed, how, and why (2-4 sentences).

7. **Measure diff magnitude:**
   ```bash
   git diff <base-branch>...HEAD | grep -c '^[+-][^+-]'
   git diff <base-branch>...HEAD --name-only | wc -l
   ```

### Phase 1.5: Check Script Validation & Auto-Fix

**Runs BEFORE every review path** (both single-pass and parallel). Goal: guarantee the project is in a runnable state before any reviewer sees it.

**Follow the `running-check-script` skill verbatim** (`plugins/lt-dev/skills/running-check-script/SKILL.md`). It defines:

- **Step 1** — Discovery via `bash "${CLAUDE_PLUGIN_ROOT}/scripts/discover-check-scripts.sh" "$(pwd)"`
- **Step 2** — Per-project `check` execution
- **Step 3** — Auto-fix loop: iterate until truly GREEN (exit 0), no hard iteration cap, terminate only on GREEN or STALLED (error count no longer decreases)
- **Step 4** — Audit findings: mandatory 6-step fix escalation ladder before any acceptance
- **Step 5** — Residual classification (Accepted vs Critical blocker)
- **Step 6** — Bypass policy (no `--no-verify`, no `@ts-ignore`, no `eslint-disable`, etc.)
- **Step 7** — Test-duplication baseline (record `git rev-parse HEAD` + `git status --porcelain` after GREEN)
- **Step 8** — Report block format
- **Step 9** — Gating

After Phase 1.5 completes, paste the Step 8 report block verbatim into the final review output, then continue with Phase 2. If any Unresolved blockers remain, surface them prominently in the header and add them to the Consolidated Remediation Catalog with Critical priority.

### Small-Diff Optimization

If the diff is small (**< 20 changed lines AND <= 2 changed files**), skip Phases 2-5 and spawn the single-pass `code-reviewer` agent instead:

```
Agent tool with subagent_type "lt-dev:code-reviewer":

Perform a single-pass code review on the current branch.

Base branch: <base-branch>
Issue ID: <issue-id or "none">
Changed files:
<full list of changed files>

SKIP Phase 1.5 (Check Script Validation & Auto-Fix) — the orchestrator has already
executed the check script and auto-fixed all resolvable errors. Check-script results
to include verbatim in your report:
<paste orchestrator's Check Script Results block here>

Cover all quality dimensions: content, security, code quality, tests, documentation, formatting.
Produce your structured single-pass report.
```

After the single-pass agent completes, present its report as the final output.

**Note:** The built-in `/security-review` cross-check is NOT invoked on the small-diff path — the single-pass `code-reviewer` agent already covers security for diffs this small, and the extra Skill call would only add latency.

**If diff exceeds the threshold:** Continue with Phase 2 as usual.

### Phase 2: Content Validation

Run directly in this command (not delegated to sub-agents):

1. **Requirement Fulfillment** (if Issue ID provided):
   - Compare diff against acceptance criteria from the Linear issue
   - List each criterion and whether the diff addresses it
   - Flag unaddressed criteria as ❌

2. **Logical Coherence:** Verify changes form a coherent whole — no contradictory behavior, no incomplete implementations, no dead code paths introduced.

3. **Scope Check:** Flag unrelated changes that don't serve the stated goal (scope creep).

4. **Edge Cases:** Check for null/empty/boundary handling, off-by-one risks, and concurrency considerations in new code paths.

5. **Error Handling:** Verify try/catch where needed, appropriate error responses (4xx/5xx for API, user-facing messages for UI), null guards, and graceful degradation.

6. **Cleanup Check:**
   ```bash
   grep -rn "TODO\|FIXME\|HACK\|XXX\|console\.log\|debugger" $(git diff <base-branch>...HEAD --name-only) 2>/dev/null
   ```

### Phase 3A: Parallel Code Reviews (no browser)

**CRITICAL:** Send ALL Agent tool calls **and the built-in `/security-review` Skill call** in a **single message** so they execute in parallel. Do NOT send them one by one — that makes them sequential.

These reviewers only analyze code — they do NOT use Chrome DevTools MCP and can safely run in parallel.

#### Security Reviewer (always)
```
Agent tool with subagent_type "lt-dev:security-reviewer":

Review the code changes on the current branch for security vulnerabilities.

Base branch: <base-branch>
Project type: <Backend/Frontend/Fullstack>
Changed files:
<full list of changed files>

Audit OWASP Top 10, permission model (@Restricted/@Roles/securityCheck), injection vectors,
XSS patterns, auth/session security, secrets exposure, dependency CVEs, and infrastructure security.
Produce your structured security report with severity classification.
```

#### Built-in `/security-review` Cross-Check (always)

Invoke the Claude Code built-in `/security-review` skill in the **same single message** as the Agent tool calls above, so all reviewers execute in parallel. The built-in analyses the git diff vs. merge-base for generic security patterns (injection, auth issues, data exposure) and returns its findings inline.

```
Skill tool with skill "security-review":
(no arguments — it auto-detects the current branch diff)
```

Capture the built-in's output verbatim into a variable `builtin_security_findings` for Phase 4 cross-domain challenge. Do NOT treat it as a reviewer report (no fulfillment grade, no structured severity). Its role is to supply an independent second opinion that the lt-specific `security-reviewer` agent can be challenged against.

**If the built-in is unavailable** (older Claude Code versions, Skill tool denied): log "`/security-review` unavailable — skipping built-in cross-check" and continue. The agent's report stands on its own.

#### Documentation Reviewer (always)
```
Agent tool with subagent_type "lt-dev:docs-reviewer":

Review documentation completeness on the current branch.

Base branch: <base-branch>
Project type: <Backend/Frontend/Fullstack/Generic>
Changed files:
<full list of changed files>

Change summary:
<change summary from Phase 1>

Check module README completeness, interface JSDoc, migration guide existence for
new features/config/breaking changes, inline comments for complex logic, and
configuration documentation (.env.example, INTEGRATION-CHECKLIST).
Produce your structured documentation review report with fulfillment grades.
```

#### Performance Reviewer (always)
```
Agent tool with subagent_type "lt-dev:performance-reviewer":

Review the code changes on the current branch for performance regressions.

Base branch: <base-branch>
Project type: <Backend/Frontend/Fullstack>
Changed files:
<full list of changed files>
API URL: http://localhost:3000

Analyze bundle impact, database query patterns, memory management, async efficiency,
API payload optimization, and caching strategy. Run k6 load tests with baseline
comparison if k6 is installed and backend is running. Scaffold k6 infrastructure
if not present. Lighthouse performance is handled by a11y-reviewer.
Produce your structured performance review report with fulfillment grades.
```

#### Backend Reviewer (if backend changes)
```
Agent tool with subagent_type "lt-dev:backend-reviewer":

Review the backend code changes on the current branch.

Base branch: <base-branch>
API root: <path to api project>
Issue ID: <issue-id or "none">
Changed files:
<list of backend files>

Check security decorators & permission model, model rules, controller & service patterns,
type strictness & input validation, code quality, test coverage, and formatting.
Produce your structured backend review report with fulfillment grades.
```

#### Test Reviewer (if source files changed)
```
Agent tool with subagent_type "lt-dev:test-reviewer":

Review the test quality and coverage on the current branch.

Base branch: <base-branch>
Changed files:
<full list of changed files>

Check-script status from Phase 1.5: <GREEN / YELLOW (accepted residuals only) / BLOCKED>
Check script covers tests: <yes / no> (true when the check script transitively invokes
test/vitest/jest/playwright). When "yes" AND status is GREEN or YELLOW AND no files have
changed since Phase 1.5 completed, SKIP re-running the test suite — the regression check
has already happened. Focus on static analysis: coverage gaps, test quality, isolation,
API-first patterns, naming. Only execute tests yourself if check did not cover them, or
if files have been modified after Phase 1.5.

Check test coverage gaps (40% regression + 60% coverage weighting), test quality & assertions,
test isolation & data safety, API-first testing patterns, permission & security testing,
test naming & structure, and flaky test detection (re-run failures 2-3x for classification).
CRITICAL: Failing tests are ALWAYS a problem — flag every failure as must-fix regardless of
whether it predates the current changes or seems unrelated.
Produce your structured test review report with fulfillment grades.
```

#### DevOps Reviewer (if infrastructure changes)
```
Agent tool with subagent_type "lt-dev:devops-reviewer":

Review the infrastructure changes on the current branch.

Base branch: <base-branch>
Changed files:
<list of infrastructure files>

Check Dockerfiles, docker-compose configurations, CI/CD pipelines, environment management,
permissions gates, Nuxt 4 SSR build patterns, and .dockerignore completeness.
Produce your structured DevOps review report with fulfillment grades.
```

### Phase 3B: Sequential Browser Reviews (Chrome DevTools MCP)

**IMPORTANT:** These reviewers use Chrome DevTools MCP which has global page state (`select_page` sets context for all subsequent tool calls). Running them in parallel causes race conditions where agents operate on each other's pages. They MUST run **one at a time** — launch the next only after the previous completes.

If no frontend/page files changed, skip this phase entirely.

#### Frontend Reviewer (if frontend changes)
```
Agent tool with subagent_type "lt-dev:frontend-reviewer":

Review the frontend code changes on the current branch with browser testing.

Base branch: <base-branch>
App root: <path to app project>
App URL: http://localhost:3001
Issue ID: <issue-id or "none">
Changed files:
<list of frontend files>

Check TypeScript strictness, component structure & decomposition, code quality (DRY,
complexity, naming), composable patterns, accessibility (a11y), SSR safety, performance,
styling conventions, Tailwind/CSS quality, and tests/formatting.
Use Chrome DevTools MCP to navigate to affected pages and verify rendering.
Produce your structured frontend review report with fulfillment grades.
```

#### UX Reviewer (after Frontend Reviewer completes, if frontend/page changes)
```
Agent tool with subagent_type "lt-dev:ux-reviewer":

Review UX patterns on the current branch with browser testing.

Base branch: <base-branch>
App URL: http://localhost:3001
Changed files:
<list of frontend files>

Check state handling (Loading/Empty/Error), user feedback (Toast consistency),
navigation patterns, form UX, destructive action safety, optimistic UI,
cross-page consistency, error recovery, and responsive behavior.
Use Chrome DevTools MCP to navigate to affected pages and verify behavior.
Produce your structured UX review report with fulfillment grades.
```

#### A11y & SEO Reviewer (after UX Reviewer completes, if frontend/page changes)
```
Agent tool with subagent_type "lt-dev:a11y-reviewer":

Review accessibility, form autocomplete, and SEO on the current branch with browser testing.

Base branch: <base-branch>
App URL: http://localhost:3001
Changed files:
<list of frontend files>

Check ARIA labels & roles, semantic HTML, keyboard navigation, color & contrast,
images & media, forms & autocomplete attributes, dynamic content accessibility,
SEO essentials (useHead, OG tags), and crawlability (SSR, sitemap, robots.txt).
Run Lighthouse audit via Chrome DevTools MCP on affected pages.
Produce your structured a11y & SEO review report with fulfillment grades.
```

### Phase 4: Cross-Domain Challenge (skip if <= 2 reviewers spawned)

After ALL agents (from both Phase 3A and 3B) return their reports, perform cross-domain analysis.

**Skip condition:** If only 1-2 **agent reviewers** were spawned (the built-in `/security-review` cross-check does NOT count toward this threshold, since it only supports the Security challenge), skip this phase — cross-domain analysis adds minimal value with few data points. Proceed directly to Phase 5.

**Partial-skip exception:** When Phase 4 is skipped but both the `security-reviewer` agent AND the built-in produced output, still run the `Security-Reviewer ↔ /security-review built-in` row alone — it's cheap, self-contained, and the Cross-Source column in Phase 5 depends on it. All other challenge rows remain skipped.

**Parallel challenge groups:** These challenge pairs are independent — evaluate them as **parallel analysis tasks** (multiple Grep/Read calls in a single message where evidence lookups are needed):

| Group | Challenge | What to check |
|-------|-----------|---------------|
| A | **Security ↔ Tests** | Does a security finding have test coverage that mitigates it? |
| A | **Security ↔ DevOps** | Overlapping Docker/env findings → deduplicate |
| A | **Security-Reviewer ↔ `/security-review` built-in** | Compare lt-specific agent findings against the built-in's generic output (stored in `builtin_security_findings`). Confidence matrix: both sources flag it → high confidence, keep; only agent flags it → lt-specific pattern, keep at normal priority; only built-in flags it → possible blind spot of the lt-agent, keep at built-in's severity UNLESS already demonstrably mitigated (`@Restricted` / `securityCheck` / Better Auth / Valibot) — only then downgrade or drop. If the built-in returned zero findings, this row is trivially satisfied (no matches to evaluate). Skip entirely if the built-in was unavailable. |
| B | **Backend ↔ Frontend** | Are backend API changes reflected in frontend API client usage? |
| B | **Performance ↔ Tests** | Does a performance concern have load test coverage? |
| B | **Performance ↔ Backend** | Overlapping N+1/query findings → deduplicate, keep deeper analysis |
| B | **Performance ↔ Frontend** | Overlapping rendering/lazy findings → deduplicate, keep deeper analysis |
| C | **Performance ↔ A11y** | Merge Lighthouse performance scores from a11y-reviewer into performance report (only if a11y-reviewer was spawned) |
| C | **Content ↔ Documentation** | Are new features documented? |

Groups A, B, and C are independent and can be evaluated simultaneously. Within each group, challenges share context and should be evaluated together.

For each challenged finding:
- Evidence disproves it → remove from final report
- Evidence partially mitigates it → downgrade severity
- Cross-domain insight adds context → annotate the finding

**Error Handling:** If a reviewer fails or times out:
- Mark the domain as "Could not evaluate — [reason]"
- Continue with available reports
- 3+ reviewers fail → flag "Degraded Review" in header
- Built-in `/security-review` unavailability is NOT a reviewer failure and never counts toward the "Degraded Review" threshold — it simply means the cross-check is skipped.

### Phase 5: Unified Report

Generate a single unified report merging all reviewer results:

```markdown
## Code Review Report

### Change Summary
[2-4 sentences from Phase 1]

### Reviewers Spawned
| Reviewer | Domain | Status |
|----------|--------|--------|
| orchestrator | Check Script (auto-fix) | ✅ / ⚠️ / ❌ / — N/A |
| orchestrator | Content Validation | ✅ / ⚠️ / ❌ |
| security-reviewer | Security (OWASP) | ✅ / ⚠️ / ❌ / — N/A |
| `/security-review` built-in | Security (generic cross-check) | ✓ findings / — none / ✗ unavailable |
| docs-reviewer | Documentation | ✅ / ⚠️ / ❌ / — |
| performance-reviewer | Performance (Bundle, Queries, k6) | ✅ / ⚠️ / ❌ / — |
| backend-reviewer | Backend (NestJS) | ✅ / ⚠️ / ❌ / — |
| frontend-reviewer | Frontend (Nuxt/Vue) | ✅ / ⚠️ / ❌ / — |
| test-reviewer | Tests (Quality/Coverage) | ✅ / ⚠️ / ❌ / — |
| ux-reviewer | UX Patterns | ✅ / ⚠️ / ❌ / — |
| a11y-reviewer | A11y & SEO | ✅ / ⚠️ / ❌ / — |
| devops-reviewer | DevOps (Docker/CI) | ✅ / ⚠️ / ❌ / — |

### Overall Results
| Domain | Fulfillment | Status |
|--------|-------------|--------|
| Content | X% | ✅/⚠️/❌ |
| Security | X% | ✅/⚠️/❌ |
| Documentation | X% | ✅/⚠️/❌ |
| Performance | X% | ✅/⚠️/❌ |
| Backend | X% | ✅/⚠️/❌ |
| Frontend | X% | ✅/⚠️/❌ |
| Tests | X% | ✅/⚠️/❌ |
| UX Patterns | X% | ✅/⚠️/❌ |
| A11y & SEO | X% | ✅/⚠️/❌ |
| DevOps | X% | ✅/⚠️/❌ |

**Overall: X%** (weighted average of active domains)

### Score Weights

Default weights (override via `--weights` or project CLAUDE.md):

| Domain | Default Weight | Condition |
|--------|---------------|-----------|
| Security | 20% | Always |
| Content | 10% | Always |
| Documentation | 5% | Always |
| Performance | 10% | Always |
| Backend | 15% | If backend changes |
| Frontend | 15% | If frontend changes |
| Tests | 10% | If source files changed |
| UX Patterns | 5% | If frontend changes |
| A11y & SEO | 5% | If frontend changes |
| DevOps | 5% | If infra changes |

Only active domains count. Weights redistribute proportionally for N/A domains.

#### Weight Override

**Via argument** (comma-separated `Domain:Weight` pairs):
```
/lt-dev:review --weights="Security:30,Backend:25,Tests:15,DevOps:20"
```

**Via project CLAUDE.md** (persistent per project):
```markdown
## Review Weights
Security: 30%
Backend: 25%
Tests: 15%
DevOps: 20%
```

Override rules:
- Only listed domains are overridden; unlisted domains keep defaults
- Weights are normalized to 100% across active domains after N/A exclusion
- If neither `--weights` nor CLAUDE.md weights exist, use defaults above

### Detailed Findings
[Per domain: findings from each reviewer, or "N/A — no changes"]

For Security findings, add a `Cross-Source` column:
- ✓ = flagged by both security-reviewer AND `/security-review` built-in (high confidence, keep as-is)
- ○ = only security-reviewer (lt-specific finding — keep at normal priority)
- △ = only `/security-review` built-in (generic pattern — could be a **blind spot of the lt-agent**; verify lt-context before deciding. Downgrade ONLY if already demonstrably mitigated by `@Restricted` / `securityCheck` / Better Auth / Valibot. Otherwise keep at the built-in's original severity.)
- — = built-in was unavailable (no cross-check possible; rely solely on security-reviewer)

### Cross-Domain Challenge Results
[Findings removed, downgraded, or annotated after cross-domain analysis]

### Consolidated Remediation Catalog
| # | Domain | Priority | File | Action |
|---|--------|----------|------|--------|
| 1 | Security | Critical | path:line | ... |

Priority ordering: Critical → High → Medium → Low

### Informed Trade-offs (consolidated, non-blocking by default)

Consolidates all "informed trade-off" findings from individual reviewers. These share the meta-pattern defined in `generating-nest-servers` skill → `reference/informed-trade-off-pattern.md`: a standard framework path exists; an opt-out is allowed with (a) a documented reason and (b) an analysis that nothing necessary is silently bypassed. The category is presented separately because it does NOT block the review — but silently bypassing a process or security measure always escalates the individual finding into the regular catalog at the appropriate severity.

Seven trade-off categories are aggregated:

1. **Deprecations (source code)** — deprecated APIs, config keys, packages (from `code-reviewer`, `backend-reviewer`, `frontend-reviewer`, `devops-reviewer`). Default Low; Medium when the deprecation removed a security/process control the caller now lacks.
2. **Deprecations (test APIs)** — deprecated Jest/Vitest/Playwright/supertest/testing-library/lt-framework test helpers (from `test-reviewer`). Default Low; Medium when the deprecation removed assertion-strictness or test-reliability guarantees.
3. **Foreign `@InjectModel`** — injection of a Model that does not belong to the injecting Service (from `backend-reviewer`, `security-reviewer`). Default Low with justification; Medium without justification/Service analysis; escalates to High/Critical in the main catalog if a Service security measure is silently bypassed.
4. **Plain-object response paths** — `.lean()` / `toObject()` / spreads / raw `aggregate()` / native-driver results returned to users (from `backend-reviewer`, `security-reviewer`). Default Low when Model has only default `securityCheck`; Medium when Model has overridden `securityCheck` and no justification/hydration/manual replication; High in the main catalog when Model-specific authorization is silently bypassed.
5. **Direct own-Model access** — `this.mainDbModel.xxx` / `this.<modelName>Model.xxx` calls inside the owning Service instead of CrudService methods (from `backend-reviewer` Layer 5b, `security-reviewer` Layer 7, `code-reviewer` Phase 4). Default Low when `securityCheck()` still runs via the interceptor and no role-restricted fields are affected; Medium for missing side-effects or undocumented access on Models with role-restricted fields; High in the main catalog when field-level `@Restricted` is silently bypassed on a user-facing response. Preferred alternatives: `this.processResult(result, serviceOptions)` wrapper (runs `prepareOutput`), or follow-up `super.update(id, {}, serviceOptions)` to rerun the full pipeline.
6. **CrudService `*Force`/`*Raw` variants** — `getForce`/`createForce`/`findRaw`/etc. disable `checkRights`, RoleGuard, and `removeSecrets` (Force) or additionally `prepareInput`/`prepareOutput` entirely (Raw). From `backend-reviewer` (Services-section audit), `security-reviewer` Layer 8, `code-reviewer` Phase 3. Default Medium without justification; **Critical in the main catalog when a `*Force`/`*Raw` result (possibly containing password hashes or tokens) reaches a user-facing response without explicit field stripping**; High when upstream authorization check is missing. Allowed in documented system-internal flows (credential verification, migrations, admin tooling).
7. **Frontend trade-offs** — Options API in new code, mutable composable state, `import.meta.client` escape hatches, `v-html`, raw `fetch()` (from `frontend-reviewer`, `code-reviewer`). Default Low; Medium for SSR-safety gaps; High in the main catalog for unjustified `v-html` (XSS class).

| # | Category | Origin Reviewer | File:Line | Opt-out Used | Documented Reason | Analysis Performed | Default-Path Logic Bypassed | Severity | Action |
|---|----------|-----------------|-----------|--------------|-------------------|--------------------|----------------------------|----------|--------|
| 1 | Deprecation | backend-reviewer | path:line | `OldAPI` (`@deprecated since vX`) | — | `@deprecated` msg read | ⚠ Migration required | Low | Migrate to `NewAPI` (see changelog) |
| 2 | Foreign @InjectModel | security-reviewer | path:line | `@InjectModel(User.name)` in `OrderService` | — | not performed | ⚠ UserService.securityCheck skipped | Medium | Inject `UserService` OR document + replicate auth |
| 3 | Plain Object | backend-reviewer | path:line | `.lean()` | "large list perf" | ✓ UserModel securityCheck reviewed | ⚠ ownership field-clearing skipped | Medium | Hydrate via `UserModel.map(raw)` OR replicate filter |

**Behavior rules:**
- If no reviewer reported trade-off findings: "No informed trade-offs detected across changed files."
- Findings in this section do NOT count toward domain Fulfillment percentages.
- Findings where the analysis reveals an actual silent bypass of a security measure are ALSO added to the regular Consolidated Remediation Catalog with appropriate severity (Critical/High) — they must not be hidden in the trade-off section alone.
- Use the "Analysis Performed" column as a reviewer accountability check: missing analysis ≠ safe; it means the trade-off was accepted without verification and is itself a review gap.

### Recommended Next Steps

**Backend findings:**
- Security ⚠️/❌ → `/lt-dev:backend:sec-review`
- Tests ⚠️/❌ → `/lt-dev:backend:test-generate`
- Code Quality ⚠️/❌ → `/lt-dev:backend:code-cleanup`
- Dependencies → `/lt-dev:backend:sec-audit`

**Performance findings:**
- k6 ⚠️/❌ → Run `k6 run` with higher load to confirm regression
- Database queries → Review with `explain()` in MongoDB shell
- Lighthouse Performance ⚠️/❌ (from a11y-reviewer) → Run `lighthouse` manually on affected pages

**Frontend findings:**
- Code Quality ⚠️/❌ → `/lt-dev:refactor-frontend --dry-run`

**Claude Code Built-in Cross-Reviews (optional, outside this command):**
- After PR is created → `/review <PR#>` for a generic PR-context review (uses `gh` CLI)
- CI fails on the PR → `/autofix-pr` spawns a cloud session that pushes fixes automatically
- Quick pre-review code cleanup on recently changed files → `/simplify` (auto-applies fixes — run BEFORE `/lt-dev:review`, never inside it)

**All ✅** → Create PR, then run `/review <PR#>` for a generic PR-context cross-check
```

