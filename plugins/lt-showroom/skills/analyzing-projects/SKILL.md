---
name: analyzing-projects
description: 'Analyzes software projects to extract technology stack, architecture, features, API surface, testing strategy, UI/UX patterns, security measures, and performance optimizations. Produces structured, evidence-based reports where every claim is backed by a source code reference. Also detects how the application is started (scripts, Docker, database requirements) and enumerates all pages and views for screenshot planning. Outputs a structured report that feeds directly into SHOWCASE.md creation and screenshot automation. Activates when analyzing a project for showroom showcases, portfolio entries, project documentation, or when a user asks what a project does or how it is built. NOT for creating or publishing showcases (use creating-showcases). NOT for platform development (use generating-nest-servers).'
---

# Analyzing Software Projects

This skill enables Claude Code to perform deep, evidence-based analysis of software projects and produce structured reports suitable for SHOWCASE.md creation and showcase publishing on showroom.lenne.tech.

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
- `creating-showcases` — Consumes analysis reports to build SHOWCASE.md and showcase content
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

## Additional Analysis (Required for Phase 2+3)

Beyond the 8 dimensions, every analysis MUST also produce:

### Feature List with Evidence

For each feature, record:
- **Name** — short, action-oriented label (e.g. "Role-based Access Control")
- **Description** — 1-2 sentences describing what the feature does
- **Evidence** — `file:line` reference to the implementing code
- **Screenshot candidate** — which page/view best demonstrates this feature

Apply heuristics from `${CLAUDE_SKILL_DIR}/reference/feature-extraction.md` to detect features systematically.

### How to Get the Project Running (CRITICAL)

The analysis MUST produce a complete, actionable recipe to start the project from scratch. This is not optional — without it, screenshots cannot be taken and features cannot be verified.

Follow the full 8-step detection protocol in `${CLAUDE_SKILL_DIR}/reference/startup-detection.md`:

1. Project Structure & Package Manager
2. Dependency Installation
3. Environment Configuration
4. Database & External Services
5. Start Command
6. First User / Authentication Setup
7. Demo Data / Seed
8. Auth Routes & Login Pages

Output the findings as a `startupInfo` YAML block (schema in `${CLAUDE_SKILL_DIR}/reference/startup-detection.md`).

### Gotchas

- **Ports 3000/3001 are hardcoded in lenne.tech projects** — If another project is already running, screenshots will capture the wrong app. Always check `lsof -i :3000 -i :3001` before starting.
- **`.env.example` often hides required secrets** — Keys like `OPENAI_API_KEY`, `DIRECTUS_URL`, or database credentials look optional but the app will fail silently at runtime. Flag these as `envRequired`.
- **Tauri projects need web-only mode for screenshots** — If `src-tauri/` is present, the full `npm run dev` builds the desktop app. Use `npx nuxt dev` directly to bypass Tauri and get a browser-accessible dev server on port 3001.

### Pages and Views Inventory

List all navigable pages and views in the application for screenshot planning:

1. **Frontend Projects** (Nuxt, Next.js, Vue, React, Angular):
   - Glob for `pages/`, `app/`, `views/`, `routes/` directories
   - Read router files to enumerate all routes
   - Classify each route: public, authenticated, admin
   - Note the primary feature each page exposes

2. **Backend-only Projects** (NestJS, Express, Fastify):
   - Enumerate controller route prefixes
   - Identify any swagger/API docs endpoint

Output a `pagesInventory` list:
```
pagesInventory:
  - path: "/"
    name: "Landing Page"
    auth: "public"
    feature: "Homepage"
  - path: "/dashboard"
    name: "Dashboard"
    auth: "authenticated"
    feature: "Overview & Analytics"
  - path: "/projects/:id"
    name: "Project Detail"
    auth: "authenticated"
    feature: "Project Management"
```

## Execution Protocol

1. **Discover** — Read manifest files to detect tech stack (`${CLAUDE_SKILL_DIR}/reference/framework-detection.md`)
2. **Map** — Glob for controllers, services, models, components, test files
3. **Deep-read** — Follow imports, read implementations for key findings
4. **Extract features** — Apply heuristics from `${CLAUDE_SKILL_DIR}/reference/feature-extraction.md`
5. **Detect startup** — Check docker-compose, package scripts, env requirements
6. **Inventory pages** — Enumerate all routes and views
7. **Compile** — Structure output according to `${CLAUDE_SKILL_DIR}/reference/report-schema.md`
8. **Validate** — Verify every claim has a `file:line` reference

## Validation Rules

- **No speculation** — Every feature claim needs a code reference
- **No marketing language** — Describe what the code does, not potential
- **Accurate names** — Use exact package names from dependency files
- **Honest coverage** — If tests are sparse, say so
- **No duplication** — Each finding in exactly one dimension

## Output Format

Produce a structured report following `${CLAUDE_SKILL_DIR}/reference/report-schema.md`.

The report MUST include:
- All 8 analysis dimensions
- Feature list with evidence and screenshot candidates
- `startupInfo` block
- `pagesInventory` list

Source references use the format: `path/to/file.ts:42`

Unknown or undeterminable items are marked as `unknown` — never guessed.

## Reference Files

- `${CLAUDE_SKILL_DIR}/reference/analysis-dimensions.md` — Detailed guide for each of the 8 dimensions
- `${CLAUDE_SKILL_DIR}/reference/framework-detection.md` — Framework detection lookup table
- `${CLAUDE_SKILL_DIR}/reference/feature-extraction.md` — Feature heuristics (auth, uploads, realtime, etc.)
- `${CLAUDE_SKILL_DIR}/reference/startup-detection.md` — Full 8-step startup detection protocol with `startupInfo` schema
- `${CLAUDE_SKILL_DIR}/reference/report-schema.md` — TypeScript interface for the structured report
