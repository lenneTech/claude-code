---
name: grilling-decisions
description: 'Round-based interview that settles every open decision with a human before implementation starts and ends in a decision record; triggers on "grill me" and "frag mich aus".'
user-invocable: false
---

# Grilling Open Decisions

Interview the user relentlessly about a plan, ticket, or design until you reach a shared understanding. The purpose is alignment before work starts: a change built on a wrong assumption costs the whole implementation, plus the review, browser walk, and merge that followed it. A question asked up front costs one click; the same question asked mid-implementation costs the user's context switch and stalls the run until they are back.

Take no action on the subject of the grilling until the user confirms the understanding is shared.

## The loop

1. **Look up every fact yourself** (see [Facts vs decisions](#facts-vs-decisions)). Arrive at the interview already knowing the code.
2. **Map the decision tree.** Every open decision branches into the decisions that hang off it.
3. **Settle what the ticket and the evidence settle.** Work every open decision through the five parts of a [decision brief](#decision-brief). What the ticket states clearly is recorded in its words; a gap the evidence leaves exactly one option for is recorded with its `Beleg:`; everything else stays open for the user ([Settle or ask](#settle-or-ask)).
4. **Re-check every remaining question against the sources** before it goes out ([Re-check before asking](#re-check-before-asking)). A question the sources already answer costs the user a decision they never needed to make.
5. **Ask the frontier as one round.** The frontier is every open decision whose prerequisites are already settled: the questions you can ask *now* without guessing at an answer you have not heard yet. A question that depends on another question still open in this round belongs to a *later* round.
6. **Present every question with its brief.** The brief ends in your recommendation, so the user decides in one click with the facts in view, without reading the code first or composing a design from scratch.
7. **Recompute the frontier** after each round: settled decisions push it outward, unblock questions that depended on them, and often retire questions or make them clear enough to settle from the evidence. Re-check and ask the next round.
8. **Stop when the frontier is empty**: every branch visited, nothing left silently assumed. Write the [decision record](#decision-record) and let the user confirm it.

## Settle or ask

The ticket (or the plan or spec being grilled) is the order, and it takes precedence: what it states clearly is implemented as written, as exactly as possible. Tickets are often imprecise, contradict themselves, or forget things, and those are the points that get decided. The fewer decisions the user has to make, the better, and every unclear one is theirs. The decision brief draws the line: write it for every open decision before anybody is asked, and let its outcome put the point into one of three cases.

**1. The ticket answers it clearly: implement it as written.** The point is settled and marked `[Ticket <ID>]`, also where a neighbouring feature does it differently or you would have chosen otherwise. Nobody is asked.

**2. The ticket is imprecise, contradicts itself, or misses a consequence: the user decides.** Ask with the brief when its wording reads two ways or leaves open what done means; when description, comments, acceptance criteria, and design disagree; when its picture of the current code is not what the code shows; or when following it literally would break something it does not mention (behaviour other features rely on, security, existing data). What the ticket means is the user's call, so these go to them even where you lean one way.

**3. The ticket says nothing: settle the gap when the evidence is unambiguous, ask otherwise.** Settle it yourself when exactly one option holds up:

- another source states the answer (a linked document, the design, the project docs), or the code handles this exact case one established way (`path:line`),
- nothing in the sources or the code points the other way,
- no other option has an advantage someone could reasonably rate higher, and
- it has no lasting consequences (data model, migration, permission default, a contract another module or team consumes). Those go to the user whenever the ticket is silent, however confident your own reasoning is.

Record a settled gap as an `Annahme` with its evidence on a `Beleg:` line ([Decision record](#decision-record)); the user sees it when confirming the record and can overturn it there. Every other gap goes to the user with the brief, and so does every point you are unsure about: doubt about whether a point is clear means it is not.

## Re-check before asking

A question that reaches the user asks them to decide, so before a round goes out, go back to the sources with its questions in mind. The first reading looked for the requirements; this one looks for the answer to one specific question, and finds what a general read passes over: a reply deep in a comment thread, a second frame in the design, an acceptance criterion that only works one way.

1. **Read the ticket again in full**, with the round's questions in mind: description, acceptance criteria, every comment and reply (not only the newest), and the images in them.
2. **Search the other sources for each question's terms**, in German and English and with synonyms (the entity, field, role, screen, or state it is about): parent, sub-, and linked issues, attached documents, earlier decisions comments and questions documents, every frame and state of the design, the flows, the project docs.
3. **Look for an answer that follows from what is already fixed**: another acceptance criterion that works with only one option, a decision taken earlier in this grilling, a test or validation that already pins behaviour the ticket leaves unchanged.

Then sort each question again by [Settle or ask](#settle-or-ask): an answer the ticket states clearly settles it as written; an answer in another source can settle a gap, with its `Beleg:`; a contradiction the re-check turned up stays a question, now with both quotes. Only a question that survives goes into the round, and part 3 of its brief names what the re-check covered, so the user sees the question is real.

## Decision brief

Five parts in this order, each answered from evidence you gathered in this session: the code as it is on the branch, the sources as they read today.

1. **Ist-Stand im Code**: what the code does today where the decision lands, with `path:line`. For something that does not exist yet, say so and name where you looked. Where the ticket describes the current behaviour differently than the code shows, state both: that gap is often the real question.
2. **Geplante Änderung**: what is changed, added, or removed, how, and why (the acceptance criterion or source that demands it). Separate what is already fixed from the fork the options settle.
3. **Ticket und Quellen**: what the ticket, its comments, linked tickets and documents, the design, and the project docs say about this point, the ticket first, quoted verbatim in „…“ with the source in parentheses (ticket and section, comment date, document title, Figma node, `CLAUDE.md:<line>`). Quote the sentence that matters, not the paragraph. Where sources disagree, quote each side. When no source addresses the point, say so and list what the [re-check](#re-check-before-asking) covered: that silence is why it is a question.
4. **Optionen**: two to four, the same ones the question offers, each with what it means concretely, its advantage, its drawback, and its impact: files and modules touched, existing data, other roles or consumers, tests, effort, and whether it is hard to undo later. An option the framework already ships is one of them.
5. **Empfehlung**: the option you would pick and why, argued from parts 1 to 3.

Keep each part to one to three lines: the brief is the context for one decision, not a report. Writing it is also the test from [Settle or ask](#settle-or-ask): when part 3 finds a quote that answers the point, or part 1 shows the code already decides it, the point is settled and leaves the round.

```
**F1 Löschverhalten von Rechnungen**

1. **Ist-Stand im Code:** `InvoiceService.delete()` löscht hart per `deleteOne` (`projects/api/src/server/modules/invoice/invoice.service.ts:88`), wird bisher aber nirgends aufgerufen. `Payment.invoice` verweist auf die Rechnung (`payment.model.ts:31`). Im Projekt gibt es beide Muster: `Order` löscht weich über `deletedAt` (`order.service.ts:54`), `Customer` hart (`customer.service.ts:71`).
2. **Geplante Änderung:** Admins bekommen in der Rechnungsliste eine Löschaktion (AK 3): neuer Endpoint `DELETE /invoices/:id`, Button in `InvoiceList.vue`. Fest steht, wer löschen darf; offen ist, ob der Datensatz dabei verschwindet.
3. **Ticket und Quellen:**
   - „Admins sollen fehlerhafte Rechnungen löschen können.“ (DEV-1234, Beschreibung)
   - „Löschen nur für Admins.“ (DEV-1234, Kommentar vom 02.10.2026)
   - Ob gelöschte Rechnungen erhalten bleiben, sagen die Quellen nicht (geprüft: Beschreibung, 3 Kommentare, Figma-Node 12:345, `docs/`).
4. **Optionen:**
   - **A Soft Delete** über `deletedAt`, wie bei `Order`. Vorteil: Historie und `Payment`-Verweise bleiben gültig. Nachteil: jede Abfrage braucht den Filter. Auswirkung: Modell, Service und drei Listen-Queries ändern sich; keine Migration, das Feld ist optional.
   - **B Hard Delete**, wie bei `Customer`. Vorteil: kein Zusatzfeld, kein Filter. Nachteil: die Rechnung ist endgültig weg. Auswirkung: `Payment`-Verweise laufen ins Leere und brauchen eine eigene Behandlung.
5. **Empfehlung:** A, weil Zahlungen auf die Rechnung verweisen und eine gelöschte Rechnung sonst nicht mehr nachvollziehbar ist.
```

The ticket is silent, the project has both precedents, and the choice shapes the data model, so this gap goes to the user. Had the description said „Gelöschte Rechnungen bleiben gespeichert und werden nur ausgeblendet“, the ticket would have settled it: Soft Delete, implemented as written, marked `[Ticket DEV-1234]`, no question. Had a comment demanded the opposite, the contradiction would have gone to the user, both quotes under part 3.

## Round format

Use `AskUserQuestion`: one call per round, up to four questions, each with its recommended option first and suffixed `(Recommended)`, each option's description carrying its impact in one line. The auto-provided "Other" entry carries free-text answers. When the frontier holds more than four questions, ask the most upstream ones first; their answers usually retire some of the rest.

Put the round's briefs in the same message as the call, right before it, numbered to match (`F1`, `F2`, …), so the user reads them with the questions open.

A question that only collects a fact the user alone holds (what they observed, which account they used) or a workflow choice (run a review, how to merge) needs no brief: its option labels carry what matters.

Without `AskUserQuestion` (plain chat, a non-interactive runner), print the round in that same format and wait for the answers.

## Facts vs decisions

Finding facts is your job. Asking the user for something you could have read is what makes an interview feel like an interrogation, and the answer you get from memory is less reliable than the one in the repo.

| Look it up yourself | Decide (settle from the evidence, or ask) |
|---|---|
| Which roles a service already allows (`@Restricted`, `@Roles`, `securityCheck`) | Which roles *should* be allowed |
| The current shape of an entity, DTO, or generated type (`types.gen.ts`, `sdk.gen.ts`) | Whether a field is added, renamed, or replaced |
| Whether an endpoint, page, or composable already exists | Whether to extend it or build beside it |
| What the ticket, its comments, and the linked Figma node actually say | What the ticket means where it is ambiguous |
| How a neighbouring feature solved the same problem | Whether this feature should follow that precedent |
| Which tests cover the affected paths today | Which seams the new tests should sit at |
| Whether the described defect still reproduces | What the correct behaviour is instead |

Reach for Read, Grep, Glob, the Linear MCP, and the Figma MCP before you reach for a question. Where a lookup is broad, dispatch a subagent for it and do not block on it: a running lookup is an unsettled prerequisite, so only the questions downstream of it wait, and the rest of the frontier is asked now.

## Question quality

- **Probe the edges, not the happy path.** Empty, null, very large, concurrent, unauthorised, offline. The happy path is the part everyone already agrees on.
- **Surface consequences that outlive the ticket:** a data model that is hard to migrate later, a permission default that becomes the precedent, a contract other teams will consume.
- **Cover what the implementation would otherwise stop for.** Before closing, walk the planned work once in your head (models, endpoints, permissions, UI states, tests) and put every point where you would otherwise pause through [Settle or ask](#settle-or-ask). That is what makes the run afterwards question-free.

## When the user is unreachable

An unclear decision belongs to the user, so a blocking one is never answered on their behalf. Split the open questions instead:

- **Blocking** (data model, permission behaviour, a missing acceptance criterion, anything that would need rework if guessed wrong): stop and wait.
- **Non-blocking**: proceed on an explicitly stated assumption and carry it into the summary as an `Annahme`, so the user can overturn it while the context is still fresh.

## Decision record

Close every grilling with a compact record in German, shown to the user for confirmation:

```
Entscheidungen
E1 Löschen: Soft Delete über `deletedAt` (optional, bestehende Rechnungen ohne Migration), Listen filtern standardmäßig [Entwickler]
   Frage (F1): Gelöschte Rechnungen endgültig entfernen (Hard Delete) oder im Hintergrund behalten (Soft Delete)? Empfehlung: Soft Delete
E2 Rechte: „Löschen nur für Admins.“, alle anderen 403 [Ticket DEV-1234]
Annahmen
A1 Nach dem Löschen bleibt die Liste auf derselben Seite [Claude]
   Beleg: alle Listen mit Löschaktion verhalten sich so (`OrderList.vue:88`, `CustomerList.vue:64`)
A2 Vor dem Löschen fragt ein Bestätigungsdialog nach [Claude]
   Beleg: beide Listen mit Löschaktion nutzen denselben Dialog (`OrderList.vue:92`, `CustomerList.vue:70`)
Außerhalb des Scopes
- Wiederherstellen gelöschter Einträge [Ticket DEV-1234]
```

**A decision that answered a question keeps the question.** Under the entry, record the question as it was asked, with the options offered, the recommendation, and the answer given, so anybody reading the decision later sees what it was chosen from. In a ticket, these lines become the ticket's questions document (`writing-linear-comments`), where each question stands with its answer. A decision the user gave unprompted, an entry taken from the ticket, and an `Annahme` have no question line.

**An entry taken from the ticket keeps the ticket's words** for the part that decides it, quoted. The record is what the implementation follows, so a paraphrase that drifts from the ticket would get built in place of the ticket.

**A gap you settled keeps its evidence.** A gap that [Settle or ask](#settle-or-ask) let you settle carries a `Beleg:` line under its entry: the quote with its source, or the `path:line`. The user checks it in seconds when confirming the record, and that confirmation is where they overturn it; a corrected entry becomes their decision. The `Beleg:` line serves the developer; the ticket's decisions comment states the reason in plain language instead (`writing-linear-comments`).

**The record is the current state, not a log.** It answers how the work got to where it is, so it only ever holds what produced the result. When a decision is revised later (a blocking stop, the scope round, a correction at the approval gate), its entry is replaced under the same number, never joined by a second one; an entry that no longer applies is deleted, and its question with it; an `Annahme` the user confirmed or corrected becomes a decision of theirs. A superseded entry costs every later reader time and contradicts what they will find in the code.

The record is the contract for the work that follows. Downstream steps treat a recorded decision as settled: they do not ask it again, and they do not silently deviate from it. When the implementation hits something the record does not cover, [Settle or ask](#settle-or-ask) decides first: what the ticket states clearly is built as written, and a gap the evidence settles becomes one more `Annahme` with its `Beleg:`, numbered on (`A3`, `A4`, …) and marked `[Claude]`. For a point that stays unclear, the [blocking vs non-blocking split](#when-the-user-is-unreachable) decides: a non-blocking one becomes an `Annahme` as well, and only a blocking one stops the run, presented with its brief.

### Source markers

When the record governs the implementation of a requirement somebody else owns (`take-ticket` STEP 5c and everything downstream of it), every entry carries one of three markers. They decide what travels into the ticket's comments: the ticket holds what was ordered and keeps it, the comments hold how it was interpreted and built.

| Marker | Meaning | In the ticket's decisions comment |
|---|---|---|
| `[Ticket <ID>]` | The order already says so: the ticket description, a comment that adds to the order (typically from the product owner or the requester), or a linked ticket (`<ID>` names which). A comment that reports implementation, such as an earlier completion comment, is not the order. | no: it stays where it is written and is not repeated |
| `[Entwickler]` | Settled by the developer who implements the ticket: answered in this round, or given later as a decision or a note. | yes, under the developer's entries; the question it answered goes into the ticket's questions document |
| `[Claude]` | An `Annahme` Claude took without the developer's answer, in this round or during the implementation: a gap the evidence settled (with its `Beleg:`), a non-blocking gap, or a reading of ambiguous ticket text while the developer could not be asked. | yes, under Claude's assumptions |

Mark every entry, including the facts the ticket answered that went into the record as decisions. On a ticket that comes back for rework, the record starts from the current state the earlier run left behind (its decisions comment and questions document): those entries keep their markers and count as settled, and only a contradiction with the new feedback reopens one. A record written while creating a ticket or grilling one's own plan (`create-story`, `create-task`, `create-bug`, `/lt-dev:interview`, `vibe:plan`) carries no markers: the person answering owns the requirement, so there is nobody else to tell apart.

## Completion criterion

The frontier is empty, what the ticket states clearly is recorded in its words, every question that reached the user survived the re-check, every unclear decision is answered by the user, every gap you settled carries its `Beleg:`, every assumption is written down and labelled, every entry carries its [source marker](#source-markers) where the record governs someone else's requirement, and the user has confirmed the decision record. Only then does implementation begin.

## Related Skills & Commands

**User-facing command:** `/lt-dev:interview [plan-file-path]` grills against a plan file and writes the outcome back into it

**Invoked from ticket creation** (the cheapest point to grill: the person with the answer is still in the room, and the ambiguity is otherwise re-paid by every later reader):
- `/lt-dev:create-story`, `/lt-dev:create-task`: frontier rounds over the open elements before the ticket is written
- `/lt-dev:create-bug`: aimed at one target, whether someone else could reproduce it

**Invoked from planning:**
- `/lt-dev:vibe:plan` settles the spec's open decisions before the plan bakes them into phases
- `/lt-dev:spec-to-tasks` settles them before they become acceptance criteria

**Invoked from implementation:**
- `/lt-dev:take-ticket` STEP 5b (stale-ticket verdicts), STEP 5c (decision round before the first line of code, a full round on larger tickets), STEP 9b (completeness delta)
- `/lt-dev:ticket-cycle` inherits all three via `take-ticket`

**Works closely with:**
- `writing-linear-comments` skill: carries the record's `[Entwickler]` and `[Claude]` entries into the ticket's decisions comment for the product owner, posted early and kept current
- `building-stories-with-tdd` skill: the seams agreed here are the seams its tests are written at
- `validating-changes-in-browser` skill: the roles and states agreed here become the walked list
