---
description: Optimize this marketplace against the current Claude Code documentation and default model, with optional secondary sources
argument-hint: "[--update-cache|--skip-cache] [secondary-sources...]"
allowed-tools: Read, Write, Edit, Glob, Grep, Agent, SendMessage, Skill, AskUserQuestion, WebFetch, Bash(bun .claude/scripts/:*), Bash(claude plugin validate:*), Bash(git:*), Bash(ls:*), Bash(wc:*), Bash(find:*), Bash(jq:*), Bash(awk:*), Bash(sed:*), Bash(grep:*), Bash(bash scripts/:*), Bash(bash plugins/:*), Bash(node --test:*), Bash(npm view:*), Bash(curl -s:*)
effort: high
disable-model-invocation: true
---

# Optimize Marketplace

Invoke the `marketplace-optimizer` skill with the arguments below and follow its execution protocol. The skill
holds the procedure; `.claude/skills/marketplace-optimizer/house-rules.md` holds the decisions earlier runs settled.

## What a Run Does

1. **Cache, delta, coverage** — records the cached Claude Code version, refreshes `.claude/docs-cache/`, triages
   failed sources (pages split upstream are added as sources, then accepted with `--accept-shrink`), lists
   documentation pages the cache lacks, and cuts the changelog to the entries since the last run.
2. **Default model check** — reads which model the `opus`/`default` aliases resolve to; a changed default adds a
   model-specific prompt audit against that model's prompting guide.
3. **Secondary sources** — optional URLs or files, from the arguments or one prompt.
4. **Parallel analysis** — five element agents (skills, commands, agents, hooks, mcp) analyse without editing,
   starting from the documentation diff, with live session signals relayed to them (failed MCP servers, hooks firing
   on the wrong turn); then the marketplace agent checks structure, dependencies, cross-references and features.
5. **Verification** — the high-impact claims are re-checked against the cached pages before anything is shown.
6. **Findings and selection** — the numbered findings are printed first, then selected via grouped multi-select.
7. **Execution** — approved changes are applied by agents on disjoint file partitions; the coordinator handles
   everything outside them. Nothing is staged or committed.
8. **Final checks** — plugin validation, cross-references, cache integrity, hook and node tests, a verification pass
   over the diff, and updates to CLAUDE.md and the house rules.

## Usage

```bash
/optimize                                   # prompts once for secondary sources
/optimize --update-cache                    # force a cache refresh first
/optimize --skip-cache                      # analyse against the current cache
/optimize https://example.com/guide.md ./docs/notes.md   # secondary sources, no prompt
```

## Flags

| Flag | Description |
|------|-------------|
| `--update-cache` | Force cache update without version check |
| `--skip-cache` | Skip cache update entirely |

Arguments that start with `http://` or `https://` are URLs; everything else is a local file path. Empty input,
"keine", "none" or "no" at the prompt skips secondary sources; sources that contradict the cache are ignored.

## Cache Configuration

`.claude/docs-cache/sources.json` is the single source of truth for the cache: sources (type `md` for GitHub raw
files and the `.md` form of Anthropic's docs pages, `spa`/`html` as fallbacks, `pdf` maintained by hand), the
`coverage.ignore` prefixes, and `cache.updateBehavior`:

| Behavior | Description |
|----------|-------------|
| `never` | Never check or update the cache |
| `always` | Always update without asking |
| `auto` | Update automatically when a new version is available (default) |
| `ask` | Ask when a new version is available |
| `askAlways` | Always ask, even if the cache is current |

## Related Commands

- `/lt-dev:plugin:check` — quick validation without optimization
- `/lt-dev:plugin:element` — create new elements
