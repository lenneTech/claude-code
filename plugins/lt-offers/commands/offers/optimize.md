---
description: Analyze and improve an existing offer — text quality, structure, missing sections
allowed-tools: Read, Grep, Glob, Bash(command -v:*), Bash(git config:*), Bash(git clone:*), Bash(git pull:*), Bash(git status:*), Agent, mcp__plugin_lt-offers_offers-api__get_offer_context, mcp__plugin_lt-offers_offers-api__list_offers, mcp__plugin_lt-offers_offers-api__get_offer, mcp__plugin_lt-offers_offers-api__create_offer, mcp__plugin_lt-offers_offers-api__update_offer, mcp__plugin_lt-offers_offers-api__list_templates, mcp__plugin_lt-offers_offers-api__create_from_template, mcp__plugin_lt-offers_offers-api__list_globals, mcp__plugin_lt-offers_offers-api__add_offer_source, mcp__plugin_lt-offers_offers-api__upload_offer_source_file, mcp__plugin_lt-offers_offers-api__mark_sent, mcp__plugin_lt-offers_offers-api__generate_snippet, mcp__plugin_lt-offers_offers-api-demo__get_offer_context, mcp__plugin_lt-offers_offers-api-demo__list_offers, mcp__plugin_lt-offers_offers-api-demo__get_offer, mcp__plugin_lt-offers_offers-api-demo__create_offer, mcp__plugin_lt-offers_offers-api-demo__update_offer, mcp__plugin_lt-offers_offers-api-demo__list_templates, mcp__plugin_lt-offers_offers-api-demo__create_from_template, mcp__plugin_lt-offers_offers-api-demo__list_globals, mcp__plugin_lt-offers_offers-api-demo__add_offer_source, mcp__plugin_lt-offers_offers-api-demo__upload_offer_source_file, mcp__plugin_lt-offers_offers-api-demo__mark_sent, mcp__plugin_lt-offers_offers-api-demo__generate_snippet
argument-hint: "[offer-id]"
disable-model-invocation: true
---

# /offers:optimize — Optimize an Existing Offer

## When to Use This Command

- User wants to improve an existing offer
- User mentions "optimieren", "verbessern", "ueberarbeiten" in context of an offer

## Related Commands

| Command | Purpose |
|---------|---------|
| `/lt-offers:offers:create` | Create a new offer from a guided interview |
| `/lt-offers:offers:optimize` | Improve an existing offer's text, structure, and completeness |
| `/lt-offers:offers:sync-schema` | Refresh content-block schemas and the NuxtUI whitelist from the API |

**Related Skills:**

| Skill | Purpose |
|-------|---------|
| `creating-offers` | Block types, offer lifecycle, and the API behind these commands |

**Workflow:** `create` → `optimize` → send

## Workflow

### Step 1: Find the Offer

Ask for the offer ID or title. Use `list_offers` if needed to find it.

### Step 2: Fetch and Analyze

Use `get_offer` to retrieve the full offer with all content blocks.

### Load Context

1. Call `get_offer_context` with the offerId
2. Include sources and knowledge in the analysis

Analyze against these quality dimensions:
1. **Structure** — Block order, missing essential sections
2. **Content quality** — Text clarity, conciseness, persuasiveness
3. **Completeness** — Customer details, pricing, CTA present?
4. **Consistency** — Tone, formatting, language (consistent du/Sie addressing)
5. **Visual variety** — Mix of block types, not just text blocks

### Step 3: Report Findings

Present a summary:
```
Analyse von "[title]":
✓ [Positive aspects]
⚠ [Areas for improvement]
✗ [Missing elements]
```

### Step 4: Suggest Improvements

Propose specific changes:
- Add missing blocks (e.g., FAQ, testimonial, CTA)
- Rewrite weak text sections
- Reorder blocks for better flow
- Add pricing details if missing

### Step 5: Detect Reusable Blocks (lenne.tech Developers Only)

**Guard:** Silently run `command -v git >/dev/null 2>&1 && git config user.email 2>/dev/null | grep -q '@lenne.tech'`. If this fails (git not installed or no `@lenne.tech` email), skip this step entirely without mentioning it.

Check existing content blocks for reuse potential. If any block contains content that is **not customer-specific** and could benefit future offers (e.g., company intro, team, standard FAQ, legal text), ask:

> Dieser Inhaltsblock könnte auch in zukünftigen Angeboten wiederverwendet werden. Soll er als wiederverwendbarer Block im Repository angelegt werden?

If yes:
1. Locate the offers repository locally or clone from `https://gitlab.lenne.tech/intern/offers`
2. Create the global block in the codebase
3. Verify availability via `list_globals` MCP tool
4. Automatically replace the original inline block in the current offer with a `global-ref` block via `update_offer` — the user should not have to do this manually

### Step 6: Apply Changes

After user approval, use `update_offer` to apply improvements.

Show a before/after comparison of the changes made.
