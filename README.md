# lenne.tech Claude Code Plugins

Claude Code Plugins by lenne.tech.

## Installation

### Via lenne.tech CLI (recommended)

```bash
# Install CLI if not already installed
npm i -g @lenne.tech/cli

# Install or update ALL available plugins
lt claude plugins

# Install or update specific plugin(s)
lt claude plugins lt-dev
lt claude plugins lt-dev another-plugin

# List available plugins (shown on error if plugin not found)
lt claude plugins non-existent
```

The CLI automatically:
- Fetches available plugins from this repository
- Updates the marketplace cache to ensure latest versions
- Installs/updates the specified plugins
- Configures all required permissions in `~/.claude/settings.json`

### Manual Installation

```bash
# Add marketplace
/plugin marketplace add lenneTech/claude-code

# Install plugin
/plugin install lt-dev@lenne-tech
```

**Note:** Manual installation requires you to configure permissions yourself. Copy the permission patterns from `plugins/lt-dev/permissions.json` into `~/.claude/settings.json`:

```json
{
  "permissions": {
    "allow": [
      // Copy patterns from permissions.json
    ]
  }
}
```

If the file already exists, merge the `allow` entries with your existing permissions. See `plugins/lt-dev/permissions.json` for the current list of required permissions.

## Plugins

### lt-dev

Skills, Commands and Hooks for Frontend (Nuxt 4), Backend (NestJS/nest-server), TDD and CLI Tools.

## Included Components

### Skills (4)

| Skill | Description |
|-------|-------------|
| `developing-lt-frontend` | Nuxt 4, Nuxt UI 4, TypeScript, Valibot Forms |
| `generating-nest-servers` | NestJS with @lenne.tech/nest-server |
| `building-stories-with-tdd` | Test-Driven Development Workflow |
| `using-lt-cli` | lenne.tech CLI for Git and Fullstack Init |

### Commands (13)

**Root:**
- `/create-story` - Create User Story for TDD (German)
- `/fix-issue` - Work on Linear Issue
- `/skill-optimize` - Validate and optimize Claude Skills

**Backend (`/backend/`):**
- `/backend:code-cleanup` - Clean up and optimize code
- `/backend:sec-review` - Perform security review
- `/backend:test-generate` - Generate tests

**Docker (`/docker/`):**
- `/docker:gen-setup` - Generate Docker development & production setup

**Git (`/git/`):**
- `/git:commit-message` - Generate commit message
- `/git:mr-description` - Create Merge Request description
- `/git:mr-description-clipboard` - Copy MR description to clipboard

**Vibe (`/vibe/`):**
- `/vibe:plan` - Create implementation plan from SPEC.md
- `/vibe:build` - Execute IMPLEMENTATION_PLAN.md
- `/vibe:build-plan` - Plan + Build in one step

### Hooks (3)

Automatic project detection on every prompt:

1. **Nuxt 4 Detection** - Detects `nuxt.config.ts` + `app/` structure and suggests `developing-lt-frontend` skill
2. **NestJS Detection** - Detects `@lenne.tech/nest-server` in package.json and suggests `generating-nest-servers` skill
3. **lt CLI Detection** - Detects installed `lt` CLI and suggests `using-lt-cli` skill for Git and Fullstack operations

Supports monorepo structures: `projects/`, `packages/`, `apps/`

### MCP Servers (2)

The plugin includes pre-configured MCP (Model Context Protocol) servers that start automatically:

| MCP Server | Description |
|------------|-------------|
| `chrome-devtools` | Chrome DevTools integration for debugging web applications |
| `linear` | Linear integration for issue tracking and project management |

## Requirements

- Claude Code CLI
- Node.js >= 18
- lenne.tech CLI (`npm i -g @lenne.tech/cli`) - for automatic permission setup

## Development

```bash
# Version bump (patch, minor, major) with change description
bun run version:patch "Fixed hook detection for monorepos"
bun run version:minor "Added new skill for API testing"
bun run version:major "Breaking changes in hook configuration"
```

The script updates `plugin.json` + `package.json`, creates commit, tag and pushes automatically.

### Permissions Configuration

The file `plugins/lt-dev/permissions.json` defines all Bash permissions required by the skills. The lenne.tech CLI reads this file during installation and automatically configures the permissions in `~/.claude/settings.json`.

**Important:** When adding or modifying skills that use new CLI commands, update `permissions.json` accordingly:

```json
{
  "permissions": [
    {
      "pattern": "Bash(your-command:*)",
      "description": "Description of what this permission allows",
      "usedBy": ["skill-name-that-uses-it"]
    }
  ]
}
```

Each permission entry contains:
- `pattern`: The permission pattern for Claude Code (e.g., `Bash(npm test:*)`)
- `description`: Human-readable description of the permission
- `usedBy`: Array of skill names that require this permission

## Structure

```
claude-code/
├── .claude-plugin/
│   └── marketplace.json
├── plugins/
│   └── lt-dev/
│       ├── .claude-plugin/
│       │   └── plugin.json
│       ├── permissions.json      # Required permissions for skills
│       ├── .mcp.json             # MCP server configurations
│       ├── skills/
│       │   ├── building-stories-with-tdd/
│       │   ├── developing-lt-frontend/
│       │   ├── generating-nest-servers/
│       │   └── using-lt-cli/
│       ├── commands/
│       │   ├── create-story.md
│       │   ├── fix-issue.md
│       │   ├── skill-optimize.md
│       │   ├── backend/
│       │   ├── docker/
│       │   ├── git/
│       │   └── vibe/
│       └── hooks/
│           └── hooks.json
├── scripts/
│   └── bump-version.ts
├── package.json
├── README.md
└── LICENSE
```

## License

MIT License - lenne.tech GmbH
