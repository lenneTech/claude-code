# ADR-008: Marketplace optimization is the repository-only `/optimize` command, which fans out one optimizer agent per element type plus a marketplace agent

**Date:** 2026-01-09 · **Status:** accepted · **Topic:** Tooling
**Origin:** reconstructed 2026-11-18 from git history, CLAUDE.md, .claude/skills/marketplace-optimizer/SKILL.md

## Context

Until 2026-01-09 the marketplace optimizer was one agent (`.claude/agents/marketplace-optimizer-agent.md`, 425
lines). Commit 62e9507 ("Restructure marketplace optimization with parallel sub-agents and improved documentation
caching") replaced it with six specialists. On 2026-09-25 (354845d) the outcomes earlier runs had settled became
`.claude/skills/marketplace-optimizer/house-rules.md`.

## Decision

- `/optimize` (`.claude/commands/optimize.md`, slash-only) invokes the `marketplace-optimizer` skill. The skill
  refreshes the docs cache, derives the documentation and changelog delta, and spawns `optimizer-skills`,
  `optimizer-commands`, `optimizer-agents`, `optimizer-hooks`, `optimizer-mcp` and `optimizer-marketplace`.
- Each optimizer agent reads only the documentation for its element type. The coordinator owns the cache, the delta,
  the verification of high-impact findings, the dialogue with the user and every file outside the agents' partitions.
  Approved changes are applied by agents on disjoint file partitions (house rule 30).
- Decisions a run settles go into `house-rules.md`, each with its reason; a finding that would reverse one is dropped
  unless fresh documentation disproves the reason.
- All of it lives in `.claude/` and does not ship (ADR-007).

## Rationale

- `.claude/skills/marketplace-optimizer/SKILL.md:9`: "The optimizer agents each load only the documentation for their
  element type; the coordinator (this skill) owns the cache, the delta, verification, the user dialogue and every
  file outside the agents' partitions."
- `house-rules.md` preamble: "Each rule carries its reason. A rule whose reason no longer holds is a finding against
  this file, not a licence to ignore it silently."
- 62e9507 gives no reason in its body. [inferred] One agent per element type keeps each agent's documentation load
  small and lets the analysis run in parallel; inferred from `SKILL.md:9` and from 62e9507 replacing one 425-line
  agent with six agents of 68 to 107 lines.

## Rejected alternatives

- **One optimizer agent for every element type** (`marketplace-optimizer-agent.md`): deleted in 62e9507.

## Consequences

- A run is only as current as the docs cache (ADR-006); `/optimize` checks the cache version first.
- The rules that govern how the plugins are tuned live in `house-rules.md`, not in this log: this ADR records the
  mechanism, the house rules hold its decisions.
- The optimizer agents run on the session model without an effort pin (house rules 9 and 10).

## Evidence

- 62e9507 (2026-01-09) "Restructure marketplace optimization with parallel sub-agents and improved documentation
  caching": deletes `.claude/agents/marketplace-optimizer-agent.md`, adds the six `.claude/agents/optimizer-*.md`
- 354845d (2026-09-25) "chore: bump version to 8.15.0", body "… optimizer house rules"
- `.claude/commands/optimize.md`; `.claude/skills/marketplace-optimizer/SKILL.md:9` and its "Architecture" table;
  `.claude/skills/marketplace-optimizer/house-rules.md`; house rules 9, 10, 30
