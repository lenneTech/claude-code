# Best Practices for Showcase Content

## The Showroom Is the Source of Truth

Everything a showcase is made of lives in the Showroom: the texts and blocks, the repositories it comes from, the
commit its analysis describes (`source`), the analysis report (`sourceCodeAnalysis`) and the screenshots. The project
repository stays untouched, a customer's above all; `~/.lt-showroom/<slug>/` only holds what is on its way in.

- Find before you create: `upsert_showcase` with the repository updates the showcase it already is
- Edit the stored showcase, not a copy of it: `get_showcase`, then `upsert_block` or `update_showcase`
- A `SHOWCASE.md` exists only as an export into the organization's own repositories (`--export`), written from the
  stored showcase

## Language and Tone

- **German by default** — All showcase content in German (target audience: German-speaking prospects)
- **Factual and specific** — Describe what the project does, backed by evidence from code analysis
- **Developer-friendly** — Use proper framework/library names; assume a semi-technical audience
- **No marketing fluff** — Avoid "cutting-edge", "revolutionary" — describe actual capabilities
- **"Du" or neutral** — No formal "Sie" address; prefer neutral formulations or "du" where direct address is needed

## Content Depth Requirements

### Text Blocks (Minimum Quality)

- **Project overview**: 3-5 paragraphs, 200+ words. Cover: What is the project? What problem does it solve? Who uses it? What makes it special? Cite concrete numbers from the analysis.
- **Architecture overview** (only with a report of scope `full`): 2-3 paragraphs. Cover: Module structure, key patterns, data flow, deployment architecture
- **Technical highlights**: 2-3 paragraphs. Cover: What makes this project technically interesting? Novel solutions, scale, integrations
- **Results/Impact**: 1-2 paragraphs. Concrete outcomes, metrics, user adoption (if available)

### Feature-Grid (Minimum 6 Items)

Each feature is:
- Derived from actual code analysis (not assumed)
- Present in the analysis report with a `file:line` evidence reference
- Title: 3-5 words, action-oriented ("Echtzeit-Matching" not "Matching-Funktion")
- Description: 1-2 specific sentences explaining what it does and how
- Icon: an Iconify name from the Lucide set (`i-lucide-zap`, `i-lucide-shield-check`, `i-lucide-database`)
- Count: with more than two features the first two render large and the rest in rows of three, so 8 (or 11) fill
  every row

### Technologies

- Set them as the showcase's `technologies` field: the page hero shows the field with logos, the section "Technik &
  Architektur" groups it by layer, and the PDF header shows it as tags. A `tech-stack` block adds categories and
  descriptions to that section (its entries replace the grouping) and renders no section of its own
- Include all significant technologies from `package.json` / manifest files
- Only list technologies the analysis report found in a manifest
- Write the plain product name (`NestJS`, `Nuxt`, `MongoDB`): the hero finds a logo by the exact name, so `NestJS 11`
  shows a letter placeholder. Versions belong in the text blocks

### Screenshots

- Minimum 1 screenshot per feature (desktop viewport required, mobile optional)
- Screenshots must show the running application with realistic demo data
- Never use empty states or placeholder screens
- All screenshots in `~/.lt-showroom/<slug>/screenshots/`, never in the project repository
- Naming: `{feature-slug}-desktop.webp`, `{feature-slug}-mobile.webp`

## Customer Testimonials

Customer quotes come from wherever the company publishes its testimonials, found in this order:

1. **The organization's own conventions** — a skill from its internal plugin or its CLAUDE.md naming the references
   page.
2. **The knowledge base** — an entry in category `portfolio` that holds the quotes or links to the page publishing
   them (`get_showroom_context`, `list_knowledge`).
3. **The user** — when neither names a source, ask for it, and offer to store its link as a `portfolio` entry so later
   showcases find it.

Read a references page as raw HTML with `curl`, as `/lt-showroom:showroom:create` Step 5 shows. A summarizing fetch paraphrases
quotes, and many references pages reveal only a few testimonials until a "show more" button is clicked; on pages built
with Nuxt, Next or similar frameworks the embedded payload in the raw HTML usually holds all of them verbatim.

That source is the only source for names, roles and quotes; this file keeps no copy of them, so nothing here can go
stale or misquote a customer. A quote whose published original cannot be found is not used.

Match by the customer's name (`customer.name`). In the block the contact becomes `{{ansprechpartner}}` with the
function as `role`, the company `{{kunde}}`, and a name inside the quote its placeholder: the quote stays verbatim for
the Showroom team, and a viewer without the names reads the aliases (`SKILL.md` → "Customer Naming").

## Recommended Block Structure

The page frames the blocks on its own: the hero shows title, description, teaser image, the key facts (`year`,
`duration`, `teamSize`, `platforms`, `outcomes`) and the `technologies` field, and the page ends with "Interesse geweckt?" and a "Termin vereinbaren" button to the booking link (the showcase's
`meetingUrl`, otherwise the company setting), with the section "Technik & Architektur" before it. The public page
renders no `cta` block and no `tech-stack` block of its own, so none of the structures below has one.

### Standard Showcase (8-14 blocks)

```
1.   text "Überblick"         — 3-5 paragraphs: What, Why, Who, How
2.   feature-grid "Features"  — Compact icon overview of all features (6-8 items)
3.   feature-spotlight <Feature 1>  — Description, icon, desktop + mobile screenshot
4.   feature-spotlight <Feature 2>  — The page alternates the image side by itself
     ... (one feature-spotlight per feature with screenshots)
N-3. text "Architektur"       — Module structure, patterns, data flow (scope full only)
N-2. screenshot-gallery       — Additional screenshots not tied to specific features
N-1. testimonial              — Customer feedback (if available)
N.   text "Ergebnis"          — Impact, metrics, adoption
```

The `feature-grid` gives visitors a quick scannable overview of all capabilities with icons. Each feature is then presented in detail via a `feature-spotlight` block with its screenshots. The `screenshot-gallery` at the end collects any additional screenshots (e.g., overview pages, mobile views) that are not tied to a specific feature.

### Library/Framework Showcase

The API and architecture blocks below need those parts of the report: analyze with scope `full`
(`/lt-showroom:showroom:analyze --full`) before `create`, which then reuses that report. The same holds for the
backend-only structure.

```
1.  text "Überblick"    — What the library does, why it exists
2.  feature-grid        — 6-8 core capabilities
3.  text "API"          — Key API surface, usage examples
4.  text "Architektur"  — Internal architecture, extension points
5.  text "Ecosystem"    — Integration with other tools, community
```

### Backend-Only Showcase (no UI)

```
1.  text "Überblick"
2.  feature-grid
3.  text "API-Design"   — Endpoints, data models, authentication
4.  text "Architektur"
5.  testimonial
```

Optional blocks where the material exists: `timeline` (project phases), `team`, `faq`, `video`, `reference` (a link
to the live product or a related project).

## Content Block JSON Examples

`order` is the block's index in the `contentBlocks` array (here: overview first, feature grid second).

### Text Block (HTML formatted)
```json
{
  "type": "text",
  "title": "Projektübersicht",
  "order": 0,
  "visible": true,
  "showInToc": true,
  "content": {
    "html": "<h3>Was ist Musterportal?</h3><p>Musterportal ist ein KI-gestütztes Vernetzungs-Netzwerk für eine Beispielregion. Die Plattform bringt Unternehmen, Institutionen und Fachkräfte zusammen — basierend auf semantischem Matching statt einfacher Keyword-Suche.</p><h3>Das Problem</h3><p>Regionale Vernetzung scheitert oft daran, dass die richtigen Partner sich nicht finden. Klassische Plattformen verlassen sich auf manuelle Kategorisierung oder einfache Textsuche, die relevante Verbindungen übersieht.</p><h3>Die Lösung</h3><p>Musterportal nutzt eine Vektor-Datenbank (Qdrant) und einen Python-NLP-Microservice, um Nutzerprofile semantisch zu analysieren. Deutsche Komposita werden zerlegt, Fachbegriffe extrahiert und in hochdimensionale Vektoren umgewandelt. Das Ergebnis: Matches basieren auf inhaltlicher Ähnlichkeit, nicht auf identischen Schlagwörtern.</p>"
  }
}
```

`text` keeps only basic formatting: `p`, `br`, `strong`, `em`, `u`, lists, `h2`-`h4`, links, `blockquote`, `span`.
Images, tables and inline styles need `custom-html`. A `<strong>` that starts with a number and one or two words
(`<strong>40+ Module</strong>`) renders the number large in the accent color, a good fit for key figures.

### Feature-Grid Block
```json
{
  "type": "feature-grid",
  "title": "Features",
  "order": 1,
  "visible": true,
  "showInToc": true,
  "content": {
    "features": [
      {"title": "KI-Vektor-Matching", "description": "Semantisches Profil-Matching über Qdrant-Vektordatenbank — findet relevante Verbindungen jenseits einfacher Keyword-Suche.", "icon": "i-lucide-brain"},
      {"title": "Deutsches NLP", "description": "spaCy-basierte Substantiv-Extraktion und Komposita-Splitting für präzise Analyse deutscher Fachtexte.", "icon": "i-lucide-languages"},
      {"title": "Echtzeit-Chat", "description": "GraphQL-Subscriptions ermöglichen sofortige Kommunikation zwischen vernetzten Partnern.", "icon": "i-lucide-message-circle"},
      {"title": "Veranstaltungskalender", "description": "Regionale Events entdecken, erstellen und teilen — öffentlich zugänglich ohne Registrierung.", "icon": "i-lucide-calendar-days"},
      {"title": "Push-Benachrichtigungen", "description": "Web-Push-Notifications für neue Matches, Nachrichten und relevante Veranstaltungen.", "icon": "i-lucide-bell-ring"},
      {"title": "Sentry-Monitoring", "description": "Client- und serverseitige Fehlerüberwachung für hohe Verfügbarkeit und schnelle Problemlösung.", "icon": "i-lucide-activity"},
      {"title": "Rollen und Rechte", "description": "Getrennte Sichten für Unternehmen, Institutionen und Fachkräfte, serverseitig geprüft.", "icon": "i-lucide-shield-check"},
      {"title": "Semantische Suche", "description": "Freitextsuche über Profile und Events, sortiert nach inhaltlicher Nähe statt Stichworttreffern.", "icon": "i-lucide-search"}
    ]
  }
}
```

### Testimonial Block
```json
{
  "type": "testimonial",
  "title": "Kundenfeedback",
  "order": 9,
  "visible": true,
  "showInToc": false,
  "content": {
    "quote": "<the quote, copied character for character from the raw HTML of the company's references page>",
    "author": "Max Mustermann",
    "role": "Geschäftsführer",
    "company": "Beispielkunde"
  }
}
```

`role` and `company` are optional; the page shows them below the name as `role · company`.

## Feature Sections (feature-spotlight)

Present each feature with screenshots in a `feature-spotlight` block: the block title is the heading, the text and an
icon sit beside the images, the first desktop and the first mobile screenshot are shown together, and consecutive
spotlights alternate the image side by themselves. Images go by `fileId`, so they work on the page, in the PDF and in
the anonymous view (an image with `showsCustomer` is left out there).

```json
{
  "type": "feature-spotlight",
  "title": "Echtzeit-Matching",
  "order": 2,
  "visible": true,
  "showInToc": false,
  "content": {
    "html": "<p>{{projekt}} schlägt passende Partner in Sekunden vor, mit Trefferquote je Kriterium.</p>",
    "icon": "i-lucide-target",
    "screenshots": [
      { "fileId": "<fileId desktop>", "device": "desktop", "caption": "Matching-Vorschläge mit Trefferquote" },
      { "fileId": "<fileId mobile>", "device": "mobile" }
    ]
  }
}
```

- **Title.** The page shows the block title verbatim as the section heading, the PDF too. Use the feature name, with
  no prefix such as `Feature:`, and do not repeat it inside the HTML. `showInToc: false` keeps the table of contents to
  the main sections.
- **Text.** HTML as in a `text` block, with placeholders; one or two paragraphs.
- **Screenshots.** `fileId`s from the upload (`screenshot-session.mjs upload`), desktop first, each with its `device`;
  `showsCustomer: true` where the manifest marks customer branding.

## Custom HTML (special layouts)

`custom-html` is for a layout no block offers. What the platform does with this HTML decides how to write it:

- **Title.** As above: the block title is the section label, not repeated inside the HTML.
- **Files in Block HTML.** Write a file relative, as `/files/id/<fileId>`, without host and without `/api`. The page
  and the API point it at the showcase-bound route (files are not public, DEV-3496), and the PDF embeds exactly this
  form; an absolute URL keeps its host in front of the embedded image and breaks in the PDF. The same holds for
  `text.html`.
- **Colors.** The page has a light and a dark mode. Use its theme variables instead of fixed colors:
  `var(--sr-text)` for headings, `var(--sr-text-secondary)` for body text, `var(--sr-text-muted)`,
  `var(--sr-border)`, `var(--sr-surface)` for a subtle background, `var(--color-brand-400)` for the accent. White text
  disappears in light mode.
- **Typography.** `custom-html` gets none of the page's prose styles: headings and paragraphs render at body size and
  without spacing unless the HTML styles them.
- **Responsive layout.** `<style>` tags are removed and an inline style cannot hold `@media`, so the grid itself has to
  adapt: `grid-template-columns:repeat(auto-fit,minmax(300px,1fr))` stacks the columns on narrow screens.
- **Inline styles over classes.** A Tailwind class works only where the platform's own pages already use the same
  class; inline styles always work. A `style` attribute containing `url(` or `data:` is dropped as a whole, so
  background images are not possible.
- **Lightbox.** Every image opens in the lightbox, with its `alt` as caption; write the `alt` as one.
- **File lifetime.** A `/files/id/<fileId>` URL in the HTML counts as a reference of the showcase, like a block file
  field: the file is served to the showcase's viewers and kept while a block still names it.

**Showcase description:** Plain text, not HTML: the hero renders it as text and strips the tags of older entries, so
markup only costs formatting. Two or three sentences; the detail belongs in the blocks.

**Key facts:** `year`, `duration`, `teamSize` and `platforms` come from the analysis (first and last commit, the
deployment targets) and are confirmed by the user, because commit authors are not the project team. `outcomes` holds
only real, publishable numbers ("-70 % Bearbeitungszeit"), never an estimate; without one, leave the list empty. Every
viewer of the showcase sees the facts, also when the customer is anonymous, so no outcome may identify the customer.

## Anti-Patterns

- **Names in texts** — A customer, project or contact name, a customer domain or a reference URL written out instead of its placeholder; the server refuses it with the place.
- **Writing into the project** — No `SHOWCASE.md`, screenshot or note in a customer repository; the Showroom holds everything.
- **One-sentence descriptions** — Every block meets the depth set in "Content Depth Requirements" above.
- **Generic features** — "Benutzerfreundlich" or "Modern" without specifics tell a prospect nothing; name the concrete capability.
- **Missing testimonials** — Always check the company's testimonial source before saving the showcase.
- **No screenshots** — A showcase without visuals is incomplete. `/lt-showroom:showroom:screenshot` captures them into `~/.lt-showroom/<slug>/screenshots/`, with a fallback chain for projects that no longer run.
- **Copy-paste from README** — Rewrite for the audience; READMEs are for developers, showcases are for prospects.
- **English in German showcases** — Keep consistent; translate technical descriptions.
- **An outdated analysis** — When the code moved past `source.analyzedCommit`, run `/lt-showroom:showroom:update`.
- **A `cta` block** — The public page leaves it out: it ends with its own booking button.
- **A `tech-stack` block instead of the `technologies` field** — The block only refines the section "Technik & Architektur"; the hero, the cards and the PDF header read the field.
