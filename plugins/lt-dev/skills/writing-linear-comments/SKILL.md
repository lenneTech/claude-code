---
name: writing-linear-comments
description: 'Shapes every Linear comment an lt-dev command posts so a product owner grasps it without scrolling: what changed in plain language, the full test steps with links and example data, and nothing else. Owns the split between the short comment and the attached Linear document that carries the technical detail, including the verified save_document / get_document mechanics a later Claude session uses to read that detail back. Activates whenever a command posts or updates a Linear comment (ticket-cycle, git:ship, dev-submit, linear-comment, review), and on "Linear-Kommentar", "Kommentar zu lang", "Details anhängen". NOT for the QA testability decision and the step wording (use writing-qa-test-instructions). NOT for ticket descriptions (use create-story / create-task / create-bug).'
user-invocable: false
---

# Writing Linear Comments

A Linear comment has one reader in mind: the person who did **not** write the code. Usually that is
the product owner or a tester. They open the ticket to answer two questions, and only two:

1. **What is different now?**
2. **What do I have to do to see it?**

Everything else in a comment is something they scroll past. This skill decides what stays in the
comment and where the rest goes.

## The rule

> **The comment answers the two questions. Every other useful thing goes into a Linear document
> attached to the ticket, linked from one line at the end of the comment.**

Both halves matter. Cutting the detail entirely loses information the next developer needs;
leaving it in the comment buries the two answers under material written for a different reader.
The attached document keeps it, one click away, without costing the product owner a single scroll.

## Part 1 — What goes in the comment

Exactly these, in this order. Nothing else.

| Block | Content | Omitted when |
|-------|---------|--------------|
| `## Umsetzung` | 1 to 3 sentences, plain language: what was wrong or missing, what happens now instead. | never |
| `## Testanleitung` | The complete manual test: environment, roles, numbered steps with full links and concrete example data. Shape and wording come from [`writing-qa-test-instructions`](../writing-qa-test-instructions/SKILL.md). | never — the not-testable variant states the reason instead |
| `## Nicht in diesem Ticket` | Deliberate scope cuts the reader might otherwise expect. One line each. | when there are none |
| `## Details` | One line linking the attached document. | when no document was attached |

**Length budget: the comment fits on one screen.** Roughly 15 lines outside the test steps, and the
steps take as many lines as they need — a test instruction is never shortened, because a step the
tester cannot follow costs a round-trip that dwarfs the reading time. Prose is what gets cut.

### Plain language, concretely

- **Name what the user sees**, not what the code does. "Die Übersicht zeigt jetzt auch stornierte
  Aufträge" — not "Filter im Query angepasst".
- **No file names, no symbols, no branch names, no ticket-internal shorthand.**
- **No severity words, no grades, no percentages.** "3 von 4 Findings behoben" means nothing to
  somebody who never saw the findings.
- **Every step carries real example data.** "Suchfeld: `Muster GmbH`", "Menge: `3`",
  "Datum: `01.03.2026`". A step reading "beliebige Daten eingeben" produces a test nobody can repeat
  and a bug report nobody can reproduce.
- **Every route is a full clickable link** including query and hash parameters, resolved against the
  deployed environment. Never `localhost`.
- **Never credentials.** Roles only. The reasoning and the exact wording live in
  [`writing-qa-test-instructions`](../writing-qa-test-instructions/SKILL.md), Part 2.

## Part 2 — What goes in the attached document instead

Move it out of the comment as soon as it is written for a developer rather than for the reader above:

- file/line references, code, diffs, command output
- review findings, severity tables, trade-off analysis
- architecture rationale, alternatives considered and why they were dropped
- migration or rollout notes, config changes, environment variables
- performance numbers, load-test results, Lighthouse scores
- known limitations with a technical cause
- follow-up ideas that did not become tickets

**Write no document when there is nothing above to carry.** A ticket where the whole story fits in
three sentences gets three sentences and no attachment. An almost-empty document trains people to
stop opening them, which costs more than it saved.

### Document shape

```markdown
# <Ticket-ID> — Technische Details

## Was wurde geändert
<the implementation in developer language, with file:line references>

## Warum so
<the decisions worth keeping: what was chosen, what was rejected, why>

## Bekannte Einschränkungen
<or "keine">

## Nachgelagert
<what was deliberately not done, and what would have to happen for it — or "nichts">
```

Title convention: `<Ticket-ID> — Technische Details`. One document per ticket. A later run
**updates** that document via `save_document` with its `id` (or the `patch` operations) instead of
attaching a second one, so the ticket never accumulates a stack of near-identical documents.

## Part 3 — The mechanics

Verified against the Linear MCP on 2026-09-07 with a throwaway issue (DEV-3171, since cancelled).
All four calls below were executed and their results confirmed, so the flow is known to work rather
than assumed to.

**Attach the document to the ticket:**

```
mcp__plugin_lt-dev_linear__save_document
  issue:   "<TICKET-ID>"                       # the issue is a valid document parent
  title:   "<TICKET-ID> — Technische Details"
  icon:    ":robot:"                           # emoji code, not a raw Unicode emoji
  content: "<markdown>"                        # literal newlines, no escape sequences
```

The response carries `id`, `slugId` and `url`. Put that `url` in the comment's `## Details` line.

**Link it from the comment:**

```markdown
## Details

Technische Details, Entscheidungen und bekannte Einschränkungen: [<TICKET-ID> — Technische Details](<url>)
```

**Read it back in a later session:** `get_issue` lists every attached document under `documents`
as `{id, title}`, and `get_document` with that `id` returns the full markdown in `content`. So a
future run picks up the reasoning without the user having to re-explain it — which is the whole
reason to write the document rather than a comment nobody can query.

```
mcp__plugin_lt-dev_linear__get_issue      id: "<TICKET-ID>"        -> documents[]
mcp__plugin_lt-dev_linear__get_document   id: "<document-id>"      -> content (markdown)
```

**Update it instead of adding another:** `save_document` with the existing `id` plus either a full
`content` or a list of `patch` operations.

### When a real file has to travel

A document covers text. For an artefact that must stay a **file** — a k6 result JSON, a Lighthouse
report, a log excerpt, a screenshot — upload it as an issue attachment:

1. `prepare_attachment_upload` with `issue`, `filename`, `contentType`, exact `size` in bytes.
2. `PUT` the raw bytes to `uploadRequest.url`, sending **every** header from `uploadRequest.headers`
   verbatim, casing included. The signed URL expires after 60 seconds, so prepare and upload one
   file at a time.
3. `create_attachment_from_upload` with the returned `assetUrl`.

`get_attachment` with the attachment id returns the file's content directly — a `.md` or other text
file comes back as readable text, so this path is also machine-readable, just clumsier than a
document. `delete_attachment` removes one.

Prefer the document for anything that is prose or a table: it renders inside Linear, while an
attachment has to be downloaded before anybody can read it.

### Limits worth knowing

- **The MCP cannot delete a document.** `save_document` creates and updates; removal is a manual
  step in the Linear UI. One more reason to update the existing document rather than attach a new one.
- **`list_issues` search is fuzzy.** A `query` returns loosely related titles, not matches. Never
  treat a search hit as proof that a ticket is the same one; read it before concluding anything.

## Hard Rules

- **The two questions are answered in the comment itself.** A comment that answers them only by
  pointing at the document has moved the reader's work rather than removed it.
- **Test steps are never abbreviated into the document.** They are the part the reader acts on;
  they stay in the comment in full, with links and example data.
- **No credentials in a comment, and none in the attached document either.** The document is
  workspace-readable exactly like the comment.
- **One document per ticket, updated in place.**
- **No document when there is no detail.** Silence is a valid outcome.

## Related Skills

- [`writing-qa-test-instructions`](../writing-qa-test-instructions/SKILL.md) — the testability decision and the exact wording of the test steps this skill places in the comment
- [`filing-ai-proposed-tickets`](../filing-ai-proposed-tickets/SKILL.md) — where a follow-up idea goes when it deserves its own ticket rather than a paragraph in the detail document
- [`unslop`](../unslop/SKILL.md) — the prose pass every comment gets before it is posted
