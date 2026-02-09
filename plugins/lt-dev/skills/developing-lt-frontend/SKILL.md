---
name: developing-lt-frontend
description: Handles ALL Nuxt 4 and Vue frontend development tasks. Activates for .vue files, nuxt.config.ts, Nuxt UI, TailwindCSS, or files in app/components/, app/composables/, app/pages/, app/interfaces/, app/layouts/. Supports monorepos (projects/app/, packages/app/). Covers composables, forms (Valibot), API integration (types.gen.ts, sdk.gen.ts), authentication (Better Auth), SSR, and Playwright E2E testing. NOT for NestJS backend (use generating-nest-servers). NOT for security theory (use general-frontend-security).
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

## CRITICAL: Real Backend Integration FIRST

**Never use placeholder data, TODO comments, or manual interfaces!**

- Always use real API calls via `sdk.gen.ts` from the start
- Always use generated types from `types.gen.ts` (never manual interfaces for DTOs)
- Run `npm run generate-types` with API running before starting frontend work
- Implement feature-by-feature with full backend integration

**Before starting:** Ensure services are running. See [reference/service-health-check.md](./reference/service-health-check.md)

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

**Complete E2E testing guide: [reference/e2e-testing.md](./reference/e2e-testing.md)**

## Reference Files

| Topic | File |
|-------|------|
| Core Patterns | [reference/patterns.md](./reference/patterns.md) |
| Service Health Check | [reference/service-health-check.md](./reference/service-health-check.md) |
| Browser Testing | [reference/browser-testing.md](./reference/browser-testing.md) |
| TypeScript | [reference/typescript.md](./reference/typescript.md) |
| Components | [reference/components.md](./reference/components.md) |
| Composables | [reference/composables.md](./reference/composables.md) |
| Forms | [reference/forms.md](./reference/forms.md) |
| Modals | [reference/modals.md](./reference/modals.md) |
| API | [reference/api.md](./reference/api.md) |
| Colors | [reference/colors.md](./reference/colors.md) |
| Nuxt Patterns | [reference/nuxt.md](./reference/nuxt.md) |
| Authentication | [reference/authentication.md](./reference/authentication.md) |
| E2E Testing | [reference/e2e-testing.md](./reference/e2e-testing.md) |
| Troubleshooting | [reference/troubleshooting.md](./reference/troubleshooting.md) |
| Security | [reference/security.md](./reference/security.md) |

## Pre-Commit Checklist

- [ ] No placeholder data, no TODO comments for API
- [ ] All API calls via `sdk.gen.ts`, all types from `types.gen.ts`
- [ ] Logic in composables, modals use `useOverlay`, forms use Valibot
- [ ] TailwindCSS only, semantic colors only
- [ ] German UI, English code, no implicit `any`
- [ ] Auth uses `useBetterAuth()`, protected routes use `middleware: 'auth'`
- [ ] No `v-html` with user content, tokens stored securely
- [ ] Feature tested in browser (Chrome DevTools MCP), no console errors
