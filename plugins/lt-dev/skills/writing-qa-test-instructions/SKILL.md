---
name: writing-qa-test-instructions
description: 'Single source of truth for deciding whether a ticket is manually testable by non-developers and for writing the German QA test instructions that go into the Linear comment. Defines the three-part testability test, the typical not-testable categories, the deployed-environment URL resolution order, the role-instead-of-credentials rule for Linear comments, and the comment format for both the testable and the not-testable case. Activates whenever a command hands a merged or submitted ticket over to QA — `/lt-dev:ticket-cycle` STEP 4b, `/lt-dev:git:ship` STEP 10c, `/lt-dev:dev-submit` STEP 3. NOT for the developer-facing local re-test manual with seeded data and literal passwords (that is `ticket-cycle` STEP 3b). NOT for running the browser walk itself (use validating-changes-in-browser).'
user-invocable: false
---

# Writing QA Test Instructions

This skill is the **single source of truth** for the handover from development to manual QA. It answers two questions, in this order:

1. **Is this ticket manually testable by a non-developer at all?** — the testability classification.
2. **If yes: what exactly does the tester do?** — the German test instructions posted as a Linear comment.

> **Goal:** A ticket only reaches a manual-testing column when someone who has never seen the code can pick it up and verify it from the ticket alone. Everything else is routed past QA rather than parked there half-documented.

## When to Use This Skill

| Caller | Phase | What it needs from here |
|--------|-------|-------------------------|
| `/lt-dev:ticket-cycle` | STEP 4b.1b + 4b.3c | Classification (drives the post-merge Linear state) + the posted comment |
| `/lt-dev:git:ship` | STEP 10c | The comment format for the post-merge Linear comment |
| `/lt-dev:dev-submit` | STEP 3 | The comment format for the reviewer-handoff Linear comment |

`ticket-cycle` is the only caller that lets the classification **change the ticket's target state**. For `git:ship` and `dev-submit` the classification only decides which of the two comment shapes gets posted — those commands transition to "Dev Review" either way.

## Part 1 — Is the ticket QA-testable?

A ticket is **QA-testable** when all three hold:

- **Reachable surface** — there is at least one screen, route, or API response a non-developer can reach through the running application on the deployed environment.
- **Observable delta** — the change alters what the tester *sees* or *can do*. A change to *how* something is implemented, with byte-identical behaviour, is not observable.
- **Nameable path** — you can state role + route + action + expected result concretely. If the expected result can only be phrased as "es sollte weiterhin funktionieren", there is nothing to test.

**Classify from the diff and the walked flows, never from the ticket title.** A ticket titled "Login-Bug" can turn out to be a one-line CI fix, and a ticket titled "Refactoring" can change a visible label. In `ticket-cycle`, Phase C's `final_list` (from [`validating-changes-in-browser`](../validating-changes-in-browser/SKILL.md)) is the direct evidence: if the browser walk found no user-reachable step to walk, the ticket is not QA-testable. Elsewhere, derive it from the diff's touched surfaces.

### Typically NOT QA-testable

| Category | Example |
|----------|---------|
| Pure refactoring | Extracted service, renamed symbols, identical behaviour |
| CI / pipeline / deploy config | `.gitlab-ci.yml`, Dockerfile, compose, registry settings |
| Dev tooling | Lint/format config, editor settings, local scripts |
| Test-only changes | New or repaired specs, test fixtures, flake fixes |
| Non-observable performance | DB index, query rewrite, connection pool sizing with no perceptible delta |
| Observability | Log lines, metrics, tracing spans |
| Dependency bumps | Version updates with no functional delta |
| Internal types | Type-only changes, generated-SDK regeneration |

### Judgement calls

- **Performance work is testable when the delta is perceptible and you can name it** — "Liste lädt in unter 1 s statt ~8 s" is a step; "ist jetzt schneller" is not.
- **A change behind a disabled feature flag is not testable** until the flag is on for the environment the tester uses. Say which flag, so the decision is checkable.
- **Security hardening is testable when the blocked path is reachable** — "als User A die Detailseite von User B öffnen → erwartet: 403" is a step. A tightened internal guard with no reachable route is not.
- **Mixed tickets count as testable.** If any part of the change is observable, the ticket goes to QA with instructions covering that part, and the non-observable rest is named under "Nicht in diesem Ticket".

When the call is genuinely close, treat it as **testable** and write the instructions. A ticket that reaches QA with a thin but honest manual costs one short test; a ticket that skips QA wrongly ships unverified.

## Part 2 — Never put credentials in a Linear comment

The instructions name **roles**, never passwords.

A Linear comment is readable by everyone with workspace access, is archived indefinitely, and is copied into notifications and e-mail digests. A password pasted there outlives the ticket, the environment, and often the account. Name the role the step requires and point at the team or the password manager for the actual access.

```
Zugang: Zugangsdaten für die genannten Rollen bitte beim Team erfragen —
        dieser Kommentar enthält bewusst keine Passwörter.
```

This is the opposite of `ticket-cycle` STEP 3b's **local** re-test manual, which deliberately carries literal `@test.com` passwords: that manual stays in the developer's own session and points at their local dev DB, where the accounts are throwaway seeds. The Linear comment points at a shared deployed environment and is read by the whole workspace. Do not copy the credentials block from one into the other.

## Part 3 — Resolve the environment URL

The tester has no local stack, so **never link `localhost`**. Resolve the deployed base URL in this order and stop at the first hit:

1. The deploy platform's stage URL — in this stack the TurboOps MCP tools (`list_deployment_projects` / `get_deployment_status`) for the dev stage.
2. The project's deploy contract — `.turboops.json`, Traefik host labels in `docker-compose.yml`, or the CI variables in `.gitlab-ci.yml`.
3. The project's `CLAUDE.md` or `README.md`, when it names the dev/test URL.
4. Ask the user once via `AskUserQuestion`, then reuse that answer for the rest of the run.

If none resolves, render routes as **relative paths** (`/admin/users`) and name the environment as `<Dev-System>`, plus one line saying the base URL could not be resolved automatically. A relative path a tester can resolve beats a link that silently points at a machine they do not have.

Where a base URL exists, render every route as a clickable markdown link with its full query/hash parameters: `[Benutzerverwaltung](https://app.dev.example.com/admin/users?tab=roles)`.

## Part 4 — The comment format

Both shapes are German, aimed at a reader who has never seen the code.

### Testable

```
## Umsetzung

<1–3 Sätze in Nutzersprache: was war das Problem, was ist jetzt anders. Kein Jargon,
keine Dateinamen, keine internen Begriffe.>

## Testanleitung

Umgebung: <Dev-URL — oder "<Dev-System>", wenn nicht auflösbar>
Rollen:   <die Rollen, die zum Durchspielen gebraucht werden, z.B. Admin, angemeldeter User, ohne Login>
Zugang:   Zugangsdaten für die genannten Rollen bitte beim Team erfragen —
          dieser Kommentar enthält bewusst keine Passwörter.

1. Als <Rolle> anmelden → [<Seite>](<URL>) → <genaue Aktion: welches Element, welcher Wert>
   → erwartet: <konkret beobachtbares Ergebnis> → prüft: <warum dieser Schritt existiert>
2. Ohne Login → [<Seite>](<URL>) → <Aktion> → erwartet: <Ergebnis> → prüft: <warum>
3. …

## Nicht in diesem Ticket

- <bewusste Scope-Cuts und Findings, die separat behandelt werden — oder "nichts">
```

### Not testable

```
## Umsetzung

<1–3 Sätze in Nutzersprache.>

## Testanleitung

Nicht manuell testbar: <Grund in einem Satz, den ein Nicht-Entwickler versteht>.
Abgesichert über: <Unit-/API-/E2E-Tests, grüne CI-Pipeline, verifiziertes Deployment>.

## Nicht in diesem Ticket

- <… oder "nichts">
```

### Quality bar per step

- **One action, one observable expectation.** A step with two actions hides which one failed.
- **"Prüfen, ob alles funktioniert" is not a step.** Name the element and the expected state.
- **Every step is executable without the code.** No file paths, no function names, no "wie besprochen".
- **Cover the roles the change touches** — including the negative case, when the change is permission-relevant ("als User B → erwartet: kein Zugriff").
- **Include the empty and error state** when the change touches a list or a form.

## Hard Rules

- **A manual-testing column is only ever reached together with posted instructions.** The transition and the comment are one operation: if the comment cannot be posted, the ticket does not move into the testing column. A ticket sitting in QA without instructions is indistinguishable from one nobody has looked at, and it costs the tester a round-trip to find out which it is.
- **Never write credentials into a Linear comment.** Roles only, plus the pointer to the team / password manager. The local, developer-facing manual with literal passwords is a different artefact with a different audience.
- **Never link `localhost` in a Linear comment.** Resolve the deployed URL, or fall back to relative routes with a stated reason.
- **The classification is stated, never implied.** Whichever way it goes, the reason appears in the comment (testable → the steps themselves; not testable → the one-sentence reason plus what covers it instead). A reader must be able to disagree with the call.
- **Classify from the diff and the walked flows, not from the ticket title.**

## Related Skills

- [`validating-changes-in-browser`](../validating-changes-in-browser/SKILL.md) — produces the `final_list` of walked flows that the classification uses as evidence
- [`running-check-script`](../running-check-script/SKILL.md) — the green `check` that every ship path requires before any of this runs
