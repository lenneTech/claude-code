# Content Block Types Reference

All 16 supported content block types for offers and templates. Each block has:

```typescript
{
  type: string;        // Block type identifier
  title?: string;      // Display title (shown in TOC)
  content: object;     // Type-specific content (see below)
  order: number;       // Sort position (0-based, ascending)
  visible: boolean;    // Whether block is rendered
  showInToc?: boolean; // Whether block appears in table of contents
}
```

---

## 1. `text` — Rich Text

```json
{ "html": "<p>Rich text content with <strong>formatting</strong></p>" }
```

HTML from TipTap editor. Supports headings, bold, italic, links, lists, blockquotes.

---

## 2. `image` — Single Image

```json
{ "fileId": "gridfs-file-id", "alt": "Description", "caption": "Optional caption" }
```

References an uploaded image via GridFS file ID.

---

## 3. `gallery` — Image Gallery

```json
{ "fileIds": ["file-id-1", "file-id-2", "file-id-3"] }
```

Multiple images displayed as a gallery grid.

---

## 4. `video` — Embedded Video

```json
{ "provider": "youtube", "url": "https://www.youtube.com/watch?v=..." }
```

Provider: `youtube` or `vimeo`. URL is the full video URL.

---

## 5. `download` — Downloadable Files

```json
{ "files": [{ "fileId": "gridfs-file-id", "label": "Projektplan.pdf" }] }
```

List of downloadable files with labels.

---

## 6. `cta` — Call to Action

```json
{ "buttonLabel": "Jetzt kontaktieren", "buttonUrl": "https://...", "text": "<p>Optional text above button</p>" }
```

Action button with optional descriptive text.

---

## 7. `divider` — Horizontal Separator

```json
{ "style": "line" }
```

Style options: `line`, `dots`, `space`.

---

## 8. `team` — Team Members

```json
{
  "members": [
    { "name": "Max Mustermann", "position": "Lead Developer", "email": "max@example.com", "imageFileId": "" }
  ]
}
```

Team member cards with photo, name, position, email.

---

## 9. `testimonial` — Customer Quote

```json
{ "author": "Anna Schmidt", "company": "Firma GmbH", "quote": "Hervorragende Zusammenarbeit!" }
```

---

## 10. `timeline` — Milestones

```json
{
  "milestones": [
    { "title": "Kickoff", "description": "Projektstart und Anforderungsanalyse", "date": "Q1 2026" }
  ]
}
```

---

## 11. `faq` — Questions & Answers

```json
{
  "items": [
    { "question": "Wie lange dauert das Projekt?", "answer": "Ca. 3 Monate ab Projektstart." }
  ]
}
```

---

## 12. `reference` — Project Showcase

```json
{
  "projectName": "Projekt X",
  "description": "Beschreibung des Referenzprojekts",
  "imageFileId": "",
  "imagePosition": "left",
  "quote": "Tolles Ergebnis!",
  "quoteAuthor": "Kunde Y",
  "quoteCompany": "Firma Z",
  "tags": ["Web", "Mobile"],
  "url": "https://example.com"
}
```

All fields optional except `projectName`. `imagePosition`: `left` or `right`.

---

## 13. `global-ref` — Global Block Reference

```json
{ "globalId": "mongodb-object-id", "version": null }
```

References a reusable global content block. `version: null` = latest version.

Use `list_globals` to find available globals, then reference by ID.

---

## 14. `custom-html` — Free-form HTML

```json
{ "html": "<div class=\"p-4 bg-primary-50 rounded-lg\"><p>Custom styled content</p></div>" }
```

Pure HTML + Tailwind CSS classes. Sanitized with DOMPurify. No Vue components.

---

## 15. `rich-component` — HTML with NuxtUI Components

```json
{
  "html": "<UCard><p>Card content with <UBadge>Status</UBadge></p></UCard>",
  "allowedComponents": ["UCard", "UBadge"]
}
```

HTML + Tailwind CSS + whitelisted NuxtUI components.

**Whitelisted components:** UButton, UBadge, UIcon, UCard, UAlert, UAccordion, UAvatar, UDivider, UProgress, UMeter, UChip, UKbd, USeparator

---

## 16. `pricing-table` — Pricing Items

```json
{
  "currency": "EUR",
  "items": [
    { "title": "Website-Design", "description": "Responsive Design nach Figma-Vorlage", "price": 5000, "unit": "pauschal" },
    { "title": "Entwicklung", "description": "Frontend + Backend", "price": 120, "unit": "pro Stunde" }
  ]
}
```

---

## Block Usage Tips

- **Order**: Start at 0, increment by 1
- **Visible**: Always `true` unless intentionally hiding (e.g., draft blocks)
- **ShowInToc**: Set to `true` for major sections, `false` for dividers/small blocks
- **File references**: Use existing `fileId` values from uploaded files. No upload via MCP in v1.
