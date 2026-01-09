---
description: Optimize this marketplace based on official Claude Code documentation and optional secondary sources
argument-hint: [--update-cache|--skip-cache] [sources...]
---

# Optimize Marketplace

Invoke the marketplace-optimizer skill to analyze and improve this Claude Code marketplace.

## What This Command Does

1. **Cache Update** (Default: ja)
   - Asks if documentation cache should be updated
   - If yes: Runs `bun .claude/scripts/update-docs-cache.ts` to download
     official docs from code.claude.com and convert to Markdown (~2 min)
   - Use `--update-cache` to auto-update, `--skip-cache` to skip

2. **Secondary Sources** (Default: keine)
   - Asks for optional secondary sources (URLs/local files)
   - Use `--none` to skip, or provide sources as arguments

3. **Analyzes Marketplace**
   - Reads cached documentation from `.claude/docs-cache/`
   - Scans all plugins, skills, commands, agents, hooks
   - Compares against current best practices

4. **Presents Optimization List**
   - Shows all potential improvements
   - All options selected by default
   - Allows deselecting unwanted changes

5. **Executes Optimizations**
   - Runs approved changes in parallel where possible
   - Updates files following best practices
   - Provides completion summary

## Usage

```bash
# Interactive: Prompts for cache update and secondary sources
/optimize

# Auto-update cache, no secondary sources
/optimize --update-cache --none

# Skip cache update, no secondary sources
/optimize --skip-cache --none

# Skip cache update, with secondary sources
/optimize --skip-cache https://blog.example.com/tips.md ./docs/notes.md

# Mix of URLs and local files
/optimize https://example.com/guide.md /path/to/local.md ./relative/file.md
```

## Flags

| Flag | Description |
|------|-------------|
| `--update-cache` | Auto-update cache without prompting |
| `--skip-cache` | Skip cache update without prompting |
| `--none` | No secondary sources |

## Source Detection

Sources are automatically detected by pattern:
- **URL**: Starts with `http://` or `https://`
- **Local file**: Everything else (relative or absolute paths)

## Related Commands

- `/lt-dev:plugin:check` - Quick validation without optimization
- `/lt-dev:plugin:element` - Create new elements

## Notes

- Documentation cache (`.claude/docs-cache/`) is the primary knowledge source
- Cache is updated via Playwright (renders JS) + Turndown (converts to MD)
- Secondary sources with conflicting info are ignored
- All changes require user approval before execution
- No history references ("new", "updated") are added to files
