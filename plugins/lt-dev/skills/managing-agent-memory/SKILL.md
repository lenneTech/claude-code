---
name: managing-agent-memory
description: Decide PER PROJECT whether `.claude/agent-memory/**` is committed, remember that decision next to the memory it governs, and curate the notes before every commit that carries them. Use before committing when agent-memory files are dirty — git:ship, ticket-cycle, review runs, or any standalone commit.
---

# Managing Agent Memory

Reviewer and maintainer agents write notes to `.claude/agent-memory/<agent>/`.
Whether those belong in the repository is a **per-project decision** — some
projects want them shared, others deliberately do not — and whether the existing
ones still deserve to be there is a **judgement call that has to be re-made every
time**, because notes rot: the code they describe gets renamed, and the bugs they
warn about get fixed.

Three failure modes this skill exists to prevent:

1. **Asking the same question forever.** Re-prompting on every commit is noise.
2. **Answering it once for everything.** A decision taken in one project must
   never silently apply to the next one. There is no global policy.
3. **Committing notes that are now WRONG.** A note claiming an open security hole
   that has since been closed, or naming a symbol a rename deleted, is worse than
   no note — it sends the next agent down a path that no longer exists and gets
   believed because it looks specific.

## STEP 0 — Find the scopes (there is usually more than one)

A repository can hold **several independent memory scopes**: one at the repo root
and one per sub-project. They are separate stores, written by agents that ran in
different working directories, and they must be decided and curated separately.

```bash
ROOT=$(git rev-parse --show-toplevel)
git -C "$ROOT" ls-files '*.claude/agent-memory/*' | sed 's|\.claude/agent-memory/.*||' | sort -u
```

An empty prefix means the repo root. Add any scope that is untracked but dirty:

```bash
find "$ROOT" -type d -name agent-memory -path '*/.claude/*' -not -path '*/node_modules/*'
```

Ignore anything under `.claude/worktrees/` — throwaway agent worktrees, normally
gitignored.

**Anchor every path at `$ROOT`, never at the current working directory.** `git
ls-files` is cwd-scoped: run from `projects/api` it reports only that sub-project's
files, so the root scope disappears entirely and a fully tracked scope can look
untracked. Both the discovery above and the per-scope check below therefore go
through `git -C "$ROOT"`.

## STEP 1 — Resolve the policy, once per scope

For **each** scope `$S` (the directory containing `.claude/`), independently:

```bash
git -C "$ROOT" ls-files "$S/.claude/agent-memory/" | head -1
```

**Non-empty → tracked → policy is `commit` for this scope.** The team already
opted in here. Do not ask. Go to STEP 2.

**Empty → no policy yet for this scope.** Read `$S/.claude/settings.local.json`:

- **`agentMemoryPolicy` present** → use it (`commit` | `local` | `delete`). Do not ask.
- **Absent** → ask ONCE, naming the scope so the user knows what they are deciding
  for ("im Unterprojekt `projects/api`" vs. "im Repo-Root"):
  1. **Mitcommitten** — the team shares the notes; they are versioned with the code.
  2. **Nur lokal behalten** — stay uncommitted on this machine.
  3. **Löschen** — remove after each run; agents start fresh every time.

  Then persist the answer **into that scope's own file**,
  `$S/.claude/settings.local.json`, creating it if needed and preserving existing
  keys:

  ```json
  { "agentMemoryPolicy": "commit" }
  ```

**Where the decision must NOT go:**

- **Not in a user-level file** (`~/.claude/settings.json`) or any other
  machine-wide location — that is exactly the "answered once for everything"
  failure. The whole point is that projects differ.
- **Not in agent memory.** It would travel with notes copied between projects and
  rot silently.
- **Not in a committed file.** `.claude/settings.local.json` is Claude Code's local
  settings file and is normally covered by a global gitignore. Verify per scope:
  `git check-ignore -v "$S/.claude/settings.local.json"`. If it is NOT ignored,
  tell the user rather than adding a repo `.gitignore` entry yourself — that entry
  would be a committed change they did not ask for.

Policy `local` → leave that scope's files dirty, mention them, commit nothing.
Policy `delete` → remove that scope's `agent-memory/`, commit nothing.
Policy `commit` → STEP 2 for that scope.

## STEP 2 — Curate before committing (policy `commit` only)

Never stage agent memory unread. Go through everything dirty **plus** the notes
around it, and act:

**Delete outright:**
- Notes about a **different repository** (a `lt-monorepo` observation sitting in a
  customer project's memory is not merely useless, it is a false statement about
  the repo it lives in).
- **Resolved** upstream PRs / vendor patches whose instruction is now harmful —
  "PR open, do NOT merge" for a PR that merged weeks ago is an active trap.
  Verify with `gh pr view <n> --repo <repo> --json state,mergedAt`.
- Anything the repo now documents itself (`CLAUDE.md`, `VENDOR.md`, a `docs/`
  page). Duplicated documentation drifts; the repo copy wins.
- Scratch output from a single run with no reusable lesson.

**Update instead of deleting** when the underlying invariant survives but its
status changed — the common case and the most valuable one. A fixed bug becomes:
what the structural hazard still is, which paths are now guarded, which are not,
and how to re-derive that map. Keep the measurement that proved it.

**Repair after any rename.** A repo-wide rename does not touch memory files, so
they keep naming symbols that no longer exist. Grep the memory for the old names
and confirm each survivor against the code — a note that sends a reviewer looking
for a vanished helper reads as "there is no ACL here".

**Fix dangling `[[links]]`.** A link resolves against the `name:` field of another
note **in the same agent's directory within the same scope**. Check every link, and
check that each `name:` is a kebab-case slug — a `name:` with spaces silently
breaks every link pointing at it.

**Keep the index hooks sharp.** Each agent's `MEMORY.md` is the only part loaded on
every run of that agent; the bodies are read on demand. The hook line decides
whether the right file gets opened at all, so it must state the conclusion, not the
topic.

**Do NOT deduplicate across agents.** Each agent reads only its own directory, so
the same fact held by the security and the backend reviewer is correct by design.
Only merge duplicates *within* one agent's directory in one scope.

**Do reconcile the same agent across scopes.** The root and a sub-project can both
hold `lt-dev-security-reviewer/` — which one an agent loads depends on where it
ran. Contradictions between them are the worst case: whichever is read looks
authoritative. Either keep each scope's notes strictly about its own subtree, or
consolidate into one scope.

**Run the project's own formatter over the notes before staging.** Some scopes put
agent memory inside a formatter's reach and others do not, and the difference is a
single missing path argument: `oxfmt --check src/` never sees `.claude/`, while a
bare `oxfmt --check` formats the whole project — Markdown included. So the same
note is fine in one scope and fails CI in the neighbouring one, over something as
small as a trailing newline. Check the scope's `format:check` script instead of
assuming Markdown is exempt.

Then stage each scope's `agent-memory/` with the rest of the commit, and say in the
commit message what was pruned and why — a deletion nobody can reconstruct looks
like data loss later.

## Scale check

If curating would take longer than the change being shipped, do the cheap
correctness pass (deletions + rename repair + dangling links) and say plainly which
notes and which scopes you did not review. Silent partial curation reads as "all
checked".
