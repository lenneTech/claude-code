---
description: Re-analyze a project and update its existing showcase on showroom.lenne.tech with fresh content, corrected technology badges, and improved descriptions
argument-hint: "[showcase-id]"
allowed-tools: Read, Grep, Glob, Bash, Agent
---

# /showroom:update — Update an Existing Showcase

## When to Use This Command

- User wants to refresh a showcase after project changes
- A showcase exists but content is outdated or incomplete
- User wants to improve content quality or add missing sections

## Workflow

### Step 1: Find the Showcase

If `$ARGUMENTS` is provided, use it as the showcase ID. Otherwise, ask:

> Which showcase should be updated? (provide showcase ID or name)

Use `list_showcases` MCP tool to find it if the user provides a name.

### Step 2: Fetch Current Showcase

Use `get_showcase` MCP tool to retrieve the full current showcase with all content blocks.

### Step 3: Analyze Against Current Code

Spawn the `project-analyzer` agent for a fresh analysis of the current codebase:

```
Analyze the project at <project-path>. Focus on what may have changed since the last showcase update: new features, changed architecture, updated dependencies, new test coverage. Produce a full structured report.
```

### Step 4: Identify Gaps and Outdated Content

Compare the current showcase content against the fresh analysis report:

- Technology badges that are missing or outdated
- Features that exist in code but are not in the showcase
- Architecture descriptions that no longer match the codebase
- Missing content block types (feature-grid, screenshot-gallery, etc.)

Report findings to the user:

```
Showcase Analysis: "[title]"
============================
Current: [block count] content blocks

Gaps found:
- [list of missing/outdated items]

Suggested additions:
- [list of improvements]
```

### Step 5: Apply Updates

After user approval, use `update_showcase` MCP tool to apply improvements:

- Update changed technology badges
- Add missing feature descriptions
- Revise architecture overview
- Add new content blocks for newly detected capabilities

Show a summary of changes made.

### Step 6: Offer Screenshot Refresh

Ask:

> Would you like to refresh the screenshots for this showcase?

If yes, invoke `/showroom:screenshot` with the showcase ID.
