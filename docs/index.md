---
title: Claude Code plugins
description: The lenne-tech marketplace for Claude Code, with lt-dev for working in the lenne.tech stack and three plugins for offers, showcases and everyday tools.
navigation:
  title: Overview
---

The repository [lenneTech/claude-code](https://github.com/lenneTech/claude-code) is the `lenne-tech` marketplace
for [Claude Code](https://code.claude.com/docs). Its plugins teach Claude the lenne.tech stack (NestJS with
`@lenne.tech/nest-server`, Nuxt 4 with `@lenne.tech/nuxt-extensions` or Angular 22 with `@lenne.tech/ng-base`, the
`lt` CLI) and add commands for the whole ticket workflow, from a Linear ticket to the merged change.

## Plugins

| Plugin | What it does |
|---|---|
| `lt-dev` | Skills, commands, agents and hooks for the lenne.tech stack: backend and frontend development, test-driven tickets from Linear, code review, framework and dependency updates, Docker and CI |
| `lt-offers` | Business offers on [angebote.lenne.tech](https://angebote.lenne.tech) and concept folders (Konzeptmappen) through MCP |
| `lt-showroom` | Project analysis and showcases on [showroom.lenne.tech](https://showroom.lenne.tech), with screenshots taken from a throwaway clone |
| `lt-tools` | General-purpose tools, such as an offline copy of a website that is checked against the live site |

Most of this site is about `lt-dev`. The other three plugins are described in
[Other plugins](./5.other-plugins.md).

## Pages

| Page | What it covers |
|---|---|
| [Installation](./1.installation.md) | Requirements, `lt claude plugins`, updates, shell shortcuts, IDE integration |
| [Permissions](./2.permissions.md) | The recommended permission mode and the allow rules the CLI sets up |
| [Commands](./3.lt-dev/1.commands.md) | Every `/lt-dev:` command, grouped by task |
| [Agents](./3.lt-dev/2.agents.md) | The agents the commands start for implementation, review and updates |
| [Skills](./3.lt-dev/3.skills.md) | The skills Claude loads on its own when a task needs them |
| [Ticket workflow](./4.workflows/1.ticket-workflow.md) | From a Linear ticket to a merged change, step by step or in one command |
| [Unattended runs](./4.workflows/2.unattended-runs.md) | `/loop` with `--autopilot`, and a whole project with `ticket-batch` |
| [Parallel sessions](./4.workflows/3.parallel-sessions.md) | Several Claude Code sessions on one project or on the base repos |
| [Other plugins](./5.other-plugins.md) | `lt-offers`, `lt-showroom` and `lt-tools` |
| [Contributing](./6.contributing.md) | Changing the plugins: secret guard, checks, release |

## Generated code is your code

The plugins write tests first, run the project's `check` script and review their own work, but none of that
replaces your review. Read every change before it is merged, ask Claude to explain what you do not understand, and
keep one session on one ticket.
