# ADR-014: Two marketplaces: the public one carries only anonymised content; anything with internal data goes into the private marketplace

**Date:** 2026-07-18 · **Status:** accepted · **Topic:** Repository
**Origin:** reconstructed 2026-11-18 from git history, CLAUDE.md, plugins/lt-dev/README.md

## Context

The secret guard (ADR-013) keeps values out; it does not say where knowledge with internal data goes instead. Commit
987c66f (2026-07-18) added a pointer in the lt-dev README that internal plugins exist in "a private, unlisted
marketplace". From then on internal material moved out of this repository: the smoke-test infrastructure assignment
(1f69065, 2026-08-23) and the platform-maintenance commands and platform-repository hooks of lt-offers and
lt-showroom (354845d, 2026-09-25).

## Decision

- There are two marketplaces: this public one, `lenne-tech`, and a private one for lenne.Tech team members.
- The deciding question is whether content carries internal data. Real customer or project data, internal hosts and
  addresses, infrastructure assignments, platform IDs and internal business rules belong in the private marketplace.
  The public one carries the procedure with anonymised examples and placeholders (`<gitlab-host>`).
- Real master data never enters this marketplace: it is generated locally per user or kept in private repositories
  (`CLAUDE.md`, security section). Secrets such as tokens and `.env` files are never committed here (ADR-013).
- The public repository names the private marketplace only in general terms: no repository URL, install command or
  capability details.

## Rationale

- 987c66f body: "Discreet pointer for authorized […] team members that additional internal plugins exist via a
  private, unlisted marketplace — no repo URL, install command, or capability details (access is covered in internal
  onboarding). Outsiders learn nothing exploitable."
- 1f69065 body (anonymised): server addresses, platform server and workspace IDs and the real smoke-test domain "are
  infrastructure assignments; per the marketplace policy those belong in [the private marketplace], and the public
  repo carries the procedure with placeholders."
- `CLAUDE.md`, security section: "This repo is PUBLIC" and plugins ship "ONLY anonymised examples" (translated).

## Rejected alternatives

- **Internal knowledge in the public plugins, guarded only by the scanner** [inferred]: 1f69065 also moved "two
  pre-existing occurrences" that had passed, among them a server address; the split keeps such material out by
  design rather than by pattern. Inferred from 1f69065 and the incidents recorded in `scripts/scan-secrets.sh`.

## Consequences

- A command whose procedure is public but whose values are internal is split: the procedure here with placeholders,
  the values in the private marketplace (the smoke test, 1f69065).
- The release tooling covers both marketplace repositories (fc7ec32: "extend /lt-dev:publish and maintaining-lt-stack
  to cover both marketplace repos"), and the auto-update covers both marketplaces (ADR-012).
- `formerPatterns` in `permissions.json` never lists a rule that names an internal host; such a rule is removed by
  hand (house rule 24c).

## Evidence

- 987c66f (2026-07-18) "docs(lt-dev): note internal plugin marketplace for team members"; `plugins/lt-dev/README.md:181`
- fc7ec32 (2026-07-26) "chore: bump version to 7.66.0"
- 1f69065 (2026-08-23) "chore: bump version to 8.6.0", body "move the smoke-test infrastructure assignment out of the
  public marketplace …"
- 354845d (2026-09-25), body: "Platform-maintenance commands and platform-repository hooks moved out of the public
  plugins"
- `CLAUDE.md` security section; house rules 24c, 27
