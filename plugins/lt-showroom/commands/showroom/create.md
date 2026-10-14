---
description: Read SHOWCASE.md, gather the account's company context, customer feedback and web research, then create and publish a detailed showcase on showroom.lenne.tech with modern interactive content blocks
argument-hint: "[project-path]"
allowed-tools: Read, Grep, Glob, Bash(curl:*), Bash(ls:*), Bash(git:*), Bash(node:*), Bash(mkdir:*), Agent, WebFetch, WebSearch, mcp__plugin_lt-showroom_showroom-api__*
disable-model-invocation: true
---

# /lt-showroom:showroom:create — Create and Publish a Showcase

This command runs Phase 4 (showcase creation) and Phase 5 (presentation) of the showcase workflow. It reads `SHOWCASE.md` from the project, enriches it with the account's company context, customer feedback and web research, then creates a detailed showcase on showroom.lenne.tech with 8-12 modern content blocks.

## When to Use This Command

- User wants to publish a project to showroom.lenne.tech
- User has a `SHOWCASE.md` in the project and wants it turned into a live showcase
- Running after `/lt-showroom:showroom:analyze` and optionally `/lt-showroom:showroom:screenshot`

## Related Commands

| Command | Purpose |
|---------|---------|
| `/lt-showroom:showroom:analyze` | Analyze the project and write SHOWCASE.md (start here) |
| `/lt-showroom:showroom:screenshot` | Capture feature screenshots from the running app |
| `/lt-showroom:showroom:create` | Publish the showcase to showroom.lenne.tech |
| `/lt-showroom:showroom:update` | Re-analyze after source changes and update the showcase |

**Related Skills:**

| Skill | Purpose |
|-------|---------|
| `analyzing-projects` | Deep source analysis behind `analyze` and `update` |
| `creating-showcases` | The five-phase showcase workflow this command belongs to |

**Workflow:** `analyze` → `screenshot` → `create` → (later) `update`

## Prerequisites

- `SHOWCASE.md` must exist in the project root (or `docs/showcase/SHOWCASE.md`)
- Ideally: screenshots exist in `~/.lt-showroom/<slug>/screenshots/` (from `/lt-showroom:showroom:screenshot`; `<slug>` is the output of `node "${CLAUDE_PLUGIN_ROOT}/scripts/screenshot-session.mjs" slug <project-path>`)
- An account on the Showroom platform (MCP or REST access)

## Workflow

### Step 1: Determine Project Path

If `$ARGUMENTS` is provided, use it as the project root. Otherwise, use the current working directory.

Verify that `SHOWCASE.md` exists. If not, suggest running `/lt-showroom:showroom:analyze` first.

### Step 2: Read SHOWCASE.md

Parse the full SHOWCASE.md file:
- Extract frontmatter (version, project, technologies, category, customer, and the key facts `year`, `duration`,
  `team_size`, `platforms`, `outcomes` where present)
- Extract all sections (overview, tech stack, features, architecture, highlights, results)
- Note which screenshots exist: `~/.lt-showroom/<slug>/manifest.json` lists every image; its `pendingTag` (set when only the teaser cover exists) goes into the showcase's `tags`

### Step 3: Load Company Context and Customer Feedback

Call `get_showroom_context`. It returns the company settings (name, logo, meeting booking URL), the knowledge base
and the platform's global blocks; write the showcase from that context. When a company setting is empty, ask the user
for it and offer to store it with `update_settings` (admins only; the `creating-showcases` skill covers its fields and
errors).

Then find where the company publishes its customer testimonials, in this order: the organization's own conventions
(a skill from its internal plugin, or its CLAUDE.md), a knowledge base entry in category `portfolio` that holds the
quotes or links to their page, otherwise ask the user. No source means no testimonial block.

Pull the raw HTML of the references page and read the quotes from it. A summarizing fetch (WebFetch) paraphrases
the very text that must stay verbatim, and many references pages show only a few testimonials until a "show more"
button is clicked; on pages built with Nuxt, Next or similar frameworks the payload in the raw HTML already contains
all of them.

```bash
curl -sL "<references page URL>" -o /tmp/references.html
node -e '
const raw = require("fs").readFileSync("/tmp/references.html", "utf8");
const txt = raw.replace(/\\u002F/g, "/").replace(/\\"/g, "\"").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const needle = process.argv[1];
let i = txt.indexOf(needle);
while (i !== -1) { console.log("…" + txt.slice(Math.max(0, i - 300), i + 600) + "…\n"); i = txt.indexOf(needle, i + 1); }
' "<customer name from SHOWCASE.md>"
```

Match testimonials to the project using the `customer` field from SHOWCASE.md frontmatter, trying the exact company
name and distinctive parts of it. Copy a quote character for character from this output, typos included; a quote
that cannot be found there is not used.

### Step 4: Ask the User for Additional Context

Before creating the showcase, ask:

> Before I create the showcase, a few questions:
> 1. Is there a live URL or landing page for this project? (optional)
> 2. Any additional links? (app store, documentation, press article)
> 3. Any specific aspects you want highlighted?
> 4. Who may see it: `public` (anyone), `invited` (recipients of a prospect link), `internal` (the team, default) or
>    `confidential` (the editorial team only)?
> 5. May the customer be named (`named`, `named_in_selections`, `anonymous`)? For public and named: where does the
>    customer's reference consent come from? Did the customer object to publication?
> 6. Key facts for the hero: year <year>, duration <duration>, team <n> people, platforms <list> (from SHOWCASE.md or
>    the analysis): correct? Is there a measured result that may be published, e.g. "-70 % Bearbeitungszeit"?

Use the answers to enrich the showcase content. Questions 4 and 5 decide the release in Step 8; without an answer the
showcase stays `internal` and `anonymous`. Question 6 settles the key facts: every viewer sees them, also on an
anonymous showcase, so an outcome never identifies the customer, and without a real number `outcomes` stays empty.
Write confirmed facts back into the SHOWCASE.md frontmatter.

Look the project up in the candidate register of the project search: `list_candidates` with the project or repository
name as `search`. A match goes into Step 8 as `candidateId`. When the match is `ignored`, show its `reason` and ask
before going on.

### Step 5: Web Research

Use WebSearch to find public information about the project or customer:
- Search for the company name + project type
- Look for press releases, case study posts, or mentions
- Note any metrics or outcomes that can be included in the results section

### Step 6: Upload Screenshots

The blocks reference the uploaded files by `fileId`, so upload first. For each image listed in
`~/.lt-showroom/<slug>/manifest.json`:

1. `create_upload_ticket` (one ticket per file, single use, valid 15 minutes; without MCP:
   `POST /files/upload/ticket` with a signed-in session)
2. Upload the file to the returned `uploadUrl`, with the device from the manifest:
   ```bash
   curl -s -F "file=@$HOME/.lt-showroom/<slug>/screenshots/<file>.webp" -F "device=<desktop|mobile>" "<uploadUrl>"
   ```
3. Keep the answer's `fileId` per file for the blocks; the same image uploaded again returns the same `fileId`

### Step 7: Build Content Blocks (8-12 blocks)

Create content blocks in this order using the `creating-showcases` skill (field reference:
`reference/content-blocks.md`). The array order is the display order; set `order` to the index.

**Block 1: text "Projektübersicht"**
- Content from SHOWCASE.md "Überblick" section
- Minimum 3 paragraphs, HTML formatted
- Written in German

**Block 2: feature-grid**
- Compact icon overview of all features (8 items; 5, 8 or 11 fill every row)
- Each with title (3-5 words), description (1-2 sentences), an `i-lucide-<name>` icon

**Block 3-N: custom-html, one per feature, titled with the feature name**
- Detailed feature description with screenshot
- Alternate layout: even blocks have image left + text right, odd blocks have text left + image right
- Image URL `<api-origin>/files/id/<fileId>`, where `<api-origin>` is the ticket's `uploadUrl` up to `/files/`; a
  relative `/api/...` path works only behind a local dev proxy. `best-practices.md` → "Feature-Screenshot Layout"
  has the styling rules and the PDF caveat for these URLs

**Block N+1: text "Architektur"**
- Content from SHOWCASE.md "Architektur" section
- 2-3 paragraphs about module structure, patterns, data flow

**Block N+2: screenshot-gallery**
- Additional screenshots not tied to specific features (overview pages, mobile views)
- `content.screenshots: [{ "fileId": "...", "caption": "..." }]` in display order

**Block N+3: testimonial** (if the company's testimonial source has a match for this customer)
- Customer quote (verbatim), author name, role, company

**Block N+4: text "Ergebnis"**
- Content from SHOWCASE.md "Ergebnis" section
- 1-2 paragraphs about outcomes and impact
- A live URL from Step 4 goes here as a link, or into a `reference` block's `url`

No `tech-stack` and no `cta` block: the public page leaves both out. The technologies go into the showcase's
`technologies` field (Step 8), and the page ends with its own "Termin vereinbaren" button for the booking link.

### Step 8: Create, Release and Activate

1. **Create** with `create_showcase`: `title`, `description` (2-3 sentences from the overview, plain text without
   HTML), `category`, `customerName`, `customerCompany`, `technologies` (all from the frontmatter), the confirmed key
   facts `year`, `duration`, `teamSize`, `platforms`, `outcomes`, `tags` (plus the manifest's
   `pendingTag`), `audiences` when known, `contentBlocks`, and `candidateId` when Step 4 found one. With
   `candidateId`, the answer lists `pendingPresets`: presets of the candidate a new showcase does not take on its own.
   Raise each with the user. The showcase starts as `draft`, `internal` and `anonymous`, whatever was sent.
2. **Release** with `update_showcase`, as Step 4 settled it: `clearance`, `customerNaming`, and
   `customer.referenceConsent: { "source": "..." }` for public and named, or `customer.publicationVeto: true`. The
   server refuses public with named without a consent, and anything above `internal` with a veto (`422`, reason in
   plain words).
3. **Teaser image**: MCP cannot set `teaserImageFileId`. Set it with `PATCH /showcases/{id}` (REST session as shown
   below) to the `fileId` of the overview screenshot, or leave it to the user in the Showroom editor.
4. **Activate** with `publish_showcase`. That sets the status to `active`; who sees it is decided by the clearance
   alone, so an `internal` showcase is now visible to the team, not to the public.

`meetingUrl` is left out on purpose: the showcase then uses the booking link from the company settings. Pass it only
when this one showcase needs a different link.

Without MCP, the same over REST with a session (the cookie is bound to the host it was issued for):

```bash
curl -s -c /tmp/showroom-cookies.txt -X POST https://api.showroom.lenne.tech/iam/sign-in/email \
  -H 'Content-Type: application/json' -d '{"email":"...","password":"..."}'

curl -s -b /tmp/showroom-cookies.txt -X POST https://api.showroom.lenne.tech/showcases \
  -H 'Content-Type: application/json' -d '{ "title": "...", "description": "...", "contentBlocks": [...] }'

curl -s -b /tmp/showroom-cookies.txt -X PATCH https://api.showroom.lenne.tech/showcases/{id} \
  -H 'Content-Type: application/json' \
  -d '{ "clearance": "...", "customerNaming": "...", "teaserImageFileId": "<fileId>" }'

curl -s -b /tmp/showroom-cookies.txt -X POST https://api.showroom.lenne.tech/showcases/{id}/publish
```

### Step 9: Report Result

Display the result:

```
Showcase created and activated: {title}
  ID:           {id}
  URL:          https://showroom.lenne.tech/projects/{slug}   (without login only when active and public)
  Status:       active
  Clearance:    {clearance}
  Naming:       {customerNaming}
  Blocks:       {count} content blocks
  Screenshots:  {count} uploaded
  Technologies: {technologies}
  Open presets: {pendingPresets not yet decided, if any}
```
