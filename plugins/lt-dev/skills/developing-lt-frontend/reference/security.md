---
name: nuxt-vue-frontend-security
description: Comprehensive frontend security guide for Nuxt/Vue applications based on OWASP practices
---

# Frontend Security (Nuxt/Vue)

Comprehensive security guide based on OWASP practices, tailored for Nuxt 4 and Vue 3 applications.

---

## 1. XSS Prevention (Cross-Site Scripting)

### v-html Risks and Sanitization

```vue
<!-- ❌ DANGEROUS: Never use v-html with user input -->
<div v-html="userComment"></div>

<!-- ✅ SAFE: Use text interpolation (auto-escaped) -->
<div>{{ userComment }}</div>

<!-- ✅ SAFE: Sanitize before rendering -->
<script setup lang="ts">
import DOMPurify from 'dompurify'

const props = defineProps<{ rawHtml: string }>()
const safeHtml = computed(() => DOMPurify.sanitize(props.rawHtml, {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
  ALLOWED_ATTR: ['href'],
  ALLOWED_URI_REGEXP: /^https?:/
}))
</script>

<template>
  <div v-html="safeHtml"></div>
</template>
```

### Safe Attribute Binding

```vue
<script setup lang="ts">
const userProvidedUrl = ref('')

// Validate URLs before using
const safeUrl = computed(() => {
  try {
    const url = new URL(userProvidedUrl.value)
    if (!['https:', 'http:'].includes(url.protocol)) {
      return '#'  // Block javascript:, data:, etc.
    }
    return url.href
  } catch {
    return '#'
  }
})
</script>

<template>
  <!-- ❌ DANGEROUS: User-controlled href -->
  <a :href="userProvidedUrl">Link</a>

  <!-- ✅ SAFE: Validated URL -->
  <a :href="safeUrl">Link</a>
</template>
```

### Dynamic Component Security

```vue
<script setup lang="ts">
// ❌ DANGEROUS: User-controlled component name
const componentName = ref(userInput)

// ✅ SAFE: Allowlist of components
const ALLOWED_COMPONENTS = ['CardView', 'ListView', 'GridView'] as const
type AllowedComponent = typeof ALLOWED_COMPONENTS[number]

const selectedView = ref<AllowedComponent>('CardView')

function setView(name: string): void {
  if (ALLOWED_COMPONENTS.includes(name as AllowedComponent)) {
    selectedView.value = name as AllowedComponent
  }
}
</script>

<template>
  <component :is="selectedView" />
</template>
```

---

## 2. CSRF Protection (Cross-Site Request Forgery)

### SameSite Cookie Configuration

```typescript
// composables/useAuth.ts
export function useAuth() {
  async function login(credentials: LoginDto): Promise<void> {
    const response = await $fetch('/api/auth/login', {
      method: 'POST',
      body: credentials,
      credentials: 'include'  // Include cookies
    })

    // Server sets cookies with SameSite=Strict
    // Never store tokens in localStorage for sensitive apps
  }
}
```

### CSRF Token for State-Changing Operations

```typescript
// composables/useCsrf.ts
export function useCsrf() {
  const csrfToken = useCookie('XSRF-TOKEN')

  async function securePost<T>(url: string, body: unknown): Promise<T> {
    return await $fetch<T>(url, {
      method: 'POST',
      body,
      headers: {
        'X-XSRF-TOKEN': csrfToken.value || ''
      }
    })
  }

  return { securePost }
}
```

### Safe Form Submissions

```vue
<script setup lang="ts">
const { securePost } = useCsrf()

async function handleSubmit(data: FormData): Promise<void> {
  await securePost('/api/orders', data)
}
</script>
```

---

## 3. Authentication & Token Management

### Secure Token Storage

```typescript
// ❌ WRONG: localStorage is vulnerable to XSS
localStorage.setItem('accessToken', token)

// ✅ CORRECT: Use httpOnly cookies (set by server)
// Frontend never sees the token - server handles via cookies

// For SPAs requiring client-side tokens:
// composables/useAuth.ts
export function useAuth() {
  // Store in memory only (cleared on page refresh)
  const accessToken = useState<string | null>('auth-token', () => null)

  // Refresh token in httpOnly cookie (set by server)
  async function refreshAccessToken(): Promise<void> {
    const response = await $fetch<{ accessToken: string }>('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include'  // Send httpOnly refresh cookie
    })
    accessToken.value = response.accessToken
  }

  return { accessToken: readonly(accessToken), refreshAccessToken }
}
```

### Token Lifecycle Management

```typescript
// composables/useAuth.ts
export function useAuth() {
  const accessToken = useState<string | null>('auth-token', () => null)
  const tokenExpiresAt = useState<number | null>('auth-expires', () => null)

  // Check if token needs refresh (with buffer)
  const needsRefresh = computed(() => {
    if (!tokenExpiresAt.value) return true
    return Date.now() > tokenExpiresAt.value - 60_000  // 1 min buffer
  })

  // Setup automatic refresh
  function setupTokenRefresh(): void {
    const intervalId = setInterval(async () => {
      if (needsRefresh.value && accessToken.value) {
        await refreshAccessToken()
      }
    }, 30_000)  // Check every 30s

    onUnmounted(() => clearInterval(intervalId))
  }

  async function logout(): Promise<void> {
    await $fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include'
    })
    accessToken.value = null
    tokenExpiresAt.value = null
    navigateTo('/login')
  }

  return { accessToken, logout, setupTokenRefresh }
}
```

---

## 4. Input Validation (Frontend)

### Valibot Schema Validation

```typescript
// schemas/user.schema.ts
import { object, string, minLength, maxLength, email, pipe, regex } from 'valibot'

export const userFormSchema = object({
  name: pipe(
    string(),
    minLength(2, 'Name muss mindestens 2 Zeichen haben'),
    maxLength(100, 'Name darf maximal 100 Zeichen haben')
  ),
  email: pipe(
    string(),
    email('Ungültige E-Mail-Adresse')
  ),
  // Prevent script injection in text fields
  bio: pipe(
    string(),
    maxLength(500),
    regex(/^[^<>]*$/, 'Unerlaubte Zeichen')  // No HTML tags
  )
})
```

### File Upload Validation

```vue
<script setup lang="ts">
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf']
const MAX_SIZE = 5 * 1024 * 1024  // 5MB

function validateFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return 'Ungültiger Dateityp. Erlaubt: JPEG, PNG, PDF'
  }
  if (file.size > MAX_SIZE) {
    return 'Datei zu groß. Maximum: 5MB'
  }
  return null
}

async function handleFileUpload(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const error = validateFile(file)
  if (error) {
    toast.error(error)
    input.value = ''  // Clear input
    return
  }

  // Upload validated file
  const formData = new FormData()
  formData.append('file', file)
  await $fetch('/api/upload', { method: 'POST', body: formData })
}
</script>

<template>
  <input
    type="file"
    accept=".jpg,.jpeg,.png,.pdf"
    @change="handleFileUpload"
  />
</template>
```

### URL/Redirect Validation

```typescript
// utils/security.ts
const ALLOWED_HOSTS = ['example.com', 'app.example.com']

export function isValidRedirect(url: string): boolean {
  // Allow relative URLs
  if (url.startsWith('/') && !url.startsWith('//')) {
    return true
  }

  try {
    const parsed = new URL(url)
    return ALLOWED_HOSTS.includes(parsed.hostname) &&
           ['http:', 'https:'].includes(parsed.protocol)
  } catch {
    return false
  }
}

// Usage in route guard
export default defineNuxtRouteMiddleware((to) => {
  const redirect = to.query.redirect as string | undefined
  if (redirect && !isValidRedirect(redirect)) {
    return navigateTo('/')  // Ignore invalid redirect
  }
})
```

---

## 5. Sensitive Data Handling

### Environment Variables (Client vs Server)

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  runtimeConfig: {
    // Server-only secrets (never exposed to client)
    apiSecret: process.env.API_SECRET,
    dbUrl: process.env.DATABASE_URL,

    // Public config (exposed to client)
    public: {
      apiBaseUrl: process.env.NUXT_PUBLIC_API_URL,
      appName: 'My App'
      // Never put secrets here!
    }
  }
})
```

```vue
<script setup lang="ts">
const config = useRuntimeConfig()

// ✅ OK: Public config
const apiUrl = config.public.apiBaseUrl

// ❌ WRONG: Server config not available on client
// const secret = config.apiSecret  // undefined on client
</script>
```

### Password Field Security

```vue
<template>
  <UInput
    v-model="password"
    type="password"
    autocomplete="new-password"
    :ui="{ input: 'font-mono' }"
  />

  <!-- Toggle visibility -->
  <UInput
    v-model="password"
    :type="showPassword ? 'text' : 'password'"
    autocomplete="current-password"
  >
    <template #trailing>
      <UButton
        variant="ghost"
        :icon="showPassword ? 'i-heroicons-eye-slash' : 'i-heroicons-eye'"
        @click="showPassword = !showPassword"
      />
    </template>
  </UInput>
</template>
```

### No Sensitive Data in Client State

```typescript
// ❌ WRONG: Storing sensitive data in client state
const user = useState('user', () => ({
  id: '123',
  email: 'user@example.com',
  ssn: '123-45-6789',  // Never store SSN in client!
  creditCard: '4111...'  // Never store card numbers!
}))

// ✅ CORRECT: Only necessary data
const user = useState('user', () => ({
  id: '123',
  email: 'user@example.com',
  displayName: 'John Doe'
}))
// Fetch sensitive data on-demand, display, don't store
```

---

## 6. Secure API Communication

### HTTPS Enforcement

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  runtimeConfig: {
    public: {
      // Always use HTTPS in production
      apiBaseUrl: process.env.NODE_ENV === 'production'
        ? 'https://api.example.com'
        : 'http://localhost:3000'
    }
  }
})

// middleware/https.global.ts
export default defineNuxtRouteMiddleware(() => {
  if (import.meta.client && process.env.NODE_ENV === 'production') {
    if (window.location.protocol !== 'https:') {
      window.location.href = window.location.href.replace('http:', 'https:')
    }
  }
})
```

### Authorization Header Handling

```typescript
// plugins/api.ts
export default defineNuxtPlugin(() => {
  const { accessToken } = useAuth()

  const api = $fetch.create({
    baseURL: useRuntimeConfig().public.apiBaseUrl,
    onRequest({ options }) {
      if (accessToken.value) {
        options.headers = {
          ...options.headers,
          Authorization: `Bearer ${accessToken.value}`
        }
      }
    },
    onResponseError({ response }) {
      if (response.status === 401) {
        // Token expired, redirect to login
        navigateTo('/login')
      }
    }
  })

  return { provide: { api } }
})
```

### Error Response Handling

```typescript
// composables/useApi.ts
export function useApi() {
  async function safeRequest<T>(request: () => Promise<T>): Promise<T | null> {
    try {
      return await request()
    } catch (error: unknown) {
      if (error instanceof FetchError) {
        // Never expose raw server errors to users
        const message = getHumanReadableError(error.statusCode)
        toast.error(message)

        // Log for debugging (but not in production console)
        if (process.env.NODE_ENV !== 'production') {
          console.error('API Error:', error)
        }
      }
      return null
    }
  }

  return { safeRequest }
}

function getHumanReadableError(status?: number): string {
  switch (status) {
    case 400: return 'Ungültige Anfrage'
    case 401: return 'Bitte melden Sie sich an'
    case 403: return 'Zugriff verweigert'
    case 404: return 'Nicht gefunden'
    case 429: return 'Zu viele Anfragen. Bitte warten.'
    default: return 'Ein Fehler ist aufgetreten'
  }
}
```

---

## 7. Content Security Policy (CSP)

### Nuxt Security Module

```bash
npm install nuxt-security
```

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['nuxt-security'],

  security: {
    headers: {
      contentSecurityPolicy: {
        'default-src': ["'self'"],
        'script-src': ["'self'", "'strict-dynamic'"],
        'style-src': ["'self'", "'unsafe-inline'"],  // Required for Tailwind
        'img-src': ["'self'", 'data:', 'https:'],
        'font-src': ["'self'"],
        'connect-src': ["'self'", 'https://api.example.com'],
        'frame-ancestors': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"]
      },
      xContentTypeOptions: 'nosniff',
      xFrameOptions: 'DENY',
      referrerPolicy: 'strict-origin-when-cross-origin'
    },
    // Rate limiting for API routes
    rateLimiter: {
      tokensPerInterval: 100,
      interval: 60000  // 100 requests per minute
    }
  }
})
```

### Nonce-based Inline Scripts

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  security: {
    nonce: true,  // Auto-generate nonce for inline scripts
    headers: {
      contentSecurityPolicy: {
        'script-src': ["'self'", "'nonce-{{nonce}}'"]
      }
    }
  }
})
```

```vue
<script setup lang="ts">
// useNonce() available when nonce is enabled
const nonce = useNonce()
</script>

<template>
  <!-- Nonce automatically added to Nuxt-managed scripts -->
  <script :nonce="nonce">
    // Inline script with nonce
  </script>
</template>
```

---

## 8. SSR Security (Nuxt-specific)

### Prevent Server-Side Data Leakage

```typescript
// ❌ WRONG: Exposing server data in SSR
// server/api/user.ts
export default defineEventHandler(async (event) => {
  const user = await getUserFromDb(event)
  return user  // May include password hash, internal IDs!
})

// ✅ CORRECT: Transform before sending
export default defineEventHandler(async (event) => {
  const user = await getUserFromDb(event)
  return {
    id: user.id,
    name: user.name,
    email: user.email
    // Explicitly list safe fields
  }
})
```

### Cookie Handling in SSR

```typescript
// composables/useAuth.ts
export function useAuth() {
  // Works on both server and client
  const token = useCookie('auth-token', {
    httpOnly: true,  // Only server can read
    secure: true,
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 7  // 7 days
  })

  // Server-side auth check
  async function getUser(): Promise<UserDto | null> {
    if (!token.value) return null

    // On server: validate token directly
    // On client: call API endpoint
    if (import.meta.server) {
      return await validateTokenServer(token.value)
    } else {
      return await $fetch('/api/auth/me')
    }
  }
}
```

### Environment Isolation

```typescript
// composables/useSecrets.ts
export function useServerSecret(key: string): string {
  if (import.meta.client) {
    throw new Error('Server secrets cannot be accessed on client')
  }
  const config = useRuntimeConfig()
  return config[key] as string
}

// Usage in server routes only
// server/api/external.ts
export default defineEventHandler(async () => {
  const apiKey = useRuntimeConfig().externalApiKey
  // Safe: server-only execution
})
```

---

## 9. Component Security

### Props Validation

```vue
<script setup lang="ts">
// Always define prop types explicitly
interface Props {
  userId: string
  title: string
  maxLength?: number
}

const props = withDefaults(defineProps<Props>(), {
  maxLength: 100
})

// Validate at runtime for external data
const sanitizedTitle = computed(() => {
  if (typeof props.title !== 'string') return ''
  return props.title.slice(0, props.maxLength)
})
</script>
```

### Event Handler Security

```vue
<script setup lang="ts">
const emit = defineEmits<{
  update: [value: string]
  delete: [id: string]
}>()

// Validate before emitting
function handleUpdate(value: unknown): void {
  if (typeof value !== 'string') return
  if (value.length > 1000) return  // Prevent massive payloads
  emit('update', value)
}
</script>
```

### Slot Content Safety

```vue
<script setup lang="ts">
// Parent component with slots
</script>

<template>
  <div class="card">
    <!-- Slot content is rendered as-is -->
    <!-- Ensure parent sanitizes any user content before passing -->
    <slot name="content">
      <p>Default safe content</p>
    </slot>
  </div>
</template>

<!-- Usage - Parent must sanitize -->
<MyCard>
  <template #content>
    <!-- ❌ DANGEROUS -->
    <div v-html="userContent"></div>

    <!-- ✅ SAFE -->
    <div>{{ userContent }}</div>
  </template>
</MyCard>
```

---

## 10. Third-Party Dependencies

### NPM Audit

```bash
# Check for vulnerabilities
npm audit

# Fix automatically where possible
npm audit fix

# Check specific package
npm audit --package-lock-only

# In CI/CD pipeline
npm audit --audit-level=high || exit 1
```

### Subresource Integrity (SRI)

```html
<!-- For external CDN resources, always use SRI -->
<script
  src="https://cdn.example.com/lib.js"
  integrity="sha384-abc123..."
  crossorigin="anonymous"
></script>
```

### Dependency Lock

```typescript
// package.json - Use exact versions for security
{
  "dependencies": {
    "vue": "3.4.15",  // Exact version
    "nuxt": "~3.10.0"  // Patch updates only
  }
}

// Always commit package-lock.json
// Review dependency updates before merging
```

---

## Security Checklist

### Before Deployment

**XSS Prevention:**
- [ ] No v-html with user content (or DOMPurify sanitized)
- [ ] User input escaped in templates
- [ ] URLs validated before use in hrefs
- [ ] Dynamic components use allowlist

**Authentication:**
- [ ] Tokens in httpOnly cookies or memory (not localStorage)
- [ ] Automatic token refresh implemented
- [ ] Logout clears all client state
- [ ] Session timeout configured

**Input Validation:**
- [ ] All forms use Valibot schemas
- [ ] File uploads validated (type, size)
- [ ] Redirect URLs validated against allowlist

**API Security:**
- [ ] HTTPS enforced in production
- [ ] Authorization headers properly set
- [ ] Error messages don't leak internals
- [ ] Rate limiting awareness in UI

**CSP & Headers:**
- [ ] nuxt-security module configured
- [ ] CSP headers appropriate for app
- [ ] X-Frame-Options: DENY
- [ ] X-Content-Type-Options: nosniff

**SSR Security:**
- [ ] No server secrets exposed to client
- [ ] Sensitive data transformed before SSR
- [ ] Cookies configured with security flags

**Dependencies:**
- [ ] npm audit clean (or known issues accepted)
- [ ] package-lock.json committed
- [ ] No deprecated packages with known vulnerabilities
