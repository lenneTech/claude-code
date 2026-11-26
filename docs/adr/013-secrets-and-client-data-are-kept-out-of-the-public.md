# ADR-013: Secrets and client data are kept out of the public repository by one scanner run at three layers (pre-commit, pre-push, CI); a finding is fixed by removing the value

**Date:** 2026-07-18 · **Status:** partially superseded by [ADR-020](020-main-is-protected-by-a-ruleset-and-the-internal-denylist.md) (where the denylist check runs: its consequence that CI cannot read the denylist) · **Topic:** Security
**Origin:** reconstructed 2026-11-18 from git history, scripts/scan-secrets.sh, .githooks/, .github/workflows/secrets-guard.yml, CLAUDE.md

## Context

The repository is public (ADR-001). Commit 7afe373 (2026-07-18, "add secret & client-data guard for the public
marketplace") added a scanner and in the same change fixed "a pre-existing /Users/<name>/ path leak in the
using-lt-cli skill". The scanner's comments record later incidents: customer and project names without a legal form
had stood in lt-showroom and lt-dev since v7.6.0, unnoticed (found 2026-09-25); an internal server address had been
public from 2026-07-18 to 2026-08-23 (found 2026-10-01); a customer name reached a public lt-offers skill
(2026-10-06).

## Decision

- `scripts/scan-secrets.sh` is the one scanner. It finds `.env` files, tokens and secrets, private keys, local
  `/Users/` paths, customer rosters (company names with a legal form), names from an internal denylist, and new
  proper names next to a customer cue word in added lines.
- It runs at three layers: `.githooks/pre-commit` (`--staged`) and `.githooks/pre-push` (`--all` plus every pushed
  range), activated once per clone by `scripts/install-hooks.sh` through `core.hooksPath`; and
  `.github/workflows/secrets-guard.yml` on every push and pull request, together with the scanner's self-test.
- The denylist of customer, project and infrastructure names is kept in the private marketplace's repository and read
  from a sibling checkout (or `LT_PUBLIC_DENYLIST`); it is never committed here.
- A finding is fixed by removing or anonymising the value. `.secrets-allow` is for false positives and never takes a
  real customer or person name.
- Commits and pushes to this repository happen only with the maintainer's explicit approval.

## Rationale

- `.githooks/pre-push`: the push hook is the "last line of defence before the push into a PUBLIC repo" (translated).
- `scripts/scan-secrets.sh:54-58`: the denylist lies "deliberately NOT in this public repo", because "a list here
  would publish exactly the names it is meant to protect" (translated).
- `CLAUDE.md`, security section: the CI workflow is the "CI backstop (server-side, cannot be bypassed locally)"
  (translated).
- The check for new proper names catches names "that no list knows" (`CLAUDE.md`, translated), after names without a
  legal form passed the other checks (incidents of 2026-09-25 and 2026-10-06).
- 7afe373 body: "CLAUDE.md: policy — no client data/secrets in the public marketplace; commit/push only with explicit
  maintainer approval."

## Rejected alternatives

- **A denylist inside this repository**: it would publish the names it protects (`scan-secrets.sh:54-58`).
- **Allowlisting a real name instead of removing it**: `CLAUDE.md`: a word in `.secrets-allow` "is public and unlocks
  it permanently: never enter a real customer or person name, anonymise instead" (translated).

## Consequences

- Every clone runs `scripts/install-hooks.sh` once; until then only CI catches a leak, after it is public.
- CI cannot read the private denylist, so that check runs only locally; CI runs the other checks and the
  new-proper-name check on the pushed range.
- Plugins carry anonymised examples and placeholders such as `<gitlab-host>` (ADR-014).
- A leak that passed stays in the public history; removing the value from the working tree does not undo it.

## Evidence

- 7afe373 (2026-07-18) "chore(security): add secret & client-data guard for the public marketplace"
- e0a85f3 (2026-07-18) "chore(security): scan-secrets — fewer false positives on env/property refs"
- 354845d (2026-09-25): adds the denylist check to `scripts/scan-secrets.sh`
- 1a1583e (2026-10-06) "feat(lt-dev): /lt-dev:briefing, MCP test rules, secrets scanner check 8, …"
- `scripts/scan-secrets.sh:1-12`, `:54-74`; `.githooks/pre-commit`, `.githooks/pre-push`; `scripts/install-hooks.sh`;
  `.github/workflows/secrets-guard.yml`; `scripts/__tests__/scan-secrets.test.sh`
- `CLAUDE.md` security section; `README.md:99-100`; house rules 27, 29
