---
name: developing-lt-frontend
description: Develops lenne.tech frontend applications with Nuxt 4, Nuxt UI 4, strict TypeScript, and Valibot forms. Integrates backend APIs via generated types (types.gen.ts, sdk.gen.ts). Creates components with programmatic modals (useOverlay), composables per backend controller, TailwindCSS-only styling. Handles Nuxt 4 patterns including app/ directory, useFetch, useState, SSR, and hydration. Use when working with app/interfaces/, app/composables/, app/components/, app/pages/ in Nuxt projects or monorepos (projects/app/). NOT for NestJS backend (use generating-nest-servers).
---

# lenne.tech Frontend Development

## Nuxt 4 Directory Structure

```
app/                  # Application code (srcDir)
├── components/       # Auto-imported components
├── composables/      # Auto-imported composables
├── interfaces/       # TypeScript interfaces
├── pages/            # File-based routing
├── layouts/          # Layout components
└── api-client/       # Generated types & SDK
server/               # Nitro server routes
public/               # Static assets
nuxt.config.ts
```

## Type Priority

1. Generated: `~/api-client/types.gen.ts`, `~/api-client/sdk.gen.ts`
2. Nuxt UI types (auto-imported)
3. Custom: `app/interfaces/*.interface.ts`

**After backend changes:** `npm run generate-types`

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
export function useAuth() {
  const user = useState<UserDto | null>('auth-user', () => null)
  const isAuthenticated = computed<boolean>(() => !!user.value)
  return { user: readonly(user), isAuthenticated }
}
```

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
import { object, string, minLength } from 'valibot'
import type { InferOutput } from 'valibot'

const schema = object({
  title: string([minLength(3, 'Mindestens 3 Zeichen')])
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
| Types | Explicit, no implicit `any` |
| Interfaces | `app/interfaces/*.interface.ts` |
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
| Nuxt Patterns | [reference/nuxt.md](./reference/nuxt.md) |

## Pre-Commit

- [ ] Types from `types.gen.ts`
- [ ] API via `sdk.gen.ts`
- [ ] Logic in composables
- [ ] Modals use `useOverlay`
- [ ] Forms use Valibot
- [ ] TailwindCSS only
- [ ] German UI, English code
- [ ] No implicit `any`
- [ ] ESLint passes
