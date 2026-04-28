---
name: theming
description: Per-offer and app-wide theme configuration on the offers platform — light/dark palettes, MCP tools, UI workflows, and PDF rendering rules
---

# Theming — Per-Offer & App-Wide

Two layers of theme configuration coexist:

1. **Per-offer theme** — A single offer carries its own light/dark palette via `offer.theme`.
2. **App-wide default theme** — A platform-level default in `settings.defaultTheme` that applies to every offer that does not have its own theme enabled.

Both layers use the same shape so the merge logic stays simple.

## Theme Shape

```ts
type ThemeColors = {
  background: string; // hex, e.g. "#ffffff"
  foreground: string;
  primary: string;
  secondary: string;
  neutral: string;
  success: string;
  info: string;
  warning: string;
  error: string;
};

type Theme = {
  enabled: boolean;       // per-offer only — toggles override on/off
  light: ThemeColors;
  dark: ThemeColors;
};
```

All 9 color slots map to NuxtUI v4 design-token families. The frontend expands each anchor color into a full Tailwind 50–950 scale (HSL lightness curve anchored at L500), then writes the values into `--ui-color-*` CSS variables scoped to the offer page.

**Hex format.** Always 6-digit lowercase (`#rrggbb`). The validator rejects shorthand (`#fff`) and uppercase variants — keep the wire format predictable.

## Effective Theme Resolution

Order applied at render time (browser, PDF, share-preview):

1. **Per-offer override**, if `offer.theme.enabled === true` and both `light` and `dark` palettes are present.
2. **App-wide default** (`settings.defaultTheme`), otherwise.
3. **Platform fallback** (the lenne.tech orange palette baked into the frontend), if no settings default has been configured yet.

The API merges the resolved theme into the offer payload before sending it down — `get_offer` and `findBySlug` both apply this. Consumers (browser, PDF service) never need to read settings directly; they always see a fully resolved `theme.light` / `theme.dark`.

## MCP Tools

### Per-offer

- **`create_offer`** — Accepts an optional `theme: { enabled, light, dark }`. Both color sets are required if `theme` is present, even when `enabled: false` (so toggling on later does not need a follow-up update).
- **`update_offer`** — Accepts the same `theme` object. Pass `theme: null` (or omit and the field stays untouched) to clear nothing; pass `theme: { enabled: false, ... }` to keep the colors but stop applying them.
- **`get_offer`** — Returns the **effective theme** (resolved per the rules above). The raw per-offer record is preserved on the document but the response always carries usable colors for both modes.
- **`duplicate_offer`** — Carries the per-offer theme over verbatim.

### App-wide default

- **`set_default_theme`** — Writes `settings.defaultTheme = { light, dark }`. Admin-only on the underlying `SettingsService` (the MCP layer surfaces the 403 unchanged). `enabled` is not part of the settings shape — the default is always "on" for offers without an override.
- **`get_default_theme`** — Reads the current default. Returns `null` if no default has been configured yet (frontend then uses the platform fallback).

### Example — create with theme

```json
{
  "title": "Webrelaunch — Beispiel GmbH",
  "customerName": "Beispiel GmbH",
  "theme": {
    "enabled": true,
    "light": {
      "background": "#ffffff",
      "foreground": "#111827",
      "primary": "#0f766e",
      "secondary": "#475569",
      "neutral": "#64748b",
      "success": "#10b981",
      "info": "#0ea5e9",
      "warning": "#f59e0b",
      "error": "#ef4444"
    },
    "dark": {
      "background": "#0b1220",
      "foreground": "#e5e7eb",
      "primary": "#2dd4bf",
      "secondary": "#94a3b8",
      "neutral": "#64748b",
      "success": "#34d399",
      "info": "#38bdf8",
      "warning": "#fbbf24",
      "error": "#f87171"
    }
  },
  "contentBlocks": [ /* ... */ ]
}
```

### Example — set the platform default

```json
// set_default_theme
{
  "light": { "background": "#ffffff", "foreground": "#0a0a0a", "primary": "#ff611e", ... },
  "dark":  { "background": "#0b0b0b", "foreground": "#fafafa", "primary": "#ff7a3c", ... }
}
```

## UI Workflows

### Per-offer editor

- Card on the offer detail page (`/app/offers/[id]`).
- A toggle "Eigene Farben verwenden" controls `theme.enabled`. When off, the picker grid collapses to keep the editor compact, but the color values **are preserved** so toggling back on does not lose work.
- Two reset buttons:
  - "Auf Standard zurücksetzen" — restores the **app-wide default** (or platform fallback if none configured).
  - "Auf Plattform zurücksetzen" — restores the lenne.tech baseline regardless of the settings default.
- Light and dark are edited in parallel side-by-side; previewing the offer respects the OS color-scheme.

### Settings page (admins)

- Route: `/app/settings/theme` — listed as a "Standardfarben" tile on `/app/settings` (only visible to admins via `useIsAdmin`).
- Reuses the same `<OfferThemeEditor>` component with `hide-toggle` and `reset-to-platform-only`. Saving calls `set_default_theme` under the hood and refreshes the cached defaults via the `useOfferThemeDefaults` composable.

## PDF Rendering

The PDF service (`pdf.service.ts`) injects `SettingsService` and applies the same default-merge logic before laying out the document. Hardcoded brand hex codes (`#FF611E`, etc.) have been replaced with theme lookups, so a customer-specific PDF matches the on-screen experience.

**Light palette only.** PDFs render in light mode regardless of the customer's OS preference. The dark palette is preserved on the document (for the browser view) but not consulted during PDF generation.

## Frontend Token Bridge

`projects/app/app/utils/offer-theme.ts` is the single place where theme values become CSS:

- `hexToHsl` / `hslToHex` — color-space conversions
- `generateColorScale(anchor)` — produces a Tailwind-style 50…950 scale
- `buildCssVarsForMode(colors)` — emits one block of `--ui-color-{family}-{step}` variables
- `buildOfferThemeCss(theme)` — emits a `<style>` block scoped to `[data-offer-theme="active"]` containing both light and dark variable sets
- `applyThemeReset(current, scope, defaults)` — pure function used by the Reset buttons

Because the CSS scope is data-attribute-driven, the offer page can opt in/out at runtime without re-rendering, and the rest of the app (dashboard, settings, etc.) remains unaffected by an offer's palette.

## Test Coverage

| Layer | File |
|-------|------|
| Backend offer model | `projects/api/tests/modules/offer-rest.e2e-spec.ts` (theme persistence, validation) |
| Backend default theme | `projects/api/tests/modules/offer-theme-rest.e2e-spec.ts` (settings + per-offer merge, RBAC on `set_default_theme`) |
| Backend PDF | `projects/api/tests/modules/pdf-rest.e2e-spec.ts` (color resolution path) |
| Backend MCP | `projects/api/tests/modules/mcp-rest.e2e-spec.ts` (theme passthrough on create/update, `set_default_theme` / `get_default_theme`) |
| Frontend utils | `projects/app/tests/unit/offer-theme.spec.ts` (HSL math, scale generation, reset logic) |
| Frontend story | `projects/app/tests/e2e/offer-theme-story.spec.ts` (toggle, color picker, collapse-when-disabled, reset buttons) |

## Common Pitfalls

- **Setting only `light` without `dark`** — the API rejects partial palettes. Always send both.
- **Forgetting `enabled: true`** — colors land in the document but the renderer ignores them and falls back to the default. This is by design (so users can stash a palette without applying it).
- **Calling `set_default_theme` as non-admin** — the request returns 403. The MCP tool does not pre-check the role; rely on the API response.
- **Expecting `get_offer` to return the raw override** — it returns the effective theme. Read the offer document directly only if the distinction matters (rare).
- **Old MCP sessions** — adding the theme schemas requires reconnecting the MCP server; cached tool definitions in long-lived sessions will not include `theme` until the client re-handshakes.
