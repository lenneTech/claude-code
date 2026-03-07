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
