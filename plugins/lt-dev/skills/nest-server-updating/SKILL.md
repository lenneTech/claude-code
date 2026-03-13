---
name: nest-server-updating
description: Provides migration guides, release notes, and error solutions for updating @lenne.tech/nest-server to a newer version. Covers version-specific breaking changes, stepwise upgrade strategies, and starter project comparisons. Activates for nest-server version updates, upgrades, migrations, breaking changes between versions, "pnpm run update", TypeScript errors after upgrading, or stepwise migration planning. Delegates execution to the lt-dev:nest-server-updater agent. NOT for writing NestJS code or building features (use generating-nest-servers). NOT for general npm package updates (use maintaining-npm-packages).
---

# @lenne.tech/nest-server Update Knowledge Base

This skill provides **knowledge and resources** for updating @lenne.tech/nest-server. For automated execution, use the `lt-dev:nest-server-updater` agent via `/lt-dev:backend:update-nest-server`.

**Important:** After updating nest-server, also check if `@lenne.tech/nuxt-extensions` in `projects/app/` needs a compatible update, as nuxt-extensions is aligned with nest-server.

## When This Skill Activates

- Discussing nest-server updates or upgrades
- Asking about breaking changes between versions
- Troubleshooting update-related errors
- Planning migration strategies
- Comparing versions or checking compatibility

## Skill Boundaries

| User Intent | Correct Skill |
|------------|---------------|
| "Update nest-server to v14" | **THIS SKILL** |
| "Migrate to latest nest-server" | **THIS SKILL** |
| "Breaking changes in nest-server" | **THIS SKILL** |
| "Create a NestJS module" | generating-nest-servers |
| "Update all npm packages" | maintaining-npm-packages |
| "npm audit fix" | maintaining-npm-packages |

## Related Skills

| Element | Purpose |
|---------|---------|
| **Agent**: `lt-dev:nest-server-updater` | Automated execution of updates |
| **Command**: `/lt-dev:backend:update-nest-server` | User invocation |
| **Skill**: `generating-nest-servers` | Code modifications after update |
| **Skill**: `maintaining-npm-packages` | Package optimization |

---

## Core Resources

### GitHub Repositories

| Resource | URL | Purpose |
|----------|-----|---------|
| **nest-server** | https://github.com/lenneTech/nest-server | Main package repository |
| **Releases** | https://github.com/lenneTech/nest-server/releases | Release notes, changelogs |
| **Migration Guides** | https://github.com/lenneTech/nest-server/tree/main/migration-guides | Version-specific migration instructions |
| **Reference Project** | https://github.com/lenneTech/nest-server-starter | Current compatible code & package versions |

### npm Package

```bash
# Package info
pnpm view @lenne.tech/nest-server

# Current installed version
pnpm list @lenne.tech/nest-server --depth=0

# All available versions
pnpm view @lenne.tech/nest-server versions --json
```

---

## Migration Guide System

**Complete guide selection logic, fallback strategy, and fetch commands: [reference/migration-guides.md](reference/migration-guides.md)**

---

## Version Update Strategies

**IMPORTANT:** In @lenne.tech/nest-server, **Major versions are reserved for NestJS Major versions**.
Therefore, **Minor versions are treated like Major versions** and may contain breaking changes.

### Patch Updates (X.Y.Z → X.Y.W)

- Usually safe, no breaking changes
- Use the standard update workflow (see Quick Reference → Update Workflow)
- Run tests to verify
- **Example:** `11.6.0 → 11.6.5` - direct update OK

### Minor Updates (X.Y.Z → X.W.0) ⚠️ Treat as Major!

- **May contain breaking changes** (Minor = Major in this package)
- **Always stepwise**: Update through each minor version
- Each minor step requires full validation cycle
- Migration guides are essential
- **Example:** `11.6.0 → 11.8.0` becomes `11.6 → 11.7 → 11.8`

### Major Updates (X.Y.Z → W.0.0)

- Reserved for NestJS major version changes
- **Always stepwise**: Update through each major AND minor version
- Example: `11.6.0 → 12.2.0` becomes:
  1. `11.6 → 11.7 → ... → 11.latest` (all minors)
  2. `11.latest → 12.0` (major jump)
  3. `12.0 → 12.1 → 12.2` (all minors)
- Migration guides are critical

---

## Common Error Patterns

**TypeScript errors, runtime errors, and test failures after update: [reference/error-patterns.md](reference/error-patterns.md)**

---

## Reference Project Usage

**How to use nest-server-starter as source of truth: [reference/reference-project.md](reference/reference-project.md)**

---

## API Mode Awareness

**Impact of Rest/GraphQL/Both modes on updates: [reference/api-modes.md](reference/api-modes.md)**

---

## Update Modes

The `lt-dev:nest-server-updater` agent supports these modes:

| Mode | Flag | Behavior |
|------|------|----------|
| **Full** | (default) | Complete update with all migrations |
| **Dry-Run** | `--dry-run` | Analysis only, no changes |
| **Target Version** | `--target-version X.Y.Z` | Update to specific version |
| **Skip Packages** | `--skip-packages` | Skip npm-package-maintainer optimization |

---

## Quick Reference

### Commands

```bash
# Check current version
pnpm list @lenne.tech/nest-server --depth=0

# Check latest version
pnpm view @lenne.tech/nest-server version

# List migration guides
gh api repos/lenneTech/nest-server/contents/migration-guides --jq '.[].name'
```

### Update Workflow

**IMPORTANT:** The `pnpm run update` script requires a specific workflow:

1. **First:** Update the version in `package.json` to the desired target version
   ```
   "@lenne.tech/nest-server": "^X.Y.Z"
   ```

2. **Then:** Run the update script
   ```bash
   pnpm run update
   ```

**What `pnpm run update` does:**
- Verifies the specified version is available on npm
- Installs `@lenne.tech/nest-server` at the version from package.json
- Analyzes which packages inside `@lenne.tech/nest-server` were updated
- Installs those updated dependencies if they don't exist or have a lower version
- Ensures version consistency between nest-server and its peer dependencies

**Manual update (only if `pnpm run update` script is not available):**
```bash
pnpm add -E @lenne.tech/nest-server@X.Y.Z
pnpm install
```
Note: This skips the automatic dependency synchronization that `pnpm run update` provides.

### Package Optimization (after pnpm run update)

After `pnpm run update` completes, run comprehensive package maintenance:

```bash
# Via command (recommended)
/lt-dev:maintenance:maintain

# Or via agent (Agent tool with lt-dev:npm-package-maintainer in FULL MODE)
```

This ensures:
- Unused dependencies are removed
- Packages are correctly categorized (dependencies vs devDependencies)
- All packages are updated to their latest compatible versions
- Security vulnerabilities are addressed

### Validation Sequence

```bash
pnpm run build    # Must pass
pnpm run lint     # Must pass
pnpm test         # Must pass (no skips)
pnpm audit        # Should show no new vulnerabilities
```

---

## When to Use the Agent vs. Manual Update

| Scenario | Recommendation |
|----------|----------------|
| Routine update to latest | Use agent: `/lt-dev:backend:update-nest-server` |
| Check what would change | Use agent with `--dry-run` |
| Update to specific version | Use agent with `--target-version X.Y.Z` |
| Complex issues during update | Use this skill's knowledge + manual fixes |
| Understanding breaking changes | Read this skill + migration guides |
