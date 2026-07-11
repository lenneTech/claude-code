---
name: creating-offers
description: 'Creates and edits business offers on the lenne.tech Offers platform (angebote.lenne.tech) and its demo deployment (demo-angebote.lenne.tech). Knows all 18 content block types, offer lifecycle (draft/sent/viewed/template), custom HTML with Tailwind CSS and NuxtUI components (via rich-component block), HTML embeds for click-dummies, per-offer themes and color mode, and file uploads via single-use upload tickets. Activates when working with offers, content blocks, or the Offers API. Uses MCP tools (offers-api for production, offers-api-demo for demo) for all CRUD operations.'
---

# Creating Offers on angebote.lenne.tech

This skill enables Claude Code to create, optimize, and manage business offers on the lenne.tech Offers platform via MCP tools.

## Gotchas

- **Content block `order` values must be ascending without gaps** — Gaps in the sequence (e.g., `1, 3, 5`) cause rendering glitches on the offers frontend. When deleting a block, re-normalize remaining orders; when inserting, pick the next consecutive integer. The API does not validate this — the bug only surfaces client-side.
- **`global-ref` block type is NOT listed in the standard MCP tool catalog** — It's created automatically by the `/offers:create` workflow when a block is promoted to the offers repository. Users attempting to use it directly via `create_offer` will get a schema error. The workflow guards this via the `@lenne.tech` git email check.
- **OAuth session expires silently across sessions** — The `offers-api` and `offers-api-demo` MCP OAuth cookies are tied to the current Claude session and tracked per-server. Resuming an earlier offers session (via `--resume`) often hits a 401 on the first MCP call without a clear error. Re-authenticate by running a trivial MCP tool first. The first call against `offers-api-demo` triggers its own OAuth flow even if `offers-api` is already authenticated.
- **`git config user.email` detection is fragile** — The reusable-block detection uses this to gate the lenne.tech-only flow. It fails for developers with a non-`@lenne.tech` email configured locally (CI machines, temporary clones, rebased-from-fork setups). The step silently skips in those cases, which is the intended fail-safe.
- **Template offers cannot be published — only duplicated** — Offers with `isTemplate: true` cannot be `mark_sent`. Attempting to publish a template silently returns the unchanged offer. To publish, first `create_from_template` to produce a regular offer, then send that one.

## When to Use This Skill

- User asks to create, edit, or optimize an offer/Angebot
- User references content blocks, pricing tables, or offer templates
- User mentions angebote.lenne.tech, demo-angebote.lenne.tech, or the offers platform
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

All offer operations go through one of two MCP servers — the platform ships a production and a demo deployment:

| MCP Server | URL | When to use |
|---|---|---|
| `offers-api` | `https://api.angebote.lenne.tech/mcp` | **Default.** Production — real customer-facing offers. |
| `offers-api-demo` | `https://api.demo-angebote.lenne.tech/mcp` | Demo stage — sandbox for prospect demos. Use when the user mentions "demo", "Demo-Angebot", "demo-angebote", "Demo-Stage", or "Demo-Umgebung". |

**Routing rule.** If the user prompt mentions "demo" in an offers context, route ALL tool calls in that prompt to `offers-api-demo`. Otherwise — including for ambiguous prompts — default to `offers-api` (production). The `UserPromptSubmit` hook emits a one-line stage hint that names the correct server; honor that hint.

Both connections use OAuth 2.1 with automatic browser-based login. The OAuth session is per-MCP-server, so the first call against `offers-api-demo` triggers its own browser-auth flow even if `offers-api` is already authenticated.

When working inside the offers project repository (local development), the project-level `.mcp.json` overrides `offers-api` to `http://localhost:3000/mcp` so production-flavored tool calls hit your local API. `offers-api-demo` is unaffected — still points at the deployed demo stage — which is useful for testing demo-only flows from a local dev environment.

**Available MCP Tools (identical on both servers):**
- `add_html_embed` — Upload a self-contained HTML file (base64) and create an `html-embed` content block in one atomic call (validates the HTML, ≤ 5 MB). For larger files prefer `create_upload_ticket` + HTTP upload
- `add_lottie_animation` — Upload a Lottie JSON file and create a `lottie` content block in one atomic call (validates the JSON, rejects unsupported features, ≤ 2 MB)
- `add_offer_source` — Add a source (text/link/file) to an offer
- `create_from_template` — Create offer from template
- `create_knowledge` — Create a knowledge base entry
- `create_offer` — Create new offer (returns offer + access code). Accepts an optional `theme: { enabled, light, dark }` per-offer override and an optional `colorMode: 'system' | 'light' | 'dark'` (forces the offer page into light/dark; default `system` = browser preference)
- `create_upload_ticket` — Create a single-use upload URL (valid 15 min) for uploading files via plain HTTP instead of base64 through MCP. `purpose` selects validation: `html-embed` (validated HTML, ≤ 5 MB), `image` (`image/*`, ≤ 10 MB), `file` (any, ≤ 25 MB). POST multipart form-data with field `file` to the returned `uploadUrl`; the response contains the GridFS file `id` for use as `fileId` in content blocks
- `delete_knowledge` — Delete a knowledge base entry
- `delete_offer` — Delete offer permanently
- `duplicate_offer` — Clone offer with new slug + access code (theme is carried over)
- `generate_snippet` — Generate sharing text with link + access code
- `get_default_theme` — Read the app-wide default theme that the renderer applies to offers without their own theme
- `get_global` — Get global block with versions
- `get_knowledge` — Get a knowledge base entry with full content
- `get_offer` — Get offer with all content blocks (globals auto-resolved). Returns the **effective theme** — i.e. the per-offer override when enabled, otherwise the settings default merged in transparently
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
- `set_default_theme` — Configure the app-wide default theme (light/dark hex palettes). Admin-only on the underlying SettingsService
- `update_knowledge` — Update a knowledge base entry
- `update_lottie_animation` — Replace the Lottie JSON of an existing block (keeps the block ID + position; resets first-frame snapshot)
- `update_offer` — Update offer fields and content blocks. Accepts an optional `theme` to set/clear the per-offer palette and an optional `colorMode` ('system'/'light'/'dark')
- `upload_knowledge_file` — Upload file to knowledge entry (base64)
- `upload_offer_source_file` — Upload file as offer source (base64)

## Reference Files

- `${CLAUDE_SKILL_DIR}/reference/content-blocks.md` — All 18 block types with schemas (incl. `lottie`, `html-embed`) and upload-ticket usage
- `${CLAUDE_SKILL_DIR}/reference/offer-model.md` — Offer model, status lifecycle, per-offer theme and colorMode fields
- `${CLAUDE_SKILL_DIR}/reference/knowledge-base.md` — Knowledge base schema and categories
- `${CLAUDE_SKILL_DIR}/reference/custom-html-guide.md` — HTML + Tailwind + NuxtUI guide (incl. WYSIWYG editor)
- `${CLAUDE_SKILL_DIR}/reference/theming.md` — Per-offer theme override, app-wide default theme, MCP & UI workflows
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
- **File references**: Reference existing `fileId` values, or upload new files via `create_upload_ticket` + HTTP POST (recommended), `add_html_embed` / `add_lottie_animation` (small files, base64).

## Pre-Submission Checklist

- [ ] Offer has a meaningful title
- [ ] Content blocks are properly ordered (ascending `order` from 0)
- [ ] All blocks have `visible: true` unless intentionally hidden
- [ ] Customer name/company is set if known
- [ ] `validUntil` date is set if offer has an expiration
- [ ] No duplicate block titles
- [ ] CTA block included at the end
