---
description: Analyze a software project to extract technology stack, features, architecture, and capabilities for showroom showcase creation
argument-hint: "[project-path]"
allowed-tools: Read, Grep, Glob, Bash, Agent
---

# /showroom:analyze — Analyze a Software Project

## When to Use This Command

- User wants to analyze a project before creating a showcase
- User needs a structured report of a project's technology stack and features
- User asks what a project does or how it is built

## Workflow

### Step 1: Determine Project Path

If `$ARGUMENTS` is provided, use it as the project root. Otherwise, use the current working directory.

Verify the path contains a recognizable project manifest (`package.json`, `Cargo.toml`, `go.mod`, etc.).

### Step 2: Run Analysis Agent

Spawn the `project-analyzer` agent with the project path as context:

```
Analyze the project at <project-path>. Produce a full structured report covering all 8 analysis dimensions: technology stack, architecture, core features, API surface, testing strategy, UI/UX patterns, security measures, and performance optimizations. Every claim must be backed by a file:line reference.
```

### Step 3: Present Report

Display the analysis report to the user in a readable format:

```
Project Analysis: [Project Name]
================================

Technology Stack
----------------
[findings]

Architecture
------------
[findings]

Core Features
-------------
[findings]

...
```

### Step 4: Offer Next Steps

After presenting the report, ask:

> Would you like to create a showcase on showroom.lenne.tech based on this analysis?

If yes, invoke `/showroom:create` with the analysis report as context.
