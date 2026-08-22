---
name: grilling-decisions
description: 'Relentless one-question-at-a-time interview that resolves every open decision before implementation starts. Walks the decision tree in dependency order, carries a recommended answer on every question, and looks facts up in the codebase instead of asking for them. Activates when the user says "grill me", "interview me", "stress-test this", "frag mich aus", or when a command reaches open questions it must settle with a human before writing code. NOT for reviewing finished code (use /lt-dev:review). NOT for autonomous fact-finding without a human in the loop.'
user-invocable: false
---

# Grilling Open Decisions

Interview the user relentlessly about a plan, ticket, or design until you reach a shared understanding. The purpose is alignment before work starts: a change built on a wrong assumption costs the whole implementation, plus the review, browser walk, and merge that followed it.

Take no action on the subject of the grilling until the user confirms the understanding is shared.

## The loop

1. **Look up every fact yourself** (see [Facts vs decisions](#facts-vs-decisions)). Arrive at the interview already knowing the code.
2. **Build the decision tree.** Every open decision branches into the decisions that hang off it. Ask a question only when its prerequisites are settled, so no answer rests on a guess about an answer you have not heard yet.
3. **Ask one question, wait for the answer.** Several questions at once are bewildering, and the user's answer to the first usually reshapes the rest.
4. **Carry a recommended answer on every question.** State the option you would pick and why, so the user can confirm in one word instead of composing a design from scratch. `AskUserQuestion` renders this as the first option, suffixed `(Recommended)`.
5. **Recompute the tree** after each answer: settled decisions unblock questions that depended on them, and sometimes retire questions entirely.
6. **Stop when nothing is left silently assumed** and the user confirms the shared understanding.

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

Reach for Read, Grep, Glob, the Linear MCP, and the Figma MCP before you reach for a question. Where the lookup is broad, dispatch a subagent for it and keep grilling on the branches that do not depend on its result.

## Question quality

- **Skip anything the source already answers.** A question whose answer is written in the ticket spends the user's attention for nothing.
- **Probe the edges, not the happy path.** Empty, null, very large, concurrent, unauthorised, offline. The happy path is the part everyone already agrees on.
- **Name the trade-off.** "Soft delete keeps the audit trail but every query needs the filter; hard delete is simpler but the record is gone" beats "soft or hard delete?".
- **Surface consequences that outlive the ticket:** a data model that is hard to migrate later, a permission default that becomes the precedent, a contract other teams will consume.

## When the user is unreachable

Decisions belong to the user, so never answer a blocking question on their behalf. Split the open questions instead:

- **Blocking** (data model, permission behaviour, a missing acceptance criterion, anything that would need rework if guessed wrong): stop and wait.
- **Non-blocking**: proceed on an explicitly stated assumption and carry it into the summary as an `Annahme`, so the user can overturn it while the context is still fresh.

## Completion criterion

Every branch of the tree visited, every blocking question answered by the user, every assumption written down and labelled. The user has confirmed, in their own words, that the understanding is shared. Only then does implementation begin.

## Related Skills & Commands

**User-facing command:** `/lt-dev:interview [plan-file-path]` — grills against a plan file and writes the outcome back into it

**Invoked from — ticket creation** (the cheapest point to grill: the person with the answer is still in the room, and the ambiguity is otherwise re-paid by every later reader):
- `/lt-dev:create-story`, `/lt-dev:create-task` — frontier rounds over the open elements before the ticket is written
- `/lt-dev:create-bug` — aimed at one target: could someone else reproduce it?

**Invoked from — planning:**
- `/lt-dev:vibe:plan` — settles the spec's open decisions before the plan bakes them into phases
- `/lt-dev:spec-to-tasks` — settles them before they become acceptance criteria

**Invoked from — implementation:**
- `/lt-dev:take-ticket` STEP 5a (open questions from the requirements map), STEP 5b (stale-ticket verdicts), STEP 9b (completeness delta)
- `/lt-dev:ticket-cycle` — inherits all three via `take-ticket`

**Works closely with:**
- `building-stories-with-tdd` skill — the seams agreed here are the seams its tests are written at
- `validating-changes-in-browser` skill — the roles and states agreed here become the walked list
