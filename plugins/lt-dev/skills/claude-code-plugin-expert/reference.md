# Claude Code Plugin Development Reference

## Official Documentation URLs

These are the authoritative sources for Claude Code plugin development. **Always fetch before implementation.**

### Primary URLs (validated December 2024)

| Topic | URL |
|-------|-----|
| Plugins & Marketplaces | https://code.claude.com/docs/en/plugins |
| Skills | https://code.claude.com/docs/en/skills |
| Slash Commands | https://code.claude.com/docs/en/slash-commands |
| Subagents | https://code.claude.com/docs/en/sub-agents |
| Hooks | https://code.claude.com/docs/en/hooks |

### Additional Resources

| Topic | URL |
|-------|-----|
| Claude Code Overview | https://code.claude.com/docs/en/overview |
| Configuration | https://code.claude.com/docs/en/settings |
| MCP Servers | https://code.claude.com/docs/en/mcp |
| CLI Reference | https://code.claude.com/docs/en/cli-reference |

### Fallback Strategy

If URLs return 404 or fail to load:

1. **WebSearch:** Use query `"Claude Code [topic] documentation site:claude.com"`
2. **Alternative domains:** Try `docs.claude.com` or `docs.anthropic.com`
3. **Report:** Note broken URLs for update in `/CLAUDE.md`

---

## Element Comparison Matrix

| Feature | Skill | Command | Agent | Hook |
|---------|-------|---------|-------|------|
| **Activation** | Auto/Manual | User `/command` | Task tool | Event |
| **Persistence** | Session | One-time | Isolated | Event-scoped |
| **Tool Access** | All | All | Specified | Script-based |
| **User Interaction** | Yes | Yes | Limited | No |
| **Autonomous** | No | No | Yes | Yes |
| **Best For** | Expertise | Workflows | Complex tasks | Automation |

---

## Frontmatter Field Reference

### Skills (SKILL.md)

```yaml
---
name: string          # Required. Kebab-case identifier
description: string   # Required. Max 280 chars. WHEN to use
allowed-tools: string # Optional. Restrict tools: Read, Grep, Glob, etc.
---
```

**Note on `allowed-tools`:** Use this to restrict which tools Claude can use when the skill is active. Useful for read-only skills or skills that should not modify files.

### Commands

```yaml
---
description: string              # Required. WHAT it does (for /help)
argument-hint: string            # Optional. Shows expected args, e.g., "[message]" or "[pr-number] [priority]"
allowed-tools: string            # Optional. Restrict tools, e.g., "Bash(git:*), Read, Grep"
model: string                    # Optional. Force specific model, e.g., "claude-3-5-haiku-20241022"
disable-model-invocation: bool   # Optional. Prevent SlashCommand tool from calling this command
---
```

**Argument variables:**
- `$ARGUMENTS` - All arguments as single string
- `$1`, `$2`, `$3` - Positional arguments

### Agents

```yaml
---
name: string              # Required. Kebab-case identifier
description: string       # Required. When/what for agent spawning
model: string             # Required. sonnet | opus | haiku
tools: string             # Required. Comma-separated tool names
permissionMode: string    # Optional. default | bypassPermissions
skills: string            # Optional. Comma-separated skill names
---
```

### Hooks (hooks.json)

```json
{
  "hooks": [
    {
      "name": "string",        // Required. Hook identifier
      "event": "string",       // Required. Event type
      "command": "string",     // Required. Script path + args
      "description": "string"  // Optional. Human-readable description
    }
  ]
}
```

---

## Tool Names for Agents

Available tools that can be specified in agent `tools` field:

| Tool | Purpose |
|------|---------|
| `Bash` | Execute shell commands |
| `Read` | Read file contents |
| `Write` | Create/overwrite files |
| `Edit` | Modify existing files |
| `Glob` | Find files by pattern |
| `Grep` | Search file contents |
| `WebFetch` | Fetch and analyze URLs |
| `WebSearch` | Search the web |
| `Task` | Spawn sub-agents |
| `TodoWrite` | Manage task lists |
| `AskUserQuestion` | Get user input |

---

## Event Types for Hooks

| Event | Trigger | Use Case |
|-------|---------|----------|
| `PreToolUse` | Before tool execution | Validation, input modification |
| `PostToolUse` | After tool execution | Cleanup, notifications |
| `UserPromptSubmit` | User sends message | Context injection |
| `Notification` | System notification | Alerting |
| `Stop` | Main agent finishes | Cleanup, summary |
| `SubagentStop` | Subagent finishes | Result processing |
| `SessionStart` | Session begins | Environment setup |
| `SessionEnd` | Session ends | Cleanup |
| `PreCompact` | Before compacting | Context preservation |
| `PermissionRequest` | Permission dialog | Auto-approve/deny |

---

## Model Selection Guide for Agents

| Model | When to Use |
|-------|-------------|
| `haiku` | Fast, simple tasks. Low cost. Good for repetitive operations. |
| `sonnet` | Default choice. Balanced speed/quality. Most tasks. |
| `opus` | Complex reasoning. Critical decisions. High-stakes operations. |

---

## Directory Structure Conventions

```
plugins/
└── plugin-name/
    ├── plugin.json              # Plugin manifest
    ├── agents/
    │   └── agent-name.md        # One file per agent
    ├── commands/
    │   ├── simple-command.md    # Top-level commands
    │   └── category/            # Grouped commands
    │       └── sub-command.md
    ├── hooks/
    │   ├── hooks.json           # Hook definitions
    │   └── scripts/             # Hook handler scripts
    │       └── handler.ts
    └── skills/
        └── skill-name/          # One directory per skill
            ├── SKILL.md         # Main skill file (required)
            ├── reference.md     # Reference documentation
            └── examples.md      # Usage examples
```

---

## Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Plugin | kebab-case | `lt-dev` |
| Skill directory | kebab-case | `generating-nest-servers` |
| Skill name | kebab-case | `generating-nest-servers` |
| Command file | kebab-case | `create-story.md` |
| Agent file | kebab-case | `npm-package-maintainer.md` |
| Hook name | kebab-case | `pre-tool-validation` |

---

## Description Writing Guidelines

### Skills
Focus on **WHEN** - triggers auto-detection:
- "Use when working with NestJS and @lenne.tech/nest-server..."
- "Expert for creating user stories with TDD..."
- "Use when performing package maintenance..."

### Commands
Focus on **WHAT** - describes the action:
- "Create a user story for TDD implementation"
- "Generate commit message with alternatives"
- "Perform security review of code changes"

### Agents
Focus on **WHAT + WHEN** - for Task tool matching:
- "Specialized agent for maintaining npm packages. Use when..."
- "Expert agent for code review. Spawned after significant changes..."

---

## Complete Examples

For detailed, copy-paste-ready examples of each element type, see **[examples.md](examples.md)**.

Quick reference for minimal implementations:

### Minimal Skill
```yaml
---
name: my-skill
description: Use when [trigger]. Provides [capability].
---
# Title
[Content]
```

### Minimal Command
```yaml
---
description: What this command does
---
[Instructions]
```

### Minimal Agent
```yaml
---
name: my-agent
description: What this agent does
model: sonnet
tools: Read, Write, Grep, Glob
---
[Protocol]
```
