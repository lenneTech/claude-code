# Component Patterns

## Script Structure

```vue
<script setup lang="ts">
// ============================================================================
// Imports
// ============================================================================
import { ref, computed } from 'vue'
import type { SeasonDto } from '~/api-client/types.gen'

// ============================================================================
// Composables
// ============================================================================
const { seasons, fetchSeasons } = useSeasons()
const overlay = useOverlay()

// ============================================================================
// Variables
// ============================================================================
const selected = ref<SeasonDto | null>(null)
const loading = ref<boolean>(false)

// ============================================================================
// Computed Properties
// ============================================================================
const hasSelection = computed<boolean>(() => !!selected.value)

// ============================================================================
// Lifecycle Hooks
// ============================================================================
onMounted(() => fetchSeasons())

// ============================================================================
// Functions
// ============================================================================
function handleSelect(season: SeasonDto): void {
  selected.value = season
}
</script>
```

## Template Rules

```vue
<template>
  <!-- TailwindCSS only - no <style> blocks -->
  <div class="flex flex-col gap-4">

    <!-- Single root for conditionals -->
    <div v-if="loading">Loading...</div>
    <div v-else-if="error">Error</div>
    <div v-else>Content</div>

    <!-- v-for with unique :key -->
    <div v-for="season in seasons" :key="season.id">
      {{ season.title }}
    </div>

    <!-- Event handlers call methods -->
    <UButton @click="handleSubmit">Speichern</UButton>
  </div>
</template>
```

## Props Pattern

```typescript
interface Props {
  season: SeasonDto
  editable?: boolean
  title?: string
}

const props = withDefaults(defineProps<Props>(), {
  editable: false,
  title: 'Details'
})
```

## Emit Pattern

```typescript
const emit = defineEmits<{
  update: [season: SeasonDto]
  delete: [id: string]
  cancel: []
}>()

function handleSave(): void {
  emit('update', season)
}
```

## Naming

| Type | Pattern | Example |
|------|---------|---------|
| Components | PascalCase | `SeasonCard.vue` |
| Pages | kebab-case | `season-details.vue` |
| Modals | `Modal` prefix | `ModalCreateSeason.vue` |

## Performance

```typescript
//  Use computed for derived data (cached)
const activeSeasons = computed<SeasonDto[]>(() =>
  seasons.value.filter(s => s.status === 'active')
)

//  Use methods for actions (not cached)
function handleClick(): void { }

//  Don't compute in template
// {{ seasons.filter(s => s.active).length }}
```
