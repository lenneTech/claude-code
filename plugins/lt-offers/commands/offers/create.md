---
description: Guided workflow to create a new business offer on angebote.lenne.tech via MCP
allowed-tools: Read, Grep, Glob, Bash, Agent
---

# /offers:create — Create a New Offer

## When to Use This Command

- User wants to create a new offer/Angebot
- User has customer details and wants to build an offer interactively

## Workflow

### Step 1: Load Context

1. Call `get_offer_context` to load company knowledge and global blocks — use this information to inform content creation
2. Ask: "Gibt es zusätzliche Unterlagen oder Briefing-Dokumente für dieses Angebot?"
3. Store provided files/text as sources via `add_offer_source` or `upload_offer_source_file`

### Step 2: Gather Requirements

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
- **From scratch**: Continue to Step 3

### Step 4: Build Content Blocks

Based on the requirements, create content blocks following the structure from `${CLAUDE_SKILL_DIR}/reference/best-practices.md`.

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

### Step 6: Detect Reusable Blocks (lenne.tech Developers Only)

**Guard:** Silently run `command -v git >/dev/null 2>&1 && git config user.email 2>/dev/null | grep -q '@lenne.tech'`. If this fails (git not installed or no `@lenne.tech` email), skip this step entirely without mentioning it.

Review the created content blocks. If any block contains content that is **not customer-specific** and could be reused in future offers (e.g., company introduction, team section, standard FAQ, legal text, process description), ask:

> Dieser Inhaltsblock könnte auch in zukünftigen Angeboten wiederverwendet werden. Soll er als wiederverwendbarer Block im Repository angelegt werden?

If yes:
1. Locate the offers repository locally or clone from `https://gitlab.lenne.tech/intern/offers`
2. Create the global block in the codebase
3. Verify availability via `list_globals` MCP tool
4. Automatically replace the original inline block in the current offer with a `global-ref` block via `update_offer` — the user should not have to do this manually

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
- Link: https://angebote.lenne.tech/angebot/[slug]
- Zugangscode: [accessCode]
```
