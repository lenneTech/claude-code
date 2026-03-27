---
name: coordinating-agent-teams
description: 'Provides auto-detection heuristics, coordination patterns, and worktree isolation guidance for parallel Claude Code operations. Covers Agent Teams (independent sessions with messaging) and parallel subagent spawning (Agent tool with isolation worktree). Activates when user mentions "agent team", "parallel review", "parallel agents", "team debug", "parallel worktrees", "batch rebase", "parallel backend frontend", "implement in parallel", or when commands evaluate team suitability via CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS. Also activates when spawning multiple file-modifying subagents concurrently. NOT for single sequential subagent invocations.'
effort: medium
user-invocable: false
---

# Coordinating Agent Teams

Claude Code Agent Teams (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`) coordinate multiple independent Claude Code sessions with inter-agent messaging and a shared task list. Unlike subagents (Agent tool), teammates communicate directly and challenge each other.

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

**Note:** `/lt-dev:debug` REQUIRES Agent Teams (no single-agent fallback). All other commands auto-detect based on complexity heuristics and fall back to single-agent mode gracefully.
