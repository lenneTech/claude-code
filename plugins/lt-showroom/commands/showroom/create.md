---
description: Analyze a software project and create a complete showcase on showroom.lenne.tech with content blocks, technology badges, and feature descriptions
argument-hint: "[project-path]"
allowed-tools: Read, Grep, Glob, Bash, Agent
---

# /showroom:create — Create a Showcase

## When to Use This Command

- User wants to add a new project to showroom.lenne.tech
- User has a codebase and wants to publish a showcase for it
- User wants an automated showcase from source code analysis

## Workflow

### Step 1: Determine Project Path

If `$ARGUMENTS` is provided, use it as the project root. Otherwise, use the current working directory.

Verify the path is a recognizable software project.

### Step 2: Analyze the Project

Spawn the `project-analyzer` agent to perform a full analysis:

```
Analyze the project at <project-path>. Produce a full structured report covering technology stack, architecture, core features, API surface, testing strategy, UI/UX patterns, security measures, and performance optimizations.
```

Wait for the analysis report before continuing.

### Step 3: Gather Showcase Metadata

Ask the user for any details not extractable from code:

- **Showcase title** — (or suggest one from the project name)
- **Tagline** — One-sentence description (max 120 chars)
- **Project URL** — Live demo URL (if available)
- **Repository URL** — Source code link (if public)
- **Client / Company** — Who this project was built for (optional)
- **Status** — `draft` or publish immediately?

### Step 4: Build Content Blocks

Based on the analysis report, construct content blocks following the structure from `${CLAUDE_SKILL_DIR}/reference/content-blocks.md` and `${CLAUDE_SKILL_DIR}/reference/best-practices.md`.

Recommended block structure:
1. `tech-stack` — Technology badges from detected frameworks/libraries
2. `text` — Project overview (2-3 paragraphs, what it does and why)
3. `feature-grid` — Core features (3-6 items with icons and descriptions)
4. `screenshot-gallery` — Visual screenshots (added after `/showroom:screenshot`)
5. `text` — Architecture highlights (key design decisions, patterns used)
6. `text` — Technical depth (notable implementations, performance work)

### Step 5: Create the Showcase

Use the `create_showcase` MCP tool with all gathered data and content blocks.

Display the result:

```
Showcase created:
- Title:  [title]
- ID:     [id]
- URL:    https://showroom.lenne.tech/showcase/[slug]
- Status: [draft/published]
```

### Step 6: Offer Screenshot Capture

Ask:

> Would you like to capture screenshots for this showcase now? (runs the project locally)

If yes, invoke `/showroom:screenshot` with the new showcase ID.

### Step 7: Review

Ask if the user wants to:
- Adjust content blocks
- Change the status to published
- Add custom content (testimonials, team, timeline)
