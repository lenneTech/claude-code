# lt-dev Plugin

lenne.tech Development Skills, Commands and Hooks for Claude Code - Frontend (Nuxt 4), Backend (NestJS), TDD and CLI Tools.

## Installation

```bash
claude plugins install lt-dev --marketplace lenne-tech
```

## Recommended Plugins

These plugins are **optional** but enhance the experience when working with this plugin:

| Plugin | Marketplace | Purpose | Install Command |
|--------|-------------|---------|-----------------|
| `typescript-lsp` | claude-plugins-official | TypeScript language server for better code intelligence | `claude plugins install typescript-lsp --marketplace claude-plugins-official` |

## Features

- **Backend Development**: NestJS with @lenne.tech/nest-server (supports both npm-mode and vendored-mode projects — see below)
- **Frontend Development**: Nuxt 4 with Nuxt UI
- **TDD Workflows**: Test-Driven Development with story-based implementation
- **Nest-Server Updates**: Automated migration guides and stepwise upgrades (auto-delegates to `nest-server-core-updater` in vendored projects)
- **Fullstack Updates**: Synchronize projects with latest starter templates
- **CLI Tools**: lenne.tech CLI integration
- **Git Workflows**: Commit messages, MR descriptions, branch rebasing
- **Code Review**: Comprehensive review across 9 review domains
- **Linear Integration**: Issue management and story creation
- **Docker**: Development and production setup generation
- **Package Maintenance**: npm dependency management and security audits
- **Frontend Security**: OWASP-based security auditing (XSS, CSRF, CSP)
- **Agent Teams**: Parallel workflow coordination for complex tasks
- **Plugin Development**: Claude Code plugin best practices and validation

## Included

- **10 Skills** - Auto-detected contextual expertise
- **5 Agents** - Autonomous task execution
- **27 Commands** - User-triggered actions via `/command-name`
- **9 Hooks** - Automated project detection and validation
- **5 MCP Servers** - Chrome DevTools, Linear, Nuxt UI, Better Auth, and Figma Desktop integration

## Framework consumption modes (nest-server)

lenne.tech api projects can consume `@lenne.tech/nest-server` in one of two modes:

- **npm mode** (classic): `@lenne.tech/nest-server` is installed as a dependency. Framework source lives in `node_modules/@lenne.tech/nest-server/`. Imports use the bare specifier `from '@lenne.tech/nest-server'`. Updated via `/lt-dev:backend:update-nest-server` → `nest-server-updater` agent.
- **vendored mode**: the framework's `core/` directory is copied directly into the project at `<api-root>/src/core/` and managed as first-class project code. There is NO `@lenne.tech/nest-server` npm dependency. Imports use relative paths (`from '../../../core'`). Local patches are allowed and logged in `<api-root>/src/core/VENDOR.md`. Updated via `/lt-dev:backend:update-nest-server-core` → `nest-server-core-updater` agent; local changes are proposed back upstream via `/lt-dev:backend:contribute-nest-server-core` → `nest-server-core-contributor` agent.

**Detection**: `test -f <api-root>/src/core/VENDOR.md` → vendored, else npm. The `detect-nest-server` hook, the `nest-server-updater` agent, and the `nest-server-core-vendoring` skill all perform this check automatically and branch accordingly. All skills and agents that reference framework files (`generating-nest-servers`, `building-stories-with-tdd`, `backend-dev`, etc.) carry a preamble listing both path conventions.

## License

MIT - lenne.tech GmbH
