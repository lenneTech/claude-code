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

**Caveat — Tailwind arbitrary values do not work.** Classes like `bg-[#35254a]`
are compiled at build time from the app's own sources; a class that exists only
inside a database-stored block is never generated. Brand colors that are not in
the theme scale must be applied as inline `style="…"`, which DOMPurify keeps.

## Readability in both color modes

An offer page renders in **light and dark**. `colorMode: 'light'` only sets the
initial preference — the viewer's toggle stays available, so **every offer must
stay readable in both modes**. This is where hand-styled blocks fail most often:
inline colors chosen against a white page turn into dark-on-dark the moment
someone flips the toggle.

### Rule 1 — a `custom-html` block that sets text colors must paint its own background

Put an explicit `background` on the **outermost** element of the block, not only
on the inner cards. Anything left transparent inherits the page background,
which changes with the mode while the inline text color does not.

```html
<!-- WRONG: headings/lists float on the page background -->
<div style="display:flex;gap:24px">
  <div><h4 style="color:#2c1f3d">Leistungen</h4>
    <ul style="color:#3f3f3f"><li>…</li></ul></div>
</div>

<!-- RIGHT: the block carries its own surface -->
<div style="background:#ffffff;padding:24px">
  <div style="display:flex;gap:24px">
    <div><h4 style="color:#2c1f3d">Leistungen</h4>
      <ul style="color:#3f3f3f"><li>…</li></ul></div>
  </div>
</div>
```

Gaps produced with the `gap:1px;background:#ccc` grid trick already count as a
painted surface — the divider color fills the container.

**`<strong>` does not inherit your inline color.** The `prose` wrapper sets an
explicit color on `strong` (and on headings), so a bold run inside a paragraph
you colored yourself falls back to the *theme* foreground. On a hand-painted
light card in dark mode that is white-on-white — invisible, and easy to miss
because the surrounding sentence still reads fine. Repeat the color on the tag:

```html
<p style="color:#2c1f3d">
  <strong style="color:#2c1f3d">Wichtig.</strong> Der Rest des Satzes …
</p>
```

Platform-rendered blocks (`text`, `faq`, `timeline`, `reference`, `team`,
`pricing-table`) need none of this: they read the theme tokens and adapt on
their own. Keep prose in those blocks whenever the layout allows it.

### Rule 2 — meet WCAG AA on both palettes

Target **4.5:1** for body text and **3:1** for large text (≥ 24 px, or ≥ 18.7 px
bold). Two traps that recur with brand palettes:

- **A mid-tone brand accent fails on white.** A color picked from a customer
  website is usually tuned for a colored surface. Olive `#b0af4d` on white is
  2.3:1 — unusable for the small uppercase kickers it is typically used for.
  Keep the brand tone for rules, borders and dark surfaces, and use a darkened
  variant for text on light (e.g. `#5c5b21`, 7.4:1).
- **A theme `neutral` anchor near `#777` fails.** The renderer derives muted
  text from it; `#777777` on white is 4.48:1 and misses AA. Anchor `neutral`
  around `#5c5c5c` instead — light steps stay light, so borders and card fills
  are unaffected.

For the dark palette the mirror image applies: the same accent needs a
*lightened* variant (olive `#c3c25e` on `#453c56` is 6.2:1, while `#b0af4d` is
4.47:1 and misses AA).

### Rule 3 — verify, do not estimate

After publishing, open the offer and measure. Run this in both modes (toggle via
the moon icon, or `emulate` with `colorScheme`):

```js
// paste into the page console / evaluate_script — lists every AA failure
const lum = (c) => { const [r,g,b] = c.match(/\d+/g).slice(0,3).map(Number)
  .map(v => { v/=255; return v <= 0.04045 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); });
  return 0.2126*r + 0.7152*g + 0.0722*b; };
const bgOf = (el) => { let n = el; while (n && n !== document.documentElement) {
  const b = getComputedStyle(n).backgroundColor;
  if (b && !/rgba\(0, 0, 0, 0\)|transparent/.test(b)) return b; n = n.parentElement; }
  return 'rgb(255,255,255)'; };
[...document.querySelectorAll('p,li,span,div,h1,h2,h3,h4,a,strong')].flatMap(el => {
  if (!el.offsetHeight) return [];
  if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) return [];
  const cs = getComputedStyle(el), l1 = lum(cs.color), l2 = lum(bgOf(el));
  const ratio = (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05);
  const size = parseFloat(cs.fontSize);
  const need = (size >= 24 || (size >= 18.66 && parseInt(cs.fontWeight) >= 700)) ? 3 : 4.5;
  return ratio < need ? [{ t: el.textContent.trim().slice(0,40), fg: cs.color, bg: bgOf(el), ratio: +ratio.toFixed(2), need }] : [];
});
```

Translucent overlays (`rgba(255,255,255,.14)` over a dark band) show up as false
positives because the walker reports the overlay, not the backdrop. Give such
chips a solid color so the audit stays trustworthy.

### Checklist before handing an offer over

- [ ] Every `custom-html` block paints its own background
- [ ] Contrast audit run in **light** mode — no failures
- [ ] Contrast audit run in **dark** mode — no failures
- [ ] Images carry a meaningful `alt` (screenshots: describe what is shown, not "Screenshot")
- [ ] No color-only meaning (a red border also says "Nicht enthalten" in words)
