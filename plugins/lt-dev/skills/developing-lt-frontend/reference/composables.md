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

## AI Assistant Composables (`useLtAi*`, 1.7.0+)

`@lenne.tech/nuxt-extensions` 1.7.0 ships seven auto-imported composables that wrap the `@lenne.tech/nest-server` AI module (REST + SSE). All traffic goes through the existing `ltAuthFetch` (Cookie/JWT dual mode), so they inherit the rest of the library's auth/URL semantics.

| Composable | Purpose |
|------------|---------|
| `useLtAi()` | One-shot `prompt(input)` + streaming `promptStream(input, handlers)` (POST `/ai/stream`) |
| `useLtAiChat()` | Multi-turn chat: streaming, budget, `conversationId`, confirmation gate, `stop()`/`clear()`, optional `maxMessages` cap, auto-stop on component unmount via `onScopeDispose` |
| `useLtAiConnections()` | User self-service: available connections + `select()` (`selected` / `locked`) |
| `useLtAiUsage()` | Token usage breakdown per user / tenant (`GET /ai/usage`) |
| `useLtAiPrompts()` | User-facing CRUD for re-usable prompt snippets ("Vorlagen", `scope: 'user'` / `'tenant'`) |
| `useLtAiPlaceholders()` | Loads the backend's `{{placeholder}}` registry — drives dynamic editor sidebars |
| `useLtAiAdmin()` | Admin CRUD (server-gated): connections, preferences, budget limits, slots, prompt hints, interactions |

### Activation

Module option in `nuxt.config.ts` (default `enabled: true`):

```typescript
ltExtensions: {
  ai: { enabled: true, basePath: '/ai' },  // basePath must match nest-server AI controller
}
```

### Two Type Names That Look Identical — DO NOT CONFLATE

| Type | Used by | Shape |
|------|---------|-------|
| `LtAiPromptInput` | `useLtAiPrompts().create/update` | CRUD input for the `LtAiPrompt` entity (`name`, `content`, `scope`, …) |
| `LtAiPromptRunInput` | `useLtAi().prompt()` / `.promptStream()` | Execution payload (required `prompt: string`, optional `conversationId`, `context`, `metadata`, `mode`, `requireConfirmation`) |

Pre-1.7.0 both were called `LtAiPromptInput` and TypeScript silently merged them — `prompt: string` became required on the CRUD input, breaking `useLtAiPrompts().create({...})`. The rename resolved that.

### Chat — the canonical pattern

```vue
<script setup lang="ts">
const {
  budget,
  clear,
  confirm,
  contextWindow,
  conversationId,
  error,
  messages,
  requiresConfirmation,
  send,
  stop,
  streaming,
} = useLtAiChat({
  maxMessages: 200,           // optional cap — prevents unbounded memory growth on long sessions
  // connectionId: ref<string | undefined>(undefined),
  // stream: true,             // default
});

// Stop a streaming turn (clean — does NOT mark the assistant turn as error):
function handleStopClick(): void {
  stop();
}
</script>

<template>
  <div v-for="(message, i) in messages" :key="i">
    <!-- messages is Readonly<Ref> (shallow), bind individual messages to child components freely -->
    <ChatBubble :message="message" />
  </div>
</template>
```

### Critical Gotchas

| Gotcha | Why it matters |
|--------|----------------|
| `useLtAiChat().stop()` is the ONLY way to abort a turn | The composable owns the `AbortController`; raw `AbortController.abort()` on a parallel signal bypasses cleanup and may double-trigger error UI |
| `AbortError` is a clean stop | The composable detects `err.name === 'AbortError'` and keeps streamed content, does NOT set `error: true`. Don't write code that flips `error` based on `(err as Error).message` matching `/abort/i`. |
| `applyFinal` runs exactly once per turn | The internal mutation that finalizes an assistant message must NOT be triggered from consumer code. If you patch `useLtAiChat` and add another callback path, ensure idempotency. |
| `messages` is `Readonly<Ref<LtAiMessage[]>>` (shallow) | Re-assigning is forbidden, but binding individual entries to child component `props` is allowed and expected |
| SSE consumed via `fetch + ReadableStream` (NOT `EventSource`) | The endpoint is `POST` with auth headers — `EventSource` doesn't support either. Don't try to "modernize" to `EventSource`. |
| Buffer cap = 1 MiB per SSE line | A malformed proxy that never emits `\n` throws `"AI stream line exceeds maximum allowed size"`. Don't catch and swallow it — surface to ops. |

### Performance Pitfalls

| Pitfall | Why it bites | Fix |
|---------|-------------|-----|
| **O(n·m) scroll-watcher source** — `watch(() => messages.value.map((m) => m.content).join('|'), …)` | Allocates a fresh array AND a `\|`-joined string on EVERY SSE token. For 20 messages × 500 tokens each, every additional token = ~10 000-character string allocation just to detect a change. Quadratic memory/CPU under streaming — the slowdown is invisible early but compounds during long replies / long sessions. Shipped in nuxt-base-starter ≤ 2.7.x and fixed in 2.8.0. | Watch only the length + the tail content — O(1) per token: `watch(() => [messages.value.length, messages.value.at(-1)?.content], …)`. Alternatively watch `streaming` and `requestAnimationFrame`-throttle the scroll. |
| **Unbounded `messages` ref** — instantiating `useLtAiChat()` without `maxMessages` | `useLtAiChat` supports the cap; if you don't pass it, a long-lived chat tab grows the array forever — each message keeps its `actions` array, `pendingActions`, and the full streamed `content` string. Slow leak in dashboards / kiosks. | Pass `useLtAiChat({ maxMessages: 100 })` (or a project-appropriate cap). nuxt-base-starter 2.8.0 ships 100 as the default. |
| **SSR on authenticated AI pages** — leaving the default `ssr: true` on `/app/ai`, `/app/admin/ai/*`, `/app/settings/ai*` | These pages load all data client-side via composables in `onMounted`. SSR renders an empty skeleton, ships it, and the client immediately blanks it for the real fetch — wasted server CPU and zero UX win. | `definePageMeta({ ssr: false })` per page. nuxt-base-starter 2.8.0 ships this on all 9 AI pages. |
| **No de-dup on `useLtAiPrompts().load()` across mounts** | Each composable instance owns its own `ref([])`. Navigating settings → chat → settings re-fetches `/ai/prompts` every time. Workable for small lists (< 50 prompts/user); doubles backend load on large lists. | Wrap the list in `useState('lt-ai-prompts', () => ref([]))` so all consumers share one cache, then invalidate-on-mutation. |

### Admin-only Composable

`useLtAiAdmin()` is auto-imported for ALL signed-in users. Backend enforces `@Restricted(ADMIN)` on every endpoint, so a non-admin caller receives 401/403. For UX, hide the admin UI behind a frontend route guard — but never trust the frontend role check alone.

## Authentication Composable (Better Auth)

```typescript
// app/composables/use-better-auth.ts (pre-configured in nuxt-base-starter)
import { authClient } from '~/lib/auth-client'

export function useBetterAuth() {
  const session = authClient.useSession(useFetch)

  const user = computed(() => session.data.value?.user ?? null)
  const isAuthenticated = computed<boolean>(() => !!session.data.value?.session)
  // Dual-shape admin check — see `app/utils/is-admin-user.ts` in the
  // nuxt-base-starter (≥ 2.8.0). Accepts `roles: string[]` (nest-server) AND
  // `role: string` (Better-Auth standalone). Inline body if you can't import:
  //   !!u?.roles?.includes('admin') || u?.role === 'admin'
  const isAdmin = computed<boolean>(() => isAdminUser(user.value))
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
