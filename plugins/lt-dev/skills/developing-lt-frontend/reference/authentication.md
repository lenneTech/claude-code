# Authentication (Better Auth)

lenne.tech projects use [Better Auth](https://www.better-auth.com/) for authentication, integrated with the @lenne.tech/nest-server backend.

## Table of Contents

- [Preferred Authentication Methods](#preferred-authentication-methods)
- [Client Setup (nuxt-base-starter)](#client-setup-nuxt-base-starter)
- [Crypto Utility](#crypto-utility)
- [useBetterAuth Composable](#usebetterauth-composable)
- [Auth Middleware](#auth-middleware)
- [Basic Usage Examples](#basic-usage-examples)
- [Environment Configuration](#environment-configuration)
- [Pre-built Auth Pages (nuxt-base-starter)](#pre-built-auth-pages-nuxt-base-starter)
- [Key Patterns](#key-patterns)
- [Anti-Patterns](#anti-patterns)

---

## Preferred Authentication Methods

| Priority | Method | Description |
|----------|--------|-------------|
| 1. | **Passkey** | WebAuthn-based, passwordless (recommended) |
| 2. | **Email + Password + 2FA** | Traditional with TOTP second factor |

## Client Setup (nuxt-base-starter)

The auth client is pre-configured in `app/lib/auth-client.ts`:

```typescript
// app/lib/auth-client.ts
import { passkeyClient } from '@better-auth/passkey/client'
import { adminClient, twoFactorClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/vue'

import { sha256 } from '~/utils/crypto'

// =============================================================================
// Type Definitions
// =============================================================================

export interface AuthResponse {
  data?: null | {
    redirect?: boolean
    token?: null | string
    url?: string
    user?: {
      createdAt?: Date
      email?: string
      emailVerified?: boolean
      id?: string
      image?: string
      name?: string
      updatedAt?: Date
    }
  }
  error?: null | {
    code?: string
    message?: string
    status?: number
  }
}

// =============================================================================
// Base Client Configuration
// =============================================================================

const baseClient = createAuthClient({
  basePath: '/iam', // IMPORTANT: Must match nest-server betterAuth.basePath
  baseURL: import.meta.env?.VITE_API_URL || process.env.API_URL || 'http://localhost:3000',
  plugins: [
    adminClient(),
    twoFactorClient({
      onTwoFactorRedirect() {
        navigateTo('/auth/2fa')
      },
    }),
    passkeyClient(),
  ],
})

// =============================================================================
// Auth Client with Password Hashing
// =============================================================================

/**
 * Extended auth client that hashes passwords before transmission.
 *
 * SECURITY: Passwords are hashed with SHA256 client-side to prevent
 * plain text password transmission over the network.
 */
export const authClient = {
  ...baseClient,

  changePassword: async (params: { currentPassword: string; newPassword: string }, options?: any) => {
    const [hashedCurrent, hashedNew] = await Promise.all([
      sha256(params.currentPassword),
      sha256(params.newPassword)
    ])
    return baseClient.changePassword?.({ currentPassword: hashedCurrent, newPassword: hashedNew }, options)
  },

  resetPassword: async (params: { newPassword: string; token: string }, options?: any) => {
    const hashedPassword = await sha256(params.newPassword)
    return baseClient.resetPassword?.({ newPassword: hashedPassword, token: params.token }, options)
  },

  signIn: {
    ...baseClient.signIn,
    email: async (params: { email: string; password: string; rememberMe?: boolean }, options?: any) => {
      const hashedPassword = await sha256(params.password)
      return baseClient.signIn.email({ ...params, password: hashedPassword }, options)
    },
  },

  signOut: baseClient.signOut,

  signUp: {
    ...baseClient.signUp,
    email: async (params: { email: string; name: string; password: string }, options?: any) => {
      const hashedPassword = await sha256(params.password)
      return baseClient.signUp.email({ ...params, password: hashedPassword }, options)
    },
  },

  twoFactor: {
    ...baseClient.twoFactor,
    disable: async (params: { password: string }, options?: any) => {
      const hashedPassword = await sha256(params.password)
      return baseClient.twoFactor.disable({ password: hashedPassword }, options)
    },
    enable: async (params: { password: string }, options?: any) => {
      const hashedPassword = await sha256(params.password)
      return baseClient.twoFactor.enable({ password: hashedPassword }, options)
    },
  },
}

export type AuthClient = typeof authClient
```

## Crypto Utility

```typescript
// app/utils/crypto.ts
export async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}
```

## useBetterAuth Composable

```typescript
// app/composables/use-better-auth.ts
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
    session,
    user,
    isAuthenticated,
    isAdmin,
    is2FAEnabled,
    isLoading,

    // Methods (delegated from authClient)
    passkey: authClient.passkey,
    signIn: authClient.signIn,
    signOut: authClient.signOut,
    signUp: authClient.signUp,
    twoFactor: authClient.twoFactor,
  }
}
```

## Auth Middleware

```typescript
// middleware/auth.ts
export default defineNuxtRouteMiddleware(async (to) => {
  const { isAuthenticated } = useBetterAuth()

  if (!isAuthenticated.value) {
    return navigateTo('/auth/login')
  }
})

// middleware/guest.ts
export default defineNuxtRouteMiddleware(() => {
  const { isAuthenticated } = useBetterAuth()

  if (isAuthenticated.value) {
    return navigateTo('/dashboard')
  }
})

// middleware/admin.ts
export default defineNuxtRouteMiddleware(() => {
  const { isAuthenticated, isAdmin } = useBetterAuth()

  if (!isAuthenticated.value) {
    return navigateTo('/auth/login')
  }

  if (!isAdmin.value) {
    return navigateTo('/dashboard')
  }
})
```

## Basic Usage Examples

### Sign In

```typescript
const { signIn } = useBetterAuth()
const toast = useToast()

async function handleLogin(email: string, password: string) {
  const { error } = await signIn.email({
    email,
    password, // Auto-hashed via authClient
    rememberMe: true
  })

  if (error) {
    toast.add({ title: error.message, color: 'error' })
  }
  // 2FA redirect handled automatically by twoFactorClient
}
```

### Sign Up

```typescript
const { signUp } = useBetterAuth()

async function handleRegister(name: string, email: string, password: string) {
  const { error } = await signUp.email({
    name,
    email,
    password // Auto-hashed via authClient
  })

  if (!error) {
    // Optionally prompt for passkey setup
    await authClient.passkey.addPasskey()
  }
}
```

### Passkey Login

```typescript
const { signIn } = useBetterAuth()

async function handlePasskeyLogin() {
  const { error } = await signIn.passkey()
  if (!error) navigateTo('/app')
}
```

### 2FA Verification

```typescript
const { twoFactor } = useBetterAuth()

// TOTP code
await twoFactor.verifyTotp({
  code: '123456',
  trustDevice: true // Remember for 30 days
})

// Backup code (alternative)
await twoFactor.verifyBackupCode({ code: 'ABCD-1234' })
```

### Password Reset

```typescript
// Request reset email
await authClient.requestPasswordReset({
  email: 'user@example.com',
  redirectTo: '/auth/reset-password'
})

// Complete reset (with token from URL)
await authClient.resetPassword({
  newPassword: 'newSecurePassword', // Auto-hashed
  token: route.query.token as string
})
```

## Environment Configuration

```env
# .env
VITE_API_URL=http://localhost:3000
API_URL=http://localhost:3000
```

## Pre-built Auth Pages (nuxt-base-starter)

**These pages are already included in `npx create-nuxt-base` projects!**

| Page | Path | Features |
|------|------|----------|
| Login | `/auth/login` | Email/Password, Passkey, "Passwort vergessen" link |
| Register | `/auth/register` | Name/Email/Password + optional Passkey setup prompt |
| 2FA | `/auth/2fa` | TOTP code OR Backup code, "Gerät vertrauen" option |
| Forgot Password | `/auth/forgot-password` | Email input → Success message |
| Reset Password | `/auth/reset-password` | Token from URL, password confirmation |

### Page Structure

All auth pages use:
- **Layout:** `slim` (centered, minimal)
- **Components:** `UPageCard`, `UAuthForm` (Nuxt UI)
- **Validation:** Valibot with German error messages
- **Language:** German UI labels

### Login Page Features

```vue
<!-- Key features in pages/auth/login.vue -->
<script setup lang="ts">
definePageMeta({ layout: 'slim' })

// Two loading states
const loading = ref(false)        // Email/Password form
const passkeyLoading = ref(false) // Passkey button

// Passkey login
async function onPasskeyLogin() {
  passkeyLoading.value = true
  const { error } = await authClient.signIn.passkey()
  if (error) toast.add({ title: error.message, color: 'error' })
  else navigateTo('/app')
  passkeyLoading.value = false
}
</script>

<template>
  <UPageCard title="Anmelden" description="...">
    <UAuthForm :fields="fields" :schema="schema" @submit="onSubmit">
      <template #password-hint>
        <NuxtLink to="/auth/forgot-password">Passwort vergessen?</NuxtLink>
      </template>
    </UAuthForm>

    <template #footer>
      <UDivider label="oder" />
      <UButton @click="onPasskeyLogin" :loading="passkeyLoading">
        Mit Passkey anmelden
      </UButton>
      <p>Noch kein Konto? <NuxtLink to="/auth/register">Registrieren</NuxtLink></p>
    </template>
  </UPageCard>
</template>
```

### Register Page Features

```vue
<!-- Key features in pages/auth/register.vue -->
<script setup lang="ts">
// Two-stage UI: Registration → Passkey Setup
const showPasskeyPrompt = ref(false)

// After successful registration, offer passkey setup
async function onSubmit(event) {
  const { error } = await authClient.signUp.email({ ... })
  if (!error) {
    showPasskeyPrompt.value = true // Show passkey prompt
  }
}

// Optional passkey enrollment
async function addPasskey() {
  await authClient.passkey.addPasskey()
  navigateTo('/app')
}

function skipPasskey() {
  navigateTo('/app')
}
</script>

<template>
  <!-- Stage 1: Registration form -->
  <UPageCard v-if="!showPasskeyPrompt" title="Registrieren">
    <UAuthForm :fields="fields" :schema="schema" @submit="onSubmit" />
  </UPageCard>

  <!-- Stage 2: Passkey setup prompt -->
  <UPageCard v-else title="Passkey einrichten">
    <p>Möchtest du einen Passkey für schnellere Anmeldungen einrichten?</p>
    <UButton @click="addPasskey">Passkey hinzufügen</UButton>
    <UButton variant="ghost" @click="skipPasskey">Überspringen</UButton>
  </UPageCard>
</template>
```

### 2FA Page Features

```vue
<!-- Key features in pages/auth/2fa.vue -->
<script setup lang="ts">
const useBackupCode = ref(false) // Toggle TOTP vs Backup code
const trustDevice = ref(false)   // Remember device

async function onSubmit(event) {
  if (useBackupCode.value) {
    // Verify with backup code
    await authClient.twoFactor.verifyBackupCode({ code: event.data.code })
  } else {
    // Verify with TOTP
    await authClient.twoFactor.verifyTotp({
      code: event.data.code,
      trustDevice: trustDevice.value
    })
  }
}
</script>

<template>
  <UPageCard>
    <UIcon name="i-lucide-shield" class="size-12" />
    <h1>Zwei-Faktor-Authentifizierung</h1>

    <UAuthForm :schema="schema" @submit="onSubmit">
      <UInput class="font-mono tracking-widest" inputmode="numeric" />
    </UAuthForm>

    <UCheckbox v-if="!useBackupCode" v-model="trustDevice"
      label="Diesem Gerät 30 Tage vertrauen" />

    <UButton variant="link" @click="useBackupCode = !useBackupCode">
      {{ useBackupCode ? 'Code aus App verwenden' : 'Backup-Code verwenden' }}
    </UButton>
  </UPageCard>
</template>
```

### Password Reset Flow

```typescript
// forgot-password.vue: Request reset
await authClient.requestPasswordReset({
  email: state.email,
  redirectTo: '/auth/reset-password'
})

// reset-password.vue: Complete reset (token from URL)
const token = useRoute().query.token as string
await authClient.resetPassword({
  newPassword: state.password, // Auto-hashed
  token
})
```

## Key Patterns

| Pattern | Implementation |
|---------|----------------|
| Session access | `authClient.useSession(useFetch)` for SSR |
| Composable | `useBetterAuth()` (auto-imported) |
| Password security | Client-side SHA256 hashing before transmission |
| 2FA redirect | Automatic via `twoFactorClient({ onTwoFactorRedirect })` |
| Passkey autofill | `autocomplete="username webauthn"` |
| Protected routes | `definePageMeta({ middleware: 'auth' })` |
| Guest routes | `definePageMeta({ middleware: 'guest' })` |
| Admin routes | `definePageMeta({ middleware: 'admin' })` |
| Base path | `/iam` (must match nest-server config) |
| Auth layout | `definePageMeta({ layout: 'slim' })` |
| Auth forms | `UPageCard` + `UAuthForm` components |
| Post-register | Passkey setup prompt (optional) |
| 2FA fallback | Backup code support |

## Anti-Patterns

```typescript
//  Don't send plain passwords (handled automatically by authClient)
await baseClient.signIn.email({ password: 'plaintext' })

//  Use authClient which hashes automatically
await authClient.signIn.email({ password: 'plaintext' }) // Hashed to SHA256

//  Don't use authClient.useSession() without useFetch in SSR
const session = authClient.useSession() // Hydration mismatch!

//  Pass useFetch for SSR support
const session = authClient.useSession(useFetch)

//  Don't hardcode API URL
baseURL: 'http://localhost:3000'

//  Use environment variables
baseURL: import.meta.env?.VITE_API_URL || process.env.API_URL

//  Don't change basePath without updating nest-server
basePath: '/api/auth' // Won't work with nest-server default

//  Use /iam (nest-server default)
basePath: '/iam'
```
