---
description: Update content block schemas and showcase model reference docs from the showroom API and project source code
allowed-tools: Read, Write, Edit, Grep, Glob, Bash, Agent
---

# /showroom:sync-schema — Sync Showcase Schemas

## When to Use This Command

- After API changes to showcase model or content block types
- After adding new block types to the showroom platform
- To verify the plugin's reference docs match the current API

## Workflow

### Step 1: Fetch Current Block Types from API

Read the showroom API source to identify any new or changed content block types:
- `projects/api/src/server/modules/showcase/content-block.model.ts`
- `projects/api/src/server/modules/showcase/showcase.model.ts`
- `projects/app/app/interfaces/showcase.interface.ts`
- `projects/app/app/composables/useContentBlocks.ts` (if it exists)

### Step 2: Fetch Showcase Model Changes

Check the showcase model for new fields:
- `projects/api/src/server/modules/showcase/showcase.model.ts`
- `projects/api/src/server/modules/showcase/inputs/`

### Step 3: Update Reference Documents

Update these plugin reference files with any changes found:
- `skills/creating-showcases/reference/content-blocks.md`
- `skills/creating-showcases/reference/showcase-model.md`

### Step 4: Verify MCP Tool List

Check the showroom API MCP endpoint for any new or removed tools.

Update `skills/creating-showcases/SKILL.md` if the available MCP tools have changed.

### Step 5: Report

Show what was updated and confirm the changes are consistent across all reference files.
