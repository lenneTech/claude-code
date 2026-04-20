---
name: developing-lt-frontend-error-translation
description: Consume backend ErrorCodes from @lenne.tech/nest-server via useLtErrorTranslation composable — parse #CODE: markers, load locale translations, show localized Toasts
---

# Error Translation — Consuming Backend ErrorCodes

The backend (`@lenne.tech/nest-server`) returns structured errors in the format `#PREFIX_XXXX: Developer message`. The frontend composable `useLtErrorTranslation()` from `@lenne.tech/nuxt-extensions` parses the marker, loads locale-specific translations from `GET /i18n/errors/:locale`, and returns end-user messages.

**Backend-side rules:** see `generating-nest-servers/reference/error-handling.md`. This file covers the **frontend consumer side only**.

## The Contract

| Layer | Format / Endpoint |
|-------|-------------------|
| Backend exception | `throw new NotFoundException(ErrorCode.RESOURCE_NOT_FOUND)` |
| REST response body | `{ statusCode: 404, message: "#LTNS_0400: Resource not found" }` |
| Translation endpoint | `GET /i18n/errors/de` → `{ errors: { "LTNS_0400": "Ressource nicht gefunden.", ... } }` |
| Frontend composable | `useLtErrorTranslation()` |
| Regex in parser | `/^#([A-Z_]+_\d+):\s*(.+)$/` |

Codes always match `PREFIX_DDDD` where `PREFIX` is `LTNS` (core) or a project prefix (`PROJ`, `APP`, …). The `#` prefix and `:` separator are mandatory markers.

## Composable API

```typescript
const {
  translateError,   // (errorOrMessage) => translated user-facing string
  parseError,       // (errorOrMessage) => { code, developerMessage, translatedMessage }
  showErrorToast,   // (errorOrMessage, title?) => void — client-only Toast
  loadTranslations, // (locale?) => Promise<void> — preload translations for a locale
  isLoaded,         // Computed<boolean> — translations for current locale loaded
  isLoading,        // Ref<boolean> — currently fetching
  currentLocale,    // Computed<string> — active locale detected
} = useLtErrorTranslation();
```

**Locale detection** (priority order): `@nuxtjs/i18n` → `navigator.language` (client) → config default → `'de'`.

**SSR-safety:** translations are stored via `useState('lt-error-translations', ...)` so they hydrate cleanly. Per-locale cache — first call fetches, subsequent calls reuse.

## Standard Patterns

### Pattern 1 — Toast on API error (most common)

```vue
<script setup lang="ts">
const { showErrorToast } = useLtErrorTranslation();

async function saveUser(payload: SaveUserInput) {
  try {
    await sdk.postUser({ body: payload });
  } catch (error) {
    showErrorToast(error, 'Speichern fehlgeschlagen');
  }
}
</script>
```

`showErrorToast` extracts the message, parses `#CODE:`, looks up the translation, and calls the Nuxt UI `useToast()` add method. Client-only — safely no-ops on SSR.

### Pattern 2 — Manual Toast with explicit structure

```vue
<script setup lang="ts">
const { translateError } = useLtErrorTranslation();
const toast = useToast();

async function onSubmit() {
  try {
    await submit();
  } catch (error) {
    toast.add({
      color: 'error',
      title: 'Anmeldung fehlgeschlagen',  // context-specific German title — hardcoded
      description: translateError(error),  // locale-aware, comes from /i18n/errors/<locale>
    });
  }
}
</script>
```

**Title convention:** titles are context-specific German strings decided at the call site (`'Anmeldung fehlgeschlagen'`, `'Einrichtung fehlgeschlagen'`, `'Speichern fehlgeschlagen'`). Descriptions always come from `translateError` — they are the locale-translated backend message.

### Pattern 3 — Code-based flow control

When you need to branch based on the error type (e.g. redirect to verification screen, trigger a re-auth flow), use `parseError` and compare the code — never compare message strings.

```vue
<script setup lang="ts">
const { parseError, showErrorToast } = useLtErrorTranslation();

async function signIn(payload: SignInPayload) {
  try {
    await authClient.signIn(payload);
  } catch (error) {
    const parsed = parseError(error);

    // Branch on code, not message text
    if (parsed.code === 'LTNS_0023') {
      await navigateTo({ path: '/auth/verify-email', query: { email: payload.email } });
      return;
    }
    if (parsed.code === 'LTNS_0010') {
      // Invalid credentials — don't expose which field was wrong
      showErrorToast(error, 'Anmeldung fehlgeschlagen');
      return;
    }

    showErrorToast(error, 'Anmeldung fehlgeschlagen');
  }
}
</script>
```

### Pattern 4 — Preload translations at app startup

Prefetching avoids the first-error-round-trip delay and ensures the toast appears instantly. Put this in `app.vue` or a plugin:

```typescript
// app.vue
const { loadTranslations, currentLocale } = useLtErrorTranslation();

// Preload current locale on app start
await loadTranslations();

// Reload when locale changes (if @nuxtjs/i18n is installed)
watch(currentLocale, async (newLocale) => {
  await loadTranslations(newLocale);
});
```

### Pattern 5 — Inline form errors (not Toast)

For in-form error display (Valibot + Nuxt UI `UFormField`), translate the backend error into the field-error slot:

```vue
<script setup lang="ts">
const { translateError } = useLtErrorTranslation();
const submitError = ref<string | null>(null);

async function onSubmit(event: FormSubmitEvent<Schema>) {
  submitError.value = null;
  try {
    await sdk.postResource({ body: event.data });
  } catch (error) {
    submitError.value = translateError(error);
  }
}
</script>

<template>
  <UForm ...>
    <!-- fields -->
    <p v-if="submitError" class="text-error-500">{{ submitError }}</p>
  </UForm>
</template>
```

## Anti-Patterns

| Anti-pattern | Why wrong | Fix |
|--------------|-----------|-----|
| `toast.add({ description: error.message })` | Shows English developer message (`"#LTNS_0400: Resource not found"`) to end users | Pipe through `translateError(error)` |
| `if (error.message.includes('not found'))` | Brittle — breaks on translation updates and locale changes | Use `parseError(error).code === 'LTNS_0400'` |
| `toast.add({ description: 'Ein Fehler ist aufgetreten' })` (generic fallback) | Hides actionable backend-provided detail from user | Use `translateError(error)` — the registry already provides locale-safe text |
| `await $fetch(/i18n/errors/de)` manual fetch | Bypasses cache + SSR state + URL-building (proxy, absolute URL) | Use `loadTranslations(locale)` from the composable |
| Hardcoded translation map in component | Diverges from backend registry over time | Compose results from `/i18n/errors/:locale` |
| Showing `error.data.message` directly | Same problem — raw backend developer message | Same fix — `translateError` |

## Testing

Unit tests for composables consuming errors should mock the composable-level return values (the `parseError`/`translateError` functions), not raw `fetch`. For page-level E2E, the backend actually returns the codes and the composable fetches translations from the running backend — no mocking needed.

**Unit pattern (Vitest) — real example from `nuxt-base-starter/tests/unit/auth/error-translation.spec.ts`:**
```typescript
const result = parseError('#LTNS_0010: Invalid credentials');
expect(result.code).toBe('LTNS_0010');
expect(result.translatedMessage).toBe('Ungültige Anmeldedaten');  // from preloaded mock translations
```

**E2E pattern (Playwright):**
```typescript
// Trigger a known error on the backend
await page.getByLabel('E-Mail').fill('invalid@test.com');
await page.getByLabel('Passwort').fill('wrong');
await page.getByRole('button', { name: 'Anmelden' }).click();

// Assert the LOCALIZED toast — not the English backend message
await expect(page.getByText('Ungültige Anmeldedaten')).toBeVisible();
```

Full test-authoring rules: this plugin's `test-reviewer` agent, section "ErrorCode Assertions".

## Configuration

Module options via `nuxt.config.ts` (only override when defaults don't fit):

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@lenne.tech/nuxt-extensions'],
  ltExtensions: {
    errorTranslation: {
      defaultLocale: 'de',  // fallback when no i18n + no navigator.language match
    },
  },
});
```

Translation-endpoint URL is built by `buildLtApiUrl('/i18n/errors/<locale>')` — it handles the SSR-vs-client, proxy-vs-direct, absolute-vs-relative cases. Do not hardcode.

## Cross-references

- **Backend:** `generating-nest-servers/reference/error-handling.md` — defining codes, registry setup, HTTP mapping
- **Composable source:** `@lenne.tech/nuxt-extensions/src/runtime/composables/use-lt-error-translation.ts`
- **Backend endpoint:** `@lenne.tech/nest-server/src/core/modules/error-code/core-error-code.controller.ts`
- **Live examples:** `nuxt-base-starter/app/pages/auth/{login,register,setup}.vue`
