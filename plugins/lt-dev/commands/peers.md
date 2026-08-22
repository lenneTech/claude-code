---
description: Show what other Claude Code sessions are doing on this machine, plus the open claims and recorded diagnoses for this repository
allowed-tools: ListAgents, Bash(bash ${CLAUDE_PLUGIN_ROOT}/scripts/*), Bash(git status:*), Bash(git branch:*), Bash(git worktree:*)
disable-model-invocation: false
---

# Peers — who else is working here

One place to answer "what else is running, and what has it already taken?" before starting anything that another session could be in the middle of.

## When to Use This Command

- Before starting parallel work on a project or a base repo
- When a working tree contains changes this session did not make
- When `check` reports a finding and you want to know whether somebody already owns it
- After a crash or a long break, to see which claims went stale

## Workflow

### Step 1 — Live sessions

Call `ListAgents`. Report each peer with its name, its kind (interactive, cloud, Remote Control), and how long it has been running.

Read the output in two parts, and state both rather than hiding them:

- **The first line names this session** — the address other sessions use to reach it. This session is not among the rows below it, and a message addressed to that name is refused as a message to yourself. Take your own name from this line and never from a row, because every row belongs to somebody else.
- **The rows carry no working directory.** Name, kind, status, and uptime are all the tool returns. For repo attribution use the `SessionStart` peer block (from `detect-peer-sessions.sh`), which resolves each peer's repository from its process, or take the peer's word from a reply.

A peer beyond this machine (labelled `cloud` or `Remote Control`) appears only while this session is connected to Remote Control, and the ledger in Step 2 cannot see it at all — its claims live on the other machine. Report such a peer as visible but unattributable, never as absent.

> **`/lt-dev:peers` and the built-in `/peers` are different commands.** Claude Code ships `/peers` as an alias of `/list-agents`, which prints the raw session listing and stops. This command adds the two things that listing cannot know: the persistent ledger and the state of the repository in front of you.

### Step 2 — Persistent state for this repository

```bash
bash ${CLAUDE_PLUGIN_ROOT}/scripts/peer-ledger.sh read
```

This costs nothing and disturbs no peer. Report it in two parts:

- **Open claims** — `[held]` means a live session owns it; do not start it. `[stale]` means the claiming session is gone and the topic is free to take.
- **Notes** — diagnoses recorded by earlier sessions, including sessions that have since closed. A note that matches a problem in front of you saves the whole investigation.

### Step 3 — What the repository itself says

Cheap and authoritative, so read it rather than asking a peer:

```bash
git status --porcelain          # uncommitted work, possibly a peer's
git worktree list               # parallel checkouts
git branch -vv                  # what each local branch tracks
```

Uncommitted changes nobody in this session made belong to a peer (base-repo work stays uncommitted by house rule). Report them; never clean them up.

### Step 4 — Report and stop

Print a short summary in the user's language: how many sessions are live, what is claimed and by whom, which claims are stale, which notes look relevant to current work, and any foreign uncommitted changes.

**Send nothing.** This command reads. Messaging a peer needs one of the six occasions in the [`coordinating-peer-sessions`](${CLAUDE_PLUGIN_ROOT}/skills/coordinating-peer-sessions/SKILL.md) skill, and "I was looking around" is not one of them.

## Related Commands & Skills

| Element | Relationship |
|---------|-------------|
| `coordinating-peer-sessions` skill | The protocol this command reports against |
| `/lt-dev:check` | Claims cross-cutting findings via the same ledger (Step 4a) |
| `/lt-dev:take-ticket` | Checks peers before claiming a ticket |
