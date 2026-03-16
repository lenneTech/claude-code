---
description: Comprehensive code review with content validation, security, documentation, tests, backend, frontend, UX, a11y, and devops reviewers. Small diffs use single-pass agent; larger diffs spawn parallel domain specialists with cross-domain challenge.
argument-hint: [issue-id] [--base=main] [--weights="Security:25,..."]
allowed-tools: Read, Grep, Glob, Bash(git:*), Bash(echo:*), Bash(grep:*), Bash(wc:*), Agent, AskUserQuestion, mcp__plugin_lt-dev_linear__get_issue, mcp__plugin_lt-dev_linear__list_comments
disable-model-invocation: true
---

# Code Review

## When to Use This Command

- Before merging changes to validate overall quality
- After completing a feature or fix implementation
- As a final quality gate after `resolve-ticket`
- When you want a structured assessment across all quality dimensions

## Related Commands

| Command | Purpose |
|---------|---------|
| `/review` | Claude Code built-in: quick PR-level review (requires `gh` CLI) |
| `/security-review` | Claude Code built-in: general security review of branch diff |
| `/lt-dev:backend:sec-review` | Focused security review (@lenne.tech/nest-server specific) |
| `/lt-dev:backend:code-cleanup` | Code style and formatting cleanup |
| `/lt-dev:backend:test-generate` | Generate tests for changes |
| `/lt-dev:backend:sec-audit` | OWASP security audit for dependencies |
| `/lt-dev:resolve-ticket` | Resolve a ticket (run review after) |
| `/lt-dev:debug` | Adversarial debugging with competing hypotheses |

**Recommended workflow:** `resolve-ticket` → `/lt-dev:review` → address findings → `code-cleanup` → create PR → `/review`

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
│  ├── security-reviewer    (always — OWASP, Permissions, Injection, XSS, Auth, Secrets, Dependencies)
│  ├── docs-reviewer        (always — README, JSDoc, Migration Guides, Config Documentation)
│  ├── test-reviewer        (if source files changed — Coverage, Quality, Isolation, API-First, Flaky Detection)
│  ├── backend-reviewer     (if backend changes — Security Decorators, Models, Controllers, Services, Performance, Tests)
│  └── devops-reviewer      (if infra changes — Docker, CI/CD, Environment, .dockerignore)
│
│  Phase 3B: Browser reviewers — sequential (Chrome DevTools MCP has global page state):
│  ├── frontend-reviewer    (if frontend changes — Types, Components, Code Quality, SSR, Performance, Styling)
│  ├── ux-reviewer          (if frontend changes — State Handling, Feedback, Navigation, Form UX, Responsive)
│  └── a11y-reviewer        (if frontend changes — ARIA, Semantic HTML, Keyboard, Contrast, SEO, Lighthouse)
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
   | Always | `security-reviewer`, `docs-reviewer` |
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

### Small-Diff Optimization

If the diff is small (**< 20 changed lines AND <= 2 changed files**), skip Phases 2-5 and spawn the single-pass `code-reviewer` agent instead:

```
Agent tool with subagent_type "lt-dev:code-reviewer":

Perform a single-pass code review on the current branch.

Base branch: <base-branch>
Issue ID: <issue-id or "none">
Changed files:
<full list of changed files>

Cover all quality dimensions: content, security, code quality, tests, documentation, formatting.
Produce your structured single-pass report.
```

After the single-pass agent completes, skip directly to Phase 6 (Diff Hash Snapshot) and present its report as the final output.

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

**CRITICAL:** Send ALL Agent tool calls in a **single message** so they execute in parallel. Do NOT send them one by one — that makes them sequential.

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
type strictness & input validation, code quality, performance (N+1 queries, memory leaks,
async patterns, pagination), test coverage, and formatting.
Produce your structured backend review report with fulfillment grades.
```

#### Test Reviewer (if source files changed)
```
Agent tool with subagent_type "lt-dev:test-reviewer":

Review the test quality and coverage on the current branch.

Base branch: <base-branch>
Changed files:
<full list of changed files>

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

**Skip condition:** If only 1-2 reviewers were spawned (e.g., small diff that only triggered security-reviewer and docs-reviewer), skip this phase — cross-domain analysis adds minimal value with few data points. Proceed directly to Phase 5.

**Parallel challenge groups:** These challenge pairs are independent — evaluate them as **parallel analysis tasks** (multiple Grep/Read calls in a single message where evidence lookups are needed):

| Group | Challenge | What to check |
|-------|-----------|---------------|
| A | **Security ↔ Tests** | Does a security finding have test coverage that mitigates it? |
| A | **Security ↔ DevOps** | Overlapping Docker/env findings → deduplicate |
| B | **Backend ↔ Frontend** | Are backend API changes reflected in frontend API client usage? |
| B | **Performance ↔ Tests** | Does a performance concern have load test coverage? |
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

### Phase 5: Unified Report

Generate a single unified report merging all reviewer results:

```markdown
## Code Review Report

### Change Summary
[2-4 sentences from Phase 1]

### Reviewers Spawned
| Reviewer | Domain | Status |
|----------|--------|--------|
| orchestrator | Content Validation | ✅ / ⚠️ / ❌ |
| security-reviewer | Security (OWASP) | ✅ / ⚠️ / ❌ / — N/A |
| docs-reviewer | Documentation | ✅ / ⚠️ / ❌ / — |
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
| Security | 25% | Always |
| Content | 10% | Always |
| Documentation | 5% | Always |
| Backend | 15% | If backend changes |
| Frontend | 15% | If frontend changes |
| Tests | 10% | If source files changed |
| UX Patterns | 5% | If frontend changes |
| A11y & SEO | 5% | If frontend changes |
| DevOps | 10% | If infra changes |

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

### Cross-Domain Challenge Results
[Findings removed, downgraded, or annotated after cross-domain analysis]

### Consolidated Remediation Catalog
| # | Domain | Priority | File | Action |
|---|--------|----------|------|--------|
| 1 | Security | Critical | path:line | ... |

Priority ordering: Critical → High → Medium → Low

### Recommended Next Steps
- Frontend ⚠️/❌ → `/refactor-frontend --dry-run`
- Security ⚠️/❌ → `/lt-dev:backend:sec-review`
- Tests ⚠️/❌ → `/lt-dev:backend:test-generate`
- Formatting ⚠️/❌ → `/lt-dev:backend:code-cleanup`
- Dependencies → `/lt-dev:backend:sec-audit`
- All ✅ → Create PR and run `/review`
```

### Phase 6: Diff Hash Snapshot

After presenting the report, snapshot the diff state so the quality-gate Stop hook knows what was already reviewed:

```bash
DIR_HASH=$(echo "$PWD" | md5 2>/dev/null || echo "$PWD" | md5sum 2>/dev/null | cut -d' ' -f1)
DIFF_HASH=$(git diff HEAD 2>/dev/null | md5 2>/dev/null || git diff HEAD 2>/dev/null | md5sum 2>/dev/null | cut -d' ' -f1)
echo "$DIFF_HASH" > "/tmp/.claude-qg-reviewed-${DIR_HASH}"
```
