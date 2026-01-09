---
description: Optimize this marketplace based on official Claude Code documentation and optional secondary sources
argument-hint: [--update-cache|--skip-cache] [secondary-sources...]
---

# Optimize Marketplace

Invoke the marketplace-optimizer skill to analyze and improve this Claude Code marketplace.

## What This Command Does

1. **Cache Version Check** (automatic)
   - Checks if cached Claude Code version matches current version
   - Behavior depends on `updateBehavior` setting in `sources.json`:
     - `auto` (default): Update automatically when new version available
     - `always`: Always update without asking
     - `ask`: Ask user when new version available
     - `askAlways`: Always ask user (even if cache is current)
     - `never`: Never check or update
   - Use `--update-cache` to force update, `--skip-cache` to skip check

2. **Documentation Cache** (automatic)
   - Reads all `.md` files from `.claude/docs-cache/`
   - Contains: Claude Code docs AND GitHub sources (all in one place)
   - Single source of truth - no additional fetching required

3. **Secondary Sources** (simple prompt)
   - Prompts for optional additional sources (URLs/local files)
   - Empty input, "keine", "none", "no" = skip secondary sources
   - Or provide sources directly as command arguments

4. **Analyzes Marketplace**
   - Scans all plugins, skills, commands, agents, hooks
   - Compares against current best practices from documentation cache

5. **Presents Optimization List**
   - Shows all potential improvements
   - All options selected by default
   - Allows deselecting unwanted changes

6. **Executes Optimizations**
   - Runs approved changes in parallel where possible
   - Updates files following best practices
   - Provides completion summary

## Usage

```bash
# Interactive: Prompts for secondary sources (simple text input)
/optimize

# Force cache update first
/optimize --update-cache

# Skip cache update
/optimize --skip-cache

# With secondary sources (skips the prompt)
/optimize https://blog.example.com/tips.md ./docs/notes.md

# Mix of URLs and local files
/optimize https://example.com/guide.md /path/to/local.md ./relative/file.md
```

## Flags

| Flag | Description |
|------|-------------|
| `--update-cache` | Force cache update without version check |
| `--skip-cache` | Skip cache update entirely |

## Secondary Sources Prompt

When no sources are provided as arguments, a simple prompt asks for optional secondary sources:

```
Sekundäre Quellen (optional)

Zusätzliche Referenzen eingeben (URLs oder lokale Dateien), oder leer lassen:
```

- **Empty input / "keine" / "none" / "no"**: Skip secondary sources
- **Otherwise**: Parse as URLs and/or local file paths

## Source Detection

Sources are automatically detected by pattern:
- **URL**: Starts with `http://` or `https://`
- **Local file**: Everything else (relative or absolute paths)

## Related Commands

- `/lt-dev:plugin:check` - Quick validation without optimization
- `/lt-dev:plugin:element` - Create new elements

## Configuration

The cache update behavior can be configured in `.claude/docs-cache/sources.json`:

```json
"cache": {
  "claudeCodeVersion": "2.1.2",
  "lastUpdated": "2026-01-09T...",
  "updateBehavior": "auto"  // "never" | "always" | "auto" | "ask" | "askAlways"
}
```

| Behavior | Description |
|----------|-------------|
| `never` | Never check or update the cache |
| `always` | Always update without asking |
| `auto` | Update automatically when new version available (default) |
| `ask` | Ask user when new version available |
| `askAlways` | Always ask user (even if cache is current) |

## Notes

- **Documentation Cache** is the single source of truth (`.claude/docs-cache/`)
- Contains both code.claude.com docs and GitHub sources
- Cache update supports three source types:
  - `spa`: Single Page Applications (rendered with Playwright)
  - `html`: Direct HTML pages (converted via Turndown)
  - `md`: Direct Markdown files (downloaded as-is)
- Secondary sources prompt is skipped if sources are provided as arguments
- Secondary sources with conflicting info are ignored
- All changes require user approval before execution
- No history references ("new", "updated") are added to files
