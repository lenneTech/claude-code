# Content Block Types Reference

All 18 supported content block types for offers and templates. Each block has:

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
{
  "files": [
    {
      "fileId": "gridfs-file-id",
      "fileName": "Projektplan (PDF)",
      "description": "Optional short description shown below the file name",
      "includeInPdf": true
    }
  ]
}
```

List of downloadable files. `includeInPdf` controls whether the file is listed in the generated offer PDF. Upload files beforehand via `create_upload_ticket` + HTTP POST (see Block Usage Tips).

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

Pure HTML + Tailwind CSS classes. Sanitized with DOMPurify on render. No Vue components.

**File-URL tokens.** Use `{{fileUrl:<24-hex-id>}}` to embed GridFS images / PDFs without baking a host into the stored HTML. The frontend renderer, the WYSIWYG editor and the PDF builder all expand these tokens at render time. Example: `<img src="{{fileUrl:69e9c4b6014c53740c761ca5}}" alt="Screenshot">`.

**Editor UX.** The block has two synchronised surfaces in the offer editor:
- "Visuell" — Squire-based WYSIWYG that **preserves any HTML you put in** (divs, inline `style="..."`, tables, classes). Toolbar covers bold/italic/strike/code, headings 1–3, lists, quotes, links and clear-format. Image tokens render as real images via the bridge above.
- "Quellcode" — CodeMirror with HTML-Beautify, for power-users.

Both modes feed the same `content.html` field. Squire's contract is "no schema-rewrite", so a complex hand-built layout survives a Visual ↔ Source roundtrip intact — see [`custom-html-guide.md`](./custom-html-guide.md).

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

## 17. `lottie` — Lightweight JSON Animation

```json
{
  "animationFileId": "69e9c4b6014c53740c761ca5",
  "loop": true,
  "autoplay": true,
  "speed": 1,
  "alignment": "center",
  "maxWidth": 600,
  "previewFileId": "69e9c4b6014c53740c761cab"
}
```

Renders a [Lottie](https://lottiefiles.com/) JSON animation. Auto-plays only once it scrolls into view (`IntersectionObserver`), so a long offer page stays cheap to render. PDFs and the email-share preview cannot run JS animations and use a static fallback in this order:

1. **`previewFileId`** — author-uploaded PNG/JPG (recommended for branded outputs).
2. **Auto-snapshot** — first frame of the animation, captured server-side via Puppeteer at PDF render time. No DB persistence.
3. **Inline placeholder** — "Interaktive Animation — im Online-Angebot sichtbar".

**Constraints**
- Max 2 MB per JSON file (rejected at upload).
- Static validator strips unsupported features (3D, expressions, large embedded raster assets) and warns the author.
- `maxWidth` is clamped to 640 px so a hostile payload cannot blow up the layout.
- `alignment`: `'left' | 'center' | 'right'`.

**Authoring path.** The MCP tool `add_lottie_animation` does the upload + block creation in one call (it validates the JSON, surfaces unsupported-feature warnings, and inserts the block at the requested `order`). `update_lottie_animation` swaps the JSON of an existing block atomically.

---

## 18. `html-embed` — Self-contained Interactive HTML (Click-Dummies)

```json
{
  "fileId": "gridfs-file-id",
  "fileName": "klick-dummy.html",
  "height": 950,
  "hint": "Am besten im Vollbildmodus ausprobieren",
  "caption": "Optional caption shown below the embed",
  "previewFileId": ""
}
```

Renders an uploaded, self-contained HTML file (e.g. an interactive click-dummy or prototype) inside a sandboxed iframe on the offer page. The frontend fetches the file and injects it via `srcdoc` with `sandbox="allow-scripts"` (no `allow-same-origin`), so embedded scripts run isolated from the offers app. A fullscreen button is provided.

`hint` (optional) renders a highlighted note with a fullscreen icon directly *above* the embed — use it to point users at the fullscreen button before they interact. `caption` (optional) renders a muted line *below* the embed.

**Constraints**
- The HTML must be **fully self-contained**: inline all CSS/JS, embed fonts and images as data URIs. External `<script src>`, external stylesheets and remote media trigger upload warnings (they will not load reliably in the sandbox).
- Max 5 MB per file; upload validator checks UTF-8 and HTML structure.
- `height` is clamped to 200–1600 px.
- PDFs cannot run the embed: the PDF builder uses `previewFileId` (author-uploaded PNG/JPG) when set, otherwise a placeholder ("Interaktiver Inhalt — im Online-Angebot verfügbar").

**Authoring paths**
- **MCP one-shot:** `add_html_embed` uploads base64 HTML and inserts the block in one atomic call (same insert-at-order pattern as `add_lottie_animation`). Suitable for small files only — base64 through a tool call gets unwieldy fast.
- **Recommended for real files:** `create_upload_ticket` with `purpose: "html-embed"`, then `POST` the file via HTTP to the returned `uploadUrl` (multipart field `file`), then reference the returned file `id` as `fileId` in an `update_offer` call.
- **Editor:** the block editor accepts direct `.html` uploads and manages height/caption/preview.

The field is named `fileId` on purpose: orphan-file cleanup and backup remapping treat it like every other file reference automatically.

---

## Block Usage Tips

- **Order**: Start at 0, increment by 1
- **Visible**: Always `true` unless intentionally hiding (e.g., draft blocks)
- **ShowInToc**: Set to `true` for major sections, `false` for dividers/small blocks
- **File references**: Use existing `fileId` values from uploaded files. For Lottie files, use `add_lottie_animation`; for HTML embeds, use `add_html_embed` or an upload ticket; for offer-source files (briefing material, NOT content blocks) use `upload_offer_source_file`.
- **Uploading new files via MCP**: `create_upload_ticket` (`purpose`: `"html-embed"` | `"image"` | `"file"`) returns a single-use upload URL valid for 15 minutes. `POST` the file as multipart form-data (field `file`) to that URL — no session required, the token IS the authorization. Purpose selects the server-side validation: `html-embed` (validated HTML, ≤ 5 MB), `image` (`image/*`, ≤ 10 MB), `file` (any type, ≤ 25 MB). Caveat: `curl` sends `application/octet-stream` for less-common extensions like `.webp` — set the MIME type explicitly (`-F "file=@shot.webp;type=image/webp"`), otherwise an `image` ticket rejects the upload with 400 and the single-use ticket is burned.
- **Image tokens**: Inside `text`, `custom-html`, `rich-component` blocks, embed GridFS images via `{{fileUrl:<24-hex-id>}}` — the renderer expands these at view/PDF time and keeps the HTML portable across environments.
