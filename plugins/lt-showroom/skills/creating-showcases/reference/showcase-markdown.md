# SHOWCASE.md Format Specification

SHOWCASE.md is the **single source of truth** for all showcase content. It lives in the project repository, is version-controlled alongside the code, and drives both the showroom.lenne.tech publication and screenshot automation.

## File Location

| Project Type | Path |
|---|---|
| Single-package project | `SHOWCASE.md` (project root) |
| Monorepo (frontend in `projects/app/`) | `docs/showcase/SHOWCASE.md` |
| Monorepo (backend in `projects/api/`) | `docs/showcase/SHOWCASE.md` |

## Frontmatter Schema

```yaml
---
version: "1.0.0"          # MUST match version in package.json (or root package.json for monorepos)
project: "Projektname"    # Human-readable display name
analyzed_at: "2026-03-26" # ISO date of last analysis (YYYY-MM-DD)
source_hash: "abc123def"  # git tree hash of source directory (see below)
last_commit: "a1b2c3d"    # git commit hash at time of analysis (informational)
technologies:             # All significant technologies — quote the list
  - NestJS
  - Nuxt
  - MongoDB
  - TypeScript
category: "Web App"       # Web App | Mobile | Desktop App | Backend | Library | IoT
customer: "Kundenname"    # Company or person that commissioned the project
---
```

### Versioning Rules

- `version` MUST equal the `version` field in `package.json` (or the primary `package.json` in a monorepo)
- When updating SHOWCASE.md, also increment the project version or align with the current version
- The `analyzed_at` date reflects when the code analysis was performed, not when the file was last edited

### Technology List

List ALL significant technologies, not just the primary framework. Include:
- Primary language (TypeScript, Python, Go)
- All frameworks (NestJS, Nuxt, Vue)
- Databases and caches (MongoDB, Redis, PostgreSQL)
- Infrastructure tools (Docker, Kubernetes, AWS)
- Key libraries if they define the project character (Qdrant, LangChain, Stripe)

Do NOT include development tools (ESLint, Prettier, Vitest) unless the project is a developer tool.

## Section Structure

```markdown
---
version: "1.2.0"
project: "RegioKonneX"
analyzed_at: "2026-03-26"
technologies:
  - NestJS
  - Nuxt
  - MongoDB
  - Qdrant
  - Python
category: "Web App"
customer: "IHK Südwestfalen"
---

# RegioKonneX

## Überblick
3-5 Absätze: Was ist das Projekt? Welches Problem löst es? Wer nutzt es? Was macht es besonders?
Konkrete Zahlen aus der Analyse (Anzahl Module, Endpoints, Seiten).

## Technologie-Stack

| Technologie | Kategorie | Version |
|-------------|-----------|---------|
| NestJS      | Backend   | 11.x    |
| Nuxt        | Frontend  | 3.x     |
| MongoDB     | Datenbank | 7.x     |
| Qdrant      | Vektor-DB | 1.x     |

## Features

### Feature 1: KI-Vektor-Matching
Beschreibung (2-3 Sätze) was das Feature macht und warum es relevant ist.

**Belege:** `src/server/modules/matching/matching.service.ts:42`

![KI-Vektor-Matching Desktop](docs/showcase/screenshots/matching-desktop.png)
![KI-Vektor-Matching Mobile](docs/showcase/screenshots/matching-mobile.png)

### Feature 2: Echtzeit-Chat
...

## Architektur
Modulstruktur, Patterns, Datenfluss. 2-3 Absätze.

## Technische Highlights
Was macht das Projekt technisch besonders? Besondere Implementierungen,
Skalierungsansätze, KI-Integration. 2-3 Absätze.

## Ergebnis
Impact, Metriken, Adoption. Was wurde erreicht? 1-2 Absätze.

## Changelog
- v1.2.0 (2026-03-26): Feature X hinzugefügt, Architektur überarbeitet
- v1.0.0 (2026-01-15): Initiale Analyse
```

## Section Descriptions

### Überblick (Overview)

**Purpose:** A prospect should understand the project after reading this section.

**Required content:**
- What the project is (1 sentence)
- The problem it solves (1-2 sentences)
- Who uses it and why (1-2 sentences)
- What makes it technically or functionally special (1-2 sentences)
- Concrete numbers: number of modules, endpoints, pages, users (if known)

**Length:** 3-5 paragraphs, minimum 150 words.

### Technologie-Stack (Technology Stack)

A table listing all technologies with their category and version.

Categories: Backend, Frontend, Datenbank, Infrastruktur, Testing, Sprache

Only include technologies that are directly referenced in the analysis evidence. Never list a technology that is not present in `package.json` or a similar manifest.

### Features

One `### Feature N: Name` subsection per feature. Each feature subsection MUST contain:

1. **Description** — 2-3 sentences: what the feature does and why it matters
2. **Belege** — At least one `file:line` reference to implementing code
3. **Screenshots** — At least one screenshot reference using a relative path

Screenshot path format: `docs/showcase/screenshots/{feature-slug}-{viewport}.png`

**Feature naming rules:**
- Action-oriented: "KI-Vektor-Matching" not "Matching-Funktion"
- 2-4 words
- In German (unless the project is English-only)

**Minimum features:** 6. Maximum: 12. Quality over quantity.

### Architektur (Architecture)

Describe the module structure, key architectural patterns, and data flow. Reference specific source files as evidence.

### Technische Highlights (Technical Highlights)

What makes this project technically interesting? This is where novel solutions, complex integrations, and non-obvious engineering decisions are described.

### Ergebnis (Results)

Concrete outcomes: metrics, user adoption, business impact. Use numbers where available. If metrics are unknown, describe the qualitative outcome.

### Changelog

A reverse-chronological list of SHOWCASE.md versions with a brief summary of what changed.

Format: `- vX.Y.Z (YYYY-MM-DD): Description of changes`

## Screenshot References

All screenshots are stored relative to the project root:

```
docs/showcase/screenshots/
├── {feature-slug}-desktop.png   # 1440×900
├── {feature-slug}-mobile.png    # 390×844
├── overview-desktop.png
├── overview-mobile.png
└── ...
```

Reference them in Markdown using **relative paths** (no leading slash):
```markdown
![Feature Name Desktop](docs/showcase/screenshots/feature-name-desktop.png)
```

**IMPORTANT:** Always use relative paths like `docs/showcase/screenshots/...` — NEVER absolute paths like `/docs/showcase/screenshots/...`. The leading slash breaks rendering in many Markdown viewers and on GitHub.

**Workflow order:** Screenshots MUST be captured BEFORE writing SHOWCASE.md, so the file references actual existing files — not placeholder paths that may not match.

Screenshots MUST:
- Show the actual running application (not mockups)
- Contain realistic demo data (not empty states)
- Be taken at standard viewports: desktop (1440×900), mobile (390×844)

### Teaser Image (`teaserImageFileId`)

Every showcase should have a teaser image that is displayed on showcase cards in listings and as the hero background. When publishing to showroom.lenne.tech:

1. Upload the first overview screenshot (typically `overview-desktop.png`) or a dedicated teaser image to GridFS via the file upload endpoint
2. Set the returned file ID as `teaserImageFileId` on the showcase object
3. If no dedicated teaser image exists, use the first feature screenshot as a fallback

The teaser image should be a desktop-viewport screenshot that gives a representative impression of the project at a glance.

## Version Tracking & Change Detection

### Frontmatter Fields for Change Detection

```yaml
version: "1.0.0"           # package.json version at time of analysis
source_hash: "abc123def"    # git tree hash of source code
last_commit: "a1b2c3d"      # commit hash (informational, may change on rebase)
analyzed_at: "2026-03-26"   # date of analysis
```

### How to Calculate `source_hash`

The `source_hash` is the **git tree hash** of the source directory. It depends purely on file contents — NOT on commit history. This means it is **stable across rebases and squashes**.

```bash
# For monorepos (projects/api + projects/app):
git rev-parse HEAD:projects 2>/dev/null

# For single-package projects:
git rev-parse HEAD:src 2>/dev/null

# Fallback (entire repo):
git rev-parse HEAD^{tree}
```

### How to Detect Changes

```bash
# Step 1: Read current values from SHOWCASE.md
old_version=$(grep "^version:" SHOWCASE.md | head -1 | awk '{print $2}' | tr -d '"')
old_hash=$(grep "^source_hash:" SHOWCASE.md | head -1 | awk '{print $2}' | tr -d '"')

# Step 2: Read current project state
new_version=$(node -p "require('./package.json').version" 2>/dev/null)
new_hash=$(git rev-parse HEAD:projects 2>/dev/null || git rev-parse HEAD:src 2>/dev/null || git rev-parse HEAD^{tree})

# Step 3: Compare
if [ "$old_hash" = "$new_hash" ]; then
  echo "NO CHANGES — source code is identical"
elif [ "$old_version" != "$new_version" ]; then
  echo "VERSION BUMP — likely a release with significant changes"
else
  echo "SOURCE CHANGED — code changed without version bump (bugfix, refactor, etc.)"
fi
```

### How to Analyze What Changed

When `source_hash` differs, find exactly what changed:

```bash
# Get the old tree hash from SHOWCASE.md
old_hash="abc123def"

# Find the commit that had this tree hash
old_commit=$(git log --all --format='%H %T' | grep "$old_hash" | head -1 | awk '{print $1}')

# If found: targeted diff
if [ -n "$old_commit" ]; then
  git diff --stat "$old_commit"..HEAD -- src/ projects/
  git diff --name-only "$old_commit"..HEAD -- src/ projects/
fi

# If not found (tree hash lost after GC): fall back to date-based
git log --oneline --since="2026-03-26" -- src/ projects/
```

This approach is efficient: instead of re-analyzing the entire project, only files in the diff need to be re-examined.

### Why `source_hash` is Better Than Commit Hash

| Scenario | Commit Hash | Source Tree Hash |
|----------|-------------|-----------------|
| Normal commit | Changes | Changes |
| Rebase onto main | **Changes** (new hash) | **Stays same** (same content) |
| Squash merge | **Changes** | **Stays same** |
| Amend commit message | **Changes** | **Stays same** |
| Actual code change | Changes | Changes |

The tree hash is the only reliable indicator that source code actually changed.

## Update Workflow

When changes are detected (source_hash differs):

1. **Detect what changed** — Use `git diff --name-only old_commit..HEAD` to find modified files
2. **Classify changes** — Map changed files to SHOWCASE.md sections:
   - `package.json` changed → update Technologie-Stack
   - `src/server/modules/new-feature/` added → add new Feature section
   - `src/pages/` changed → update Pages Inventory + take new screenshots
   - Tests changed → update Testing section
3. **Re-analyze only affected sections** — Don't re-analyze unchanged code
4. **Take new screenshots** — Only for pages/features that changed
5. **Update SHOWCASE.md** — Update affected sections, bump `version`, `source_hash`, `analyzed_at`
6. **Add changelog entry** — Document what was re-analyzed and why
7. **Re-publish** — Update the showcase via API with changed content blocks

**Rule:** Never re-analyze the entire project when only specific areas changed. Use the diff to target the analysis efficiently.

## Validation Rules

- `version` MUST match `package.json` — checked at publish time
- `source_hash` MUST be recalculated at every analysis
- Every feature MUST have at least one `file:line` evidence reference
- Every feature SHOULD have at least one screenshot in `docs/showcase/screenshots/`
- The `technologies` list MUST contain every technology in the Technologie-Stack table
- No placeholder text — all sections must be substantive
