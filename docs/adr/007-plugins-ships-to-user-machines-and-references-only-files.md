# ADR-007: `plugins/` ships to user machines and references only files inside `plugins/`; repository tooling lives in `.claude/` and never ships

**Date:** 2026-01-09 · **Status:** accepted · **Topic:** Plugin architecture
**Origin:** reconstructed 2026-11-18 from git history, CLAUDE.md

## Context

The first hooks pointed at `$CLAUDE_PROJECT_DIR/plugins/lt-dev/hooks/scripts/…` (16a4fce, 2025-12-18), a path that
exists only inside this repository. With the docs cache (ADR-006) the repository gained more files that plugin
elements could be tempted to reference. Version 2.4.2 (a134188, 2026-01-09, "… with plugin isolation") added the
`CLAUDE.md` section "Important: Plugin Isolation", and version 2.4.4 (f3d631e, 2026-01-12) fixed the hook paths "to
use CLAUDE_PLUGIN_ROOT for correct resolution on client installations".

## Decision

- `plugins/` is what reaches user machines. An element in `plugins/` references only files inside `plugins/`,
  through `${CLAUDE_PLUGIN_ROOT}`, never `.claude/`, `scripts/`, `CLAUDE.md` or a path in this checkout.
- Plugin elements that need Claude Code documentation fetch it from public sources (WebFetch of GitHub raw files,
  WebSearch), not from `.claude/docs-cache/`.
- Repository tooling (docs cache, cache scripts, the optimizer skill, agents and command) lives in `.claude/`. It may
  read everything in the repository, `plugins/` included, and never ships.

## Rationale

- `CLAUDE.md`, "Important: Plugin Isolation" (a134188): "The `plugins/` directory is deployed to client machines and
  runs in isolation", so elements in `plugins/` "**cannot** access `.claude/docs-cache/`, `.claude/scripts/`, or any
  other repository files".
- f3d631e: "Fix hook script paths to use CLAUDE_PLUGIN_ROOT for correct resolution on client installations".

## Rejected alternatives

- **Paths relative to the project directory** (`$CLAUDE_PROJECT_DIR/plugins/lt-dev/hooks/scripts/…`, 16a4fce): they
  resolve only inside this repository; replaced by `${CLAUDE_PLUGIN_ROOT}` (f3d631e).

## Consequences

- Knowledge a plugin needs is inside the plugin (a skill's `reference/` files) or fetched at run time; the docs cache
  cannot be shared with users.
- Teaching material inside a plugin (`developing-claude-plugins`) is checked against the cache by the optimizer
  rather than reading it (house rule 5).
- House rule 27 states the same boundary for optimizer findings.

## Evidence

- 16a4fce (2025-12-18): `plugins/lt-dev/hooks/hooks.json` commands `bash "$CLAUDE_PROJECT_DIR/plugins/lt-dev/hooks/scripts/…"`
- a134188 (2026-01-09) "chore: bump version to 2.4.2", body "Implement docs-cache infrastructure for code.claude.com
  documentation with plugin isolation": `CLAUDE.md` section "Important: Plugin Isolation"
- f3d631e (2026-01-12) "chore: bump version to 2.4.4", body "Fix hook script paths to use CLAUDE_PLUGIN_ROOT for
  correct resolution on client installations"
- `plugins/*/hooks/hooks.json` (every command under `${CLAUDE_PLUGIN_ROOT}`); house rules 5, 27
