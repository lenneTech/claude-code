---
name: maintaining-npm-packages
description: 'Analyzes and optimizes npm package dependencies across 5 maintenance modes: FULL (update all), DRY-RUN (analysis only), SECURITY-ONLY (urgent CVE fixes), PRE-RELEASE (conservative patch-only), POST-FEATURE (cleanup after development). Activates when user mentions "update packages", "pnpm audit", "npm audit", "check dependencies", "security fix", "outdated dependencies", "deprecated packages", "devDependencies", "pre-release cleanup", "post-feature housekeeping", "remove unused packages", or package.json optimization. NOT for @lenne.tech/nest-server version updates (use nest-server-updating).'
paths:
  - "**/package.json"
  - "**/pnpm-lock.yaml"
  - "**/package-lock.json"
---

# NPM Package Maintenance

## Gotchas

- **Override target must be a FIXED version** — The most common failure mode: adding `"vite": ">=7.3.2"` to `pnpm.overrides` lets pnpm silently install `8.x.y` on the next install, causing major-version cascading regressions. Override targets MUST be exact (`"vite": "7.3.2"`). See "Override Safety Rule" below for the real-incident reference from April 2026. The LEFT side of an override may carry a range (to select affected versions); the RIGHT side must be fixed.
- **An EXACT override target can still be vulnerable** — exact is necessary but NOT sufficient: the target must also be `>=` the advisory's *fixed-in* version. Pinning `uuid` to `11.1.0` (exact, same major) when the fix landed in `11.1.1` leaves the advisory open — the override silently "works" but resolves a still-vulnerable version. After EVERY override, re-run `audit` and confirm the targeted package is gone. If it still appears, the target is one patch too low or the selector mis-scoped — bump it; do NOT record it as "blocked" or "needs a framework update".
- **`npm audit` and `pnpm audit` disagree on the same dependencies** — different package managers resolve transitive versions differently (pnpm floats to the newest in-range patched release; npm can keep an older locked one) and the override block lives in different places: `overrides` (npm), `pnpm.overrides` (pnpm), `resolutions` (yarn). A reference starter reporting "0 vulnerabilities" under pnpm does NOT mean an npm-based consumer is clean. Always audit with the PROJECT's own package manager, and target the patched versions the reference resolves to.
- **`pnpm audit --fix --force` can cause major version jumps** — Step 3 of the escalation ladder is destructive. It will happily upgrade a transitive dependency from `^1.x` to `3.x` if that closes the CVE. Always verify `pnpm run build` and the full test suite after using it, and prefer a scoped override for transitives where a compatible patch exists.
- **Deprecated packages in `devDependencies` often lag** — `@types/*` packages in particular remain flagged as deprecated for months after the upstream merges types natively. Don't remove them blindly — check the affected imports still resolve via the new inline types before deleting.
- **`packageManager` field locks pnpm/npm/yarn version** — When running maintenance across a monorepo, the `packageManager: "pnpm@X.Y.Z"` field in the root `package.json` pins the exact version. Upgrading pnpm without also bumping this field causes CI and local runs to diverge silently.

## When to Use This Skill

- User mentions outdated packages or wants to update dependencies
- Security vulnerabilities found via `pnpm audit`
- Need to optimize `dependencies` vs `devDependencies`
- Removing unused packages from `package.json`
- Pre-release or post-feature dependency cleanup
- General package maintenance or housekeeping tasks

For comprehensive npm package maintenance, use the **lt-dev:npm-package-maintainer agent** via the maintenance commands.

## Skill Boundaries

| User Intent | Correct Skill |
|------------|---------------|
| "Update npm packages" | **THIS SKILL** |
| "npm audit fix" | **THIS SKILL** |
| "Remove unused dependencies" | **THIS SKILL** |
| "Update nest-server to v14" | nest-server-updating |
| "Fix NestJS service" | generating-nest-servers |

## Related Skills

- `generating-nest-servers` - For NestJS development when dependencies affect the server
- `using-lt-cli` - For Git operations after maintenance
- `nest-server-updating` - For updating @lenne.tech/nest-server (uses this agent internally)

## Available Commands

| Command | Mode | Use Case |
|---------|------|----------|
| `/lt-dev:maintenance:maintain` | FULL | Complete optimization (remove unused, recategorize, update all) |
| `/lt-dev:maintenance:maintain-check` | DRY-RUN | Analysis only - see what would be done without changes |
| `/lt-dev:maintenance:maintain-security` | SECURITY | Fast security-only updates (audit vulnerabilities) |
| `/lt-dev:maintenance:maintain-pre-release` | PRE-RELEASE | Conservative patch-only updates before a release |
| `/lt-dev:maintenance:maintain-post-feature` | FULL | Clean up after feature development |

## When to Recommend Each Command

### `/lt-dev:maintenance:maintain` (FULL MODE)
Recommend when user wants:
- Complete dependency optimization
- General maintenance / housekeeping
- "Clean up my dependencies"
- "Update all packages"

### `/lt-dev:maintenance:maintain-check` (DRY-RUN)
Recommend when user wants:
- To see what would change without making changes
- Analysis or audit of current state
- "What packages are outdated?"
- "Check my dependencies"
- Pre-approval before making changes

### `/lt-dev:maintenance:maintain-security` (SECURITY-ONLY)
Recommend when user mentions:
- `pnpm audit` vulnerabilities
- Security issues
- CVEs or security advisories
- "Fix security vulnerabilities"
- Quick/urgent security fixes

### `/lt-dev:maintenance:maintain-pre-release` (PRE-RELEASE)
Recommend when user mentions:
- Preparing for a release
- "Before release"
- Wanting minimal/safe changes only
- Risk-averse updates

### `/lt-dev:maintenance:maintain-post-feature` (POST-FEATURE)
Recommend when user:
- Just finished implementing a feature
- Added new dependencies
- Wants to clean up after development work

## What the Agent Does

The lt-dev:npm-package-maintainer agent performs 4 priorities:

1. **Remove unused packages** - Finds and removes packages not used in the codebase
2. **Optimize categorization** - Moves dev-only packages to devDependencies
3. **Replace deprecated packages** - Detects deprecated packages and replaces them with maintained alternatives
4. **Update packages & manage overrides** - Updates to latest versions with risk-based approach and maintains `pnpm.overrides` entries

All operations ensure `pnpm run build` and `pnpm test` pass before completion.

## Override Safety Rule (Critical)

When the agent ADDS an entry to `pnpm.overrides` (typically to force a security-patched version of a transitive dependency), the override **target** MUST be a fixed version — never a range like `">=X"`, `"^X"`, or `"~X"`.

| Correct | Incorrect | Why |
|---|---|---|
| `"vite": "7.3.2"` | `"vite": ">=7.3.2"` | `>=` is unbounded — pnpm will install `8.x.y` if available |
| `"@apollo/server": "5.5.0"` | `"@apollo/server": "^5.5.0"` | Defeats the purpose of an override |
| `"vite@>=7.0.0 <7.3.2": "7.3.2"` | `"vite@>=7.0.0 <7.3.2": ">=7.3.2"` | Range on the LEFT selects affected versions; the RIGHT must still be fixed |

**Why this matters:** In April 2026 the TurboOps monorepo received an override `"vite@>=7.0.0 <=7.3.1": ">=7.3.2"` from a security maintenance run. Because the target `">=7.3.2"` was unbounded, pnpm silently installed `vite@8.0.8` (major version jump), which broke peer dependencies in `@nuxt/test-utils`, dropped `drizzle-orm` from `better-auth`, and caused 13 e2e test regressions. The fix was switching every override target to a fixed version.

**Reference implementation:** `https://github.com/lenneTech/nest-server-starter/blob/main/package.json` — canonical example of correctly-written `pnpm.overrides` for the lenne.tech stack. Align with this file when in doubt. The detailed rule is in `@lenne.tech/nest-server/.claude/rules/package-management.md` → "Overrides".

## Vulnerability Resolution Workflow

When `audit` reports vulnerabilities, resolve them in this order. Most are fixable without a major upgrade or a framework bump — escalation is the last resort, not the first diagnosis.

1. **Group by root advisory, not by symptom.** A dozen findings usually collapse to two or three transitive root packages — follow each finding's `via` chain down to the leaf. Fix the root once and every dependent clears (e.g. a single `uuid` override clears the whole Apollo + compodoc + gaxios chain).
2. **Read the advisory's fixed-in version**, then pick the highest release within the SAME major (`npm view <pkg> versions` / `pnpm view`). The target MUST be `>=` the fixed-in version — confirm this explicitly, it is the #1 silent-failure trap.
3. **Write a scoped override to that fixed version.** Use a global key (`"pkg": "x.y.z"`) when every instance must move; use a version-selector key (`"pkg@<bad-range>": "x.y.z"` or `"pkg@<exact-bad>": "x.y.z"`) when other majors must stay (e.g. force `minimatch@3.0.8 → 3.1.5` without touching the 9.x/10.x installs glob/ts-morph/nodemon need). npm overrides are GLOBAL by default — one bare key governs every nested instance.
4. **Re-install, then re-audit and confirm 0.** If a package you overrode still appears: the target is below the fixed-in version (off-by-one) or the selector missed the vulnerable instance. Fix the override — never leave it as "blocked".
5. **Prefer REMOVAL over override for unused direct deps.** A direct dependency that is never imported AND not required by the framework manifest can drag in a large vulnerable subtree and force several overrides just to patch it. Removing it is cleaner than overriding its transitives — and lets you delete the overrides that existed only for its chain. Before keeping any package "to be safe", verify it is genuinely framework-required by checking the framework's own `package.json` (`dependencies` / `peerDependencies`) — a "framework-mirror" assumption that the framework does not actually back is a removal candidate, not a keeper.
6. **Only then consider a major upgrade or framework update.** "Needs the next nest-server release" is valid only after steps 1–5 are genuinely exhausted.

## Quick Guidance

- **User unsure?** → Recommend `/lt-dev:maintenance:maintain-check` first (safe, no changes)
- **Security urgent?** → Recommend `/lt-dev:maintenance:maintain-security` (fast, focused)
- **Before release?** → Recommend `/lt-dev:maintenance:maintain-pre-release` (conservative)
- **General cleanup?** → Recommend `/lt-dev:maintenance:maintain` (comprehensive)

## Reference Templates for Complex Version Constellations

When dependency conflicts or unclear version combinations arise during maintenance, the lenne.tech starter templates provide validated package constellations as reference:

| Project Type | Raw `package.json` URL |
|--------------|------------------------|
| Frontend (`projects/app/`, `packages/app/`) — Nuxt/Vue | https://raw.githubusercontent.com/lenneTech/nuxt-base-starter/main/package.json |
| Backend (`projects/api/`, `packages/api/`) — NestJS | https://raw.githubusercontent.com/lenneTech/nest-server-starter/main/package.json |
| Framework core — `@lenne.tech/nest-server` | https://raw.githubusercontent.com/lenneTech/nest-server/main/package.json |

**When to consult the templates:**
- `ERESOLVE` errors or peer dependency warnings during install
- Major version upgrades affecting multiple related packages (e.g., `@nestjs/*`, `nuxt` + modules)
- Uncertainty whether a framework package version combination is valid
- Looking up canonical `pnpm.overrides` entries for known transitive CVEs

**How to apply:** Fetch the raw `package.json` via WebFetch and diff against the current project. Use the starter versions as ground truth for framework core + direct ecosystem. Do NOT blindly downgrade project-specific dependencies to match the starter.

**Override documentation pattern:** The starter uses a parallel `//overrides` block in `package.json` with one comment per override (CVE / transitive chain / removal condition). Mirror this pattern when adding new overrides — undocumented overrides accumulate and become unmaintainable. The full rule is in `@lenne.tech/nest-server/.claude/rules/package-management.md` → "Overrides".
