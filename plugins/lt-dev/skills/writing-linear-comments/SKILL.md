---
name: writing-linear-comments
description: 'Shapes every Linear comment an lt-dev command posts (early decisions comment, completion comment with test steps, attached detail documents); triggers on "Linear-Kommentar".'
user-invocable: false
---

# Writing Linear Comments

A Linear comment has one reader in mind: the person who did **not** write the code. Usually that is
the product owner or a tester. They open the ticket to answer three questions, and only three:

1. **What was decided or assumed to build it, and what should I check?**
2. **What is different now?**
3. **What do I have to do to see it?**

**The ticket is the order; the comments are everything that happened while carrying it out.**
What the ticket already says stays in the ticket and is not repeated in a comment. What the
developers who implemented it decided or pointed out, and what Claude assumed on the way, goes into
the comments. The developer settles open points in the decision round, mostly without the product
owner in the room, and a reviewer or tester can only check a decision they can see. None of it is
written into the ticket description, which stays the order as it was given.

The answers come in two comments, in the order they arose:

- **The decisions comment** (`## Entscheidungen und Annahmen`), posted as soon as the decision
  round has settled something and kept at the current state until the work is done. The decisions
  are the premise the implementation was built on, so they come first, and the product owner can
  object while the work is still running.
- **The completion comment**, posted when the work goes to review or test: what changed, and how
  to see it.

Two documents attached to the ticket hold what would swell the comments: the questions Claude asked
during the implementation, with the options offered and the answers given, and the technical detail.

Everything else in a comment is something they scroll past. This skill decides what goes where.

## The rule

> **The two comments answer the three questions. Every other useful thing goes into a Linear
> document attached to the ticket, linked from the end of the completion comment.**

Both halves matter. Cutting the detail entirely loses information the next developer needs;
leaving it in a comment buries the three answers under material written for a different reader.
The attached document keeps it, one click away, without costing the product owner a single scroll.

## Part 1 — What goes in the comments

### Decisions and assumptions for the product owner

The decisions comment lists everything that was settled during the implementation and is not in
the ticket. The decision record's [source markers](../grilling-decisions/SKILL.md#source-markers)
decide what that is.

- **Posted early.** `take-ticket` posts it right after the developer confirms the decision round,
  once the record holds an `[Entwickler]` or `[Claude]` entry; when the round settled nothing beyond
  the ticket, it is posted when the first such entry arises during the implementation. With no such
  entry by the end there is no decisions comment, and the completion comment says so in its line.
- **Kept current, never posted twice.** Every later change (an assumption taken, a blocking stop, the
  scope round, a correction at the approval gate) updates the same comment via `save_comment` with
  its `id`. When the completion comment is written, the decisions comment is brought to its final
  state in the same pass, including the step numbers its `Prüfen:` lines point at. A ticket that
  comes back for rework keeps its decisions comment: the new run starts from it and updates it. Find
  it with `list_comments`: the comment lt-dev wrote that starts with `## Entscheidungen und Annahmen`;
  when there are several, the newest is the current one.
- **Only your own comment is edited.** Compare the decisions comment's `author` with the current user
  (`get_user` with `me`) before updating it. When a colleague's run posted it (the ticket came back
  to somebody else), leave it as it is: its author owns it, and Linear may not let anybody else edit
  it. Post a new decisions comment with the whole current state instead, and reply to the old one
  (`save_comment` with `parentId`) with `Überholt, aktueller Stand im Kommentar vom <TT.MM.JJJJ>.`
  From then on the new comment is the one kept current. The questions document is shared by the
  workspace and is updated in place as before.
- **`[Entwickler]` and `[Claude]` entries go in; `[Ticket <ID>]` entries stay out.** An entry the
  ticket already states is part of the order and is not repeated. Every other `E` and `A` goes in,
  the assumptions added during the implementation included.
- **Grouped by who settled it**: `Entscheidungen und Hinweise der Entwickler` (the developers'
  decisions, plus notes they gave that the reviewer or tester should know, such as a correction at
  the approval gate that changed the behaviour) and `Annahmen von Claude` (what Claude assumed
  without the developer's answer, including how it read ambiguous ticket text). The grouping makes
  per-entry markers unnecessary in the comment.
- **The question behind a decision lives in the questions document.** Question, options, and
  answer would swell the comment, so they go into the attached
  [questions document](#questions-document), where each question stands together with its answer.
  In the comment, a developer entry that answered a question only names it: `(auf Frage F1)`. An
  entry opens with `Entscheidung:` or `Hinweis:`, an assumption with what was assumed.
- **Plain German, per entry**: what was decided, in the words of somebody who uses the
  application; one `Warum:` line with the reason in a sentence, and the alternative that was
  dropped where the reader might have expected it; then one `Prüfen:` line naming what the reader
  should judge and where they see it: once the completion comment exists, the step of its
  `## Testanleitung` that shows it (not a step number from the developer's local test package, which
  counts differently; when rework left several completion comments, name the one meant by its date:
  `→ Schritt 3 im Abschlusskommentar vom 08.10.`), or, where nothing in the browser shows it, how else it shows ("nur im
  Gespräch zu klären", "zeigt sich erst beim nächsten Import"). Before that, the line names what to
  check without a step.
- **Entries in the comment, never only in a document.** Entry, reason, and what to check stay
  together in the comment; only the questions and the technical detail move to the documents, and
  none of it is written into the ticket description. A decision the product owner has to click to
  find is one they will not review, and a decision written into the description blurs what was
  ordered with how it was carried out.
- **The current state, not a history.** The comment shows the decisions that produced the result,
  nothing that was decided and later revised. A revised decision appears only in its final form, a
  dropped one not at all, and no entry says "geändert" or "entfällt".
- **Numbers stay put.** The comment is on the ticket while the work runs, so the product owner may
  already have answered about `E2`. Once posted, a number stays with its entry: a revised entry keeps
  it, a dropped entry's number is not given to another one, and nothing marks the gap. New entries
  continue after the highest number ever used. The questions document keeps its `F` numbers the same
  way and is updated in the same pass, so its `Führt zu` stays in step.

Where the entries come from, first match wins:

1. The record handed over in the same run: `ticket-cycle`'s `DECISION_RECORD`, or the
   `take-ticket` STEP 10 summary in this session.
2. An earlier run's state, read back from the ticket's decisions comment and its questions
   document; on a rework run it is the starting point the new entries are merged into.
3. Neither exists (work done by hand, a fresh session): derive the entries from the diff against
   the ticket. Every behaviour the ticket does not specify becomes a developer entry, and the
   comment preview is where the developer corrects them. An unattended run never lands here,
   because `ticket-cycle` always hands its record over.

```markdown
## Entscheidungen und Annahmen

Stand <TT.MM.JJJJ>. Bei der Umsetzung festgelegt, nicht im Ticket beschrieben. Bitte im Review bzw. Test mitprüfen.

Entscheidungen und Hinweise der Entwickler
- E1 Entscheidung: Gelöschte Aufträge bleiben im Hintergrund erhalten und verschwinden nur aus den Listen (auf Frage F1).
  Warum: Rechnungen verweisen auf den Auftrag; endgültiges Löschen hätte sie unvollständig gemacht.
  Prüfen: ob ein gelöschter Auftrag wirklich nirgends mehr auftaucht → Schritt 3 im Abschlusskommentar
- E2 Entscheidung: Die Liste zeigt 50 statt 20 Aufträge pro Seite.
  Warum: Disponenten scrollen sonst bei jedem Arbeitstag durch mehrere Seiten.
  Prüfen: dass eine volle Seite 50 Aufträge zeigt → Schritt 2 im Abschlusskommentar
- Hinweis: Der Export großer Auftragslisten dauert bewusst einige Sekunden.
  Prüfen: dass während des Exports ein Ladehinweis erscheint → Schritt 6 im Abschlusskommentar

Annahmen von Claude
- A1 Bestehende Aufträge brauchen keine Umstellung
  Warum: das neue Feld ist optional, alte Aufträge funktionieren ohne es weiter.
  Prüfen: ob sich ein alter Auftrag weiter normal öffnen lässt → Schritt 5 im Abschlusskommentar
```

### The completion comment

Exactly these, in this order. Nothing else.

| Block | Content | Omitted when |
|-------|---------|--------------|
| `## Umsetzung` | 1 to 3 sentences, plain language: what was wrong or missing, what happens now instead. Then one line on the decisions: `Entscheidungen und Annahmen: im Kommentar „Entscheidungen und Annahmen“.`, or `Entscheidungen und Annahmen: keine, umgesetzt wie im Ticket beschrieben.` when there is no decisions comment. | never |
| `## Testanleitung` | The complete manual test: environment, the account per role with its vault link, the prepared records, numbered steps with full links and concrete example data. Shape and wording come from [`writing-qa-test-instructions`](../writing-qa-test-instructions/SKILL.md). | never — the not-testable variant states the reason instead |
| `## Nicht in diesem Ticket` | Scope cuts decided during the implementation that the reader might otherwise expect, one line each, plus findings that are handled separately. A scope limit the ticket itself states stays in the ticket. | when there are none |
| `## Details` | One line per attached document, each with its link: the questions document first, then the technical one. | when no document was attached |

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
- **Never a secret.** A login names the test account and links its private 1Password entry; the
  password stays in the vault. What may appear and what never may, and the reasoning, live in
  [`writing-qa-test-instructions`](../writing-qa-test-instructions/SKILL.md), Part 2.

## Part 2 — What goes in the attached documents instead

Move it out of the comment as soon as it is written for a developer rather than for the reader above:

- file/line references, code, diffs, command output
- review findings, severity tables, trade-off analysis
- architecture rationale in developer language: patterns, libraries, technical trade-offs (the
  product decisions and their reasons are interpretation and stay in the comment)
- migration or rollout notes, config changes, environment variables
- performance numbers, load-test results, Lighthouse scores
- known limitations with a technical cause
- follow-up ideas that did not become tickets

**Write no document when there is nothing above to carry.** A ticket where the whole story fits in
three sentences gets three sentences and no attachment. An almost-empty document trains people to
stop opening them, which costs more than it saved.

### Technical document shape

```markdown
# <Ticket-ID> — Technische Details

Ergänzt den Abschlusskommentar vom <TT.MM.JJJJ>; Entscheidungen und Annahmen stehen im
gleichnamigen Kommentar.

## Was wurde geändert
<the implementation in developer language, with file:line references>

## Technische Begründung
<technical choices in developer language; an item about an entry of the decisions comment names
its number ("Zu E1: …"), so the two halves are easy to read side by side>

## Bekannte Einschränkungen
<or "keine">

## Nachgelagert
<what was deliberately not done, and what would have to happen for it — or "nichts">
```

The comment links the document from its `## Details` line; the document only mentions the
comment in text, because the Linear MCP returns no URL for a comment (a `save_comment` result
carries `id`, `body` and `author`, but no link — checked against a real result on 2026-10-08). An
entry number is named in the document only where it adds something technical about that entry.

Title conventions: `<Ticket-ID> — Fragen und Antworten` and `<Ticket-ID> — Technische Details`.
One document of each kind per ticket. A later run **updates** the existing one via `save_document`
with its `id` (or the `patch` operations) instead of attaching a second one, so the ticket never
accumulates a stack of near-identical documents. Updating means bringing it to the current state,
not appending a changelog.

### Questions document

Written whenever Claude asked the developer something during the implementation: the decision
round (`take-ticket` STEP 5c), a blocking stop later on, the scope round (STEP 9b). It keeps the
conversation behind the decisions without making the comment long. No question asked, no document.

**Attach it early, keep it current.** `take-ticket` attaches it right after the developer confirms
the decision round, so the answers survive a `/clear`, a summarised context, or a change of session,
and the product owner can see them while the work is still running. Every later question updates
the same document. It shows the current state, like the comment: a question answered again shows
only its final answer; a question whose decision was dropped is removed; a question that only
mattered for a path the implementation abandoned is removed too. Whenever the decisions comment
changes, the document is brought to its state in the same pass; its `F` numbers stay put like the
comment's entry numbers.

```markdown
# <Ticket-ID> — Fragen und Antworten

Fragen von Claude an den Entwickler bei der Umsetzung, Stand <TT.MM.JJJJ>. Die Entscheidungen
daraus stehen im Kommentar „Entscheidungen und Annahmen“ unter der Nummer, die bei „Führt zu“ steht.

## F1 <Kurztitel>
Frage: <die Frage, wie sie gestellt wurde>
Optionen:
- <Option> (Vorschlag von Claude)
- <Option>
Antwort: <die Antwort des Entwicklers; eine freie Antwort im Wortlaut>
Führt zu: E1
```

Question and answer stand together, in the order the questions arose. The source is the decision
record, which keeps every question with its entry
([`grilling-decisions`](../grilling-decisions/SKILL.md#decision-record)). A question whose answer
was "so wie im Ticket" leads to no comment entry; write `Führt zu: nichts, steht im Ticket`.

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

Fragen von Claude und Antworten zur Umsetzung: [<TICKET-ID> — Fragen und Antworten](<url>)
Technische Details und bekannte Einschränkungen: [<TICKET-ID> — Technische Details](<url>)
```

The questions document is attached with the same call, `title: "<TICKET-ID> — Fragen und Antworten"`
and `icon: ":speech_balloon:"`.

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

- **The three questions are answered in the comments themselves.** A comment that answers them
  only by pointing at a document has moved the reader's work rather than removed it.
- **The ticket is the order; the comments carry the implementation.** Every decision and note of
  the developers and every assumption of Claude is in the decisions comment, with its reason and
  what to check, the ones added during the implementation included. What the ticket already says is
  not repeated there. Neither the ticket description nor an attached document carries the entries.
- **Test steps are never abbreviated into the document.** They are the part the reader acts on;
  they stay in the comment in full, with links and example data.
- **No secret in a comment, and none in the attached documents either**: no password, one-time
  code, token, or public share link. Login names and private vault links are fine in all of them.
  The documents are workspace-readable exactly like the comment.
- **One document of each kind per ticket, updated in place.**
- **Only the current state is shown.** Decisions comment and questions document hold what produced
  the result: no superseded decision, no dropped question, no change history. One decisions comment
  per ticket, posted early and updated in place, rework included.
- **No document when there is no detail.** Silence is a valid outcome.

## Related Skills

- [`writing-qa-test-instructions`](../writing-qa-test-instructions/SKILL.md) — the testability decision and the exact wording of the test steps this skill places in the comment
- [`grilling-decisions`](../grilling-decisions/SKILL.md) — the decision record and the source markers its entries carry into the comment
- [`filing-ai-proposed-tickets`](../filing-ai-proposed-tickets/SKILL.md) — where a follow-up idea goes when it deserves its own ticket rather than a paragraph in the detail document
- [`unslop`](../unslop/SKILL.md) — the prose pass every comment gets before it is posted
