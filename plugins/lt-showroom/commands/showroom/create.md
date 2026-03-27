---
description: Read SHOWCASE.md, fetch customer feedback and web research, then create and publish a detailed showcase on showroom.lenne.tech with modern interactive content blocks
argument-hint: "[project-path]"
allowed-tools: Read, Grep, Glob, Bash(curl:*), Bash(ls:*), Bash(git:*), Bash(node:*), Bash(mkdir:*), Agent, WebFetch, WebSearch
disable-model-invocation: true
---

# /showroom:create — Create and Publish a Showcase

This command runs Phase 4 (showcase creation) and Phase 5 (presentation) of the showcase workflow. It reads `SHOWCASE.md` from the project, enriches it with customer feedback and web research, then creates a detailed showcase on showroom.lenne.tech with 8-12 modern content blocks.

## When to Use This Command

- User wants to publish a project to showroom.lenne.tech
- User has a `SHOWCASE.md` in the project and wants it turned into a live showcase
- Running after `/showroom:analyze` and optionally `/showroom:screenshot`

## Prerequisites

- `SHOWCASE.md` must exist in the project root (or `docs/showcase/SHOWCASE.md`)
- Ideally: screenshots exist in `docs/showcase/screenshots/`
- Access to showroom.lenne.tech API (MCP or REST)

## Workflow

### Step 1: Determine Project Path

If `$ARGUMENTS` is provided, use it as the project root. Otherwise, use the current working directory.

Verify that `SHOWCASE.md` exists. If not, suggest running `/showroom:analyze` first.

### Step 2: Read SHOWCASE.md

Parse the full SHOWCASE.md file:
- Extract frontmatter (version, project, technologies, category, customer)
- Extract all sections (overview, tech stack, features, architecture, highlights, results)
- Note which screenshots exist in `docs/showcase/screenshots/`

### Step 3: Fetch Customer Feedback

Use WebFetch to check for matching customer feedback:

```
WebFetch https://lenne.tech/kundenerfolge
Prompt: Extract ALL customer testimonials with: company name, person name, role, and exact quote text.
```

Match testimonials to the project using the `customer` field from SHOWCASE.md frontmatter. Check both exact company name and partial matches.

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

**Block N+3: testimonial** (if customer match found on lenne.tech/kundenerfolge)
- Customer quote, author name, company

**Block N+4: text "Ergebnis"**
- Content from SHOWCASE.md "Ergebnis" section
- 1-2 paragraphs about outcomes and impact

**Block N+5: cta**
- Button: "Termin vereinbaren"
- URL: `https://meet.brevo.com/kai-haase`
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
    "meetingUrl": "https://meet.brevo.com/kai-haase",
    "contentBlocks": [...]
  }'

# Publish
curl -s -b /tmp/showroom-cookies.txt -X POST https://api.showroom.lenne.tech/showcases/{id}/publish
```

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
