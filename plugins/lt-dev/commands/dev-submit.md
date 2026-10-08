---
description: Submit current work for dev review — creates MR/PR, posts Linear comment, and moves ticket to Dev Review
argument-hint: "[issue-id] [--unattended]"
allowed-tools: Read, Bash(git:*), Bash(gh pr:*), Bash(glab mr:*), Bash(bash ${CLAUDE_PLUGIN_ROOT}/scripts/*), Bash(bash "${CLAUDE_PLUGIN_ROOT}/scripts/*), mcp__plugin_lt-dev_linear__*, AskUserQuestion, ListAgents, SendMessage
disable-model-invocation: false
---

# Dev Submit — Work for Review bereitstellen

> **Invocation policy.** Start this command only when the user asks for it explicitly
> (`/lt-dev:dev-submit`) **or** when an orchestrating lt-dev command invokes it as a
> documented step — `/lt-dev:ticket-cycle` STEP 4c (reviewer-handoff path) is the canonical
> caller. Never start it off your own initiative: it pushes the branch, opens an MR/PR, posts
> a Linear comment and moves the ticket to "Dev Review" — all outward-facing.
>
> This rule replaces a former `disable-model-invocation: true`, which made the reviewer-handoff
> path of `ticket-cycle` unreachable.

## When to Use This Command

- When implementation is complete and ready for another developer to review
- To hand off work: creates MR/PR, documents what was done, and signals readiness in Linear
- Combines `/lt-dev:git:create-request`, `/lt-dev:linear-comment`, and Linear status update in one step

## Related Commands

| Command | Purpose |
|---------|---------|
| `/lt-dev:git:create-request` | Only create MR/PR (without Linear integration) |
| `/lt-dev:linear-comment` | Only post a comment on a Linear issue |
| `/lt-dev:ticket-cycle` | Full pick → implement → merge orchestrator (use this instead when no human reviewer is needed before merge) |
| `/lt-dev:resolve-ticket` | Full ticket resolution (implementation + tests + review) |
| `/lt-dev:review` | Code review before submitting |
| [`writing-qa-test-instructions`](${CLAUDE_PLUGIN_ROOT}/skills/writing-qa-test-instructions/SKILL.md) skill | Testability classification + German QA test instructions for the Linear comment (STEP 3) |

---

## Execution

### STEP 0: Resolve Linear Issue ID

Determine the target issue ID:

**`--unattended`** (set by `/lt-dev:ticket-cycle` after the developer approved the result) removes the routine questions: STEP 1 commits only this session's paths and pushes, STEP 3 posts without the approval preview. Foreign or unattributable paths are held out and named in the summary, never staged. Strip the flag before resolving the issue ID.

1. **If `$ARGUMENTS` is provided and non-empty:** Use it directly as the issue ID.
2. **If no argument:** Auto-detect from the current git branch name:
   - Run `git branch --show-current`
   - Extract the issue identifier (e.g., branch `dev-1575` → issue `DEV-1575`, branch `feature/LIN-42-some-description` → issue `LIN-42`)
   - Pattern: Look for a prefix followed by digits, separated by `-` (e.g., `dev-1575`, `lin-42`, `feat/abc-123-title`)
3. **If no issue ID can be extracted:** Ask the user via `AskUserQuestion`:
   - "Ich konnte keine Linear Issue-ID aus dem Branch-Namen ableiten. Bitte gib die Issue-ID an (z.B. `DEV-123`):"

Store the resolved issue ID as `ISSUE_ID` for subsequent steps.

### STEP 1: Pre-Flight — Git State prüfen

1. **Current branch:** Run `git branch --show-current`. Abort if on `main`, `master`, `dev`, or `develop`.
2. **Uncommitted changes:** Run `git status --porcelain`.
   - If there are uncommitted changes, attribute them before offering to stage anything:
     `bash "${CLAUDE_PLUGIN_ROOT}/scripts/change-provenance.sh"`.
     "Stage all" stages another session's work in progress too, and that lands in this MR under this
     ticket while the peer is still mid-slice. In base repos this is the normal case, not an edge one:
     house rule keeps their work uncommitted on the checked-out branch. Details and the `ORIGIN`
     message: [`coordinating-peer-sessions`](${CLAUDE_PLUGIN_ROOT}/skills/coordinating-peer-sessions/SKILL.md).
   - With `--unattended`: take Option 1 without asking and list any held-out path in STEP 5.
   - Otherwise ask the user via `AskUserQuestion`:
     - "Es gibt uncommittete Änderungen:"
     - Show the list of changed files, each marked with its attribution (this session / `<peer>` / unattributed)
     - Option 1: "Nur meine Änderungen committen & pushen" → Stage this session's paths explicitly, commit, push (default where anything is foreign)
     - Option 2: "Alles committen & pushen" → Stage all, create commit with descriptive message, push
     - Option 3: "Ich mache es selbst" → Pause and let the user handle it, then continue
3. **Unpushed commits:** Run `git log @{upstream}..HEAD --oneline 2>/dev/null`.
   - If there are unpushed commits (or no upstream), push directly with `--unattended`; otherwise ask the user:
     - "Es gibt unpushte Commits. Soll ich pushen?"
     - Option 1: "Ja, pushen" → Run `git push -u origin $(git branch --show-current)`
     - Option 2: "Nein, abbrechen" → Abort

### STEP 2: MR/PR erstellen

**Detect Git Provider:**

```bash
git remote get-url origin
```

| URL Pattern | Provider | CLI Tool |
|-------------|----------|----------|
| `github.com` | GitHub | `gh` |
| `gitlab` or other | GitLab | `glab` |

**Detect Target Branch** using priority chain:

*Priority 1 — Parent branch from git history:*

```bash
# Check reflog for branch creation point
git reflog show $(git branch --show-current) --format='%gs' | grep 'branch: Created from' | head -1
```

Extract the branch name (e.g. `branch: Created from dev` → `dev`). If not found, try:

```bash
git reflog show --format='%gs' | grep 'checkout: moving from .* to $(git branch --show-current)' | head -1
```

Verify detected branch exists on remote: `git rev-parse --verify origin/<detected-branch> 2>/dev/null`

*Priority 2 — Fallback to well-known branches* (if Priority 1 fails):
1. `origin/dev`
2. `origin/develop`
3. `origin/main`
4. `origin/master`

**Check for existing MR/PR:**
- GitHub: `gh pr list --head $(git branch --show-current) --json url --jq '.[0].url'`
- GitLab: `glab mr list --source-branch $(git branch --show-current) --json url --jq '.[0].url'`

If an MR/PR already exists, skip creation and use the existing URL.

**Generate description** from branch commits:
1. Run `git log <target-branch>..HEAD --oneline` for commit list
2. Run `git diff <target-branch>..HEAD --stat` for changed files
3. List the take-alongs apart from the core: every commit carrying a `Taken-Along:` trailer (`git log --grep='^Taken-Along:' --format='%s%n%(trailers:key=Taken-Along,valueonly)' <target-branch>..HEAD`) goes under its own `Mitgenommen` heading with its reason, and the description names the two commands that show core and take-alongs separately (`git log -p --invert-grep --grep='^Taken-Along:'` and `--grep='^Taken-Along:'`). A reviewer should know what the ticket asked for and what came on top before opening the first file.

**Create MR/PR:**
- GitHub: `gh pr create --base <target-branch> --title "<title>" --body "<description>"`
- GitLab: `glab mr create --target-branch <target-branch> --title "<title>" --description "<description>"`

Store the MR/PR URL as `REQUEST_URL`.

### STEP 3: Linear Comment posten

1. **Retrieve Issue:** Fetch Linear issue **#ISSUE_ID** via MCP (title, description).
2. **Analyze Changes:** Use the commit list and diff stat from Step 2.
3. **Generate Comment** in **German** for non-developers, following [`writing-qa-test-instructions`](${CLAUDE_PLUGIN_ROOT}/skills/writing-qa-test-instructions/SKILL.md) — it owns the testability classification, the step format, the deployed-URL resolution, the check of the dev stage for accounts and records, and the rule that the comment names the account and links its private vault entry, **never a secret**.

Classify first (skill Part 1): can a non-developer exercise this change through the running application? The answer picks the shape.

For the testable shape, take the test context next (skill Part 4). A context handed over by `/lt-dev:ticket-cycle` STEP 3b is used as it stands. Otherwise resolve it here; with `--unattended` and no handed-over context, use only the stored account mapping and skip every `op` call. The change is not merged on this path, so a record that only the new version can hold is described as something the tester creates, with concrete values.

**Testable:**

```
## Umsetzung

[1-3 Sätze in Nutzersprache: was war das Problem, was ist jetzt anders. Kein Jargon.]

Entscheidungen und Annahmen: im Kommentar „Entscheidungen und Annahmen“.
[ohne solchen Kommentar: "Entscheidungen und Annahmen: keine, umgesetzt wie im Ticket beschrieben."]

## Testanleitung

Umgebung: <Dev-URL>

Zugänge (Passwörter stehen nur in 1Password, hier bewusst nicht):
- <Rolle>: `<login>` → [1Password: <Eintrag>](<privater Link>)
- <Rolle ohne Eintrag>: kein Eintrag im Team-Tresor, Zugang bitte beim Team erfragen

Vorbereitete Daten:
- [<Datensatz>](<Deep-Link>) — <vorhanden | für diesen Test angelegt>

1. Als <Rolle> (`<login>`) anmelden → [<Seite>](<URL mit Datensatz-ID>) → <genaue Aktion>
   → erwartet: <Ergebnis> → prüft: <warum>
2. Gegenprobe: <dieselbe Aktion mit einem Datensatz oder Wert deiner Wahl>
   → erwartet: <Ergebnis> → prüft: <dass es nicht nur am vorbereiteten Fall hängt>
3. …

## Review

MR/PR: REQUEST_URL
```

**Decisions and assumptions live in their own comment, before this one**: the developers'
decisions and notes and every assumption of Claude, each with reason and what to check, per
[`writing-linear-comments`](${CLAUDE_PLUGIN_ROOT}/skills/writing-linear-comments/SKILL.md#decisions-and-assumptions-for-the-product-owner).
The ticket is the order and the comments are everything that happened while carrying it out; the
decisions were the premise, so `take-ticket` posted that comment right after the decision round.
In this same pass, bring it to its final state via `save_comment` with its `id` (one a colleague posted is replaced instead, per the skill), with every
`Prüfen:` line pointing at a step of this comment, and the questions document with it. The entries
come from `DECISION_RECORD` when `/lt-dev:ticket-cycle` hands it over, otherwise from the
`take-ticket` STEP 10 list in this session, otherwise from the skill's fallback order. No decisions
comment yet but entries to report: post it now, before this comment.

**Keep the rest short.** The questions Claude asked, with options and answers, go into the
attached document `<ISSUE_ID> — Fragen und Antworten` (only when there were questions); technical
detail — file references, technical alternatives dropped, known limitations — goes into
`<ISSUE_ID> — Technische Details`. Each is linked from its own line under `## Details` at the end
of the comment, per
[`writing-linear-comments`](${CLAUDE_PLUGIN_ROOT}/skills/writing-linear-comments/SKILL.md). Every
test step carries its concrete example data and full links. No document when there is nothing to
carry; where the ticket already carries a document of the same kind, update it rather than
attaching a second one.

**Not testable** — same block, with the Testanleitung section replaced by:

```
## Testanleitung

Nicht manuell testbar: <Grund in einem Satz>.
Abgesichert über: <Unit-/API-/E2E-Tests, grüne CI-Pipeline>.
```

The change is not merged yet on this path, so the instructions describe what the reviewer (and later the tester) verifies once it lands.

4. **User Approval** via `AskUserQuestion` (with `--unattended`: post directly and print the posted comment in STEP 5):
   - Show the generated comment
   - Option 1: "Posten" → Post as-is
   - Option 2: "Bearbeiten" → Let the user modify before posting
5. **Post** the comment to issue **#ISSUE_ID** via Linear MCP `save_comment` (`issueId`, `body`).

### STEP 4: Ticket-Status auf "Dev Review" setzen

1. **Get workflow states:** Use Linear MCP to list available workflow states for the issue's team.
2. **Find "Dev Review" state:** Look for a state matching "Dev Review", "In Review", "Review", or "Code Review" (case-insensitive).
   - If no matching state is found, ask the user which state to use.
3. **Update issue status** via `mcp__plugin_lt-dev_linear__save_issue` with `state` = the matched
   state. The tool is `save_issue` (there is no `update_issue`), and the parameter is `state` —
   `stateId` is rejected with `Unrecognized keys` and writes nothing.

   This step deliberately does **not** touch the assignee: the ticket stays with whoever held it.
   A caller that wants it unassigned has to pass `assignee` = JSON `null` itself.

### STEP 5: Zusammenfassung

Output a summary:

```
Dev Submit abgeschlossen:
- MR/PR: <REQUEST_URL>
- Linear Comment: Gepostet auf ISSUE_ID
- Ticket-Status: Verschoben nach "Dev Review"
```
