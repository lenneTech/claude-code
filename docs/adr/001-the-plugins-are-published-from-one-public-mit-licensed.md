# ADR-001: The plugins are published from one public, MIT-licensed GitHub repository that is a Claude Code marketplace (`lenne-tech`), one directory per plugin under `plugins/`

**Date:** 2025-12-08 · **Status:** accepted · **Topic:** Repository
**Origin:** reconstructed 2026-11-18 from git history, README.md, LICENSE, .claude-plugin/marketplace.json

## Context

The first commit (0424842, 2025-12-08) put a single plugin at the repository root:
`.claude-plugin/plugin.json` next to `commands/`, `skills/` and `hooks/`, with an MIT `LICENSE`. The same day,
version 1.0.1 (808f9b1) added `.claude-plugin/marketplace.json`, and version 1.0.4 (ebf6062, "Fix structure and
naming") moved the plugin into `plugins/<name>/`. The plugin was renamed several times that week before it settled
as `lt-dev` (eed908e, 2025-12-10, "Plugin directory renamed to lt-dev").

## Decision

- The repository is public on GitHub (`lenneTech/claude-code`) under the MIT license (`LICENSE`; every
  `plugin.json` says `"license": "MIT"`).
- It is a Claude Code marketplace named `lenne-tech`, defined in `.claude-plugin/marketplace.json`; users add it with
  `/plugin marketplace add lenneTech/claude-code` and install a plugin as `<plugin>@lenne-tech`.
- Each plugin is one directory `plugins/<name>/` with its own `.claude-plugin/plugin.json`, listed in
  `marketplace.json` with `"source": "./plugins/<name>"`. Nothing is installed from the repository root.
- Repository-level files (`CLAUDE.md`, `.claude/`, `scripts/`, `.github/`, `.githooks/`) maintain the marketplace and
  belong to no plugin (ADR-007).

## Rationale

Not documented. The first commit bodies carry no reason ("Fix structure and naming", "Fix marketplace.json").

[inferred] A marketplace makes the plugins installable by name and lets one repository carry several plugins, which
it did from 2026-03-22 on (ADR-010). Inferred from the move happening on the first day and from the later plugin
additions.

## Rejected alternatives

- **A single plugin at the repository root** (0424842): replaced the same day by the `plugins/<name>/` layout
  (ebf6062). No reason recorded.

## Consequences

- Everything in the repository is world-readable, its history included. This is the premise of ADR-013 (secret
  guard) and ADR-014 (public and private marketplace).
- A new plugin is a new directory plus an entry in `marketplace.json`; ADR-002 keeps its version in step.
- A rename of the marketplace or of a plugin reaches every installation and every reference that uses the name
  (`lt-dev@lenne-tech`, `mcp__plugin_lt-dev_…` tool names).

## Evidence

- 0424842 (2025-12-08) "first commit": root plugin layout, `LICENSE`
- 808f9b1 (2025-12-08) "chore: bump version to 1.0.1": adds `.claude-plugin/marketplace.json`
- ebf6062 (2025-12-08) "chore: bump version to 1.0.4", body "Fix structure and naming": moves the plugin to
  `plugins/fullstack/`
- eed908e (2025-12-10) "chore: bump version to 2.0.5", body "Plugin directory renamed to lt-dev"
- `.claude-plugin/marketplace.json` (`"name": "lenne-tech"`, four `"source": "./plugins/…"` entries);
  `README.md` sections "Installation" and "License"
