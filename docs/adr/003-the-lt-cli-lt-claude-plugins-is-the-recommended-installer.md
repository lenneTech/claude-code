# ADR-003: The lt CLI (`lt claude plugins`) is the recommended installer: it installs the plugins and copies the `permissions.json` of each plugin into the global user settings

**Date:** 2025-12-10 · **Status:** accepted · **Topic:** Distribution
**Origin:** reconstructed 2026-11-18 from git history, README.md, plugins/*/permissions.json

## Context

The plugin's first `permissions.json` arrived with version 2.0.2 (8846acf, 2025-12-09, "lt command updated and
permissions added"). Version 2.0.6 (e4ad43d, 2025-12-10, body "lt claude plugins") documented the installation
through the lenne.Tech CLI in the README. A manual installation through `/plugin install` sets no permissions
(`README.md:40`).

## Decision

- The README recommends `npm i -g @lenne.tech/cli` and `lt claude plugins [<plugin> …]`. The CLI adds or refreshes
  the marketplace, installs or updates the plugins, and copies the allow rules of each plugin's `permissions.json`
  into `~/.claude/settings.json`.
- Every plugin that runs CLI commands ships a `permissions.json` with a `permissions.schema.json`; each pattern has
  a `description` and a `usedBy` list. A rule a plugin narrowed or dropped moves to `formerPatterns`, which the CLI
  removes once from existing settings.
- The manual route (`/plugin marketplace add`, `/plugin install`) stays supported and installs no permissions.
- What a rule may admit is not part of this decision: house rules 8a, 24c and 24e govern that. This ADR records the
  channel only.

## Rationale

For the CLI as installer: not documented.

[inferred] Installing through the CLI ships the allow rules together with the plugins, which a manual installation
does not ("A manual installation sets no permissions", `README.md:40`), and reuses the stack's existing
command-line tool. Inferred from the README and from e4ad43d following one day after the first permissions.

For `formerPatterns`, 5c8587e (2026-10-18): "`lt claude plugins` copies permissions.json verbatim into the user's
global settings and never removed a rule a plugin dropped, so the narrowing in the previous commit would have reached
fresh installs only."

## Rejected alternatives

- **Manual installation only**: kept as a route, but it "sets no permissions" (`README.md:40`).
- **Dropping a rule from `permissions.json` without a trace**: existing settings would keep it (5c8587e).

## Consequences

- Every rule applies in every project of the user, not only in lenne.Tech projects; house rule 24c keeps the rules
  narrow for that reason.
- A change to `permissions.json` reaches existing settings only through the CLI. A dropped rule goes into
  `formerPatterns`, which only grows (house rule 24c).
- The CLI lives in another repository (`lenneTech/cli`); a change to the format of `permissions.json` needs the CLI
  to follow.
- Plugin helper scripts get no rule in `permissions.json`; commands grant them by exact name per turn (house rule 24c).

## Evidence

- 8846acf (2025-12-09) "chore: bump version to 2.0.2", body "lt command updated and permissions added"
- e4ad43d (2025-12-10) "chore: bump version to 2.0.6", body "lt claude plugins": README installation section
- 5c8587e (2026-10-18) "feat: formerPatterns in permissions.json so the lt CLI removes narrowed rules from existing
  settings"
- `README.md:26-31` (installation through the CLI), `README.md:40` (manual installation), `README.md` "Permissions"
- `plugins/*/permissions.json`, `plugins/*/permissions.schema.json`; house rules 8a, 24c, 24e
