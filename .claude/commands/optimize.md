---
description: Optimize this marketplace based on official Claude Code documentation and optional secondary sources
argument-hint: [sources...]
---

# Optimize Marketplace

Invoke the marketplace-optimizer skill to analyze and improve this Claude Code marketplace.

## What This Command Does

1. **Handles Secondary Sources**
   - If `--none` argument: Proceeds with primary sources only (no secondary sources)
   - If other arguments provided: Uses them as secondary sources
   - If no arguments: Asks user via normal text output for secondary sources (URLs and/or local files). User responds with a normal prompt. An empty response or "none" means: no secondary sources will be used.

2. **Validates Primary URLs**
   - Reads Primary URLs from CLAUDE.md
   - Checks each URL for availability
   - Updates CLAUDE.md if URLs changed

3. **Analyzes Marketplace**
   - Scans all plugins, skills, commands, agents, hooks
   - Compares against current best practices
   - Identifies optimization opportunities

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
# Interactive: Prompts for secondary sources
/optimize

# Skip secondary sources (primary sources only)
/optimize --none

# With secondary sources as arguments
/optimize https://blog.example.com/tips.md ./docs/notes.md

# Mix of URLs and local files
/optimize https://example.com/guide.md /path/to/local.md ./relative/file.md
```

## Source Detection

Sources are automatically detected by pattern:
- **URL**: Starts with `http://` or `https://`
- **Local file**: Everything else (relative or absolute paths)

## Related Commands

- `/lt-dev:plugin:check` - Quick validation without optimization
- `/lt-dev:plugin:element` - Create new elements

## Notes

- Primary sources (official docs) always take precedence
- Secondary sources with conflicting info are ignored
- All changes require user approval before execution
- No history references ("new", "updated") are added to files
