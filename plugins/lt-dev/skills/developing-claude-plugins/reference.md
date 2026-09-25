# Claude Code Plugin Development Reference

## Table of Contents

- [Official Documentation URLs](#official-documentation-urls)
- [Element Comparison Matrix](#element-comparison-matrix)
- [Frontmatter Field Reference](#frontmatter-field-reference)
- [Tool Names for Agents](#tool-names-for-agents)
- [Event Types for Hooks](#event-types-for-hooks)
- [Model Selection Guide for Agents](#model-selection-guide-for-agents)
- [Directory Structure Conventions](#directory-structure-conventions)
- [Naming Conventions](#naming-conventions)
- [Description Writing Guidelines](#description-writing-guidelines)
- [Complete Examples](#complete-examples)

---

## Official Documentation URLs

These are the authoritative sources for Claude Code plugin development. **Always fetch before implementation.**

### Primary URLs

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
| **Activation** | Auto/Manual | User `/command` | Agent tool | Event |
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
description: string   # Required. Max 1,024 chars (Agent Skills spec). WHEN to use; key use case first
when_to_use: string   # Optional. Extra trigger phrases, appended to description in the listing
allowed-tools: string # Optional. Restrict tools: Read, Grep, Glob, etc.
---
```

**Listing cap:** Claude Code truncates `description` plus `when_to_use` at 1,536 characters in the skill listing (`skillListingMaxDescChars`), so put the key use case first.

**Note on `allowed-tools`:** Use this to restrict which tools Claude can use when the skill is active. Useful for read-only skills or skills that should not modify files.

### Commands

```yaml
---
description: string              # Required. WHAT it does (for /help)
argument-hint: string            # Optional. Shows expected args, e.g., "[message]" or "[pr-number] [priority]". MUST quote values containing brackets: '"[arg]"'
allowed-tools: string            # Optional. Restrict tools, e.g., "Bash(git:*), Read, Grep"
model: string                    # Optional. Alias (opus | sonnet | haiku | fable) or inherit; a full ID such as "claude-opus-5-5" only to pin a model
disable-model-invocation: bool   # Optional. Prevent the Skill tool from invoking this command
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
model: string             # Optional. inherit | opus | sonnet | haiku | fable | full ID; falls back to the default subagent model
tools: string             # Optional. Comma-separated tool names; inherits all tools when omitted
effort: string            # Optional. low | medium | high | xhigh | max; inherits the session level when omitted
permissionMode: string    # Optional. default | bypassPermissions (ignored for plugin agents)
skills: string            # Optional. Comma-separated skill names, preloaded into context
---
```

### Hooks (hooks.json)

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/hooks/scripts/handler.sh",
            "if": "Edit(**/*.ts)",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

- Top-level key `hooks` holds an object keyed by event name (`PreToolUse`, `PostToolUse`, `UserPromptSubmit`, ...).
- `matcher` is always a string tested against the tool name (`"Edit|Write"`); omit it to match every tool.
- Path or argument filtering uses the optional `if` field on the individual hook object, in permission-rule syntax (`"Edit(**/*.ts)"`, `"Bash(git *)"`). It holds exactly one rule; to cover both tools, add a `Write(...)` handler next to the `Edit(...)` one.
- A command hook receives the event data as JSON on stdin (for example `tool_input.file_path`); read it with `jq`. There is no `CLAUDE_FILE_PATH` environment variable.

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
| `Agent` | Spawn sub-agents |
| `Skill` | Invoke skills and commands at runtime (preloading uses the `skills:` field instead) |
| `LSP` | Code intelligence via language servers |
| `AskUserQuestion` | Get user input |

**Task-tracking tools are not a portable choice.** `TaskCreate`, `TaskGet`, `TaskList`, `TaskUpdate` and `TodoWrite` exist by default only on Claude 3.x, Opus 4 to 4.7, Sonnet 4 to 4.6 and Haiku 4.5; on Opus 5.5, Opus 5, Sonnet 5 and Fable they are absent unless the user sets `CLAUDE_CODE_ENABLE_TODO_TOOLS=1`, and a subagent gets them only when its session has them. Describe multi-step work as a phase list whose outcomes the final report states. Source: https://code.claude.com/docs/en/tools-reference#task-tool-availability

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
| `inherit` | Follows the session model. The default for plugin agents. |
| `opus` / `sonnet` / `haiku` / `fable` | Pins that model family for every user. Only where the pinned model is measurably as good for the job. |

The aliases resolve to the latest model per provider. Pin a full ID such as `claude-opus-5-5` only when a specific model is required. Model choice optimizes quality and time per completed task, not per-token price: a pin chosen to save tokens silently downgrades every user who runs a stronger session model.

**Effort:** pin it only where a measurement shows it adds quality; unpinned, the element runs at the session's level and the developer can raise it per task. A pin overrides the session both ways. Any pin needs an "Effort policy" note naming the measurement behind it; `xhigh` and `max` in particular run much longer turns (on Opus 5.5 the lt-dev evals found `medium` equal to `high` and `xhigh` for builds, reviews and planning). The scale is calibrated per model (Opus 5.5 defaults to `medium`, other effort-capable models to `high`), so the same name is not the same amount of thinking across models.

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
Focus on **WHAT + WHEN** - for Agent tool matching:
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
model: inherit
tools: Read, Write, Grep, Glob
---
[Protocol]
```
