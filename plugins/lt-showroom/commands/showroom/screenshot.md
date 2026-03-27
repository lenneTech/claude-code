---
description: Start the project (Docker or dev server), create demo data, and capture feature screenshots saved to docs/showcase/screenshots/
argument-hint: "[project-path]"
allowed-tools: Read, Grep, Glob, Bash(ls:*), Bash(mkdir:*), Bash(pnpm run:*), Bash(npm run:*), Bash(yarn run:*), Bash(kill:*), Bash(pkill:*), Bash(lsof:*), Agent
disable-model-invocation: true
---

# /showroom:screenshot — Capture Feature Screenshots

This command runs Phase 2 of the showcase workflow: starts the application, creates realistic demo data, captures screenshots for each feature defined in `SHOWCASE.md`, and saves them to `docs/showcase/screenshots/` in the project.

## When to Use This Command

- User wants to capture screenshots for features listed in SHOWCASE.md
- User wants to refresh outdated screenshots after project changes
- Running after `/showroom:analyze` and before `/showroom:create`

## Workflow

### Step 1: Determine Project Path

If `$ARGUMENTS` is provided, use it as the project root. Otherwise, use the current working directory.

Verify the path contains a `SHOWCASE.md` file (or `docs/showcase/SHOWCASE.md`). If not found, suggest running `/showroom:analyze` first.

### Step 2: Read SHOWCASE.md

Parse `SHOWCASE.md` to extract:
- Feature list with screenshot candidate pages
- `startupInfo` block (startup method, port, database requirements, seed command)
- `pagesInventory` (all routes to visit)

If `SHOWCASE.md` does not contain a `startupInfo` block, run the project analysis inline to detect startup information.

### Step 3: Run Screenshot Agent

Spawn the `screenshot-generator` agent with full context:

```
Generate feature screenshots for the project at <project-path>.

Context from SHOWCASE.md:
- Features to capture: <feature list with page paths>
- Startup method: <startupInfo.method>
- Startup command: <startupInfo.command>
- Port: <startupInfo.port>
- Database required: <startupInfo.requiresDatabase>
- Database setup: <startupInfo.databaseSetup>
- Seed command: <startupInfo.seedCommand>
- Pages inventory: <pagesInventory>

Instructions:
1. Start the application using the startup method above
2. If a database is required and not running, start it via Docker
3. Create realistic demo data (run seed command if available, otherwise use UI)
4. For each feature, navigate to the screenshot candidate page
5. Capture desktop (1440x900) and mobile (390x844) screenshots
6. Save all screenshots to docs/showcase/screenshots/ using the naming convention:
   {feature-slug}-desktop.png and {feature-slug}-mobile.png
7. Also capture an overview screenshot: overview-desktop.png and overview-mobile.png
8. Stop all processes started in this session after completion
```

### Step 4: Verify Screenshots

After the agent completes, verify the screenshots were saved:

```bash
ls <project-path>/docs/showcase/screenshots/
```

Display a summary:

```
Screenshots captured: <count>
Location: docs/showcase/screenshots/

Files:
- overview-desktop.png (1440x900)
- overview-mobile.png (390x844)
- feature-1-desktop.png (1440x900)
- feature-1-mobile.png (390x844)
- ...
```

### Step 5: Update SHOWCASE.md

Replace screenshot placeholder paths in SHOWCASE.md with the actual file paths that were created. If a screenshot for a feature was not captured (error during capture), note it in the output.

### Step 6: Confirm Server Cleanup

Verify no background processes are still running from the screenshot session.

If orphaned processes remain, display the exact kill commands for the user to run manually.

### Step 7: Offer Next Steps

After successful capture, suggest:

> Screenshots saved to docs/showcase/screenshots/.
> Run `/showroom:create` to publish the showcase to showroom.lenne.tech.
