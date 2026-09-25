---
name: creating-offers
description: 'Creates and edits business offers on the Offers platform (angebote.lenne.tech) and its demo instance (demo-angebote.lenne.tech), using the account''s own knowledge base for company profile, services and references. Knows all 18 content block types, offer lifecycle (draft/sent/viewed/template), custom HTML with Tailwind CSS and NuxtUI components (via rich-component block), HTML embeds for click-dummies, per-offer themes and color mode, and file uploads via single-use upload tickets. Activates when working with offers, content blocks, or the Offers API. Uses MCP tools (offers-api for production, offers-api-demo for demo) for all CRUD operations.'
---

# Creating Offers on angebote.lenne.tech

This skill enables Claude Code to create, optimize, and manage business offers on the Offers platform via MCP tools, for whichever company the signed-in account belongs to.

## Gotchas

- **Content block `order` values must be ascending without gaps** — Gaps in the sequence (e.g., `1, 3, 5`) cause rendering glitches on the offers frontend. When deleting a block, re-normalize remaining orders; when inserting, pick the next consecutive integer. The API does not validate this — the bug only surfaces client-side.
- **`global-ref` blocks point at blocks the platform provides** — `list_globals` shows which reusable blocks exist and `get_global` shows their versions. The MCP catalog has no tool to create one, so reuse your own recurring content through the knowledge base or a template offer instead (see "Reusing content across offers").
- **OAuth session expires silently across sessions** — The `offers-api` and `offers-api-demo` MCP OAuth cookies are tied to the current Claude session and tracked per-server. Resuming an earlier offers session (via `--resume`) often hits a 401 on the first MCP call without a clear error. Re-authenticate by running a trivial MCP tool first. The first call against `offers-api-demo` triggers its own OAuth flow even if `offers-api` is already authenticated.
- **Template offers cannot be published — only duplicated** — Offers with `isTemplate: true` cannot be `mark_sent`. Attempting to publish a template silently returns the unchanged offer. To publish, first `create_from_template` to produce a regular offer, then send that one.
- **Hardcoded colors in `custom-html` break in the other color mode** — A block styled with inline colors for a light page turns unreadable when the viewer flips the theme toggle: dark headings and dark body text end up on the dark page background. `colorMode: 'light'` does not prevent this — it only sets the initial preference, the toggle stays available. Every `custom-html` block must paint its own background on the outermost element whenever it sets text colors. See [`custom-html-guide.md`](./reference/custom-html-guide.md) → "Readability in both color modes".
- **`cta.text` is rendered as plain text, not HTML** — Passing `"<p>…</p>"` prints the literal tags on the offer page. The block docs list it next to HTML-bearing fields, which invites the mistake. Pass a bare sentence. `text` blocks, `custom-html` and `faq` answers are unaffected.
- **Embedded credentials in links (`https://user:pass@host`) are blocked by Chrome** — The navigation fails with `ERR_FAILED`, so a "one-click" demo link built that way is dead on arrival for most recipients. Link the plain URL and list the basic-auth credentials next to it so the browser prompt can be answered.
- **Customer quotes must be verbatim and complete** — Shortening a `testimonial` or `reference.quote` to its "relevant" part, or silently fixing a typo in it, misrepresents a real person. Copying a quote out of an older offer is not safe either: it may already be truncated there. Pull the canonical wording from the company's own published source (the knowledge base, or the references page it links to) and diff it character by character — see [`best-practices.md`](./reference/best-practices.md) → "Customer quotes are verbatim, always".
- **File fields survive an update that omits them, so a new block inherits the old block at the same position** — `update_offer` replaces the block array, but `OfferService.update()` first runs `mergeContentBlockFiles()`, which pairs stored and incoming blocks by `${order}-${type}` and then protects every file field: `imageFileId`, `fileId`, `animationFileId`, `previewFileId`, `fileIds`, `members[].imageFileId`, `files[].fileId`. Omitting the field or sending `""` means *keep what is stored* — only an explicit `null` clears it. Because the pairing is positional, a brand-new `reference` inserted where another `reference` used to sit silently adopts that block's `imageFileId`, and the offer then shows the wrong screenshot under the new project name. Whenever a block changes identity, send a real file id or `null`, never `""`. See [`content-blocks.md`](./reference/content-blocks.md) → "File fields on update".
- **A `reference` block without an image renders an empty placeholder box** — The renderer always reserves the image column and falls back to a grey box with an image icon, which reads as broken on a customer-facing page. Every `reference` needs a real `imageFileId`. When no product screenshot exists, a purpose-built diagram is a legitimate substitute; a screenshot of a *different* project is not.

## When to Use This Skill

- User asks to create, edit, or optimize an offer/Angebot
- User references content blocks, pricing tables, or offer templates
- User mentions angebote.lenne.tech, demo-angebote.lenne.tech, or the offers platform
- User wants to generate sharing snippets or manage offer status
- User asks about offer analytics, views, downloads, or statistics

## Skill Boundaries

| User Intent | Correct Skill |
|------------|---------------|
| Create/edit offers via MCP | **THIS SKILL** |
| Company profile, services, team, references for offers | **THIS SKILL** (the account's knowledge base) |

## Related Skills

**Works closely with:**
- `/lt-offers:offers:create` and `/lt-offers:offers:optimize` — the guided workflows built on this skill

## MCP Connection

All offer operations go through one of two MCP servers, the platform's production and demo instance:

| MCP Server | URL | When to use |
|---|---|---|
| `offers-api` | `https://api.angebote.lenne.tech/mcp` | **Default.** Production — real customer-facing offers. |
| `offers-api-demo` | `https://api.demo-angebote.lenne.tech/mcp` | Demo instance — for demonstrations and trials, separate from real offers. Use when the user mentions "demo", "Demo-Angebot", "demo-angebote", "Demo-Stage", or "Demo-Umgebung". |

**Routing rule.** If the user prompt mentions "demo" in an offers context, route every tool call in that prompt to `offers-api-demo`, so demo work never lands among the real customer-facing offers on production. Otherwise — including for ambiguous prompts — default to `offers-api` (production). The `UserPromptSubmit` hook emits a one-line stage hint that names the correct server; honor that hint.

Both connections use OAuth 2.1 with automatic browser-based login, and each instance has its own accounts. The OAuth session is per-MCP-server, so the first call against `offers-api-demo` triggers its own browser-auth flow even if `offers-api` is already authenticated.

**Everything company-specific comes from the account, not from this plugin.** Company profile, services, team, process, legal notes and past projects live in the account's knowledge base, and `get_offer_context` delivers them. Build offers from that context; when it lacks something the offer needs, ask the user rather than filling the gap with assumptions. An organization can add its own conventions on top (a skill from its internal plugin, or its CLAUDE.md); where those name a source or a rule for this company, follow them.

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

## Reusing Content Across Offers

Content that is **not customer-specific** belongs where every future offer can pick it up, instead of being retyped per offer. The account offers three places for it:

| Content | Where it goes | How later offers use it |
|---|---|---|
| Facts to write from: company profile, services, team, process, legal notes, past projects | Knowledge base entry (`create_knowledge`, category per [`knowledge-base.md`](./reference/knowledge-base.md)) | `get_offer_context` delivers it as context for every new offer |
| A whole offer structure for a recurring kind of project | Template offer (`isTemplate: true`) | `create_from_template` with customer overrides |
| A block the platform already provides | Existing global block (`list_globals`) | A `global-ref` block pointing at it |

During creation or optimization, watch for blocks that qualify: company introduction, standard team section, "Unser Prozess", recurring FAQ items, legal notes, blocks the user has duplicated by hand. Suggest the fitting place and create the knowledge entry or template only after the user agrees:

> Dieser Inhalt ist nicht kundenspezifisch und könnte in künftigen Angeboten wiederverwendet werden. Soll ich ihn als Wissensbasis-Eintrag (oder als Vorlage) speichern?

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

- **Language**: German, unless the user or the knowledge base asks for another language. Ask the user whether to use "du" (informal) or "Sie" (formal) for addressing the customer. Default is **siezen** (formal). Avoid direct address where possible.
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
