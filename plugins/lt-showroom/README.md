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
| `chrome-devtools` | stdio | Browser automation for screenshot capture (auto-uses Chrome Canary when installed on macOS — see below) |

### Chrome DevTools MCP — Canary auto-detection

The `chrome-devtools` MCP server is launched via `scripts/chrome-devtools-mcp-launcher.sh`. On macOS the launcher checks for Google Chrome Canary in `/Applications/`, `~/Applications/`, and via `mdfind` on the bundle identifier `com.google.Chrome.canary`. If Canary is present, it appends `--channel=canary` so the automated browser shows up with the yellow Canary icon in the window switcher and is clearly distinguishable from the developer's daily-driver Chrome. Without Canary (or on non-macOS systems) it behaves exactly like the previous static invocation — stable Chrome, no extra flags.

Override the auto-detection with the `CHROME_MCP_CHANNEL` environment variable (`stable` or `canary`).

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
