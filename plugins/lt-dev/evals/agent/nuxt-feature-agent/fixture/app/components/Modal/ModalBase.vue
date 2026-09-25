<script lang="ts" setup>
// ============================================================================
// Props & Emits
// ============================================================================
interface Props {
  description?: string;
  title?: string;
}

withDefaults(defineProps<Props>(), {
  description: 'This is a base modal example using Nuxt UI. You can customize this component to fit your needs.',
  title: 'Modal Example',
});

const emit = defineEmits<{
  close: [result?: unknown];
}>();

// ============================================================================
// Functions
// ============================================================================
function handleCancel(): void {
  emit('close', false);
}

function handleConfirm(): void {
  emit('close', true);
}
</script>

<template>
  <UModal :title="title" :description="description" :close="{ onClick: () => emit('close', false) }">
    <template #body>
      <div class="space-y-4">
        <p class="text-sm text-neutral-600 dark:text-neutral-400">
          This modal demonstrates how to use the <code class="px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded text-xs">useOverlay</code> composable to open modals
          programmatically.
        </p>
        <div class="rounded-lg bg-neutral-50 dark:bg-neutral-900 p-4">
          <h4 class="text-sm font-medium text-neutral-900 dark:text-white mb-2">Key Features:</h4>
          <ul class="space-y-2 text-sm text-neutral-600 dark:text-neutral-400">
            <li class="flex items-start gap-2">
              <UIcon name="i-lucide-check" class="size-4 mt-0.5 text-success shrink-0" />
              <span>Programmatic control with useOverlay()</span>
            </li>
            <li class="flex items-start gap-2">
              <UIcon name="i-lucide-check" class="size-4 mt-0.5 text-success shrink-0" />
              <span>Return values via emit('close')</span>
            </li>
            <li class="flex items-start gap-2">
              <UIcon name="i-lucide-check" class="size-4 mt-0.5 text-success shrink-0" />
              <span>Fully typed props and emits</span>
            </li>
          </ul>
        </div>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-3">
        <UButton color="neutral" variant="outline" @click="handleCancel"> Cancel </UButton>
        <UButton color="primary" @click="handleConfirm"> Confirm </UButton>
      </div>
    </template>
  </UModal>
</template>
