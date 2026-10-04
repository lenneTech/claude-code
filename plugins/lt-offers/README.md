# offers — Claude Code Plugin

Skills and Commands for creating and managing business offers on [angebote.lenne.tech](https://angebote.lenne.tech) and concept folders (Konzeptmappen) on konzept.lenne.tech via MCP tools. Everything company-specific (profile, services, team, references) comes from the signed-in account's knowledge base, so the plugin works for any company with an account on the platform.

## Installation

In a Claude Code session:

```
/plugin marketplace add lenneTech/claude-code
/plugin install lt-offers@lenne-tech
```

## MCP Servers

| Server | Type | Purpose |
|--------|------|---------|
| `offers-api` | http | Offer and concept-folder CRUD, content block management, templates, knowledge base, source uploads (production, default) |
| `offers-api-demo` | http | Same operations as `offers-api` on the platform's demo instance (`api.demo-angebote.lenne.tech`), which has its own accounts |

Both servers sign in through OAuth in the browser on first use.

**Stage routing:** `/lt-offers:offers:create` and `/lt-offers:offers:optimize` are granted tools on both `offers-api` and `offers-api-demo`. The `detect-offers-project` hook decides which one a prompt should use: any explicit mention of "demo" (whole-word, so "Demonstrations-Angebot" doesn't false-positive) routes to `offers-api-demo`; everything else defaults to the production `offers-api`. `/lt-offers:offers:concept` is granted the same tools and follows the same routing.

## Your company data

The plugin carries no company data of its own. Offers are written from the account's knowledge base (`get_offer_context`):

- **Company, services, team, process, legal** — one knowledge entry per topic, in the matching category
- **References and testimonials** — a `portfolio` entry holding the quotes or linking to the page that publishes them; quotes are copied from that source word for word
- **Recurring offer structures** — template offers, used via `create_from_template`

When an offer needs something the knowledge base lacks, the workflows ask and offer to store the answer, so the next offer has it.

## Skills

### `creating-offers`

Creates and edits business offers with all content block types (text, pricing-table, cta, rich-component, etc.), offer lifecycle management (draft/sent/viewed/template), and custom HTML with Tailwind CSS + NuxtUI components via `rich-component` blocks. Activates automatically when working with offers, content blocks, or the offers API.

### `creating-concepts`

Creates concept folders (Konzeptmappen): protected, designed documents that hand workshop results to a customer under konzept.lenne.tech. Turns workshop notes, transcripts and whiteboard photos into sources, proposes an outline, builds blocks and theme, links the folder to the offer it is based on, and keeps internal notes in sources, never in a block. Shares the block, theme and custom-HTML references of `creating-offers`.

## Commands

| Command | Description |
|---------|-------------|
| `/lt-offers:offers:create [customer]` | Guided workflow to create a new offer (gather requirements, build blocks, publish) |
| `/lt-offers:offers:concept [customer-or-topic]` | Guided workflow to create a concept folder from workshop material (linked offer, sources, outline, blocks, sharing text) |
| `/lt-offers:offers:optimize [offer-or-concept-id]` | Analyze and improve an existing offer or concept folder across 5 quality dimensions |

All commands have `disable-model-invocation: true` set — they are user-triggered only and never auto-invoked.

## Hooks

One `UserPromptSubmit` hook injects skill context automatically:

- **detect-offers-project** — Activates when offer-related keywords or a concept folder („Konzeptmappe", konzept.lenne.tech) appear in the prompt, names the matching skill, and names the MCP server (production or demo) the prompt should use. „Konzept" alone does not fire

## Reference

- [angebote.lenne.tech](https://angebote.lenne.tech) — The offers platform
- [lenne.tech](https://lenne.tech) — lenne.tech GmbH
