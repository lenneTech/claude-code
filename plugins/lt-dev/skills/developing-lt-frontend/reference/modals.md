# Modals with useOverlay

**Always use programmatic modals. Never use inline modals.**

## Table of Contents

- [Opening a Modal](#opening-a-modal)
- [Modal Component](#modal-component)
- [Confirmation Dialog](#confirmation-dialog)
- [Rules](#rules)
- [Anti-Patterns](#anti-patterns)

---

## Opening a Modal

```typescript
import ModalCreateSeason from '~/components/ModalCreateSeason.vue'

const overlay = useOverlay()

function openModal(): void {
  overlay.open(ModalCreateSeason, {
    props: {
      title: 'Neue Season',
      initialData: existingData
    },
    onClose: (result?: SeasonDto) => {
      if (result) {
        refreshData()
      }
    }
  })
}
```

## Modal Component

```vue
<!-- app/components/ModalCreateSeason.vue -->
<script setup lang="ts">
import { object, pipe, string, minLength } from 'valibot'
import type { InferOutput } from 'valibot'

interface Props {
  title?: string
  initialData?: Partial<SeasonDto>
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Neue Season'
})

const overlay = useOverlay()
const isOpen = ref<boolean>(true)
const loading = ref<boolean>(false)

const schema = object({
  title: pipe(string(), minLength(3, 'Mindestens 3 Zeichen'))
})

type Schema = InferOutput<typeof schema>

const state = reactive<Schema>({
  title: props.initialData?.title ?? ''
})

async function handleSubmit(): Promise<void> {
  loading.value = true
  try {
    const result = await createSeason(state)
    if (result) overlay.close(result)
  } finally {
    loading.value = false
  }
}

function handleCancel(): void {
  overlay.close()
}
</script>

<template>
  <UModal v-model:open="isOpen" prevent-close @close="handleCancel">
    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-semibold">{{ props.title }}</h3>
          <UButton
            color="gray"
            variant="ghost"
            icon="i-heroicons-x-mark"
            @click="handleCancel"
          />
        </div>
      </template>

      <UForm :state="state" :schema="schema" class="space-y-4" @submit="handleSubmit">
        <UFormField name="title" label="Titel" required>
          <UInput v-model="state.title" />
        </UFormField>

        <div class="flex justify-end gap-2">
          <UButton color="gray" :disabled="loading" @click="handleCancel">
            Abbrechen
          </UButton>
          <UButton type="submit" :loading="loading">
            Speichern
          </UButton>
        </div>
      </UForm>
    </UCard>
  </UModal>
</template>
```

## Confirmation Dialog

```typescript
import ModalConfirm from '~/components/ModalConfirm.vue'

async function handleDelete(season: SeasonDto): Promise<void> {
  const confirmed = await new Promise<boolean>((resolve) => {
    overlay.open(ModalConfirm, {
      props: {
        title: 'Löschen?',
        message: `"${season.title}" wirklich löschen?`,
        danger: true
      },
      onClose: (result) => resolve(!!result)
    })
  })

  if (confirmed) {
    await deleteSeason(season.id)
  }
}
```

## Rules

| Rule | Value |
|------|-------|
| `isOpen` | Always `ref<boolean>(true)` |
| Close | Always via `overlay.close(result)` |
| Return data | `overlay.close(data)` |
| Cancel | `overlay.close()` (no argument) |
| Prevent close | Use `prevent-close` on UModal |

## Anti-Patterns

```vue
<!--  DON'T: Inline modal -->
<template>
  <UButton @click="isOpen = true">Open</UButton>
  <UModal v-model:open="isOpen">...</UModal>
</template>

<!--  DO: Programmatic modal -->
<template>
  <UButton @click="openModal">Open</UButton>
</template>
```
