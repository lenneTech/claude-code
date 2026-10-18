<script setup lang="ts">
// ============================================================================
// Tasks: list with create and edit
// ============================================================================
import type { TaskDto, TaskPriority } from '~/api-client/types.gen';

import { taskControllerFindAll } from '~/api-client/sdk.gen';
import ModalTask from '~/components/Task/ModalTask.vue';

useHead({ title: 'Aufgaben' });

// ============================================================================
// Composables
// ============================================================================
const overlay = useOverlay();
const toast = useToast();

// ============================================================================
// State
// ============================================================================
const tasks = ref<TaskDto[]>([]);
const loading = ref<boolean>(false);
const failed = ref<boolean>(false);

const priorityLabels: Record<TaskPriority, string> = {
  high: 'Hoch',
  low: 'Niedrig',
  normal: 'Normal',
};

onMounted(load);

// ============================================================================
// Functions
// ============================================================================
async function load(): Promise<void> {
  loading.value = true;
  failed.value = false;
  const { data, error } = await taskControllerFindAll();
  loading.value = false;
  if (error || !data) {
    failed.value = true;
    toast.add({ color: 'error', title: 'Aufgaben konnten nicht geladen werden' });
    return;
  }
  tasks.value = data;
}

async function openTask(task?: TaskDto): Promise<void> {
  const modal = overlay.create(ModalTask, { props: { task } });
  const saved = await modal.open();
  if (saved) {
    await load();
  }
}
</script>

<template>
  <div class="mx-auto max-w-4xl px-4 py-8">
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-2xl font-bold">Aufgaben</h1>
      <UButton icon="i-lucide-plus" @click="openTask()">Neue Aufgabe</UButton>
    </div>

    <div v-if="loading" class="space-y-2">
      <USkeleton v-for="n in 3" :key="n" class="h-14 w-full" />
    </div>
    <UAlert
      v-else-if="failed"
      color="error"
      title="Aufgaben konnten nicht geladen werden"
      :actions="[{ label: 'Erneut versuchen', onClick: load }]"
    />
    <UEmpty v-else-if="tasks.length === 0" icon="i-lucide-list-todo" title="Noch keine Aufgaben" />
    <ul v-else class="divide-y divide-default rounded-lg border border-default">
      <li
        v-for="task in tasks"
        :key="task.id"
        class="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 hover:bg-elevated"
        @click="openTask(task)"
      >
        <div>
          <p class="font-medium">{{ task.title }}</p>
          <p class="text-sm text-muted">Angelegt am {{ formatDate(task.createdAt) }}</p>
        </div>
        <UBadge :color="task.priority === 'high' ? 'error' : 'neutral'" variant="subtle">
          {{ priorityLabels[task.priority] }}
        </UBadge>
      </li>
    </ul>
  </div>
</template>
