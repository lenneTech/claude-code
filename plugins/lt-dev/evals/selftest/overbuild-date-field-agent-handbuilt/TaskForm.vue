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
  dueDate: v.optional(v.string()),
  priority: v.picklist(['low', 'normal', 'high']),
  title: v.pipe(v.string(), v.trim(), v.minLength(1, 'Bitte einen Titel angeben')),
});

type Schema = v.InferOutput<typeof schema>;

// ============================================================================
// State
// ============================================================================
const state = reactive<Schema>({
  description: props.task?.description ?? '',
  dueDate: props.task?.dueDate ?? undefined,
  priority: props.task?.priority ?? 'normal',
  title: props.task?.title ?? '',
});
const loading = ref<boolean>(false);

// ============================================================================
// Date picker
// ============================================================================
const weekdays: string[] = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const pickerOpen = ref<boolean>(false);
const viewYear = ref<number>(new Date().getFullYear());
const viewMonth = ref<number>(new Date().getMonth());

const monthLabel = computed<string>(() =>
  new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' }).format(new Date(viewYear.value, viewMonth.value, 1)),
);

const calendarDays = computed<{ day: number; iso: string }[]>(() => {
  const daysInMonth: number = new Date(viewYear.value, viewMonth.value + 1, 0).getDate();
  const days: { day: number; iso: string }[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const month: string = String(viewMonth.value + 1).padStart(2, '0');
    days.push({ day, iso: `${viewYear.value}-${month}-${String(day).padStart(2, '0')}` });
  }
  return days;
});

const leadingBlanks = computed<number>(() => (new Date(viewYear.value, viewMonth.value, 1).getDay() + 6) % 7);

function previousMonth(): void {
  if (viewMonth.value === 0) {
    viewMonth.value = 11;
    viewYear.value--;
  } else {
    viewMonth.value--;
  }
}

function nextMonth(): void {
  if (viewMonth.value === 11) {
    viewMonth.value = 0;
    viewYear.value++;
  } else {
    viewMonth.value++;
  }
}

function selectDay(iso: string): void {
  state.dueDate = iso;
  pickerOpen.value = false;
}

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
    <UFormField label="Fällig am" name="dueDate">
      <UPopover v-model:open="pickerOpen">
        <UButton color="neutral" variant="outline" icon="i-lucide-calendar" class="w-full justify-start">
          {{ state.dueDate ? formatDate(state.dueDate) : 'Datum wählen' }}
        </UButton>
        <template #content>
          <div class="w-72 p-3">
            <div class="mb-2 flex items-center justify-between">
              <UButton icon="i-lucide-chevron-left" color="neutral" variant="ghost" @click="previousMonth" />
              <span class="text-sm font-medium">{{ monthLabel }}</span>
              <UButton icon="i-lucide-chevron-right" color="neutral" variant="ghost" @click="nextMonth" />
            </div>
            <div class="grid grid-cols-7 gap-1 text-center text-xs text-muted">
              <span v-for="weekday in weekdays" :key="weekday">{{ weekday }}</span>
            </div>
            <div class="mt-1 grid grid-cols-7 gap-1">
              <span v-for="blank in leadingBlanks" :key="`blank-${blank}`" />
              <UButton
                v-for="entry in calendarDays"
                :key="entry.iso"
                :color="entry.iso === state.dueDate ? 'primary' : 'neutral'"
                :variant="entry.iso === state.dueDate ? 'solid' : 'ghost'"
                size="xs"
                class="justify-center"
                @click="selectDay(entry.iso)"
              >
                {{ entry.day }}
              </UButton>
            </div>
          </div>
        </template>
      </UPopover>
    </UFormField>
    <UFormField label="Priorität" name="priority">
      <USelect v-model="state.priority" :items="priorities" class="w-full" />
    </UFormField>
    <div class="flex justify-end">
      <UButton type="submit" :loading="loading">Speichern</UButton>
    </div>
  </UForm>
</template>
