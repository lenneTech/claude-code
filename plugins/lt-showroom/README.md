# showroom — Claude Code Plugin

Skills, Commands, and Agents for analyzing software projects and creating showcases on [showroom.lenne.tech](https://showroom.lenne.tech) via MCP tools. Everything company-specific (company name, meeting link, knowledge base, testimonials) comes from the signed-in account, so the plugin works for any company with an account on the platform.

## Installation

In a Claude Code session:

```
/plugin marketplace add lenneTech/claude-code
/plugin install lt-showroom@lenne-tech
```

## MCP Servers

| Server | Type | Purpose |
|--------|------|---------|
| `showroom-api` | http | Showcase CRUD, screenshot upload, analytics, company context and knowledge base |

The server signs in through OAuth in the browser on first use.

### Browser automation via `lt-dev`

Screenshot capture needs a `chrome-devtools` MCP server. That server is provided by the **`lt-dev` plugin**, which this plugin relies on rather than declaring a second instance of its own.

The reason is resource cost: each declared stdio server starts its own launcher, MCP process and Node child **per session**. Two plugins declaring the same server double that chain for every open session — measurably so on machines running several sessions in parallel.

Install both plugins from the `lenne-tech` marketplace and the screenshot workflow resolves `chrome-devtools` from `lt-dev` automatically. Without `lt-dev`, showcase creation still works; only screenshot capture is unavailable.

## Your company data

The plugin carries no company data of its own. Showcases are written from what `get_showroom_context` returns for the signed-in account:

- **Company settings** — company name, logo and the meeting booking link every showcase's call to action uses
- **Knowledge base** — company, services, team and past projects; a `portfolio` entry holding customer testimonials or linking to the page that publishes them, whose quotes are copied word for word

When a showcase needs something the account lacks, the workflows ask and offer to store the answer.

## Skills

### `analyzing-projects`

Analyzes software projects across 8 dimensions: technology stack, architecture, core features, API surface, testing strategy, UI/UX patterns, security measures, and performance optimizations. Every finding is backed by a `file:line` source reference.

Activates automatically when a project analysis is requested alongside showroom keywords.

### `creating-showcases`

Creates, updates, and manages showcases on showroom.lenne.tech via MCP tools. Transforms project analysis reports into structured content blocks with technology badges, feature grids, screenshot galleries, and architecture overviews.

Activates automatically when showcase-related keywords are detected or a project carries a `SHOWCASE.md`.

## Commands

| Command | Description |
|---------|-------------|
| `/showroom:analyze [path]` | Analyze a project and produce a structured report |
| `/showroom:create [path]` | Analyze a project and create a showcase on showroom.lenne.tech |
| `/showroom:update [showcase-id]` | Re-analyze a project and update its existing showcase |
| `/showroom:screenshot [showcase-id]` | Capture and upload screenshots for a showcase |

## Agents

| Agent | Description |
|-------|-------------|
| `project-analyzer` | Deep read-only source code analysis across 8 dimensions |
| `screenshot-generator` | Full screenshot lifecycle: start, demo data, capture, upload, cleanup |

## Hooks

- **detect-analyzable-project** (`UserPromptSubmit`) — Activates when a software project is detected and showroom keywords appear in the prompt
- **post-compact-context** (`SessionStart`, matcher `compact`) — Re-injects showcase context after compaction when the project carries a `SHOWCASE.md`

## Reference

- [showroom.lenne.tech](https://showroom.lenne.tech) — The showcase platform
- [lenne.tech](https://lenne.tech) — lenne.tech GmbH
