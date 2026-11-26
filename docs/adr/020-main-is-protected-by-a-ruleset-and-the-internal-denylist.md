# ADR-020: `main` is protected by a ruleset, and the internal denylist is checked server-side inside lenne.Tech, never as a GitHub secret

**Date:** 2026-11-26 · **Status:** accepted · **Topic:** Security
**Supersedes:** [ADR-013](013-secrets-and-client-data-are-kept-out-of-the-public.md) in part (its consequence that the denylist check runs only locally)

## Context

ADR-013 runs the scanner at three layers and accepts that "CI cannot read the private denylist, so that check runs
only locally". On 2026-11-25 that gap was hit: pull request #18 (squash commit 22c780c) added a workflow whose
trigger URL named the internal GitLab host. It passed every layer:

- The contributor's local hooks did not stop it: either they were not installed, or no sibling checkout of the private
  repository held the denylist, in which case the scanner skips that check with a notice.
- The CI guard was green on the pull request and on the push. Its log reads "Check 7 übersprungen: interne
  Namens-Sperrliste nicht gefunden".
- The pull request was merged without a review, and `main` had no branch protection.

The finding surfaced only in the maintainer's checkout, when the pre-push hook (`--all`, with the denylist) blocked
the next release. The host stays in the public history. The same workflow had reached seven further public
repositories, and every run of it printed its step script, host included, into a public Actions log.

## Decision

- **Ruleset on `main`** (repository ruleset "main: PR and green guard"): changes reach `main` through a pull request
  whose check `scan` (the Secrets & Client-Data Guard, GitHub Actions) is green, merged as a squash; force pushes and
  deleting `main` are blocked. Repository admins bypass it, so the release script (ADR-018) keeps pushing the version bump directly. No
  approving review is required.
- **The denylist check runs server-side inside lenne.Tech.** A scheduled job in the private marketplace's repository
  fetches `main` and the head of every open pull request whose branch lives in this repository, searches them with the
  denylist and reports a commit status (`lenne.Tech internal denylist`) to GitHub. Pull requests from forks get no
  status at all. The job runs no code from this repository: it fetches by SHA, searches with `git grep` without a
  checkout, and names the repository in its own script. It ignores `.secrets-allow`: a denylist hit is fixed by
  removing the value (ADR-013), and a genuine false positive by correcting the denylist in the private repository. The
  status shows only the number of findings with file and line, and it is the second required check in the ruleset.
- **Hosts and addresses a workflow needs come from secrets, never from Actions variables or the file.** Variables
  and a literal in the step script are printed in the workflow log, which is public here; secrets are masked. A secret holds the host alone, because a
  curl error names the host without the rest of the URL (`.github/workflows/docs-rebuild.yml`).

## Rationale

- The maintainer decided on 2026-11-26 to keep the denylist out of GitHub entirely: as a GitHub secret it would be
  readable for everyone with write access, through a workflow pushed to a branch that prints it, and it would lie with
  a third party.
- A required check only blocks a merge, so it needs a pull request requirement; the bypass for admins keeps the
  release flow of ADR-018 unchanged.
- Both checks see only the head of a pull request. With a merge commit or a rebase, a commit that added an internal
  value and a later one that removed it would both land on `main`, its history public for good; a squash brings only
  the checked state.
- Running only its own script keeps the denylist safe even when someone changes the public scanner: code taken from
  the scanned repository could send the list anywhere.
- The status is public. Scanning pull requests from forks would let anyone on GitHub test guessed customer names or
  hosts against the list, one file per guess, a fresh commit per round; even a bare success or failure answers a guess.
- Honouring the `.secrets-allow` of the scanned commit would let a pull request turn its own required check green:
  a contributor who sees only `path:line` takes the hit for a false alarm, allowlists the path in the same pull request
  and merges, and once the entry is on `main`, the maintainer's pre-push scan skips the file too.

## Rejected alternatives

- **The denylist as a GitHub secret read by the CI guard**: quick, but see Rationale.
- **An approving review as the gate**: #18 shows that a review is not what stops a leak, while it slows every change;
  the required check is.
- **An entry in `.secrets-allow` for the host**: it would publish the host permanently (ADR-013).

## Consequences

- Contributors without admin rights can no longer push to `main` directly; a red guard blocks their merge.
- A pull request waits for the scheduled job before it can be merged, at most one interval plus the scan.
- A pull request from a fork never gets the internal status. It is merged after a maintainer has pushed its branch
  into this repository, where the job checks it.
- Contributors with write access can still confirm guesses through a branch of their own, but cannot read the list.
- A path in `.secrets-allow` stays checked by the server-side job; the local scanner keeps skipping it. A genuine false
  positive of the denylist is corrected in the denylist, or both checks keep disagreeing.
- The job needs a GitHub token limited to this repository: commit statuses read and write, pull requests and contents
  read only (it lists the open pull requests and reads `main`). It is stored protected and masked in the private
  repository. When it expires, the status stops arriving and pull requests stay blocked until it is
  renewed.
- The local lt-time master data that the local scanner merges into the denylist is not available to the server-side
  job; it covers the entries of the denylist file.
- ADR-013 stays in force for the scanner and its three layers.

## Evidence

- 22c780c (2026-11-25) "docs: follow the new docs convention (#18)"; secrets-guard run 45602694298 of that push logs
  the skipped Check 7; docs-rebuild run 45602693951 of the same push prints the host. Why the local hooks did not stop
  it is not recorded [inferred: one of the two causes in Context]
- 17 of 18 docs-rebuild runs in the eight public repositories that carried the workflow printed the host
  (counted 2026-11-26; the exception is the masked run after 9a7087f); all 17 were deleted the same day
- The server-side job: `scripts/public-repo-guard.sh` and its job in `.gitlab-ci.yml` of the private marketplace's
  repository
- 9a7087f (2026-11-26) "fix(ci): docs rebuild reads the GitLab host from an organization secret"; manual run of
  `docs-rebuild.yml` the same day shows the host masked as `***`
- Repository ruleset 28139082 (created 2026-11-26; squash only and the second required check added the same day)
- Pipeline schedule 6 of the private marketplace's repository (every 10 minutes); its first run on 2026-11-26 reported
  success for `main` at 3fa34e6
- `scripts/scan-secrets.sh` (`report` prints file and line only); `.githooks/pre-push`; `scripts/bump-version.ts`
