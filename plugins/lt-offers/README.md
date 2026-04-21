# offers — Claude Code Plugin

Skills and Commands for creating and managing business offers on [angebote.lenne.tech](https://angebote.lenne.tech) via MCP tools.

## Installation

```bash
claude plugin install lenne-tech/offers
```

## MCP Servers

| Server | Type | Purpose |
|--------|------|---------|
| `offers-api` | http | Offer CRUD, content block management, templates, knowledge base, source uploads |

When working inside the offers platform repository itself, `.mcp.json` is automatically overridden to point `offers-api` at `http://localhost:3000/mcp` for local development.

## Skills

### `creating-offers`

Creates and edits business offers with 16 content block types (text, pricing-table, cta, rich-component, etc.), offer lifecycle management (draft/sent/viewed/template), and custom HTML with Tailwind CSS + NuxtUI components via `rich-component` blocks. Activates automatically when working with offers, content blocks, or the offers API.

## Commands

| Command | Description |
|---------|-------------|
| `/offers:create [customer]` | Guided workflow to create a new offer (gather requirements, build blocks, publish) |
| `/offers:optimize [offer-id]` | Analyze and improve an existing offer across 5 quality dimensions |
| `/offers:sync-schema` | Update content block schemas and NuxtUI component whitelist from the API |

All commands have `disable-model-invocation: true` set — they are user-triggered only and never auto-invoked.

## Hooks

One `UserPromptSubmit` hook injects skill context automatically:

- **detect-offers-project** — Activates when working inside the offers platform repository or when offer-related keywords appear in the prompt

One `PostCompact` hook re-injects context after conversation compaction to keep the skill discoverable across long sessions.

## Reference

- [angebote.lenne.tech](https://angebote.lenne.tech) — The offers platform
- [lenne.tech](https://lenne.tech) — lenne.tech GmbH
