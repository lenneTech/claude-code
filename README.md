# lt-claude-plugin

Claude Code Plugin für lenne.tech Entwicklung mit Skills, Commands und Hooks für Frontend (Nuxt 4), Backend (NestJS/nest-server), TDD und CLI Tools.

## Installation

### Option 1: Lokale Installation

```bash
# Plugin als Marketplace hinzufügen
/plugin marketplace add ~/Projekte/Intern/lt-claude-plugin

# Plugin installieren
/plugin install lt-claude-plugin
```

### Option 2: Von Git Repository

```bash
# Marketplace von Git hinzufügen
/plugin marketplace add <git-url>

# Plugin installieren
/plugin install lt-claude-plugin
```

## Enthaltene Komponenten

### Skills (4)

| Skill | Beschreibung |
|-------|--------------|
| `developing-lt-frontend` | Nuxt 4, Nuxt UI 4, TypeScript, Valibot Forms |
| `generating-nest-servers` | NestJS mit @lenne.tech/nest-server |
| `building-stories-with-tdd` | Test-Driven Development Workflow |
| `using-lt-cli` | lenne.tech CLI für Git und Fullstack Init |

### Commands (12)

**Root:**
- `/create-story` - User Story für TDD erstellen (Deutsch)
- `/fix-issue` - Linear Issue bearbeiten
- `/skill-optimize` - Claude Skills validieren und optimieren

**Git (`/git/`):**
- `/git:commit-message` - Commit Message generieren
- `/git:mr-description` - Merge Request Beschreibung erstellen
- `/git:mr-description-clipboard` - MR Beschreibung in Clipboard kopieren

**Backend (`/lt-backend/`):**
- `/lt-backend:code-cleanup` - Code aufräumen und optimieren
- `/lt-backend:sec-review` - Security Review durchführen
- `/lt-backend:test-generate` - Tests generieren

**Vibe (`/vibe/`):**
- `/vibe:plan` - Implementierungsplan aus SPEC.md erstellen
- `/vibe:build` - IMPLEMENTATION_PLAN.md ausführen
- `/vibe:build-plan` - Plan + Build in einem Schritt

### Hooks (3)

Automatische Projekt-Erkennung bei jedem Prompt:

1. **Nuxt 4 Detection** - Erkennt `nuxt.config.ts` + `app/` Struktur und empfiehlt `developing-lt-frontend` Skill
2. **NestJS Detection** - Erkennt `@lenne.tech/nest-server` in package.json und empfiehlt `generating-nest-servers` Skill
3. **lt CLI Detection** - Erkennt installierte `lt` CLI und empfiehlt `using-lt-cli` Skill für Git und Fullstack Operationen

Unterstützt Monorepo-Strukturen: `projects/`, `packages/`, `apps/`

## Voraussetzungen

- Claude Code CLI
- Node.js >= 18
- lenne.tech CLI (`npm i -g @lenne.tech/cli`)

## Development

```bash
# Version bump (patch, minor, major)
bun run version:patch   # Bumps version, commits, tags, and pushes
bun run version:minor
bun run version:major
```

## Struktur

```
lt-claude-plugin/
├── .claude-plugin/
│   └── plugin.json
├── skills/
│   ├── building-stories-with-tdd/
│   ├── developing-lt-frontend/
│   ├── generating-nest-servers/
│   └── using-lt-cli/
├── commands/
│   ├── create-story.md
│   ├── fix-issue.md
│   ├── skill-optimize.md
│   ├── git/
│   ├── lt-backend/
│   └── vibe/
├── hooks/
│   └── hooks.json
├── scripts/
│   └── bump-version.ts
├── package.json
├── README.md
└── LICENSE
```

## Lizenz

MIT License - lenne.tech GmbH
