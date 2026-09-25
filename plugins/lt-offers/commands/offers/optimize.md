---
description: Analyze and improve an existing offer — text quality, structure, missing sections
allowed-tools: Read, Grep, Glob, mcp__plugin_lt-offers_offers-api__get_offer_context, mcp__plugin_lt-offers_offers-api__list_offers, mcp__plugin_lt-offers_offers-api__get_offer, mcp__plugin_lt-offers_offers-api__create_offer, mcp__plugin_lt-offers_offers-api__update_offer, mcp__plugin_lt-offers_offers-api__list_templates, mcp__plugin_lt-offers_offers-api__create_from_template, mcp__plugin_lt-offers_offers-api__list_globals, mcp__plugin_lt-offers_offers-api__list_knowledge, mcp__plugin_lt-offers_offers-api__create_knowledge, mcp__plugin_lt-offers_offers-api__add_offer_source, mcp__plugin_lt-offers_offers-api__upload_offer_source_file, mcp__plugin_lt-offers_offers-api__mark_sent, mcp__plugin_lt-offers_offers-api__generate_snippet, mcp__plugin_lt-offers_offers-api-demo__get_offer_context, mcp__plugin_lt-offers_offers-api-demo__list_offers, mcp__plugin_lt-offers_offers-api-demo__get_offer, mcp__plugin_lt-offers_offers-api-demo__create_offer, mcp__plugin_lt-offers_offers-api-demo__update_offer, mcp__plugin_lt-offers_offers-api-demo__list_templates, mcp__plugin_lt-offers_offers-api-demo__create_from_template, mcp__plugin_lt-offers_offers-api-demo__list_globals, mcp__plugin_lt-offers_offers-api-demo__list_knowledge, mcp__plugin_lt-offers_offers-api-demo__create_knowledge, mcp__plugin_lt-offers_offers-api-demo__add_offer_source, mcp__plugin_lt-offers_offers-api-demo__upload_offer_source_file, mcp__plugin_lt-offers_offers-api-demo__mark_sent, mcp__plugin_lt-offers_offers-api-demo__generate_snippet
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

**Related Skills:**

| Skill | Purpose |
|-------|---------|
| `creating-offers` | Block types, offer lifecycle, and the API behind these commands |

**Workflow:** `create` → `optimize` → send

## Workflow

### Step 1: Find the Offer

**Check for argument:** If the user provided an offer ID or title as argument (e.g., `/lt-offers:offers:optimize "Muster GmbH Angebot"`), use it directly and skip asking. Otherwise, ask for the offer ID or title. Use `list_offers` if needed to find it.

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

### Step 5: Keep Reusable Content

Check existing content blocks for reuse potential. If a block holds content that is **not customer-specific** and could benefit future offers (company intro, team, standard FAQ, legal text), and the knowledge base does not already cover it, ask:

> Dieser Inhalt ist nicht kundenspezifisch und könnte in künftigen Angeboten wiederverwendet werden. Soll ich ihn als Wissensbasis-Eintrag speichern?

If yes, store it with `create_knowledge` in the matching category (see the `creating-offers` skill, "Reusing Content Across Offers").

### Step 6: Apply Changes

After user approval, use `update_offer` to apply improvements.

Show a before/after comparison of the changes made.
