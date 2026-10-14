# Best Practices for Showcase Content

## The SHOWCASE.md-First Principle

All showcase content originates from `SHOWCASE.md` in the project repository. This file is:
- Version-controlled alongside the code
- The single source of truth for all showcase text, features, and screenshot paths
- Updated whenever the project version changes

Never create showcase content on the platform directly without first writing or updating SHOWCASE.md. The showcase on the platform is a *publication* of the SHOWCASE.md content, not a substitute for it.

## Language and Tone

- **German by default** — All showcase content in German (target audience: German-speaking prospects)
- **Factual and specific** — Describe what the project does, backed by evidence from code analysis
- **Developer-friendly** — Use proper framework/library names; assume a semi-technical audience
- **No marketing fluff** — Avoid "cutting-edge", "revolutionary" — describe actual capabilities
- **"Du" or neutral** — No formal "Sie" address; prefer neutral formulations or "du" where direct address is needed

## Content Depth Requirements

### Text Blocks (Minimum Quality)

- **Project overview**: 3-5 paragraphs, 200+ words. Cover: What is the project? What problem does it solve? Who uses it? What makes it special? Cite concrete numbers from the analysis.
- **Architecture overview**: 2-3 paragraphs. Cover: Module structure, key patterns, data flow, deployment architecture
- **Technical highlights**: 2-3 paragraphs. Cover: What makes this project technically interesting? Novel solutions, scale, integrations
- **Results/Impact**: 1-2 paragraphs. Concrete outcomes, metrics, user adoption (if available)

### Feature-Grid (Minimum 6 Items)

Each feature is:
- Derived from actual code analysis (not assumed)
- Present in SHOWCASE.md with a `file:line` evidence reference
- Title: 3-5 words, action-oriented ("Echtzeit-Matching" not "Matching-Funktion")
- Description: 1-2 specific sentences explaining what it does and how
- Icon: an Iconify name from the Lucide set (`i-lucide-zap`, `i-lucide-shield-check`, `i-lucide-database`)
- Count: with more than two features the first two render large and the rest in rows of three, so 8 (or 11) fill
  every row

### Technologies

- Set them as the showcase's `technologies` field, not as a `tech-stack` block: the page hero shows the field with
  logos and the PDF header as tags, while the public page leaves a `tech-stack` block out
- Include all significant technologies from `package.json` / manifest files
- Only list technologies present in the SHOWCASE.md `technologies` frontmatter
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

Read a references page as raw HTML with `curl`, as `/lt-showroom:showroom:create` Step 3 shows. A summarizing fetch paraphrases
quotes, and many references pages reveal only a few testimonials until a "show more" button is clicked; on pages built
with Nuxt, Next or similar frameworks the embedded payload in the raw HTML usually holds all of them verbatim.

That source is the only source for names, roles and quotes; this file keeps no copy of them, so nothing here can go
stale or misquote a customer. A quote whose published original cannot be found is not used.

Match using the `customer` field from SHOWCASE.md frontmatter.

## Recommended Block Structure

The page frames the blocks on its own: the hero shows title, description, teaser image, the key facts (`year`,
`duration`, `teamSize`, `platforms`, `outcomes`) and the `technologies` field, and the page ends with "Interesse geweckt?" and a "Termin vereinbaren" button to the booking link (the showcase's
`meetingUrl`, otherwise the company setting). The public page leaves `cta` and `tech-stack` blocks out, so none of the
structures below has one.

### Standard Showcase (8-14 blocks)

```
1.   text "Überblick"         — 3-5 paragraphs: What, Why, Who, How
2.   feature-grid "Features"  — Compact icon overview of all features (6-8 items)
3.   custom-html <Feature 1>  — Screenshot left + description right
4.   custom-html <Feature 2>  — Description left + screenshot right
     ... (one custom-html per feature with screenshot, alternating)
N-3. text "Architektur"       — Module structure, patterns, data flow
N-2. screenshot-gallery       — Additional screenshots not tied to specific features
N-1. testimonial              — Customer feedback (if available)
N.   text "Ergebnis"          — Impact, metrics, adoption
```

The `feature-grid` gives visitors a quick scannable overview of all capabilities with icons. Each feature is then presented in detail via a `custom-html` block with an accompanying screenshot. The `screenshot-gallery` at the end collects any additional screenshots (e.g., overview pages, mobile views) that are not tied to a specific feature.

### Library/Framework Showcase

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

## Feature-Screenshot Layout (custom-html)

The most effective way to present features is a **2-column layout with screenshot + description**, alternating sides.
Use one `custom-html` block per feature:

**Even features (image left, text right):**
```json
{
  "type": "custom-html",
  "title": "Echtzeit-Matching",
  "order": 2,
  "visible": true,
  "showInToc": false,
  "content": {
    "html": "<div style='display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:2rem;align-items:center'><img src='https://api.showroom.example/files/id/<fileId>' alt='Matching-Vorschläge mit Trefferquote' style='width:100%;border-radius:1rem;border:1px solid var(--sr-border)'/><div><p style='font-size:1.25rem;font-weight:600;color:var(--sr-text);margin-bottom:0.75rem'>Passende Partner in Sekunden</p><p style='color:var(--sr-text-secondary);line-height:1.7'>Detailed description from SHOWCASE.md...</p></div></div>"
  }
}
```

**Odd features (text left, image right):** the same block with the text `<div>` before the `<img>`.

What the platform does with this HTML decides how to write it:

- **Title.** The page shows the block title verbatim as the section label, the PDF as the section heading. Use the
  feature name, with no prefix such as `Feature:` (it would appear on the page), and do not repeat it as a heading
  inside the HTML. `showInToc: false` keeps the table of contents to the main sections.
- **Image URL.** Write it absolute: `<api-origin>/files/id/<fileId>`, where `<api-origin>` is the upload ticket's
  `uploadUrl` up to `/files/` (for showroom.lenne.tech: `https://api.showroom.lenne.tech`). A relative
  `/api/files/id/…` path resolves against the page's own host, which serves no files, and the image stays blank.
- **PDF.** The PDF export does not embed absolute image URLs from `custom-html`; it shows them as broken images. When
  the PDF matters, show the screenshot in an `image` or `screenshot-gallery` block instead.
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
- **File lifetime.** Image URLs inside `custom-html` do not count as a file reference. When the same file also sits in
  a block file field (`image`, `screenshot-gallery`) and an update removes it there, the file is deleted and the
  `custom-html` image breaks.

**Showcase description:** Plain text, not HTML: the hero renders it as text and strips the tags of older entries, so
markup only costs formatting. Two or three sentences; the detail belongs in the blocks.

**Key facts:** `year`, `duration`, `teamSize` and `platforms` come from the analysis (first and last commit, the
deployment targets) and are confirmed by the user, because commit authors are not the project team. `outcomes` holds
only real, publishable numbers ("-70 % Bearbeitungszeit"), never an estimate; without one, leave the list empty. Every
viewer of the showcase sees the facts, also when the customer is anonymous, so no outcome may identify the customer.

## Anti-Patterns

- **Skipping SHOWCASE.md** — Never publish to the platform without first creating/updating the SHOWCASE.md file in the project
- **One-sentence descriptions** — Every block meets the depth set in "Content Depth Requirements" above.
- **Generic features** — "Benutzerfreundlich" or "Modern" without specifics tell a prospect nothing; name the concrete capability.
- **Missing testimonials** — Always check the company's testimonial source before publishing.
- **No screenshots** — A showcase without visuals is incomplete. `/lt-showroom:showroom:screenshot` captures them into `~/.lt-showroom/<slug>/screenshots/`, with a fallback chain for projects that no longer run.
- **Copy-paste from README** — Rewrite for the audience; READMEs are for developers, showcases are for prospects.
- **English in German showcases** — Keep consistent; translate technical descriptions.
- **Outdated SHOWCASE.md** — Version must match `package.json`. Run `/lt-showroom:showroom:update` when the project changes.
- **A `cta` or `tech-stack` block** — The public page leaves both out: it ends with its own booking button and its hero shows the `technologies` field.
