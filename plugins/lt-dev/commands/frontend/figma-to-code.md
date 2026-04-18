---
description: Implement Figma designs as Nuxt 4 pages using project-local config
argument-hint: "[section-name-or-node-id] [--screen name] [--team] [--globals]"
allowed-tools: Bash(pnpm run:*), Bash(npm run:*), Bash(yarn run:*), Bash(npx:*), Bash(git:*), Bash(ls:*), Bash(cat:*), Bash(find:*), Read, Write, Edit, Glob, Grep, AskUserQuestion, Agent, mcp__plugin_lt-dev_figma-desktop__get_metadata, mcp__plugin_lt-dev_figma-desktop__get_design_context, mcp__plugin_lt-dev_figma-desktop__get_screenshot, mcp__plugin_lt-dev_figma-desktop__get_variable_defs, mcp__nuxt-ui-remote__list-components, mcp__nuxt-ui-remote__get-component-metadata, mcp__nuxt-ui-remote__search-components-by-category, mcp__nuxt-ui-remote__get-example
disable-model-invocation: true
---

# Figma-to-Code Implementation

Implement Figma designs as Nuxt 4 / Nuxt UI pages using the project-local configuration.

## Prerequisites

Run these commands first if not done:
1. `/lt-dev:frontend:figma-research <figma-url>` — discover Figma structure
2. `/lt-dev:frontend:figma-init <figma-url>` — extract design system (colors, spacing, layouts)

## Input

You receive: `$ARGUMENTS`

This can be:

- Section name: `Dashboard`, `Teams`, `Riders & Staff`
- Node ID: `2:77610`
- Optional `--screen <name>` to implement a single screen
- Optional `--team` to use agent team for parallel implementation
- Optional `--globals` to implement only global components (Header, Sidebar, etc.)

## Step 1: Load Project Config

Read `.claude/figma-project.json`. If it doesn't exist, stop with:

```
Projekt-Konfiguration nicht gefunden.
Fuehre zuerst /lt-dev:frontend:figma-research <figma-url> aus.
```

Extract the file key and section data.

## Step 1.5: Check Design System

Check if `designSystem.initialized` is set in the project config.

If missing AND the Figma file uses hex colors instead of `--ui-*` CSS variables:

```
Design System nicht konfiguriert.
Fuehre zuerst /lt-dev:frontend:figma-init <figma-url> aus.
```

If design system is configured, load the `colorMappings`, `spacingMappings`, and `radiusMappings` for use during implementation.

## Step 1.6: Handle --globals Flag

If `--globals` flag OR called without a specific screen:

### 1.6.1: Scan Frame for Global Components

| Type | Recognition Pattern | Target |
|------|---------------------|--------|
| Header | Top-positioned, full-width bar | `components/layout/AppHeader.vue` |
| Sidebar | Left/right positioned, vertical nav | `components/layout/AppSidebar.vue` |
| Footer | Bottom-positioned, full-width | `components/layout/AppFooter.vue` |
| Modal | Overlay with centered content | `components/modals/<Name>Modal.vue` |
| Toast/Alert | Floating notification pattern | Via `useToast()` composable |
| Navigation | Repeated across screens | `components/layout/AppNav.vue` |

### 1.6.2: Automatic Detection

```
get_metadata(nodeId: "<frame-id>")
```

Check for:
- Overlay elements (e.g., modal backdrop with opacity)
- Repeated Header/Footer/Sidebar structures
- Toast/Notification patterns (floating, corner-positioned)

### 1.6.3: Modal Detection and Implementation

When a frame shows a modal (recognizable by overlay/backdrop):

1. **Identify modal content** — centered element above backdrop
2. **Extract as component** in `components/modals/<Name>Modal.vue`
3. **Use programmatic pattern:**
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

4. **Open via `useOverlay()`** in the screen (not `useModal`)

### 1.6.4: Standard --globals Workflow

1. Read `globalComponents` array from `figma-project.json`
2. For each component with `status: "pending"`:
   - Get screenshot and design context
   - Generate Vue component using NuxtUI
   - **Modal type:** Save to `components/modals/`, use programmatic pattern
   - **Layout type:** Save to `components/layout/`
   - Update status to "implemented"
3. Read `layouts` array and implement layout files
4. Exit after completing global components

## Step 1.7: Validate Layouts Against Current Figma

**CRITICAL: Validate layouts and globalComponents against current Figma!**

For each entry in `layouts[]` and `globalComponents[]`:

```
get_metadata(nodeId: "<component.nodeId>")
```

- If node doesn't exist → warn user, offer to remove from config
- If structure changed → flag for re-implementation
- Cross-check for new recurring elements not yet in globalComponents

## Step 2: Resolve Section

Match the argument against sections in the config:

1. **By name** (case-insensitive, partial match OK): "dashboard" matches "Dashboard"
2. **By node ID** (exact match): "2:77610"
3. **If ambiguous**, ask the user to clarify via AskUserQuestion

## Step 3: Discover Screens

If the section's `screens` array is empty or `--screen` was not provided:

```
get_metadata(nodeId: "<section-node-id>")
```

Parse child frames as screens. Update `figma-project.json` with discovered screens.

## Step 4: Select Screens to Implement

- If `--screen` was provided, find the matching screen
- Otherwise, present all screens:

```
Screens in "<section-name>":

| # | Screen | Node ID | Status |
|---|--------|---------|--------|
| 1 | dashboard - key figures | 2:77611 | pending |
| 2 | dashboard - reminders | 851:38745 | pending |
| ... | ... | ... | ... |

Welche Screens sollen implementiert werden? (Nummern, z.B. "1,2,3" oder "alle")
```

Skip screens with status "implemented" unless explicitly requested.

## Step 5: Implement (Sequential or Team)

### Sequential (default)

For each selected screen:

1. **Screenshot** — `get_screenshot(nodeId: "<screen-node-id>")` for visual overview
2. **Metadata** — `get_metadata(nodeId: "<screen-node-id>")` to find child components
3. **Design Context** — `get_design_context` on specific child components (tables, cards, etc.)
   - NEVER on the full screen frame (token limit!)
   - Target one component type at a time
4. **Extract** — Pull out columns, data, icons, colors, component types
5. **NuxtUI MCP** — Query NuxtUI MCP for component props/slots before writing code:
   - `search-components-by-category("forms")` to find components
   - `get-component-metadata("UTable")` for props/slots
   - `get-example("UButton", "with-icon")` for examples
6. **Generate** — Create Vue page file:
   - Apply color mappings from design system
   - Use semantic colors (`text-primary`, `bg-error`) — never hardcoded hex
   - Use Tailwind spacing scale — never arbitrary values
   - Export images to `public/images/figma/` if needed
   - Strict TypeScript: typed refs, typed functions, no implicit any
   - German UI labels, English code
7. **Update status** — Mark screen as "implemented" in `figma-project.json`

### Team Mode (`--team`)

Use when 3+ screens need implementation:

1. **Lead** extracts all screen data from Figma (screenshots + design context for each)
2. Spawn `frontend-dev` agents via Agent tool to implement screens in parallel (max 3)
3. Each agent gets: screenshot data, design context, color/spacing mappings, NuxtUI reference
4. After all screens done, spawn `lt-dev:code-reviewer` for review

## Step 5.5: Fidelity Validation

**CRITICAL: Validate after every screen implementation!**

### Checklist

```
Fidelity-Check fuer Screen "<screen-name>":

□ Alle Texte aus dem Design vorhanden?
□ Alle Icons aus dem Design vorhanden?
□ KEINE zusaetzlichen Elemente eingefuegt?
□ Styling (Farben, Abstaende, Radien) entspricht Design?
□ Reihenfolge der Elemente korrekt?
□ Mock-Daten entsprechen den Werten im Design?
```

### Corrections

- Fix deviations from design
- NEVER "improve" or "add to" the design
- Only remove what's not in the design

### FORBIDDEN

```
❌ "Ich fuege noch einen Button hinzu der sinnvoll waere"
❌ "Diese Section braucht eigentlich noch einen Header"
❌ "Ich ergaenze Mock-Daten fuer bessere Darstellung"
❌ "Ein Loading-State waere hier hilfreich"
❌ "Ich fuege noch Tooltips hinzu"
❌ "Das Icon passt besser als das im Design"
```

The design is the ONLY truth. If something is missing, it's missing.

## Step 6: Post-Implementation

After all screens are implemented:

1. **Update config** — Mark section status in `figma-project.json`
2. **Lint** — Run `pnpm run lint:fix` in the frontend project directory
3. **Type check** — Run `pnpm dlx tsc --noEmit` to verify zero TypeScript errors
4. **Report:**

```
Implementierung abgeschlossen!

Section: <section-name>
Screens implementiert: <count>

Erstellte Dateien:
- pages/app/<area>/<view>.vue
- components/<feature>/<Component>.vue
- ...

Naechste Schritte:
1. pnpm run dev                       -- Dev-Server starten
2. Browser-Test via Chrome DevTools   -- Visuellen Vergleich mit Figma
3. /lt-dev:review                     -- Code Review starten
```

## Important Notes

- Mock data should use `ref<Type>()` with realistic German labels and values
- Use `useOverlay()` for modals — never inline `v-model:open`
- Use `consola.withTag()` — never `console.log`
- All form inputs need correct `autocomplete` attributes
- Every data component needs Loading/Empty/Error states
- Components must follow feature-based folder structure
- When encountering duplicate frame names, use row counts and column structure to differentiate variants
