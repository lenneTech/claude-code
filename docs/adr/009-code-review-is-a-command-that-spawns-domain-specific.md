# ADR-009: Code review is a command that spawns domain-specific reviewer agents, code reviewers in parallel and browser reviewers one after another

**Date:** 2026-03-10 · **Status:** accepted · **Topic:** Plugin architecture
**Origin:** reconstructed 2026-11-18 from git history, plugins/lt-dev/commands/review.md

## Context

Until 2026-03-10 `/lt-dev:review` handed the diff to one `code-reviewer` agent. Commit 29ee9c7 split it into
frontend, backend, security and devops reviewers "with an orchestrator using Agent Teams for parallel execution". The
same week test (ef33145), UX (66a38af), a11y (5bd8fbd) and docs reviewers followed, and 303baa1 (2026-03-12)
redesigned the review "with command-based orchestration". The performance reviewer joined on 2026-04-03 (bcf4d59).

## Decision

- `/lt-dev:review` is the orchestrator. It decides from the changed files which reviewers to spawn and spawns them
  itself, with no intermediary agent.
- Code-only reviewers run in parallel in one message: `security-reviewer`, `docs-reviewer` and `performance-reviewer`
  always; `test-reviewer`, `backend-reviewer` and `devops-reviewer` when their kind of file changed.
- Browser reviewers (`frontend-reviewer`, `ux-reviewer`, `a11y-reviewer`) run one after another.
- `code-reviewer` remains as the single-pass reviewer for callers that want one agent.
- Reviewer agents spawn no agents; commands stay the orchestration point (house rule 14).

## Rationale

- Command as orchestrator, `review.md:167`: "The lt-dev reviewers carry no `Agent` tool and do not spawn further
  agents, so the command itself must be the parallelization point."
- Browser reviewers in sequence, `review.md:186`: "Browser reviewers — sequential (Chrome DevTools MCP has global page
  state)"; `review.md:702`: "`select_page` sets context for all subsequent tool calls".
- Splitting by domain: 29ee9c7 says only "Split monolithic code-reviewer into specialized agents". [inferred] Each
  reviewer carries the conventions of its own area (backend-dev, frontend-dev, OWASP) without loading the others;
  inferred from the reviewer agents' descriptions.

## Rejected alternatives

- **One `code-reviewer` for every review** (until 29ee9c7): split; kept only for single-pass use.
- **An orchestrator using Agent Teams** (29ee9c7): replaced two days later by command-based orchestration (303baa1);
  reason not documented.
- **Quality-gate hooks that triggered review passes** (`quality-gate.sh`, 29ee9c7, tiers in 303baa1): removed with
  all references on 2026-04-02 (7ab3198); reason not documented.

## Consequences

- A review costs one agent per relevant domain. The invocation policy in `review.md` keeps it from starting on
  Claude's own initiative: "it fans out a large parallel reviewer fleet and is correspondingly expensive".
- Browser reviews take the sum of their durations, not the longest one.
- A rule shared by all reviewers, such as the reporting bar, is kept in step across the agent files by
  `rule-invariants.json` (house rule 37).
- Reviewers have no `maxTurns` (house rule 11) and no effort pin (house rule 10).

## Evidence

- 29ee9c7 (2026-03-10) "feat: restructure code review into parallel domain-specific reviewers"
- 303baa1 (2026-03-12) "feat: redesign code review architecture with command-based orchestration, docs-reviewer, and
  quality gate tiers"
- 7ab3198 (2026-04-02) "chore: remove quality-gate hooks and add opt-out to block-dangerous-bash"
- bcf4d59 (2026-04-03) "chore: bump version to 7.8.0", body "add performance-reviewer agent with k6 baseline
  comparison and integrate into review pipeline"
- `plugins/lt-dev/commands/review.md:15`, `:167`, `:177-189`, `:267-278`, `:702`; house rules 10, 11, 14, 37
