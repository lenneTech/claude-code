# Claude Code Marketplace & Plugin Development

This repository is a **Claude Code marketplace** containing plugins, agents, commands, hooks, skills, and scripts. When working in this codebase, you are developing Claude Code extensions - apply best practices accordingly.

## Automatic Quality Assurance

**CRITICAL:** Before ANY modification to this package, use the `claude-code-plugin-expert` skill to ensure:
- Consistency with existing patterns and structure
- Adherence to current Claude Code best practices
- Optimal configuration and naming conventions

## Documentation Sources (MUST READ before implementation)

Always fetch and apply current best practices from these official sources.

### Primary URLs

| Topic | URL |
|-------|-----|
| Plugins & Marketplaces | https://code.claude.com/docs/en/plugins |
| Skills | https://code.claude.com/docs/en/skills |
| Slash Commands | https://code.claude.com/docs/en/slash-commands |
| Subagents | https://code.claude.com/docs/en/sub-agents |
| Hooks | https://code.claude.com/docs/en/hooks |
| MCP Servers | https://code.claude.com/docs/en/mcp |
| Memory (CLAUDE.md) | https://code.claude.com/docs/en/memory |
| Settings | https://code.claude.com/docs/en/settings |
| CLI Reference | https://code.claude.com/docs/en/cli-reference |
| Plugin Reference | https://code.claude.com/docs/en/plugins-reference |
| Claude Code CHANGELOG | https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md |

### Fallback Strategy (if URLs fail)

If any URL returns 404 or fails to load:

1. **WebSearch Fallback:** Use `WebSearch` with query: `"Claude Code [topic] documentation site:claude.com"`
2. **Alternative domains to try:**
   - `code.claude.com/docs/en/[topic]`
   - `docs.claude.com/en/docs/claude-code/[topic]`
   - `docs.anthropic.com/en/docs/claude-code/[topic]`
3. **Report broken URL:** Note the broken URL so it can be updated in this file

## Repository Structure

```
claude-code/
├── .claude-plugin/
│   └── marketplace.json      # Marketplace definition
├── plugins/
│   └── lt-dev/               # Main plugin
│       ├── .claude-plugin/
│       │   └── plugin.json   # Plugin manifest
│       ├── agents/           # Autonomous agents (.md files)
│       ├── commands/         # Slash commands (.md files, can be nested)
│       ├── hooks/            # Event hooks
│       │   ├── hooks.json    # Hook definitions
│       │   └── scripts/      # Hook handler scripts (.sh, .ts)
│       ├── skills/           # Context-aware expertise (SKILL.md + references)
│       ├── permissions.json  # Bash permission patterns for auto-approval
│       ├── permissions.schema.json  # JSON Schema for permissions validation
│       └── .mcp.json         # MCP server dependencies
```

## Configuration Files (MUST UPDATE when adding features)

### permissions.json
Defines Bash command patterns that can be auto-approved without user confirmation.

**Update when:**
- Adding new Bash commands to skills or agents (npm, lt, npx, etc.)
- Creating new skills that use CLI tools

**Structure:**
```json
{
  "permissions": [
    {
      "pattern": "Bash(npm test:*)",
      "description": "Run npm test commands",
      "usedBy": ["skill-name-1", "skill-name-2"]
    }
  ]
}
```

**Rules:**
- Always add `usedBy` array with skill/agent names that need the permission
- Use wildcard patterns (`:*`) for flexible matching
- Keep descriptions clear and concise

**Validation:** Use `permissions.schema.json` for IDE autocompletion and validation. Reference it via `"$schema": "./permissions.schema.json"` in permissions.json.

### .mcp.json
Defines MCP (Model Context Protocol) servers required by the plugin.

**Update when:**
- Commands or skills require external MCP tools (Linear, Chrome DevTools, etc.)
- Adding new integrations that use MCP servers

**Current servers:**
| Server | Type | Used By |
|--------|------|---------|
| `chrome-devtools` | stdio | vibe commands (browser testing) |
| `linear` | http | fix-issue, create-story (issue management) |

### plugin.json
Plugin manifest with metadata. Update `version` before releases.

## Element Types & When to Use

| Element | Purpose | Activation |
|---------|---------|------------|
| **Skill** | Contextual expertise that enhances capabilities | Auto-detected or manually invoked |
| **Command** | User-triggered actions via `/command-name` | Explicit user invocation |
| **Agent** | Autonomous task execution with specific tools | Spawned by Task tool |
| **Hook** | Automated responses to events | Event-triggered (PreToolUse, PostToolUse, UserPromptSubmit, Stop, SubagentStart, SubagentStop, SessionStart, SessionEnd, etc.) |
| **Script** | Utility functions for hooks or CLI | Called by hooks or directly |

## File Naming Conventions

- **Skills**: `SKILL.md` (main) + supporting `.md` files in skill directory
- **Commands**: `command-name.md` (kebab-case)
- **Agents**: `agent-name.md` (kebab-case)
- **Hooks**: `hooks.json` + referenced scripts

## YAML Frontmatter Requirements

### Skills (SKILL.md)
```yaml
---
name: skill-name
description: Concise description for auto-detection (max 1024 chars). Must explain WHEN to use this skill. Include trigger terms for auto-detection.
# Optional fields:
allowed-tools: Read, Grep, Glob  # Restrict available tools
model: sonnet | opus | haiku     # Override default model
context: fork                     # Run in isolated sub-agent
user-invocable: false            # Hide from slash command menu
---
```

### Commands
```yaml
---
description: What this command does (shown in /help)
# Optional fields:
allowed-tools: Bash(git:*), Read  # Restrict available tools
argument-hint: [branch-name]      # Show expected arguments
model: haiku                      # Use specific model
disable-model-invocation: false   # Prevent SlashCommand tool use
---
```

### Agents
```yaml
---
name: agent-name
description: When and how to use this agent
model: sonnet | opus | haiku
tools: Bash, Read, Grep, Glob, Write, Edit, ...
permissionMode: default | acceptEdits | dontAsk | bypassPermissions
skills: optional-skill-names
---
```

## Quality Standards

### Description Guidelines
- **Skills**: Focus on WHEN to use (triggers auto-detection)
- **Commands**: Focus on WHAT it does
- **Agents**: Focus on WHAT tasks it handles autonomously

### Structural Consistency
- Use consistent heading levels (# for title, ## for sections)
- Include examples for complex workflows
- Reference related elements explicitly
- Keep markdown clean and scannable

### Best Practices
- One responsibility per element
- Clear separation between skill (expertise) and command (action)
- Prefer composition over duplication
- Document dependencies between elements
- Test all commands and workflows manually

## Creating New Elements

Use the `/lt-dev:plugin:element` command to interactively create new elements with:
- Best practice compliance
- Consistent structure
- Proper frontmatter
- Automatic placement

**After creating elements, also update:**
1. **permissions.json** - If the element uses new Bash commands
2. **.mcp.json** - If the element requires new MCP servers
3. **Related Skills sections** - Add cross-references to related skills
4. **"When to Use" sections** - For commands that are part of a workflow

## After Context Loss (/clear or Summarization)

If the conversation was reset with `/clear` or context was summarized, run:

```
/lt-dev:plugin:check
```

This restores best practice awareness and validates any pending changes.

## Optimization Workflow

When optimizing existing elements:
1. Read current official documentation (WebFetch the URLs above)
2. Analyze existing element against best practices
3. Propose specific improvements
4. Implement changes with minimal disruption
5. Verify consistency with related elements

## Language Requirements

- All code, comments, and documentation: **English**
- Exception: User-facing German content where explicitly required (e.g., create-story.md)

## Maintenance Checklist

Run `/lt-dev:plugin:check` periodically or before releases to verify:

### Skills
- [ ] All SKILL.md have valid frontmatter (name, description)
- [ ] All referenced .md files exist
- [ ] "Related Skills" sections are present and accurate
- [ ] Descriptions include trigger terms for auto-detection

### Commands
- [ ] All commands have `description` in frontmatter
- [ ] Complex/related commands have "When to Use" sections
- [ ] `allowed-tools` is set where appropriate (especially git commands)
- [ ] `argument-hint` is set for commands accepting arguments

### Agents
- [ ] Frontmatter includes: name, description, model, tools, permissionMode
- [ ] Skills referenced in frontmatter exist
- [ ] Agent tasks are clearly defined

### Hooks
- [ ] hooks.json is valid JSON
- [ ] All referenced scripts in `hooks/scripts/` exist
- [ ] Hook matchers are correctly configured

### Configuration Files
- [ ] **permissions.json**: All Bash patterns used by skills/agents are listed
- [ ] **permissions.json**: `usedBy` arrays are complete and accurate
- [ ] **.mcp.json**: All required MCP servers are configured
- [ ] **plugin.json**: Version is updated before release

### Documentation
- [ ] **CLAUDE.md**: Repository structure matches actual layout
- [ ] **CLAUDE.md**: Configuration file docs are current
- [ ] All cross-references between elements are valid
