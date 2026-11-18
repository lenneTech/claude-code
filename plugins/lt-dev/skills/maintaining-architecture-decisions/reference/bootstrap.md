# Reconstructing Historical Decisions

When a repository has no log, or a log without ADRs, its history is reconstructed before the log
is used, so the first conflict check already knows the decisions the code rests on. `/lt-dev:adr
init` on a log that already holds ADRs runs a gap fill: it adds what is missing and never
renumbers or rewrites what is there.

The goal is not a history of the project. It is **the decisions a later change could undo by
accident**: the ones a newcomer, a ticket author or an agent might reverse without knowing they
were chosen. A mature repository usually yields 10 to 40; a log with five well-evidenced ADRs is
worth more than one with sixty guesses.

## Language first

The log is written in the language the project already uses. Before anything is collected,
`adr.mjs lang` gives the verdict: an existing log, otherwise the documentation when all of it agrees.
On `unclear` the reconstruction does not start on a guess: whoever can ask the developer asks
(with the sources and their languages), and the run continues with `--lang` set to the answer. The
`adr-maintainer` agent cannot ask; it stops and reports the sources to its caller.

## Sources, cheapest first

1. **What the repository says about itself:** `CLAUDE.md` and `AGENTS.md` (rules with "because",
   "never", "always", "deliberately", "instead of"), `README.md`, `docs/`, `CONTRIBUTING.md`,
   migration guides, `CHANGELOG.md` (breaking changes, "switched to", "replaced", "dropped"),
   decision sections such as `## Database`, and committed decision lists of any name.
2. **Manifests and configuration:** `package.json` (framework, ORM or driver, test runner, linter
   and formatter, auth library, validation, state management), workspace layout, `tsconfig`
   strictness, lint rules, Dockerfiles, compose files, CI pipelines (deployment target, registry,
   release flow), environment and config models (`config.env.ts`).
3. **Git history of the default branch**, for the date and the stated reason of a decision found
   in 1 or 2, and for decisions that left no other trace:

   ```bash
   git log origin/<default> --date=short --format='%h %ad %s' -i -E \
     --grep='switch|replac|migrat|instead|deprecat|drop|remov|introduc|adopt|move to|umstell|ersetz|statt|wegen|because|decid|entscheid'
   git log origin/<default> --diff-filter=A --date=short --format='%h %ad %s' -- <config file>   # when a tool arrived
   git log origin/<default> --diff-filter=D --date=short --format='%h %ad %s' --name-only -- <old config>   # when one left
   git show --stat <hash>                                                                          # the body often holds the reason
   ```

4. **The code itself:** a pattern every module follows (services extend one base class, every
   controller carries permission decorators, no GraphQL resolvers in new modules), and above all a
   test or script that fails when the convention is broken. A guard someone built is the strongest
   evidence that a choice was deliberate.
5. **Tickets, MRs and PRs**, only to fetch the reason for a decision already found in 1 to 4,
   never as a crawl: the ticket ID in a commit, the MR that introduced a tool.

## What qualifies

A choice between real alternatives that still holds and that a later change could plausibly
reverse:

- framework, library and tool choices (test runner, linter, ORM, auth, validation, UI kit)
- persistence and data model conventions (database, IDs, soft delete, timestamps, tenancy)
- API style and contracts (REST or GraphQL, versioning, error format, pagination)
- the authentication and permission model, and security defaults
- module boundaries and dependency direction, monorepo layout
- configuration and environment model, deployment and runtime
- deliberate non-features and limits ("no SSR for the admin area", "no GraphQL in new modules")
- in a library: compatibility promises, extension points, the release and versioning policy
- in a starter: what every generated project inherits (see below)

Skip what nobody would change by accident (formatting width, file naming the linter enforces),
what the framework dictates with no alternative left to the repository, one-off fixes, and
anything only a guess supports.

**A reversed decision is worth two ADRs** when the reversal carries a lesson: the old one
`superseded by` the new one, so the chain shows that X was tried and why Y replaced it
(jest to vitest, eslint to oxlint). A tool that came and went without a reason worth keeping is
left out.

## Writing them

- **Numbers follow the decisions' dates**, oldest first, starting at 001. The date is that of the
  commit that introduced the choice (first add of its config, the switching commit); where only a
  later state shows it, the earliest commit that does, written as `on or before YYYY-MM-DD` in the
  Context.
- **Status `accepted`** for a decision still in force, `superseded by` for one the history
  reversed. Reconstructed decisions are accepted because the code rests on them, whether or not
  someone once chose them consciously: changing them is a change of the architecture either way.
- **`**Origin:** reconstructed YYYY-MM-DD from <sources>`**, so a reader knows the ADR was
  written after the fact.
- **Rationale quotes the reason where one was given** (commit body, changelog, docs, CLAUDE.md),
  with its source. Where no reason is documented, write "Not documented." and, if the context
  makes one evident, add it marked `[inferred]` with what it is inferred from. An inferred reason
  is never presented as the one that was given.
- **Rejected alternatives** only where evidenced (the tool that was replaced, a documented "not
  X"), or the obvious one marked `[inferred]`.
- **Evidence** for every ADR: commit hashes with subject and date, `path:line`, the changelog
  version, the quoted doc line.

## Starters and libraries

- **A starter's log records what every generated project inherits**, because the lt CLI copies
  the starter, its log included, into each new project. How the starter repository itself is
  released or maintained belongs in its README or CLAUDE.md, not in the log.
- **A library's log** also records the promises its consumers rely on: public API stability, how
  projects extend it (inheritance, configuration, overrides), what it deliberately leaves to the
  project.

## Public repositories

The lenne.Tech base repositories are public on GitHub. Their logs carry no customer or project
names, no internal hosts, IPs or server names, no person names ("the maintainer"), no ticket
content beyond the ID, and no local paths. A commit message quoted as evidence is anonymised when
it carries any of these; the hash stays as the pointer.

## Finishing

1. `adr.mjs index --write`, then `adr.mjs check` without errors.
2. The CLAUDE.md section from the skill (and in `AGENTS.md` where the repository keeps both in
   step), unless an equivalent section exists.
3. Nothing is committed by the reconstruction itself: the caller's git rules decide (a ticket run
   commits it as its own commit; a base repository leaves it uncommitted for the maintainer).
4. Report: every ADR as `ADR-NNN | status | date | title`, the number of evidence items each
   carries, and separately the ones whose rationale is `[inferred]` or "Not documented", because
   those are the ones the developer should confirm or correct.
