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

If the file already exists, merge the `allow` entries with your existing permissions. See `plugins/lt-dev/permissions.json` for the current list of required permissions. Plugin helper scripts are not in `permissions.json`: settings do not expand `${CLAUDE_PLUGIN_ROOT}`, and a `*` in a script path also matches `../`, so a rule such as `Bash(bash <plugin dir>/*/scripts/*)` would approve `bash <plugin dir>/x/scripts/../../../dev/stdin`, that is, any code. The commands that run these scripts grant each one by exact name for their own turn; do not add a wildcard rule for them by hand.

## Plugins

### lt-dev

Skills, Commands, Hooks and Agents for Frontend (Nuxt 4), Backend (NestJS/nest-server), TDD and CLI Tools.

### lt-tools

General-purpose tools: `/lt-tools:save-website` saves a complete website as an offline copy that opens from `file://` and verifies it against the live site in headless Chrome.

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
| `code-reviewer` | Single-pass code review across 6 quality dimensions |

### Commands (36)

**Root:**
- `/lt-dev:create-ticket` - Create Linear Ticket (Story, Task, or Bug)
- `/lt-dev:create-story` - Create User Story for TDD (German)
- `/lt-dev:create-task` - Create Technical Task
- `/lt-dev:create-bug` - Create Bug Report
- `/lt-dev:resolve-ticket` - Resolve ticket end-to-end with TDD
- `/lt-dev:review` - Comprehensive code review across 9 review domains
- `/lt-dev:debug` - Adversarial debugging with competing hypotheses using Agent Teams
- `/lt-dev:linear-comment` - Generate and post testing comment on Linear issue
- `/lt-dev:skill-optimize` - Validate and optimize Claude Skills

**Plugin (`/plugin/`):**
- `/lt-dev:plugin:element` - Create new plugin elements (skills, commands, agents, hooks)
- `/lt-dev:plugin:check` - Verify elements against best practices (use after /clear)

**Backend (`/backend/`):**
- `/lt-dev:backend:update-nest-server` - Update @lenne.tech/nest-server with automated migration
- `/lt-dev:backend:update-nest-server-core` - Adopt upstream changes into a vendored nest-server core
- `/lt-dev:backend:contribute-nest-server-core` - Prepare vendored-core changes as upstream PRs
- `/lt-dev:backend:convert-to-vendor` / `/lt-dev:backend:convert-to-npm` - Switch framework mode
- `/lt-dev:backend:ai-model-review` - Recurring per-usage AI model review (inventory → research → measure → adopt)
- `/lt-dev:backend:sec-audit` - OWASP security audit for dependencies, config, and code
- `/lt-dev:backend:sec-review` - Perform security review
- `/lt-dev:backend:code-cleanup` - Clean up and optimize code
- `/lt-dev:backend:test-generate` - Generate tests

**Frontend (`/frontend/`):**
- `/lt-dev:frontend:env-migrate` - Migrate environment configuration

**Fullstack (`/fullstack/`):**
- `/lt-dev:fullstack:update` - Sync fullstack project with latest starter templates

**Docker (`/docker/`):**
- `/lt-dev:docker:gen-setup` - Generate Docker development & production setup

**Git (`/git/`):**
- `/lt-dev:git:commit-message` - Generate commit message
- `/lt-dev:git:mr-description` - Create Merge Request description (`--clipboard` copies it)
- `/lt-dev:git:rebase` - Rebase current branch onto dev/develop
- `/lt-dev:git:rebase-mrs` - Batch rebase for open MRs/PRs

**Vibe (`/vibe/`):**
- `/lt-dev:vibe:plan` - Create implementation plan from SPEC.md
- `/lt-dev:vibe:build` - Execute IMPLEMENTATION_PLAN.md
- `/lt-dev:vibe:build-plan` - Plan + Build in one step

**Maintenance (`/maintenance/`):**
- `/lt-dev:maintenance:maintain` - Full npm package maintenance (remove unused, optimize, update)
- `/lt-dev:maintenance:maintain-check` - Dry-run analysis without changes
- `/lt-dev:maintenance:maintain-security` - Security-only updates (npm audit fixes)
- `/lt-dev:maintenance:maintain-pre-release` - Conservative patch-only updates before release
- `/lt-dev:maintenance:maintain-post-feature` - Cleanup after feature development

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

### Recommended permission mode: auto

Work in **auto mode** (the built-in starting mode of interactive sessions since Claude Code 2.1.283; `Shift+Tab` or
`permissions.defaultMode: "auto"`). A classifier approves routine actions and asks only for risky ones, which is the
balance these plugins are built for: protected by default, nobody slowed down, a prompt only for a rare or sensitive
action. Manual (`default`) mode is not practical for agentic work with these plugins, whatever the allow list says:
measured over 151 real lt-dev sessions, it would ask about 131 times per session (median), and only about a third of
those prompts could be removed by any allow rule at all, because Claude Code asks for shell constructs such as
variables, `$(…)` or paths outside the project regardless of rules.

The allow rules below still matter in auto mode: an allow rule resolves an action before the classifier sees it, so
every rule is kept narrow (it would otherwise skip the safety check), and the frequent harmless ones save the
classifier round trip.

### Permissions Configuration

The file `plugins/lt-dev/permissions.json` lists the narrow Bash commands the skills and agents run without a prompt. The lenne.Tech CLI copies it into `~/.claude/settings.json` during installation, where every rule applies in every project. A rule the plugin narrowed or dropped is listed in the file's `formerPatterns` array, and the CLI removes it once from your settings; a rule you add again by hand afterwards stays. Broad tools (`curl`, `node`, `docker run`/`exec`, `git push`, `rm`, `cp`, `mv`) are not listed; the commands that need them grant them for their own turn through `allowed-tools`.

**Important:** When adding or modifying skills that use new CLI commands, update `permissions.json` accordingly, with a pattern no broader than its description:

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
