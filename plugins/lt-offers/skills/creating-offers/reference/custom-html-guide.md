# Custom HTML & Rich Component Guide

Two block types support custom HTML:

## `custom-html` — Pure HTML + Tailwind

- Rendered via `v-html` with DOMPurify sanitization
- Only standard HTML elements + Tailwind CSS classes
- No Vue components, no JavaScript
- Wrapped in `prose prose-sm max-w-none dark:prose-invert`

### Editor — WYSIWYG ↔ Source toggle

The block editor exposes two synchronised surfaces over the same `content.html` string:

- **Visuell** uses [Squire](https://github.com/fastmail/Squire), a contenteditable rich-text editor that **does not parse the markup into a schema**. Whatever HTML you put in (`<div>`, inline `style="..."`, tables, custom classes) survives a Visual ↔ Source roundtrip intact. The toolbar covers bold, italic, strikethrough, inline code, headings 1–3, ordered/unordered lists, blockquotes, code blocks, links, horizontal rules and a "clear formatting" eraser.
- **Quellcode** is a CodeMirror surface with a "Format" button (HTML pretty-print).

This is a deliberate departure from schema-based editors like TipTap/ProseMirror — Squire was chosen so a hand-built layout (custom borders, inline gradients, branded card grids) is not silently flattened to `<p>` paragraphs the moment a user toggles into Visual mode.

### File-URL tokens

Embed GridFS images inside `<img>`/`<a>` tags via `{{fileUrl:<24-hex-id>}}`. The token is expanded:
- in the customer-facing browser view,
- in the editor's WYSIWYG surface (so images render while editing),
- in the PDF builder.

The persisted HTML keeps the **token form** — collapse-on-save in the editor ensures no host name is ever baked into the database. This makes a single offer portable across local/staging/production without rewriting paths.

Example:
```html
<img src="{{fileUrl:69e9c4b6014c53740c761ca5}}" alt="Architektur">
```

### Examples

```html
<!-- Highlight box -->
<div class="rounded-lg bg-primary-50 p-6 dark:bg-primary-950">
  <h3 class="text-lg font-semibold text-primary">Warum wir?</h3>
  <p class="mt-2 text-muted">Jahrelange Erfahrung und ein starkes Team.</p>
</div>

<!-- Two-column layout -->
<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
  <div class="rounded-lg border border-default p-4">
    <h4 class="font-semibold">Leistung A</h4>
    <p>Beschreibung...</p>
  </div>
  <div class="rounded-lg border border-default p-4">
    <h4 class="font-semibold">Leistung B</h4>
    <p>Beschreibung...</p>
  </div>
</div>

<!-- Styled list -->
<ul class="space-y-2">
  <li class="flex items-start gap-2">
    <span class="mt-1 text-primary">✓</span>
    <span>Responsive Design</span>
  </li>
  <li class="flex items-start gap-2">
    <span class="mt-1 text-primary">✓</span>
    <span>SEO-Optimierung</span>
  </li>
</ul>
```

## `rich-component` — HTML + NuxtUI Components

- Whitelisted NuxtUI components are rendered as real Vue components
- Non-whitelisted HTML is sanitized with DOMPurify
- Must specify `allowedComponents` array

### Whitelisted Components

| Component | Description | Example |
|-----------|-------------|---------|
| `UButton` | Action button | `<UButton>Klick mich</UButton>` |
| `UBadge` | Status label | `<UBadge>Neu</UBadge>` |
| `UIcon` | Icon | `<UIcon name="i-lucide-star" />` |
| `UCard` | Card container | `<UCard><p>Content</p></UCard>` |
| `UAlert` | Alert/notice | `<UAlert title="Hinweis" description="..." />` |
| `UAccordion` | Collapsible | `<UAccordion :items="[]" />` |
| `UAvatar` | Profile image | `<UAvatar src="" alt="Name" />` |
| `UDivider` | Separator | `<UDivider />` |
| `UProgress` | Progress bar | `<UProgress :value="75" />` |
| `UMeter` | Meter gauge | `<UMeter :value="50" :max="100" />` |
| `UChip` | Status dot | `<UChip />` |
| `UKbd` | Keyboard shortcut | `<UKbd>Ctrl+S</UKbd>` |
| `USeparator` | Separator | `<USeparator />` |

### Examples

```html
<!-- Feature cards with NuxtUI -->
<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
  <UCard>
    <UIcon name="i-lucide-zap" class="text-primary size-8 mb-2" />
    <h4 class="font-semibold">Schnell</h4>
    <p class="text-sm text-muted">Performante Umsetzung</p>
  </UCard>
  <UCard>
    <UIcon name="i-lucide-shield" class="text-primary size-8 mb-2" />
    <h4 class="font-semibold">Sicher</h4>
    <p class="text-sm text-muted">OWASP-konform</p>
  </UCard>
</div>

<!-- Alert with button -->
<UAlert title="Sonderangebot" description="Bis Ende des Monats 10% Rabatt auf alle Pakete." />
<UButton class="mt-4" color="primary">Jetzt anfragen</UButton>
```

## When to Use Which

| Scenario | Block Type |
|----------|-----------|
| Simple styled text/layout | `custom-html` |
| Interactive-looking UI elements | `rich-component` |
| Icons, badges, cards | `rich-component` |
| Complex grids, custom styling | `custom-html` |
| Standard content (headings, text, lists) | `text` (TipTap) |

## Tailwind CSS Tips

- Use semantic colors: `text-primary`, `bg-primary-50`, `border-default`, `text-muted`
- Dark mode: Use `dark:` prefix for overrides
- Spacing: Use consistent `p-4`, `p-6`, `gap-4`, `gap-6`
- Borders: `border border-default rounded-lg`
- Typography: `prose prose-sm max-w-none` for rich text
