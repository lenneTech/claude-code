# ADR-010: Capabilities for different audiences ship as separate plugins of the one marketplace (lt-dev, lt-offers, lt-showroom, lt-tools), without declared dependencies between them

**Date:** 2026-03-22 · **Status:** accepted · **Topic:** Plugin architecture
**Origin:** reconstructed 2026-11-18 from git history, .claude-plugin/marketplace.json, plugin READMEs

## Context

Until 2026-03-22 the marketplace held one plugin, lt-dev, for development in the lenne.Tech stack. Version 7.2.0
(3b331ca, 2026-03-22) added `lt-offers` for business offers on the Offers platform, 7.5.0 (aaf4690, 2026-03-26)
`lt-showroom` for project analysis and showcases, and 8.21.0 (7f5e4f5, 2026-10-08) `lt-tools` for general-purpose
tools.

## Decision

- A capability for a different audience or purpose is a plugin of its own in this marketplace, not a part of lt-dev:
  - `lt-dev`: development in the lenne.Tech stack
  - `lt-offers`: offers and concept folders on the Offers platform, through MCP
  - `lt-showroom`: project analysis and showcases on the Showroom platform, through MCP
  - `lt-tools`: general-purpose tools that belong to no stack
- Each plugin carries its own manifest, `permissions.json`, `context-budget.json` and README, and can be installed
  alone (`lt claude plugins lt-dev lt-tools`).
- Plugins declare no `dependencies` on each other; an optional use of lt-dev's chrome-devtools server is stated in
  the README instead (house rule 24d).

## Rationale

- lt-tools, `plugins/lt-tools/README.md:3`: "General-purpose tools for everyday work that do not belong to a specific
  stack."
- lt-offers and lt-showroom: not documented. [inferred] They serve offer and showcase work against a platform account
  (`README.md`: "`lt-offers` and `lt-showroom` work with an account on the respective platform"), which development
  work does not need, and every installed plugin adds to what each session loads (house rule 4). Inferred from the
  README and from the per-plugin `context-budget.json`.
- No declared dependencies: house rule 24d.

## Rejected alternatives

- **Everything in lt-dev**: not chosen; no comparison documented.
- **Declared dependencies on lt-dev**: rejected by house rule 24d.

## Consequences

- A user installs only the plugins for their work, and only installed plugins add skill descriptions and agents to a
  session.
- Versions stay in lock-step across all plugins (ADR-002), so a release of one raises all.
- A plugin cannot use another plugin's files (ADR-007); lt-showroom and lt-tools use lt-dev's chrome-devtools server
  only when lt-dev is installed.

## Evidence

- 3b331ca (2026-03-22) "chore: bump version to 7.2.0", body "feat: introduce lt-offers plugin …"
- aaf4690 (2026-03-26) "chore: bump version to 7.5.0", body "feat: add lt-showroom plugin for project analysis and
  showcase creation …"
- 7f5e4f5 (2026-10-08) "feat(lt-tools): new plugin that saves a website as a verified offline copy"
- `.claude-plugin/marketplace.json` (four plugin entries); `README.md` "Plugins" table; `plugins/lt-tools/README.md:3`;
  `plugins/*/context-budget.json`; house rules 4, 24d
