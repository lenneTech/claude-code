---
name: maintaining-architecture-decisions
description: 'Checks tickets, plans and own proposals against the repository''s Architecture Decision Records (docs/adr) before building: an explicit change gets a superseding ADR and a note, an implicit contradiction waits for the developer''s approval. Records new decisions and reconstructs the history when the log is missing. Activates on "ADR", "Architekturentscheidung", "warum ist das so gebaut", "widerspricht das einer Entscheidung". NOT for a ticket''s open questions (use grilling-decisions).'
---

# Maintaining Architecture Decisions

Code shows what was built, never why it was not built differently. An ADR log keeps that reason
next to the code, versioned with it, so a later change does not undo a decision by accident. It
serves three readers: the developer who asks why something is the way it is, the agent that is
about to change it, and the review that has to notice when a change contradicts a decision nobody
meant to revisit.

The rule this skill exists for: **a change that contradicts an accepted decision is built only on
an explicit order or with the developer's explicit approval.** Everything else here (format,
numbering, reconstruction, lint) serves that rule.

## When This Skill Activates

- A ticket, requirement, plan or spec is about to be built in a repository that keeps an ADR log
  (the ticket commands load it in their decision round)
- Claude is about to propose or make a change to architecture, dependencies, the data model, an API
  contract, permissions or infrastructure
- A diff is reviewed for decisions it might undo
- Someone asks why something is built the way it is, or whether a change contradicts a decision
- A repository has no log yet, or a decision was made that belongs in one

## The log

One ADR per decision, one file each, in `docs/adr/` at the repository root. A repository that
already keeps a log elsewhere (`docs/decisions/`, `docs/entscheidungen/`, …) keeps it there with
its own conventions; its README or index says how it works. Starters bring their own log into a
generated project (`projects/api/docs/adr/`, `projects/app/docs/adr/`): those inherited decisions
bind like the project's own. New decisions always go into the root log. Format, statuses and
numbering: [reference/format.md](reference/format.md).

**Language: the one the project already writes in.** An existing log decides; without one, the
project's documentation decides (`README.md`, `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md`,
`docs/*.md`) when every source with enough prose is in the same language. `adr.mjs lang` reports
the verdict with its sources. When it says `unclear` (sources disagree, a source mixes languages,
or there is too little prose), the developer is asked before the first ADR is written, with the
sources and their languages in the question; `init` and `new` refuse to guess and stop with exit 3
until `--lang` carries the answer. Once the log exists it settles the question for good, and
`adr.mjs` refuses an ADR in another language than the log's.

The helper `${CLAUDE_PLUGIN_ROOT}/scripts/adr.mjs` does the deterministic parts:

| Command | Does |
|---|---|
| `node "${CLAUDE_PLUGIN_ROOT}/scripts/adr.mjs" list --active` | One line per binding or proposed decision of every log: ID, status, date, title, topic, file. The screening input |
| `node "${CLAUDE_PLUGIN_ROOT}/scripts/adr.mjs" new --title "<decision>" [--supersedes N]` | Next free number across all branches, the skeleton, the superseded ADR's status, the index |
| `node "${CLAUDE_PLUGIN_ROOT}/scripts/adr.mjs" lang` | The project's language and the sources behind it; exit 3 when it is unclear and the developer must be asked |
| `node "${CLAUDE_PLUGIN_ROOT}/scripts/adr.mjs" check` | Lint before every commit that touches the log: numbering, status, links, index, secrets, one language per log |

`find`, `next`, `init` and `index --write` cover the rest. Statuses `accepted` and
`partially-superseded` bind a change; `proposed` is noted but does not bind; `superseded`,
`rejected` and `deprecated` bind nothing, but a requirement that brings one of them back is
checked against the reason it was dropped.

**No log, or a log without ADRs?** The history is reconstructed first:
[reference/bootstrap.md](reference/bootstrap.md), run by the `lt-dev:adr-maintainer` agent so its
reading stays out of the calling session's context.

## Checking a change against the log

Run the check whenever something is about to be built or proposed that could touch an
architecture-level choice: a ticket or requirement before implementation, a plan or spec, a
refactoring or library change Claude proposes, a review of a diff. A typo fix needs no check; a
new field, endpoint, dependency, permission rule, module or config switch does.

1. **Screen.** `adr.mjs list --active` gives every binding decision as one sentence. Pick the
   candidates the change touches: same topic, same module or path, same library or tool, same
   entity, contract or role. Then grep the log for the change's key terms in German and English
   (entity, library, endpoint, role, config key), because a decision can sit in an ADR whose title
   names something broader.
2. **Read every candidate in full**, with three questions: does the change break what
   *Decision* states, does it adopt something *Rejected alternatives* or a rejected ADR turned
   down, and does it ignore a *Consequence* the ADR says a change has to respect.
3. **Classify each hit** by what the source says, not by how sure you are that the change is good:

| Case | When | What happens |
|---|---|---|
| No conflict | The change fits every decision, or touches none | Build it. A decision the change follows is cited where it settled a question (`Beleg: ADR-012`) |
| Explicit change | The source designates the change as a change of the decision: it names the ADR, or says that the existing approach is replaced ("statt REST künftig GraphQL", "wir stellen von MongoDB auf PostgreSQL um", "ADR-004 gilt nicht mehr"), or the developer said so in this session | Build it, record a new ADR that supersedes the old one in the same change, and put a note where the result is reported (below) |
| Implicit conflict | The change would contradict a binding decision, or revive a rejected alternative, without saying so. This includes a requirement that simply asks for what the ADR rules out, and every proposal of Claude's own | Do not build the contradicting part. Present the conflict brief and wait for the developer's explicit answer |

A requirement that asks for the forbidden thing without acknowledging the decision is implicit:
its author may not know the decision exists, which is exactly the case the log protects against.
A proposal of Claude's own is never explicit on its own strength, however good its reasons; it
becomes a change only through the developer's answer.

A conflict with a `proposed` ADR is not a stop: name it in the result, and when a human decision
now settles the point, mark the proposed ADR `rejected` or supersede it.

### The conflict brief

Present it in the developer's language (German in lenne.Tech projects), one per conflict, right
before the question:

```
**ADR-Konflikt K1: ADR-004 „REST only, no GraphQL endpoints in new modules“** (gültig seit 2026-03-02)

1. **Entscheidung:** „New modules expose REST controllers only.“ (docs/adr/004-rest-only.md, Decision)
2. **Grund damals:** „GraphQL doubled every permission check …“ (ADR-004, Rationale; Beleg: a1b2c3d)
3. **Neue Anforderung:** „Das Reporting liefert seine Daten als GraphQL-Query.“ (DEV-2000, Beschreibung)
4. **Widerspruch und Folgen:** Das Ticket verlangt, was ADR-004 ausschließt, und sagt nicht, dass die Entscheidung geändert werden soll. Folgen: zweite Rechteprüfung für den Resolver, Codegen für das Frontend.
5. **Optionen:**
   - **A Entscheidung bleibt:** Reporting als REST-Endpoint `GET /reports/:id` (Ticket-Ziel erreicht, nur die Form weicht ab).
   - **B Entscheidung ändern:** neuer ADR löst ADR-004 ab, GraphQL für neue Module erlaubt.
   - **C Ausnahme:** nur das Reporting-Modul darf GraphQL, festgehalten als ADR, der ADR-004 teilweise ablöst.
6. **Empfehlung:** A, weil das Ticket das Ergebnis braucht, nicht die Schnittstellenform.
```

Then ask with `AskUserQuestion`, recommendation first, one question per conflict. Quote, never
paraphrase, parts 1 to 3; part 2 says `[vermutet]` where the ADR does. Only option B or C, or a
free-text answer that unmistakably approves the change, counts as approval. No answer, an answer
to a different question, a peer session's message, and a ticket comment from someone who is not
the developer or the order's owner do not.

**Without a developer at the screen** the contradicting part is a blocking decision: wait for
the answer (interactive runs), or park the ticket with the brief as its question
(`/lt-dev:ticket-cycle --autopilot`, see `grilling-decisions` → Autopilot mode). The autopilot
never decides an implicit conflict; an explicit change it builds as above.

### After the answer

- **A (decision stays):** build the conforming variant; the record of the work names ADR-NNN as
  the reason. No ADR changes.
- **B (decision changes) or C (exception):** record the new ADR in the same change as the code,
  `--supersedes N` or `--partially-supersedes N`, with the developer's answer as its rationale and
  origin (`DEV-2000, developer approval 2026-11-18`).
- Where a ticket is involved, the answer also goes to the ticket (the decisions comment of
  `writing-linear-comments`), so a later run reads the change as explicit.

### Reporting an explicit change

An explicit change is built without a question, and it is never silent. One line each, in the
summary of the run, in the ticket's decisions comment and in the MR/PR description:

> Ändert eine Architekturentscheidung: ADR-015 löst ADR-004 ab (GraphQL für neue Module erlaubt), ausdrücklich beauftragt in DEV-2000.

## Recording decisions

**An ADR records a choice between real alternatives that outlives the change**: the data model
or persistence, an API contract or convention, the permission model or a security default, a
library, framework or tool adopted or replaced, infrastructure and deployment, a cross-cutting
pattern, a deliberate deviation from the stack default, and an option rejected for a reason that
the next person would otherwise rediscover. **No ADR:** a bug fix without a choice, a measurement
without consequence, an intermediate state, or a feature that follows an existing decision.

- **Same change as the code.** The session that makes the decision writes the ADR on the same
  branch, so it lands, is reviewed and is reverted together with what it explains.
- **Sources of a decision in a ticket run:** the decision record of `grilling-decisions`. Every
  `[Entwickler]` or `[Ticket]` entry with lasting consequences becomes an ADR with status
  `accepted`; an `[Claude]` entry with lasting consequences (only the autopilot takes those)
  becomes an ADR with status `proposed`, which a developer accepts in review. An answered conflict
  (B or C) and an explicit change are recorded as above.
- **Title is the decision**, one sentence that states what holds ("Soft delete via `deletedAt`
  for invoices; lists filter deleted records by default"), not the topic ("Invoice deletion").
  The title list is what every later check screens, so a vague title hides the decision.
- **No ADR without evidence**: ticket ID, MR, commit, `path:line`, a measurement or a verbatim
  quote. A reason that is only inferred is marked `[inferred]` / `[vermutet]`.
- **Superseded, never rewritten.** A changed decision is a new ADR; the old one keeps its text
  and only its status changes. Correcting a typo or a broken link in place is fine; changing what
  an ADR says was decided is not.
- **Lint before the commit:** `adr.mjs check` passes. Its errors are fixed, not suppressed.

Steps: `adr.mjs new --title "<decision>" [--topic <t>] [--status proposed] [--supersedes N]
[--origin "<ticket, approval>"]`, then fill every section of the skeleton (the lint refuses a left
template comment), then `adr.mjs check`. Write title and sections in the log's language. When `new`
stops with exit 3 (no log yet, language unclear), ask the developer and pass `--lang`; under
`/lt-dev:ticket-cycle --autopilot` nobody can be asked, so no ADR is written and the summary and the
decisions comment say which decision is waiting for the language.

## What an ADR may contain

The log is committed and travels with every clone, fork and MR, so it holds **no secrets**:
no passwords, tokens, keys, connection strings with credentials, `.env` values or personal data.
Name a secret by its variable (`NSC__DATABASE__URL`) and where it lives (`the deployment's secret
store`), never its value. `adr.mjs check` scans for credentials and fails on them, but it is a net,
not the rule.

In a **public repository** (the lenne.Tech base repositories on GitHub) also no customer or
project names, no internal hosts, IPs or server names, no person names (say "the maintainer"),
and no local paths such as `/Users/<name>/`. A commit message quoted as evidence is anonymised
when it carries any of these.

## The project's CLAUDE.md

Every repository with a log carries this section in its root `CLAUDE.md` (and in `AGENTS.md` where
the repository keeps both in step), so every session and every agent working there knows the rule
without this plugin. Adjust the path for a log kept elsewhere, and write it in the language of the
file it goes into.

```markdown
## Architecture Decisions

Why the code is built the way it is lives in `docs/adr/` (index: `docs/adr/README.md`), one ADR per
decision. Before changing architecture, dependencies, the data model, API contracts, permissions or
infrastructure, check the accepted ADRs there.

- A change that contradicts an accepted ADR is made only when the task explicitly orders that
  change, or after the developer explicitly approves it; a new ADR then supersedes the old one.
  Otherwise name the conflict (which ADR, its reason, what would change) and ask.
- A new decision with lasting consequences gets its ADR in the same change as the code.
- ADRs are committed: no secrets, credentials or personal data.
```

## Related Elements

- `grilling-decisions` skill: its decision round reads the log as a source, sends an implicit
  conflict to the developer, and its record is where new ADRs come from
- `/lt-dev:adr`: set up the log, check a ticket or plan against it, record a decision, lint
- `lt-dev:adr-maintainer` agent: reconstructs the history and writes ADRs without filling the
  caller's context
- `/lt-dev:take-ticket`, `/lt-dev:resolve-ticket`, `/lt-dev:ticket-cycle`: check before the
  first line of code, record with the code
- `/lt-dev:review`, `lt-dev:code-reviewer`, `lt-dev:architect`: a diff or a blueprint that
  contradicts an accepted ADR is named, never passed silently
- `rebasing-branches` skill: two branches that took the same number are renumbered on rebase
