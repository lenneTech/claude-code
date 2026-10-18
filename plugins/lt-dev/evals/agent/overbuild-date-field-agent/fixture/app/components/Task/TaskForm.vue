<script setup lang="ts">
// ============================================================================
// Imports
// ============================================================================
import type { FormSubmitEvent } from '@nuxt/ui';

import * as v from 'valibot';

import type { TaskCreateInput, TaskDto, TaskInput, TaskPriority } from '~/api-client/types.gen';

import { taskControllerCreate, taskControllerUpdate } from '~/api-client/sdk.gen';

// ============================================================================
// Props & Emits
// ============================================================================
interface Props {
  /** Task to edit; without it the form creates a new task */
  task?: TaskDto;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  saved: [task: TaskDto];
}>();

// ============================================================================
// Composables
// ============================================================================
const toast = useToast();

// ============================================================================
// Validation
// ============================================================================
const priorities: { label: string; value: TaskPriority }[] = [
  { label: 'Niedrig', value: 'low' },
  { label: 'Normal', value: 'normal' },
  { label: 'Hoch', value: 'high' },
];

const schema = v.object({
  description: v.optional(v.pipe(v.string(), v.trim())),
  priority: v.picklist(['low', 'normal', 'high']),
  title: v.pipe(v.string(), v.trim(), v.minLength(1, 'Bitte einen Titel angeben')),
});

type Schema = v.InferOutput<typeof schema>;

// ============================================================================
// State
// ============================================================================
const state = reactive<Schema>({
  description: props.task?.description ?? '',
  priority: props.task?.priority ?? 'normal',
  title: props.task?.title ?? '',
});
const loading = ref<boolean>(false);

// ============================================================================
// Functions
// ============================================================================
async function onSubmit(event: FormSubmitEvent<Schema>): Promise<void> {
  loading.value = true;
  const result = props.task
    ? await taskControllerUpdate({ body: event.data satisfies TaskInput, path: { id: props.task.id } })
    : await taskControllerCreate({ body: event.data satisfies TaskCreateInput });
  loading.value = false;
  if (result.error || !result.data) {
    toast.add({ color: 'error', title: 'Aufgabe konnte nicht gespeichert werden' });
    return;
  }
  toast.add({ color: 'success', title: 'Aufgabe gespeichert' });
  emit('saved', result.data);
}
</script>

<template>
  <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
    <UFormField label="Titel" name="title" required>
      <UInput v-model="state.title" class="w-full" />
    </UFormField>
    <UFormField label="Beschreibung" name="description">
      <UTextarea v-model="state.description" class="w-full" />
    </UFormField>
    <UFormField label="Priorität" name="priority">
      <USelect v-model="state.priority" :items="priorities" class="w-full" />
    </UFormField>
    <div class="flex justify-end">
      <UButton type="submit" :loading="loading">Speichern</UButton>
    </div>
  </UForm>
</template>
