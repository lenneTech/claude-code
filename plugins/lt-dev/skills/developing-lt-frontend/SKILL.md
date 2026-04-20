---
name: developing-lt-frontend
description: Handles ALL Nuxt 4 and Vue frontend development tasks including composables, forms (Valibot), API integration (types.gen.ts, sdk.gen.ts), authentication (Better Auth), SSR, and Playwright E2E testing. Supports monorepos (projects/app/, packages/app/). Activates when working with .vue files, nuxt.config.ts, Nuxt UI, TailwindCSS, or files in app/components/, app/composables/, app/pages/, app/interfaces/, app/layouts/. NOT for NestJS backend (use generating-nest-servers). NOT for security theory (use general-frontend-security).
effort: high
paths:
  - "**/*.vue"
  - "**/nuxt.config.ts"
  - "**/app/components/**"
  - "**/app/composables/**"
  - "**/app/pages/**"
  - "**/app/interfaces/**"
  - "**/app/layouts/**"
---

# lenne.tech Frontend Development

## Ecosystem Context

Developers typically work in a **Lerna fullstack monorepo** created via `lt fullstack init`:

```
project/
├── projects/
│   ├── api/    ← nest-server-starter (depends on @lenne.tech/nest-server)
│   └── app/    ← nuxt-base-starter (depends on @lenne.tech/nuxt-extensions)
├── lerna.json
└── package.json (workspaces: ["projects/*"])
```

**Package relationships:**
- **nuxt-base-starter** (template) → depends on **@lenne.tech/nuxt-extensions** (plugin)
- **@lenne.tech/nuxt-extensions** provides pre-built composables, components, and types aligned with `@lenne.tech/nest-server`
- This skill covers `projects/app/` and any code using nuxt-base-starter or nuxt-extensions

## When to Use This Skill

- Working with Nuxt 4 projects (nuxt.config.ts present)
- Editing files in `app/components/`, `app/composables/`, `app/pages/`, `app/interfaces/`
- Creating or modifying Vue components with Nuxt UI
- Integrating backend APIs via generated types (`types.gen.ts`, `sdk.gen.ts`)
- Building forms with Valibot validation
- Implementing authentication (login, register, 2FA, passkeys)
- Working in monorepos with `projects/app/` or `packages/app/` structure

**NOT for:** NestJS backend development (use `generating-nest-servers` skill instead)

## Framework Source Files (MUST READ before guessing)

**ALWAYS read actual source code** from `node_modules/@lenne.tech/nuxt-extensions/` before guessing framework behavior. The framework ships documentation with the npm package.

| File (in `node_modules/@lenne.tech/nuxt-extensions/`) | When to Read |
|-------------------------------------------------------|-------------|
| `CLAUDE.md` | Start of any frontend task — composables, components, config |
| `dist/runtime/composables/` | Available composables (useAuth, useApi, etc.) |
| `dist/runtime/components/` | Available components |
| `dist/runtime/utils/` | Available utilities |
| `dist/runtime/types/` | TypeScript type definitions |

**Also read** the nuxt-base-starter documentation:
- `README.md` — Project overview, tech stack, auth setup
- `AUTH.md` — Better Auth integration details

## CRITICAL: Real Backend Integration FIRST

**Never use placeholder data, TODO comments, or manual interfaces!**

- Always use real API calls via `sdk.gen.ts` from the start
- Always use generated types from `types.gen.ts` (never manual interfaces for DTOs)
- Run `pnpm run generate-types` with API running before starting frontend work
- Implement feature-by-feature with full backend integration

**Before starting:** Ensure services are running. See [reference/service-health-check.md](${CLAUDE_SKILL_DIR}/reference/service-health-check.md)

## Skill Boundaries

| User Intent | Correct Skill |
|------------|---------------|
| "Build a Vue component" | **THIS SKILL** |
| "Create a Nuxt page" | **THIS SKILL** |
| "Style with TailwindCSS" | **THIS SKILL** |
| "Create a NestJS module" | generating-nest-servers |
| "Security audit of frontend" | general-frontend-security |
| "Implement with TDD" | building-stories-with-tdd |

## Related Skills

**Works closely with:**
- `generating-nest-servers` - For NestJS backend development (projects/api/)
- `using-lt-cli` - For Git operations and Fullstack initialization
- `building-stories-with-tdd` - For complete TDD workflow (Backend + Frontend)
- `contributing-to-lt-framework` - When modifying `@lenne.tech/nuxt-extensions` itself and testing via `pnpm link`
- `/lt-dev:frontend:env-migrate` - Migrate env variables to `NUXT_` prefix convention

## Dev Server Lifecycle

When starting `nuxt dev` (or any long-running process) for manual testing, Chrome DevTools MCP debugging, or E2E tests: **always** use `run_in_background: true` and `pkill -f "nuxt dev"` afterwards. Leaving dev servers orphaned blocks the Claude Code session ("Unfurling..."). Full rules: `managing-dev-servers` skill.

**In monorepo projects:**
- `projects/app/` or `packages/app/` → **This skill**
- `projects/api/` or `packages/api/` → `generating-nest-servers` skill

## Nuxt 4 Directory Structure

```
app/                  # Application code (srcDir)
├── components/       # Auto-imported components
├── composables/      # Auto-imported composables
├── interfaces/       # TypeScript interfaces
├── lib/              # Utility libraries (auth-client, etc.)
├── pages/            # File-based routing
├── layouts/          # Layout components
├── utils/            # Auto-imported utilities
└── api-client/       # Generated types & SDK
server/               # Nitro server routes
public/               # Static assets
nuxt.config.ts
```

## Type Rules

| Priority | Source | Use For |
|----------|--------|---------|
| 1. | `~/api-client/types.gen.ts` | All backend DTOs (REQUIRED) |
| 2. | `~/api-client/sdk.gen.ts` | All API calls (REQUIRED) |
| 3. | Nuxt UI types | Component props (auto-imported) |
| 4. | `app/interfaces/*.interface.ts` | Frontend-only types (UI state, forms) |

## Standards

| Rule | Value |
|------|-------|
| UI Labels | German (`Speichern`, `Abbrechen`) |
| Code/Comments | English |
| Styling | TailwindCSS only, no `<style>` |
| Colors | Semantic only (`primary`, `error`, `success`) |
| Types | Explicit, no implicit `any` |
| Backend Types | **Generated only** (`types.gen.ts`) |
| Composables | `app/composables/use*.ts` |
| Shared State | `useState()` for SSR-safe state |
| Local State | `ref()` / `reactive()` |
| Forms | Valibot (not Zod) |
| Modals | `useOverlay()` |

## TDD for Frontend

```
1. Backend API must be complete (API tests pass)
2. Write E2E tests BEFORE implementing frontend
3. Implement components/pages until E2E tests pass
4. Debug with Chrome DevTools MCP
```

**Complete E2E testing guide: [reference/e2e-testing.md](${CLAUDE_SKILL_DIR}/reference/e2e-testing.md)**

## Error Handling — Consume Backend ErrorCodes via `useLtErrorTranslation`

The backend returns structured errors in the format `#LTNS_XXXX: Developer message` (core) or `#PROJ_XXXX: ...` (project-specific). The `@lenne.tech/nuxt-extensions` package ships `useLtErrorTranslation()` which parses the `#CODE:` marker, loads locale-specific translations from `GET /i18n/errors/:locale`, and returns end-user messages.

**NEVER assert or display raw English backend messages in the UI.** Always pipe errors through `translateError()` / `showErrorToast()` so users see localized text.

```vue
<script setup lang="ts">
const { translateError, showErrorToast, parseError } = useLtErrorTranslation();
const toast = useToast();

async function onSubmit() {
  try {
    await $fetch('/api/users', { method: 'POST', body: form.value });
  } catch (error) {
    // Preferred — direct toast from translated message
    showErrorToast(error, 'Speichern fehlgeschlagen');

    // Or manual, if you need more control
    toast.add({
      color: 'error',
      title: 'Speichern fehlgeschlagen',
      description: translateError(error),  // '#LTNS_0400: Resource not found' → 'Ressource nicht gefunden.'
    });

    // Or parse for custom handling (e.g. redirect on specific code)
    const parsed = parseError(error);
    if (parsed.code === 'LTNS_0023') {
      await navigateTo('/auth/verify-email');
    }
  }
}
</script>
```

**Rules:**
- [ ] Every error-handling site uses `useLtErrorTranslation()` — no raw `error.message` in Toast descriptions, form errors, or page-level error UI
- [ ] `loadTranslations(locale)` is called once at app start or on locale change (the composable caches per locale via `useState`)
- [ ] Code-based branching (`if (parsed.code === 'LTNS_XXXX')`) for flow-control decisions (verification-required redirects, retry prompts) — never branch on message-string contents
- [ ] Toast titles are hardcoded in German (context-specific, e.g. `'Anmeldung fehlgeschlagen'`); descriptions come from `translateError`
- [ ] Tests assert translated messages (not English `error.message`) — see the test-reviewer rules in this plugin

**Full consumer reference: [reference/error-translation.md](${CLAUDE_SKILL_DIR}/reference/error-translation.md)**

## Reference Files

| Topic | File |
|-------|------|
| Core Patterns | [reference/patterns.md](${CLAUDE_SKILL_DIR}/reference/patterns.md) |
| Service Health Check | [reference/service-health-check.md](${CLAUDE_SKILL_DIR}/reference/service-health-check.md) |
| Browser Testing | [reference/browser-testing.md](${CLAUDE_SKILL_DIR}/reference/browser-testing.md) |
| TypeScript | [reference/typescript.md](${CLAUDE_SKILL_DIR}/reference/typescript.md) |
| Components | [reference/components.md](${CLAUDE_SKILL_DIR}/reference/components.md) |
| Composables | [reference/composables.md](${CLAUDE_SKILL_DIR}/reference/composables.md) |
| Forms | [reference/forms.md](${CLAUDE_SKILL_DIR}/reference/forms.md) |
| Modals | [reference/modals.md](${CLAUDE_SKILL_DIR}/reference/modals.md) |
| API | [reference/api.md](${CLAUDE_SKILL_DIR}/reference/api.md) |
| Colors | [reference/colors.md](${CLAUDE_SKILL_DIR}/reference/colors.md) |
| Nuxt Patterns | [reference/nuxt.md](${CLAUDE_SKILL_DIR}/reference/nuxt.md) |
| Authentication | [reference/authentication.md](${CLAUDE_SKILL_DIR}/reference/authentication.md) |
| E2E Testing | [reference/e2e-testing.md](${CLAUDE_SKILL_DIR}/reference/e2e-testing.md) |
| Troubleshooting | [reference/troubleshooting.md](${CLAUDE_SKILL_DIR}/reference/troubleshooting.md) |
| Security | [reference/security.md](${CLAUDE_SKILL_DIR}/reference/security.md) |
| Error Translation (consume backend ErrorCodes) | [reference/error-translation.md](${CLAUDE_SKILL_DIR}/reference/error-translation.md) |
| Informed Trade-offs (Composition API, readonly, SSR guards, v-html, useFetch) | [reference/informed-trade-off-pattern.md](${CLAUDE_SKILL_DIR}/reference/informed-trade-off-pattern.md) |

## Pre-Commit Checklist

- [ ] No placeholder data, no TODO comments for API
- [ ] All API calls via `sdk.gen.ts`, all types from `types.gen.ts`
- [ ] Logic in composables, modals use `useOverlay`, forms use Valibot
- [ ] TailwindCSS only, semantic colors only
- [ ] German UI, English code, no implicit `any`
- [ ] Auth uses `useBetterAuth()`, protected routes use `middleware: 'auth'`
- [ ] No `v-html` with user content, tokens stored securely
- [ ] All error-handling sites route through `useLtErrorTranslation()` — no raw backend messages in Toasts / UI
- [ ] Security review passed (`/lt-dev:review` for general scan)
- [ ] Feature tested in browser (Chrome DevTools MCP), no console errors
