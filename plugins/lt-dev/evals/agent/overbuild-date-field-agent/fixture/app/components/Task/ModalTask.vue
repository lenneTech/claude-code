<script setup lang="ts">
// ============================================================================
// Modal around TaskForm, opened with useOverlay(). Closes with the saved task,
// or with false when cancelled.
// ============================================================================
import type { TaskDto } from '~/api-client/types.gen';

// ============================================================================
// Props & Emits
// ============================================================================
interface Props {
  task?: TaskDto;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  close: [result: false | TaskDto];
}>();
</script>

<template>
  <UModal :title="props.task ? 'Aufgabe bearbeiten' : 'Neue Aufgabe'" :close="{ onClick: () => emit('close', false) }">
    <template #body>
      <TaskForm :task="props.task" @saved="(task: TaskDto) => emit('close', task)" />
    </template>
  </UModal>
</template>
