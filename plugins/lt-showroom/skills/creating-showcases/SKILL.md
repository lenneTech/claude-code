---
name: creating-showcases
description: 'Creates, updates and manages showcases and portfolio entries on the Showroom platform (showroom.lenne.tech), the source of truth: analysis and screenshots from a throwaway clone, saved idempotently through the showroom-api MCP tools as draft, internal and anonymous, texts with placeholders instead of customer names, nothing written into the project. Activates on "Showcase", "Showroom", "Portfolio-Eintrag", showroom.lenne.tech or /lt-showroom:showroom:create. NOT for a project analysis without a showcase (use analyzing-projects). NOT for developing the Showroom platform itself.'
---

# Creating Showcases on the Showroom Platform

The Showroom is the **source of truth** for a showcase: the repositories it comes from, the commit its analysis
describes, the analysis report, the screenshots and every text live there. Nothing is written into the project
repository; `~/.lt-showroom/<slug>/` is a throwaway work folder for the clone, the analysis and the screenshots on
their way into the Showroom.

## Gotchas

- **Texts never carry names.** A customer, project or contact name, a customer domain or a reference URL in a title,
  description or block is refused with `422` and the place while the customer naming is not `named`. Write the
  placeholders (see "Customer Naming") and put the real values into the fields.
- **The repository URL is the key, the slug is not.** `upsert_showcase` finds a showcase by
  `source.repositories[].url`; the slug is formed from `project.alias` and changes with it (the old one answers 404).
  Always send the repository; set a slug yourself only for a showcase without one.
- **A new showcase is a draft, internal and anonymous, and stays that way here.** Activating it, opening the clearance
  or naming the customer is the editorial team's step after review; no command of this plugin takes it.
- **Change one block, not all of them.** `get_showcase` returns the blocks as stored, each with its `id`, texts with
  their placeholders and a `global-ref` block as a reference. `upsert_block` and `remove_block` change one block;
  `contentBlocks` in `update_showcase` replaces every block, and a block sent without its `id` is a new one.
- **`category` and `industry` are keys** from fixed lists (`web-app`, `platform`, `energy` …, named in the
  `create_showcase` description); free text such as "Web App" is refused.
- **Screenshot runs stop only what they recorded** — Several Claude sessions run on one machine, so `pkill -f "nuxt dev"`, `kill` by port or a bare `docker compose down` hit other sessions' servers. Every start goes through `scripts/screenshot-session.mjs`, which records it, and `cleanup` stops exactly that; an interrupted run is cleaned by the next run of the same project or when the session ends.
- **Display order is the array order** — The page and the admin preview render `contentBlocks` as listed, while the PDF export sorts by `order`. Send the blocks in display order with `order` equal to the index, so both agree; re-number after deleting or inserting a block.

## When to Use This Skill

- User asks to create, edit, or update a showcase
- User references content blocks or showcase templates
- User mentions showroom.lenne.tech or the showroom platform
- Running `/lt-showroom:showroom:analyze`, `/lt-showroom:showroom:screenshot`, `/lt-showroom:showroom:create`, `/lt-showroom:showroom:update`

## Related Skills

- `analyzing-projects` — The evidence-based analysis report a showcase is built from and stored with

## MCP Connection

All showcase operations go through the `showroom-api` MCP server; `create` and `update` stop without it. Screenshot capture uses the `chrome-devtools` MCP server, which the `lt-dev` plugin provides — this plugin relies on that instance instead of declaring a second one, so both plugins belong in the session for screenshot workflows.

The MCP endpoint is `https://api.showroom.lenne.tech/mcp`; it signs in through OAuth in the browser on first use. The tools are for the editorial team (roles `admin`, `editor`); anyone else gets `Forbidden (403)`.

| Area | Tools |
|------|-------|
| Showcases | `list_showcases` (compact: id, slug, title, status, clearance, customerNaming, updatedAt; more through `fields`), `get_showcase` (status log and analysis only through `fields`; `view: "alias"` or `"real"` for what a viewer sees), `create_showcase`, `update_showcase`, `upsert_showcase`, `delete_showcase`, `publish_showcase` (sets `active`; editorial team only, never this plugin), `archive_showcase`, `duplicate_showcase` |
| Sources | `list_showcase_sources` (per showcase only id, slug, title, status, clearance, updatedAt and `source`) |
| Single blocks | `upsert_block`, `remove_block` |
| Links | `check_showcase_links`, `confirm_showcase_link`, `get_link_report` |
| Uploads | `create_upload_ticket` (single-use upload URL for one file) |
| Context | `get_showroom_context` (company settings, knowledge base, global blocks, optionally one showcase) |
| Knowledge base | `list_knowledge`, `get_knowledge`, `create_knowledge`, `update_knowledge`, `delete_knowledge`, `upload_knowledge_file` |
| Global blocks | `list_globals`, `get_global` |
| Selections | `list_selections`, `get_selection`, `create_selection`, `update_selection`, `revoke_selection`, `renew_selection_link` (editorial team only, never this plugin) |
| Analytics | `get_showcase_analytics`, `get_selection_analytics`, `get_dashboard_kpis` |
| Settings | `update_settings` (admins only) |
| Project candidates | `list_candidates`, `upsert_candidates`, `decide_candidate` |

The tool arguments are strict: a misspelled argument or block field is refused by name instead of dropped. `create_showcase`, `update_showcase` and `upsert_showcase` carry the block schemas and the naming rules in their own descriptions.

**Release.** A new showcase always starts as `draft`, clearance `internal` and customer naming `anonymous`; `upsert_showcase` keeps status, clearance, customer naming, customer permissions and candidate link of an existing one. The editorial team reviews a draft and decides its release in the Showroom: `publish_showcase` sets `active`, who sees it then follows its `clearance`, and the customer's name its `customerNaming`. The server refuses public with named customer naming without a recorded reference consent, and any clearance above `internal` when the customer vetoed publication. Details: `${CLAUDE_SKILL_DIR}/reference/showcase-model.md` → "Visibility".

**Everything company-specific comes from the account, not from this plugin.** `get_showroom_context` returns the company settings (name, logo, meeting booking URL), the knowledge base and the platform's global blocks. Build showcases from that context; when it lacks something the showcase needs, ask the user rather than filling the gap with assumptions. An organization can add its own conventions on top (a skill from its internal plugin, or its CLAUDE.md); where those name a source, a restriction or a rule for this company or one of its projects, follow them.

**Company settings change through `update_settings`**, once the user has confirmed the value: `companyName` (at most 200 characters), `companyLogo` (the file id of an upload, never a URL), `meetingUrl` (http or https, at most 500 characters) and `pdfEngine` (`puppeteer` or `pdf-lib`). Only the fields passed change, `null` clears one, and the answer is the new settings. The tool is for admins and needs the OAuth scope `settings:write`:
- `Forbidden (403)`: the user is no admin. Pass a missing booking link on this showcase as `meetingUrl` and leave the settings to an admin.
- `Insufficient scope (insufficient_scope)`: the connection was granted without `settings:write`. The user reconnects `showroom-api` once through `/mcp`; the consent page lists "Einstellungen ändern (nur Admins)".

**Project candidates.** The register of the project search (`list_candidates`, `upsert_candidates`, `decide_candidate`) records every project found and the decision about it. A new showcase created with `candidateId` takes over what keeps it at most as visible as the defaults: the publication veto, the audiences, a confidential clearance, the aliases and the live link; it marks the candidate showcased. A more open clearance or customer naming the candidate carries is not set: report it, and the editorial team sets it after review.

## Customer Naming

Every text is written once, with placeholders instead of names. The server fills them per viewer: the real values for
the Showroom team and where `customerNaming` allows it, the aliases for everyone else.

| Placeholder | Real value (field) | Alias (field) |
|---|---|---|
| `{{kunde}}` | `customer.name` | `customer.alias` |
| `{{kunde.kurz}}` | `customer.shortName` | `customer.alias` |
| `{{projekt}}` | `project.name` | `project.alias` |
| `{{ansprechpartner}}` | `customer.contactName` | `customer.contactAlias` (the function, e.g. "Vorstand") |
| `{{link:live}}` | the `live` entry of `links` | empty |

- Placeholders go into the title, the description and every block, a testimonial quote included. A real name, a
  customer domain (`customer.domains`) or a reference URL in a text is refused with `422` and the place; rewrite that
  place, never remove the field the check compares with.
- A placeholder needs its value: the real one always, the alias as long as the naming is not `named`.
- A testimonial is `author: "{{ansprechpartner}}"`, `role` the contact's function, `company: "{{kunde}}"`.
- An image showing the customer (logo, branding) carries `showsCustomer` (screenshots, image, gallery and video
  content, screenshot-gallery and feature-spotlight entries), the teaser `teaserShowsCustomer`; the alias view leaves
  them out.
- `get_showcase` with `view: "alias"` returns exactly what a viewer without the names sees: check it after every save.

## Reference Files

- `${CLAUDE_SKILL_DIR}/reference/showcase-model.md` — Showcase data model, source, naming fields and status lifecycle
- `${CLAUDE_SKILL_DIR}/reference/content-blocks.md` — All content block types with schemas
- `${CLAUDE_SKILL_DIR}/reference/screenshot-workflow.md` — Screenshot runs: throwaway clone, database of the run, demo data, WebP capture, fallback chain, live-system rules, cleanup
- `${CLAUDE_SKILL_DIR}/reference/best-practices.md` — Content guidelines and block structure
- `${CLAUDE_SKILL_DIR}/reference/showcase-markdown.md` — Format of the optional `SHOWCASE.md` export for the organization's own repositories

## The 4-Phase Workflow

```
Phase 1: Analysis     → throwaway clone of the default branch, report into the work folder
Phase 2: Screenshots  → clone, start with demo data, capture per feature (WebP)
Phase 3: Showcase     → upsert_showcase as a draft: fields, placeholders, source, analysis
Phase 4: Present      → modern blocks with glassmorphism, scroll-reveal, 3D-tilt
```

`/lt-showroom:showroom:update` repeats Phases 1 to 3 for the paths changed since the analyzed commit.

---

## Phase 1: Analysis

`/lt-showroom:showroom:analyze` clones the default branch into `~/.lt-showroom/<slug>/checkout` and runs the
`project-analyzer` agent with scope `showcase` (technology stack, features, pages, startup, project facts; the full
8 dimensions only with `--full`). The report, with the repository and commit it describes as `source`, goes to
`~/.lt-showroom/<slug>/analysis.json`; Phase 3 stores it as the showcase's `sourceCodeAnalysis`.

Every claim has a `file:line` evidence reference.

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

## Phase 3: Showcase in the Showroom

`/lt-showroom:showroom:create` spells this out; in short:

1. **Find it.** `list_showcase_sources` by repository URL: an existing showcase is updated, never duplicated. For a
   new one, `list_candidates` for the `candidateId`.
2. **Gather context.** `get_showroom_context`; customer testimonials from the source the organization names (read a
   references page as raw HTML, never through a summarizing fetch, see `best-practices.md` → "Customer
   Testimonials"); customer, project, references and key facts from the user; web research.
3. **Upload** the screenshots: one `create_upload_ticket` per file, then `screenshot-session.mjs upload`, which posts
   the file from disk and keeps the `fileId` in the manifest; blocks, teaser and screenshots reference the `fileId`,
   never a URL. No image content passes through the session.
4. **Build 8-12 blocks** with placeholders (Phase 4, "Customer Naming").
5. **`upsert_showcase`** with the fields, `customer`, `project`, `links`, teaser and screenshots, `source` and
   `sourceCodeAnalysis`. It answers `created` plus id, slug, status, clearance and title.
6. **Check the alias view** (`get_showcase`, `view: "alias"`).
7. **Report** the editor URL `https://showroom.lenne.tech/app/showcases/<id>`; the public URL
   `https://showroom.lenne.tech/projects/<slug>` opens without login only when the showcase is active and public.

`SHOWCASE.md` is no part of this: a `--export` writes it from the stored showcase into one of the organization's own
repositories, after asking (`${CLAUDE_SKILL_DIR}/reference/showcase-markdown.md`).

---

## Phase 4: Presentation

Use the modern content blocks the platform renders with:

**Visual design principles:**
- **Glassmorphism** — `reference` and `pricing-table` cards use a glass-style background with blur
- **Scroll-reveal** — Sections animate in as the user scrolls down
- **3D-tilt on feature cards** — `feature-grid` cards tilt slightly and glow on hover
- **Dark/light mode** — All blocks support both modes via CSS variables

**Block order (8-12 blocks):**

```
Block 1:  text "Projektübersicht" — problem, solution, result; 3-5 paragraphs
Block 2:  feature-grid            — 8 features from the report (5, 8 or 11 fill every row)
Block 3+: feature-spotlight       — one per feature: text, icon, desktop + mobile screenshot
Block N:  text "Architektur"      — module structure, patterns, data flow (scope full only)
          screenshot-gallery      — further screenshots
          testimonial             — customer feedback from the company's testimonial source
          text "Ergebnis"         — outcomes and impact
```

No `tech-stack` and no `cta` block: the public page leaves both out. Its hero shows the showcase's `technologies`
field (plain product names, so the logo lookup matches), and it ends with its own "Termin vereinbaren" button for the
booking link.

**Text quality standards** (same as best-practices.md):
- Written in German (unless project is English-only)
- Placeholders instead of every customer, project and contact name, customer domain and reference URL
- Minimum 3 paragraphs (150+ words) for overview blocks
- HTML formatted with `<h3>`, `<p>`, `<ul>/<li>`, `<strong>`
- Evidence-based — cite what the report holds (features, pages, roles; modules and endpoints with scope `full`)
- No generic marketing language

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
        "html": "<h3>Was ist {{projekt}}?</h3><p>Detailed description...</p><h3>Das Problem</h3><p>{{kunde}} ...</p><h3>Die Lösung</h3><p>...</p>"
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
        "quote": "The customer quote, verbatim, names as placeholders",
        "author": "{{ansprechpartner}}",
        "role": "Geschäftsführer",
        "company": "{{kunde}}"
      }
    }
  ]
}
```

The page shows the blocks in array order; keep `order` equal to the index, since the PDF export sorts by it.

## Draft Checklist

- [ ] Saved with `upsert_showcase`: `source.repositories` set (the key for every later run), `source.analyzedCommit` the commit the report describes, `sourceCodeAnalysis` the report
- [ ] Status `draft`, clearance and customer naming as the server set or kept them; nothing activated, nothing opened
- [ ] Title and description with placeholders; the description 2-3 sentences, plain text without HTML
- [ ] `customer` (name, short name, alias, contact with alias, domains), `project` (name, alias) and `links` filled
- [ ] Alias view (`get_showcase`, `view: "alias"`) shows no customer, contact or project name, domain or reference URL
- [ ] Key facts set as far as confirmed (`year`, `duration`, `teamSize`, `platforms`); `outcomes` only with real, publishable numbers that do not identify an anonymous customer
- [ ] `category` and `industry` as keys; `technologies` as plain product names
- [ ] At least 8 content blocks, in display order with `order` equal to the index
- [ ] Feature-grid has 8 features with evidence-based descriptions
- [ ] Customer testimonial included (if the company's testimonial source has one for this customer), with `{{ansprechpartner}}` and `{{kunde}}`
- [ ] No `cta` or `tech-stack` block
- [ ] Screenshots uploaded through upload tickets and referenced by `fileId` (feature-spotlight, screenshot-gallery, teaser, `screenshots[]`); images with customer branding marked `showsCustomer`
- [ ] `custom-html` only for a layout no block offers, files in it relative as `/files/id/<fileId>`
- [ ] The project repository is unchanged; the work folder session is cleaned up
