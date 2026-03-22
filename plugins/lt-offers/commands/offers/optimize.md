---
description: Analyze and improve an existing offer — text quality, structure, missing sections
allowed-tools: Read, Grep, Glob, Bash, Agent
---

# /offers:optimize — Optimize an Existing Offer

## When to Use This Command

- User wants to improve an existing offer
- User mentions "optimieren", "verbessern", "ueberarbeiten" in context of an offer

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
