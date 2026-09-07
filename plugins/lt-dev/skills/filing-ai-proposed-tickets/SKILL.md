---
name: filing-ai-proposed-tickets
description: 'Governs every Linear ticket Claude opens for work nobody asked for: an improvement idea, an out-of-scope finding, a refactor, a follow-up. Requires a duplicate search before filing, routes the ticket into the team Triage state, marks it with an AI label so a human sees at a glance that a machine proposed it, and caps how many proposals one run may file. Activates whenever a command is about to create a ticket that did not come from the user, and on "Ticket dafür anlegen", "Folge-Ticket", "sollte man mal", "separates Ticket". NOT for tickets the user asked for (use create-story / create-task / create-bug). NOT for tracking findings a review deliberately dropped.'
user-invocable: false
---

# Filing AI-Proposed Tickets

A ticket Claude opens on its own initiative is a different object from a ticket a person wrote. It
carries a machine's judgement about what matters, it arrives in a backlog the machine does not have
to work through, and it competes for attention with work somebody actually committed to. So it is
filed differently: it lands in **Triage**, it is **labelled** as an AI proposal, and it is filed
**only after** checking that the same idea is not already sitting in the backlog.

## When this applies

Any ticket whose origin is Claude rather than the user:

- an improvement, refactor, or feature idea noticed while doing something else
- a finding from `/lt-dev:review` or the browser walk that is real but outside the current ticket
- a root cause discovered while fixing a symptom, where the cause belongs elsewhere
- a follow-up that a deliberate scope cut left behind

It does **not** apply to tickets the user asked for. Those go through `/lt-dev:create-story`,
`/lt-dev:create-task`, or `/lt-dev:create-bug` and land in the normal workflow with no AI marking:
a human decided they should exist, which is exactly the signal Triage and the label are there to
supply for everything else.

## Part 0 — The gate: does this deserve a ticket at all?

Ask before anything else, because the failure mode here is not a badly filed ticket, it is a
hundred well-filed ones. One task that spawns a dozen follow-ups has not helped anybody; it has
moved the work into a backlog and added the cost of triaging it.

File a proposal only when all three hold:

- **It is demonstrated, not suspected.** You can name the concrete failure, the concrete cost, or
  the concrete missing capability. "Könnte man schöner machen" is not a ticket.
- **It survives outside this conversation.** Somebody reading only the ticket, weeks later, can
  tell what it is for.
- **Doing it later is genuinely worse than never doing it.** If nobody would miss it, dropping it
  is the honest outcome.

**A finding a review deliberately dropped does not become a ticket.** Below the severity floor
means it was judged not worth acting on — turning it into a ticket reverses that judgement by the
back door and re-creates exactly the pile the floor exists to prevent. Dropped is dropped.

**Cap: at most three proposal tickets per run.** More than three means the run found a theme, not a
list. File one ticket that names the theme and lists the instances in its body. If a fourth
genuinely independent proposal turns up, that is a signal to ask the user rather than to keep filing.

**Never re-file something the user declined in this session.**

## Part 1 — Search for an existing ticket first

The backlog usually already knows. Filing a near-duplicate costs somebody a merge decision and
splits the discussion across two tickets.

**1. Derive three to five distinct search phrases** — not variations of your proposed title. Cover
the affected surface (`Rechnungsübersicht`), the symptom (`Sortierung falsch`), and the mechanism
(`Pagination`). A single phrase finds a single ticket.

**2. Run the searches:**

```
mcp__plugin_lt-dev_linear__list_issues   team: "<team>"   query: "<phrase>"   limit: 10
                                         fields: ["id", "title", "status", "labels", "url"]
```

Plus one pass over the team's existing AI proposals, which are where a previous run would have put
the same idea:

```
mcp__plugin_lt-dev_linear__list_issues   team: "<team>"   label: "<the AI label>"   limit: 50
```

**3. Read the candidates before judging them.** Linear's `query` is a fuzzy title search: it
returns loosely related tickets, and a plausible-looking title is not evidence. Open each candidate
with `get_issue` and decide against its actual content.

**4. Act on the outcome:**

| Outcome | Action |
|---------|--------|
| A ticket already covers the same need | **Do not create anything.** Add what is new as a comment on that ticket (per [`writing-linear-comments`](../writing-linear-comments/SKILL.md)), or sharpen its description via `save_issue` with `patch`. Report which ticket you extended. |
| A ticket covers part of it | Extend that one with the overlapping part; file the genuinely new remainder as its own proposal and link the two with `relatedTo`. |
| A ticket covers it but was closed as "Won't Do" / "Won't Fix" | **Do not re-file.** Somebody already decided. Say so in the report instead. |
| Nothing matches | File the proposal per Part 2. |

State the search outcome in the report either way — "kein passendes Ticket gefunden (5 Suchen)" is
information, and it is what makes the duplicate check checkable rather than claimed.

## Part 2 — File it

**1. Resolve the Triage state.** Triage is where a human decides whether a proposal becomes work.
That decision is the point of the whole routing, so a proposal never lands in a working state.

```
mcp__plugin_lt-dev_linear__list_issue_statuses   team: "<team>"
```

- An entry with `type: "triage"` exists → create the issue with `state: "triage"`. The type string
  resolves directly; you do not need the state id.
- No triage state (the team has Triage disabled) → use the **unstarted** state, usually `Open`, and
  say in one line that the team has no Triage so the ticket landed in `Open` instead. **Never
  `Backlog`**: the auto-pick pool of `take-ticket` and `ticket-cycle` excludes it, so a backlog
  ticket is one nobody will ever pick up again.

**2. Resolve the AI label.** Read the team's labels and take the first case-insensitive match from:
`KI-Vorschlag`, `KI-Idee`, `KI`, `AI-Suggestion`, `AI Suggestion`, `ai-suggested`, `AI`, `Claude`.

```
mcp__plugin_lt-dev_linear__list_issue_labels   team: "<team>"   limit: 250
```

No match → create the default once, scoped to the team, and mention it in one line so the user
knows a new label now exists in their workspace:

```
mcp__plugin_lt-dev_linear__save_issue_label
  name:        "KI-Vorschlag"
  color:       "#8B5CF6"
  description: "Von Claude Code automatisch vorgeschlagenes Ticket — vor der Umsetzung fachlich prüfen"
  teamId:      "<team uuid>"
```

A team that prefers a different name creates a label with any of the recognised names once; every
later run finds it and uses it.

**3. Create the ticket** with `save_issue`: `team`, `title`, `description` (Part 3), `state` from
step 1, `labels` including the AI label, and `relatedTo` where a related ticket was found. Leave it
**unassigned** — assigning a machine's proposal to a person hands them work they never accepted.
Set no priority; priority is the triaging human's call.

**4. Report it** in one line per ticket: identifier, title, state, and what the duplicate search
found.

## Part 3 — What the ticket says

The reader is a person deciding in Triage whether this is worth doing. They need the evidence, not
the enthusiasm.

```markdown
> Vorschlag von Claude Code — nicht beauftragt. Bitte in Triage fachlich prüfen.

## Vorschlag

<one or two sentences: what should change, in the language of the person who would benefit>

## Beleg

<what was actually observed, with file:line, log excerpt, or reproduction steps. This is the part
that makes the proposal checkable — without it the ticket is an opinion.>

## Auslöser

Aufgefallen bei <Ticket-ID / Aufgabe>. <One sentence on why it was out of scope there.>

## Nutzen und Kosten

<what improves, and a rough size. "Unklar" is an acceptable answer; a made-up estimate is not.>
```

Rules for the body:

- **The evidence section is mandatory.** A proposal without it does not clear Part 0's first
  condition and should not have reached this point.
- **Name the origin ticket.** Triage needs to know which piece of work turned this up.
- **No severity labels, no scores, no percentages** carried over from a review report. They mean
  nothing outside the report they came from.
- **German for lenne.tech workspaces**, matching the surrounding tickets.
- Run the prose through [`unslop`](../unslop/SKILL.md) before posting.

## Hard Rules

- **Search before filing, and report what the search found.**
- **Triage, or the unstarted state when the team has no Triage. Never Backlog.**
- **Always labelled.** An unlabelled AI ticket is indistinguishable from a commitment somebody made.
- **Unassigned, no priority.**
- **At most three per run**, and never more than one per distinct theme.
- **A dropped review finding stays dropped.** It does not reappear as a ticket.
- **Never a proposal for work the user explicitly asked for** — that is a normal ticket.

## Related Skills

- [`writing-linear-comments`](../writing-linear-comments/SKILL.md) — the comment format used when extending an existing ticket instead of filing a new one
- [`unslop`](../unslop/SKILL.md) — the prose pass every ticket body gets
- [`coordinating-peer-sessions`](../coordinating-peer-sessions/SKILL.md) — before filing against code another session is mid-change on, ask its author instead
