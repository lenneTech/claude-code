---
name: coordinating-agent-teams
description: 'Coordination patterns and worktree isolation for parallel operations this session starts: Agent Teams (independent sessions with messaging) and parallel subagent spawning (Agent tool with isolation worktree). Covers when teams beat single agents and what they cost in tokens. Activates on "agent team", "parallel review", "batch rebase", when a command evaluates team suitability via CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS, or when spawning several file-modifying subagents at once. NOT for single sequential subagents. NOT for sessions the user started themselves (use coordinating-peer-sessions).'
user-invocable: false
---

# Coordinating Agent Teams

Claude Code Agent Teams (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`) coordinate multiple independent Claude Code sessions with inter-agent messaging and a shared task list. Unlike subagents (Agent tool), teammates communicate directly and challenge each other.

## Not the same as peer sessions

Two different things run several Claude Code sessions at once, and only one of them is this skill.

| | Agent teams (this skill) | Peer sessions (`coordinating-peer-sessions`) |
|---|---|---|
| Who starts them | This session spawns them | The user opens each terminal |
| Structure | A lead supervises, teammates share a task list | Nobody leads; each session owns its work |
| Lifetime | Bound to the lead's session | Independent; any of them can outlive the others |
| Coordination | Task list, plan approval, teammate messaging | Linear and Git first, `ListAgents` second, one message only for LANDED / CLAIM / CONFLICT / SOLVED / READY / ASK |
| Gate | `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` | On by default from v2.1.224 |

`SendMessage` serves both, which is what makes them easy to confuse. The test is who started the other session: if this session spawned it, the rules here apply; if the user did, the peer rules do. Never treat a peer as a teammate to assign work to. It has its own task and its own user, and a peer message is not an instruction it owes you compliance with.

## Gotchas

- **`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` must be set BEFORE session start** — Setting it mid-session has no effect. The flag is read once at startup. Team-capable commands silently fall back to single-agent mode if the env var is missing. Verify with `echo $CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` before running `/debug`, `/review`, or any team command.
- **Token cost is 3-5× single-agent — not 2×** — Each teammate runs a full Claude Code session with its own context, memory, and transcript. A 4-teammate debug session easily consumes 5× the tokens of a single-agent run. Budget accordingly and prefer `--no-team` for simple tasks.
- **No session resumption for teams** — `claude --resume` cannot restore a multi-teammate session. If a team run is interrupted (crash, network, user exit), the teammates' transcripts are lost. Treat every team run as one-shot and save important findings to disk before stopping.
- **Nested spawning depends on the agent's own `tools` list, not on a platform ban** — A subagent may spawn subagents of its own, by default up to three layers below the main conversation (`CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` changes the limit; `1` turns nesting off). At the limit Claude Code withholds the `Agent` tool, so that layer does its work itself and returns one summary. Every lt-dev agent omits `Agent` from its `tools` list, so none of them nests today — that is a deliberate per-agent choice, and the reason to keep team workflows flat is cost and legibility rather than an unavailable capability. To keep one agent read-only, leave `Agent` out of its `tools` or list it in `disallowedTools`.
- **Worktree isolation is per-teammate, not shared** — Each teammate with `isolation: worktree` gets its own worktree. Shared state must go through the messaging channel or through files written to the parent repo after merge. Teammates cannot see each other's unmerged worktree files.
- **`pkill` in one teammate can kill processes of another** — If `pkill -f "nuxt dev"` runs in one teammate, it kills ALL `nuxt dev` processes on the machine, including ones owned by other teammates. Use PID-tracked kills (save PID at start, kill by PID at end) in team contexts.

## Auto-Detection Protocol

Every team-capable command follows this decision tree:

```
1. Is CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 set?
   No → Single Agent Mode (existing behavior)
2. Did user pass --no-team?
   Yes → Single Agent Mode (forced)
3. Did user pass --team?
   Yes → Team Mode (forced)
4. Does complexity heuristic match?
   Yes → Team Mode (auto-detected)
   No  → Single Agent Mode (overhead not justified)
```

### Complexity Heuristics by Command

| Command | Team Trigger |
|---------|-------------|
| `/review` | >100 changed lines AND >3 files, OR changes in both projects/api/ and projects/app/ |
| `/create-story` (TDD) | Fullstack monorepo detected AND story involves backend + frontend |
| `/rebase-mrs` | >2 branches selected |
| `/debug` | Always team (the workflow requires it) |

## When Teams Beat Single Agents

| Task Type | Team Advantage | Token Overhead |
|-----------|---------------|----------------|
| Multi-dimension review | Independent analysis prevents anchoring bias | ~3x |
| Fullstack test writing | Parallel backend + frontend, contract sharing | ~2x |
| Adversarial debugging | Competing hypotheses with falsification | ~3-5x |
| Batch rebase | True parallelism via worktrees | ~1.5x per branch |

## When Single Agents Are Better

- Small changes (<100 lines, <=3 files)
- Sequential dependencies (step B needs output of step A)
- Trivial tasks (obvious fix, single-file change)
- Non-fullstack changes (only backend OR only frontend)

## Core Patterns

Each pattern is described in detail in [patterns.md](${CLAUDE_SKILL_DIR}/patterns.md). Summary:

1. **Independent Then Challenge** (Review) - Teammates review independently, then cross-challenge findings
2. **Parallel With Handoff** (TDD) - Backend defines contracts, frontend consumes them, implementation stays sequential
3. **Adversarial Convergence** (Debug) - One hypothesis per teammate, active falsification of competing theories
4. **Parallel Worktree Execution** (Batch Rebase) - One git worktree per teammate, true parallel branch operations

## Communication

- **message** (1:1): Direct communication between specific teammates. Use for contract sharing, targeted challenges
- **broadcast** (1:all): Message to all teammates. Use sparingly - only for coordination signals (e.g., "Phase 1 complete, starting Phase 2")

## Token Cost Guidance

Agent Teams cost approximately 3-5x a single agent run. This is justified when:

- The task benefits from independent perspectives (review, debugging)
- True parallelism saves wall-clock time (batch rebase, parallel tests)
- The quality improvement outweighs the cost (adversarial debugging finds bugs single agents miss)

Not justified when:

- A single agent can complete the task in <5 minutes
- The task is straightforward with one obvious approach
- Token budget is constrained

## Parallel Subagent Isolation

When spawning multiple file-modifying subagents concurrently via the Agent tool (not Agent Teams), use `isolation: "worktree"` to prevent file conflicts:

```
Agent tool call:
  subagent_type: "lt-dev:backend-dev"
  isolation: "worktree"         ← each gets its own working copy
  prompt: "Implement feature X in projects/api/..."

Agent tool call:
  subagent_type: "lt-dev:frontend-dev"
  isolation: "worktree"
  prompt: "Implement feature X in projects/app/..."
```

### When to use `isolation: "worktree"`

| Scenario | Isolation needed? |
|----------|-------------------|
| Multiple file-modifying agents in parallel | Yes |
| Single agent (sequential) | No |
| Read-only agents (reviewers) in parallel | No |
| Agent modifying lockfiles/dependencies | No — needs in-place access |

### Agent compatibility

| Supports worktree | No worktree (in-place only) |
|-------------------|-----------------------------|
| `backend-dev`, `frontend-dev`, `devops`, `branch-rebaser` | `fullstack-updater`, `nest-server-updater`, `npm-package-maintainer`, all reviewers |

## Worktree Operations Reference

See [worktree-guide.md](${CLAUDE_SKILL_DIR}/worktree-guide.md) for setup, cleanup, naming conventions, performance settings (`worktree.sparsePaths`, `worktree.symlinkDirectories`), dependency isolation, and known limitations.

## Limitations

- Requires `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` environment variable
- **No session resumption**: If the lead crashes, the team cannot be resumed
- **No nested teams**: A teammate cannot spawn its own team
- **Shared filesystem**: Teammates share the same filesystem (use worktrees for parallel git operations)

## Related Skills & Commands

| Element | Relationship |
|---------|-------------|
| `/lt-dev:debug` | Always uses team (Adversarial Convergence pattern) |
| `/lt-dev:review` | Auto-detects team for large/fullstack changes |
| `/lt-dev:create-story` | Auto-detects team for fullstack TDD |
| `/lt-dev:git:rebase-mrs` | Auto-detects team for batch operations |

| `coordinating-peer-sessions` skill | The sibling model: independent sessions the user started, coordinated through Linear, Git, and sparing messages |

**Note:** `/lt-dev:debug` REQUIRES Agent Teams (no single-agent fallback). All other commands auto-detect based on complexity heuristics and fall back to single-agent mode gracefully.
