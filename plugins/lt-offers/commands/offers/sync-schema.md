---
description: Update content block schemas and NuxtUI component whitelist from the API and nuxt-ui-remote MCP
allowed-tools: Read, Write, Edit, Grep, Glob, Bash, Agent
---

# /offers:sync-schema — Sync Block Schemas & Component Whitelist

## When to Use This Command

- After API changes to content block types
- After NuxtUI version updates
- To verify the plugin's reference docs are up-to-date

## Workflow

### Step 1: Fetch Current Block Types from API

Read the API's content block model to identify any new or changed block types:
- `projects/api/src/server/modules/offer/content-block.model.ts`
- `projects/app/app/interfaces/offer.interface.ts`
- `projects/app/app/composables/useContentBlocks.ts`

### Step 2: Fetch NuxtUI Component Whitelist

If the `nuxt-ui-remote` MCP server is available, query it for the current list of available components.

Otherwise, check the renderer:
- `projects/app/app/components/ContentBlock/blocks/BlockRichComponentRenderer.vue`

### Step 3: Update Reference Documents

Update these files with any changes:
- `skills/creating-offers/reference/content-blocks.md`
- `skills/creating-offers/reference/custom-html-guide.md`
- `mcp-tools.service.ts` (CONTENT_BLOCKS_DOC constant)

### Step 4: Verify

Show what was updated and confirm the changes are consistent.
