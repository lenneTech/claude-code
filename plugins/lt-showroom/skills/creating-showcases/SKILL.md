---
name: creating-showcases
description: |
  Creates, updates, and manages showcases on the lenne.tech Showroom platform (showroom.lenne.tech).
  Transforms project analysis reports into structured showcase content with screenshots, technology
  badges, feature descriptions, and architecture overviews. Uses MCP tools (showroom-api) for all
  CRUD operations. Activates when creating, editing, or managing showcases, portfolio entries,
  or the Showroom platform itself.
---

# Creating Showcases on showroom.lenne.tech

This skill enables Claude Code to create, optimize, and manage project showcases on the lenne.tech Showroom platform via MCP tools.

## When to Use This Skill

- User asks to create, edit, or publish a showcase
- User references content blocks, tech-stack badges, or showcase templates
- User mentions showroom.lenne.tech or the showroom platform
- Working inside the showroom project repository on content management features
- User wants to add screenshots, update technology badges, or manage showcase status
- Running `/showroom:create`, `/showroom:update`, `/showroom:screenshot`, or `/showroom:sync-schema`

## Skill Boundaries

| User Intent | Correct Skill |
|------------|---------------|
| Create/edit showcases via MCP | **THIS SKILL** |
| Analyze a project's source code | `analyzing-projects` |
| Develop the showroom platform codebase | `generating-nest-servers` / `developing-lt-frontend` |
| Deploy showroom infrastructure | `devops` |

## Related Skills

**Works closely with:**
- `analyzing-projects` — Provides the analysis report that populates showcase content
- `generating-nest-servers` — For backend development on the showroom API
- `developing-lt-frontend` — For frontend development on the showroom app

## MCP Connection

All showcase operations go through the `showroom-api` MCP server. Screenshot capture uses the `chrome-devtools` MCP server.

The default MCP endpoint is `https://api.showroom.lenne.tech/mcp` (production). When working inside the showroom project repository, the project-level `.mcp.json` overrides this to `http://localhost:3000/mcp` for local development.

**Available MCP Tools (showroom-api):**
- `create_showcase` — Create a new showcase (returns showcase + slug)
- `get_showcase` — Get showcase with all content blocks
- `update_showcase` — Update showcase fields and content blocks
- `delete_showcase` — Delete a showcase permanently
- `list_showcases` — List showcases (with optional status filter)
- `publish_showcase` — Change status from draft to published
- `unpublish_showcase` — Revert a showcase to draft
- `upload_screenshot` — Upload a screenshot file to a showcase
- `delete_screenshot` — Remove a screenshot from a showcase
- `list_screenshots` — List all screenshots for a showcase
- `get_showcase_analytics` — Get analytics (views, interactions, referrers)

## Reference Files

- `${CLAUDE_SKILL_DIR}/reference/showcase-model.md` — Showcase data model and status lifecycle
- `${CLAUDE_SKILL_DIR}/reference/content-blocks.md` — All content block types with schemas
- `${CLAUDE_SKILL_DIR}/reference/screenshot-workflow.md` — 7-phase screenshot capture workflow
- `${CLAUDE_SKILL_DIR}/reference/best-practices.md` — Content guidelines and block structure

## Core Workflow

### Creating a Showcase from Analysis

1. **Receive analysis report** — From `analyzing-projects` skill or `project-analyzer` agent
2. **Gather metadata** — Title, tagline, project URL, repository URL, client, status
3. **Build content blocks** — Map analysis dimensions to blocks (`${CLAUDE_SKILL_DIR}/reference/content-blocks.md`)
4. **Create showcase** — `create_showcase` MCP tool
5. **Add screenshots** — Optionally spawn `screenshot-generator` agent
6. **Review and publish** — `publish_showcase` when ready

### Updating a Showcase

1. **Fetch current showcase** — `get_showcase`
2. **Re-analyze codebase** — Spawn `project-analyzer` for fresh analysis
3. **Identify gaps** — Compare current content against fresh analysis
4. **Apply updates** — `update_showcase` with improved content blocks

### Recommended Content Block Structure

```
1. tech-stack           — Technology badges (auto-generated from analysis)
2. text                 — Project overview (what it does and why)
3. feature-grid         — Core features with icons (3-6 items)
4. screenshot-gallery   — Visual screenshots
5. text                 — Architecture highlights
6. text                 — Technical depth (optional)
7. cta                  — Link to live demo or repository
```

## Status Lifecycle

See `${CLAUDE_SKILL_DIR}/reference/showcase-model.md` for the full lifecycle.

- **draft** — Work in progress, not publicly visible
- **published** — Visible on showroom.lenne.tech
- **archived** — Retired, removed from public listing

## Pre-Publication Checklist

- [ ] Showcase has a meaningful title and tagline
- [ ] At least one screenshot uploaded
- [ ] Tech-stack block includes all major technologies
- [ ] Feature-grid has 3-6 items with descriptions
- [ ] Project URL or repository URL is set (if available)
- [ ] Content blocks have proper `order` values (ascending from 0)
- [ ] All blocks have `visible: true` unless intentionally hidden
