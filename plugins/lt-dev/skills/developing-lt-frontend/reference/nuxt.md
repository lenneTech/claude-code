# Nuxt 4 Patterns

## State Management

### useState vs ref

```typescript
//  useState - SSR-safe, shared across components
const user = useState<UserDto | null>('user', () => null)

//  ref - local component state only
const loading = ref<boolean>(false)

//  ref for shared state - not SSR-safe, creates new instance
const user = ref<UserDto | null>(null)
```

| Use Case | Solution |
|----------|----------|
| Shared across components | `useState('key', () => initial)` |
| Local component state | `ref<Type>(initial)` |
| Form state | `reactive<Schema>({})` |

## Data Fetching

### useFetch (for API calls)

```typescript
// Basic
const { data, error, pending } = await useFetch<UserDto[]>('/api/users')

// With reactive params (auto-refetch)
const page = ref<number>(1)
const { data } = await useFetch('/api/users', {
  query: { page }
})

// Client-only
const { data } = await useFetch('/api/preferences', {
  server: false
})

// Lazy loading
const { data } = await useLazyFetch('/api/heavy-data')
```

### useAsyncData (for custom logic)

```typescript
// Multiple sources
const { data } = await useAsyncData('dashboard', async () => {
  const [users, stats] = await Promise.all([
    $fetch('/api/users'),
    $fetch('/api/stats')
  ])
  return { users, stats }
})
```

## Performance

### Lazy Components

```vue
<template>
  <!-- Lazy load with Lazy prefix -->
  <LazyHeavyChart v-if="showChart" />

  <!-- Client-only rendering -->
  <ClientOnly>
    <HeavyEditor />
    <template #fallback>
      <USkeleton class="h-64" />
    </template>
  </ClientOnly>
</template>
```

### Image Optimization

```vue
<template>
  <NuxtImg
    src="/hero.jpg"
    width="800"
    height="600"
    format="webp"
    loading="lazy"
  />
</template>
```

## Route Middleware

```typescript
// middleware/auth.ts (uses useBetterAuth - see reference/authentication.md)
export default defineNuxtRouteMiddleware(async () => {
  const { isAuthenticated } = useBetterAuth()

  if (!isAuthenticated.value) {
    return navigateTo('/auth/login')
  }
})

// middleware/guest.ts (redirect authenticated users)
export default defineNuxtRouteMiddleware(() => {
  const { isAuthenticated } = useBetterAuth()
  if (isAuthenticated.value) return navigateTo('/dashboard')
})

// middleware/admin.ts (admin-only routes)
export default defineNuxtRouteMiddleware(() => {
  const { isAuthenticated, isAdmin } = useBetterAuth()
  if (!isAuthenticated.value) return navigateTo('/auth/login')
  if (!isAdmin.value) return navigateTo('/dashboard')
})

// Usage in page
definePageMeta({
  middleware: 'auth' // or 'guest' or 'admin'
})
```

> **Full authentication details:** See [reference/authentication.md](./authentication.md)
> **Note:** 2FA redirect is handled automatically via `twoFactorClient` plugin

## Runtime Config

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  runtimeConfig: {
    apiSecret: '', // Server-only (from NUXT_API_SECRET)
    public: {
      apiBase: '' // Client + Server (from NUXT_PUBLIC_API_BASE)
    }
  }
})

// Usage
const config = useRuntimeConfig()
config.apiSecret      // Server only
config.public.apiBase // Everywhere
```

## SEO

```typescript
// In page or composable
useSeoMeta({
  title: 'Dashboard',
  description: 'User dashboard',
  ogImage: '/og-dashboard.png'
})

// Or with useHead
useHead({
  title: 'Dashboard',
  meta: [
    { name: 'description', content: 'User dashboard' }
  ]
})
```

## Anti-Patterns

```typescript
//  Using ref for shared state
const user = ref(null)

//  Use useState
const user = useState('user', () => null)

//  Direct process.env access
const key = process.env.API_KEY

//  Use runtimeConfig
const config = useRuntimeConfig()
const key = config.apiSecret

//  fetch() in components
const data = await fetch('/api/users')

//  Use useFetch or $fetch
const { data } = await useFetch('/api/users')
```
