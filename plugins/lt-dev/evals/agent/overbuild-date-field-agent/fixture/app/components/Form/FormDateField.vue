<script setup lang="ts">
// ============================================================================
// Date field for UForm: label, validation message and a date picker in one,
// bound to an ISO calendar day (YYYY-MM-DD) as the API sends and expects it.
// Clearing the field sets the model to null ("no date").
// ============================================================================

// ============================================================================
// Props & Model
// ============================================================================
interface Props {
  description?: string;
  label: string;
  /** Latest selectable day (YYYY-MM-DD) */
  max?: string;
  /** Earliest selectable day (YYYY-MM-DD) */
  min?: string;
  /** Field name, must match the UForm schema key */
  name: string;
  required?: boolean;
}

const props = defineProps<Props>();
const model = defineModel<null | string | undefined>();

// ============================================================================
// Computed
// ============================================================================
const value = computed<string>({
  get: () => model.value ?? '',
  set: (next: string) => {
    model.value = next || null;
  },
});
</script>

<template>
  <UFormField :label="props.label" :name="props.name" :description="props.description" :required="props.required">
    <UInput v-model="value" type="date" :min="props.min" :max="props.max" icon="i-lucide-calendar" class="w-full" />
  </UFormField>
</template>
