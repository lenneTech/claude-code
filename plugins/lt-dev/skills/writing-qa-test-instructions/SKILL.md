---
name: writing-qa-test-instructions
description: 'Decides whether a ticket is manually testable by non-developers and writes the German QA test instructions for the Linear comment when a command hands a ticket to QA.'
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
| `/lt-dev:ticket-cycle` | STEP 3b + 4b.1 + 4b.3c | The test context on dev (accounts, records) while the developer is present, the classification (decides which post-merge states the user is even offered), and the posted comment, completed once the deploy is healthy |
| `/lt-dev:git:ship` | STEP 10c | The test context (Part 4) and the comment format for the post-merge Linear comment |
| `/lt-dev:dev-submit` | STEP 3 | The test context (Part 4) and the comment format for the reviewer-handoff Linear comment |

`ticket-cycle` is the only caller that lets the classification **decide which target states the user is offered**. For `git:ship` and `dev-submit` the classification only decides which of the two comment shapes gets posted — those commands transition to "Dev Review" either way.

## Part 1 — Is the ticket QA-testable?

### The gate: can it be checked in the frontend?

**Everything starts here, and this question decides the answer on its own.** A manual tester has a
browser and an account. That is the whole toolset. If the change cannot be observed through the
running frontend, there is no test for them to run, and moving the ticket into a testing column
does not create one — it creates a ticket nobody can clear and a round-trip for the tester to find
that out.

So: **QA Testing is only an option when the change is verifiable in the frontend, directly or
indirectly.** When it is not, QA Testing is not offered, not suggested, and not chosen as a
fallback. The ticket goes to "Awaiting Release" with its reason stated.

Both routes count:

- **Directly** — the change alters something on a screen: a value, a state, a control, a message,
  a route's behaviour, what a role is allowed to do.
- **Indirectly** — the change is not itself visible, but it has a **reliable frontend symptom** a
  tester can trigger and observe. A backend validation rule shows up as the error the form now
  displays. A permission fix shows up as the page a second account can no longer open. A migration
  shows up as the records the list now contains. Name the symptom and the steps that produce it —
  if you cannot, the route is not open.

"Indirectly" is not a licence to invent a plausible-sounding path. The test is whether **you** can
write the numbered steps that make the change visible. If the steps come out as "prüfen, ob alles
noch funktioniert", the answer is no.

### The remaining two conditions

Once the frontend gate is passed, two more must hold:

- **Observable delta** — the change alters what the tester *sees* or *can do*. A change to *how*
  something is implemented, with byte-identical behaviour, is not observable.
- **Nameable path** — you can state role + route + action + expected result concretely. If the
  expected result can only be phrased as "es sollte weiterhin funktionieren", there is nothing to
  test.

**Classify from the diff and the walked flows, never from the ticket title.** A ticket titled "Login-Bug" can turn out to be a one-line CI fix, and a ticket titled "Refactoring" can change a visible label. In `ticket-cycle`, Phase C's `final_list` (from [`validating-changes-in-browser`](../validating-changes-in-browser/SKILL.md)) is the direct evidence, and it is the strongest evidence available: **the browser walk already tried to reach the change through the frontend.** If it found no user-reachable step to walk, the frontend gate is closed and the question is settled. Elsewhere, derive it from the diff's touched surfaces.

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

When the call is genuinely close **and the frontend gate is open**, treat it as testable and write the instructions: a ticket that reaches QA with a thin but honest manual costs one short test, while a ticket that skips QA wrongly ships unverified. When the frontend gate is closed, there is no close call to make — no browser path means no manual test, and treating it as testable anyway just moves the problem to the tester.

## Part 2 — Accounts: name the login, link the vault entry, never the secret

"Als Admin anmelden" sends the tester hunting: which admin, on which system, and where is the password. So every login the steps need is named with its concrete account and a link to where its password lives:

```
Zugänge (Passwörter stehen nur in 1Password, hier bewusst nicht):
- Admin: `admin@beispiel.test` → [1Password: Beispielprojekt Dev Admin](https://start.1password.com/open/i?a=…&v=…&i=…&h=…)
- User:  `user@beispiel.test`  → [1Password: Beispielprojekt Dev User](https://start.1password.com/open/i?a=…)
```

| Goes into the comment | Never goes into the comment |
|---|---|
| Role and login name (e-mail or username) of a test account on the deployed stage | Password, one-time code, TOTP secret, recovery code |
| The **private** 1Password link `https://start.1password.com/open/i?…`, from `op item get --share-link`: it opens only for people who already have access to that vault | A **public** share link from `op item share` or the app's "Share" button: a tokenized copy that anyone holding the URL can open until it expires |
| The vault entry's title | Session token, cookie, API key, magic or pre-authenticated login link, impersonation URL |

A Linear comment is readable by the whole workspace, archived indefinitely, and copied into notifications and e-mail digests. The login name of a dev test account is harmless there, the private link opens for nobody without vault access, and the password stays where access is managed and revoked. A tester without access to the vault asks for it once, and every later ticket on that project then works for them too. Production accounts never appear, whatever the ticket; the search in Part 4 matches only the stage's own hosts for that reason.

**When no account resolves** (Part 4, step 1), name the role and say where to ask:

```
- <Rolle>: kein Eintrag im Team-Tresor, Zugang bitte beim Team erfragen
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

## Part 4 — Check the deployed stage before writing the steps

The tester should spend their time on the check, not on finding an account or a record that fits. So before writing the steps, look at the stage the tester will use (Part 3) and find out what is already there. This matters most for the review after the deploy to dev: the local browser walk proved the change on throwaway seeds, while the tester works on a shared system with whatever data it holds.

### 1. Resolve one account per role

For every role the steps need, stop at the first hit:

1. **Stored mapping**: `${CLAUDE_PLUGIN_DATA}/dev-test-accounts.json` (literal path `~/.claude/plugins/data/lt-dev-lenne-tech/dev-test-accounts.json`), keyed by the project's git remote path and the stage's app host:

   ```json
   {
     "projects": {
       "<group>/<project>": {
         "<stage-app-host>": {
           "Admin": {
             "login": "admin@beispiel.test",
             "title": "Beispielprojekt Dev Admin",
             "account": "<1password-account>",
             "vaultId": "<vault-id>",
             "itemId": "<item-id>",
             "link": "https://start.1password.com/open/i?…"
           }
         }
       }
     }
   }
   ```

   The file holds no secret and needs no `op` call, so it also serves an unattended run. It lives on the running machine, outside every repository, like `qa-handover.json`.
2. **Search 1Password**, but only while the developer is at the screen: `op` may ask for Touch ID or the account password, and a prompt nobody answers stalls an unattended run.

   ```bash
   bash "${CLAUDE_PLUGIN_ROOT}/scripts/find-vault-logins.sh" --host <stage-app-host> --host <stage-api-host> [--title-contains <project>]
   ```

   It prints one JSON line per Login item whose URL points at the stage, with title, login name and private link. It matches the exact host or a subdomain of it, never a parent domain, so the production login of `example.com` never comes up for `app.dev.example.com`. It skips personal vaults, whose links open for nobody else, and it never reads a secret field. Exit 1 means nothing matched, exit 2 means `op` is missing or not signed in; both lead to the fallback, never to a stop. Map each hit to a role from its title, tags or the sign-in in step 2, then write the confirmed mapping back to the file, so the next ticket on this stage needs no search.
3. **Fallback**: the role-only line from Part 2, plus one line in the run's summary naming the role without a vault entry, so someone can add one.

### 2. Check the records each step acts on

For every step, name the precondition it needs ("ein stornierter Auftrag", "ein Kunde mit drei Ansprechpartnern") and look on the stage for a record that meets it. Sign in through the API as the step's account and query. The password goes from 1Password straight into the request, and never into the output, a file or the transcript:

```bash
JAR="<scratchpad>/dev-session-<role>.txt"   # session cookie only; deleted when the run ends
op read "op://<vault-id>/<item-id>/password" --account <1password-account> \
  | jq -Rn --arg login "<login>" '{email: $login, password: input}' \
  | curl -sS -c "$JAR" -H 'content-type: application/json' --data @- \
      -o /dev/null -w '%{http_code}\n' "<api-url>/<sign-in path>"
curl -sS -b "$JAR" "<api-url>/<resource>?<filter>"
```

Take the sign-in path and payload from the project's own auth setup; never guess them. The sign-in response usually also confirms the account's role. An account behind a second factor is not signed into: its steps keep the account and the link, and the record check is skipped with a note.

| Finding | What the step gets |
|---|---|
| A matching record exists | A deep link to it, marked `vorhanden` |
| Missing, and it is only a precondition | Created through the application's regular API as the step's account, with an obvious test label (`Test <TICKET-ID> – storniert`), marked `für diesen Test angelegt` |
| Missing, and it needs the merged version (a new entity or field) | Created once the deploy is verified healthy, where the caller verifies it (`ticket-cycle` STEP 4b.3), and the comment is updated; otherwise the step tells the tester to create it, with concrete values |
| Missing, and creating it is what the step tests | Never pre-created; the step has the tester create it (Part 5) |

Anything created is additive: never edit or delete a record that was already there, never write to the database directly on a shared stage, and never create anything on a production stage. A caller may move the creation to a later point: `ticket-cycle` only notes what is missing at STEP 3b and creates it after the developer's approval, so a cancelled cycle leaves nothing behind on dev.

### 3. Hand the result on as the test context

The test context is the stage URL, the account per role with its link, and per step the record with its link and its `vorhanden` / `für diesen Test angelegt` label. The caller writes the comment from it. A check that could not run (no `op`, no vault entry, a failed sign-in) is stated in the context, so the comment does not claim a precision it lacks. When the run ends, delete the session cookie files.

## Part 5 — Help the tester without taking the test away from them

Parts 2 and 4 exist to save the tester searching. Neither may decide the result for them. A test that only replays what Claude prepared, or that a tester can click through without thinking, proves nothing the automated tests had not already proven.

- **Prepared data sets the starting state, never the result.** When the change creates, computes, transforms or migrates something, the tester triggers it and observes the outcome. Claude never pre-creates the outcome, and never creates a precondition through the code path the ticket changed: a record made by the new code to test the new code confirms itself.
- **A migration or backfill is checked on records that existed before the deploy**, never on records created afterwards. Name one such record per step.
- **No shortcut past the flow under test.** The tester signs in through the normal login form with the named account: no pre-authenticated link, no token, no impersonation, no database edit, and when the login itself is part of the change, no prepared session of any kind.
- **The expected result names what to observe, not a verdict.** "Der Auftrag erscheint mit Status `storniert` und grauem Badge" lets the tester compare; "funktioniert" or "ist korrekt" only invites agreement.
- **One counter-check per requirement uses the tester's own choice**, wherever the change allows it: after the step on the prepared record, a step marked `Gegenprobe` in which the tester picks the record or the value ("mit einem Auftrag deiner Wahl wiederholen", "einen eigenen Wert über dem Limit eingeben"). It shows the behaviour is not tailored to the prepared case, and it is the step where the tester's judgement does the work.
- **Every step keeps its `prüft:` clause.** A tester who knows what a step proves notices when the screen shows something the step did not anticipate.

## Part 6 — The comment format

Both shapes are German, aimed at a reader who has never seen the code. The overall comment
structure, its length budget, and the rule that technical detail moves into an attached Linear
document belong to [`writing-linear-comments`](../writing-linear-comments/SKILL.md). This part
supplies the QA-specific content that goes into that structure.

### Testable

```
## Umsetzung

<1–3 Sätze in Nutzersprache: was war das Problem, was ist jetzt anders. Kein Jargon,
keine Dateinamen, keine internen Begriffe.>

Entscheidungen und Annahmen: im Kommentar „Entscheidungen und Annahmen“.
<ohne solchen Kommentar: "Entscheidungen und Annahmen: keine, umgesetzt wie im Ticket beschrieben.">

## Testanleitung

Umgebung: <[Dev-URL](Dev-URL) — oder "<Dev-System>", wenn nicht auflösbar>

Zugänge (Passwörter stehen nur in 1Password, hier bewusst nicht):
- <Rolle>: `<login>` → [1Password: <Eintrag>](<privater Link>)
- <Rolle>: kein Eintrag im Team-Tresor, Zugang bitte beim Team erfragen
- Ohne Login: privates Browserfenster

Vorbereitete Daten:
- [<Datensatz>](<Deep-Link>) — <vorhanden | für diesen Test angelegt>
- <oder "keine nötig">

1. Als <Rolle> (`<login>`) anmelden → [<Seite>](<URL mit Datensatz-ID>) → <genaue Aktion mit konkretem Beispielwert>
   → erwartet: <konkret beobachtbares Ergebnis> → prüft: <warum dieser Schritt existiert>
2. Gegenprobe: Als <Rolle> → [<Seite>](<URL>) → <dieselbe Aktion mit einem Datensatz oder Wert deiner Wahl>
   → erwartet: <Ergebnis> → prüft: <dass es nicht nur am vorbereiteten Fall hängt>
3. Ohne Login → [<Seite>](<URL>) → <Aktion> → erwartet: <Ergebnis> → prüft: <warum>
4. …

## Nicht in diesem Ticket

- <bewusste Scope-Cuts und Findings, die separat behandelt werden — oder weglassen>

## Details

<je angehängtem Dokument eine Zeile mit Link: Fragen und Antworten, Technische Details>
```

### Not testable

```
## Umsetzung

<1–3 Sätze in Nutzersprache.>

Entscheidungen und Annahmen: <wie oben>

## Testanleitung

Nicht manuell testbar: <Grund in einem Satz, den ein Nicht-Entwickler versteht>.
Abgesichert über: <Unit-/API-/E2E-Tests, grüne CI-Pipeline, verifiziertes Deployment>.

## Details

<je angehängtem Dokument eine Zeile mit Link: Fragen und Antworten, Technische Details>
```

### Quality bar per step

- **One action, one observable expectation.** A step with two actions hides which one failed.
- **Every step carries the concrete example data it needs.** "Im Suchfeld `Muster GmbH` eingeben",
  "Menge auf `3` setzen", "Datum `01.03.2026` wählen". A step that says "beliebige Daten eingeben"
  produces a test nobody can repeat and a bug report nobody can reproduce. Where the data has to
  exist beforehand, link the record Part 4 found or prepared; where it could not, say to create one
  and with what values.
- **Every login names its account** and links its vault entry (Part 2). "Als Admin anmelden" alone
  leaves the tester to find out which admin.
- **Every route is a complete clickable link**, including query and hash parameters, resolved
  against the deployed environment. A path fragment the tester has to assemble is a step they can
  get wrong.
- **"Prüfen, ob alles funktioniert" is not a step.** Name the element and the expected state.
- **Every step is executable without the code.** No file paths, no function names, no "wie besprochen".
- **Cover the roles the change touches** — including the negative case, when the change is permission-relevant ("als User B → erwartet: kein Zugriff").
- **Every decision or assumption with a visible effect has a step that shows it**, and its `Prüfen:` line in the decisions comment (`## Entscheidungen und Annahmen`) names that step. Reuse an existing step where it already shows the effect; add one where none does. The tester then checks the interpretation instead of taking it on trust, and an assumption Claude took without the developer's answer is exactly where that matters.
- **Include the empty and error state** when the change touches a list or a form.
- **Nothing else goes in the comment** beyond the blocks
  [`writing-linear-comments`](../writing-linear-comments/SKILL.md) defines, the decisions and
  assumptions among them. Findings, technical trade-offs, architecture notes, file references:
  those belong in the attached technical document.

## Hard Rules

- **QA Testing is only ever an option when the change is verifiable in the frontend**, directly or through a named, reproducible symptom. Where it is not, the option is not offered at all — not as a default, not as a fallback, not "zur Sicherheit". The ticket goes to "Awaiting Release" with its one-sentence reason.
- **A manual-testing column is only ever reached together with posted instructions.** The transition and the comment are one operation: if the comment cannot be posted, the ticket does not move into the testing column. A ticket sitting in QA without instructions is indistinguishable from one nobody has looked at, and it costs the tester a round-trip to find out which it is.
- **Never a secret in a Linear comment**: no password, one-time code, token, pre-authenticated link, or public share link from `op item share`. The comment carries the login name and the private vault link instead (Part 2), and the role-only line where no entry exists. The local, developer-facing manual with literal passwords is a different artefact with a different audience.
- **The deployed stage is checked before the steps are written** (Part 4): an account per role, and per step a record that already exists or was prepared for it, each labelled as such. `op` runs only while the developer is at the screen; an unattended run uses the stored mapping.
- **Prepared data never decides the result** (Part 5). It sets the starting state; the tester triggers the change, signs in through the normal login, and does one counter-check per requirement with a record or value of their own choice.
- **Never link `localhost` in a Linear comment.** Resolve the deployed URL, or fall back to relative routes with a stated reason.
- **The classification is stated, never implied.** Whichever way it goes, the reason appears in the comment (testable → the steps themselves; not testable → the one-sentence reason plus what covers it instead). A reader must be able to disagree with the call.
- **Classify from the diff and the walked flows, not from the ticket title.**

## Related Skills

- [`writing-linear-comments`](../writing-linear-comments/SKILL.md) — the comment's overall shape and length, and where the technical detail goes instead
- [`validating-changes-in-browser`](../validating-changes-in-browser/SKILL.md) — produces the `final_list` of walked flows that the frontend gate uses as its strongest evidence
- [`running-check-script`](../running-check-script/SKILL.md) — the green `check` that every ship path requires before any of this runs
