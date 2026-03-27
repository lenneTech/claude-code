# Content Block Types Reference

All supported content block types for showcases. Each block has:

```typescript
{
  type: string;        // Block type identifier
  title?: string;      // Display title (shown in navigation)
  content: object;     // Type-specific content (see below)
  order: number;       // Sort position (0-based, ascending)
  visible: boolean;    // Whether block is rendered
}
```

---

## 1. `text` — Rich Text

```json
{ "html": "<p>Rich text content with <strong>formatting</strong></p>" }
```

HTML from a rich-text editor. Supports headings, bold, italic, links, lists, blockquotes.

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

## 5. `cta` — Call to Action

```json
{
  "buttonLabel": "View live demo",
  "buttonUrl": "https://...",
  "secondaryLabel": "View source",
  "secondaryUrl": "https://github.com/...",
  "text": "<p>Optional text above buttons</p>"
}
```

Primary action button with optional secondary button and descriptive text.

---

## 6. `divider` — Horizontal Separator

```json
{}
```

Visual separator between sections.

---

## 7. `tech-stack` — Technology Badges

```json
{
  "technologies": [
    { "name": "NestJS", "category": "backend" },
    { "name": "Nuxt 4", "category": "frontend" },
    { "name": "MongoDB", "category": "database" },
    { "name": "TypeScript", "category": "language" },
    { "name": "Tailwind CSS", "category": "styling" },
    { "name": "Docker", "category": "infrastructure" }
  ]
}
```

Renders technology badges with icons. Categories: `language`, `frontend`, `backend`, `database`, `infrastructure`, `testing`, `styling`, `other`.

---

## 8. `feature-grid` — Feature Grid

```json
{
  "features": [
    {
      "icon": "heroicons:shield-check",
      "title": "Role-based Access Control",
      "description": "Fine-grained permissions with admin, user, and guest roles."
    },
    {
      "icon": "heroicons:bolt",
      "title": "Real-time Updates",
      "description": "WebSocket-powered live notifications and data sync."
    }
  ]
}
```

Grid of feature cards with Heroicons, titles, and descriptions. Use 3-6 items for best layout.

---

## 9. `screenshot-gallery` — Screenshot Gallery

```json
{
  "screenshots": [
    { "fileId": "gridfs-id", "caption": "Dashboard overview", "device": "desktop", "order": 0 },
    { "fileId": "gridfs-id", "caption": "Mobile navigation", "device": "mobile", "order": 1 }
  ]
}
```

Displays a gallery of uploaded screenshots. Each entry is a `ScreenshotRef` object (see below). Screenshots must be uploaded to GridFS first; use the returned file ID as `fileId`.

### `ScreenshotRef` Structure

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `fileId` | string | yes | GridFS file ID from the file upload endpoint |
| `caption` | string | no | Caption text displayed below the screenshot |
| `device` | string | no | Viewport type: `desktop` (default), `tablet`, or `mobile` |
| `order` | number | no | Display order (0-based ascending) |

Screenshots are served via `/api/files/id/{fileId}`. The same `ScreenshotRef` structure is used in the showcase model's top-level `screenshots` array.

---

## 10. `timeline` — Project Timeline

```json
{
  "items": [
    { "date": "2024-Q1", "title": "MVP Launch", "description": "Initial release with core features." },
    { "date": "2024-Q3", "title": "Mobile App", "description": "Native iOS and Android apps released." }
  ]
}
```

Visual timeline for project milestones or development phases.

---

## 11. `team` — Team Members

```json
{
  "members": [
    {
      "name": "Jane Doe",
      "role": "Lead Developer",
      "avatarFileId": "gridfs-file-id",
      "linkedin": "https://linkedin.com/in/..."
    }
  ]
}
```

Team cards with avatar, name, role, and optional LinkedIn link.

---

## 12. `testimonial` — Customer Quote

```json
{
  "quote": "This tool transformed how we manage our projects.",
  "author": "John Smith",
  "role": "CTO at Acme Corp",
  "avatarFileId": "gridfs-file-id"
}
```

Highlighted customer or stakeholder quote.

---

## 13. `faq` — Frequently Asked Questions

```json
{
  "items": [
    { "question": "Is this open source?", "answer": "Yes, under the MIT license." },
    { "question": "What databases are supported?", "answer": "MongoDB and PostgreSQL." }
  ]
}
```

Expandable FAQ accordion.

---

## 14. `pricing-table` — Pricing Tiers

```json
{
  "tiers": [
    {
      "name": "Starter",
      "price": "Free",
      "features": ["Up to 3 projects", "Community support"],
      "cta": { "label": "Get started", "url": "https://..." }
    },
    {
      "name": "Pro",
      "price": "€49/month",
      "highlighted": true,
      "features": ["Unlimited projects", "Priority support", "Analytics"],
      "cta": { "label": "Start free trial", "url": "https://..." }
    }
  ]
}
```

Pricing tier cards. Set `highlighted: true` for the recommended plan.

---

## 15. `custom-html` — Raw HTML

```json
{ "html": "<div class=\"custom\">...</div>" }
```

Custom HTML block for special layouts. Tailwind CSS classes are available.

---

## 16. `reference` — Similar Project / Case Study Reference

```json
{
  "title": "Similar Project",
  "url": "https://showroom.lenne.tech/showcase/other-project",
  "description": "A related project that shares architectural patterns.",
  "imageFileId": "gridfs-file-id"
}
```

Link to a related showcase or external case study.
