# API Integration

## Generated Files (REQUIRED)

**NEVER create custom interfaces for backend DTOs!**

| File | Purpose |
|------|---------|
| `~/api-client/types.gen.ts` | All backend DTOs (REQUIRED) |
| `~/api-client/sdk.gen.ts` | All API functions (REQUIRED) |

### Generating Types

**Prerequisites:** Backend API must be running!

```bash
# 1. Start API first (in monorepo)
cd projects/api && npm run start:dev

# 2. Wait for API to be ready (check http://localhost:3000/api)

# 3. Generate types
npm run generate-types
```

### When to Regenerate

- After adding/modifying backend DTOs
- After adding/modifying controllers
- After changing API endpoints
- When `types.gen.ts` is missing or outdated

**NEVER create manual DTOs as a workaround!**

## Basic Usage

```typescript
import type { SeasonDto, CreateSeasonDto } from '~/api-client/types.gen'
import { seasonControllerGet, seasonControllerCreate } from '~/api-client/sdk.gen'

// GET all
const response = await seasonControllerGet()
const seasons: SeasonDto[] = response.data ?? []

// GET by ID
const response = await seasonControllerGetById({ path: { id: '123' } })
const season: SeasonDto | null = response.data ?? null

// POST
const response = await seasonControllerCreate({ body: createDto })
const created: SeasonDto | null = response.data ?? null

// PUT
const response = await seasonControllerUpdate({
  path: { id: '123' },
  body: updateDto
})

// DELETE
await seasonControllerDelete({ path: { id: '123' } })
```

## Composable Pattern

One composable per backend controller:

```typescript
// app/composables/useSeasons.ts
import { ref, readonly } from 'vue'
import type { SeasonDto, CreateSeasonDto } from '~/api-client/types.gen'
import { seasonControllerGet, seasonControllerCreate } from '~/api-client/sdk.gen'

export function useSeasons() {
  const seasons = ref<SeasonDto[]>([])
  const loading = ref<boolean>(false)

  async function fetchAll(): Promise<void> {
    loading.value = true
    try {
      const response = await seasonControllerGet()
      if (response.data) seasons.value = response.data
    } finally {
      loading.value = false
    }
  }

  async function create(data: CreateSeasonDto): Promise<SeasonDto | null> {
    loading.value = true
    try {
      const response = await seasonControllerCreate({ body: data })
      if (response.data) {
        seasons.value.push(response.data)
        return response.data
      }
      return null
    } finally {
      loading.value = false
    }
  }

  return {
    seasons: readonly(seasons),
    loading: readonly(loading),
    create,
    fetchAll
  }
}
```

## Error Handling

```typescript
async function fetchSeasons(): Promise<void> {
  loading.value = true
  error.value = null

  try {
    const response = await seasonControllerGet()
    if (response.data) seasons.value = response.data
  } catch (e) {
    error.value = 'Fehler beim Laden'
    console.error('Fetch failed:', e)
  } finally {
    loading.value = false
  }
}
```

## With Toast Notifications

```typescript
const toast = useToast()

async function create(data: CreateSeasonDto): Promise<SeasonDto | null> {
  try {
    const response = await seasonControllerCreate({ body: data })
    if (response.data) {
      toast.add({ title: 'Erfolgreich erstellt', color: 'success' })
      return response.data
    }
    return null
  } catch (e) {
    toast.add({ title: 'Fehler beim Erstellen', color: 'error' })
    return null
  }
}
```
