---
name: grilling-decisions
description: 'Relentless round-based interview that settles every open decision before implementation starts. Maps the decisions as a tree, asks the whole frontier (every question whose prerequisites are settled) per round with a recommended answer on each, looks facts up in the codebase instead of asking for them, and closes with a decision record that lets the implementation run without further questions. Activates on "grill me", "interview me", "stress-test this", "frag mich aus", "löcher mich", or when a command reaches open questions it must settle with a human before writing code. NOT for reviewing finished code (use /lt-dev:review). NOT for autonomous fact-finding without a human in the loop.'
user-invocable: false
---

# Grilling Open Decisions

Interview the user relentlessly about a plan, ticket, or design until you reach a shared understanding. The purpose is alignment before work starts: a change built on a wrong assumption costs the whole implementation, plus the review, browser walk, and merge that followed it. A question asked up front costs one click; the same question asked mid-implementation costs the user's context switch and stalls the run until they are back.

Take no action on the subject of the grilling until the user confirms the understanding is shared.

## The loop

1. **Look up every fact yourself** (see [Facts vs decisions](#facts-vs-decisions)). Arrive at the interview already knowing the code.
2. **Map the decision tree.** Every open decision branches into the decisions that hang off it.
3. **Ask the frontier as one round.** The frontier is every decision whose prerequisites are already settled: the questions you can ask *now* without guessing at an answer you have not heard yet. A question that depends on another question still open in this round belongs to a *later* round.
4. **Carry a recommended answer on every question.** State the option you would pick and why, so the user confirms in one click instead of composing a design from scratch.
5. **Recompute the frontier** after each round: settled decisions push it outward, unblock questions that depended on them, and often retire questions entirely. Ask the next round.
6. **Stop when the frontier is empty**: every branch visited, nothing left silently assumed. Write the [decision record](#decision-record) and let the user confirm it.

## Round format

Use `AskUserQuestion`: one call per round, up to four questions, each with its recommended option first and suffixed `(Recommended)`. The auto-provided "Other" entry carries free-text answers. When the frontier holds more than four questions, ask the most upstream ones first; their answers usually retire some of the rest.

Where a question needs more context than an option label carries (a trade-off, a code excerpt, a consequence), put that context in a short message right before the call, numbered to match:

```
**F1 Löschverhalten:** Soft Delete behält die Historie, jede Query braucht dann aber den Filter. Hard Delete ist einfacher, der Datensatz ist dann weg.
Empfehlung: Soft Delete, weil Rechnungen auf den Datensatz verweisen.

**F2 Wer darf löschen:** ...
```

Without `AskUserQuestion` (plain chat, a non-interactive runner), print the round in that same format and wait for the answers.

## Facts vs decisions

Finding facts is your job. Asking the user for something you could have read is what makes an interview feel like an interrogation, and the answer you get from memory is less reliable than the one in the repo.

| Look it up yourself | Ask the user |
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

- **Skip anything the source already answers.** A question whose answer is written in the ticket spends the user's attention for nothing.
- **Probe the edges, not the happy path.** Empty, null, very large, concurrent, unauthorised, offline. The happy path is the part everyone already agrees on.
- **Name the trade-off.** "Soft delete keeps the audit trail but every query needs the filter; hard delete is simpler but the record is gone" beats "soft or hard delete?".
- **Surface consequences that outlive the ticket:** a data model that is hard to migrate later, a permission default that becomes the precedent, a contract other teams will consume.
- **Ask what the implementation would otherwise stop for.** Before closing, walk the planned work once in your head (models, endpoints, permissions, UI states, tests) and ask about every point where you would otherwise pause and ask the user. That is what makes the run afterwards question-free.

## When the user is unreachable

Decisions belong to the user, so never answer a blocking question on their behalf. Split the open questions instead:

- **Blocking** (data model, permission behaviour, a missing acceptance criterion, anything that would need rework if guessed wrong): stop and wait.
- **Non-blocking**: proceed on an explicitly stated assumption and carry it into the summary as an `Annahme`, so the user can overturn it while the context is still fresh.

## Decision record

Close every grilling with a compact record in German, shown to the user for confirmation:

```
Entscheidungen
E1 Löschen: Soft Delete über `deletedAt`, Listen filtern standardmäßig [Entwickler]
   Frage (F1): Gelöschte Datensätze endgültig entfernen (Hard Delete) oder im Hintergrund behalten (Soft Delete)? Empfehlung: Soft Delete
E2 Rechte: Admin und Owner dürfen löschen, alle anderen 403 [Ticket DEV-1234]
Annahmen
A1 Bestehende Datensätze brauchen keine Migration (Feld ist optional) [Claude]
Außerhalb des Scopes
- Wiederherstellen gelöschter Einträge [Ticket DEV-1234]
```

**A decision that answered a question keeps the question.** Under the entry, record the question as it was asked, with the options offered, the recommendation, and the answer given, so anybody reading the decision later sees what it was chosen from. In a ticket, these lines become the ticket's questions document (`writing-linear-comments`), where each question stands with its answer. A decision the user gave unprompted, an entry taken from the ticket, and an `Annahme` have no question line.

**The record is the current state, not a log.** It answers how the work got to where it is, so it only ever holds what produced the result. When a decision is revised later (a blocking stop, the scope round, a correction at the approval gate), its entry is replaced under the same number, never joined by a second one; an entry that no longer applies is deleted, and its question with it; an `Annahme` the user confirmed or corrected becomes a decision of theirs. A superseded entry costs every later reader time and contradicts what they will find in the code.

The record is the contract for the work that follows. Downstream steps treat a recorded decision as settled: they do not ask it again, and they do not silently deviate from it. When the implementation hits something the record does not cover, the [blocking vs non-blocking split](#when-the-user-is-unreachable) decides: a non-blocking point becomes one more `Annahme`, numbered on (`A2`, `A3`, …) and marked `[Claude]`, and only a blocking one stops the run.

### Source markers

When the record governs the implementation of a requirement somebody else owns (`take-ticket` STEP 5c and everything downstream of it), every entry carries one of three markers. They decide what travels into the ticket's comments: the ticket holds what was ordered and keeps it, the comments hold how it was interpreted and built.

| Marker | Meaning | In the ticket's decisions comment |
|---|---|---|
| `[Ticket <ID>]` | The order already says so: the ticket description, a comment that adds to the order (typically from the product owner or the requester), or a linked ticket (`<ID>` names which). A comment that reports implementation, such as an earlier completion comment, is not the order. | no: it stays where it is written and is not repeated |
| `[Entwickler]` | Settled by the developer who implements the ticket: answered in this round, or given later as a decision or a note. | yes, under the developer's entries; the question it answered goes into the ticket's questions document |
| `[Claude]` | An `Annahme` Claude took without the developer's answer, in this round or during the implementation, including a reading of ambiguous ticket text. | yes, under Claude's assumptions |

Mark every entry, including the facts the ticket answered that went into the record as decisions. On a ticket that comes back for rework, the record starts from the current state the earlier run left behind (its decisions comment and questions document): those entries keep their markers and count as settled, and only a contradiction with the new feedback reopens one. A record written while creating a ticket or grilling one's own plan (`create-story`, `create-task`, `create-bug`, `/lt-dev:interview`, `vibe:plan`) carries no markers: the person answering owns the requirement, so there is nobody else to tell apart.

## Completion criterion

The frontier is empty, every blocking question is answered by the user, every assumption is written down and labelled, every entry carries its [source marker](#source-markers) where the record governs someone else's requirement, and the user has confirmed the decision record. Only then does implementation begin.

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
