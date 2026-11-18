# ADR-018: The release commit carries only the version bump; the content of a release is committed beforehand

**Date:** 2026-10-05 · **Status:** accepted · **Topic:** Release
**Supersedes:** [ADR-002](002-one-version-for-the-whole-marketplace-scripts-bump-version.md) (partially)
**Origin:** reconstructed 2026-11-18 from commit 230e689, scripts/bump-version.ts, README.md

## Context

`scripts/bump-version.ts` staged the whole working tree with `git add .` before the release commit (ADR-002). Commit
230e689 (2026-10-05): "Several sessions work in this checkout at once and leave their work uncommitted, so `git add .`
swept all of it into the release commit, including work that must not ship yet."

## Decision

- The release commit holds HEAD plus the new version numbers and nothing else. The content of a release is committed
  first; then `bun run version:patch|minor|major "<description>"` runs.
- The script bumps each version file twice: in the working tree, and from HEAD's copy into the index. A foreign edit
  in `marketplace.json` or a `plugin.json` therefore stays uncommitted, and a file HEAD does not track is bumped but
  never staged.
- The script refuses to run when the index already holds staged changes.
- It pushes the branch and the new tag by name, not with `git push --tags`.
- `scripts/__tests__/bump-version.test.sh` pins this against throwaway repositories with a bare remote.

The rest of ADR-002 holds: one version for every manifest, raised only by this script, tagged `v<version>`.

## Rationale

230e689 body:

- "Several sessions work in this checkout at once and leave their work uncommitted, so `git add .` swept all of it
  into the release commit, including work that must not ship yet."
- "Staging only the version files is not enough on its own: the script rewrote marketplace.json and every plugin.json
  from the working tree, so a foreign edit in one of those files rode along."
- "Pushes the new tag by name instead of `git push --tags`, which published every stray local tag."
- The test file has "19 checks; 11 fail against the old script".

## Rejected alternatives

- **`git add .` in the release script** (ADR-002, until 230e689): swept the uncommitted work of other sessions into a
  release.
- **Staging only the version files from the working tree**: "not enough on its own" (230e689).
- **`git push --tags`**: "published every stray local tag" (230e689).

## Consequences

- A release run that did not commit the content first releases an empty version: the bump commit carries only version
  lines.
- Uncommitted work of the maintainer and of parallel sessions stays out of releases; house rule 29 keeps optimizer
  runs from committing in the first place.
- lt-dev's release recipe for this repository follows the script (efc4036: "claude-code commits only the version bump,
  so the payload is committed first").

## Evidence

- 230e689 (2026-10-05) "fix(scripts): commit only the version bump in bump-version.ts"; first used for v8.15.2
  (3bf87d0)
- efc4036 (2026-10-05) "docs(lt-dev): marketplace release recipe matches the bump script"
- `scripts/bump-version.ts:49-62`; `scripts/__tests__/bump-version.test.sh`; `README.md:103-105`; house rule 29
