# Forms with Valibot

**Valibot is the ONLY validation library. Do NOT use Zod.**

## Table of Contents

- [Basic Pattern](#basic-pattern)
- [UAuthForm (Authentication)](#uauthform-authentication)
- [Validation Rules](#validation-rules)
- [Cross-Field Validation](#cross-field-validation)
- [Form with Initial Data](#form-with-initial-data)
- [Loading State](#loading-state)
- [Toast Feedback](#toast-feedback)
- [Zod to Valibot Migration](#zod-to-valibot-migration)

---

## Basic Pattern

```vue
<script setup lang="ts">
import { object, pipe, string, number, minLength, minValue } from 'valibot'
import type { InferOutput } from 'valibot'

const schema = object({
  title: pipe(string(), minLength(3, 'Mindestens 3 Zeichen')),
  count: pipe(number(), minValue(1, 'Mindestens 1'))
})

type Schema = InferOutput<typeof schema>

const state = reactive<Schema>({
  title: '',
  count: 1
})

async function handleSubmit(): Promise<void> {
  // state is validated
}
</script>

<template>
  <UForm :state="state" :schema="schema" @submit="handleSubmit">
    <UFormField name="title" label="Titel" required>
      <UInput v-model="state.title" />
    </UFormField>

    <UFormField name="count" label="Anzahl" required>
      <UInput v-model="state.count" type="number" />
    </UFormField>

    <UButton type="submit">Speichern</UButton>
  </UForm>
</template>
```

## UAuthForm (Authentication)

For authentication forms, use `UAuthForm` which provides pre-styled fields and layout:

```vue
<script setup lang="ts">
import { object, pipe, string, email, minLength } from 'valibot'
import type { InferOutput } from 'valibot'
import type { FormSubmitEvent } from '@nuxt/ui'

const schema = object({
  email: pipe(string(), email('Ungültige E-Mail')),
  password: pipe(string(), minLength(8, 'Mindestens 8 Zeichen'))
})

type Schema = InferOutput<typeof schema>

const fields = [
  { name: 'email', label: 'E-Mail', type: 'email', placeholder: 'name@beispiel.de' },
  { name: 'password', label: 'Passwort', type: 'password' }
]

const loading = ref(false)

async function onSubmit(event: FormSubmitEvent<Schema>) {
  loading.value = true
  try {
    // Handle authentication
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UPageCard title="Anmelden">
    <UAuthForm
      :fields="fields"
      :schema="schema"
      :loading="loading"
      submit-label="Anmelden"
      @submit="onSubmit"
    >
      <!-- Optional: Slot for password hint -->
      <template #password-hint>
        <NuxtLink to="/auth/forgot-password" class="text-sm">
          Passwort vergessen?
        </NuxtLink>
      </template>
    </UAuthForm>
  </UPageCard>
</template>
```

**UAuthForm Props:**
| Prop | Type | Description |
|------|------|-------------|
| `fields` | `AuthFormField[]` | Field definitions (name, label, type, placeholder) |
| `schema` | `ObjectSchema` | Valibot validation schema |
| `loading` | `boolean` | Show loading spinner on submit button |
| `submit-label` | `string` | Text for submit button |

## Validation Rules

```typescript
import {
  string, number, boolean, array, object, pipe,
  minLength, maxLength, email, url, regex,
  minValue, maxValue, integer,
  optional, nullable
} from 'valibot'

// Strings
pipe(string(), minLength(3), maxLength(100))
pipe(string(), email('Ungültige E-Mail'))
pipe(string(), regex(/^\d{5}$/, 'Ungültige PLZ'))

// Numbers
pipe(number(), minValue(0), maxValue(100))
pipe(number(), integer('Muss ganze Zahl sein'))

// Optional
optional(string())
nullable(string())

// Arrays
pipe(array(string()), minLength(1, 'Mindestens 1 Eintrag'))
```

## Cross-Field Validation

```typescript
import { object, pipe, string, forward, partialCheck, minLength } from 'valibot'

const schema = pipe(
  object({
    password: pipe(string(), minLength(8)),
    confirm: string()
  }),
  forward(
    partialCheck(
      [['password'], ['confirm']],
      (input) => input.password === input.confirm,
      'Passwörter stimmen nicht überein'
    ),
    ['confirm']
  )
)
```

## Form with Initial Data

```typescript
interface Props {
  initialData?: Partial<SeasonDto>
}

const props = defineProps<Props>()

const state = reactive<Schema>({
  title: props.initialData?.title ?? '',
  description: props.initialData?.description ?? ''
})
```

## Loading State

```vue
<script setup lang="ts">
const submitting = ref<boolean>(false)

async function handleSubmit(): Promise<void> {
  submitting.value = true
  try {
    await createSeason(state)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <UButton type="submit" :loading="submitting">Speichern</UButton>
</template>
```

## Toast Feedback

```typescript
const toast = useToast()

async function handleSubmit(): Promise<void> {
  try {
    await createSeason(state)
    toast.add({ title: 'Erfolgreich gespeichert', color: 'success' })
  } catch (error) {
    toast.add({ title: 'Fehler beim Speichern', color: 'error' })
  }
}
```

## Zod to Valibot Migration

| Zod | Valibot (v1) |
|-----|--------------|
| `z.object()` | `object()` |
| `z.string().min(3)` | `pipe(string(), minLength(3))` |
| `z.number().min(0)` | `pipe(number(), minValue(0))` |
| `z.string().email()` | `pipe(string(), email())` |
| `z.optional()` | `optional()` |
| `z.infer<typeof schema>` | `InferOutput<typeof schema>` |
