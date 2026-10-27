# Common Error Patterns & Solutions

## TypeScript Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Cannot find module '@lenne.tech/nest-server/...'` | Import path changed | Check migration guide for new paths |
| `Type 'X' is not assignable to type 'Y'` | API type changed | Update to new type signature per guide |
| `Property 'X' does not exist` | API removed/renamed | Check migration guide for replacement |
| `Class 'X' incorrectly extends base class 'CoreX'` | Two copies of a NestJS package: a `@nestjs/*` pin left behind the framework's | Raise every pin the project shares with nest-server (`pnpm run update`), then `pnpm why @nestjs/common` shows one version |
| Hundreds of `TS2322` / `TS18048` (`…is possibly 'undefined'`) | TypeScript 6 turns `strict` on by default | `"strict": false` in `tsconfig.json` |
| `TS5011 … The 'rootDir' setting must be explicitly set` | TypeScript 6 `rootDir` default | Set `rootDir` (the starter's build config uses `"./"` and starts `dist/src/main.js`) |
| `Cannot find name 'process'` / `'Buffer'` | TypeScript 6 defaults `types` to `[]` | `"types": ["node", "vitest/globals"]` |
| `TS5107 Option 'moduleResolution=node10' is deprecated` | Explicit `"moduleResolution": "node"` | `"module"` and `"moduleResolution"` `"nodenext"` (see the 12.0 guide) |
| `TS2307 Cannot find module '@nestjs/…/dist/…'` | Deep import into a package with an `exports` map | Import from the package root; derive a type that is not exported there |
| `TS2835 Relative import paths need explicit file extensions` | Relative dynamic `import()` under `nodenext` | In source: no relative dynamic `import()` at all, because no specifier works everywhere (`tsc` output needs `./x.js`, a ts-node source run does not map it to `.ts`): a static import, or move what a cycle needs into a module of its own. In test files: the test tsconfig takes `"module": "preserve", "moduleResolution": "bundler"` |
| `TS1272 A type referenced in a decorated signature must be imported with 'import type'` (ESM project, `isolatedModules`) | An interface or type alias (`ServiceOptions`, `FileUpload`, `CoreModelConstructor`) imported as a value in a decorated signature | `import type` for it; never for a class whose type drives dependency injection |

## Runtime Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Decorator not found` | Decorator moved | Import from new location |
| `Cannot read property of undefined` | Initialization changed | Check startup sequence in reference project |
| `Module not found` | Peer dependency missing | Compare package.json with reference project |
| `ERR_PACKAGE_PATH_NOT_EXPORTED` | Deep import into an `@nestjs/*` package | Import from the package root |
| `Nest can't resolve dependencies of the XService (…, ?)` | A redeclared constructor does not inherit the parent's `@Optional()` flags | Mark the optional parameter `@Optional()` on the subclass constructor |
| `node dist/main.js` → `Cannot find module` | Output moved to `dist/src/` (TypeScript 6 `rootDir`) | Set `rootDir` to match the start script |
| `DUPLICATE_SCHEDULER` at boot | Two `@Cron` / `@Interval` / `@Timeout` with the same explicit name | Rename one |
| `ERR_REQUIRE_ASYNC_MODULE` under jest | jest loads ESM-only NestJS 12 packages only on Node 24.9+ | Migrate to vitest (`modernizing-toolchain`) |
| `Error: Cannot find module './core.module.js'` (or another `.js` of the core) at `pnpm start`, vendor mode, while build, `migrate:*` and tests pass | The dev start still runs ts-node, which cannot map the 12.x core's `./x.js` imports | `nodemon.json`: `node -r ./src/core/modules/migrate/helpers/ts-compiler.js src/main.ts`; the same for `nodemon-debug.json`, `docs:ci`, `start:nodemon` (guide §14) |
| `SyntaxError: The requested module 'mongoose' does not provide an export named 'Connection'` (ESM project, production start) | A named import of a CommonJS package whose names Node's analysis misses (`mongoose`, `lodash`); vitest accepts it | `import type` for a type, the default import for a value (`import mongoose from 'mongoose'`); start the built server to prove it |
| `ReferenceError: Cannot access 'X' before initialization` at start-up (ESM project) | A decorated property or constructor parameter typed by a class from a module on an import cycle | Type it `WrapperType<X>` (nest-server export); the decorator keeps the real type through its thunk |
| `Upload value invalid.` on every GraphQL upload | The resolver's `GraphQLUpload` comes from the project's own `graphql-upload`, the `Upload` instances from nest-server's copy | `import { GraphQLUpload } from '@lenne.tech/nest-server'`; drop `graphql-upload` from `package.json` once nothing imports it |

## Test Failures

| Symptom | Cause | Solution |
|---------|-------|----------|
| Timeout errors | Async behavior changed | Check test patterns in reference project |
| Auth failures | Auth mechanism updated | Review auth changes in migration guide |
| Validation errors | DTO changes | Update DTOs per migration guide |
| A mock that counted calls from `beforeAll` or an earlier test now reports zero | vitest 5 clears mocks before every test | Set up the mock inside the test, or count only calls made in it |
| A test fails on an assertion that passed before | vitest 5 fails an un-awaited `expect(p).rejects…` / `.resolves…` | `await` the assertion |
| `vi.mock()` throws | vitest 5 hoists `vi.mock()` / `vi.hoisted()` only at the top level of a file | Move the call to the top level |
| Health check returns 500 instead of 503 | Terminus 12: a thrown indicator error is a 500; only a returned `down` is unhealthy | Custom indicators use `HealthIndicatorService` (`check(key).up()` / `.down()`) |
| `Cannot use GraphQLSchema from another module or realm`, subscriptions closing with 4500, only in vitest | Vite resolves graphql's extensionless `main` to `index.mjs` and loads a second copy | Every vitest config (unit and e2e): `resolve: { extensions: ['.js', '.mjs', '.mts', '.ts', '.jsx', '.tsx', '.json'] }` |
| ts-jest, vendor mode: `Cannot find module './x.js'` | ts-jest does not map the core's `./x.js` imports | `moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' }`, or move to vitest |
| GraphQL subscription never connects from an old client | Only `graphql-ws` (`graphql-transport-ws` protocol) is served | Move the client to the `graphql-ws` library |
