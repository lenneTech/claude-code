# TypeScript Conventions

## Options Object Pattern for Optional Parameters

**Always use an options object for optional parameters instead of positional parameters:**

```typescript
// ❌ WRONG: Positional optional parameters
async function createUser(
  name: string,
  age?: number,
  email?: string,
  role?: string
) {}

// Problematic usage - must fill previous params with null
createUser('Max', null, null, 'admin');
```

```typescript
// ✅ CORRECT: Options object pattern
async function createUser(
  name: string,
  options?: {
    age?: number;
    email?: string;
    role?: string;
  }
) {}

// Clean usage - only set what you need
createUser('Max', { role: 'admin' });

// Easy to extend without breaking existing calls
createUser('Max', { role: 'admin', department: 'IT' });
```

**Benefits:**
- Self-documenting (parameter names visible at call site)
- Order-independent
- Extensible without breaking changes
- Better IDE autocompletion

**Convention:** First parameter is the main required value, second parameter is the options object.

## Model Property Initialization (`= undefined`)

**Initialize every Model property with `= undefined`** (e.g. `name?: string = undefined;`), even required ones.

The starter sets `useDefineForClassFields: true` (with `experimentalDecorators` + `emitDecoratorMetadata`). Decorators are unaffected — legacy decorators apply to the **prototype**, so `@UnifiedField`/`@Prop`/class-validator metadata is emitted whether or not the property has an initializer. **But** a property declared without an initializer (`name!: string;`) does NOT show up in `Object.keys(new Model())` at runtime — and `CoreModel.map()` iterates `Object.keys`, so it would **silently skip** the field during mapping. The `= undefined` initializer makes the property enumerable on a fresh instance.

- **Models:** `= undefined` is mandatory (mapping depends on it).
- **Inputs / DTOs:** initialization is irrelevant — inputs are populated via `plainToInstance`, not `map()`. Don't require it there.
- Do NOT switch `useDefineForClassFields` to `false` to "fix" this — it is intentional and harmless with legacy decorators. The `= undefined` convention is the correct fix.
- Never use the `declare` keyword for decorated properties — it removes the field from emit and breaks decorators.

## Inputs do NOT need to extend `CoreInput`

The CrudService never calls `input.map()`. `prepareInput` transforms the payload via `plainToInstanceClean(InputClass, input)` when the input class has no static `map()`, using the `@Type`/`@ValidateNested` metadata that `@UnifiedField` already emits. `CoreInput` only adds convenience `undefined`-stripping that `prepareInput` (`removeUndefined: true`) already does. **Do not flag an input for not extending `CoreInput`** — it is a valid, intentional pattern.
