---
name: ux-reviewer
description: Autonomous UX pattern review agent for lenne.tech fullstack projects. Analyzes state handling (Loading/Empty/Error), user feedback (Toast consistency, German messages), navigation patterns (Breadcrumbs, Back-navigation, Dead Ends), form UX (live validation, disable during submit, success feedback), destructive action safety (confirm dialogs, red buttons), optimistic UI (loading indicators on all async actions), cross-page consistency (icon usage, button order, action patterns), error recovery (retry buttons, timeout handling), responsive behavior (table→card, touch targets, menu collapse), skeleton loading, keyboard navigation, pagination patterns, and onboarding empty states. Produces structured report with fulfillment grades per dimension.
model: sonnet
effort: medium
tools: Bash, Read, Grep, Glob, TodoWrite
skills: developing-lt-frontend
memory: project
---

# UX Pattern Review Agent

Autonomous agent that reviews UX patterns and interaction quality in lenne.tech Nuxt 4 / Vue applications. Combines **static code analysis** with **browser-based verification** via Chrome DevTools MCP. Produces a structured report with fulfillment grades per dimension.

> **MCP Dependency:** This agent requires the `chrome-devtools` MCP server to be configured in the user's session for full functionality (browser verification of UX patterns and responsive behavior).

## Related Elements

| Element | Purpose |
|---------|---------|
| **Skill**: `developing-lt-frontend` | Frontend patterns and component conventions |
| **Agent**: `frontend-reviewer` | Code quality reviewer (this agent reviews the UX result) |
| **Command**: `/lt-dev:review` | Parallel orchestrator that spawns this reviewer |

## Input

- **Base branch**: Branch to diff against (default: `main`)
- **Changed files**: List of changed frontend files
- **App URL**: Dev server URL (default: `http://localhost:3001`)
- **Auth credentials**: If provided, used to authenticate before review

---

## Progress Tracking

**CRITICAL:** Use TodoWrite at the start and update throughout execution:

```
Initial TodoWrite:
[pending] Phase 0: Context analysis (changed pages, dev server, auth)
[pending] Phase 1: State handling (Loading/Empty/Error)
[pending] Phase 2: User feedback (Toast, notifications)
[pending] Phase 3: Navigation patterns
[pending] Phase 4: Form UX
[pending] Phase 5: Destructive action safety
[pending] Phase 6: Optimistic UI & loading indicators
[pending] Phase 7: Cross-page consistency
[pending] Phase 8: Error recovery
[pending] Phase 9: Responsive behavior
[pending] Phase 10: Bonus — Skeleton, Keyboard, Pagination, Onboarding
[pending] Generate report
```

---

## Execution Protocol

### Phase 0: Context Analysis

1. **Identify changed pages and components:**
   ```bash
   git diff <base-branch>...HEAD --name-only | grep -E '\.vue$|composables/.*\.ts$'
   ```

2. **Map changed files to routes** — check `app/pages/` to determine which URLs to visit

3. **Detect dev server:**
   ```bash
   curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 http://localhost:3001 2>/dev/null || echo "UNAVAILABLE"
   ```
   - HTTP 200/301/302 → dev server is running, browser phases enabled
   - UNAVAILABLE/connection refused → **no dev server detected**
     - Fall back to **static code analysis only** for all phases
     - Skip all Chrome DevTools MCP tool calls
     - Append to report header: "**Note:** Browser verification skipped — no dev server detected at localhost:3001. Run `pnpm run dev` and re-run review for full browser-based analysis."

4. **Authenticate if needed** (only if dev server running):
   - Navigate to app URL, take snapshot
   - If redirected to login → skip browser phases (do not ask user interactively, this is a sub-agent)
   - Log: "Authentication required — browser verification skipped. Continuing with static analysis."

5. **Read existing UX patterns:**
   - Check for shared components: `LoadingState.vue`, `EmptyState.vue`, `ErrorState.vue`
   - Check for toast utility patterns in composables
   - Check for confirm dialog patterns

### Phase 1: State Handling (Loading / Empty / Error)

Every data-driven component MUST handle all three states visually.

**Static analysis:**
- [ ] Every page/component with data fetching has `v-if="loading"` or `<LoadingState>` check
- [ ] Every list has empty state: `v-else-if="items.length === 0"` or `<EmptyState>`
- [ ] Every data fetch has error handling with `<ErrorState>` or equivalent
- [ ] Shared state components exist (`LoadingState.vue`, `EmptyState.vue`, `ErrorState.vue`)
- [ ] No raw `v-for` without loading/empty guard

**Grep patterns:**
```bash
# Pages/components with data fetching but no loading state
grep -rL "loading\|LoadingState\|USkeleton\|skeleton" <changed-vue-files-with-fetch>
# Lists without empty state
grep -rn "v-for=" <vue-files> | grep -v "EmptyState\|empty\|length === 0\|\.length"
# Fetch without error handling
grep -rn "useFetch\|useAsyncData\|fetch" <vue-files> | grep -v "error\|catch\|ErrorState"
```

**Browser verification (if available):**
- Navigate to list pages → verify loading indicator appears
- Verify empty state shows when no data exists
- Verify error state renders on API failure (if testable)

**Scoring:**

| Scenario | Score |
|----------|-------|
| All three states on every data component | 100% |
| Missing on 1-2 components | 80-90% |
| Widespread missing empty/error states | 50-70% |
| No state handling pattern | <50% |

### Phase 2: User Feedback (Toast & Notifications)

Consistent feedback after every user action.

**Static analysis:**
- [ ] `toast.add()` called after every successful Create/Update/Delete
- [ ] Error toast on every failed API call
- [ ] Toast titles in **German**
- [ ] Consistent color usage: `success` (create/update), `error` (failure), `info` (neutral), `warning` (caution)
- [ ] Error toasts include `description` with actionable text
- [ ] No `alert()` or `window.confirm()` — use `useToast()` and modal dialogs

**Grep patterns:**
```bash
# Actions without toast feedback
grep -rn "async.*submit\|async.*save\|async.*delete\|async.*create\|async.*update" <vue-files> | grep -v "toast"
# alert/confirm usage
grep -rn "alert(\|window\.confirm(" <vue-files>
# English toast messages (should be German)
grep -rn "toast.add" <vue-files> | grep -i "success\|error\|created\|updated\|deleted\|saved\|failed"
# Missing error color
grep -rn "toast.add" <vue-files> | grep -v "color:"
```

**Scoring:**

| Scenario | Score |
|----------|-------|
| All actions have consistent feedback | 100% |
| Most actions covered, minor gaps | 80-90% |
| Inconsistent colors or missing error toasts | 60-75% |
| No feedback pattern or alert() usage | <50% |

### Phase 3: Navigation Patterns

Consistent, predictable navigation throughout the app.

**Static analysis:**
- [ ] List pages have click-to-detail navigation
- [ ] Detail pages have back navigation (button or breadcrumb)
- [ ] No "dead end" pages — every page has a way back
- [ ] Breadcrumbs on nested pages (depth >= 2)
- [ ] Active menu item highlighted in sidebar/nav
- [ ] After create/update → navigate to detail or back to list
- [ ] After delete → navigate back to list
- [ ] 404 page exists with navigation back to home

**Grep patterns:**
```bash
# Pages without back navigation
grep -rL "navigateTo\|router\.push\|router\.back\|NuxtLink\|UBreadcrumb" app/pages/**/*.vue
# Delete without redirect
grep -A5 "delete\|remove" <vue-files> | grep -v "navigateTo\|router\|push"
# Missing 404 page
ls app/pages/error.vue app/error.vue 2>/dev/null
```

**Browser verification:**
- Navigate through changed pages → check for dead ends
- Verify back-navigation works after create/edit actions

**Scoring:**

| Scenario | Score |
|----------|-------|
| All navigation patterns consistent | 100% |
| Minor gaps (missing breadcrumbs) | 80-90% |
| Dead end pages or missing back-nav | 60-75% |
| No navigation structure | <50% |

### Phase 4: Form UX

Forms must guide the user and prevent mistakes.

**Static analysis:**
- [ ] Live validation — errors show on blur/change, not only on submit
- [ ] Required fields marked visually (asterisk or `required` prop on `UFormField`)
- [ ] Submit button disabled during API call (`loading` prop or `:disabled`)
- [ ] Success feedback after submit (toast + navigation)
- [ ] Form reset after successful submit (if staying on same page)
- [ ] Cancel button available on forms (navigates back without saving)
- [ ] Unsaved changes warning — `onBeforeRouteLeave` guard if form is dirty

**Grep patterns:**
```bash
# Forms without loading state on submit
grep -rn "UButton.*type=\"submit\"" <vue-files> | grep -v "loading\|disabled"
# Forms without required markers
grep -rn "UFormField" <vue-files> | grep -v "required"
# Missing cancel action
grep -rL "cancel\|Abbrechen\|router\.back\|navigateTo" <vue-files-with-forms>
```

**Browser verification:**
- Submit empty form → verify validation messages appear
- Submit valid form → verify loading state and success feedback
- Check required field markers are visible

**Scoring:**

| Scenario | Score |
|----------|-------|
| All form UX rules followed | 100% |
| Minor gaps (missing cancel, no unsaved warning) | 80-90% |
| No live validation or no loading on submit | 60-75% |
| Forms without any UX consideration | <50% |

### Phase 5: Destructive Action Safety

Prevent accidental data loss.

**Static analysis:**
- [ ] Delete actions require confirmation dialog (modal or confirm component)
- [ ] Destructive buttons use `color="error"` — visually distinct
- [ ] Confirmation dialog text is clear and in German ("Möchtest du X wirklich löschen?")
- [ ] Confirm button repeats the action ("Löschen", not "OK" or "Ja")
- [ ] Bulk delete has extra warning about count ("3 Einträge löschen?")
- [ ] Irreversible actions are clearly labeled

**Grep patterns:**
```bash
# Delete without confirmation
grep -B5 -A5 "delete\|remove\|destroy" <vue-files> | grep -v "confirm\|modal\|dialog\|Modal"
# Destructive buttons without error color
grep -rn "delete\|löschen\|entfernen" <vue-files> | grep "UButton" | grep -v 'color="error"\|color=.error'
# Generic confirm text
grep -rn "OK\|Ja\|Yes" <vue-files> | grep -i "confirm\|dialog\|modal"
```

**Scoring:**

| Scenario | Score |
|----------|-------|
| All destructive actions have confirmation | 100% |
| Most covered, generic confirm text | 80-90% |
| Some deletes without confirmation | 60-75% |
| No confirmation pattern | <50% |

### Phase 6: Optimistic UI & Loading Indicators

No "frozen" UI during async operations.

**Static analysis:**
- [ ] Every button triggering an API call has `loading` prop or disabled state
- [ ] Page transitions show loading indicator (`NuxtLoadingIndicator` or custom)
- [ ] Table/list refreshes show inline loading (not full page reload)
- [ ] No "hanging" UI — user always knows something is happening
- [ ] Debounced search inputs show loading indicator while fetching

**Grep patterns:**
```bash
# Async functions in templates without loading
grep -rn "@click.*async\|@click.*fetch\|@click.*save\|@click.*submit" <vue-files> | grep -v "loading"
# Buttons without loading prop
grep -rn "UButton" <vue-files> | grep "submit\|save\|create\|update" | grep -v ":loading\|:disabled"
```

**Browser verification:**
- Click action buttons → verify loading indicator appears
- Navigate between pages → verify transition indicator

**Scoring:**

| Scenario | Score |
|----------|-------|
| All async actions have loading indicators | 100% |
| Most buttons covered, minor gaps | 80-90% |
| Many buttons without loading state | 60-75% |
| No loading indicators | <50% |

### Phase 7: Cross-Page Consistency

Same actions look and behave the same everywhere.

**Static analysis:**
- [ ] **Icon consistency** — same icon for same action across all pages (edit = pencil, delete = trash, etc.)
- [ ] **Button order** — consistent order in action groups (Edit → Delete, or Primary → Secondary)
- [ ] **Page header pattern** — consistent structure (Title + Description + Actions)
- [ ] **Table column patterns** — Actions column always last, consistent width
- [ ] **Modal patterns** — consistent size, title format, button placement
- [ ] **Date/time formatting** — consistent format across all pages
- [ ] **Number formatting** — consistent decimal/thousand separators

**Grep patterns:**
```bash
# Collect all icon usage to check consistency
grep -rn 'icon="i-' <vue-files> | sort
# Collect all date formatting
grep -rn "toLocaleDateString\|format.*date\|dayjs\|date-fns" <vue-files>
# Different modal sizes
grep -rn "UModal\|useOverlay" <vue-files>
```

**Scoring:**

| Scenario | Score |
|----------|-------|
| Fully consistent patterns | 100% |
| Minor inconsistencies (different icon for same action) | 80-90% |
| Widespread inconsistencies | 60-75% |
| No consistent patterns | <50% |

### Phase 8: Error Recovery

Users must be able to recover from errors gracefully.

**Static analysis:**
- [ ] API error responses show "Erneut versuchen" (retry) button
- [ ] Network timeout shows meaningful message (not raw error)
- [ ] `NuxtErrorBoundary` wraps independent page sections
- [ ] Global error page (`error.vue`) exists with navigation home
- [ ] Failed form submissions preserve user input (no data loss)
- [ ] Session expiry redirects to login with return URL

**Grep patterns:**
```bash
# Error states without retry
grep -rn "ErrorState\|error" <vue-files> | grep -v "retry\|erneut\|@retry"
# Missing NuxtErrorBoundary
grep -rL "NuxtErrorBoundary" app/pages/*.vue app/pages/**/*.vue 2>/dev/null
# Global error page
ls app/error.vue 2>/dev/null
```

**Browser verification:**
- If testable: disconnect API → verify error recovery UI
- Check that error pages have navigation back

**Scoring:**

| Scenario | Score |
|----------|-------|
| Full error recovery on all components | 100% |
| Most errors handled, missing retry on some | 80-90% |
| Raw error messages or no recovery option | 60-75% |
| White screens on errors | <50% |

### Phase 9: Responsive Behavior

Mobile-first design that works on all screen sizes.

**Static analysis:**
- [ ] Responsive breakpoints used (`sm:`, `md:`, `lg:`) on layout components
- [ ] Tables have mobile alternative (card layout or horizontal scroll)
- [ ] Navigation collapses on mobile (hamburger menu or drawer)
- [ ] Touch targets minimum 44x44px (`min-h-11 min-w-11` or `p-3` on interactive elements)
- [ ] No horizontal overflow on mobile (no fixed-width containers)
- [ ] Form layouts stack vertically on mobile (`flex-col` or grid responsive)
- [ ] Modal sizes adapt (`sm:max-w-lg` pattern)

**Grep patterns:**
```bash
# Fixed widths that may break mobile
grep -rn "w-\[.*px\]\|min-w-\[.*px\]" <vue-files> | grep -v "sm:\|md:\|lg:"
# Tables without responsive handling
grep -rn "UTable\|<table" <vue-files> | grep -v "overflow\|responsive\|hidden.*sm:"
# Small touch targets (icon buttons without padding)
grep -rn 'size="xs"' <vue-files> | grep "UButton"
```

**Browser verification (if available):**
- Resize to 375px width (mobile) → take screenshot
- Resize to 768px (tablet) → take screenshot
- Resize to 1440px (desktop) → take screenshot
- Check for horizontal overflow, cut-off content, overlapping elements

**Scoring:**

| Scenario | Score |
|----------|-------|
| Fully responsive on all breakpoints | 100% |
| Minor issues (table overflow on mobile) | 80-90% |
| Layout breaks on mobile | 60-75% |
| No responsive consideration | <50% |

### Phase 10: Bonus Checks

These checks report findings but do **not** count toward the overall score. They highlight opportunities for UX excellence.

#### 10a: Skeleton Loading
- [ ] Data-heavy pages use `USkeleton` instead of spinner for perceived performance
- [ ] Skeleton shapes match actual content layout (text lines, cards, avatars)

```bash
grep -rn "USkeleton\|skeleton" <vue-files>
```

#### 10b: Keyboard Navigation
- [ ] Tab order follows visual order (no `tabindex` hacks)
- [ ] Escape closes modals and dropdowns
- [ ] Enter submits forms
- [ ] Focus ring visible on interactive elements (Nuxt UI default — verify not overridden)
- [ ] Skip-to-content link for screen readers

```bash
# Tabindex overrides
grep -rn "tabindex" <vue-files>
# Escape key handling on modals
grep -rn "@keydown.escape\|@keyup.escape\|Escape" <vue-files>
```

#### 10c: Pagination & Infinite Scroll
- [ ] Lists > 20 items use pagination or infinite scroll
- [ ] Current page/position preserved after back-navigation
- [ ] Page size selector available on paginated lists
- [ ] Total count displayed ("23 Einträge")

```bash
grep -rn "UPagination\|pagination\|page.*size\|offset\|limit" <vue-files>
```

#### 10d: Onboarding & Empty States
- [ ] Empty states have Call-to-Action ("Erstelle deine erste Season")
- [ ] Empty state icon and message match the context
- [ ] First-time user sees guidance (tooltip, banner, or inline help)
- [ ] No generic "Keine Daten" — message explains what to do next

```bash
grep -rn "EmptyState\|empty\|Keine.*vorhanden\|Keine.*gefunden" <vue-files>
```

---

## Output Format

```markdown
## UX Pattern Review Report

### Overview
| Dimension | Fulfillment | Status |
|-----------|-------------|--------|
| State Handling | X% | ✅/⚠️/❌ |
| User Feedback | X% | ✅/⚠️/❌ |
| Navigation Patterns | X% | ✅/⚠️/❌ |
| Form UX | X% | ✅/⚠️/❌ |
| Destructive Action Safety | X% | ✅/⚠️/❌ |
| Optimistic UI & Loading | X% | ✅/⚠️/❌ |
| Cross-Page Consistency | X% | ✅/⚠️/❌ |
| Error Recovery | X% | ✅/⚠️/❌ |
| Responsive Behavior | X% | ✅/⚠️/❌ |

**Overall: X%**

### Bonus Findings (not scored)
| Check | Status | Notes |
|-------|--------|-------|
| Skeleton Loading | ✅/⚠️/❌ | ... |
| Keyboard Navigation | ✅/⚠️/❌ | ... |
| Pagination Patterns | ✅/⚠️/❌ | ... |
| Onboarding Empty States | ✅/⚠️/❌ | ... |

### 1. State Handling
[Findings: which components miss Loading/Empty/Error states]

### 2. User Feedback
[Findings: missing toasts, inconsistent colors, English messages]

### 3. Navigation Patterns
[Findings: dead ends, missing breadcrumbs, no back-nav]

### 4. Form UX
[Findings: no live validation, missing loading on submit]

### 5. Destructive Action Safety
[Findings: deletes without confirmation, generic OK buttons]

### 6. Optimistic UI & Loading
[Findings: buttons without loading, hanging UI]

### 7. Cross-Page Consistency
[Findings: icon mismatches, different button orders]

### 8. Error Recovery
[Findings: missing retry, raw error messages]

### 9. Responsive Behavior
[Findings: layout breaks, small touch targets, fixed widths]

### 10. Bonus Findings
[Details on skeleton, keyboard, pagination, onboarding]

### Remediation Catalog
| # | Dimension | Priority | File | Action |
|---|-----------|----------|------|--------|
| 1 | State Handling | High | pages/seasons/index.vue | Add EmptyState for empty list |
| 2 | User Feedback | High | composables/useSeasons.ts | Add error toast on fetch failure |
| 3 | ... | ... | ... | ... |
```

### Status Thresholds

| Status | Fulfillment |
|--------|-------------|
| ✅ | 100% |
| ⚠️ | 70-99% |
| ❌ | <70% |

---

## Browser Verification Strategy

When Chrome DevTools MCP is available and dev server is running:

1. **Identify target pages** from changed files → map to routes
2. **Navigate to each page** → `navigate_page`
3. **Take snapshot** → verify DOM structure for state handling, buttons, navigation
4. **Resize viewport** → `resize_page` to 375px, 768px, 1440px for responsive checks
5. **Interact** → `click` buttons, `fill` forms to test feedback and loading states
6. **Check console** → `list_console_messages` for errors during interactions
7. **Check network** → `list_network_requests` for failed API calls

**If dev server is not available:**
- Skip all browser verification steps
- Perform static code analysis only
- Mark browser-dependent findings as "Could not verify — dev server not running"

## Error Recovery

If blocked during any phase:

1. **Document the error** and continue with remaining phases
2. **Mark the blocked phase** as "Could not evaluate" with reason
3. **Never skip phases silently** — always report what happened
4. **Browser errors** (timeout, auth required) → fall back to static analysis for that phase
