---
description: Extract design system from Figma (colors, spacing, radius, fonts, global components) and configure NuxtUI + Tailwind v4 theme
argument-hint: [figma-url-or-node-id] [--force]
allowed-tools: Bash(pnpm run:*), Bash(npm run:*), Bash(yarn run:*), Bash(npx:*), Bash(git:*), Bash(ls:*), Bash(cat:*), Bash(find:*), Read, Write, Edit, Glob, Grep, AskUserQuestion, mcp__figma-desktop__get_metadata, mcp__figma-desktop__get_variable_defs, mcp__figma-desktop__get_screenshot, mcp__figma-desktop__get_design_context
disable-model-invocation: true
---

# Figma Design System Initialization

**Purpose:** Extract design tokens from Figma and configure NuxtUI + Tailwind v4 theme. Run BEFORE implementing individual screens.

## Input

You receive: `$ARGUMENTS`

- A Figma URL: `https://www.figma.com/design/...`
- A node ID for a specific page: `0:1`
- Optional `--force` to overwrite existing configuration

## Step 1: Validate Prerequisites

1. Check if Figma MCP tools are available
2. Check if `.claude/figma-project.json` exists (run `/lt-dev:frontend:figma-research` first if not)
3. Check if design system is already configured (unless `--force`)

```
Falls .claude/figma-project.json nicht existiert:
-> "Fuehre zuerst /lt-dev:frontend:figma-research <figma-url> aus, um die Projekt-Konfiguration zu generieren."
```

## Step 2: Extract Design Tokens from Figma

Use `get_variable_defs` to extract all design variables:

```
get_variable_defs(nodeId: "<page-id>")
```

Returns variables in format: `{'category/name': value}`

### Token Categories to Extract

| Figma Pattern | Category | Example |
|---------------|----------|---------|
| `brand/*`, `primary/*` | Primary Color | `brand/500: #3b82f6` |
| `secondary/*`, `accent/*` | Secondary Color | `secondary/main: #6366f1` |
| `surface/*`, `background/*` | Surface Colors | `surface/elevated: #f8fafc` |
| `text/*`, `foreground/*` | Text Colors | `text/primary: #0f172a` |
| `success/*`, `positive/*` | Success Color | `success/500: #22c55e` |
| `error/*`, `danger/*`, `destructive/*` | Error Color | `error/500: #ef4444` |
| `warning/*`, `alert/*` | Warning Color | `warning/500: #f59e0b` |
| `info/*` | Info Color | `info/500: #3b82f6` |
| `neutral/*`, `gray/*`, `grey/*` | Neutral Scale | `neutral/500: #737373` |
| `spacing/*`, `space/*`, `gap/*` | Spacing | `spacing/md: 16` |
| `radius/*`, `corner/*`, `rounded/*` | Border Radius | `radius/lg: 12` |
| `font/*`, `typography/*` | Typography | `font/sans: Inter` |
| `size/*`, `width/*`, `height/*` | Sizes | `size/icon: 24` |

## Step 3: Identify Global Components from Figma

**CRITICAL: Only use components found in the current Figma design!**

### 3.1: Scan All Screens

```
get_metadata(nodeId: "<page-id>")
```

For each screen/frame:
- Identify top-level children (Header, Footer, Sidebar, Content areas)
- Note names and Node IDs

### 3.2: Detect Recurring Elements

Compare top-level structures between screens:

| Criterion | Meaning |
|-----------|---------|
| Same name + similar position | Potentially global |
| Element in >50% of screens | Layout candidate |
| Identical structure in multiple frames | Reusable component |

### 3.3: Detect Modals & Overlays

For each screen, check for overlay patterns:
- Backdrop elements (semi-transparent overlays)
- Centered content on top of backdrop → Modal candidate
- Corner-positioned floating elements → Toast/Notification pattern

| Type | Recognition Pattern | Target |
|------|---------------------|--------|
| Header | Top-positioned, full-width bar | `components/layout/AppHeader.vue` |
| Sidebar | Left/right positioned, vertical nav | `components/layout/AppSidebar.vue` |
| Footer | Bottom-positioned, full-width | `components/layout/AppFooter.vue` |
| Modal | Overlay with centered content | `components/modals/<Name>Modal.vue` |
| Navigation | Repeated across screens | `components/layout/AppNav.vue` |

### 3.4: User Confirmation

Show detected elements and ask for confirmation:

```
Wiederkehrende Elemente im Figma erkannt:

| Element | Node ID | Gefunden in | Empfehlung |
|---------|---------|-------------|------------|
| Header | 123:456 | Dashboard, Settings, Profile (3/3) | → Layout |
| Sidebar | 123:789 | Dashboard, Settings, Profile (3/3) | → Layout |
| SettingsModal | 789:012 | Settings (Overlay) | → Modal |
| Footer | 123:999 | Landing, About (2/5) | → Eigene Komponente |

Welche Elemente sollen ins Layout aufgenommen werden?
```

Use AskUserQuestion for confirmation.

### 3.5: NO Assumptions!

**FORBIDDEN:**
- Components not in the Figma design
- Fallback to "standard layouts" (Header, Footer, Sidebar)
- Template elements from other projects
- Assumptions about navigation/layout

If nothing found → `{ "globalComponents": [], "layouts": [] }` — this is CORRECT.

## Step 4: Present Findings to User

Show extracted tokens and ask for semantic mapping:

```
Design Tokens gefunden:

FARBEN:
| Figma Token | Wert | Vorgeschlagene Zuordnung |
|-------------|------|--------------------------|
| brand/500 | #3b82f6 | primary-500 |
| brand/600 | #2563eb | primary-600 |
| accent/main | #6366f1 | secondary-500 |
| danger/500 | #ef4444 | error-500 |
| positive/500 | #22c55e | success-500 |

SPACING:
| Token | Wert | Tailwind Equivalent |
|-------|------|---------------------|
| spacing/xs | 4px | xs (0.25rem) |
| spacing/sm | 8px | sm (0.5rem) |
| spacing/md | 16px | md (1rem) |

RADIEN:
| Token | Wert | Tailwind Equivalent |
|-------|------|---------------------|
| radius/sm | 4px | sm (0.25rem) |
| radius/md | 8px | md (0.5rem) |
| radius/lg | 12px | lg (0.75rem) |

GLOBALE KOMPONENTEN:
| Komponente | Node ID | Verwendet in |
|------------|---------|--------------|
| AppHeader | 123:456 | Dashboard, Settings, Profile |
| SidebarNav | 123:789 | Dashboard, Settings, Profile |

Sind die Zuordnungen korrekt? Aenderungen?
```

Use AskUserQuestion for:
- Confirming primary color mapping
- Confirming global component identification
- Any ambiguous token assignments

## Step 5: Generate Color Scale

For primary/secondary colors, generate a full Tailwind color scale (50-950):

**Input:** Single color value (e.g., `#3b82f6`)
**Output:** Full scale from lightest (50) to darkest (950)

Use HSL manipulation:
- 50: Lightness ~97%
- 100: Lightness ~94%
- 200: Lightness ~86%
- 300: Lightness ~76%
- 400: Lightness ~62%
- 500: Base color (main)
- 600: Lightness ~48%
- 700: Lightness ~39%
- 800: Lightness ~31%
- 900: Lightness ~24%
- 950: Lightness ~14%

## Step 6: Configure NuxtUI Theme

Update or create `app.config.ts`:

```typescript
export default defineAppConfig({
  ui: {
    colors: {
      primary: 'primary',
      secondary: 'secondary',
      success: 'success',
      warning: 'warning',
      error: 'error',
      info: 'info',
      neutral: 'neutral'
    }
  }
})
```

## Step 7: Configure Tailwind v4 CSS Theme

Update the main CSS file (typically `assets/css/main.css` or `app.css`):

```css
@theme {
  /* Primary Color Scale (from Figma brand/primary tokens) */
  --color-primary-50: #f0f9ff;
  --color-primary-100: #e0f2fe;
  --color-primary-200: #bae6fd;
  --color-primary-300: #7dd3fc;
  --color-primary-400: #38bdf8;
  --color-primary-500: #3b82f6;   /* Main */
  --color-primary-600: #2563eb;
  --color-primary-700: #1d4ed8;
  --color-primary-800: #1e40af;
  --color-primary-900: #1e3a8a;
  --color-primary-950: #172554;

  /* Secondary Color Scale */
  --color-secondary-50: /* ... */;
  --color-secondary-500: /* from Figma */;
  /* ... full 50-950 scale */

  /* Semantic Colors (full scales) */
  --color-success-500: #22c55e;
  --color-warning-500: #f59e0b;
  --color-error-500: #ef4444;
  --color-info-500: #3b82f6;

  /* Neutral Scale */
  --color-neutral-50: /* ... */;
  --color-neutral-500: /* from Figma */;
  /* ... full 50-950 scale */

  /* Spacing */
  --spacing-xs: 0.25rem;  /* 4px */
  --spacing-sm: 0.5rem;   /* 8px */
  --spacing-md: 1rem;     /* 16px */
  --spacing-lg: 1.5rem;   /* 24px */
  --spacing-xl: 2rem;     /* 32px */

  /* Border Radius */
  --radius-sm: 0.25rem;   /* 4px */
  --radius-md: 0.5rem;    /* 8px */
  --radius-lg: 0.75rem;   /* 12px */
  --radius-xl: 1rem;      /* 16px */
  --radius-full: 9999px;

  /* Typography */
  --font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif;
}
```

**Naming rules:**
- NO prefixes like `figma-` or `custom-`
- Use standard Tailwind/NuxtUI names: `primary`, `secondary`, `success`, etc.
- Generate full color scales (50-950) for all semantic colors
- Map Figma values to nearest Tailwind scale step

## Step 8: Create Global Layout Components

For each confirmed global component:

### Layout Components (Header, Sidebar, Footer)

Generate Vue components in `components/layout/`:

```vue
<script setup lang="ts">
// Composables and state from Figma structure
</script>

<template>
  <!-- Implement from Figma screenshot + design context -->
  <!-- Use NuxtUI components, semantic colors, Tailwind classes -->
</template>
```

### Modal Components

Generate in `components/modals/` using programmatic pattern:

```vue
<script setup lang="ts">
const modal = useModal()
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <h3>Modal Title</h3>
        <UButton icon="i-lucide-x" variant="ghost" aria-label="Schließen" @click="modal.close()" />
      </div>
    </template>

    <!-- Modal content from Figma -->

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton color="neutral" @click="modal.close()">Abbrechen</UButton>
        <UButton @click="handleSubmit">Speichern</UButton>
      </div>
    </template>
  </UCard>
</template>
```

### Layout Files

Generate in `layouts/`:

```vue
<script setup lang="ts">
// Layout composables
</script>

<template>
  <div class="flex min-h-screen">
    <AppSidebar />
    <div class="flex flex-1 flex-col">
      <AppHeader />
      <main class="flex-1 p-6">
        <slot />
      </main>
    </div>
  </div>
</template>
```

## Step 9: Update figma-project.json

Add design system configuration and global components:

```json
{
  "fileKey": "...",
  "designSystem": {
    "initialized": true,
    "lastUpdated": "2025-01-15T10:30:00Z",
    "colorMappings": {
      "#3b82f6": "primary-500",
      "#2563eb": "primary-600",
      "#ef4444": "error-500",
      "#22c55e": "success-500"
    },
    "spacingMappings": {
      "4": "xs",
      "8": "sm",
      "16": "md",
      "24": "lg",
      "32": "xl"
    },
    "radiusMappings": {
      "4": "sm",
      "8": "md",
      "12": "lg",
      "16": "xl"
    }
  },
  "globalComponents": [
    {
      "name": "AppHeader",
      "type": "layout",
      "nodeId": "123:456",
      "usedIn": ["Dashboard", "Settings", "Profile"],
      "targetPath": "components/layout/AppHeader.vue",
      "status": "implemented"
    },
    {
      "name": "SettingsModal",
      "type": "modal",
      "nodeId": "789:012",
      "targetPath": "components/modals/SettingsModal.vue",
      "status": "implemented"
    }
  ],
  "layouts": [
    {
      "name": "DashboardLayout",
      "components": ["AppHeader", "SidebarNav"],
      "targetPath": "layouts/dashboard.vue",
      "status": "implemented"
    }
  ]
}
```

## Step 10: Report

```
Design System initialisiert!

Farben:
- Primary: #3b82f6 (volle Scale 50-950 generiert)
- Secondary: #6366f1 (volle Scale 50-950 generiert)
- Success: #22c55e
- Warning: #f59e0b
- Error: #ef4444

Spacing: xs (4px), sm (8px), md (16px), lg (24px), xl (32px)
Radien: sm (4px), md (8px), lg (12px), xl (16px)
Font: Inter

Globale Komponenten:
- AppHeader (verwendet in 5 Screens) → components/layout/AppHeader.vue
- SidebarNav (verwendet in 5 Screens) → components/layout/SidebarNav.vue
- SettingsModal (Overlay in Settings) → components/modals/SettingsModal.vue

Layout:
- DashboardLayout (Header + Sidebar) → layouts/dashboard.vue

Generierte/Aktualisierte Dateien:
- app.config.ts (NuxtUI Theme)
- assets/css/main.css (@theme mit Tailwind v4 Variablen)
- components/layout/AppHeader.vue
- components/layout/SidebarNav.vue
- components/modals/SettingsModal.vue
- layouts/dashboard.vue
- .claude/figma-project.json (Design System + Global Components)

Naechste Schritte:
1. pnpm run dev                                     -- Dev-Server starten
2. Browser-Test via Chrome DevTools                  -- Layout pruefen
3. /lt-dev:frontend:figma-to-code <section>          -- Einzelne Screens implementieren
4. /lt-dev:frontend:figma-to-code <section> --team   -- Mit Agent-Team implementieren
```

## Important Rules

- **Always use `get_variable_defs`** to extract design tokens
- **Global components first** — implement shared components before individual screens
- **Standard naming** — use Tailwind/NuxtUI standard names, not custom prefixes
- **Color scales** — generate full 50-950 scales for all semantic colors
- **Confirm with user** — always get confirmation for semantic color assignments
- **Only from Figma** — NEVER invent components or layouts not in the design
- **Semantic colors** — enforce `text-primary`, `bg-error` etc., never hardcoded hex
- **Accessibility** — `aria-label` on icon-only buttons, semantic HTML in layouts
- **German UI labels** — button text, modal titles, placeholder text in German
