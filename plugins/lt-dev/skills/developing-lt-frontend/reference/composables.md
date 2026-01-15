# Composables

## Table of Contents

- [Naming & Location](#naming--location)
- [Structure](#structure)
- [Key Rules](#key-rules)
- [Stateless Composable](#stateless-composable)
- [Composable with Parameters](#composable-with-parameters)
- [Authentication Composable (Better Auth)](#authentication-composable-better-auth)
- [Anti-Patterns](#anti-patterns)

---

## Naming & Location

- File: `app/composables/use{Feature}.ts`
- Function: `export function use{Feature}()`

## Structure

```typescript
// app/composables/useSeasons.ts
import { ref, computed, readonly } from 'vue'
import type { SeasonDto, CreateSeasonDto } from '~/api-client/types.gen'
import { seasonControllerGet, seasonControllerCreate } from '~/api-client/sdk.gen'

export function useSeasons() {
  // ============================================================================
  // State
  // ============================================================================
  const seasons = ref<SeasonDto[]>([])
  const loading = ref<boolean>(false)
  const error = ref<string | null>(null)

  // ============================================================================
  // Computed
  // ============================================================================
  const activeSeasons = computed<SeasonDto[]>(() =>
    seasons.value.filter(s => s.status === 'active')
  )

  // ============================================================================
  // Methods
  // ============================================================================
  async function fetchAll(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const response = await seasonControllerGet()
      if (response.data) seasons.value = response.data
    } catch (e) {
      error.value = 'Fehler beim Laden'
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

  // ============================================================================
  // Return
  // ============================================================================
  return {
    // State (readonly)
    seasons: readonly(seasons),
    loading: readonly(loading),
    error: readonly(error),

    // Computed
    activeSeasons,

    // Methods
    create,
    fetchAll
  }
}
```

## Key Rules

| Rule | Example |
|------|---------|
| Return readonly state | `readonly(seasons)` |
| One composable per controller | `useSeasons`, `useTeams` |
| Use `ref` for primitives/arrays | `ref<SeasonDto[]>([])` |
| Use `reactive` for form state | `reactive<FormState>({})` |
| Explicit types | `ref<boolean>(false)` |

## Stateless Composable

For simple API wrappers without caching:

```typescript
export function useRequest() {
  const toast = useToast()

  async function getAll(): Promise<RequestDto[] | null> {
    try {
      const response = await requestControllerGet()
      return response.data ?? null
    } catch (e) {
      toast.add({ title: 'Fehler', color: 'error' })
      return null
    }
  }

  return { getAll }
}
```

## Composable with Parameters

```typescript
export function useSeasonTeams(seasonId: string) {
  const teams = ref<TeamDto[]>([])

  async function fetchTeams(): Promise<void> {
    const response = await seasonControllerGetTeams({ path: { id: seasonId } })
    if (response.data) teams.value = response.data
  }

  return { teams: readonly(teams), fetchTeams }
}

// Usage
const { teams, fetchTeams } = useSeasonTeams(route.params.id as string)
```

## Authentication Composable (Better Auth)

```typescript
// app/composables/use-better-auth.ts (pre-configured in nuxt-base-starter)
import { authClient } from '~/lib/auth-client'

export function useBetterAuth() {
  const session = authClient.useSession(useFetch)

  const user = computed(() => session.data.value?.user ?? null)
  const isAuthenticated = computed<boolean>(() => !!session.data.value?.session)
  const isAdmin = computed<boolean>(() => user.value?.role === 'admin')
  const is2FAEnabled = computed<boolean>(() => !!user.value?.twoFactorEnabled)
  const isLoading = computed<boolean>(() => session.isPending.value)

  return {
    // State
    session, user, isAuthenticated, isAdmin, is2FAEnabled, isLoading,
    // Methods (passwords auto-hashed via authClient wrapper)
    passkey: authClient.passkey,
    signIn: authClient.signIn,
    signOut: authClient.signOut,
    signUp: authClient.signUp,
    twoFactor: authClient.twoFactor,
  }
}
```

> **Full authentication details:** See [reference/authentication.md](./authentication.md)

## Anti-Patterns

```typescript
//  Don't expose mutable state
return { seasons } // Can be mutated externally

//  Return readonly
return { seasons: readonly(seasons) }

//  Don't forget types
const loading = ref(false)

//  Explicit types
const loading = ref<boolean>(false)

//  Don't mix concerns
export function useSeasons() {
  const modalOpen = ref(false) // UI logic doesn't belong here
}

//  Don't use authClient.useSession() without useFetch (SSR issues)
const session = authClient.useSession()

//  Pass useFetch for SSR support
const session = authClient.useSession(useFetch)
```
