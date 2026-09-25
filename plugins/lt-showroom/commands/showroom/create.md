---
description: Read SHOWCASE.md, gather the account's company context, customer feedback and web research, then create and publish a detailed showcase on showroom.lenne.tech with modern interactive content blocks
argument-hint: "[project-path]"
allowed-tools: Read, Grep, Glob, Bash(curl:*), Bash(ls:*), Bash(git:*), Bash(node:*), Bash(mkdir:*), Agent, WebFetch, WebSearch, mcp__plugin_lt-showroom_showroom-api__*
disable-model-invocation: true
---

# /showroom:create — Create and Publish a Showcase

This command runs Phase 4 (showcase creation) and Phase 5 (presentation) of the showcase workflow. It reads `SHOWCASE.md` from the project, enriches it with the account's company context, customer feedback and web research, then creates a detailed showcase on showroom.lenne.tech with 8-12 modern content blocks.

## When to Use This Command

- User wants to publish a project to showroom.lenne.tech
- User has a `SHOWCASE.md` in the project and wants it turned into a live showcase
- Running after `/showroom:analyze` and optionally `/showroom:screenshot`

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
- Ideally: screenshots exist in `docs/showcase/screenshots/`
- An account on the Showroom platform (MCP or REST access)

## Workflow

### Step 1: Determine Project Path

If `$ARGUMENTS` is provided, use it as the project root. Otherwise, use the current working directory.

Verify that `SHOWCASE.md` exists. If not, suggest running `/showroom:analyze` first.

### Step 2: Read SHOWCASE.md

Parse the full SHOWCASE.md file:
- Extract frontmatter (version, project, technologies, category, customer)
- Extract all sections (overview, tech stack, features, architecture, highlights, results)
- Note which screenshots exist in `docs/showcase/screenshots/`

### Step 3: Load Company Context and Customer Feedback

Call `get_showroom_context`. It returns the company settings (name, logo, meeting booking URL), the knowledge base
and the platform's global blocks; write the showcase from that context.

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

Use the answers to enrich the showcase content.

### Step 5: Web Research

Use WebSearch to find public information about the project or customer:
- Search for the company name + project type
- Look for press releases, case study posts, or mentions
- Note any metrics or outcomes that can be included in the results section

### Step 6: Build Content Blocks (8-12 blocks)

Create content blocks in this order using the `creating-showcases` skill:

**Block 1: text "Projektübersicht"**
- Content from SHOWCASE.md "Überblick" section
- Minimum 3 paragraphs, HTML formatted
- Written in German

**Block 2: tech-stack**
- List all technologies from SHOWCASE.md frontmatter `technologies` list
- Group by category: Backend, Frontend, Datenbank, Infrastruktur, Sprache

**Block 3: feature-grid**
- Compact icon overview of all features (6-8 items)
- Each with title (3-5 words), description (1-2 sentences), lucide icon

**Block 4-N: custom-html "Feature X"** (one per feature)
- Detailed feature description with screenshot
- Alternate layout: even blocks have image left + text right, odd blocks have text left + image right
- Upload screenshot to GridFS, use returned fileId in `<img src='/api/files/id/{fileId}'>`

**Block N+1: text "Architektur"**
- Content from SHOWCASE.md "Architektur" section
- 2-3 paragraphs about module structure, patterns, data flow

**Block N+2: screenshot-gallery**
- Additional screenshots not tied to specific features (overview pages, mobile views)
- Upload screenshots to GridFS, store as `ScreenshotRef` objects with fileId, caption, device, order

**Block N+3: testimonial** (if the company's testimonial source has a match for this customer)
- Customer quote, author name, company

**Block N+4: text "Ergebnis"**
- Content from SHOWCASE.md "Ergebnis" section
- 1-2 paragraphs about outcomes and impact

**Block N+5: cta**
- Button: "Termin vereinbaren"
- URL: the meeting booking URL from the company settings (`get_showroom_context`); ask the user when it is empty
- Optional secondary button: "Live Demo" (if live URL was provided)

### Step 7: Upload Screenshots

For each screenshot in `docs/showcase/screenshots/`:
1. Upload via showroom API: `POST /files/upload`
2. Associate the returned `fileId` with the screenshot-gallery block
3. Tag each upload with viewport metadata (desktop/mobile)

### Step 8: Create Showcase via API

```bash
# Auth
curl -s -c /tmp/showroom-cookies.txt -X POST https://api.showroom.lenne.tech/iam/sign-in/email \
  -H 'Content-Type: application/json' -d '{"email":"...","password":"..."}'

# Create with all content blocks
curl -s -b /tmp/showroom-cookies.txt -X POST https://api.showroom.lenne.tech/showcases \
  -H 'Content-Type: application/json' -d '{
    "title": "<project name from SHOWCASE.md>",
    "description": "<2-3 sentence summary from overview>",
    "category": "<category from frontmatter>",
    "customerName": "<contact person>",
    "customerCompany": "<company from frontmatter>",
    "technologies": ["<all technologies from frontmatter>"],
    "tags": ["<relevant tags>"],
    "contentBlocks": [...]
  }'

# Publish
curl -s -b /tmp/showroom-cookies.txt -X POST https://api.showroom.lenne.tech/showcases/{id}/publish
```

`meetingUrl` is left out on purpose: the showcase then uses the booking link from the company settings. Pass it only
when this one showcase needs a different link.

### Step 9: Report Result

Display the result:

```
Showcase created and published: {title}
  ID:          {id}
  URL:         https://showroom.lenne.tech/showcase/{slug}
  Status:      published
  Blocks:      {count} content blocks
  Screenshots: {count} uploaded
  Technologies: {technologies}
```
