# Best Practices for Showcase Content

## The SHOWCASE.md-First Principle

All showcase content originates from `SHOWCASE.md` in the project repository. This file is:
- Version-controlled alongside the code
- The single source of truth for all showcase text, features, and screenshot paths
- Updated whenever the project version changes

Never create showcase content on showroom.lenne.tech directly without first writing or updating SHOWCASE.md. The showcase on the platform is a *publication* of the SHOWCASE.md content, not a substitute for it.

## Language and Tone

- **German by default** — All showcase content in German (target audience: German-speaking prospects)
- **Factual and specific** — Describe what the project does, backed by evidence from code analysis
- **Developer-friendly** — Use proper framework/library names; assume a semi-technical audience
- **No marketing fluff** — Avoid "cutting-edge", "revolutionary" — describe actual capabilities
- **Du-Form or neutral** — No "Sie"-Ansprache; prefer neutral formulations or "du" where direct address is needed

## Content Depth Requirements

### Text Blocks (Minimum Quality)

- **Project overview**: 3-5 paragraphs, 200+ words. Cover: What is the project? What problem does it solve? Who uses it? What makes it special? Cite concrete numbers from the analysis.
- **Architecture overview**: 2-3 paragraphs. Cover: Module structure, key patterns, data flow, deployment architecture
- **Technical highlights**: 2-3 paragraphs. Cover: What makes this project technically interesting? Novel solutions, scale, integrations
- **Results/Impact**: 1-2 paragraphs. Concrete outcomes, metrics, user adoption (if available)

### Feature-Grid (Minimum 6 Items)

Each feature MUST be:
- Derived from actual code analysis (not assumed)
- Present in SHOWCASE.md with a `file:line` evidence reference
- Title: 3-5 words, action-oriented ("Echtzeit-Matching" not "Matching-Funktion")
- Description: 1-2 specific sentences explaining what it does and how
- Icon: Use lucide icon names (e.g., "lucide:zap", "lucide:shield", "lucide:database")

### Tech-Stack Block

- Include ALL significant technologies from `package.json` / manifest files
- Group by category: Frontend, Backend, Datenbank, Infrastruktur, Testing
- Include version-defining technologies (e.g., "NestJS 11" not just "NestJS")
- Only list technologies present in the SHOWCASE.md `technologies` frontmatter

### Screenshots

- Minimum 1 screenshot per feature (desktop viewport required, mobile optional)
- Screenshots must show the running application with realistic demo data
- Never use empty states or placeholder screens
- All screenshots in `docs/showcase/screenshots/` of the project repository
- Naming: `{feature-slug}-desktop.png`, `{feature-slug}-mobile.png`

## Customer Testimonials

**Always check** `https://lenne.tech/kundenerfolge` for matching customer feedback via WebFetch.

Known testimonials (verify by fetching the page — this list may be outdated):
- **DES WAHNSINNS FETTE BEUTE GmbH** — Simon Florath (Head of Digital): Development infrastructure optimization
- **Achenbach Buschhütten GmbH** — Roger Feist (Director OPTILINK): Android TV app
- **Tracto-Technik GmbH** — Ferdinand Funke (Lead Software Developer): Frontend digital platform

Match using the `customer` field from SHOWCASE.md frontmatter.

## Recommended Block Structure

### Standard Showcase (10-16 blocks)

```
1.  text "Überblick"        — 3-5 paragraphs: What, Why, Who, How
2.  tech-stack              — Technology badges (from SHOWCASE.md)
3.  feature-grid            — Compact icon overview of all features (6-8 items)
4.  custom-html "Feature 1" — Screenshot left + description right
5.  custom-html "Feature 2" — Description left + screenshot right
6.  custom-html "Feature 3" — Screenshot left + description right
7.  custom-html "Feature 4" — Description left + screenshot right
    ... (one custom-html per feature with screenshot)
N-4. text "Architektur"     — Module structure, patterns, data flow
N-3. screenshot-gallery     — Additional screenshots not tied to specific features
N-2. testimonial            — Customer feedback (if available)
N-1. text "Ergebnis"        — Impact, metrics, adoption
N.   cta                    — "Termin vereinbaren" → meeting URL
```

The `feature-grid` gives visitors a quick scannable overview of all capabilities with icons. Each feature is then presented in detail via a `custom-html` block with an accompanying screenshot. The `screenshot-gallery` at the end collects any additional screenshots (e.g., overview pages, mobile views) that are not tied to a specific feature.

### Library/Framework Showcase

```
1.  tech-stack
2.  text "Überblick"    — What the library does, why it exists
3.  feature-grid        — 6-8 core capabilities
4.  text "API"          — Key API surface, usage examples
5.  text "Architektur"  — Internal architecture, extension points
6.  text "Ecosystem"    — Integration with other tools, community
7.  cta
```

### Backend-Only Showcase (no UI)

```
1.  tech-stack
2.  text "Überblick"
3.  feature-grid
4.  text "API-Design"   — Endpoints, data models, authentication
5.  text "Architektur"
6.  testimonial
7.  cta
```

## Content Block JSON Examples

### Text Block (HTML formatted)
```json
{
  "type": "text",
  "title": "Projektübersicht",
  "order": 1,
  "visible": true,
  "showInToc": true,
  "content": {
    "html": "<h3>Was ist RegioKonneX?</h3><p>RegioKonneX ist ein KI-gestütztes Vernetzungs-Netzwerk für die Region Südwestfalen. Die Plattform bringt Unternehmen, Institutionen und Fachkräfte zusammen — basierend auf semantischem Matching statt einfacher Keyword-Suche.</p><h3>Das Problem</h3><p>Regionale Vernetzung scheitert oft daran, dass die richtigen Partner sich nicht finden. Klassische Plattformen verlassen sich auf manuelle Kategorisierung oder einfache Textsuche, die relevante Verbindungen übersieht.</p><h3>Die Lösung</h3><p>RegioKonneX nutzt eine Vektor-Datenbank (Qdrant) und einen Python-NLP-Microservice, um Nutzerprofile semantisch zu analysieren. Deutsche Komposita werden zerlegt, Fachbegriffe extrahiert und in hochdimensionale Vektoren umgewandelt. Das Ergebnis: Matches basieren auf inhaltlicher Ähnlichkeit, nicht auf identischen Schlagwörtern.</p>"
  }
}
```

### Feature-Grid Block
```json
{
  "type": "feature-grid",
  "title": "Features",
  "order": 2,
  "visible": true,
  "showInToc": true,
  "content": {
    "features": [
      {"title": "KI-Vektor-Matching", "description": "Semantisches Profil-Matching über Qdrant-Vektordatenbank — findet relevante Verbindungen jenseits einfacher Keyword-Suche.", "icon": "lucide:brain"},
      {"title": "Deutsches NLP", "description": "spaCy-basierte Substantiv-Extraktion und Komposita-Splitting für präzise Analyse deutscher Fachtexte.", "icon": "lucide:languages"},
      {"title": "Echtzeit-Chat", "description": "GraphQL-Subscriptions ermöglichen sofortige Kommunikation zwischen vernetzten Partnern.", "icon": "lucide:message-circle"},
      {"title": "Veranstaltungskalender", "description": "Regionale Events entdecken, erstellen und teilen — öffentlich zugänglich ohne Registrierung.", "icon": "lucide:calendar"},
      {"title": "Push-Benachrichtigungen", "description": "Web-Push-Notifications für neue Matches, Nachrichten und relevante Veranstaltungen.", "icon": "lucide:bell"},
      {"title": "Sentry-Monitoring", "description": "Client- und serverseitige Fehlerüberwachung für hohe Verfügbarkeit und schnelle Problemlösung.", "icon": "lucide:activity"}
    ]
  }
}
```

### Testimonial Block
```json
{
  "type": "testimonial",
  "title": "Kundenfeedback",
  "order": 7,
  "visible": true,
  "showInToc": false,
  "content": {
    "quote": "In lenne.Tech haben wir für das Frontend unserer digitalen Plattform den idealen Partner gefunden. Neben dem modernen Technologiestack haben uns besonders die Flexibilität, Professionalität und das Engagement von lenne.Tech beeindruckt.",
    "author": "Ferdinand Funke",
    "company": "Tracto-Technik GmbH & Co. KG"
  }
}
```

## Feature-Screenshot Layout (custom-html)

The most effective way to present features is a **2-column layout with screenshot + description**, alternating sides. Use `custom-html` blocks for this:

**Even features (image left, text right):**
```json
{
  "type": "custom-html",
  "title": "Feature: Name",
  "visible": true,
  "showInToc": true,
  "content": {
    "html": "<div style='display:grid;grid-template-columns:1fr 1fr;gap:2rem;align-items:center'><div><img src='/api/files/id/{fileId}' alt='Screenshot' style='width:100%;border-radius:1rem;border:1px solid rgba(255,255,255,0.1)'/></div><div><h3 style='color:#ff611e;font-size:1.5rem;margin-bottom:0.5rem'>Feature Name</h3><p style='color:rgba(255,255,255,0.7);line-height:1.6'>Detailed description from SHOWCASE.md...</p></div></div>"
  }
}
```

**Odd features (text left, image right):**
```json
{
  "type": "custom-html",
  "title": "Feature: Name",
  "content": {
    "html": "<div style='display:grid;grid-template-columns:1fr 1fr;gap:2rem;align-items:center'><div><h3 style='color:#ff611e;font-size:1.5rem;margin-bottom:0.5rem'>Feature Name</h3><p style='color:rgba(255,255,255,0.7);line-height:1.6'>Description...</p></div><div><img src='/api/files/id/{fileId}' alt='Screenshot' style='width:100%;border-radius:1rem;border:1px solid rgba(255,255,255,0.1)'/></div></div>"
  }
}
```

**Mobile fallback:** Add `@media(max-width:768px){grid-template-columns:1fr}` or use `style='display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr))'` for responsive behavior.

**Image URLs:** ALWAYS use `/api/files/id/{fileId}` with the `/api/` prefix. Without it, the Vite dev proxy won't forward the request to the API server and images will be broken.

**Showcase description:** MUST be plain text, never HTML. The description is rendered via `{{ showcase.description }}` (text interpolation), not `v-html`. If you accidentally save HTML in the description, strip it before saving.

**DOMPurify:** The `custom-html` block type uses a permissive sanitizer (`sanitizeRich`) that allows `img`, `div`, `style`, and layout tags. Other block types (like `text`) use a strict sanitizer that strips everything except basic formatting. Never put images in `text` blocks — use `custom-html` for any content with images or complex layouts.

Use `custom-html` blocks for detailed feature presentations (one per feature with screenshot). The `feature-grid` block complements this as a compact overview at the top, and the `screenshot-gallery` collects additional screenshots not tied to a specific feature.

## Anti-Patterns (What NOT to Do)

- **Skipping SHOWCASE.md** — Never publish to showroom.lenne.tech without first creating/updating the SHOWCASE.md file in the project
- **One-sentence descriptions** — A showcase is NOT a tweet. Every project deserves detailed content.
- **Generic features** — "Benutzerfreundlich" or "Modern" without specifics are worthless.
- **Missing testimonials** — Always check lenne.tech/kundenerfolge before publishing.
- **No screenshots** — A showcase without visuals is incomplete. All screenshots go in `docs/showcase/screenshots/`.
- **Copy-paste from README** — Rewrite for the audience; READMEs are for developers, showcases are for prospects.
- **English in German showcases** — Keep consistent; translate technical descriptions.
- **Outdated SHOWCASE.md** — Version must match `package.json`. Run `/showroom:update` when the project changes.
