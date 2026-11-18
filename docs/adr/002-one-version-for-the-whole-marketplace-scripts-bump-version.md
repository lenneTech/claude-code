# ADR-002: One version for the whole marketplace: `scripts/bump-version.ts` raises package.json, marketplace.json and every plugin.json together, then commits, tags `v<version>` and pushes

**Date:** 2025-12-08 · **Status:** partially superseded by [ADR-018](018-the-release-commit-carries-only-the-version-bump-the.md) (how the release commit is staged) · **Topic:** Release
**Origin:** reconstructed 2026-11-18 from git history, scripts/bump-version.ts, README.md

## Context

The first commit already carried `scripts/bump-version.ts` (0424842, 2025-12-08). After the move to `plugins/`
(ebf6062, the same day) it raised the version in `package.json` and in every `plugins/*/.claude-plugin/plugin.json`.
`marketplace.json` joined the lock-step on 2026-07-26 (fc7ec32, "keep marketplace.json in lock-step when bumping
versions").

## Decision

- The marketplace has one version. `package.json`, `.claude-plugin/marketplace.json` and the `plugin.json` of every
  plugin always carry the same number, whichever plugin changed.
- A release is cut only by `bun run version:patch|minor|major "<description>"` (`package.json` scripts, running
  `scripts/bump-version.ts`). The script raises every version, commits `chore: bump version to <version>` with the
  description as body, creates the tag `v<version>` and pushes branch and tag.
- As decided here, the script staged the whole working tree (`git add .`) and pushed with `git push --tags`. That part
  is superseded by ADR-018.

## Rationale

Not documented.

[inferred] One number tells for every plugin at once which release is installed and needs no per-plugin
bookkeeping. Inferred from the script iterating over `plugins/*/` since ebf6062 and from fc7ec32 pulling
`marketplace.json` into the same number.

## Rejected alternatives

None documented.

## Consequences

- Every release raises the version of every plugin, also of plugins that did not change.
- The release description lives in the body of the bump commit. Before 2026-10-05 the bump commit often was also the
  only commit carrying the release's content, so `git log --grep 'bump version'` is part of reading the history.
- Raising the version by hand in one manifest breaks the lock-step; the script is the only way.

## Evidence

- 0424842 (2025-12-08) "first commit": `scripts/bump-version.ts` with `git add .`, `git commit`, `git tag`,
  `git push`, `git push --tags`
- ebf6062 (2025-12-08) "chore: bump version to 1.0.4": the script updates "all plugin.json files in plugins/*/"
- fc7ec32 (2026-07-26) "chore: bump version to 7.66.0", body: "keep marketplace.json in lock-step when bumping
  versions"
- `scripts/bump-version.ts:101` ("The marketplace manifest stays in lock-step with package.json"), `:106` (every
  `plugins/*/.claude-plugin/plugin.json`)
- `package.json` scripts `version:patch`, `version:minor`, `version:major`; `README.md:103` (Release)
