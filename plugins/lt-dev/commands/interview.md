---
description: Grill a plan or specification until every open decision is settled, then write the outcome back into the plan file
argument-hint: "[plan-file-path]"
model: opus
allowed-tools: Read, Grep, Glob, Bash(ls:*), Bash(git:*), AskUserQuestion, Write, Edit, mcp__plugin_lt-dev_linear__get_issue, mcp__plugin_lt-dev_linear__list_comments
disable-model-invocation: false
---

# Plan Interview

Run a grilling session against the plan at `$ARGUMENTS`, then record what it settled.

## When to Use This Command

- A plan, spec, or architecture document exists and you want its gaps found before anyone implements it.
- You want the outcome written back into the document, so the next session inherits the decisions instead of re-deriving them.

Without a path in `$ARGUMENTS`, grill the plan currently in the conversation and offer to write it to a file at the end.

For grilling that happens **inside** another workflow (an ambiguous ticket in `take-ticket`, a spec being drafted in `vibe:plan`), those commands invoke the `grilling-decisions` skill directly. This command is the standalone door to the same loop.

## Related Commands & Skills

| Element | Purpose |
|---------|---------|
| `grilling-decisions` skill | The interview loop this command runs |
| `/lt-dev:vibe:plan` | Creates the plan file this command sharpens |
| `/lt-dev:spec-to-tasks` | Turns the sharpened plan into tasks |
| `/lt-dev:take-ticket` | Grills open ticket questions inside the implementation flow |

## Execution

### 1. Read the plan and the code around it

Read the plan file in full. Then establish the facts it rests on: the modules it names, the entities and generated types it touches, the permission decorators already in place, the tests that cover those paths today. The grilling skill's fact-lookup table governs what you resolve yourself rather than ask.

### 2. Grill

Follow the `grilling-decisions` skill end-to-end: decision tree in dependency order, one question at a time via `AskUserQuestion`, a recommended answer on every question, no action until the user confirms the understanding is shared.

Coverage worth walking for a plan of this kind, as branches of the tree rather than a checklist to march through:

- **Data model** — embedding against referencing, index strategy, migration path for existing records, deletion behaviour (soft, hard, cascade, orphan).
- **API contract** — error codes, pagination, filtering, sort defaults, what an empty result returns.
- **Permissions** — per role and per operation, plus own-records-only cases via `securityCheck`. This is the branch that most often turns out to be underspecified.
- **State and UI** — what is shared against local, cache invalidation, loading and empty and error states, optimistic updates, mobile behaviour, accessibility requirements.
- **Business rules** — validation boundaries, concurrent access, maximum sizes and limits.
- **Operations** — environment-specific behaviour, expected data volume, upload constraints (types, sizes).

### 3. Write the outcome back

Update the plan file so the next reader inherits the decisions:

- Fold each clarified requirement into the section it belongs to, in the plan's own vocabulary.
- Add a `## Decisions` section: the question, the answer, and the reason it went that way. The reason is what keeps a future session from re-litigating it.
- Add the edge cases and error handling the grilling surfaced.
- List remaining open questions explicitly, each marked blocking or non-blocking, so nobody mistakes silence for agreement.

Tell the user which sections changed and that the plan is ready for implementation.
