---
description: Refactor entire frontend app to match frontend-dev agent guidelines using parallel agent teams
argument-hint: "[--scope=all|pages|components|composables] [--dry-run]"
allowed-tools: Read, Grep, Glob, Bash(ls:*), Bash(wc:*), Bash(find:*), Bash(git:*), Bash(echo:*), Agent, AskUserQuestion, TodoWrite
disable-model-invocation: true
---

# Frontend Refactor

Refactors all pages, components, and composables in the frontend app to comply with the `frontend-dev` agent and `developing-lt-frontend` skill guidelines.

**Goal:** Code quality, structure, and conventions — NOT functionality or UI changes. Everything must work exactly as before, just cleaner.

## When to Use This Command

- After initial project setup to enforce conventions
- When codebase has accumulated technical debt
- Before a major release to clean up code quality
- After `/lt-dev:review` shows frontend violations

## Related Elements

| Element | Purpose |
|---------|---------|
| `/lt-dev:review` | Code review — run after refactoring to validate quality |
| `frontend-dev` agent | Development agent whose rules are the refactoring baseline |
| `developing-lt-frontend` skill | Frontend conventions reference |

## What Gets Refactored

| Category | What Changes |
|----------|-------------|
| Large components | Split into smaller focused components |
| Inline logic | Extract into composables |
| Fat pages | Decompose into thin orchestrators + child components |
| Type violations | Add explicit types everywhere (refs, computed, params, returns) |
| console.log | Replace with `consola.withTag()` |
| Missing states | Add Loading/Empty/Error state handling |
| Flat folder structure | Reorganize into feature-based folders |
| Style violations | Semantic colors, no `<style>` blocks, Nuxt UI first |
| Accessibility gaps | Add aria-labels, semantic HTML, keyboard support |
| SSR violations | Fix raw fetch, shared refs, window/document access |
| Naming violations | Fix component/composable/interface naming conventions |
| Mutable composable returns | Wrap with `readonly()` |
| Inline modals | Convert to programmatic `useOverlay()` |
| Performance | Lazy components, `shallowRef`, `v-memo`, `v-once`, debounced inputs |

## What MUST NOT Change

- **Functionality** — every feature works identically after refactor
- **UI/UX** — visual output stays the same
- **API contracts** — same endpoints, same request/response shapes
- **Routes** — same URLs, same navigation behavior
- **Test behavior** — existing tests still pass

---

## Execution

### 1. Parse Arguments

From `$ARGUMENTS`:
- **`--scope`** (default: `all`): `all` | `pages` | `components` | `composables`
- **`--dry-run`** (optional): Only analyze and report, don't modify files

### 2. Detect Project

```bash
ls -d projects/app packages/app 2>/dev/null
```

If no frontend project found → STOP, inform user.

### 3. Inventory Analysis

Collect ALL files to refactor:

```bash
# Pages
find <app-root>/app/pages -name "*.vue" 2>/dev/null | sort

# Components
find <app-root>/app/components -name "*.vue" 2>/dev/null | sort

# Composables
find <app-root>/app/composables -name "*.ts" 2>/dev/null | sort
```

For each file, measure:
- **Line count** (script + template separately)
- **Violations** (quick grep for patterns: `console.log`, `ref(`, `<style`, `text-red-`, `v-html`, `alert(`, etc.)

### 4. Build Refactor Plan

Group files into **refactor batches** by feature domain:

```
Batch: seasons
├── pages/seasons/index.vue (148 lines → needs split)
├── pages/seasons/[id].vue (92 lines → needs split)
├── components/SeasonCard.vue (OK)
├── components/SeasonList.vue (210 lines → needs split)
└── composables/useSeasons.ts (missing readonly returns)

Batch: teams
├── pages/teams/index.vue (...)
└── ...
```

**Prioritize batches by:**
1. Most violations
2. Largest files
3. Most dependencies (refactor leaf components first)

### 5. Present Plan to User

Show a summary table:

```
| Batch | Files | Issues | Estimated Changes |
|-------|-------|--------|-------------------|
| seasons | 5 | 12 | Split 2 components, extract 3 composables |
| teams | 3 | 8 | Split 1 page, add types to 2 composables |
| shared | 2 | 3 | Add Loading/Empty/Error components |
| ... | ... | ... | ... |
| TOTAL | 28 | 47 | ... |
```

**If `--dry-run`:** Present report and STOP here. Do not modify any files.

**Ask user:** "Soll ich alle Batches refactoren oder nur bestimmte? (alle / batch-namen kommagetrennt)"

### 6. Execute Refactoring via Agent Team

Create an **Agent Team** with all batches as parallel teammates. Max 5 teammates total.

**Constraints:**
- Each teammate gets exclusive file ownership (no overlapping files)
- The "shared-foundation" teammate creates shared components first and signals completion via message
- Feature-batch teammates wait for the shared-foundation message before using shared components

**Create ALL teammates in a single Agent Team:**

**Teammate "shared-foundation"** (subagent_type: `lt-dev:frontend-dev`):
```
Create or refactor shared components in components/shared/:
- LoadingState.vue, EmptyState.vue, ErrorState.vue

Follow ALL frontend-dev agent guidelines.
When done, share a message listing all created/modified shared components so other teammates can use them.
```

**Teammate "refactor-\<batch-name\>"** (subagent_type: `lt-dev:frontend-dev`, one per feature batch, max 4):
```
Refactor files in the <batch-name> feature domain.
Wait for the "shared-foundation" teammate's message before referencing shared components.
If shared components are not yet available, create local placeholders and note them for later integration.

## CRITICAL RULES
- Do NOT change any functionality — everything must work identically
- Do NOT change any UI — visual output stays the same
- Do NOT change any API contracts or routes
- ONLY refactor code structure, types, patterns, and conventions

## Refactor Checklist

### Structure
- [ ] Split components >50 template lines into smaller components
- [ ] Extract script logic >80 lines into composables
- [ ] Make pages thin orchestrators (compose components + composables)
- [ ] Organize into feature-based folder: components/<feature>/

### Types
- [ ] Explicit types on ALL refs: ref<Type>()
- [ ] Explicit types on ALL computed: computed<Type>()
- [ ] Explicit return types on ALL functions
- [ ] Props via interface + withDefaults
- [ ] Emits via typed tuple syntax
- [ ] Import DTOs from ~/api-client/types.gen.ts (never manual interfaces)

### Composables
- [ ] Return readonly() state — never mutable refs
- [ ] One composable per API controller
- [ ] No UI logic in composables
- [ ] Extract: data fetching, filtering, sorting, pagination, form logic

### Patterns
- [ ] Replace console.log/warn/error with consola.withTag()
- [ ] Add Loading/Empty/Error state handling where missing
- [ ] Convert inline modals to programmatic useOverlay()
- [ ] Use useToast() with German messages and color codes
- [ ] Typed route params (no implicit any from useRoute())

### Performance
- [ ] LazyModal* for all modal components
- [ ] shallowRef for large arrays/objects
- [ ] v-memo on expensive list items
- [ ] Debounce search/filter inputs (300ms)
- [ ] NuxtImg with loading="lazy" for off-screen images
- [ ] No v-if + v-for on same element

### Styling
- [ ] Semantic colors only (no hardcoded text-red-500 etc.)
- [ ] No <style> blocks — TailwindCSS only
- [ ] Nuxt UI components first

### Accessibility
- [ ] Semantic HTML (<button> not <div @click>)
- [ ] aria-label on icon-only buttons
- [ ] alt on images
- [ ] UFormField with label on all form inputs

### SSR Safety
- [ ] No window/document in <script setup> — use onMounted()
- [ ] useFetch()/useAsyncData() — no raw fetch()
- [ ] useState() for shared state — no ref() for cross-component state
- [ ] useRuntimeConfig() — no process.env

### Section Order in <script setup>
1. Imports
2. Composables
3. Variables
4. Computed Properties
5. Lifecycle Hooks
6. Functions

## After Refactoring
1. Run: pnpm run lint:fix
2. Run: pnpm run build
3. Fix any errors before reporting done
4. List ALL files created, modified, or moved

Files: <list of files for this batch>
Work exclusively in these files. Do NOT modify files outside your batch.
```

---

### Verification (MANDATORY — Blocks Completion)

**The refactoring is NOT complete until ALL checks pass.**

Run all checks sequentially in the app root:

```bash
# 1. Format (if script exists)
pnpm run format 2>/dev/null || true

# 2. Lint
pnpm run lint:fix

# 3. Build
pnpm run build

# 4. Tests (if script exists)
pnpm test 2>/dev/null || pnpm run test 2>/dev/null
```

**Gate Rules:**

| Check | Required | On Failure |
|-------|----------|------------|
| Format | Yes (if script exists) | Fix formatting issues, re-run |
| Lint | Yes — ZERO errors | Fix all lint errors, re-run (warnings acceptable) |
| Build | Yes — must succeed | Fix TS/template errors, re-run |
| Tests | Yes — ALL must pass | Fix broken tests without changing assertions, re-run |

**Failure Protocol:**
1. Read the error output carefully
2. Fix the root cause in the refactored code (NOT by changing test expectations)
3. Re-run the failed check
4. Max 3 fix attempts per check — if still failing, STOP and report errors to user

**CRITICAL:** If tests fail, the refactoring introduced a regression. Fix must restore original behavior, NOT adjust tests.

---

### Code Review (MANDATORY — After Verification)

After verification passes, run `/lt-dev:review` to validate the refactored code.

```
Run: /lt-dev:review --base=<current-branch-base or main>
```

| Severity | Action |
|----------|--------|
| Critical / High findings | MUST be fixed — re-run verification after fixes |
| Medium findings | Fix if possible, otherwise document as "Known Issues" |
| Low / Info findings | Document in Final Report |

Max 2 review-fix cycles. If Critical/High persist, STOP and report to user.

---

### Final Report

**OUTPUT REQUIREMENTS (read before generating):**

1. **Every section below is MANDATORY** — Executive Summary, Batch Summary, Verification, Code Review, File Lists, Detailed Reports, Next Steps.
2. **Section "Detailed Teammate Reports" MUST contain the verbatim full output of every batch teammate** (`shared-foundation` + each `refactor-<batch>`). Do NOT summarize — wrap each in a `<details>` block.
3. **Section "Code Review Output" MUST embed the FULL `/lt-dev:review` output** (Executive Summary + Action Roadmap + Catalog + per-reviewer reports), not just the dimension table. Wrap in `<details>` if very long.
4. **Action Roadmap** — derive from review findings + verification failures, prioritized: 🔴 Critical → 🟠 High → 🟡 Medium → 🟢 Low.
5. **No-Loss Guarantee:** Every finding in the embedded `/lt-dev:review` output MUST appear in the Action Roadmap below. Cross-check counts before finalizing.
6. **No Placeholders:** Replace every `N`, `X min`, and `[...]` in the template with concrete values. Empty buckets say "None".

```
## Refactoring Abgeschlossen

### Executive Summary
- **Status:** ✅ Erfolgreich / ⚠️ Mit offenen Findings / ❌ Blockiert
- **Batches:** N/M erfolgreich
- **Verification:** Format ✅ | Lint ✅ | Build ✅ | Tests ✅
- **Top 3 nächste Schritte:**
  1. ...
  2. ...
  3. ...
- **My Recommendation:** **Standard** (Critical + High aus Code Review) — [Begründung in einem Satz]
- **Findings at a Glance:** 🔴 N | 🟠 N | 🟡 N | 🟢 N | **Total: N** — ⏱️ ≈ X min für Komplett

### Decision Helper
- 🚀 **Minimal (Merge-Ready)** — nur Critical, N Findings, ≈ X min
- 🎯 **Standard (Empfohlen)** — Critical + High, N Findings, ≈ X min
- 💎 **Komplett** — alle Severities, N Findings, ≈ X min
- ⏭️ **Nichts (Defer)** — Tracking-Tickets statt Fixes, ≈ X min

After printing the report, **ask via `AskUserQuestion`** which option to execute (skip if zero findings). Then iterate the chosen findings, propose diffs, apply after confirmation. End with a "Result"-Block: chosen option, findings addressed, files modified, remaining count, suggested next step.

### Action Roadmap
#### 🔴 Must Fix (Critical) — Vor Merge
1. ...
#### 🟠 Must Fix (High) — Vor Merge
1. ...
#### 🟡 Should Fix (Medium) — In diesem Sprint
1. ...
#### 🟢 Nice to Have (Low / Info)
1. ...

### Batch Summary

| Batch | Dateien | Neu | Verschoben | Geändert | Status |
|-------|---------|-----|------------|----------|--------|
| shared | 3 | 3 | 0 | 0 | ✅ |
| seasons | 5 | 2 | 3 | 4 | ✅ |
| teams | 3 | 1 | 1 | 2 | ✅ |
| TOTAL | 11 | 6 | 4 | 6 | ✅ |

### Verification
| Check  | Status |
|--------|--------|
| Format | ✅ Bestanden |
| Lint   | ✅ Keine Fehler |
| Build  | ✅ Erfolgreich |
| Tests  | ✅ 42/42 bestanden |

### Code Review
| Dimension | Grade |
|-----------|-------|
| TypeScript | ✅ |
| Components | ✅ |
| Composables | ✅ |
| Accessibility | ✅ |
| SSR Safety | ✅ |
| Performance | ⚠️ |
| Styling | ✅ |

### Neue Dateien
- components/shared/LoadingState.vue
- ...

### Verschobene Dateien
- components/SeasonCard.vue → components/seasons/SeasonCard.vue
- ...

### Extrahierte Composables
- composables/useSeasonsFilter.ts (aus pages/seasons/index.vue)
- ...

### Detailed Teammate Reports

<details>
<summary>🧱 shared-foundation — full report</summary>

[Paste the COMPLETE return message of the `shared-foundation` teammate here, verbatim.]

</details>

<details>
<summary>🔧 refactor-&lt;batch-name&gt; — full report</summary>

[Paste the COMPLETE return message of each batch teammate here, verbatim. One `<details>` block per batch.]

</details>

### Code Review Output

<details>
<summary>📋 /lt-dev:review — full unified report</summary>

[Paste the COMPLETE output of `/lt-dev:review` from the "Code Review (MANDATORY)" step here, verbatim — including Executive Summary, Action Roadmap, Consolidated Remediation Catalog, all per-reviewer reports, and Recommended Commands.]

</details>
```

### Post-Refactor

Suggest:
- "Prüfe die Änderungen mit `git diff` und teste die App im Browser"
- "Führe `/lt-dev:check app` aus für eine unabhängige Validierung"
