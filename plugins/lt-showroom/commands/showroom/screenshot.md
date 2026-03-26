---
description: Start the project locally, capture screenshots across desktop/tablet/mobile viewports via Chrome DevTools, and upload them to a showcase on showroom.lenne.tech
argument-hint: "[showcase-id]"
allowed-tools: Read, Grep, Glob, Bash, Agent
---

# /showroom:screenshot — Capture and Upload Screenshots

## When to Use This Command

- User wants to add or refresh screenshots for a showcase
- User wants visual captures of the running application
- A showcase exists but has no screenshots yet

## Workflow

### Step 1: Identify Showcase

If `$ARGUMENTS` is provided, use it as the showcase ID. Otherwise, ask:

> Which showcase should the screenshots be uploaded to? (provide showcase ID or name)

Use `list_showcases` MCP tool to find the showcase if the user provides a name instead of an ID.

### Step 2: Confirm Project Path

Verify the current directory contains the project. If not, ask the user for the project path.

### Step 3: Run Screenshot Agent

Spawn the `screenshot-generator` agent with project path and showcase ID:

```
Generate screenshots for the project at <project-path>. Upload all captures to showcase <showcase-id> on showroom.lenne.tech. Follow the 7-phase workflow: detect project type, setup, start server, inject demo data, capture screenshots at desktop/tablet/mobile viewports, upload, and clean up all processes.
```

### Step 4: Report Results

After the agent completes, display:

```
Screenshots captured and uploaded:
- Desktop: [count] screenshots
- Tablet:  [count] screenshots
- Mobile:  [count] screenshots
- Total:   [count] screenshots

Showcase: https://showroom.lenne.tech/showcase/[slug]
```

If any screenshots failed, list them with error details.

### Step 5: Confirm Server Cleanup

Verify no background processes are still running from the screenshot session.
