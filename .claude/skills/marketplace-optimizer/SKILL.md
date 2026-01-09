---
name: marketplace-optimizer
description: Optimizes this Claude Code marketplace using specialized sub-agents. Each agent is an expert for one element type (skills, commands, agents, hooks, mcp) and loads only relevant documentation. A marketplace agent validates cross-references and latest features. Triggers on "optimize marketplace", "sync with best practices", or when user wants to improve plugin quality.
---

# Marketplace Optimizer

Orchestrates specialized sub-agents to optimize Claude Code marketplaces efficiently. Each agent loads only the documentation it needs, keeping context usage minimal.

## Architecture

```
marketplace-optimizer (this skill)
    │
    ├── optimizer-skills     → skills.md, github-skills-readme.md
    ├── optimizer-commands   → slash-commands.md
    ├── optimizer-agents     → sub-agents.md
    ├── optimizer-hooks      → hooks.md
    ├── optimizer-mcp        → mcp.md
    │
    └── optimizer-marketplace → plugins.md, plugins-reference.md,
                                github-*.md, CHANGELOG
```

## When This Skill Activates

- User wants to optimize the marketplace or plugins
- User wants to optimize project-level `.claude/` elements
- User asks to sync with latest Claude Code best practices
- User mentions "optimize", "update docs", or "best practices"

## Scope

**Project-level** (`.claude/`):
- Skills, Agents, Commands

**Marketplace** (`plugins/`):
- Skills, Commands, Agents, Hooks, MCP configs

---

## Execution Protocol

### Phase 1: Cache Update

#### Step 1: Version Check

**Flags:**
- `--update-cache`: Force update, skip check
- `--skip-cache`: Skip update entirely

**Without flags:**
```bash
bun .claude/scripts/check-cache-version.ts
```

| recommendation | Action |
|---------------|--------|
| `"skip"` | Skip (updateBehavior: never) |
| `"update"` | Auto-update cache |
| `"ask"` | Ask user |
| `"current"` | Skip (cache is current) |

#### Step 2: Update Cache (if needed)

```bash
bun .claude/scripts/update-docs-cache.ts
```

### Phase 2: Secondary Sources (Optional)

**If no arguments provided**, prompt:
```
Sekundäre Quellen (optional)

Zusätzliche Referenzen eingeben (URLs oder lokale Dateien), oder leer lassen:
```

- Empty / "keine" / "none" / "no": Skip secondary sources
- Otherwise: Parse as URLs and/or local file paths

### Phase 3: Parallel Analysis

**Launch specialized agents in parallel** using the Task tool:

```markdown
## Agents to Spawn

| Agent | Scope | Docs Loaded |
|-------|-------|-------------|
| `optimizer-skills` | All skills in .claude/ and plugins/ | skills.md, github-skills-readme.md |
| `optimizer-commands` | All commands | slash-commands.md |
| `optimizer-agents` | All agents | sub-agents.md |
| `optimizer-hooks` | All hooks.json + scripts | hooks.md |
| `optimizer-mcp` | All .mcp.json | mcp.md |
```

**Spawn all 5 agents in parallel:**

```
Task(subagent_type="optimizer-skills", prompt="Analyze all skills in .claude/skills/ and plugins/*/skills/. Read docs first, then check each SKILL.md.")

Task(subagent_type="optimizer-commands", prompt="Analyze all commands in .claude/commands/ and plugins/*/commands/. Read docs first, then check each command.")

Task(subagent_type="optimizer-agents", prompt="Analyze all agents in .claude/agents/ and plugins/*/agents/. Read docs first, then check each agent.")

Task(subagent_type="optimizer-hooks", prompt="Analyze all hooks in plugins/*/hooks/. Read docs first, then check hooks.json and scripts.")

Task(subagent_type="optimizer-mcp", prompt="Analyze all MCP configs in plugins/*/.mcp.json. Read docs first, then check each config.")
```

### Phase 4: Cross-Reference & Feature Analysis

**After parallel agents complete**, spawn the marketplace agent:

```
Task(subagent_type="optimizer-marketplace", prompt="
Analyze overall marketplace structure:
1. Read plugins.md, plugins-reference.md, github-*.md, github-changelog.md
2. Check cross-references between all elements
3. Verify permissions.json completeness
4. Identify opportunities to use latest features from CHANGELOG
5. Check plugin.json validity
")
```

### Phase 5: Consolidate Results

Collect findings from all agents and create unified optimization list:

```markdown
## Proposed Optimizations

### Skills (from optimizer-skills)
- [ ] Finding 1
- [ ] Finding 2

### Commands (from optimizer-commands)
- [ ] Finding 1

### Agents (from optimizer-agents)
- [ ] Finding 1

### Hooks (from optimizer-hooks)
- [ ] Finding 1

### MCP (from optimizer-mcp)
- [ ] Finding 1

### Cross-References & Structure (from optimizer-marketplace)
- [ ] Finding 1
- [ ] New feature opportunity: ...
```

### Phase 6: User Confirmation

Use AskUserQuestion with multiSelect:
- Present all optimizations as checkboxes
- Default: all selected
- Group by agent/category

### Phase 7: Execute Approved Optimizations

For each approved optimization:
1. Use the appropriate specialized agent to make the change
2. Track progress with TodoWrite
3. Execute independent changes in parallel

### Phase 8: Final Verification

Spawn `optimizer-marketplace` again for final check:
- All cross-references valid
- No broken links between elements
- Content standards met (no history references)

---

## Specialized Agents

| Agent | Documentation | Expertise |
|-------|---------------|-----------|
| `optimizer-skills` | skills.md, github-skills-readme.md (~30 KB) | SKILL.md structure, frontmatter, auto-detection |
| `optimizer-commands` | slash-commands.md (~19 KB) | Command frontmatter, argument-hint, organization |
| `optimizer-agents` | sub-agents.md (~22 KB) | Agent frontmatter, tools, permissionMode |
| `optimizer-hooks` | hooks.md (~35 KB) | hooks.json, event types, script handlers |
| `optimizer-mcp` | mcp.md (~43 KB) | .mcp.json, server types, configuration |
| `optimizer-marketplace` | plugins*.md, github-*.md (~180 KB) | Cross-refs, permissions, CHANGELOG features |

**Total docs per agent:** 19-43 KB each (vs. 321 KB if loading all)

---

## Content Standards

All agents must enforce:

1. **No History References**
   - Never use "new", "updated", "since vX.Y"
   - Write timelessly

2. **Proper Frontmatter**
   - All required fields present
   - Correct types and values

3. **Cross-References**
   - All "Related Skills/Commands" exist
   - No broken links

---

## Output Format

After completion:

```markdown
## Marketplace Optimization Complete

### Agent Results
| Agent | Issues Found | Fixed |
|-------|--------------|-------|
| optimizer-skills | X | Y |
| optimizer-commands | X | Y |
| optimizer-agents | X | Y |
| optimizer-hooks | X | Y |
| optimizer-mcp | X | Y |
| optimizer-marketplace | X | Y |

### Changes Made

#### Skills
1. [Change description]

#### Commands
1. [Change description]

#### Agents
1. [Change description]

#### Hooks
1. [Change description]

#### MCP
1. [Change description]

#### Cross-References & Structure
1. [Change description]

### Verification
- [ ] All frontmatter valid
- [ ] No history references
- [ ] All cross-references exist
- [ ] Latest features considered
```

---

## Related Agents

- `optimizer-skills` - Skills expert
- `optimizer-commands` - Commands expert
- `optimizer-agents` - Agents expert
- `optimizer-hooks` - Hooks expert
- `optimizer-mcp` - MCP expert
- `optimizer-marketplace` - Cross-references & features expert
