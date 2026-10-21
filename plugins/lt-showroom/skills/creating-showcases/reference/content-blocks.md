# Content Block Types Reference

Every block type the Showroom platform accepts, with exactly the fields its showcase page reads. Each block has:

```typescript
{
  type: string;            // one of the types below
  content: object;         // type-specific, see below
  title?: string | null;   // section label above the block and table-of-contents entry
  order?: number;          // 0-based; set it to the block's index in the array
  visible?: boolean;       // default true; false hides the block on the page and in the PDF
  showInToc?: boolean;     // default true; table-of-contents entry (only with a title)
}
```

The server validates strictly: an unknown block type, an unknown envelope field or an unknown `content` field is
refused by name, so a misspelled field fails instead of rendering empty. `?` marks an optional field below.

**Rules that hold for every type:**

- **Display order is the array order.** The page and the admin preview show the blocks as they stand in
  `contentBlocks`; the PDF sorts them by `order`. Send the blocks in display order with `order` equal to the index, as
  the platform's own editor does, and both agree.
- **The title is shown verbatim** as a small uppercase label above the block, for every type except `divider`. With
  `showInToc` not `false` it is also an entry in the table of contents, which the page shows when the showcase's
  `showTableOfContents` is on. A block without a title has neither.
- **Plain-text fields show markup literally.** Only `text.html` and `custom-html.html` take HTML.
- **File fields take a file id** (`fileId`, `fileIds`, `logoFileId`, `avatarFileId`): the `fileId` an upload answers
  with, never a URL.
- **Two types do not appear on the public showcase page:** `cta` (the page ends with its own booking button from the
  showcase's `meetingUrl`, which falls back to the company setting) and `tech-stack` (the page hero shows the
  showcase's `technologies` field). Both still show in the admin preview and the PDF. A showcase therefore needs
  neither block.

The fixed labels the page adds (button texts such as "Ansehen") are German.

---

## 1. `text` — Rich Text

```json
{ "html": "<h3>Das Problem</h3><p>Rich text with <strong>20+ Module</strong> and <a href=\"https://example.com\">links</a>.</p>" }
```

| Field | Required | Shown as |
|-------|----------|----------|
| `html` | yes | Prose with the platform's typography |

Allowed tags: `p`, `br`, `strong`, `em`, `u`, `ul`, `ol`, `li`, `h2`, `h3`, `h4`, `a`, `blockquote`, `span`; allowed
attributes: `href`, `target`, `rel`, `class`. Everything else (images, tables, `h1`, inline styles) is removed. A
`<strong>` that starts with a number followed by one or two words (`<strong>20+ Module</strong>`) renders the number
large in the accent color.

---

## 2. `image` — Single Image

```json
{ "fileId": "<file id>", "alt": "Dashboard mit Tagesübersicht", "caption": "Optional caption below the image" }
```

| Field | Required | Shown as |
|-------|----------|----------|
| `fileId` | yes | The image, centered, at most 500 px high; a click opens the lightbox |
| `alt` | no | Alternative text (falls back to the block title) |
| `caption` | no | Plain text below the image and in the lightbox |

---

## 3. `gallery` — Image Gallery

```json
{ "fileIds": ["<file id>", "<file id>", "<file id>"] }
```

| Field | Required | Shown as |
|-------|----------|----------|
| `fileIds` | yes | Images in two or three masonry columns, cropped to 16:9, opening in the lightbox |

No captions; for captioned images use `screenshot-gallery`.

---

## 4. `screenshot-gallery` — Screenshot Gallery

```json
{
  "screenshots": [
    { "fileId": "<file id>", "caption": "Dashboard mit Tagesübersicht" },
    { "fileId": "<file id>", "caption": "Mobile Navigation" }
  ]
}
```

| Field | Required | Shown as |
|-------|----------|----------|
| `screenshots[].fileId` | yes | Screenshot in one or two columns, full width, opening in the lightbox |
| `screenshots[].caption` | no | Plain text below the screenshot and in the lightbox |
| `screenshots[].device` | no | Accepted (`desktop`, `tablet`, `mobile`), not displayed |
| `screenshots[].order` | no | Accepted, not used: the array order is the display order |

---

## 5. `video` — Embedded Video

```json
{ "url": "https://www.youtube.com/watch?v=VIDEO_ID" }
```

| Field | Required | Shown as |
|-------|----------|----------|
| `url` | yes | Embedded 16:9 player |
| `provider` | no | Accepted (`youtube`, `vimeo`), not used: the provider is read from the URL |

The embed works for `https://www.youtube.com/watch?v=<id>`, `https://youtu.be/<id>` and `https://vimeo.com/<number>`.
Other forms (`/shorts/`, `/embed/`, `player.vimeo.com`) render an empty frame. The PDF shows the URL as text.

---

## 6. `cta` — Call to Action

```json
{ "text": "Sentence above the button, plain text", "buttonLabel": "Live-Demo öffnen", "buttonUrl": "https://example.com" }
```

| Field | Required | Shown as |
|-------|----------|----------|
| `text` | no | Plain text above the button |
| `buttonLabel` | no | Button text (default "Mehr erfahren") |
| `buttonUrl` | no | Button target: `https://…`, `mailto:…` or a path starting with `/`; without it there is no button |

The block title is its heading. **Not shown on the public showcase page**, see the rules above.

---

## 7. `divider` — Separator

```json
{ "style": "line" }
```

| Field | Required | Shown as |
|-------|----------|----------|
| `style` | no | `line` (default), `dots` (• • •) or `space` (empty gap) |

A divider never shows its title.

---

## 8. `team` — Team Members

```json
{
  "members": [
    { "name": "Erika Musterfrau", "role": "Lead Developer", "bio": "Short description, plain text", "avatarFileId": "<file id>" }
  ]
}
```

| Field | Required | Shown as |
|-------|----------|----------|
| `members[].name` | yes | Name |
| `members[].role` | no | Role below the name |
| `members[].bio` | no | Short text below the role |
| `members[].avatarFileId` | no | Round photo; without it a placeholder icon |

---

## 9. `testimonial` — Customer Quote

```json
{ "quote": "<quote, verbatim, names as placeholders>", "author": "{{ansprechpartner}}", "role": "Geschäftsführer", "company": "{{kunde}}" }
```

| Field | Required | Shown as |
|-------|----------|----------|
| `quote` | yes | Large quote text |
| `author` | no | Name below the quote |
| `role` | no | Below the name, as `role · company` |
| `company` | no | Below the name, as `role · company` |

All fields are plain text; the quotation mark is drawn by the page. `author` and `company` take the placeholders,
whose real values (`customer.contactName`, `customer.name`) and aliases (`customer.contactAlias`, `customer.alias`) are
fields of the showcase; `role` is the contact's function.

---

## 10. `timeline` — Milestones

```json
{
  "items": [
    { "date": "Q1 2026", "title": "MVP Launch", "description": "Initial release with core features." },
    { "date": "Q3 2026", "title": "Mobile App", "description": "iOS and Android apps released." }
  ]
}
```

| Field | Required | Shown as |
|-------|----------|----------|
| `items[].title` | yes | Milestone name |
| `items[].date` | no | Free text above the title |
| `items[].description` | no | Plain text below the title |

The milestones run horizontally and scroll sideways when they do not fit.

---

## 11. `faq` — Questions and Answers

```json
{
  "items": [
    { "question": "Läuft die Plattform auch mobil?", "answer": "Ja, alle Ansichten sind für Smartphones optimiert." }
  ]
}
```

| Field | Required | Shown as |
|-------|----------|----------|
| `items[].question` | yes | Accordion header, plain text |
| `items[].answer` | yes | Accordion body, plain text |

---

## 12. `reference` — Customer or Project Card

```json
{ "company": "Beispielkunde", "description": "What was built, plain text", "logoFileId": "<file id>", "url": "https://example.com" }
```

| Field | Required | Shown as |
|-------|----------|----------|
| `company` | yes | Card heading |
| `description` | no | Plain text below the heading |
| `logoFileId` | no | Logo on the left; without it a building icon |
| `url` | no | "Ansehen" button opening the link in a new tab; without it there is no button |

---

## 13. `custom-html` — Free-form HTML

```json
{ "html": "<div style=\"display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:2rem\">…</div>" }
```

| Field | Required | Shown as |
|-------|----------|----------|
| `html` | yes | The sanitized HTML, without the platform's typography |

Allowed tags: `p`, `br`, `strong`, `em`, `u`, `ul`, `ol`, `li`, `h1`-`h6`, `a`, `blockquote`, `span`, `div`, `img`,
`figure`, `figcaption`, `table`, `thead`, `tbody`, `tr`, `th`, `td`, `code`, `pre`, `hr`, `section`, `article`,
`header`, `footer`, `nav`, `aside`. Allowed attributes: `href`, `target`, `rel`, `class`, `style`, `src`, `alt`,
`width`, `height`, `loading`, `id`, `role`, `aria-label`, `colspan`, `rowspan`. Scripts, event handlers, `<style>`,
`<iframe>`, `<video>` and `<svg>` are removed; a `style` attribute containing `url(` or `data:` is removed as a whole.
Every image opens in the lightbox, with its `alt` as caption.

Files (relative `/files/id/<fileId>`), theming and layout for this block: `best-practices.md` → "Custom HTML (special
layouts)". For a feature with screenshots, use `feature-spotlight` (18) instead.

---

## 14. `pricing-table` — Packages

```json
{
  "plans": [
    { "name": "Basis", "price": "ab 4.900 €", "features": ["Bis zu 3 Standorte", "E-Mail-Support"] },
    { "name": "Pro", "price": "ab 9.900 € / Jahr", "features": ["Unbegrenzte Standorte", "Telefon-Support"], "highlighted": true }
  ]
}
```

| Field | Required | Shown as |
|-------|----------|----------|
| `plans[].name` | yes | Package name |
| `plans[].price` | no | Price as written, free text including currency and unit |
| `plans[].features` | no | Bullet list with check marks |
| `plans[].highlighted` | no | Emphasized card; with a booking link it gets a "Jetzt anfragen" button to it |
| `currency` | no | Accepted, not displayed: put the unit into `price` |

---

## 15. `tech-stack` — Technology Chips

```json
{
  "technologies": [
    { "name": "NestJS", "category": "Backend", "version": "11", "icon": "i-simple-icons-nestjs", "description": "Shown in a dialog on click" }
  ]
}
```

| Field | Required | Shown as |
|-------|----------|----------|
| `technologies[].name` | yes | Chip text |
| `technologies[].category` | no | Muted suffix in the chip (no grouping) |
| `technologies[].description` | no | Makes the chip clickable; the dialog shows it |
| `technologies[].icon` | no | Iconify name, shown in the dialog only |
| `technologies[].version` | no | Shown in the dialog only |

**Not shown on the public showcase page**: technologies belong in the showcase's `technologies` field, which the
page hero and the PDF header show.

---

## 16. `feature-grid` — Feature Cards

```json
{
  "features": [
    { "icon": "i-lucide-shield-check", "title": "Rollenbasierte Rechte", "description": "Fein abgestufte Rechte für Admins, Nutzer und Gäste." },
    { "icon": "i-lucide-zap", "title": "Echtzeit-Updates", "description": "Änderungen erscheinen sofort bei allen Beteiligten." }
  ]
}
```

| Field | Required | Shown as |
|-------|----------|----------|
| `features[].title` | yes | Card heading |
| `features[].description` | no | One or two sentences, plain text |
| `features[].icon` | no | Iconify name, e.g. `i-lucide-zap` |

With more than two features the first two become a row of two large cards and the rest flow, on wide screens, in
rows of three, so 5, 8 or 11 features fill every row. The cards tilt slightly and glow on hover. Lucide
(`i-lucide-…`) and Simple Icons (`i-simple-icons-…`) are served by the platform; icons from other Iconify collections
load from the public Iconify API at runtime.

---

## 17. `global-ref` — Global Block Set

```json
{ "globalId": "<id from list_globals>", "version": null }
```

| Field | Required | Meaning |
|-------|----------|---------|
| `globalId` | yes | The reusable block set (`list_globals`, `get_global`) |
| `version` | no | Version number to show; omitted or `null` follows the current version |

The page has no renderer for this type: the server replaces the reference with the set's blocks before delivery, at
the reference's position. A hidden reference stays hidden with all its blocks; a reference that cannot be resolved
is left out of the public page.

---

## 18. `feature-spotlight` — Feature with Screenshots

```json
{
  "html": "<p>Description with placeholders</p>",
  "icon": "i-lucide-target",
  "screenshots": [
    { "fileId": "<file id>", "device": "desktop", "caption": "…", "showsCustomer": false },
    { "fileId": "<file id>", "device": "mobile" }
  ]
}
```

| Field | Required | Shown as |
|-------|----------|----------|
| `html` | yes | Text beside the screenshots, HTML as in `text` |
| `icon` | no | Iconify name next to the block title, e.g. `i-lucide-zap` |
| `screenshots[].fileId` | yes | The image; the first desktop and the first mobile one are shown together |
| `screenshots[].device` | no | `desktop` (default) and `tablet` in a browser frame, `mobile` in a phone frame |
| `screenshots[].caption` | no | Caption, plain text |
| `screenshots[].showsCustomer` | no | Shows the customer (logo, branding): left out where the alias is shown |

The block title is the heading; consecutive spotlights alternate the image side. Writing guidance:
`best-practices.md` → "Feature Sections (feature-spotlight)".

---

## Saving and Updating Blocks

- **Every block has an `id`.** `get_showcase` returns the blocks as stored, each with its `id`, texts with their
  placeholders and a `global-ref` block as a reference (`view: "alias"` or `"real"` returns the resolved page instead,
  for checking, never for saving).
- **One block: `upsert_block` and `remove_block`.** `upsert_block` with `block.blockId` replaces that block (`title`,
  `visible`, `showInToc` stay unless given), without one it inserts a new block at `position` or last; `remove_block`
  removes one. The other blocks are not sent and stay untouched.
- **`contentBlocks` replaces the whole list** on every update; send the complete array, each kept block with its `id`
  (a block without one is a new block).
- **`fileId` and `fileIds` carry over.** A block with the same `order` and `type` as a stored block keeps the stored
  `fileId` / `fileIds` when the new block leaves them out or empty; `null` removes them. A block that changes what it
  shows at a position therefore sends a real file id or `null`.
- **Unreferenced files are deleted.** A file the update removed from a block file field is deleted from storage
  unless another file field still references it (a block of any showcase or global set, a teaser image, a knowledge
  entry). Image URLs inside `custom-html` do not count as a reference.
