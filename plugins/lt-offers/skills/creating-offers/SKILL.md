---
name: creating-offers
description: |
  Creates and edits business offers on the lenne.tech Offers platform (angebote.lenne.tech).
  Knows all 16 content block types, offer lifecycle (draft/sent/viewed/template), custom HTML with
  Tailwind CSS and NuxtUI components (via rich-component block). Activates when working with offers,
  content blocks, or the Offers API. Uses MCP tools (offers-api) for all CRUD operations.
---

# Creating Offers on angebote.lenne.tech

This skill enables Claude Code to create, optimize, and manage business offers on the lenne.tech Offers platform via MCP tools.

## When to Use This Skill

- User asks to create, edit, or optimize an offer/Angebot
- User references content blocks, pricing tables, or offer templates
- User mentions angebote.lenne.tech or the offers platform
- Working inside the offers project repository
- User wants to generate sharing snippets or manage offer status
- User asks about offer analytics, views, downloads, or statistics

## Skill Boundaries

| User Intent | Correct Skill |
|------------|---------------|
| Create/edit offers via MCP | **THIS SKILL** |
| Develop the offers codebase (API/Frontend) | `generating-nest-servers` / `developing-lt-frontend` |
| Deploy offers infrastructure | `devops` |

## Related Skills

**Works closely with:**
- `generating-nest-servers` — For backend development on the offers API
- `developing-lt-frontend` — For frontend development on the offers app

## MCP Connection

All offer operations go through the `offers-api` MCP server. The connection uses OAuth 2.1 with automatic browser-based login. No API keys or tokens needed.

The default MCP endpoint is `https://api.angebote.lenne.tech/mcp` (production). When working inside the offers project repository, the project-level `.mcp.json` overrides this to `http://localhost:3000/mcp` for local development.

**Available MCP Tools:**
- `add_offer_source` — Add a source (text/link/file) to an offer
- `create_from_template` — Create offer from template
- `create_knowledge` — Create a knowledge base entry
- `create_offer` — Create new offer (returns offer + access code)
- `delete_knowledge` — Delete a knowledge base entry
- `delete_offer` — Delete offer permanently
- `duplicate_offer` — Clone offer with new slug + access code
- `generate_snippet` — Generate sharing text with link + access code
- `get_global` — Get global block with versions
- `get_knowledge` — Get a knowledge base entry with full content
- `get_offer` — Get offer with all content blocks (globals auto-resolved)
- `get_offer_analytics` — Get offer analytics (views, downloads, scroll depth, dwell time)
- `get_offer_context` — Get full AI context (knowledge + globals + optional offer/sources)
- `get_offer_sources` — Get all sources for an offer
- `list_globals` — List reusable global content blocks
- `list_knowledge` — List knowledge base entries
- `list_offers` — List offers (with optional status filter)
- `list_templates` — List template offers
- `mark_draft` — Reset to draft (sent → draft)
- `mark_sent` — Mark offer as sent (draft → sent)
- `remove_offer_source` — Remove a source from an offer
- `update_knowledge` — Update a knowledge base entry
- `update_offer` — Update offer fields and content blocks
- `upload_knowledge_file` — Upload file to knowledge entry (base64)
- `upload_offer_source_file` — Upload file as offer source (base64)

## Reference Files

- `${CLAUDE_SKILL_DIR}/reference/content-blocks.md` — All 16 block types with schemas
- `${CLAUDE_SKILL_DIR}/reference/offer-model.md` — Offer model and status lifecycle
- `${CLAUDE_SKILL_DIR}/reference/knowledge-base.md` — Knowledge base schema and categories
- `${CLAUDE_SKILL_DIR}/reference/custom-html-guide.md` — HTML + Tailwind + NuxtUI guide
- `${CLAUDE_SKILL_DIR}/reference/best-practices.md` — Content structure and examples

## Core Workflow

### Creating an Offer

1. **Load context** — `get_offer_context` → Company knowledge + global blocks
2. **Gather requirements** — Title, customer, content, approach
3. **Additional materials?** — Ask if there are briefing docs/notes
4. **Store sources** — Via `add_offer_source` / `upload_offer_source_file`
5. **Choose approach** — From template or new
6. **Build content blocks** — Based on knowledge + sources + briefing
7. **Create offer** — `create_offer`
8. **Review and refine** — `get_offer` / `update_offer`
9. **Share** — `mark_sent` → `generate_snippet`

### Optimizing an Offer

1. **Fetch the offer** — `get_offer` with the offer ID
2. **Analyze content** — Check structure, completeness, persuasiveness
3. **Suggest improvements** — Better block order, missing sections, text quality
4. **Apply changes** — `update_offer` with improved content blocks

## Reusable Global Blocks (lenne.tech Developers Only)

This feature is **exclusively for lenne.tech developers**. Before evaluating reusable blocks, silently run `git config user.email` and check if the result contains `@lenne.tech`. If not, **skip this entire section without any mention** — the user must not see any hint of this feature.

### Detection Logic

```bash
command -v git >/dev/null 2>&1 && git config user.email 2>/dev/null | grep -q '@lenne.tech'
```

- git not installed → skip silently
- git installed but no `@lenne.tech` email → skip silently
- git installed and `@lenne.tech` email → proceed with reusable block evaluation

### When Detected as lenne.tech Developer

During offer creation or optimization, evaluate whether any content block could be useful across multiple offers (e.g., company introduction, standard team section, recurring FAQ, legal disclaimers, standard CTA). If so:

1. **Ask the user**: "Dieser Inhaltsblock könnte auch in zukünftigen Angeboten wiederverwendet werden. Soll er als wiederverwendbarer Block im Repository angelegt werden?"
2. **If yes**, locate or clone the offers repository and create the global block there
3. Verify availability via `list_globals` MCP tool
4. **Automatically replace** the original inline block in the current offer with a `global-ref` block pointing to the new global ID via `update_offer`

### Repository Access

The offers platform repository is hosted at: `https://gitlab.lenne.tech/intern/offers`

**Workflow:**
1. Check if the repo is already cloned locally (search common paths: `~/code/lenneTech/offers`, `~/projects/offers`, or use `find` / `locate`)
2. If not found, ask the user if they want to clone it: `git clone https://gitlab.lenne.tech/intern/offers`
3. Use `generating-nest-servers` / `developing-lt-frontend` skills for codebase changes

### When to Suggest a Global Block

- Content that is **not customer-specific** (company info, team, legal, processes)
- Blocks that have been **manually duplicated** across offers
- Standardized sections like "Über uns", "Unser Prozess", "AGB-Hinweis"
- Recurring FAQ items that apply to most offers

## Analyzing Offer Performance

Use `get_offer_analytics` to check how an offer performs. In Claude Desktop, an interactive dashboard with KPI cards, charts, and download stats renders directly in the chat.

### Analytics Workflow

1. **Check performance** — `get_offer_analytics` with the offer ID
2. **Interpret metrics** — Views, scroll depth, dwell time, PDF/attachment downloads
3. **Suggest improvements** — Low scroll depth → restructure content; no downloads → better CTA placement
4. **Apply changes** — `update_offer` with optimized blocks

### Key Metrics

| Metric | Interpretation |
|--------|---------------|
| `totalViews` | How many times the offer was opened |
| `avgScrollDepth` | How far customers scroll (< 50% = content needs restructuring) |
| `avgTimeOnPage` | Engagement level (< 30s = not reading, > 5min = very engaged) |
| `pdfDownloadCount` | PDF saves (high = serious interest) |
| `attachmentDownloads` | Per-file download tracking |
| `timeToFirstViewHours` | Response time after sharing |

## Content Guidelines

- **Language**: Always German. Ask the user whether to use "du" (informal) or "Sie" (formal) for addressing the customer. Default is **siezen** (formal). Avoid direct address where possible.
- **Structure**: Start with greeting/intro, then main content, end with CTA
- **Block order**: text → image/video → pricing-table → testimonial/reference → cta
- **Pricing**: Always use `pricing-table` block for prices, not inline text
- **File references**: For v1, reference existing `fileId` values. No file upload via MCP yet.

## Pre-Submission Checklist

- [ ] Offer has a meaningful title
- [ ] Content blocks are properly ordered (ascending `order` from 0)
- [ ] All blocks have `visible: true` unless intentionally hidden
- [ ] Customer name/company is set if known
- [ ] `validUntil` date is set if offer has an expiration
- [ ] No duplicate block titles
- [ ] CTA block included at the end
