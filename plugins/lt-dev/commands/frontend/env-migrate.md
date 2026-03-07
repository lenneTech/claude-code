---
description: Migrate Nuxt env variables to NUXT_ prefix convention with automatic useRuntimeConfig() mapping
allowed-tools: Read, Grep, Glob, Edit, Write, Bash(npm run lint:*), Bash(npm run build:*)
disable-model-invocation: true
---

# Nuxt Environment Variable Migration

Migrate `.env` and `.env.example` in a Nuxt frontend project so all environment variables follow the `NUXT_` prefix convention and are automatically mapped by `useRuntimeConfig()`.

## When to Use This Command

- When setting up a Nuxt project that uses non-standard env variable names
- When migrating an existing project to follow Nuxt conventions
- When `process.env` is used directly in Vue components or composables

## Related Elements

| Element | Purpose |
|---------|---------|
| **Skill**: `developing-lt-frontend` | Nuxt frontend patterns and expertise |
| **Command**: `/lt-dev:review` | Review migration changes |

---

## Migration Procedure

Execute the following steps in order:

### Step 1: Inventory All Environment Variables

1. Read `.env` and `.env.example` files
2. Search the entire project for `process.env.` references using Grep
3. Search for `useRuntimeConfig()` usage to find already-migrated variables
4. Categorize each variable:

| Category | Prefix | Maps To | Example |
|----------|--------|---------|---------|
| **Public** (client + server) | `NUXT_PUBLIC_` | `config.public.camelCaseName` | `SITE_URL` → `NUXT_PUBLIC_SITE_URL` → `config.public.siteUrl` |
| **Server-only** | `NUXT_` | `config.camelCaseName` | `LINEAR_API_KEY` → `NUXT_LINEAR_API_KEY` → `config.linearApiKey` |
| **Node.js built-in** | *(unchanged)* | `process.env.NODE_ENV` | `NODE_ENV` stays as-is |

Present the inventory table to the user for confirmation before proceeding.

### Step 2: Rename Variables in .env and .env.example

- Apply `NUXT_PUBLIC_` prefix for public variables
- Apply `NUXT_` prefix for server-only variables
- Keep `NODE_ENV` and other Node.js built-ins unchanged
- Preserve values and comments

### Step 3: Clean Up runtimeConfig in nuxt.config.ts

- **Remove** all manual `process.env.X` assignments from the `runtimeConfig` block — Nuxt maps `NUXT_*` variables automatically
- **Set only default values:**

```ts
runtimeConfig: {
  apiUrl: 'http://localhost:3000',       // ← NUXT_API_URL overrides this
  secretKey: '',                          // ← NUXT_SECRET_KEY overrides this
  public: {
    appEnv: 'development',               // ← NUXT_PUBLIC_APP_ENV overrides this
    siteUrl: 'http://localhost:3001',     // ← NUXT_PUBLIC_SITE_URL overrides this
  },
}
```

- **Remove** unused runtimeConfig keys (defined but never accessed via `useRuntimeConfig()`)
- **Add** missing keys (used via `useRuntimeConfig()` in code but not defined in runtimeConfig)

### Step 4: Update process.env References in nuxt.config.ts Module Configs

Module configurations (e.g., plausible, auth, seo) run at **build time** — `useRuntimeConfig()` is NOT available there.

- Keep `process.env.NUXT_*` but update to the new variable name
- Example: `process.env.PLAUSIBLE_API_URL` → `process.env.NUXT_PLAUSIBLE_API_URL`

### Step 5: Migrate Server Routes (server/)

- Replace `process.env.X` with `useRuntimeConfig(event).camelCaseName`
- Example:

```ts
// Before
const apiUrl = process.env.API_URL;

// After
const config = useRuntimeConfig(event);
const apiUrl = config.apiUrl;
```

- Ensure `event` is available in the handler function parameters

### Step 6: Update External Config Files

Files like `openapi-ts.config.ts`, `playwright.config.ts` are standalone Node scripts without Nuxt runtime — `useRuntimeConfig()` is NOT available.

- Only update the variable name to use `NUXT_*` prefix
- Example: `process.env.API_URL` → `process.env.NUXT_API_URL`

### Step 7: Migrate Vue Components and Composables

- All `process.env` usage in `.vue` files and composables must be replaced with `useRuntimeConfig()`
- Never use `process.env` in Vue components or composables

```ts
// Before
const url = process.env.SITE_URL;

// After
const config = useRuntimeConfig();
const url = config.public.siteUrl;
```

### Step 8: Update Docker and CI Environment Files

Check for old variable names in deployment-related files:

- `docker-compose.yml` / `docker-compose.*.yml` — environment sections
- `.env.production`, `.env.staging`, `.env.test` — deployment-specific env files
- CI/CD configs (`.gitlab-ci.yml`, `.github/workflows/*.yml`) — pipeline variables

Update all references to use the new `NUXT_*` / `NUXT_PUBLIC_*` variable names.

### Step 9: Validate

Run automatic checks:

```bash
npm run lint
npm run build
```

Fix all errors and warnings.

## Final Checklist

- [ ] All `.env` variables use `NUXT_` or `NUXT_PUBLIC_` prefix (except Node.js built-ins)
- [ ] `.env.example` matches `.env` structure
- [ ] `runtimeConfig` in `nuxt.config.ts` contains only default values (no `process.env`)
- [ ] Module configs in `nuxt.config.ts` use `process.env.NUXT_*` (build-time only)
- [ ] Server routes use `useRuntimeConfig(event)` instead of `process.env`
- [ ] External configs use updated `NUXT_*` variable names
- [ ] No `process.env` in Vue components or composables
- [ ] Docker, CI/CD, and deployment env files use updated variable names
- [ ] `npm run lint` passes
- [ ] `npm run build` passes
