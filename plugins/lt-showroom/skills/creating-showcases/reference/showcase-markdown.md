# SHOWCASE.md Export Format

`SHOWCASE.md` is an **optional export** of a stored showcase into one of the organization's own repositories, for
readers of that repository. It is never the source of truth (the Showroom is), never read back by a command, and never
written into a customer's repository. `/lt-showroom:showroom:create --export` and `:update --export` write it from
`get_showcase`, after asking; the next export overwrites it.

## File Location

| Project Type | Path |
|---|---|
| Single-package project | `SHOWCASE.md` (project root) |
| Monorepo (frontend in `projects/app/`) | `docs/showcase/SHOWCASE.md` |
| Monorepo (backend in `projects/api/`) | `docs/showcase/SHOWCASE.md` |

## Frontmatter

```yaml
---
showcase_id: "6650f0c2a1b2c3d4e5f60789"   # the showcase in the Showroom
slug: "musterportal"                      # current slug (it follows project.alias)
editor: "https://showroom.lenne.tech/app/showcases/6650f0c2a1b2c3d4e5f60789"
exported_at: "2026-03-26"
analyzed_commit: "4f2a…"                  # source.analyzedCommit, full id
analyzed_at: "2026-03-26T09:12:00Z"       # source.analyzedAt
project: "Musterportal"                   # project.name
category: "web-app"                       # the showcase's category key
technologies:                             # the showcase's technologies field
  - NestJS
  - Nuxt
  - MongoDB
year: 2025                                # key facts as stored; leave out what is empty
duration: "6 Monate"
team_size: 4
platforms: [web, ios]
outcomes:
  - "-70 % Bearbeitungszeit"
---
```

## Body

The text blocks of the showcase in display order, with the placeholders filled with the real values (`get_showcase`
with `view: "real"`): the export lands in the organization's own repository, which names its own project anyway.

```markdown
# Musterportal

## Projektübersicht
<text of the "Projektübersicht" block, as Markdown>

## Features
### KI-Vektor-Matching
<feature-grid entry and the feature's custom-html block, as Markdown>

**Belege:** `src/server/modules/matching/matching.service.ts:42` (from the analysis report)

## Architektur
<text of the "Architektur" block>

## Ergebnis
<text of the "Ergebnis" block>
```

Screenshots are not copied into the repository: name the feature's images by caption only, the Showroom holds the
files. HTML in blocks becomes Markdown; layout-only markup (grids, inline styles) is dropped.

## Rules

- Written only for the organization's own repositories, never for a customer's
- Written only after the user confirmed the path
- Every value comes from the stored showcase or its `sourceCodeAnalysis`; nothing is added that the Showroom does not
  hold, so the export never drifts from it
