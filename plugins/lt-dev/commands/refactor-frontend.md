---
description: Refactor entire frontend app to match frontend-dev agent guidelines using parallel agent teams
argument-hint: "[--scope=all|pages|components|composables] [--dry-run]"
allowed-tools: Read, Grep, Glob, Bash(ls:*), Bash(wc:*), Bash(find:*), Bash(git:*), Bash(echo:*), Bash(pnpm run format:*), Bash(npm run format:*), Bash(yarn run format:*), Bash(pnpm run lint:*), Bash(npm run lint:*), Bash(yarn run lint:*), Bash(pnpm run build:*), Bash(npm run build:*), Bash(yarn run build:*), Bash(pnpm run test:*), Bash(npm run test:*), Bash(yarn run test:*), Bash(pnpm test:*), Bash(npm test:*), Bash(yarn test:*), Agent, AskUserQuestion, Skill, SendMessage
disable-model-invocation: true
---

# Frontend Refactor

Refactors all pages, components, and composables in the frontend app to comply with the `frontend-dev` agent and `developing-lt-frontend` skill guidelines.

**Goal:** Code quality, structure, and conventions, not functionality or UI changes. Everything must work exactly as before, just cleaner.

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

## What Stays Unchanged

- **Functionality** — every feature works identically after refactor
- **UI/UX** — visual output stays the same
- **API contracts** — same endpoints, same request/response shapes
- **Routes** — same URLs, same navigation behavior
- **Test behavior** — existing tests still pass

---

## Execution

### Turn endings

After the batch selection in step 5, this command runs to completion without check-ins. A message without a tool call ends the turn and stops the run, so status notes and recommendations go in the same message as the next tool call, and work that does not depend on the user carries on. The run stops only at the handoff points this command defines (the `--dry-run` report, the batch selection in step 5, a check still failing after three fix attempts, Critical/High findings persisting after two review cycles, the closing option question after the Final Report), when a step is blocked by something only the user can resolve, or before a destructive or irreversible action that needs confirmation.

### 1. Parse Arguments

From `$ARGUMENTS`:
- **`--scope`** (default: `all`): `all` | `pages` | `components` | `composables`
- **`--dry-run`** (optional): Only analyze and report, don't modify files

### 2. Detect Project

```bash
ls -d projects/app packages/app 2>/dev/null
```

If no frontend project found → stop and inform the user.

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

**If `--dry-run`:** Present the report and stop here. Do not modify any files.

**Ask user:** "Soll ich alle Batches refactoren oder nur bestimmte? (alle / batch-namen kommagetrennt)"

### 6. Execute Refactoring via Agent Team

Create an **Agent Team** with all batches as parallel teammates. Max 5 teammates total.

**Constraints:**
- Each teammate gets exclusive file ownership (no overlapping files)
- The "shared-foundation" teammate creates shared components first and signals completion via message
- Feature-batch teammates wait for the shared-foundation message before using shared components

**Create ALL teammates in a single Agent Team:**

**The frontend-dev role travels in the spawn prompt.** Teammates apply agent types only from the project, user or managed scope, so a plugin type such as `lt-dev:frontend-dev` would be ignored for a teammate, together with its `skills:` preload. Every teammate prompt therefore opens with this role block:

```
## Role
You are the frontend engineer for this refactor (Nuxt 4 / Vue 3, strict TypeScript).
Start by invoking the `lt-dev:developing-lt-frontend` skill through the `Skill` tool;
it is the reference for every convention below. The complete frontend-dev rule set is
in ${CLAUDE_PLUGIN_ROOT}/agents/frontend-dev.md; read it for any case not covered here.

Rules this refactor depends on:
- Existing patterns first: read app/components/ and app/composables/ and match the
  established pattern; introduce a new one only where none covers the case.
- Backend DTOs and API calls come from ~/api-client/types.gen.ts and sdk.gen.ts;
  a manual DTO interface is never a workaround.
- Zero implicit any: explicit types on every variable, ref<T>(), computed<T>(),
  parameter and return; props via interface + withDefaults; emits via typed tuple
  syntax; an options object for optional parameters.
- Forms validate with Valibot only.
- UI text stays in the project's existing UI language (translating it would change
  the UI); code, names and comments are English.
- Naming: components PascalCase, pages kebab-case, modals with `Modal` prefix,
  composables with `use` prefix, frontend-only types in `*.interface.ts`.
- A failing test is fixed at its root cause, pre-existing failures included; the
  assertions stay as they are, because they pin the behaviour this refactor keeps.
```

**Teammate "shared-foundation"**:
```
<role block>

Create or refactor shared components in components/shared/:
- LoadingState.vue, EmptyState.vue, ErrorState.vue

Follow the role rules above.
When done, share a message listing all created/modified shared components so other teammates can use them.
```

**Teammate "refactor-\<batch-name\>"** (one per feature batch, max 4):
```
<role block>

Refactor files in the <batch-name> feature domain.
Wait for the "shared-foundation" teammate's message before referencing shared components.
If shared components are not yet available, create local placeholders and note them for later integration.

## Rules
Refactor code structure, types, patterns and conventions only. Functionality, the visual UI, API contracts and routes
stay identical, because this refactor is verified by comparing behaviour before and after.

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
- [ ] Use useToast() with messages in the project's UI language and color codes
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

### Verification (Blocks Completion)

The refactoring is complete only when all checks pass.

A teammate's final message is its report, not proof that the batch is done. Compare it against the batch's file list and checklist; when items are still open and no blocker is named, resume the same teammate via `SendMessage`, naming the open items. After two or three continuations on the same batch, stop and report the gap instead.

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
2. Fix the root cause in the refactored code (not by changing test expectations)
3. Re-run the failed check
4. Max 3 fix attempts per check — if still failing, stop and report the errors to the user

If tests fail, the refactoring introduced a regression: the fix restores the original behavior instead of adjusting the tests.

---

### Code Review (MANDATORY — After Verification)

After verification passes, invoke the `lt-dev:review` skill via the `Skill` tool to validate the refactored code:

```
Skill: lt-dev:review   arguments: --base=<current-branch-base or main>
```

`lt-dev:review` reports only proven Critical and High defects and fixes them itself; everything below that bar is dropped, not reported.

| Severity | Action |
|----------|--------|
| Critical / High findings | Fixed before the refactor counts as done — re-run verification after fixes |

Max 2 review-fix cycles. If Critical/High persist, stop and report to the user.

---

### Final Report

**Output requirements:**

1. **Every section below is required** — Executive Summary, Batch Summary, Verification, Code Review, File Lists, Detailed Reports, Next Steps.
2. **Section "Detailed Teammate Reports" contains the verbatim full output of every batch teammate** (`shared-foundation` + each `refactor-<batch>`), unsummarized, each wrapped in a `<details>` block.
3. **Section "Code Review Output" embeds the full `/lt-dev:review` output** (Executive Summary + Action Roadmap + Catalog + per-reviewer reports), not just the dimension table. Wrap in `<details>` if very long.
4. **Action Roadmap** — derive from review findings + verification failures, prioritized: 🔴 Critical → 🟠 High → 🟡 Medium → 🟢 Low.
5. **No-Loss Guarantee:** Every finding in the embedded `/lt-dev:review` output appears in the Action Roadmap below. Cross-check counts before finalizing.
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
