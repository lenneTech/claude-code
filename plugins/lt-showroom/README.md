# showroom — Claude Code Plugin

Skills, Commands, and Agents for analyzing software projects and creating showcases on [showroom.lenne.tech](https://showroom.lenne.tech) via MCP tools.

## Installation

```bash
claude plugin install lenne-tech/showroom
```

## MCP Servers

| Server | Type | Purpose |
|--------|------|---------|
| `showroom-api` | http | Showcase CRUD, screenshot upload, analytics |

### Browser automation via `lt-dev`

Screenshot capture needs a `chrome-devtools` MCP server. That server is provided by the **`lt-dev` plugin**, which this plugin relies on rather than declaring a second instance of its own.

The reason is resource cost: each declared stdio server starts its own launcher, MCP process and Node child **per session**. Two plugins declaring the same server double that chain for every open session — measurably so on machines running several sessions in parallel.

Install both plugins from the `lenne-tech` marketplace and the screenshot workflow resolves `chrome-devtools` from `lt-dev` automatically. Without `lt-dev`, showcase creation still works; only screenshot capture is unavailable.

## Skills

### `analyzing-projects`

Analyzes software projects across 8 dimensions: technology stack, architecture, core features, API surface, testing strategy, UI/UX patterns, security measures, and performance optimizations. Every finding is backed by a `file:line` source reference.

Activates automatically when a project analysis is requested alongside showroom keywords.

### `creating-showcases`

Creates, updates, and manages showcases on showroom.lenne.tech via MCP tools. Transforms project analysis reports into structured content blocks with technology badges, feature grids, screenshot galleries, and architecture overviews.

Activates automatically when working in a showroom project or when showcase-related keywords are detected.

## Commands

| Command | Description |
|---------|-------------|
| `/showroom:analyze [path]` | Analyze a project and produce a structured report |
| `/showroom:create [path]` | Analyze a project and create a showcase on showroom.lenne.tech |
| `/showroom:update [showcase-id]` | Re-analyze a project and update its existing showcase |
| `/showroom:screenshot [showcase-id]` | Capture and upload screenshots for a showcase |
| `/showroom:sync-schema` | Update reference docs from the current API and codebase |

## Agents

| Agent | Description |
|-------|-------------|
| `project-analyzer` | Deep read-only source code analysis across 8 dimensions |
| `screenshot-generator` | Full screenshot lifecycle: start, demo data, capture, upload, cleanup |

## Hooks

Two `UserPromptSubmit` hooks inject skill context automatically:

- **detect-showroom-project** — Activates when working inside the showroom platform repository
- **detect-analyzable-project** — Activates when a software project is detected and showroom keywords appear in the prompt

## Reference

- [showroom.lenne.tech](https://showroom.lenne.tech) — The showcase platform
- [lenne.tech](https://lenne.tech) — lenne.tech GmbH
