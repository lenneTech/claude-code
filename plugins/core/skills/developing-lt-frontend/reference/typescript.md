# TypeScript Standards

## Rule: No Implicit `any`

Every variable, parameter, and return value MUST have an explicit type.

## Variables

```typescript
// Primitives
const name: string = 'value'
const count: number = 0
const active: boolean = true

// Arrays
const items: SeasonDto[] = []

// Nullable
const season: SeasonDto | null = null

// Unions
const status: 'active' | 'inactive' = 'active'
```

## Functions

```typescript
// Sync
function process(input: string): void { }

// Async
async function fetch(id: string): Promise<SeasonDto | null> { }

// Arrow
const handle = (event: MouseEvent): void => { }
```

## Vue Composition API

```typescript
// ref - always with type parameter
const count = ref<number>(0)
const user = ref<UserDto | null>(null)
const items = ref<SeasonDto[]>([])

// reactive - with interface
interface FormState {
  title: string
  description: string
}
const state = reactive<FormState>({ title: '', description: '' })

// computed - with return type
const active = computed<SeasonDto[]>(() => items.value.filter(i => i.active))
```

## Props & Emits

```typescript
// Props
interface Props {
  season: SeasonDto
  editable?: boolean
}
const props = withDefaults(defineProps<Props>(), { editable: false })

// Emits
const emit = defineEmits<{
  update: [value: string]
  submit: [data: FormData]
}>()
```

## Generated Types (REQUIRED)

**NEVER create custom interfaces for backend DTOs!**

```typescript
// ✅ ALWAYS use generated types for backend data
import type { SeasonDto, CreateSeasonDto } from '~/api-client/types.gen'
import { seasonControllerGet } from '~/api-client/sdk.gen'

// ✅ Extend generated types for UI-specific properties
interface SeasonWithUI extends SeasonDto {
  isSelected: boolean
}

// ✅ Custom interfaces ONLY for frontend-only state
// app/interfaces/filter.interface.ts
interface FilterState {
  searchQuery: string
  sortBy: 'name' | 'date'
}
```

### If Generated Types Are Missing

**Prerequisites:** Backend API must be running!

```bash
# 1. Start API
cd projects/api && npm run start:dev

# 2. Generate types
npm run generate-types
```

**NEVER create manual DTOs as a workaround!**

## Anti-Patterns

```typescript
// ❌ FORBIDDEN: Custom interfaces for backend DTOs
// app/interfaces/season.interface.ts
interface Season {
  id: string
  name: string
}

// ✅ Use generated types
import type { SeasonDto } from '~/api-client/types.gen'

// ❌ Implicit any
const data = null
function process(input) { }
const items = []

// ✅ Explicit types
const data: SeasonDto | null = null
function process(input: string): void { }
const items: SeasonDto[] = []
```
