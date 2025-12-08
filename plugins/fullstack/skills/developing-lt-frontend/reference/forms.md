# Forms with Valibot

**Valibot is the ONLY validation library. Do NOT use Zod.**

## Basic Pattern

```vue
<script setup lang="ts">
import { object, string, number, minLength, minValue } from 'valibot'
import type { InferOutput } from 'valibot'

const schema = object({
  title: string([minLength(3, 'Mindestens 3 Zeichen')]),
  count: number([minValue(1, 'Mindestens 1')])
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

## Validation Rules

```typescript
import {
  string, number, boolean, array, object,
  minLength, maxLength, email, url, regex,
  minValue, maxValue, integer,
  optional, nullable
} from 'valibot'

// Strings
string([minLength(3), maxLength(100)])
string([email('Ungültige E-Mail')])
string([regex(/^\d{5}$/, 'Ungültige PLZ')])

// Numbers
number([minValue(0), maxValue(100)])
number([integer('Muss ganze Zahl sein')])

// Optional
optional(string())
nullable(string())

// Arrays
array(string(), [minLength(1, 'Mindestens 1 Eintrag')])
```

## Cross-Field Validation

```typescript
import { object, string, custom } from 'valibot'

const schema = object({
  password: string([minLength(8)]),
  confirm: string()
}, [
  custom(
    (data) => data.password === data.confirm,
    'Passwörter stimmen nicht überein'
  )
])
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

## Zod to Valibot Migration

| Zod | Valibot |
|-----|---------|
| `z.object()` | `object()` |
| `z.string().min(3)` | `string([minLength(3)])` |
| `z.number().min(0)` | `number([minValue(0)])` |
| `z.optional()` | `optional()` |
| `z.infer<typeof schema>` | `InferOutput<typeof schema>` |
