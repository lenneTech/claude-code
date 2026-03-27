---
name: creating-showcases
description: |
  Creates, updates, and manages showcases on the lenne.tech Showroom platform (showroom.lenne.tech).
  Implements a 5-phase workflow: (1) project analysis, (2) screenshot capture with Docker/app startup
  and demo data, (3) SHOWCASE.md creation as single source of truth in the project repository,
  (4) showcase creation via API using SHOWCASE.md + customer feedback + web research,
  (5) interactive presentation with modern content blocks. Fetches customer feedback from
  https://lenne.tech/kundenerfolge. Uses MCP tools (showroom-api) or REST API for CRUD operations.
  Activates when creating, editing, managing showcases, portfolio entries, or the Showroom platform.
  NOT for platform development on the showroom codebase itself (use generating-nest-servers or developing-lt-frontend).
effort: high
---

# Creating Showcases on showroom.lenne.tech

This skill implements a **5-phase workflow** built around SHOWCASE.md as the single source of truth. Every showcase starts from a versioned Markdown file in the project repository and is then published to showroom.lenne.tech.

## When to Use This Skill

- User asks to create, edit, or publish a showcase
- User references content blocks, tech-stack badges, or showcase templates
- User mentions showroom.lenne.tech or the showroom platform
- Working inside the showroom project repository
- Running `/lt-showroom:showroom:analyze`, `/lt-showroom:showroom:screenshot`, `/lt-showroom:showroom:create`, `/lt-showroom:showroom:update`

## Related Skills

- `analyzing-projects` — Provides the evidence-based analysis report that populates SHOWCASE.md
- `generating-nest-servers` / `developing-lt-frontend` — For platform development

## MCP Connection

All showcase operations go through the `showroom-api` MCP server. Screenshot capture uses the `chrome-devtools` MCP server.

The default MCP endpoint is `https://api.showroom.lenne.tech/mcp` (production). When working inside the showroom project repository, the project-level `.mcp.json` overrides this to `http://localhost:3000/mcp` for local development.

**If MCP is unavailable** (e.g. OAuth not configured), use the REST API directly via `curl` with session cookies:
```bash
# Login
curl -s -c /tmp/showroom-cookies.txt -X POST http://localhost:3000/iam/sign-in/email \
  -H 'Content-Type: application/json' -d '{"email":"...","password":"..."}'

# Create showcase
curl -s -b /tmp/showroom-cookies.txt -X POST http://localhost:3000/showcases \
  -H 'Content-Type: application/json' -d '{"title":"...","description":"...","contentBlocks":[...]}'

# Update showcase (add content blocks)
curl -s -b /tmp/showroom-cookies.txt -X PATCH http://localhost:3000/showcases/{id} \
  -H 'Content-Type: application/json' -d '{"contentBlocks":[...]}'

# Publish
curl -s -b /tmp/showroom-cookies.txt -X POST http://localhost:3000/showcases/{id}/publish
```

## Reference Files

- `${CLAUDE_SKILL_DIR}/reference/showcase-model.md` — Showcase data model and status lifecycle
- `${CLAUDE_SKILL_DIR}/reference/content-blocks.md` — All content block types with schemas
- `${CLAUDE_SKILL_DIR}/reference/screenshot-workflow.md` — Docker-based startup, demo data, feature screenshots
- `${CLAUDE_SKILL_DIR}/reference/best-practices.md` — Content guidelines and block structure
- `${CLAUDE_SKILL_DIR}/reference/showcase-markdown.md` — SHOWCASE.md format specification

## The 5-Phase Workflow

SHOWCASE.md is the **single source of truth**. Everything flows from this file.

```
Phase 1: Analyze      → structured report with features + pages + startup info
Phase 2: Screenshots  → start app, create demo data, capture per feature
Phase 3: SHOWCASE.md  → versioned Markdown in project repository
Phase 4: Publish      → SHOWCASE.md + feedback + research → showcase via API
Phase 5: Present      → modern blocks with glassmorphism, scroll-reveal, 3D-tilt
```

---

## Phase 1: Analysis

Run the `project-analyzer` agent (or use `analyzing-projects` skill inline) for a full 8-dimension report. The report MUST include:

- All 8 analysis dimensions (tech stack, architecture, features, API, tests, UI/UX, security, performance)
- Feature list with evidence and screenshot candidates
- `startupInfo` block (how to start the app, database requirements, seed command)
- `pagesInventory` list (all routes with auth level and associated feature)

Every claim must have a `file:line` evidence reference.

---

## Phase 2: Screenshots

### 2a. Start the Application

Check for Docker Compose first — it is the preferred startup method:

```bash
# Option A: Docker Compose (preferred)
[ -f "docker-compose.yml" ] || [ -f "compose.yaml" ] && docker compose up -d

# Option B: Standalone MongoDB if needed but not in compose
docker run -d --name showcase-mongo -p 27018:27017 mongo:7

# Option C: npm/pnpm dev server
pnpm run dev  # or npm run dev
```

Always use `run_in_background: true` for server processes. Poll for readiness before proceeding.

### 2b. Create Realistic Demo Data

1. Check for a seed script in `package.json`: `seed`, `db:seed`, `demo`, `fixtures`
2. If a seed script exists: `pnpm run seed`
3. If no seed script: use Chrome DevTools MCP to create 2-3 realistic records via the UI
   - Use realistic names, not lorem ipsum
   - Cover the primary entities of the application

### 2c. Capture Feature Screenshots

For each feature in the analysis report:
- Navigate to the page that best demonstrates the feature
- Capture desktop (1440×900) and mobile (390×844) viewports
- Save to `docs/showcase/screenshots/` in the project directory

Filename convention: `{feature-slug}-desktop.png`, `{feature-slug}-mobile.png`

```bash
# Ensure the screenshot directory exists
mkdir -p docs/showcase/screenshots
```

### 2d. Cleanup

After all screenshots are captured:
- Stop dev servers: `pkill -f "nuxt dev"` / `pkill -f "next dev"` / `pkill -f "nest start"`
- Stop Docker containers if started in this session: `docker compose down` or `docker stop showcase-mongo`
- Verify ports are free: `lsof -ti :<port>`

Full details in `${CLAUDE_SKILL_DIR}/reference/screenshot-workflow.md`.

---

## Phase 3: Create SHOWCASE.md

Write `SHOWCASE.md` in the project root (or `docs/showcase/SHOWCASE.md` for monorepos).

The file format is defined in `${CLAUDE_SKILL_DIR}/reference/showcase-markdown.md`.

**Key requirements:**
- `version` in frontmatter MUST match `package.json` version
- `analyzed_at` is the ISO date of the analysis
- Every feature section references at least one screenshot from `docs/showcase/screenshots/`
- Every feature section cites at least one code evidence reference
- The file is committed to the project repository as a permanent artifact

---

## Phase 4: Create Showcase via API

### 4a. Read SHOWCASE.md

Parse the SHOWCASE.md frontmatter and sections as the primary content source.

### 4b. Gather Additional Context

1. **Customer feedback** — WebFetch `https://lenne.tech/kundenerfolge`:
   - Extract all testimonials (name, company, role, quote)
   - Match to the project by company name
2. **Ask the user** for:
   - Live URL / landing page of the project (if publicly accessible)
   - Any additional links (app stores, documentation, press mentions)
3. **Web research** — Use WebSearch to find:
   - Public mentions of the project or customer
   - Press releases, case study posts, conference talks

### 4c. Build Content Blocks (8-12 blocks)

```
Block 1:  tech-stack         — Technology badges from SHOWCASE.md tech stack section
Block 2:  text "Überblick"   — 3-5 paragraphs from SHOWCASE.md overview section
Block 3:  feature-grid       — 6-8 features from SHOWCASE.md features section
Block 4:  text "Architektur" — From SHOWCASE.md architecture section
Block 5:  screenshot-gallery — Screenshots from docs/showcase/screenshots/
Block 6:  text "Highlights"  — From SHOWCASE.md technical highlights section
Block 7:  timeline           — Project milestones (if derivable from git or SHOWCASE.md)
Block 8:  testimonial        — Customer feedback from lenne.tech/kundenerfolge
Block 9:  team               — Team members (if known)
Block 10: text "Ergebnis"    — From SHOWCASE.md results section
Block 11: cta                — "Termin vereinbaren" + meeting URL
```

### 4d. Create and Publish

```bash
# Auth
curl -s -c /tmp/showroom-cookies.txt -X POST http://localhost:3000/iam/sign-in/email \
  -H 'Content-Type: application/json' -d '{"email":"...","password":"..."}'

# Create with all content blocks
curl -s -b /tmp/showroom-cookies.txt -X POST http://localhost:3000/showcases \
  -H 'Content-Type: application/json' -d '{ "title": "...", "description": "...", "contentBlocks": [...] }'

# Publish
curl -s -b /tmp/showroom-cookies.txt -X POST http://localhost:3000/showcases/{id}/publish
```

---

## Phase 5: Presentation

Use modern content blocks that align with lt-website-reloaded styling:

**Visual design principles:**
- **Glassmorphism** — `feature-grid` cards use glass-style background with blur
- **Scroll-reveal** — Sections animate in as the user scrolls down
- **3D-tilt on feature cards** — Subtle tilt effect on hover for `feature-grid` items
- **Dark/light mode** — All blocks support both modes via CSS variables

**Content block choices:**
- `feature-grid` for capabilities (not a plain list)
- `screenshot-gallery` with viewport switcher (desktop/tablet/mobile tabs)
- `testimonial` for social proof
- `tech-stack` with category grouping (Frontend, Backend, Database, Infrastructure)
- `timeline` for project history or phases

**Text quality standards** (same as best-practices.md):
- Written in German (unless project is English-only)
- Minimum 3 paragraphs (150+ words) for overview blocks
- HTML formatted with `<h3>`, `<p>`, `<ul>/<li>`, `<strong>`
- Evidence-based — cite module counts, endpoint counts, specific patterns
- No generic marketing language

---

## Content Block JSON Format

```json
{
  "contentBlocks": [
    {
      "type": "tech-stack",
      "title": "Technologien",
      "order": 0,
      "visible": true,
      "showInToc": true,
      "content": {
        "technologies": [
          {"name": "NestJS", "category": "backend"},
          {"name": "Nuxt", "category": "frontend"}
        ]
      }
    },
    {
      "type": "text",
      "title": "Projektübersicht",
      "order": 1,
      "visible": true,
      "showInToc": true,
      "content": {
        "html": "<h3>Was ist das Projekt?</h3><p>Detailed description...</p><h3>Das Problem</h3><p>...</p><h3>Die Lösung</h3><p>...</p>"
      }
    },
    {
      "type": "feature-grid",
      "title": "Features",
      "order": 2,
      "visible": true,
      "showInToc": true,
      "content": {
        "features": [
          {"title": "Feature Name", "description": "What it does and why it matters", "icon": "lucide:icon-name"}
        ]
      }
    },
    {
      "type": "testimonial",
      "title": "Kundenfeedback",
      "order": 7,
      "visible": true,
      "showInToc": false,
      "content": {
        "quote": "The customer quote...",
        "author": "Person Name",
        "company": "Company Name"
      }
    }
  ]
}
```

## Pre-Publication Checklist

- [ ] SHOWCASE.md exists in project repository with correct version
- [ ] Title is specific and meaningful (not generic)
- [ ] Description is 2-3 compelling sentences
- [ ] At least 8 content blocks with proper ordering
- [ ] Tech-stack block includes ALL major technologies
- [ ] Feature-grid has 6-8 features with evidence-based descriptions
- [ ] At least one text block with 3+ paragraphs (project overview)
- [ ] Customer testimonial included (if available on lenne.tech/kundenerfolge)
- [ ] Technologies array matches tech-stack block
- [ ] Tags are relevant and searchable
- [ ] All content is in German (unless project is English-only)
- [ ] Screenshots captured and saved in `docs/showcase/screenshots/`
