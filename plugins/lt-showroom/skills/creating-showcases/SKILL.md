---
name: creating-showcases
description: 'Creates, updates, and manages showcases on the Showroom platform (showroom.lenne.tech). Implements a 5-phase workflow: (1) project analysis, (2) screenshot capture from a throwaway clone with demo data and a fallback chain, (3) SHOWCASE.md creation as single source of truth in the project repository, (4) showcase creation via API using SHOWCASE.md + the account''s company context and customer testimonials + web research, (5) interactive presentation with modern content blocks. Uses MCP tools (showroom-api) or REST API for CRUD operations. Activates when creating, editing, managing showcases, portfolio entries, or the Showroom platform. NOT for developing the Showroom platform itself.'
---

# Creating Showcases on the Showroom Platform

This skill implements a **5-phase workflow** built around SHOWCASE.md as the single source of truth. Every showcase starts from a versioned Markdown file in the project repository and is then published to showroom.lenne.tech.

## Gotchas

- **SHOWCASE.md `version` must match `package.json` version** — A drift between the two is silently ignored by the API, but it confuses future audits and breaks automated "is the showcase current?" checks. Always `sync` the `version` field when running an update.
- **REST API cookies expire between Claude sessions** — If you fall back from MCP to direct `curl` calls, the session cookie written to `.cookies` is tied to this Claude session. On the next session's first request you'll get a 401 without a clear error. Re-authenticate before each new workflow.
- **Screenshot runs stop only what they recorded** — Several Claude sessions run on one machine, so `pkill -f "nuxt dev"`, `kill` by port or a bare `docker compose down` hit other sessions' servers. Every start goes through `scripts/screenshot-session.mjs`, which records it, and `cleanup` stops exactly that; an interrupted run is cleaned by the next run of the same project or when the session ends.
- **Display order is the array order** — The page and the admin preview render `contentBlocks` as listed, while the PDF export sorts by `order`. Send the blocks in display order with `order` equal to the index, so both agree; re-number after deleting or inserting a block.
- **An update replaces every block** — `contentBlocks` in `update_showcase` is the complete list. `get_showcase` returns `global-ref` blocks already resolved, so sending that array back stores a frozen copy; take the raw array from REST `GET /showcases/{id}` or put the `global-ref` blocks back (`reference/content-blocks.md` → "Saving and Updating Blocks").

## When to Use This Skill

- User asks to create, edit, or publish a showcase
- User references content blocks, tech-stack badges, or showcase templates
- User mentions showroom.lenne.tech or the showroom platform
- Running `/lt-showroom:showroom:analyze`, `/lt-showroom:showroom:screenshot`, `/lt-showroom:showroom:create`, `/lt-showroom:showroom:update`

## Related Skills

- `analyzing-projects` — Provides the evidence-based analysis report that populates SHOWCASE.md

## MCP Connection

All showcase operations go through the `showroom-api` MCP server. Screenshot capture uses the `chrome-devtools` MCP server, which the `lt-dev` plugin provides — this plugin relies on that instance instead of declaring a second one, so both plugins belong in the session for screenshot workflows.

The MCP endpoint is `https://api.showroom.lenne.tech/mcp`; it signs in through OAuth in the browser on first use. The tools are for the editorial team (roles `admin`, `editor`); anyone else gets `Forbidden (403)`.

| Area | Tools |
|------|-------|
| Showcases | `list_showcases`, `get_showcase`, `create_showcase`, `update_showcase`, `delete_showcase`, `publish_showcase` (sets `active`), `archive_showcase`, `duplicate_showcase` |
| Uploads | `create_upload_ticket` (single-use upload URL for one screenshot) |
| Context | `get_showroom_context` (company settings, knowledge base, global blocks, optionally one showcase) |
| Knowledge base | `list_knowledge`, `get_knowledge`, `create_knowledge`, `update_knowledge`, `delete_knowledge`, `upload_knowledge_file` |
| Global blocks | `list_globals`, `get_global` |
| Prospects | `list_prospects`, `get_prospect`, `create_prospect`, `update_prospect`, `delete_prospect` |
| Analytics | `get_showcase_analytics`, `get_prospect_analytics`, `get_dashboard_kpis` |
| Settings | `update_settings` (admins only) |
| Project candidates | `list_candidates`, `upsert_candidates`, `decide_candidate` |

The tool arguments are strict: a misspelled argument or block field is refused by name instead of dropped. `create_showcase` and `update_showcase` carry the block schemas in their own descriptions.

**Release.** A new showcase always starts as `draft`, clearance `internal` and customer naming `anonymous`. `publish_showcase` only sets the status to `active`; who sees it follows its `clearance`, and the customer's name its `customerNaming`. Open a showcase further only as the user decides it, with `update_showcase`; the server refuses public with named customer naming without a recorded reference consent, and any clearance above `internal` when the customer vetoed publication. Details: `${CLAUDE_SKILL_DIR}/reference/showcase-model.md` → "Visibility".

**Everything company-specific comes from the account, not from this plugin.** `get_showroom_context` returns the company settings (name, logo, meeting booking URL), the knowledge base and the platform's global blocks. Build showcases from that context; when it lacks something the showcase needs, ask the user rather than filling the gap with assumptions. An organization can add its own conventions on top (a skill from its internal plugin, or its CLAUDE.md); where those name a source or a rule for this company, follow them.

**Company settings change through `update_settings`**, once the user has confirmed the value: `companyName` (at most 200 characters), `companyLogo` (the file id of an upload, never a URL), `meetingUrl` (http or https, at most 500 characters) and `pdfEngine` (`puppeteer` or `pdf-lib`). Only the fields passed change, `null` clears one, and the answer is the new settings. The tool is for admins and needs the OAuth scope `settings:write`:
- `Forbidden (403)`: the user is no admin. Pass a missing booking link on this showcase as `meetingUrl` and leave the settings to an admin.
- `Insufficient scope (insufficient_scope)`: the connection was granted without `settings:write`. The user reconnects `showroom-api` once through `/mcp`; the consent page lists "Einstellungen ändern (nur Admins)".

**Project candidates.** The register of the project search (`list_candidates`, `upsert_candidates`, `decide_candidate`) records every project found and the decision about it. `create_showcase` with `candidateId` creates the showcase from that candidate: it takes over the candidate's publication veto, audiences and a confidential clearance, marks the candidate showcased, and answers `pendingPresets`, the presets (a more open clearance or customer naming, aliases, live link) still to be set. Set those with `update_showcase` only after the user has decided each one.

**If MCP is unavailable** (e.g. OAuth not configured), use the REST API directly via `curl` with session cookies. The cookie is bound to the host it was issued for, so sign in against the same API you then call:
```bash
# Login
curl -s -c /tmp/showroom-cookies.txt -X POST https://api.showroom.lenne.tech/iam/sign-in/email \
  -H 'Content-Type: application/json' -d '{"email":"...","password":"..."}'

# Create showcase
curl -s -b /tmp/showroom-cookies.txt -X POST https://api.showroom.lenne.tech/showcases \
  -H 'Content-Type: application/json' -d '{"title":"...","description":"...","contentBlocks":[...]}'

# Update showcase (contentBlocks replaces all blocks: send the complete array)
curl -s -b /tmp/showroom-cookies.txt -X PATCH https://api.showroom.lenne.tech/showcases/{id} \
  -H 'Content-Type: application/json' -d '{"contentBlocks":[...]}'

# Activate (status active; who sees it follows the clearance)
curl -s -b /tmp/showroom-cookies.txt -X POST https://api.showroom.lenne.tech/showcases/{id}/publish
```

## Reference Files

- `${CLAUDE_SKILL_DIR}/reference/showcase-model.md` — Showcase data model and status lifecycle
- `${CLAUDE_SKILL_DIR}/reference/content-blocks.md` — All content block types with schemas
- `${CLAUDE_SKILL_DIR}/reference/screenshot-workflow.md` — Screenshot runs: throwaway clone, database of the run, demo data, WebP capture, fallback chain, live-system rules, cleanup
- `${CLAUDE_SKILL_DIR}/reference/best-practices.md` — Content guidelines and block structure
- `${CLAUDE_SKILL_DIR}/reference/showcase-markdown.md` — SHOWCASE.md format specification

## The 5-Phase Workflow

SHOWCASE.md is the **single source of truth**. Everything flows from this file.

```
Phase 1: Analyze      → structured report with features + pages + startup info
Phase 2: Screenshots  → clone, start with demo data, capture per feature (WebP)
Phase 3: SHOWCASE.md  → versioned Markdown in project repository
Phase 4: Publish      → SHOWCASE.md + feedback + research → showcase via API
Phase 5: Present      → modern blocks with glassmorphism, scroll-reveal, 3D-tilt
```

---

## Phase 1: Analysis

Run the `project-analyzer` agent (or use `analyzing-projects` skill inline) for a full 8-dimension report. The report includes:

- All 8 analysis dimensions (tech stack, architecture, features, API, tests, UI/UX, security, performance)
- Feature list with evidence and screenshot candidates
- `startupInfo` block (how to start the app, database requirements, seed command)
- `pagesInventory` list (all routes with auth level and associated feature)

Every claim must have a `file:line` evidence reference.

---

## Phase 2: Screenshots

Run `/lt-showroom:showroom:screenshot` (path or repository URL). The command is slash-only, so a caller that cannot
run it (another command, such as `take-ticket` on a showcase ticket) follows its Steps 1 and 2 itself, spawns the
`lt-showroom:screenshot-generator` agent in the foreground with the Step 3 prompt, and finishes with Step 4. The agent:

1. clones the project into `~/.lt-showroom/<slug>/checkout`, so the developer's checkout, database and running stack stay untouched
2. starts it with a database of its own (`lt ticket start` for lt projects, a `showroom-<slug>` Compose project, or a dev server with a database container of the run), after proving every database URI is local
3. seeds realistic German demo data (seed script, else API, else UI), never production data
4. captures each feature with `emulate` at 1440×900 (desktop) and 390×844 @2x (mobile) as WebP viewport screenshots into `~/.lt-showroom/<slug>/screenshots/` and records them in `manifest.json`
5. falls back, when the project cannot run locally within about 45 minutes, to demo access or public pages of a live system that still matches the repository (read only, data replaced in the DOM), then older screenshots, then a teaser cover with the pending tag `screenshots-ausstehend`
6. stops exactly what it started, also after an interruption

Nothing is written into the project repository. Full procedure: `${CLAUDE_SKILL_DIR}/reference/screenshot-workflow.md`.

---

## Phase 3: Create SHOWCASE.md

Write `SHOWCASE.md` in the project root (or `docs/showcase/SHOWCASE.md` for monorepos).

The file format is defined in `${CLAUDE_SKILL_DIR}/reference/showcase-markdown.md`.

**Key requirements:**
- `version` in frontmatter matches the `package.json` version
- `analyzed_at` is the ISO date of the analysis
- Every feature section names its screenshots (`<feature-slug>-desktop.webp`, `<feature-slug>-mobile.webp` in `~/.lt-showroom/<slug>/screenshots/`)
- Every feature section cites at least one code evidence reference
- The key facts (`year`, `duration`, `team_size`, `platforms`, `outcomes`) the hero shows are in the frontmatter as far
  as they are known and confirmed; outcomes only with real, publishable numbers
- The file is committed to the project repository as a permanent artifact

---

## Phase 4: Create Showcase via API

### 4a. Read SHOWCASE.md

Parse the SHOWCASE.md frontmatter and sections as the primary content source.

### 4b. Gather Additional Context

1. **Company context** — `get_showroom_context`: company name, meeting booking URL, knowledge base, global blocks
2. **Customer feedback** — from the source the organization names for its testimonials (its conventions, or a knowledge base entry in category `portfolio` that holds the quotes or links to their page; otherwise ask the user):
   - Read a references page as raw HTML, never through a summarizing fetch (see `best-practices.md` → "Customer Testimonials")
   - Match to the project by company name; copy quotes character for character
3. **Ask the user** for:
   - Live URL / landing page of the project (if publicly accessible)
   - Any additional links (app stores, documentation, press mentions)
4. **Web research** — Use WebSearch to find:
   - Public mentions of the project or customer
   - Press releases, case study posts, conference talks

### 4c. Build Content Blocks (8-12 blocks)

```
Block 1:  text "Überblick"   — 3-5 paragraphs from SHOWCASE.md overview section
Block 2:  feature-grid       — 8 features from SHOWCASE.md features section (5, 8 or 11 fill every row)
Block 3:  text "Architektur" — From SHOWCASE.md architecture section
Block 4:  screenshot-gallery — Screenshots from ~/.lt-showroom/<slug>/screenshots/
Block 5:  text "Highlights"  — From SHOWCASE.md technical highlights section
Block 6:  timeline           — Project milestones (if derivable from git or SHOWCASE.md)
Block 7:  testimonial        — Customer feedback from the company's testimonial source
Block 8:  team               — Team members (if known)
Block 9:  text "Ergebnis"    — From SHOWCASE.md results section
```

No `tech-stack` and no `cta` block: the public page leaves both out. Its hero shows the showcase's `technologies`
field (plain product names, so the logo lookup matches), and it ends with its own "Termin vereinbaren" button for the
booking link.

### 4d. Upload, Create, Release, Activate

1. Upload the screenshots first (one `create_upload_ticket` per file); the blocks reference the returned `fileId`.
2. `create_showcase` with all content blocks, the confirmed key facts (`year`, `duration`, `teamSize`, `platforms`,
   `outcomes`), and `candidateId` when the project is in the candidate register.
3. `update_showcase` for clearance, customer naming and reference consent, as the user decided them.
4. `publish_showcase` to set the status to `active`.

`/lt-showroom:showroom:create` Steps 6 and 8 spell this out, including the REST route for `teaserImageFileId`, which
MCP cannot set.

---

## Phase 5: Presentation

Use the modern content blocks the platform renders with:

**Visual design principles:**
- **Glassmorphism** — `reference` and `pricing-table` cards use a glass-style background with blur
- **Scroll-reveal** — Sections animate in as the user scrolls down
- **3D-tilt on feature cards** — `feature-grid` cards tilt slightly and glow on hover
- **Dark/light mode** — All blocks support both modes via CSS variables

**Content block choices:**
- `feature-grid` for capabilities (not a plain list)
- `screenshot-gallery` for screenshots: one or two columns with captions and a lightbox
- `testimonial` for social proof
- `timeline` for project history or phases
- The `technologies` field, not a block, for the tech stack

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
      "type": "text",
      "title": "Projektübersicht",
      "order": 0,
      "visible": true,
      "showInToc": true,
      "content": {
        "html": "<h3>Was ist das Projekt?</h3><p>Detailed description...</p><h3>Das Problem</h3><p>...</p><h3>Die Lösung</h3><p>...</p>"
      }
    },
    {
      "type": "feature-grid",
      "title": "Features",
      "order": 1,
      "visible": true,
      "showInToc": true,
      "content": {
        "features": [
          {"title": "Feature Name", "description": "What it does and why it matters", "icon": "i-lucide-zap"}
        ]
      }
    },
    {
      "type": "testimonial",
      "title": "Kundenfeedback",
      "order": 2,
      "visible": true,
      "showInToc": false,
      "content": {
        "quote": "The customer quote, verbatim",
        "author": "Person Name",
        "role": "Geschäftsführer",
        "company": "Company Name"
      }
    }
  ]
}
```

The page shows the blocks in array order; keep `order` equal to the index, since the PDF export sorts by it.

## Pre-Publication Checklist

- [ ] SHOWCASE.md exists in project repository with correct version
- [ ] Title is specific and meaningful (not generic)
- [ ] Description is 2-3 compelling sentences, plain text without HTML
- [ ] Key facts set as far as confirmed (`year`, `duration`, `teamSize`, `platforms`); `outcomes` only with real, publishable numbers that do not identify an anonymous customer
- [ ] At least 8 content blocks, in display order with `order` equal to the index
- [ ] `technologies` field lists all major technologies, as plain product names
- [ ] Feature-grid has 8 features with evidence-based descriptions
- [ ] At least one text block with 3+ paragraphs (project overview)
- [ ] Customer testimonial included (if the company's testimonial source has one for this customer)
- [ ] No `cta` or `tech-stack` block
- [ ] Tags are relevant and searchable
- [ ] `clearance` and `customerNaming` as the user decided them; the defaults `internal` and `anonymous` otherwise
- [ ] All content is in German (unless project is English-only)
- [ ] Screenshots captured in `~/.lt-showroom/<slug>/screenshots/`: `manifest.json` lists every image; `pendingTag` is set when only the teaser cover exists
