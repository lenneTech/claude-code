---
description: Guided workflow to create a new business offer on angebote.lenne.tech via MCP
allowed-tools: Read, Grep, Glob, mcp__plugin_lt-offers_offers-api__get_offer_context, mcp__plugin_lt-offers_offers-api__list_offers, mcp__plugin_lt-offers_offers-api__get_offer, mcp__plugin_lt-offers_offers-api__create_offer, mcp__plugin_lt-offers_offers-api__update_offer, mcp__plugin_lt-offers_offers-api__list_templates, mcp__plugin_lt-offers_offers-api__create_from_template, mcp__plugin_lt-offers_offers-api__list_globals, mcp__plugin_lt-offers_offers-api__list_knowledge, mcp__plugin_lt-offers_offers-api__create_knowledge, mcp__plugin_lt-offers_offers-api__add_offer_source, mcp__plugin_lt-offers_offers-api__upload_offer_source_file, mcp__plugin_lt-offers_offers-api__mark_sent, mcp__plugin_lt-offers_offers-api__generate_snippet, mcp__plugin_lt-offers_offers-api-demo__get_offer_context, mcp__plugin_lt-offers_offers-api-demo__list_offers, mcp__plugin_lt-offers_offers-api-demo__get_offer, mcp__plugin_lt-offers_offers-api-demo__create_offer, mcp__plugin_lt-offers_offers-api-demo__update_offer, mcp__plugin_lt-offers_offers-api-demo__list_templates, mcp__plugin_lt-offers_offers-api-demo__create_from_template, mcp__plugin_lt-offers_offers-api-demo__list_globals, mcp__plugin_lt-offers_offers-api-demo__list_knowledge, mcp__plugin_lt-offers_offers-api-demo__create_knowledge, mcp__plugin_lt-offers_offers-api-demo__add_offer_source, mcp__plugin_lt-offers_offers-api-demo__upload_offer_source_file, mcp__plugin_lt-offers_offers-api-demo__mark_sent, mcp__plugin_lt-offers_offers-api-demo__generate_snippet
argument-hint: "[customer-name-or-description]"
disable-model-invocation: true
---

# /offers:create — Create a New Offer

## When to Use This Command

- User wants to create a new offer/Angebot
- User has customer details and wants to build an offer interactively

## Related Commands

| Command | Purpose |
|---------|---------|
| `/lt-offers:offers:create` | Create a new offer from a guided interview |
| `/lt-offers:offers:optimize` | Improve an existing offer's text, structure, and completeness |

**Related Skills:**

| Skill | Purpose |
|-------|---------|
| `creating-offers` | Block types, offer lifecycle, and the API behind these commands |

**Workflow:** `create` → `optimize` → send

## Workflow

### Step 1: Load Context

1. Call `get_offer_context` to load company knowledge and global blocks — use this information to inform content creation
2. Ask: "Gibt es zusätzliche Unterlagen oder Briefing-Dokumente für dieses Angebot?"
3. Store provided files/text as sources via `add_offer_source` or `upload_offer_source_file`

### Step 2: Gather Requirements

**Check for argument:** If the user provided a customer name or description as argument (e.g., `/lt-offers:offers:create "Muster GmbH - Webseiten-Relaunch"`), use it as the customer name/company and initial description, and only ask for the remaining details below that are still missing.

Ask the user for:
- **Customer name** and **company** (required)
- **Offer title** (or suggest one based on context)
- **Addressing style** — "Soll der Kunde geduzt oder gesiezt werden?" (Default: **siezen**)
- **What is being offered** (service, product, project)
- **Budget range** (if known)
- **Timeline** (if known)
- **Special requirements** (if any)

### Step 3: Choose Approach

Check if templates exist using `list_templates` MCP tool.

If templates are available, ask:
> Soll das Angebot auf einer Vorlage basieren oder von Grund auf erstellt werden?

- **From template**: Use `create_from_template` with customer overrides
- **From scratch**: Continue to Step 4

### Step 4: Build Content Blocks

Based on the requirements, create content blocks following the structure from `${CLAUDE_PLUGIN_ROOT}/skills/creating-offers/reference/best-practices.md`.

Recommended minimum:
1. `text` — Introduction/greeting
2. Core content blocks (varies by offer type)
3. `pricing-table` — Pricing
4. `cta` — Call to action

### Step 5: Create the Offer

Use the `create_offer` MCP tool with all gathered data.

Show the user:
- Offer ID
- Access code (for sharing with customer)
- Offer URL (slug-based)

### Step 6: Keep Reusable Content

Review the created content blocks. If a block holds content that is **not customer-specific** and future offers would need again (company introduction, team section, standard FAQ, legal text, process description), and the knowledge base from Step 1 does not already cover it, ask:

> Dieser Inhalt ist nicht kundenspezifisch und könnte in künftigen Angeboten wiederverwendet werden. Soll ich ihn als Wissensbasis-Eintrag speichern?

If yes, store it with `create_knowledge` in the matching category (see the `creating-offers` skill, "Reusing Content Across Offers"). When the whole offer is a recurring kind of project, suggest keeping a copy as a template offer instead.

### Step 7: Review

Ask if the user wants to:
- Preview the content (show block summary)
- Make adjustments (`update_offer`)
- Mark as sent (`mark_sent`)
- Generate a sharing snippet (`generate_snippet`)

## Output

After creation, display:
```
Angebot erstellt:
- Titel: [title]
- ID: [id]
- Link: https://angebote.lenne.tech/angebot/[slug]   (demo instance: https://demo-angebote.lenne.tech/angebot/[slug])
- Zugangscode: [accessCode]
```
