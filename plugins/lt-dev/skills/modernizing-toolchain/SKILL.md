---
name: modernizing-toolchain
description: 'Migrates lenne.tech projects from the legacy jest+eslint+prettier toolchain to the current vitest+oxlint+oxfmt baseline used by nest-server-starter and nuxt-base-starter. Covers swc decoratorMetadata config, the @Prop union-type fix for SWC, supertest default-import correction, ESM/CJS interop, the Nitro PORT-vs-NITRO_PORT bug, ANSI escape stripping in workspace runners (lerna/nx), free-port logic for check-server-start.sh, the offers-pattern config.env.ts (NSC__-only + fail-fast + auto-derived appUrl), and the multi-phase check-envs.sh smoke test. Activates whenever someone is migrating an existing project to the new toolchain, debugging "Cannot determine a type for the X field" Mongoose errors, ERR_SOCKET_BAD_PORT crashes from check-server-start, or wants to align an existing project with the current starter conventions.'
---

# Modernizing the lenne.tech Toolchain

## When This Skill Activates

- Migrating an existing API/App from jest → vitest, eslint → oxlint, prettier → oxfmt
- Adopting the `check` / `check:fix` / `check:envs` pipeline used by the starters
- Debugging Mongoose `"Cannot determine a type for the X field (union/intersection/ambiguous type was used)"` after switching to vitest+SWC
- Debugging `ERR_SOCKET_BAD_PORT` from `node .output/server/index.mjs` in any check pipeline
- Debugging missing or stale `types.gen.ts` after a Nuxt update
- Aligning a project with the current `config.env.ts` shape (NSC__-only + fail-fast + helper functions)
- Cleaning up phantom Unix-domain-sockets named `[33m12345[39m` in the project root

## Reference Repositories (public)

All references in this skill are to the public lenne.tech repos. **Never reference local clone paths in skill output**:

- API starter: <https://github.com/lenneTech/nest-server-starter>
- API framework: <https://github.com/lenneTech/nest-server>
- App starter: <https://github.com/lenneTech/nuxt-base-starter>
- App framework: <https://github.com/lenneTech/nuxt-extensions>
- Monorepo template: <https://github.com/lenneTech/lt-monorepo>
- CLI: <https://github.com/lenneTech/cli>

## The Migration Checklist (full pipeline)

Apply these in order. Each phase has a clear "done" signal — proceed only when met.

### Phase 1 — Inventory

1. Detect project shape: monorepo (`projects/api`, `projects/app`) vs single-package?
2. Detect package manager: `npm` (check `package-lock.json`) vs `pnpm` (check `pnpm-lock.yaml`).
3. Detect baseline toolchain in EACH subproject:
   - jest? → `jest-e2e.json` or `jest.config.*` exists
   - eslint? → `eslint.config.*` or `.eslintrc.*` exists
   - prettier? → `.prettierrc*` exists
   - vitest? → `vitest.config.ts` or `vitest-e2e.config.ts` exists
   - oxlint? → `oxlint.json` exists
4. Detect deployment shape: GitLab CI? Docker Compose? both?

The migration is identical regardless of mode (monorepo / single, npm / pnpm) — only the invocation
syntax changes. Examples in this skill use `npm run` for npm projects and `pnpm run` for pnpm projects;
substitute as appropriate.

### Phase 2 — API: jest → vitest

1. **Install dev dependencies**:
   ```
   <pm> add -D vitest @vitest/coverage-v8 @vitest/ui unplugin-swc vite-plugin-node
   ```
   Pin `vitest` to the same version the upstream `nest-server-starter` uses (check
   `https://raw.githubusercontent.com/lenneTech/nest-server-starter/main/package.json`).

2. **Create `vitest-e2e.config.ts`** at the API root. The exact swc options are mandatory —
   anything missing causes silent test failures with confusing error messages:
   ```ts
   import swc from 'unplugin-swc';
   import { defineConfig } from 'vitest/config';

   export default defineConfig({
     plugins: [
       swc.vite({
         jsc: {
           target: 'es2022',
           transform: {
             decoratorMetadata: true,    // required: NestJS DI + Mongoose @Prop need this
             legacyDecorator: true,      // required: nest uses pre-stage-3 decorators
             useDefineForClassFields: true, // must MATCH tsconfig.useDefineForClassFields
           },
         },
       }),
     ],
     test: {
       environment: 'node',
       exclude: ['tests/helpers/**/*', 'tests/fixtures/**/*', 'tests/global-setup.ts', 'tests/report.js'],
       fileParallelism: false,           // sequential: each test boots a NestJS app
       globals: true,
       globalSetup: ['tests/global-setup.ts'],
       hookTimeout: 60000,
       include: ['tests/**/*.e2e-spec.ts'],
       isolate: true,
       maxConcurrency: 1,
       pool: 'forks',                    // forks > threads for NestJS
       reporters: ['default'],
       retry: 3,                         // mongo race conditions are flaky
       root: './',
       teardownTimeout: 30000,
       testTimeout: 30000,
       watch: false,
     },
   });
   ```

3. **Create `vitest.config.ts`** for unit specs (slim, mostly defaults):
   ```ts
   import swc from 'unplugin-swc';
   import { defineConfig } from 'vitest/config';

   export default defineConfig({
     plugins: [swc.vite()],
     test: {
       environment: 'node',
       globals: true,
       include: ['src/**/*.spec.ts'],
       root: './',
     },
   });
   ```

4. **Create `tests/global-setup.ts`** that drops the e2e DB before the run:
   ```ts
   import { MongoClient } from 'mongodb';

   export async function setup() {
     const uri = process.env.NSC__MONGOOSE__URI || 'mongodb://127.0.0.1/<your-db>-e2e';
     const c = await MongoClient.connect(uri);
     await c.db().dropDatabase();
     await c.close();
   }
   ```
   Do NOT import `src/config.env` here — it runs outside the swc pipeline and will fail with
   `Cannot find module './src/config.env'`.

5. **Update `tsconfig.json`**:
   ```jsonc
   {
     "compilerOptions": {
       "target": "es2022",                     // bump from es2020 — needed for `new Error(msg, { cause })`
       "useDefineForClassFields": true,        // MUST match swc setting above
       "types": ["vitest/globals"]              // describe/it/expect/vi available without per-file imports
     }
   }
   ```

6. **Migrate all `jest.*` calls** to `vi.*`:
   - `jest.spyOn` → `vi.spyOn`
   - `jest.fn` → `vi.fn`
   - `jest.mock` → `vi.mock`
   - `jest.restoreAllMocks` → `vi.restoreAllMocks`
   - `jest.clearAllMocks` → `vi.clearAllMocks`
   - `jest.resetAllMocks` → `vi.resetAllMocks`

   Watch for **multi-line patterns**:
   ```ts
   const fetchSpy = jest    // <- stays here on its own line
     .spyOn(globalThis, 'fetch')
   ```
   `sed 's/jest\.spyOn/vi.spyOn/g'` won't catch this. Run it again as
   `sed 's/^[[:space:]]*const \([a-zA-Z]*\) = jest$/  const \1 = vi/' || grep "jest$" tests/`.

7. **Replace `import * as supertest`** with default import:
   ```diff
   -import * as supertest from 'supertest';
   +import supertest from 'supertest';
   ```
   The namespace form resolves to `{ default: <function> }` under SWC's CJS↔ESM interop and breaks
   the call site.

8. **The @Prop union-type fix (CRITICAL)**: SWC's `decoratorMetadata` emits `Object` for TypeScript
   union types, where `ts-jest` emits `String`. Mongoose rejects `Object` with:
   ```
   Cannot determine a type for the "MyModelClass.statusField" field
   (union/intersection/ambiguous type was used). Make sure your property
   is decorated with a "@Prop({ type: TYPE_HERE })" decorator.
   ```

   **Fix every `@Prop`** whose property has a union/literal-union TypeScript type by adding
   `type: String` (or `type: Object` for record-like unions):
   ```diff
   -@Prop({ default: 'none' }) transform?: TransformKind;
   +@Prop({ default: 'none', type: String }) transform?: TransformKind;

   -@Prop({ enum: [...], required: true }) mode: AuthMode;
   +@Prop({ enum: [...], required: true, type: String }) mode: AuthMode;

   -@Prop({ default: null }) someId: null | string;
   +@Prop({ default: null, type: String }) someId: null | string;
   ```
   Sweep with: `grep -rn "@Prop" src/server/modules/ | grep -v "type:" | head`. Inspect each match,
   add `type:` if the property type is a literal union (e.g. `'a' | 'b'`), a renamed type alias for
   such a union, or `null | string`.

9. **Update package.json scripts**:
   ```jsonc
   {
     "scripts": {
       "test": "<pm> run vitest",
       "test:ci": "<pm> run vitest:ci",
       "test:e2e": "<pm> run vitest",
       "vitest": "NODE_ENV=e2e vitest run --config vitest-e2e.config.ts",
       "vitest:ci": "NODE_ENV=ci vitest run --config vitest-e2e.config.ts",
       "vitest:cov": "NODE_ENV=e2e vitest run --coverage --config vitest-e2e.config.ts",
       "vitest:watch": "NODE_ENV=e2e vitest --config vitest-e2e.config.ts",
       "vitest:unit": "vitest run --config vitest.config.ts"
     }
   }
   ```

10. **Remove jest artifacts**:
    - delete `jest-e2e.json`, `babel.config.js`, `tests/report.js`
    - uninstall `jest`, `@types/jest`, `babel-jest`, `@babel/preset-env`,
      `@babel/plugin-proposal-private-methods`, `ts-jest`, `@swc/jest`

### Phase 3 — API: eslint → oxlint, prettier → oxfmt

1. **Install**: `<pm> add -D oxlint oxfmt`. Pin to the same versions used by `nest-server-starter`.

2. **Create `.oxlintrc.json`** (matches the starter):
   ```jsonc
   {
     "$schema": "./node_modules/oxlint/configuration_schema.json",
     "plugins": ["typescript", "import", "unicorn"],
     "categories": { "correctness": "warn", "suspicious": "warn" },
     "env": { "browser": false, "node": true },
     "rules": {
       "eqeqeq": "warn",
       "no-console": ["warn", { "allow": ["warn", "error", "info", "debug", "trace", "time", "timeEnd", "group", "groupEnd"] }],
       "no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "caughtErrors": "none", "varsIgnorePattern": "^_" }],
       "no-extraneous-class": "off"
     },
     "overrides": [
       {
         "files": ["tests/**", "scripts/**"],
         "rules": { "no-unused-vars": "off", "no-console": "off" }
       }
     ]
   }
   ```

3. **Create `.oxlintignore`**: `node_modules`, `dist`, `*.d.ts`, `**/migrate/templates/**`,
   `temp/`, `uploads/`, `scripts/benchmark-fixtures/`.

4. **Update package.json**:
   ```jsonc
   {
     "lint": "oxlint --ignore-path .oxlintignore src/ tests/",
     "lint:fix": "oxlint --fix --fix-suggestions --ignore-path .oxlintignore src/ tests/",
     "format": "oxfmt --write src/ tests/",
     "format:check": "oxfmt --check src/ tests/"
   }
   ```

5. **Remove eslint/prettier**: `eslint`, `@typescript-eslint/*`, `eslint-config-prettier`,
   `eslint-plugin-unused-imports`, `prettier`, `pretty-quick`, plus the configs
   `eslint.config.*`, `.eslintrc.*`, `.prettierrc*`.

6. **First run will surface previously-hidden issues** — fix them inline. Common ones:
   - `== null` → `=== null || === undefined`
   - `new Array(n).fill(0)` → `Array.from({ length: n }, () => 0)`
   - `new Promise(async (resolve) => …)` → drop `async` from the executor
   - `'foo' + \`bar${x}\`` → `\`foobar${x}\`` (single template literal)

### Phase 4 — App: jest/eslint/prettier → vitest/oxlint/oxfmt

The same migration, with Nuxt-specific deltas:

1. **Install**: `<pm> add -D oxlint oxfmt vitest @vitest/coverage-v8 @vitejs/plugin-vue @vue/test-utils happy-dom`.

2. **`vitest.config.ts`** uses `@vitejs/plugin-vue` (not swc) and `happy-dom`:
   ```ts
   import vue from '@vitejs/plugin-vue';
   import { fileURLToPath } from 'node:url';
   import { defineConfig } from 'vitest/config';

   export default defineConfig({
     plugins: [vue()],
     test: {
       environment: 'happy-dom',
       include: ['tests/unit/**/*.{test,spec}.ts'],
       globals: true,
       setupFiles: ['tests/unit/setup.ts'],
       coverage: { provider: 'v8', reporter: ['text', 'json', 'html'], include: ['app/**/*.{ts,vue}'] },
     },
     resolve: {
       alias: {
         '~': fileURLToPath(new URL('./app', import.meta.url)),
         '#imports': fileURLToPath(new URL('./tests/unit/mocks/nuxt-imports.ts', import.meta.url)),
       },
     },
   });
   ```

3. **`tests/unit/setup.ts`** stubs `window.location` and `document.cookie`. **`tests/unit/mocks/nuxt-imports.ts`**
   re-exports Vue reactivity (`ref`, `computed`, …) plus mocks `useNuxtApp`, `useRuntimeConfig`,
   `navigateTo`, `useRoute`, `useRouter`, `useState`, `useFetch`, `$fetch`. See nuxt-base-starter
   for the canonical shapes.

4. **`oxlint.json`** uses `["typescript", "vue", "unicorn", "import"]` plugins (vue is the addition
   over the API config).

5. **Sync the full dep set to the upstream starter** — both `dependencies` and
   `devDependencies`. The starter's `package.json` is the single source of truth; do not
   cherry-pick. Major bumps are expected at this phase. Two general rules apply:
   - When a `Rollup failed to resolve import "X"` (or the equivalent module-not-found at
     install time) appears after the bump, "X" is usually a peer dependency that the
     restructured wrapper package no longer transitively pulls in. Add it as a direct
     dependency in `package.json` — even if no app code imports it directly.
   - Read the CHANGELOG of any package whose major version moves and surface the breaking
     notes in the migration log. The operator decides which deltas need follow-up code work.

6. **Remove**: `eslint`, `@lenne.tech/eslint-config-vue`, `prettier`, `pretty-quick`, `jsdom`
   (replaced by happy-dom), plus the configs.

### Phase 5 — `check` pipeline

Adopt these scripts in EACH subproject (api + app). The shape mirrors `nest-server-starter` and
`nuxt-base-starter` exactly:

```jsonc
{
  "audit": "<pm> audit --omit=dev || echo '\\n[check] audit reported issues; continuing.'",
  "check":     "<pm> run audit && <pm> run format:check && <pm> run lint && <pm> run test && <pm> run build && bash scripts/check-server-start.sh",
  "check:fix": "<pm> install && <pm> run format && <pm> run lint:fix && <pm> run test && <pm> run build && bash scripts/check-server-start.sh",
  "check:naf": "<pm> install && <pm> run format && <pm> run lint:fix && <pm> run test && <pm> run build && bash scripts/check-server-start.sh",
  "check:envs":        "bash scripts/check-envs.sh",
  "check:envs:docker": "bash scripts/check-envs.sh --docker"
}
```

For monorepos, add a root `package.json` aggregator:
```jsonc
{
  "check":     "lerna run --concurrency 1 check",
  "check:fix": "lerna run --concurrency 1 check:fix",
  "check:envs":        "cd projects/api && <pm> run check:envs",
  "check:envs:docker": "cd projects/api && <pm> run check:envs:docker"
}
```
`--concurrency 1` is **mandatory** so api and app don't fight over MongoDB or ports.

### Phase 6 — `scripts/check-server-start.sh` (port-robust + ANSI-safe)

Both API and App ship a bash smoke-test that boots the production build and waits for the
readiness log line. **Two non-obvious bugs you must guard against** — both produce the same
symptom, `ERR_SOCKET_BAD_PORT` from `node:net`:

1. **The Nitro PORT-string bug** (App only): some Nitro releases do not `parseInt`
   `process.env.PORT` and feed the raw string to `net.Server#listen`. **Use `NITRO_PORT`, not
   `PORT`** — `NITRO_PORT` goes through Nitro's own env loader and is coerced to number. Nest
   does not have this bug; `NSC__PORT` is fine. Even after Nitro upstream patches the bug,
   prefer `NITRO_PORT` — it is the documented Nitro-specific knob and survives any future
   regression.

2. **The lerna/nx ANSI-injection bug** (both): When `npm run check` is invoked from a workspace
   runner, the runner wraps subprocess stdout and may inject ANSI color escape sequences
   (`\x1b[33m...\x1b[39m`) into command output. A naive `FREE_PORT=$(node -e "...console.log(p)")`
   captures the codes too. The downstream `NITRO_PORT=$FREE_PORT` then becomes
   `NITRO_PORT='\x1b[33m54546\x1b[39m'` and crashes Nitro/Nest. A naive `tr -cd '0-9'` makes it
   worse — the codes contain digits (33, 39) themselves, producing nonsense ports like 335454639.

   **The right fix is to strip the escape sequences explicitly with sed**:
   ```bash
   FREE_PORT=$(node -e "const s=require('net').createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>console.log(p));});" \
     | sed $'s/\x1b\\[[0-9;]*m//g' \
     | tr -d '[:space:]')
   ```

   The `sed` keeps port digits intact; the `tr` drops trailing whitespace.

3. **Phantom Unix-domain-sockets**: If a check-server-start ran without the ANSI fix, you may find
   files named `[33m12345[39m` next to the package.json with mode `srwx`. Those are Unix sockets
   Nest opened when its port-parser fell through to "treat as path". Delete with:
   ```bash
   rm -f $'\x1b[33m'*$'\x1b[39m'
   ```

The full canonical script lives in nest-server-starter and nuxt-base-starter on GitHub; copy from
there and apply the ANSI strip.

### Phase 7 — `config.env.ts` (offers/starter pattern)

Goal: **the project must boot in `local`, `e2e`, and `ci` mode without any `.env` file**, and
must **fail-fast** on missing `NSC__*` vars in `develop`/`test`/`production`.

The canonical shape:
- `localConfig(envName, options)` helper — returns a config with public dummy secrets.
- `deployedConfig(envName, options)` helper — no secrets in code; reads everything from `NSC__*`.
- `REQUIRED_DEPLOYED_ENV_VARS` array — single source of truth for both the runtime fail-fast
  guard and the `.env.example` documentation.
- Auto-derive `appUrl` from `baseUrl` (strip leading `api.`) — operators only set `NSC__BASE_URL`.
- `ci.mongoose.uri` defaults to `127.0.0.1` (NOT `mongo:27017`) so `check:envs` Phase 1 works
  outside Docker. CI pipelines override via `NSC__MONGOOSE__URI`.

The fail-fast guard at the bottom of `config.env.ts`:
```ts
const resolved = getEnvironmentConfig({ config });
if (resolved.baseUrl && !resolved.appUrl) {
  try { const url = new URL(resolved.baseUrl);
    if (url.hostname.startsWith('api.')) url.hostname = url.hostname.slice(4);
    resolved.appUrl = url.origin;
  } catch { /* leave undefined */ }
}
const DEPLOYED = new Set(['develop', 'test', 'production']);
if (DEPLOYED.has(resolved.env)) {
  const missing = REQUIRED_DEPLOYED_ENV_VARS
    .filter(({ condition }) => !condition || condition(resolved))
    .filter(({ check }) => !check(resolved))
    .map(({ envVar }) => envVar);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables for NODE_ENV='${resolved.env}': ${missing.join(', ')}.`);
  }
}
export default resolved;
```

### Phase 8 — `scripts/check-envs.sh` + `tests/fixtures/.env.deployed-test`

The check-envs script verifies all six NODE_ENVs. Phase 1 runs without a `.env` (local/e2e/ci must
start, develop/test/production must fail-fast). Phase 2 with a fixture `.env` (all six must
start). Phase 3 (optional, `--docker`) repeats inside the production image.

Fixture `tests/fixtures/.env.deployed-test` carries public dummy values for every required
NSC__* var. Generate fresh dummies — never reuse real secrets.

### Phase 9 — `main.ts` (offers pattern)

Three deltas over the starter default:

1. **Log levels via env**: in `local`/`e2e` default to `['warn', 'error']`; everywhere else
   `['log', 'warn', 'error']`. Override via `LOG_LEVELS` env (comma-separated).

2. **Explicit CORS for deployed envs**: in `local`/`e2e`/`ci` keep `enableCors({})` (allow all);
   for deployed envs build a strict allow-list from `localhost:3001`, `127.0.0.1:3001`,
   `envConfig.appUrl`, and `process.env.CORS_ALLOWED_ORIGINS` (comma-separated).

3. **`QuietHttpExceptionFilter`** instead of the framework `HttpExceptionLogFilter`: silence 4xx
   client noise (socket.io probes, /sw.js, /.well-known/* CLI probes), keep 5xx loud with stack.
   Implementation in offers; copy.

### Phase 10 — GitLab CI

Two stages (`test`, `build`). Cache root + per-subproject `node_modules`. Jobs:

- `lint`: oxlint + oxfmt:check (api), lint (app)
- `audit`: `allow_failure: true`, prints findings only
- `api:test`: vitest e2e against MongoDB service alias
- `app:test`: Playwright with full api+app server bring-up (mirrors offers)
- `check:envs`: six-env smoke matrix in CI with MongoDB service
- `build`: api + app build

### Phase 11 — `docker-compose.yml`

- Healthchecks on api (`wget -q -O - http://localhost:3000/`) and app (`wget … :3001/`).
- `app: depends_on: api: condition: service_healthy` (not `service_started`).
- Use the canonical `NSC__JWT__SECRET` / `NSC__JWT__REFRESH__SECRET` / `NSC__MONGOOSE__URI`
  passthroughs, not the legacy `JWT_SECRET_LOCAL` form.

## Done Signals

After all phases, both must be true:

1. `<pm> run check` from the monorepo root prints
   ```
   Lerna (powered by Nx)   Successfully ran target check for 2 projects
   ```
   with both api and app green (audit + format:check + lint + test + build + check-server-start).

2. `<pm> run check:envs` (api) prints `All env configurations OK.` (six envs across two phases).

3. **No tests skipped, no warnings tolerated**: pre-existing failures in either subproject must be
   fixed as part of the migration, not silenced. The `check` pipeline is intentionally strict —
   silencing it here defeats the purpose of bringing the project to the current baseline.

## Skill Boundaries

| User Intent | Correct Skill |
|------------|---------------|
| "Migrate to vitest" / "switch to oxlint" / "modernize the toolchain" | **THIS SKILL** |
| "Bump nest-server to a newer minor" | `nest-server-updating` |
| "Update all packages" / "audit + fix" | `maintaining-npm-packages` |
| "Run my check pipeline" / "check failed" | `running-check-script` (this skill cross-references it) |
| "Build a new feature" / "add a service" | `generating-nest-servers` or `developing-lt-frontend` |
