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

## Generated Types Priority

```typescript
// 1. Use generated types first
import type { SeasonDto, CreateSeasonDto } from '~/api-client/types.gen'

// 2. Extend when needed
interface SeasonWithUI extends SeasonDto {
  isSelected: boolean
}

// 3. Custom interfaces in app/interfaces/*.interface.ts
```

## Anti-Patterns

```typescript
// ❌ Implicit any
const data = null
function process(input) { }
const items = []

// ✅ Explicit types
const data: SeasonDto | null = null
function process(input: string): void { }
const items: SeasonDto[] = []
```
