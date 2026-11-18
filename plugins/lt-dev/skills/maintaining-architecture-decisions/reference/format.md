# ADR Format

The default for a new log. A repository with a log of its own keeps its conventions: read its
README or index first and write the next ADR the way the existing ones are written (language,
field names, umlauts or their ASCII forms, number width). `adr.mjs` reads every format below.

## Location and files

- **Log:** `docs/adr/` at the repository root, with `README.md` as intro and index.
- **File:** `NNN-short-slug.md`: three-digit number (more digits once a log passes 999), slug in
  lowercase ASCII with hyphens, no umlauts. `adr.mjs new` derives both from the title.
- **Language:** the one the project already writes in: an existing log first, otherwise its
  documentation, when every source agrees (`adr.mjs lang`). When the sources disagree or say too
  little, the developer decides, and from then on the log does. One log, one language: `adr.mjs`
  refuses an ADR in another language, and `check` names one that slipped in.
- **Several logs in one repository:** a monorepo created by the lt CLI carries the logs its
  starters brought along (`projects/api/docs/adr/`, `projects/app/docs/adr/`) next to its own root
  log. All of them are read; the project's new decisions go into the root log. A decision that
  replaces an inherited one names it in `Supersedes` with a link to its file relative to the root
  log (`../../projects/api/docs/adr/007-…`), and the inherited file's status is updated by hand;
  `adr.mjs` checks references within one log only.

## One ADR

```markdown
# ADR-012: Soft delete via `deletedAt` for invoices; lists filter deleted records by default

**Date:** 2026-11-18 · **Status:** accepted · **Topic:** Data model
**Supersedes:** [ADR-004](004-…)
**Origin:** DEV-1234, decision round 2026-11-18

## Context

What was open, what was on the table, what triggered it.

## Decision

What holds, concretely: the rule a later change could break, with the code, configuration or
contract that fixes it (`invoice.model.ts:31`, the `deletedAt` filter in `InvoiceService.find`).

## Rationale

The reasons actually given, quoted with their source, and the numbers behind them. A reason that
is only inferred is marked [inferred].

## Rejected alternatives

- **Hard delete** (as `Customer` does): payments point at the invoice and would dangle.

## Consequences

What follows, including the price: every invoice query needs the filter; a restore feature is
possible later without a migration.

## Evidence

DEV-1234 (decision round); `projects/api/src/server/modules/invoice/invoice.service.ts:54`.
```

- **Title:** `ADR-NNN: ` plus one sentence that states the decision. It is the line every later
  check screens.
- **Header line:** `**Date:**` (ISO), `**Status:**`, `**Topic:**`, separated by ` · `. Further
  lines only when they apply: `**Supersedes:**` with links, `**Origin:**` (ticket, MR, approval, or
  `reconstructed YYYY-MM-DD from …` for a reconstructed ADR).
- **Sections:** Context, Decision, Rationale, Rejected alternatives, Consequences, Evidence. A
  section with nothing to say says so in one line ("None documented.") rather than disappearing,
  so a reader can tell "not considered" from "forgotten".
- **German field names:** `**Datum:**`, `**Status:**`, `**Thema:**`, `**Ersetzt:**`,
  `**Herkunft:**`; sections Kontext, Entscheidung, Begründung, Verworfene Alternativen,
  Konsequenzen, Belege.
- **Numbers in an ADR carry their quality** where it matters: `[measured]` with the command,
  `[documented]` with source and date, `[inferred]`. German: `[gemessen]`, `[dokumentiert]`,
  `[vermutet]`.

## Statuses

| English | German | Binds a change | Meaning |
|---|---|---|---|
| `accepted` | `gültig` | yes | In force. Implementation states (`implemented`, `gebaut`, `im Betrieb`) count as accepted |
| `partially superseded by ADR-NNN` | `teilweise überholt durch ADR-NNN` | yes, the remaining part | Part of it was replaced; the status says which part |
| `proposed` | `vorgeschlagen` | no, a conflict is noted | Decided by Claude alone, or not yet decided |
| `superseded by ADR-NNN` | `überholt durch ADR-NNN` | no | Replaced; the new ADR binds |
| `rejected` | `verworfen` | no, but reviving it is checked against its reason | Proposed and turned down |
| `deprecated` | `aufgehoben` | no | No longer applies, nothing replaced it |

The status may carry a qualifier after a semicolon (`accepted; point 3 superseded by ADR-020`);
the first status word decides, and a status that is both in force and superseded somewhere counts
as partially superseded.

## Superseding

`adr.mjs new --title "<new decision>" --supersedes 4` writes the new ADR with
`**Supersedes:** [ADR-004](004-…)` and sets ADR-004's status to `superseded by [ADR-012](012-…)`.
`--partially-supersedes 4` does the same with "partially"; then add to the old status which part
was replaced. The old ADR's text stays as it was: it is the record of why it was once different.

## Index

`README.md` holds the intro, how to add an ADR, and the table between
`<!-- adr-index:start -->` and `<!-- adr-index:end -->`, which `adr.mjs new` and
`adr.mjs index --write` regenerate (number, date, title, status). A log without these markers
keeps its table by hand; `adr.mjs check` then warns about ADR files the index does not mention.

## Numbering and parallel branches

`adr.mjs next` and `adr.mjs new` take the next number after every number used in the work tree or
on any local or remote branch, so two open branches do not pick the same one. Two branches that
still collide (one was created before the other was pushed) are resolved on rebase: the branch
being rebased renumbers its own ADR to the next free number, fixes the links to it, and runs
`adr.mjs index --write`; the ADR already on the base keeps its number. `adr.mjs check` fails on a
number used twice.
