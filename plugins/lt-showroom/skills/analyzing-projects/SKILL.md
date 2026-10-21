---
name: analyzing-projects
description: 'Analyzes a software project for a showroom showcase or portfolio entry from a throwaway clone: technology stack, features, pages to screenshot, how it starts and project facts, every claim backed by a file reference; architecture, API, testing, security and performance only on request. The report is stored in the Showroom, never in the project. Activates when a project is analyzed for showroom.lenne.tech, a showcase or a portfolio entry, and on /lt-showroom:showroom:analyze. NOT for everyday questions about the codebase being worked on. NOT for creating or publishing showcases (use creating-showcases). NOT for platform development (use generating-nest-servers).'
---

# Analyzing Software Projects

This skill enables Claude Code to perform evidence-based analysis of software projects and produce the structured
report a showcase on showroom.lenne.tech is built from. The analysis reads a throwaway clone in
`~/.lt-showroom/<slug>/checkout`, never the developer's checkout, and nothing is written into the project: the report
goes to `~/.lt-showroom/<slug>/analysis.json` and from there into the Showroom as the showcase's `sourceCodeAnalysis`.

## When to Use This Skill

- User asks to analyze a project for a showcase or portfolio entry
- User wants a project's purpose and structure written up for a showcase or a portfolio entry
- Running `/lt-showroom:showroom:analyze`, `/lt-showroom:showroom:create`, or `/lt-showroom:showroom:update` commands
- User asks for a project's technology stack, features, or architecture as material for showroom.lenne.tech

Everyday questions about the codebase being worked on (what a module does, how a flow is built) are ordinary code reading, not this skill.

## Skill Boundaries

| User Intent | Correct Skill |
|------------|---------------|
| Analyze project source code | **THIS SKILL** |
| Create or update a showcase | `creating-showcases` |

## Related Skills

**Works closely with:**
- `creating-showcases` — Builds the showcase from the report and stores the report with it

## Analysis Scope

A showcase needs a fraction of what a full code review would collect, so the scope is chosen per run:

| Scope | Covers | When |
|-------|--------|------|
| `showcase` (default) | Dimension 1 (technology stack), dimension 3 (features), pages inventory, startup info, project facts | Every showroom command |
| `full` | Additionally dimensions 2 and 4 to 8 | Only when the user asks for it (`/lt-showroom:showroom:analyze --full`) |

The full guide to all 8 dimensions is in `${CLAUDE_SKILL_DIR}/reference/analysis-dimensions.md`.

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

## Additional Analysis (Both Scopes)

Beyond the dimensions, every analysis also produces:

### Feature List with Evidence

For each feature, record:
- **Name** — short, action-oriented label (e.g. "Role-based Access Control")
- **Description** — 1-2 sentences describing what the feature does
- **Evidence** — `file:line` reference to the implementing code
- **Screenshot candidate** — which page/view best demonstrates this feature

Apply heuristics from `${CLAUDE_SKILL_DIR}/reference/feature-extraction.md` to detect features systematically.

### How to Get the Project Running

The analysis produces a complete, actionable recipe to start the project from scratch, because without it screenshots cannot be taken and features cannot be verified.

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

- **Ports 3000/3001 are hardcoded in many lenne.tech stack projects** — If another project is already running, screenshots will capture the wrong app. Always check `lsof -i :3000 -i :3001` before starting.
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

### Project Facts

The showcase hero shows year, duration, team size, platforms and outcomes. Derive the first ones from the repository
and mark them as proposals, since the user confirms them:

```
projectFacts:
  year: 2025                 # year of the last substantial commit (git log)
  duration: "8 Monate"       # first to last commit; "seit 2022" for a project still running
  platforms: [web, android]  # web build; Capacitor/React Native/native folders → ios/android; Electron/Tauri → desktop
  contributors: 3            # distinct commit authors: a hint for teamSize, not the team itself
  evidence: ["git log --reverse --format=%cs | head -1", "capacitor.config.ts:1"]
```

Outcomes (measured results) are never derived from code; leave them to the user.

## Execution Protocol

1. **Discover** — Read manifest files to detect tech stack (`${CLAUDE_SKILL_DIR}/reference/framework-detection.md`)
2. **Map** — Glob for controllers, services, models, components, test files
3. **Deep-read** — Follow imports, read implementations for key findings
4. **Extract features** — Apply heuristics from `${CLAUDE_SKILL_DIR}/reference/feature-extraction.md`
5. **Detect startup** — Check docker-compose, package scripts, env requirements
6. **Inventory pages** — Enumerate all routes and views
7. **Compile** — Structure output according to `${CLAUDE_SKILL_DIR}/reference/report-schema.md`
8. **Validate** — Verify every claim has a `file:line` reference
9. **Save** — `node "<plugin-root>/scripts/screenshot-session.mjs" analysis save <slug>` with the JSON on stdin; it
   refuses a report without `source.analyzedCommit`

Steps 2 and 3 cover only the dimensions of the scope: for `showcase`, read what proves a feature, a page or the stack,
and skip test, security and performance internals.

## Validation Rules

- **No speculation** — Every feature claim needs a code reference
- **No marketing language** — Describe what the code does, not potential
- **Accurate names** — Use exact package names from dependency files
- **Honest coverage** — If tests are sparse, say so
- **No duplication** — Each finding in exactly one dimension

## Output Format

Produce a structured JSON report following `${CLAUDE_SKILL_DIR}/reference/report-schema.md`, with `scope`, and the
`source` and `fromLocalCheckout` that `screenshot-session.mjs source <slug>` prints, unchanged, so the report names the
commit it describes.

The report includes:
- The dimensions of its scope (`showcase`: technology stack and features; `full`: all 8)
- Feature list with evidence, icon and screenshot candidate page
- `startupInfo` block
- `pagesInventory` list
- `projectFacts` block (proposals for the showcase key facts)

Source references use the format: `path/to/file.ts:42`

Unknown or undeterminable items are marked as `unknown` — never guessed.

## Reference Files

- `${CLAUDE_SKILL_DIR}/reference/analysis-dimensions.md` — Detailed guide for each of the 8 dimensions
- `${CLAUDE_SKILL_DIR}/reference/framework-detection.md` — Framework detection lookup table
- `${CLAUDE_SKILL_DIR}/reference/feature-extraction.md` — Feature heuristics (auth, uploads, realtime, etc.)
- `${CLAUDE_SKILL_DIR}/reference/startup-detection.md` — Full 8-step startup detection protocol with `startupInfo` schema
- `${CLAUDE_SKILL_DIR}/reference/report-schema.md` — TypeScript interface for the structured report
