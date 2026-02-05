# Core Patterns

## API Calls (via generated SDK)

```typescript
import type { SeasonDto } from '~/api-client/types.gen'
import { seasonControllerGet } from '~/api-client/sdk.gen'

const response = await seasonControllerGet()
const seasons: SeasonDto[] = response.data ?? []
```

## Composables (one per controller)

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

## Shared State (useState)

```typescript
// For state shared across components (SSR-safe)
export function useSettings() {
  const theme = useState<'light' | 'dark'>('app-theme', () => 'light')
  return { theme }
}
```

## Authentication (Better Auth)

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

## Programmatic Modals

```typescript
const overlay = useOverlay()

overlay.open(ModalCreate, {
  props: { title: 'Neu' },
  onClose: (result) => { if (result) refreshData() }
})
```

## Valibot Forms (not Zod)

```typescript
import { object, pipe, string, minLength } from 'valibot'
import type { InferOutput } from 'valibot'

const schema = object({
  title: pipe(string(), minLength(3, 'Mindestens 3 Zeichen'))
})
type Schema = InferOutput<typeof schema>
const state = reactive<Schema>({ title: '' })
```

## TypeScript Conventions

### Options Object Pattern for Optional Parameters

**Always use an options object for optional parameters instead of positional parameters:**

```typescript
// ❌ WRONG: Positional optional parameters
function fetchProducts(
  categoryId: string,
  limit?: number,
  offset?: number,
  sortBy?: string
) {}

// Problematic - must fill previous params with null
fetchProducts('cat-1', null, null, 'name');
```

```typescript
// ✅ CORRECT: Options object pattern
function fetchProducts(
  categoryId: string,
  options?: {
    limit?: number;
    offset?: number;
    sortBy?: string;
  }
) {}

// Clean - only set what you need
fetchProducts('cat-1', { sortBy: 'name' });
```

**Convention:** First parameter is the main required value, second parameter is the options object.
