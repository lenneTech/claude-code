# ADR-011: Framework API knowledge ships inside the lt framework packages; lt-dev hooks and skills point Claude at those files in `node_modules` instead of restating the API

**Date:** 2026-04-04 · **Status:** accepted · **Topic:** Plugin architecture
**Origin:** reconstructed 2026-11-18 from docs/FRAMEWORK-COMPATIBILITY.md, git history

## Context

`docs/FRAMEWORK-COMPATIBILITY.md`, added with version 7.9.0 (acde435, 2026-04-04, "guide agents to read framework
source before guessing via hooks and skills"), records the problem: Claude Code treated `@lenne.tech/nest-server` and
`@lenne.tech/nuxt-extensions` "as black boxes" and regularly failed at the correct use of framework APIs, at error
diagnosis ("guesses instead of reading source code") and at extending core modules, although lt-dev carried "260+
KB, 14 reference documents".

## Decision

A three-layer approach, recorded in `docs/FRAMEWORK-COMPATIBILITY.md`:

1. The framework packages ship their own knowledge in their npm `files`: nest-server publishes `CLAUDE.md`, a
   `FRAMEWORK-API.md` generated from its source, `.claude/rules/`, `docs/` and `migration-guides/`; nuxt-extensions
   publishes its `CLAUDE.md`.
2. The starters' `CLAUDE.md` points at those files in `node_modules`.
3. lt-dev's detection hooks (`detect-nest-server.sh`, `detect-nuxt.sh`) inject the concrete paths, and the
   `generating-nest-servers` and `developing-lt-frontend` skills carry a "Framework Source Files (read before
   guessing)" table.

The API surface is kept in the framework repository, generated from source; lt-dev teaches where to read, not a copy
of the API.

## Rationale

`docs/FRAMEWORK-COMPATIBILITY.md:24`, "Why the Plugin Alone Isn't Enough":

- "Skills load only on trigger"
- "260 KB exceeds context — even when loaded, much is compressed/discarded"
- "The hook only says 'use Skill X'", giving "no concrete file paths or API info"
- "Abstract pattern descriptions instead of actual TypeScript interfaces and method signatures"

`docs/FRAMEWORK-COMPATIBILITY.md:66`: "Claude Code does NOT automatically read `CLAUDE.md` from `node_modules/`.
That's why Layer 2 is needed."

## Rejected alternatives

- **The plugin alone carries the framework knowledge** (the state before 2026-04-04): see the reasons above.

## Consequences

- An API change in nest-server or nuxt-extensions is documented in that repository and reaches projects with the
  package version.
- lt-dev hooks have to find `node_modules` in monorepo layouts (`projects/api/`, `packages/api/`, `apps/api/`).
- A skill that restates an API signature can drift from the package; the skills point at the source instead.

## Evidence

- acde435 (2026-04-04) "chore: bump version to 7.9.0", body "feat: guide agents to read framework source before
  guessing via hooks and skills": adds `docs/FRAMEWORK-COMPATIBILITY.md`
- `docs/FRAMEWORK-COMPATIBILITY.md:24-30`, `:66`, sections "Layer 1" to "Layer 3" and "Option A" to "Option C"
- `plugins/lt-dev/hooks/scripts/detect-nest-server.sh`, `detect-nuxt.sh`;
  `plugins/lt-dev/skills/generating-nest-servers/SKILL.md:317`, `plugins/lt-dev/skills/developing-lt-frontend/SKILL.md:60`
