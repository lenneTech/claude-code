---
name: marketplace-optimizer
description: 'Optimizes this Claude Code marketplace against the current Claude Code documentation and the current default model. Refreshes the docs cache, derives the documentation and changelog delta, fans out one analysis agent per element type (skills, commands, agents, hooks, mcp) plus a marketplace agent for cross-references, verifies the high-impact findings at the source, and applies the approved changes through agents working on disjoint file partitions. Triggers on "optimize marketplace", "/optimize", "sync with best practices", "check the plugins against the new Claude Code version", or when the user wants to improve plugin quality.'
---

# Marketplace Optimizer

Keeps `plugins/` and the project-level `.claude/` elements aligned with what Claude Code and the default model
actually do today. The optimizer agents each load only the documentation for their element type; the coordinator
(this skill) owns the cache, the delta, verification, the user dialogue and every file outside the agents'
partitions.

Read [house-rules.md](house-rules.md) before Phase 3. It holds the decisions earlier runs settled, each with its
reason; findings that would reverse one are dropped unless fresh documentation disproves the reason.

## Architecture

| Agent | Scope | Primary docs (`.claude/docs-cache/`) |
|-------|-------|--------------------------------------|
| `optimizer-skills` | `.claude/skills/`, `plugins/*/skills/` | skills, platform-skills-best-practices, skill-building-guide, github-skills-readme, plugin-evals, plugins-measure |
| `optimizer-commands` | `.claude/commands/`, `plugins/*/commands/` | skills (commands are skills), commands, tools-reference, permissions, model-config, goal, permission-modes |
| `optimizer-agents` | `.claude/agents/`, `plugins/*/agents/` | sub-agents, plugins-components, agent-teams, worktrees, tools-reference, model-config |
| `optimizer-hooks` | `plugins/*/hooks/` | hooks, hooks-guide, env-vars, permissions, headless, plugins-components |
| `optimizer-mcp` | `plugins/*/.mcp.json`, MCP launchers | mcp, plugins-components, sandboxing |
| `optimizer-marketplace` | structure, cross-references, permissions.json, manifests | plugins, plugins-components, plugins-reference, plugins-marketplace-reference, plugins-host-marketplace, plugins-loading, plugins-cli-reference, plugin-dependencies, plugin-relevance, plugin-hints, github-*, changelog delta |

All six inherit the session model. Prompt-level guidance for the default model lives in
`prompting-claude-opus-5-5.md`, `claude-prompting-best-practices.md` and `effort.md`; every agent that judges prompt
text reads the model-specific page.

## Execution Protocol

Use the session scratchpad directory for every intermediate file (`$S` below).

### Phase 1: Cache, delta and coverage

1. **Record the cached version before touching anything** — the delta depends on it:
   ```bash
   bun .claude/scripts/check-cache-version.ts   # note "cacheVersion"
   ```
   `--update-cache` forces an update, `--skip-cache` skips it; otherwise follow `recommendation`
   (`update` → update, `ask`/`askAlways` → ask, `current`/`skip` → no update).
2. **Update:** `bun .claude/scripts/update-docs-cache.ts`. A `pdf` source is skipped by design.
3. **Triage every failed source.** A shrink-guard failure ("extraction returned N bytes vs. M cached") usually means
   the page was split upstream: fetch the live `.md`, list its `##` headings and outgoing `/docs/en/` links, and look
   for material that moved to a page of its own. Add that page to `sources.json`, fetch it, then accept the smaller
   page with `--source=<name> --accept-shrink`. Record the split in CLAUDE.md's "Pages split upstream" note.
4. **Coverage:** `bun .claude/scripts/check-docs-coverage.ts` lists indexed pages the cache lacks, and cached pages that left the index (moved or split upstream — their old URL may keep serving a different page, so repoint the source and add the split-off pages). Add a page when it
   governs something the plugins do (element frontmatter, tools, permissions, hooks, MCP, plugins, marketplaces,
   models, prompting); extend `coverage.ignore` for areas that never matter here. Platform prompting pages are not in
   that index — when the default model changes (step 6), add its `prompting-claude-<model>.md` page by hand.
5. **Delta:**
   ```bash
   git diff --stat .claude/docs-cache/
   bun .claude/scripts/changelog-delta.ts --from=<cacheVersion> > "$S/changelog-delta.md"
   ```
   The per-page `git diff .claude/docs-cache/<page>.md` is the strongest signal each analysis agent gets.
6. **Default model:** read the alias table in `model-config.md`. If `opus`/`default` resolves to a model the last
   run did not target, the run includes a model-specific prompt audit (Phase 3 brief) against that model's prompting
   page, and the model-specific facts (effort default, task-tool availability, thinking controls) go into the
   verified-facts block.

### Phase 2: Secondary sources (optional)

Without arguments, ask once (AskUserQuestion, "Keine" as the first option) for extra URLs or files. Empty,
"keine", "none", "no" skip it. Sources that contradict the cache are ignored.

### Phase 3: Parallel analysis — ANALYSIS ONLY

Spawn the five element agents in one message (Agent tool, background). Each prompt is self-contained and carries:

- **Mode:** analysis only — no edits, no staging.
- **Delta pointers:** the `git diff` command for its pages, `$S/changelog-delta.md` with grep terms for its element
  type, and the new pages from Phase 1.
- **House rules:** read `house-rules.md`; name any rule it believes the fresh docs disprove.
- **Live session signals** the agents cannot see themselves: MCP servers that failed to connect in this session (with
  the quoted error), hook-injected context that appeared on turns where it did not belong, tools the session reported
  as unavailable. A signal is evidence to reproduce, not a conclusion.
- **Report format:** ID, severity, `file:line`, what is wrong, evidence (cache file + short quote, changelog
  version, or reproduction output), proposed change, confidence; then "Checked, no action needed" one-liners. Five
  solid findings beat twenty speculative ones.

Relay new live signals to the running agent with `SendMessage` as they appear.

**Model signal pass (coordinator, while the agents run).** Quote the globs — zsh expands an unquoted `*.md`:
```bash
P=plugins
grep -rEoc '\b(MUST|NEVER|ALWAYS|CRITICAL|IMPORTANT)\b' $P --include='*.md' | awk -F: '$2>0{print $2, $1}' | sort -rn | head -12
grep -rnE 'TodoWrite|TaskCreate|SlashCommand' $P | wc -l
grep -rnE '^effort: *(max|xhigh)' $P
grep -rniE 'think step by step|think (hard|harder|carefully)|ultrathink|<scratchpad>' $P --include='*.md'
grep -rnE 'claude-3|3-5-sonnet|3-5-haiku' $P
grep -rnE '^isolation:' $P/*/agents
```
Read each hit against the model-specific prompting page before it becomes a finding: emphasis inside a code block, a
severity label, or a documented incident is not a defect.

### Phase 4: Cross-references and features

After the element agents finish, spawn `optimizer-marketplace` (analysis only) with the delta pointers and the
coverage output.

### Phase 4b: Verify before presenting

For every high-severity finding and every finding that would change many files, re-check the claim against the
cached page yourself (grep the quoted passage) or reproduce it. Findings that fail verification are dropped; claims
that turn out broader than reported (e.g. a tool missing on the default model, not just renamed) are widened.

### Phase 5: Present results

Before asking anything, print the consolidated findings as Markdown, grouped by category with counts, numbered, each
with what/where/why. Lead with a short answer to any question the user asked, and state what is already fine.

### Phase 6: User confirmation

AskUserQuestion allows at most 4 questions with 4 options each, so group the findings (one question per area, one
option per finding group) with multiSelect. Mark options you do not recommend as such. A better alternative that
surfaces after approval (house rule 31) gets its own question.

### Phase 7: Execute approved optimizations

- **Partition by file tree, not by finding**, so no two agents edit one file: commands agent → `plugins/*/commands/**`,
  agents agent → `plugins/*/agents/**`, skills agent → `plugins/*/skills/**`, hooks agent → `plugins/*/hooks/**`.
  The coordinator owns `.mcp.json`, `scripts/`, READMEs, `.claude/`, CLAUDE.md and cross-partition follow-ups.
- Spawn the partition agents in parallel with `model` set to the strongest available alias. Every prompt carries the
  partition, the git rule (no stage/commit/stash/checkout), the authoring rules, a **verified-facts block** (the
  doc facts behind the approved findings, stated once so agents do not re-derive them), the tasks with `file:line`,
  and the validation commands to run before reporting.
- Apply each agent's "Needed outside my partition" list yourself afterwards.

### Phase 8: Verify and record

1. Run the repository checks — all must pass:
   ```bash
   for p in plugins/*/; do claude plugin validate "$p"; done
   bun .claude/scripts/check-cross-references.ts
   bun .claude/scripts/check-cache-integrity.ts
   while IFS= read -r t; do bash "$t" || echo "FAIL $t"; done < <(find plugins -path '*/__tests__/*.test.sh' | sort)
   node --test $(find plugins -name '*.test.mjs' -not -path '*/node_modules/*' | sort)
   ```
2. **Measure with the eval suite** (`plugins/lt-dev/evals/`, see its README): run the `trigger` suite whenever a
   skill description or a command changed, and the `quality` suite, with and without the plugin, when skill bodies or
   agents changed. When the default model or an effort policy is in question, run `quality` once per effort level with
   `CLAUDE_CODE_EFFORT_LEVEL`. Compare against the previous run's `aggregate-result.json`; a drop is a finding. The
   `claude` on PATH must support the default model (Opus 5.5 needs 2.1.280+); if it lags, use a newer binary such as
   the IDE extension's rather than changing the global install mid-run. Run the eval commands under `bash` with flag
   arrays — zsh does not word-split a `$FLAGS` variable, so the run dies on "unknown option". Before blaming the
   plugin for a low score, rerun the case once with `--keep-temp` and read its trace and output: a grader that
   encodes the wrong convention scores a correct plugin as wrong, and a judge rubric that omits lt semantics (e.g.
   class-level `@Restricted` as a fallback) fails correct code. Cases that do project work seed a real project
   layout with `--scaffold`; in an empty workspace agents alternate between building and asking.
3. Spawn `optimizer-marketplace` once more, analysis only, scoped to the diff: leftover references to renamed or
   removed things, cross-references and anchors, content standards in added lines, meaning preserved in rewrites.
4. Update CLAUDE.md (cache table, MCP table, frontmatter examples) and add every durable decision of this run to
   `house-rules.md` with its reason. Correct auto-memory entries the run disproved.

## Output Format

```markdown
## Marketplace Optimization Complete

### Agent Results
| Agent | Issues Found | Fixed |
|-------|--------------|-------|

### Changes Made
(grouped by Skills / Commands / Agents / Hooks / MCP / Cross-References & Structure / Docs cache)

### Verification
- plugin validate, cross-references, cache integrity, hook and node tests — with results
- Open items deliberately not changed, with the reason
```

## Content Standards

1. No history references ("new", "updated", "since vX.Y"); documented-incident notes with a date or ticket id are
   the exception (house rule 25).
2. Frontmatter complete and valid; tool names from `tools-reference.md`.
3. Every cross-reference resolves.

## Related Agents

- `optimizer-skills`, `optimizer-commands`, `optimizer-agents`, `optimizer-hooks`, `optimizer-mcp` — element experts
- `optimizer-marketplace` — cross-references, manifests, permissions, features, final verification
