---
description: Discover Figma file structure and generate project-local config for figma-to-code
argument-hint: [figma-url-or-file-key] [--page page-name]
allowed-tools: Bash(pnpm run:*), Bash(npm run:*), Bash(yarn run:*), Bash(npx:*), Bash(git:*), Bash(ls:*), Bash(cat:*), Bash(find:*), Read, Write, Glob, Grep, AskUserQuestion, mcp__figma-desktop__get_metadata, mcp__figma-desktop__get_screenshot
disable-model-invocation: true
---

# Figma Research

**IMPORTANT: This command is RESEARCH ONLY. Do NOT implement any code, pages, or components. Do NOT use `get_design_context`. Only discover the Figma file structure and save configuration files.**

Discover the structure of a Figma file and generate project-local configuration for the `/lt-dev:frontend:figma-init` and `/lt-dev:frontend:figma-to-code` workflow.

## Input

You receive: `$ARGUMENTS`

This can be:
- A full Figma URL: `https://www.figma.com/design/73iSerjmEUAoA2uGQ4VpR2/...`
- A file key only: `73iSerjmEUAoA2uGQ4VpR2`
- Optional `--page <name>` to skip page selection

## Step 1: Validate MCP Server

Check if Figma MCP tools are available. If not, inform the user that the Figma MCP server must be configured globally.

## Step 2: Parse Input

Extract the file key from the input:
- Regex for URLs: `/figma\.com\/(?:design|file)\/([a-zA-Z0-9]+)/`
- If no match, treat the entire argument as a file key
- Validate: file key should be alphanumeric, typically 20+ characters

## Step 3: Get File Metadata

```
get_metadata(nodeId: "0:0")  // root node
```

This returns the file name and list of pages. Extract:
- File name
- All pages with their IDs and names

## Step 4: Select Page

If `--page` was provided, match by name (case-insensitive). Otherwise:
- If only one page exists, use it automatically
- If multiple pages exist, ask the user which page to use via AskUserQuestion

## Step 5: Discover Sections

```
get_metadata(nodeId: "<page-id>")
```

Parse the response to find all top-level `<section>` elements. For each section, extract:
- `name` attribute (section name)
- `id` attribute (node ID)

## Step 6: Generate Route Mapping

For each section, suggest a route based on the section name:
1. Convert to kebab-case
2. Prefix with `/app/`
3. Handle common patterns:
   - "Dashboard" → `/app/dashboard`
   - "Records-Offers" → `/app/offers`
   - "Landingpage - Login" → `/login`
   - "Categories & Articles" → `/app/categories-articles`

Present the mapping to the user for confirmation:

```
Gefundene Sections:

| Section | Node ID | Vorgeschlagene Route |
|---------|---------|----------------------|
| Dashboard | 2:77610 | /app/dashboard |
| Teams | 1:44517 | /app/teams |
| ... | ... | ... |

Sind die Routes korrekt? Aenderungen?
```

Let the user confirm or modify routes via AskUserQuestion.

## Step 7: Optional Deep Discovery

Ask the user if they want to discover screens within each section (takes longer but provides more detail). If yes, for each section:

```
get_metadata(nodeId: "<section-node-id>")
```

Extract all child frames as screens with their names and node IDs.

## Step 8: Generate Project Config

Create `.claude/figma-project.json` in the current project root:

```json
{
  "fileKey": "<extracted-file-key>",
  "fileName": "<from-metadata>",
  "pageId": "<selected-page-id>",
  "pageName": "<selected-page-name>",
  "sections": [
    {
      "name": "Section Name",
      "nodeId": "2:77610",
      "route": "/app/section-name",
      "status": "pending",
      "screens": []
    }
  ]
}
```

If deep discovery was performed, populate `screens` arrays:

```json
"screens": [
  {
    "name": "section - view name",
    "nodeId": "123:456",
    "route": "/app/section/view-name",
    "status": "pending"
  }
]
```

## Step 9: Generate Sections Reference

Create `.claude/skills/figma-to-code/reference/figma-sections.md`:

```markdown
# Figma Sections -> App Routes

**File Key:** `<file-key>`
**Page:** <page-name> (`<page-id>`)

## Sections

| Section Name | Node ID | App Route | Status |
|---|---|---|---|
| Dashboard | `2:77610` | `/app/dashboard` | pending |
| ... | ... | ... | ... |
```

If deep discovery was performed, add a sub-table per section listing its screens.

## Step 10: Report

```
Figma Research abgeschlossen!

Datei: <file-name> (<file-key>)
Seite: <page-name>
Sections: <count>

Generierte Dateien:
- .claude/figma-project.json (Projekt-Konfiguration)
- .claude/skills/figma-to-code/reference/figma-sections.md (Section-Uebersicht)

Naechste Schritte:
1. /lt-dev:frontend:figma-init <url>               -- Design System extrahieren (Farben, Spacing, Layouts)
2. /lt-dev:frontend:figma-to-code <section-name>   -- Section implementieren
3. /lt-dev:frontend:figma-to-code <section> --team  -- Mit Agent-Team implementieren
```

## Important Notes

- **Only use `get_metadata`** in this command. Never use `get_design_context` — that's for implementation and costs many tokens.
- **`get_screenshot`** can be used sparingly if the user wants a visual preview of a section.
- If `.claude/figma-project.json` already exists, ask the user if they want to overwrite or merge (add new sections, keep existing status).
