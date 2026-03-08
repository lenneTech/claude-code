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

Skills, Commands, Hooks and Agents for Frontend (Nuxt 4), Backend (NestJS/nest-server), TDD and CLI Tools.

## Included Components

### Skills (10)

| Skill | Description |
|-------|-------------|
| `developing-lt-frontend` | Nuxt 4, Nuxt UI 4, TypeScript, Valibot Forms |
| `generating-nest-servers` | NestJS with @lenne.tech/nest-server |
| `building-stories-with-tdd` | Test-Driven Development Workflow |
| `nest-server-updating` | Migration guides and strategies for @lenne.tech/nest-server updates |
| `rebasing-branches` | Rebase workflows for feature branches onto dev/develop |
| `general-frontend-security` | OWASP-based frontend security (XSS, CSRF, CSP) |
| `coordinating-agent-teams` | Agent Teams coordination and parallel workflows |
| `using-lt-cli` | lenne.tech CLI for Git and Fullstack Init |
| `maintaining-npm-packages` | Discovery skill for npm package maintenance commands |
| `developing-claude-plugins` | Plugin development best practices and validation |

### Agents (5)

| Agent | Description |
|-------|-------------|
| `npm-package-maintainer` | Maintaining, updating, and auditing npm packages |
| `nest-server-updater` | Automated @lenne.tech/nest-server version updates with migration |
| `fullstack-updater` | Synchronize fullstack project with latest starter templates |
| `branch-rebaser` | Autonomous rebase execution for feature branches |
| `code-reviewer` | Code review across 7 quality dimensions |

### Commands (32)

**Root:**
- `/create-ticket` - Create Linear Ticket (Story, Task, or Bug)
- `/create-story` - Create User Story for TDD (German)
- `/create-task` - Create Technical Task
- `/create-bug` - Create Bug Report
- `/resolve-ticket` - Resolve ticket end-to-end with TDD
- `/review` - Comprehensive code review across 7 quality dimensions
- `/debug` - Adversarial debugging with competing hypotheses using Agent Teams
- `/comment` - Generate and post testing comment on Linear issue
- `/skill-optimize` - Validate and optimize Claude Skills

**Plugin (`/plugin/`):**
- `/plugin:element` - Create new plugin elements (skills, commands, agents, hooks)
- `/plugin:check` - Verify elements against best practices (use after /clear)

**Backend (`/backend/`):**
- `/backend:update-nest-server` - Update @lenne.tech/nest-server with automated migration
- `/backend:sec-audit` - OWASP security audit for dependencies, config, and code
- `/backend:sec-review` - Perform security review
- `/backend:code-cleanup` - Clean up and optimize code
- `/backend:test-generate` - Generate tests

**Frontend (`/frontend/`):**
- `/frontend:env-migrate` - Migrate environment configuration

**Fullstack (`/fullstack/`):**
- `/fullstack:update` - Sync fullstack project with latest starter templates

**Docker (`/docker/`):**
- `/docker:gen-setup` - Generate Docker development & production setup

**Git (`/git/`):**
- `/git:commit-message` - Generate commit message
- `/git:mr-description` - Create Merge Request description
- `/git:mr-description-clipboard` - Copy MR description to clipboard
- `/git:rebase` - Rebase current branch onto dev/develop
- `/git:rebase-mrs` - Batch rebase for open MRs/PRs

**Vibe (`/vibe/`):**
- `/vibe:plan` - Create implementation plan from SPEC.md
- `/vibe:build` - Execute IMPLEMENTATION_PLAN.md
- `/vibe:build-plan` - Plan + Build in one step

**Maintenance (`/maintenance/`):**
- `/maintain` - Full npm package maintenance (remove unused, optimize, update)
- `/maintain-check` - Dry-run analysis without changes
- `/maintain-security` - Security-only updates (npm audit fixes)
- `/maintain-pre-release` - Conservative patch-only updates before release
- `/maintain-post-feature` - Cleanup after feature development

### Hooks (9)

**UserPromptSubmit - Project Detection (6):**

1. **Nuxt 4 Detection** - Detects `nuxt.config.ts` + `app/` structure and suggests `developing-lt-frontend` skill
2. **NestJS Detection** - Detects `@lenne.tech/nest-server` in package.json and suggests `generating-nest-servers` skill
3. **lt CLI Detection** - Detects installed `lt` CLI and suggests `using-lt-cli` skill
4. **Plugin Dev Detection** - Detects Claude Code plugin projects and suggests `developing-claude-plugins` skill
5. **Security Context Detection** - Detects web projects and suggests `general-frontend-security` skill for security keywords
6. **npm Maintenance Detection** - Detects Node.js projects and suggests `maintaining-npm-packages` skill

**PreToolUse - Validation (1):**

7. **Plugin Frontmatter Validation** - Validates YAML frontmatter when writing plugin files (`**/plugins/**/*.md`)
   - Skills: requires `name`, `description`
   - Agents: requires `name`, `description`, `model`, `tools`
   - Commands: requires `description`

**TeammateIdle (1):**

8. **Teammate Idle Gate** - Agent Teams coordination hook for idle teammate detection

**TaskCompleted (1):**

9. **Task Completed Gate** - Agent Teams coordination hook for task completion

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
│       ├── agents/
│       │   ├── branch-rebaser.md
│       │   ├── code-reviewer.md
│       │   ├── fullstack-updater.md
│       │   ├── nest-server-updater.md
│       │   └── npm-package-maintainer.md
│       ├── skills/
│       │   ├── building-stories-with-tdd/
│       │   ├── coordinating-agent-teams/
│       │   ├── developing-claude-plugins/
│       │   ├── developing-lt-frontend/
│       │   ├── general-frontend-security/
│       │   ├── generating-nest-servers/
│       │   ├── maintaining-npm-packages/
│       │   ├── nest-server-updating/
│       │   ├── rebasing-branches/
│       │   └── using-lt-cli/
│       ├── commands/
│       │   ├── create-bug.md
│       │   ├── create-story.md
│       │   ├── create-task.md
│       │   ├── create-ticket.md
│       │   ├── debug.md
│       │   ├── resolve-ticket.md
│       │   ├── review.md
│       │   ├── skill-optimize.md
│       │   ├── backend/
│       │   ├── docker/
│       │   ├── fullstack/
│       │   ├── git/
│       │   ├── maintenance/
│       │   ├── plugin/
│       │   └── vibe/
│       └── hooks/
│           ├── hooks.json
│           └── scripts/
├── scripts/
│   └── bump-version.ts
├── package.json
├── README.md
└── LICENSE
```

## License

MIT License - lenne.tech GmbH
