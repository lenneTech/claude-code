<script setup lang="ts">
// ============================================================================
// Imports
// ============================================================================
import type { FormSubmitEvent } from '@nuxt/ui';

import * as v from 'valibot';

import type { ProjectDto, ProjectInput } from '~/api-client/types.gen';

import { projectControllerUpdate } from '~/api-client/sdk.gen';

// ============================================================================
// Props & Emits
// ============================================================================
interface Props {
  project: ProjectDto;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  saved: [project: ProjectDto];
}>();

// ============================================================================
// Composables
// ============================================================================
const toast = useToast();

// ============================================================================
// Validation
// ============================================================================
const schema = v.pipe(
  v.object({
    endDate: v.nullish(v.string()),
    name: v.pipe(v.string(), v.trim(), v.minLength(1, 'Bitte einen Namen angeben')),
    startDate: v.nullish(v.string()),
  }),
  v.forward(
    v.check((input) => !input.startDate || !input.endDate || input.endDate >= input.startDate, 'Das Ende liegt vor dem Start'),
    ['endDate'],
  ),
);

type Schema = v.InferOutput<typeof schema>;

// ============================================================================
// State
// ============================================================================
const state = reactive<Schema>({
  endDate: props.project.endDate ?? null,
  name: props.project.name,
  startDate: props.project.startDate ?? null,
});
const loading = ref<boolean>(false);

// ============================================================================
// Functions
// ============================================================================
async function onSubmit(event: FormSubmitEvent<Schema>): Promise<void> {
  loading.value = true;
  const body: ProjectInput = event.data;
  const { data, error } = await projectControllerUpdate({ body, path: { id: props.project.id } });
  loading.value = false;
  if (error || !data) {
    toast.add({ color: 'error', title: 'Projekt konnte nicht gespeichert werden' });
    return;
  }
  toast.add({ color: 'success', title: 'Projekt gespeichert' });
  emit('saved', data);
}
</script>

<template>
  <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
    <UFormField label="Name" name="name" required>
      <UInput v-model="state.name" class="w-full" />
    </UFormField>
    <div class="grid gap-4 sm:grid-cols-2">
      <FormDateField v-model="state.startDate" label="Start" name="startDate" />
      <FormDateField v-model="state.endDate" label="Ende" name="endDate" :min="state.startDate ?? undefined" />
    </div>
    <div class="flex justify-end">
      <UButton type="submit" :loading="loading">Speichern</UButton>
    </div>
  </UForm>
</template>
