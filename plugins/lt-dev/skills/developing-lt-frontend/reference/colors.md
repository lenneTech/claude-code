# Nuxt UI Color System

Nuxt UI uses **semantic color naming** instead of hardcoded values. This enables consistent theming and easy dark/light mode switching.

## Semantic Colors

| Color | Default | Use For |
|-------|---------|---------|
| `primary` | green | Main CTAs, active navigation, brand elements |
| `secondary` | blue | Secondary buttons, alternative actions |
| `success` | green | Success messages, completed states |
| `info` | blue | Info alerts, tooltips, help text |
| `warning` | yellow | Warning messages, pending states |
| `error` | red | Error messages, validation errors, destructive actions |
| `neutral` | slate | Text, borders, backgrounds, disabled states |

## Configuration

### app.config.ts (Runtime)

```typescript
// app.config.ts
export default defineAppConfig({
  ui: {
    colors: {
      primary: 'green',     // Brand color
      secondary: 'blue',    // Alternative actions
      neutral: 'slate'      // Text, borders, backgrounds
    }
  }
})
```

**Available colors:** Any Tailwind default color (`blue`, `green`, `red`, `zinc`, etc.) or custom colors defined via `@theme`.

### Custom Brand Colors

Define custom colors in your CSS:

```css
/* app/assets/css/main.css */
@import "tailwindcss";
@import "@nuxt/ui";

@theme static {
  --color-brand-50: #fef2f2;
  --color-brand-100: #fee2e2;
  --color-brand-200: #fecaca;
  --color-brand-300: #fca5a5;
  --color-brand-400: #f87171;
  --color-brand-500: #ef4444;
  --color-brand-600: #dc2626;
  --color-brand-700: #b91c1c;
  --color-brand-800: #991b1b;
  --color-brand-900: #7f1d1d;
  --color-brand-950: #450a0a;
}
```

Then use in `app.config.ts`:

```typescript
export default defineAppConfig({
  ui: {
    colors: {
      primary: 'brand'
    }
  }
})
```

## CSS Utility Classes

### Semantic Color Classes

```vue
<template>
  <!-- Text colors -->
  <span class="text-primary">Primary text</span>
  <span class="text-secondary">Secondary text</span>
  <span class="text-success">Success text</span>
  <span class="text-error">Error text</span>
  <span class="text-warning">Warning text</span>
  <span class="text-info">Info text</span>
</template>
```

### Text Hierarchy

| Class | Use For |
|-------|---------|
| `text-highlighted` | Most prominent text |
| `text-default` | Normal body text |
| `text-toned` | Slightly dimmed text |
| `text-muted` | Secondary information |
| `text-dimmed` | Least prominent (hints, placeholders) |
| `text-inverted` | Text on inverted backgrounds |

```vue
<template>
  <h1 class="text-highlighted">Title</h1>
  <p class="text-default">Body text</p>
  <span class="text-muted">Secondary info</span>
  <span class="text-dimmed">Hint text</span>
</template>
```

### Backgrounds

| Class | Use For |
|-------|---------|
| `bg-default` | Main page background |
| `bg-muted` | Subtle background sections |
| `bg-elevated` | Cards, elevated surfaces |
| `bg-accented` | Highlighted sections |
| `bg-inverted` | Inverted backgrounds (dark on light, light on dark) |

```vue
<template>
  <div class="bg-default">Page background</div>
  <div class="bg-elevated">Card surface</div>
  <div class="bg-inverted text-inverted">Inverted section</div>
</template>
```

### Borders

| Class | Use For |
|-------|---------|
| `border-default` | Standard borders |
| `border-muted` | Subtle borders |
| `border-accented` | Emphasized borders |
| `border-inverted` | Inverted borders |

```vue
<template>
  <div class="border border-default">Standard border</div>
  <div class="border border-muted">Subtle border</div>
</template>
```

## Component Color Props

### Buttons

```vue
<template>
  <UButton color="primary">Speichern</UButton>
  <UButton color="secondary">Bearbeiten</UButton>
  <UButton color="error">Loschen</UButton>
  <UButton color="neutral" variant="outline">Abbrechen</UButton>
</template>
```

### Badges

```vue
<template>
  <UBadge color="success">Aktiv</UBadge>
  <UBadge color="warning">Ausstehend</UBadge>
  <UBadge color="error">Fehler</UBadge>
  <UBadge color="info">Info</UBadge>
</template>
```

### Alerts

```vue
<template>
  <UAlert color="success" title="Erfolgreich gespeichert" />
  <UAlert color="error" title="Fehler aufgetreten" />
  <UAlert color="warning" title="Achtung" />
  <UAlert color="info" title="Hinweis" />
</template>
```

### Toasts

```typescript
const toast = useToast()

// Success feedback
toast.add({
  title: 'Erfolgreich gespeichert',
  color: 'success',
  icon: 'i-lucide-check'
})

// Error feedback
toast.add({
  title: 'Fehler beim Speichern',
  color: 'error',
  icon: 'i-lucide-x'
})

// Warning
toast.add({
  title: 'Nicht gespeicherte Anderungen',
  color: 'warning',
  icon: 'i-lucide-alert-triangle'
})

// Info
toast.add({
  title: 'Neue Version verfugbar',
  color: 'info',
  icon: 'i-lucide-info'
})
```

## Dark/Light Mode

### Automatic Support

Nuxt UI integrates `@nuxtjs/color-mode` automatically. Colors adapt to the current mode.

### useColorMode Composable

```typescript
const colorMode = useColorMode()

// Get current mode
console.log(colorMode.value) // 'light' | 'dark' | 'system'

// Set mode
colorMode.preference = 'dark'
```

### Toggle Component

```vue
<script setup lang="ts">
const colorMode = useColorMode()

const isDark = computed({
  get: () => colorMode.value === 'dark',
  set: (value) => colorMode.preference = value ? 'dark' : 'light'
})
</script>

<template>
  <UButton
    :icon="isDark ? 'i-lucide-moon' : 'i-lucide-sun'"
    color="neutral"
    variant="ghost"
    @click="isDark = !isDark"
  />
</template>
```

### Built-in Components

```vue
<template>
  <!-- Simple button toggle -->
  <UColorModeButton />

  <!-- Switch toggle -->
  <UColorModeSwitch />

  <!-- Select dropdown -->
  <UColorModeSelect />
</template>
```

## Customizing CSS Variables

Override default shades in your CSS:

```css
/* app/assets/css/main.css */
@import "tailwindcss";
@import "@nuxt/ui";

/* Custom primary shade for light mode */
:root {
  --ui-primary: var(--ui-color-primary-600);
}

/* Custom primary shade for dark mode */
.dark {
  --ui-primary: var(--ui-color-primary-300);
}

/* Custom border radius */
:root {
  --ui-radius: 0.5rem;
}
```

## Anti-Patterns

```vue
<!--  DON'T: Hardcoded Tailwind colors -->
<span class="text-red-500">Error</span>
<span class="text-green-500">Success</span>
<UButton class="bg-blue-600">Action</UButton>

<!--  DO: Semantic colors -->
<span class="text-error">Error</span>
<span class="text-success">Success</span>
<UButton color="primary">Action</UButton>
```

```typescript
//  DON'T: Hardcoded toast colors
toast.add({ title: 'Error', color: 'red' })
toast.add({ title: 'Success', color: 'green' })

//  DO: Semantic toast colors
toast.add({ title: 'Error', color: 'error' })
toast.add({ title: 'Success', color: 'success' })
```

## Quick Reference

| Purpose | Class/Prop |
|---------|------------|
| Primary action | `color="primary"` |
| Secondary action | `color="secondary"` |
| Success state | `color="success"` |
| Error state | `color="error"` |
| Warning state | `color="warning"` |
| Info message | `color="info"` |
| Neutral/Cancel | `color="neutral"` |
| Main text | `text-default` |
| Muted text | `text-muted` |
| Card background | `bg-elevated` |
| Page background | `bg-default` |
| Standard border | `border-default` |
