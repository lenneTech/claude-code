---
description: Analyze a software project and create a versioned SHOWCASE.md with features, architecture, and screenshot paths. If screenshots exist in docs/showcase/screenshots/, reference them. Otherwise, use placeholder paths that match the naming convention.
argument-hint: "[project-path]"
allowed-tools: Read, Grep, Glob, Bash(git:*), Bash(ls:*), Bash(node:*), Bash(mkdir:*), Bash(find:*), Agent, WebFetch
disable-model-invocation: true
---

# /showroom:analyze — Analyze Project and Create SHOWCASE.md

This command runs Phase 1 (analysis) and Phase 3 (SHOWCASE.md creation) of the showcase workflow. It produces a versioned `SHOWCASE.md` file in the project repository that serves as the single source of truth for all showcase content.

## When to Use This Command

- User wants to analyze a project before creating a showcase
- User needs a `SHOWCASE.md` file created or updated in a project
- User asks what a project does or how it is built
- Starting point before running `/showroom:screenshot` or `/showroom:create`

## Workflow

### Step 1: Determine Project Path

If `$ARGUMENTS` is provided, use it as the project root. Otherwise, use the current working directory.

Verify the path contains a recognizable project manifest (`package.json`, `Cargo.toml`, `go.mod`, etc.).

### Step 2: Run Analysis Agent

Spawn the `project-analyzer` agent with the project path as context:

```
Analyze the project at <project-path>.

Produce a full structured report covering:
1. All 8 analysis dimensions (tech stack, architecture, features, API surface, testing, UI/UX, security, performance)
2. A feature list with name, description, file:line evidence, and screenshot candidate page for each feature
3. A startupInfo block: how to start the app, required database, port, seed command, required env variables
4. A pagesInventory: all routes/views with auth level and associated feature

Every claim must be backed by a file:line reference. No speculation.
```

### Step 3: Read Current Version

After the analysis completes, read `package.json` from the project root to get the current `version` field. This version goes into the SHOWCASE.md frontmatter.

### Step 4: Create SHOWCASE.md

Write `SHOWCASE.md` to the project root (or `docs/showcase/SHOWCASE.md` for monorepos).

Follow the format defined in the `creating-showcases` skill reference at `showcase-markdown.md`.

Calculate version tracking fields:
```bash
version=$(node -p "require('./package.json').version" 2>/dev/null || echo "0.0.0")
source_hash=$(git rev-parse HEAD:projects 2>/dev/null || git rev-parse HEAD:src 2>/dev/null || git rev-parse HEAD^{tree} 2>/dev/null || echo "unknown")
last_commit=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
```

The file MUST contain:
- Frontmatter with `version`, `source_hash`, `last_commit`, `analyzed_at` (today), `project`, `technologies`, `category`, `customer`
- All sections: Überblick, Technologie-Stack, Features (minimum 6), Architektur, Technische Highlights, Ergebnis, Changelog
- Each feature section with description, `file:line` evidence, and screenshot placeholder paths
- Screenshot paths using the convention: `docs/showcase/screenshots/{feature-slug}-desktop.png`

### Step 5: Create Screenshot Directory Placeholder

Create the screenshot directory in the project:

```bash
mkdir -p <project-path>/docs/showcase/screenshots
```

Add a `.gitkeep` if the directory is empty so it is tracked by git.

### Step 6: Present Report

Display a summary to the user:

```
SHOWCASE.md created: <project-path>/SHOWCASE.md
Version:     1.2.0
Features:    8 features identified
Pages:       12 pages inventoried
Screenshots: 16 placeholders (run /showroom:screenshot to capture)
Startup:     pnpm run dev (port 3001, requires MongoDB)
```

### Step 7: Offer Next Steps

After presenting the summary, suggest:

> SHOWCASE.md is ready. Next steps:
> - Run `/showroom:screenshot` to capture screenshots for each feature
> - Or run `/showroom:create` to publish directly to showroom.lenne.tech
