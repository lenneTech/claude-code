---
name: maintaining-npm-packages
description: 'Analyzes and optimizes npm package dependencies across five maintenance modes: FULL (update all), DRY-RUN (analysis only), SECURITY-ONLY (urgent CVE fixes), PRE-RELEASE (conservative patch-only), POST-FEATURE (cleanup). Activates on updating packages, `npm audit` findings, deprecated or unused dependencies, "Pakete aktualisieren", "Abhängigkeiten prüfen", or package.json optimization. NOT for @lenne.tech/nest-server version updates (use nest-server-updating). NOT for stack-wide releases (use maintaining-lt-stack).'
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
| "Bring the whole project up to date" | `/lt-dev:maintenance:maintain` — orchestrates framework updates first, then this skill |
| "Update nest-server across a major" | nest-server-updating (owns the migration guides) |
| "Sync the vendored core (`src/core/`)" | nest-server-core-vendoring / nuxt-extensions-core-vendoring |
| "Fix NestJS service" | generating-nest-servers |

### Frameworks come before packages

A CVE inside a **framework-pinned** dependency cannot be closed with an override.
`@lenne.tech/nest-server` pins `better-auth` and the `@nestjs/*` family to exact
versions; overriding past that pin overrules the framework and produces a combination
nobody tested. Raise the framework instead — it ships the patched version.

Real incident (offers, 2026-07): a critical `better-auth` advisory was "fixed" via
override. `pnpm audit` went green and an API test went red. The correct fix was
nest-server `11.25.2 → 11.27.6`. Afterwards the `@nestjs/*` family had to be aligned
to the framework's pin (`11.1.23`), because two copies of `@nestjs/schedule` broke the
build with a type error that pointed nowhere near the cause.

Practical consequence: when a security finding sits in a framework-pinned dependency,
**stop and raise the framework** (or report it blocked if no release carries the fix).
Do not force it with an override.

## Related Skills

- `generating-nest-servers` - For NestJS development when dependencies affect the server
- `using-lt-cli` - For Git operations after maintenance
- `nest-server-updating` - For updating @lenne.tech/nest-server (uses this agent internally)
- `coordinating-peer-sessions` - Lockfile and audit work is exclusive per repo; when another session is live in it, claim a cross-cutting finding before fixing it (see `running-check-script` Step 4a) so two sessions do not rewrite one lockfile

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

## Override Retention Rule (Critical)

**Raise overrides. Do not delete them.** Every entry in `pnpm.overrides` is there
because a transitive CVE could not be closed any other way, and the parallel
`//overrides` block records which. Treat it as a contract.

⚠️ **A clean `pnpm audit` is not evidence that an override is obsolete** — the audit is
clean *because the override is working*. "No vulnerability reported, so the override
can go" is circular reasoning, and it is precisely how a real maintenance run deleted
20+ security overrides (`axios`, `lodash`, `kysely`, `drizzle-orm`, `unhead`, `qs`,
`hono`, …), re-opening every one of those advisories.

| Situation | Action |
| --- | --- |
| Target below the advisory's fixed-in version | **RAISE** to the highest release in the same major |
| Target at/above fixed-in, package still in the tree | **KEEP** |
| `pnpm why <pkg>` shows the package left the tree | **REMOVE** (entry + its `//overrides` comment), then re-audit |
| Audit is clean | **KEEP** |
| Build breaks after a framework bump | **KEEP** — raise the outdated meta-module instead |

Off-by-one pins are the most common real finding: in one audit, 8 of 36 overrides sat
exactly one patch below their fix (e.g. `vite` pinned to `7.3.2` when the advisory was
fixed in `7.3.5`) — exact, maintained-looking, and still vulnerable.

## An Override Key Is a PIN, Not a Floor (Critical)

**A pnpm override key is matched against the REQUESTED RANGE a parent declares, not against the version that would resolve.** So even a "safely floored" key like `'pkg@>=1.0.0 <1.5.0': '1.5.0'` fires whenever it intersects a parent's declared range — and then PINS the tree to the target. It does not mean "at least 1.5.0".

Consequence: **an override stops being harmless the moment its target falls behind the newest release in its major.** It silently becomes a *downgrade lock*, holding the package back while presenting itself as a security measure.

Proven, not assumed — probe key `'fast-xml-parser@<5.6.0': '5.9.0'`, a window the natural resolve (5.11.0) does not satisfy, still fired and installed 5.9.0, because the parent requests `^5.5.6`.

Found in **three** lt repos in one session (2026-08-22):

| Repo | Entry | Held at | Would resolve to |
|---|---|---|---|
| nest-server-starter | `@hono/node-server` | 2.0.11 | 2.1.1 |
| nest-server-starter | `hono` | 4.12.34 | 4.13.3 |
| nest-server-starter | `axios` | 1.18.1 | 1.19.0 |
| lt-monorepo | `fast-xml-parser` | 5.10.1 | 5.11.0 |

Worse shapes to look for specifically:

- **A bare key pins EVERY version.** `'@hono/node-server': '1.19.14'` sat five lines above `'@hono/node-server@<2.0.10': '2.0.11'` in one file — the bare key claims the whole tree, *below* the patched line, while the comment above the ranged entry claimed the opposite. **One rule per package.**
- **A bare key can drag a package across a MAJOR, in either direction.** `js-yaml: 4.3.1` force-*downgraded* `@nestjs/swagger`'s own `^5` dependency; `ajv: 8.20.0` dragged `ajv@6` consumers up across a major that changes the export shape.
- **Lockstep violations.** When the framework declares a package as an ordinary dependency (`nodemailer`, `ws`), an override target BELOW it puts a second, older copy in the tree next to the declared one under `shamefullyHoist`.

### The only non-circular test: two FRESH resolves

This does **not** contradict the Override Retention Rule above — it sharpens it. "Audit is clean → KEEP" is right when the audit ran *with* the override, because the override is why it is clean. The honest question is what happens **without** it:

```bash
# A: with the overrides block          B: with the block stripped
pnpm install --lockfile-only           pnpm install --lockfile-only
# then diff the resolved versions, and run `pnpm audit` on BOTH
```

Read the diff:

| Result | Verdict |
|---|---|
| B reintroduces a vulnerable version | **LOAD-BEARING** — keep, and raise the target to the newest in the major |
| B resolves HIGHER and audit is clean in both | **DOWNGRADE LOCK** — remove, or re-point |
| No difference at all | **INERT** — keep only if `pnpm why` still finds the package; document that it is latent |

⚠️ **Diffing against the COMMITTED lockfile proves nothing** — it already carries the pinned versions, so every entry looks load-bearing. Both resolves must be fresh. A maintenance run in this stack got this wrong on its first attempt and had to redo the whole comparison.

Check every target against `npm view <pkg> versions` on each run, and **raise the key and the target together**.

## `auditConfig.ignoreGhsas` Is Hoisted and Never Expires (Critical)

`pnpm`'s `auditConfig.ignoreGhsas` / `.ignoreCves` are not ordinary settings — and in this stack they are not local either. Since **lt CLI 1.42.0** `auditConfig` is in the hoist whitelist (`NESTED_ARRAY_FIELDS` in `cli/src/lib/hoist-workspace-pnpm-config.ts`), so a suppression written in a template applies **workspace-wide in every generated project**, across every major range of the suppressed package. pnpm's `auditConfig` has **no expiry**.

**A stale suppression is therefore worse than no suppression** — it silently covers advisories nobody assessed.

Most entries are written when GitHub's advisory range is momentarily too broad (a blanket `<= X` sweeping up patched backports). Those ranges get narrowed later, and the entry's justification evaporates without anything announcing it.

**Every entry needs a written removal condition and a verification date**, and every maintenance run must re-check them:

```bash
# strip auditConfig, re-resolve, re-audit — does the advisory actually still fire?
pnpm install --lockfile-only && pnpm audit
```

Found live in lt-monorepo (2026-08-22): `GHSA-mh99-v99m-4gvg` (HIGH) suppressed since 2026-07-30 on a range that had since been narrowed to per-major windows, so the installed version no longer matched. Its own removal condition was met verbatim and nothing had re-read it.

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
