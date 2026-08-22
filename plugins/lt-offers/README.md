# offers — Claude Code Plugin

Skills and Commands for creating and managing business offers on [angebote.lenne.tech](https://angebote.lenne.tech) via MCP tools.

## Installation

```bash
claude plugin install lenne-tech/offers
```

## MCP Servers

| Server | Type | Purpose |
|--------|------|---------|
| `offers-api` | http | Offer CRUD, content block management, templates, knowledge base, source uploads (production, default) |
| `offers-api-demo` | http | Same operations as `offers-api`, routed to the demo stage (`api.demo-angebote.lenne.tech`) |

When working inside the offers platform repository itself, `.mcp.json` is automatically overridden to point `offers-api` at `http://localhost:3000/mcp` for local development.

**Stage routing:** `/offers:create` and `/offers:optimize` are granted tools on both `offers-api` and `offers-api-demo`. The `detect-offers-project` hook decides which one a prompt should use: any explicit mention of "demo" (whole-word, so "Demonstrations-Angebot" doesn't false-positive) routes to `offers-api-demo`; everything else defaults to the production `offers-api`.

### NuxtUI component reference via `lt-dev`

`/offers:sync-schema` queries the NuxtUI component whitelist through the `nuxt-ui-remote` MCP server. That server is provided by the **`lt-dev` plugin**, which this plugin relies on rather than declaring a second instance of its own.

The reason is resource cost: each declared stdio server starts its own launcher, MCP process and Node child **per session**. Two plugins declaring the same server double that chain for every open session — measurably so on machines running several sessions in parallel.

Install both plugins from the `lenne-tech` marketplace and `/offers:sync-schema` resolves `nuxt-ui-remote` from `lt-dev` automatically. Without `lt-dev`, the command still works; it falls back to reading the renderer source directly (`BlockRichComponentRenderer.vue`) instead of querying the live component list.

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
