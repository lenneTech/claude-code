# ADR-015: Plugin scripts are dependency-free Node ES modules or Bash; npm dependencies and bun are for repository tooling only

**Date:** 2026-07-24 · **Status:** accepted · **Topic:** Plugin architecture
**Origin:** reconstructed 2026-11-18 from git history, plugin scripts, README.md, package.json

## Context

Plugin helper scripts started as Bash. The decision shows on or before 2026-07-24, when the first Node helper,
`pick-next-ticket.mjs` (7c5d92b), arrived with unit tests and only Node built-ins. Every later one followed:
`context-budget.mjs`, `rule-invariants.mjs`, `ai-models.mjs`, the lt-tools mirror and comparison scripts,
lt-showroom's `screenshot-session.mjs`, the eval helpers. Repository tooling outside `plugins/`
(`scripts/bump-version.ts`, `.claude/scripts/*.ts`) runs on bun with npm devDependencies (`turndown`, `playwright`).

## Decision

- A script under `plugins/` is Bash or a Node ES module (`.mjs`) that imports only `node:` built-ins. It needs no
  `npm install` and no build step on the user's machine; no plugin carries a `package.json`.
- Its tests use `node --test` or a Bash test file under `__tests__/`, and Plugin CI runs them (ADR-016).
- The runtime baseline is the README's requirement: Node.js 22 or newer.
- A tool a plugin script needs at run time is a prerequisite named in the README (jq, Chrome) or fetched through
  `npx` by exact package name and version (lt-tools: esbuild).
- bun, TypeScript and npm dependencies are for repository tooling only (`package.json` devDependencies,
  `.claude/scripts/`, `scripts/bump-version.ts`), which never ships (ADR-007).

## Rationale

- `plugins/lt-dev/evals/selftest/selftest.mjs:31`: "Dependency-free on purpose (Node 18+), like the other plugin
  scripts."
- 7294774 (lt-showroom): "screenshot-session.mjs (zero dependencies, node --test suite)".
- [inferred] A plugin is installed by copying its directory, and nothing runs `npm install` in it, so a script with
  dependencies would fail on the user's machine. Inferred from ADR-007 and from the plugins carrying no `package.json`.

## Rejected alternatives

- **TypeScript run through `npx ts-node`** in plugin code: the frontmatter hook until bb98b62 (ADR-004).

## Consequences

- Helpers that a library would usually provide are written by hand, such as a ZIP writer and a Chrome DevTools
  Protocol client (`plugins/lt-tools/scripts/lib/zip.mjs:1`, `cdp.mjs:1`, both "without dependencies").
- A script uses only Node APIs available in the stated baseline.
- `npx` calls in plugin scripts follow house rule 24f (package name, not binary name) and pass an empty `--prefix`
  (house rule 24c).

## Evidence

- 7c5d92b (2026-07-24) "chore: bump version to 7.63.0", body "… add token-saving pick-next-ticket.mjs helper plus unit
  tests"
- 7294774 (2026-10-11) "feat(lt-showroom): capture screenshots from a throwaway clone without touching anything else"
- `plugins/lt-dev/evals/selftest/selftest.mjs:31`; `plugins/lt-dev/scripts/ai-models.mjs:29`;
  `plugins/lt-tools/scripts/lib/cdp.mjs:1`, `zip.mjs:1`; `plugins/lt-showroom/README.md:92`
- `README.md:51`; `package.json` (devDependencies, bun scripts); `.github/workflows/plugin-ci.yml` steps "Bash tests"
  and "Node tests"; house rules 24c, 24f
