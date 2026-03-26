---
name: analyzing-projects
description: |
  Analyzes software projects to extract technology stack, architecture, features, API surface,
  testing strategy, UI/UX patterns, security measures, and performance optimizations. Produces
  structured, evidence-based reports where every claim is backed by a source code reference.
  Activates when analyzing a project for showroom showcases, portfolio entries, project
  documentation, or when a user asks what a project does or how it is built.
---

# Analyzing Software Projects

This skill enables Claude Code to perform deep, evidence-based analysis of software projects and produce structured reports suitable for showcase creation on showroom.lenne.tech.

## When to Use This Skill

- User asks to analyze a project for a showcase or portfolio entry
- User wants to understand what a codebase does or how it is structured
- Running `/showroom:analyze`, `/showroom:create`, or `/showroom:update` commands
- Working inside the showroom platform repository on analysis features
- User asks about a project's technology stack, features, or architecture

## Skill Boundaries

| User Intent | Correct Skill |
|------------|---------------|
| Analyze project source code | **THIS SKILL** |
| Create or update a showcase | `creating-showcases` |
| Develop the showroom platform itself | `generating-nest-servers` / `developing-lt-frontend` |

## Related Skills

**Works closely with:**
- `creating-showcases` — Consumes analysis reports to build showcase content
- `generating-nest-servers` — For backend development on the showroom API

## Analysis Dimensions

Every project analysis covers exactly 8 dimensions. Read the full guide in `${CLAUDE_SKILL_DIR}/reference/analysis-dimensions.md`.

| # | Dimension | Purpose |
|---|-----------|---------|
| 1 | Technology Stack | Languages, frameworks, key libraries, runtimes |
| 2 | Architecture | Structure, patterns, separation of concerns |
| 3 | Core Features | User-facing capabilities backed by endpoints/components |
| 4 | API Surface | REST endpoints, GraphQL schema, auth mechanisms |
| 5 | Testing Strategy | Test types, frameworks, coverage breadth |
| 6 | UI/UX Patterns | Component libraries, responsive design, accessibility |
| 7 | Security Measures | Auth, validation, rate limiting, encryption |
| 8 | Performance Optimizations | Caching, query optimization, async patterns |

## Execution Protocol

1. **Discover** — Read manifest files to detect tech stack (`${CLAUDE_SKILL_DIR}/reference/framework-detection.md`)
2. **Map** — Glob for controllers, services, models, components, test files
3. **Deep-read** — Follow imports, read implementations for key findings
4. **Extract features** — Apply heuristics from `${CLAUDE_SKILL_DIR}/reference/feature-extraction.md`
5. **Compile** — Structure output according to `${CLAUDE_SKILL_DIR}/reference/report-schema.md`
6. **Validate** — Verify every claim has a `file:line` reference

## Validation Rules

- **No speculation** — Every feature claim needs a code reference
- **No marketing language** — Describe what the code does, not potential
- **Accurate names** — Use exact package names from dependency files
- **Honest coverage** — If tests are sparse, say so
- **No duplication** — Each finding in exactly one dimension

## Output Format

Produce a structured report following `${CLAUDE_SKILL_DIR}/reference/report-schema.md`.

Source references use the format: `path/to/file.ts:42`

Unknown or undeterminable items are marked as `unknown` — never guessed.

## Reference Files

- `${CLAUDE_SKILL_DIR}/reference/analysis-dimensions.md` — Detailed guide for each of the 8 dimensions
- `${CLAUDE_SKILL_DIR}/reference/framework-detection.md` — Framework detection lookup table
- `${CLAUDE_SKILL_DIR}/reference/feature-extraction.md` — Feature heuristics (auth, uploads, realtime, etc.)
- `${CLAUDE_SKILL_DIR}/reference/report-schema.md` — TypeScript interface for the structured report
