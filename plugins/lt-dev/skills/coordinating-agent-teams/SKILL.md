---
name: coordinating-agent-teams
description: Provides auto-detection heuristics and coordination patterns for Claude Code Agent Teams. Determines when parallel team workflows outperform single-agent execution. Activates when user mentions "agent team", "parallel review", "team debug", or when commands auto-detect team suitability. NOT for single-agent workflows (use Task tool subagents). NOT for subagent coordination within one session.
---

# Coordinating Agent Teams

Claude Code Agent Teams (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`) coordinate multiple independent Claude Code sessions with inter-agent messaging and a shared task list. Unlike subagents (Task tool), teammates communicate directly and challenge each other.

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

Each pattern is described in detail in `patterns.md`. Summary:

1. **Independent Then Challenge** (Review) - Teammates review independently, then cross-challenge findings
2. **Parallel With Handoff** (TDD) - Backend defines contracts, frontend consumes them, implementation stays sequential
3. **Adversarial Convergence** (Debug) - One hypothesis per teammate, active falsification of competing theories
4. **Parallel Worktree Execution** (Batch Rebase) - One git worktree per teammate, true parallel branch operations

## Communication

- **message** (1:1): Direct communication between specific teammates. Use for contract sharing, targeted challenges
- **broadcast** (1:all): Message to all teammates. Use sparingly - only for coordination signals (e.g., "Phase 1 complete, starting Phase 2")

## Quality Gates

- **TeammateIdle hook**: Validates teammate produced meaningful output before going idle
- **TaskCompleted hook**: Validates task deliverables before allowing completion
- Both hooks are conservative by default (exit 0) and can be extended as the API stabilizes

## Token Cost Guidance

Agent Teams cost approximately 3-5x a single agent run. This is justified when:

- The task benefits from independent perspectives (review, debugging)
- True parallelism saves wall-clock time (batch rebase, parallel tests)
- The quality improvement outweighs the cost (adversarial debugging finds bugs single agents miss)

Not justified when:

- A single agent can complete the task in <5 minutes
- The task is straightforward with one obvious approach
- Token budget is constrained

## Limitations

- **Experimental**: Feature flag required (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`)
- **No session resumption**: If the lead crashes, the team cannot be resumed
- **No nested teams**: A teammate cannot spawn its own team
- **Shared filesystem**: Teammates share the same filesystem (use worktrees for parallel git operations)

## Related Elements

| Element | Relationship |
|---------|-------------|
| `/lt-dev:debug` | Always uses team (Adversarial Convergence pattern) |
| `/lt-dev:review` | Auto-detects team for large/fullstack changes |
| `/lt-dev:create-story` | Auto-detects team for fullstack TDD |
| `/lt-dev:git:rebase-mrs` | Auto-detects team for batch operations |

**Note:** `/lt-dev:debug` REQUIRES Agent Teams (no single-agent fallback). All other commands auto-detect based on complexity heuristics and fall back to single-agent mode gracefully.
