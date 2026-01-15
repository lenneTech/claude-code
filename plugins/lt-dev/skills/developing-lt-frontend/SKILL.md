---
name: developing-lt-frontend
description: PRIMARY expert for ALL Nuxt and Vue frontend tasks. ALWAYS use this skill when working with Nuxt 4, Vue components, Nuxt UI, frontend pages, or files in app/components/, app/composables/, app/pages/, app/interfaces/ (supports monorepos with projects/app/, packages/app/). Handles modals (useOverlay), forms (Valibot), API integration (types.gen.ts, sdk.gen.ts), authentication (Better Auth), TailwindCSS styling, useFetch, useState, SSR. ALWAYS activate for .vue files, nuxt.config.ts, or frontend development. NOT for NestJS backend (use generating-nest-servers).
---

# lenne.tech Frontend Development

## When to Use This Skill

- Working with Nuxt 4 projects (nuxt.config.ts present)
- Editing files in `app/components/`, `app/composables/`, `app/pages/`, `app/interfaces/`
- Creating or modifying Vue components with Nuxt UI
- Integrating backend APIs via generated types (`types.gen.ts`, `sdk.gen.ts`)
- Building forms with Valibot validation
- Implementing authentication (login, register, 2FA, passkeys)
- Working in monorepos with `projects/app/` or `packages/app/` structure

**NOT for:** NestJS backend development (use `generating-nest-servers` skill instead)

## Related Skills

**Works closely with:**
- `generating-nest-servers` - For NestJS backend development (projects/api/)
- `using-lt-cli` - For Git operations and Fullstack initialization
- `building-stories-with-tdd` - For TDD approach when backend integration is needed

**When to use which:**
- .vue files, Nuxt, Vue components? Use **this skill** (developing-lt-frontend)
- NestJS, services, controllers? Use `generating-nest-servers` skill
- Git operations, `lt` commands? Use `using-lt-cli` skill

**In monorepo projects:**
- `projects/app/` or `packages/app/` → **This skill**
- `projects/api/` or `packages/api/` → `generating-nest-servers` skill

## TypeScript Language Server (Recommended)

**Use the LSP tool when available** for better code intelligence in TypeScript/Vue/Nuxt projects:

| Operation | Use Case |
|-----------|----------|
| `goToDefinition` | Find where a type, composable, or component is defined |
| `findReferences` | Find all usages of a symbol across the codebase |
| `hover` | Get type information for props, refs, and computed values |
| `documentSymbol` | List all exports, functions, and types in a file |
| `workspaceSymbol` | Search for composables, interfaces, or components |
| `goToImplementation` | Find implementations of interfaces |

**When to use LSP:**
- Finding where a type from `types.gen.ts` is used → `findReferences`
- Understanding composable structure → `documentSymbol`
- Navigating to type definitions → `goToDefinition`
- Searching for components or composables → `workspaceSymbol`

**Installation (if LSP not available):**
```bash
claude plugins install typescript-lsp --marketplace claude-plugins-official
```

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

**CRITICAL: Never create custom interfaces for backend DTOs!**

| Priority | Source | Use For |
|----------|--------|---------|
| 1. | `~/api-client/types.gen.ts` | All backend DTOs (REQUIRED) |
| 2. | `~/api-client/sdk.gen.ts` | All API calls (REQUIRED) |
| 3. | Nuxt UI types | Component props (auto-imported) |
| 4. | `app/interfaces/*.interface.ts` | Frontend-only types (UI state, forms) |

### Generating Types

**Prerequisites:** Backend API must be running!

```bash
# Start API first (in monorepo)
cd projects/api && npm run start:dev

# Then generate types
npm run generate-types
```

If `types.gen.ts` or `sdk.gen.ts` are missing or outdated:
1. Ensure API is running at configured URL
2. Run `npm run generate-types`
3. Never create manual DTOs as workaround

## Core Patterns

### API Calls (via generated SDK)

```typescript
import type { SeasonDto } from '~/api-client/types.gen'
import { seasonControllerGet } from '~/api-client/sdk.gen'

const response = await seasonControllerGet()
const seasons: SeasonDto[] = response.data ?? []
```

### Composables (one per controller)

```typescript
export function useSeasons() {
  const seasons = ref<SeasonDto[]>([])
  const loading = ref<boolean>(false)

  async function fetchSeasons(): Promise<void> {
    loading.value = true
    try {
      const response = await seasonControllerGet()
      if (response.data) seasons.value = response.data
    } finally {
      loading.value = false
    }
  }

  return { seasons: readonly(seasons), loading: readonly(loading), fetchSeasons }
}
```

### Shared State (useState)

```typescript
// For state shared across components (SSR-safe)
export function useSettings() {
  const theme = useState<'light' | 'dark'>('app-theme', () => 'light')
  return { theme }
}
```

### Authentication (Better Auth)

```typescript
// app/composables/use-better-auth.ts (pre-configured in nuxt-base-starter)
import { authClient } from '~/lib/auth-client'

export function useBetterAuth() {
  const session = authClient.useSession(useFetch)

  const user = computed(() => session.data.value?.user ?? null)
  const isAuthenticated = computed<boolean>(() => !!session.data.value?.session)
  const isAdmin = computed<boolean>(() => user.value?.role === 'admin')

  return {
    user, isAuthenticated, isAdmin,
    signIn: authClient.signIn,   // Password auto-hashed (SHA256)
    signUp: authClient.signUp,   // Password auto-hashed (SHA256)
    signOut: authClient.signOut,
    twoFactor: authClient.twoFactor,
    passkey: authClient.passkey,
  }
}
```

**Preferred auth methods:** Passkey (WebAuthn) or Email/Password + 2FA (TOTP)
**Base path:** `/iam` (must match nest-server config)

### Programmatic Modals

```typescript
const overlay = useOverlay()

overlay.open(ModalCreate, {
  props: { title: 'Neu' },
  onClose: (result) => { if (result) refreshData() }
})
```

### Valibot Forms (not Zod)

```typescript
import { object, pipe, string, minLength } from 'valibot'
import type { InferOutput } from 'valibot'

const schema = object({
  title: pipe(string(), minLength(3, 'Mindestens 3 Zeichen'))
})
type Schema = InferOutput<typeof schema>
const state = reactive<Schema>({ title: '' })
```

## Standards

| Rule | Value |
|------|-------|
| UI Labels | German (`Speichern`, `Abbrechen`) |
| Code/Comments | English |
| Styling | TailwindCSS only, no `<style>` |
| Colors | Semantic only (`primary`, `error`, `success`), no hardcoded |
| Types | Explicit, no implicit `any` |
| Backend Types | **Generated only** (`types.gen.ts`) |
| Custom Interfaces | Frontend-only (`app/interfaces/*.interface.ts`) |
| Composables | `app/composables/use*.ts` |
| Shared State | `useState()` for SSR-safe state |
| Local State | `ref()` / `reactive()` |

## Reference Files

| Topic | File |
|-------|------|
| TypeScript | [reference/typescript.md](./reference/typescript.md) |
| Components | [reference/components.md](./reference/components.md) |
| Composables | [reference/composables.md](./reference/composables.md) |
| Forms | [reference/forms.md](./reference/forms.md) |
| Modals | [reference/modals.md](./reference/modals.md) |
| API | [reference/api.md](./reference/api.md) |
| Colors | [reference/colors.md](./reference/colors.md) |
| Nuxt Patterns | [reference/nuxt.md](./reference/nuxt.md) |
| Authentication | [reference/authentication.md](./reference/authentication.md) |

## Pre-Commit

- [ ] **No custom interfaces for backend DTOs** (use `types.gen.ts`)
- [ ] All API calls via `sdk.gen.ts`
- [ ] Types regenerated after backend changes (`npm run generate-types`)
- [ ] Logic in composables
- [ ] Modals use `useOverlay`
- [ ] Forms use Valibot
- [ ] TailwindCSS only
- [ ] **Semantic colors only** (`primary`, `error`, `success`), no hardcoded colors
- [ ] German UI, English code
- [ ] No implicit `any`
- [ ] ESLint passes
- [ ] Auth uses `useBetterAuth()` composable (pre-configured)
- [ ] Protected routes use `middleware: 'auth'`
- [ ] Auth base path is `/iam` (nest-server default)
