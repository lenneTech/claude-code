# Claude Code + lenne.tech Frameworks: Compatibility Strategy

> Full strategy document for the cross-repository framework compatibility system.
> Condensed maintenance rules for nest-server: `nest-server/.claude/rules/framework-compatibility.md`

## Problem Statement

Claude Code treats `@lenne.tech/nest-server` and `@lenne.tech/nuxt-extensions` as black boxes. Although the plugin (`claude-code/plugins/lt-dev`) provides extensive documentation (260+ KB, 14 reference documents), Claude regularly fails at:

- Correct usage of framework APIs (wrong parameters, missing options)
- Error diagnosis (guesses instead of reading source code)
- Extending core modules (doesn't understand inheritance patterns)

## Root Cause Analysis

### The 3 Gaps

| Gap | Problem | Impact |
|-----|---------|--------|
| **No Auto-Read** | Claude doesn't know it can/should read framework source from `node_modules/` | Guesses instead of reading `server-options.interface.ts` |
| **Abstract vs Concrete** | Plugin teaches patterns, not the actual API surface | Knows "forRoot() exists" but not which parameters |
| **No Entry-Point Knowledge** | Claude doesn't know the key files | Searches blindly instead of reading `src/core.module.ts` |

### Why the Plugin Alone Isn't Enough

1. **Skills load only on trigger** — if the prompt doesn't contain "module", "controller" etc., the skill isn't loaded
2. **260 KB exceeds context** — even when loaded, much is compressed/discarded
3. **The hook only says "use Skill X"** �� gives no concrete file paths or API info
4. **Only 1 reference to `node_modules`** in the skill (`CrudService`) — all other internal files are not referenced
5. **Abstract pattern descriptions** instead of actual TypeScript interfaces and method signatures

## Solution: 3-Layer Approach + Options

### Layer 1: npm Package Ships Framework Knowledge

**Status:** DONE

#### nest-server (v11.22.0+)

`package.json` `files` array extended:
```json
"files": [
  "dist/**/*", "src/**/*", "bin/**/*",
  "CLAUDE.md", "FRAMEWORK-API.md",
  ".claude/rules/**/*", "docs/**/*", "migration-guides/**/*"
]
```

**Result:** Every project with `@lenne.tech/nest-server` has in `node_modules/`:
- `CLAUDE.md` — Framework rules, architecture, debugging guide
- `FRAMEWORK-API.md` — Auto-generated compact API reference (~18 KB)
- `.claude/rules/` — 12 rule files (roles, modules, testing, etc.)
- `docs/REQUEST-LIFECYCLE.md` — Complete request lifecycle
- `migration-guides/` — All migration guides

#### nuxt-extensions (v1.5.1+)

`package.json` `files` array extended:
```json
"files": ["dist", "CLAUDE.md"]
```

**Result:** Every project with `@lenne.tech/nuxt-extensions` has in `node_modules/`:
- `CLAUDE.md` — Composables, components, configuration, patterns

**Key limitation:** Claude Code does NOT automatically read `CLAUDE.md` from `node_modules/`. That's why Layer 2 is needed.

---

### Layer 2: Project CLAUDE.md with Framework Instructions

**Status:** DONE

#### nest-server-starter

Framework block added to `CLAUDE.md`:
- Key Source Files table pointing to `node_modules/@lenne.tech/nest-server/`
- 6 mandatory rules (always read source, never re-implement, read parent class, etc.)

#### nuxt-base-starter

`CLAUDE.md` created with:
- Project overview, tech stack, standards
- Framework block for `@lenne.tech/nuxt-extensions` with key source files

---

### Layer 3: Plugin Hook Enhancement

**Status:** DONE

#### detect-nest-server.sh

Detects the `node_modules` path and injects concrete source paths:
- Searches project root and monorepo patterns (`projects/api/`, `packages/api/`, `apps/api/`)
- Injects: `CLAUDE.md`, `FRAMEWORK-API.md`, `src/core.module.ts`, `server-options.interface.ts`, `crud.service.ts`

#### detect-nuxt.sh

Analogous: detects `@lenne.tech/nuxt-extensions` and injects `CLAUDE.md` path.

---

### Option A: Auto-Generated FRAMEWORK-API.md

**Status:** DONE

Build script `scripts/generate-framework-api.ts` in nest-server:
- Uses ts-morph to extract from source code:
  - `CoreModule.forRoot()` signatures
  - `IServerOptions` top-level fields with types and defaults
  - `ICoreModuleOverrides` override fields
  - `IBetterAuth` and sub-interfaces
  - `CrudService` method signatures
  - Core module listing with documentation status
- Output: `FRAMEWORK-API.md` (~18 KB, machine-readable)
- Integrated into `pnpm run build` and `package.json` `files`

### Option B: Skill References to Source Paths

**Status:** DONE

#### generating-nest-servers Skill

New "Framework Source Files (MUST READ before guessing)" section with 10-entry table:
- `CLAUDE.md`, `FRAMEWORK-API.md`, `src/core.module.ts`
- `server-options.interface.ts`, `service-options.interface.ts`
- `crud.service.ts`, `INTEGRATION-CHECKLIST.md`, `docs/REQUEST-LIFECYCLE.md`

#### developing-lt-frontend Skill

Analogous section for `@lenne.tech/nuxt-extensions` source paths.

### Option C: nuxt-extensions Same Approach

**Status:** DONE

- `CLAUDE.md` in npm package (via `files` in package.json)
- `nuxt-base-starter` CLAUDE.md with framework block
- `detect-nuxt.sh` hook enhanced with framework hint
- `developing-lt-frontend` skill extended with source paths

---

## Affected Repositories

| Repository | Changes | Layer |
|-----------|---------|-------|
| `nest-server` | `package.json` files, `FRAMEWORK-API.md` generator, `.claude/rules/framework-compatibility.md` | 1 + A |
| `nest-server-starter` | `CLAUDE.md` framework block | 2 |
| `nuxt-extensions` | `CLAUDE.md` + `package.json` files | 1 (C) |
| `nuxt-base-starter` | `nuxt-base-template/CLAUDE.md` created (template dir, not root) | 2 (C) |
| `lt-monorepo` | `CLAUDE.md` created (fullstack monorepo skeleton used by `lt fullstack init`) | 2 |
| `claude-code/plugins/lt-dev` | Hooks + Skills enhanced | 3 + B |
| `claude-code/docs/` | This strategy document | — |

## Success Metrics

| Metric | Before | Target |
|--------|--------|--------|
| Claude reads framework source for framework questions | Rarely | Always |
| Correct forRoot() parameters on first attempt | ~50% | >90% |
| Correct module extension without manual correction | ~30% | >80% |
| Framework errors correctly diagnosed | ~40% | >85% |

## Validation

After deployment, test in a real project:
1. Start a new Claude Code session
2. Assign a backend task (e.g., "Create a Product module with custom ErrorCodeController")
3. Verify Claude reads source files instead of guessing
4. Verify correct interfaces are used
5. Assign a frontend task and verify nuxt-extensions source is read

## Maintenance

### nest-server Maintenance

See `nest-server/.claude/rules/framework-compatibility.md` for:
- When to regenerate `FRAMEWORK-API.md`
- How to document new interfaces
- Cross-repository dependency overview

### Plugin Maintenance

When adding new framework features:
1. Update relevant Skill reference tables (generating-nest-servers, developing-lt-frontend)
2. Update hook scripts if new detection patterns are needed
3. Update this document
