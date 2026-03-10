---
description: Add a Code Conventions section to the project's CLAUDE.md with sensible defaults for Nuxt 4 / TailwindCSS projects
allowed-tools: Read, Write, Edit, Grep, Glob
---

# Initialize Code Conventions

Add a `## Code Conventions` section to the project's CLAUDE.md. If CLAUDE.md doesn't exist, create it.

## Steps

1. **Find CLAUDE.md**: Check for `CLAUDE.md` in the project root
2. **Check existing conventions**: If CLAUDE.md exists, check if `## Code Conventions` already exists
   - If it exists → show the user and ask if they want to replace or extend
3. **Detect project patterns**: Analyze the existing codebase briefly
   - Check `tailwind.config.ts` for custom theme extensions
   - Check `assets/css/` for existing global styles
   - Check component folder structure
4. **Insert conventions block**: Add or update the section

## Convention Template

Insert the following block, adapted to detected project patterns:

```markdown
## Code Conventions

### Tailwind & CSS

| Rule | Enforcement |
|------|-------------|
| Custom classes | Minimize — prefer Nuxt UI component props |
| `@apply` | Only in `assets/css/` global files — never in `.vue` components |
| Arbitrary values | Avoid `[13px]`, `[#ff6600]` — use Tailwind scale and semantic colors |
| Spacing | Use Tailwind scale: `gap-2`, `gap-4`, `gap-6`, `gap-8` — no magic numbers |
| Colors | Semantic only: `primary`, `error`, `success`, `warning`, `info`, `neutral` |
| Dark mode | Use semantic colors — avoid `bg-white`, `text-black` |
| Responsive | Mobile-first: base → `sm:` → `md:` → `lg:` |
| Class length | Max ~10 utilities per element — extract component if longer |
| Inline styles | Forbidden — use Tailwind classes |

### Component Patterns

| Rule | Enforcement |
|------|-------------|
| Repeated class combos | If used 3+ times → extract to child component |
| Template size | Max ~50 lines — split into child components |
| Script size | Max ~80 lines — extract into composables |
| Folder structure | Feature-based: `components/<feature>/` |

### Code Quality

| Rule | Enforcement |
|------|-------------|
| Logging | `consola.withTag()` — never raw `console.*` |
| User feedback | `useToast()` — never `alert()` |
| Validation | Valibot only — no Zod |
| Modals | Programmatic via `useOverlay()` — no inline `v-model:open` |
| State returns | `readonly()` from composables |
| Types | Explicit on every ref, computed, function — zero implicit any |
```

## Important

- **Preserve existing CLAUDE.md content** — only add/update the Code Conventions section
- **Adapt to project**: If the project already has custom Tailwind config or `@apply` patterns in `assets/css/`, acknowledge those in the conventions
- Inform the user that the frontend-reviewer agent will automatically check these conventions
