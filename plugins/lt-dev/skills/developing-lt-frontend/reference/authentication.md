# Authentication (Better Auth)

lenne.tech projects use [Better Auth](https://www.better-auth.com/) for authentication, integrated with the @lenne.tech/nest-server backend.

## Table of Contents

- [Preferred Authentication Methods](#preferred-authentication-methods)
- [Password handling: never roll your own](#password-handling-never-roll-your-own)
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

## Password handling: never roll your own

**The client-side hashing lives in `@lenne.tech/nuxt-extensions`. Project code must not
re-implement it, and must not call the auth endpoints past it.**

Every password-carrying method of the lt auth client SHA256-hashes the value before it
leaves the browser (`ltSha256`). That is not a substitute for TLS — it keeps the plaintext
out of proxies, logs and error reporters that record request bodies. The server accepts
both shapes and normalizes them, so the hashing has to be either everywhere or nowhere for
a given account.

Use the composable. It covers the whole flow:

```typescript
const {
  signIn, signUp, signOut,
  changePassword,
  requestPasswordReset, resetPassword,   // since nuxt-extensions 1.16.0
  twoFactor, passkey,
} = useLtAuth();

await signIn.email({ email, password });                  // hashed for you
await changePassword({ currentPassword, newPassword });   // both hashed
await resetPassword({ newPassword, token });              // hashed
```

### Why this rule exists

A project built its own reset page with a private `hashPassword()` helper and a bare
`fetch`, because the composable exposed `changePassword` but not the reset pair. It worked
— until it met a server-side guard that skipped the credential sync for an already-hashed
password. The user was told the reset succeeded and could then only sign in with the OLD
password. Fixed in nest-server 11.38.0; the gap in the composable is what created the
workaround in the first place.

**Anti-pattern:**

```typescript
// WRONG — a private hashing helper next to a raw fetch
import { hashPassword } from '~/utils/hash-password';
await fetch(`${apiBase}/users/password/reset`, {
  body: JSON.stringify({ password: await hashPassword(pw), token }),
  method: 'POST',
});
```

### `redirectTo` must be an ABSOLUTE app URL

`requestPasswordReset` is the one place where a missing value fails silently. Better Auth
resolves `redirectTo` against its own base URL — the **API** origin — so in a split
app/API deployment a relative value lands on the API host, where the route does not exist:
**403, no mail sent, and nothing visible in the browser.**

```typescript
// CORRECT — appUrl() throws rather than return something relative
await requestPasswordReset({
  email,
  redirectTo: appUrl('/auth/reset-password', config.public.siteUrl),
});

// WRONG — yields the literal "undefined/auth/reset-password" when siteUrl is unset
redirectTo: `${config.public.siteUrl}/auth/reset-password`,
```

The library cannot compute this for you: the app origin is project knowledge
(`NUXT_PUBLIC_SITE_URL`), and Nitro's `destr()` means the value is not even reliably a
string at the boundary. The app origin must also appear in the backend's `trustedOrigins`
**without a wildcard** — the redirect carries a live single-use token.

### Reaching past the composable

`useLtAuthClient()` is still there for surfaces the composable has not wrapped. When you
use it, forward the caller's parameters whole — never rebuild the payload from named
fields, or options like `redirectTo` and `revokeOtherSessions` disappear silently. The
library's own wrappers are pinned to that rule by
`test/auth-client-param-forwarding.test.ts`.


## useBetterAuth Composable

```typescript
// app/composables/use-better-auth.ts
import { authClient } from '~/lib/auth-client'

export function useBetterAuth() {
  const session = authClient.useSession(useFetch)

  const user = computed(() => session.data.value?.user ?? null)
  const isAuthenticated = computed<boolean>(() => !!session.data.value?.session)
  // Dual-shape admin check — nest-server projects use `roles: string[]`
  // (the `users` collection field), Better-Auth standalone setups use
  // `role: string`. Accept either via the canonical helper.
  // nuxt-base-starter ≥ 2.8.0 ships this as `app/utils/is-admin-user.ts`
  // (auto-imported). For ad-hoc inline use, the body is:
  //   !!user?.roles?.includes('admin') || user?.role === 'admin'
  const isAdmin = computed<boolean>(() => isAdminUser(user.value))
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

**These pages are already included in `pnpm dlx create-nuxt-base` projects!**

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

## Security Considerations

For comprehensive frontend security guidelines, see [security.md](./security.md).

**Key security aspects already implemented:**

| Aspect | Implementation |
|--------|----------------|
| Password transmission | SHA256 hashed client-side before sending |
| Session management | httpOnly cookies via Better Auth |
| 2FA | TOTP support with device trust option |
| Passwordless | Passkey/WebAuthn support (recommended) |

**Additional recommendations:**
- Never store tokens in `localStorage` (XSS vulnerable)
- Use `httpOnly` cookies for refresh tokens
- Implement session timeout for sensitive applications
- Clear all client state on logout

### Form-submit race hardening (capture-phase preventDefault)

**Problem.** `<UAuthForm>` (Nuxt UI Pro) attaches its `event.preventDefault()` inside its bubble-phase submit handler — and that handler is only bound during per-component hydration. Between page-paint and hydration-complete there is a window in which a synthetic submit (Playwright, Chrome-DevTools-MCP, or a fast human pressing Enter) triggers the browser's native form GET. With method `GET` the typed password ends up in the URL: `/auth/login?email=…&password=…`. The leak is observable in automation and theoretically reachable by real users on slow devices.

**Fix.** Attach a capture-phase listener in `onMounted` that only calls `preventDefault`. Capture-phase fires BEFORE bubble, so the native submit is killed even while the bubble handler is not yet bound. Once Vue's bubble handler is alive it runs as before and performs the real sign-in. Purely additive — for an already-hydrated form it duplicates the preventDefault that was about to happen anyway.

```typescript
// app/pages/auth/login.vue
onMounted(() => {
  const form = formContainer.value?.querySelector('form');
  form?.addEventListener('submit', (e) => e.preventDefault(), { capture: true });
});
```

**Tests.** nuxt-base-starter ≥ 2.8.0 ships:
- `tests/e2e/auth-form-hardening.spec.ts` — regression guard, asserts no `password=` in URL AND still on `/auth/login` after a synthetic submit (positive assertion catches navigation crashes too).
- `tests/e2e/helpers/safe-form-submit.ts` — `page.evaluate(safeFormSubmit, { delayMs: 50 })` reproduces the race deterministically via `form.requestSubmit()` (instead of `press('Enter') + waitForTimeout(50)`, which is timing-fragile on CI).

**Apply to every `<UAuthForm>` page.** Login + Register are the obvious candidates; any future auth-related form (password-reset, MFA enrollment, magic-link request) needs the same listener. The capture-phase technique is also applicable to any other form where the browser's native action would leak data — but for non-auth forms a `method="POST"` form is usually the cleaner fix.

---

## Auth Cookie Rules (lt-auth-state)

**WARNING:** Projects using `useLtAuth()` from `@lenne.tech/nuxt-extensions` must never manually write to the `lt-auth-state` cookie from custom middleware. Writing to `authState.value` in SSR generates a `Set-Cookie` header that can overwrite the browser's cookie.

- Use `useLtAuth().setUser()` / `clearUser()` for all cookie mutations
- In custom middleware, read `lt-auth-state` only (via `document.cookie` on client, `useCookie('lt-auth-state')` on server)
- The `iam.session_token` httpOnly cookie is the real session identifier; `lt-auth-state` is a client-side convenience cache

See the full rules in `node_modules/@lenne.tech/nuxt-extensions/CLAUDE.md` under "Authentication Cookie Rules".

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
