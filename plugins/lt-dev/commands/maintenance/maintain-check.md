---
description: Dry-run npm package analysis without changes
allowed-tools: Agent
disable-model-invocation: false
---

# NPM Package Maintenance Check (Dry-Run)

## When to Use This Command

- Reviewing dependency state before deciding on maintenance scope
- Getting pre-approval for package changes from stakeholders
- Planning a maintenance window without modifying anything

## Related Commands

| Command | Mode | Use Case |
|---------|------|----------|
| `/lt-dev:maintenance:maintain` | FULL | Complete optimization |
| `/lt-dev:maintenance:maintain-check` | DRY-RUN | Analysis only (this command) |
| `/lt-dev:maintenance:maintain-security` | SECURITY | Fast security-only updates |
| `/lt-dev:maintenance:maintain-pre-release` | PRE-RELEASE | Conservative patch-only updates |
| `/lt-dev:maintenance:maintain-post-feature` | FULL | Clean up after feature development |

## User Prompt
Use the lt-dev:npm-package-maintainer agent to perform **DRY-RUN** analysis.

**Mode**: DRY-RUN MODE (analysis only, no changes)

Analyze and report WITHOUT making changes:
- Analyze unused packages (what WOULD be removed)
- Analyze categorization (what WOULD be moved to devDependencies)
- Detect deprecated packages (what WOULD be replaced and with which alternatives)
- Discover outdated packages (what WOULD be updated)
- Analyze overrides (which are pinned BELOW their advisory's fixed-in version and
  should be raised; which — if any — have left the dependency tree per `pnpm why`)
- Check security vulnerabilities
- Estimate risk levels for all potential changes

**CRITICAL**: Do NOT modify package.json, do NOT run pnpm install/remove, do NOT make any changes.

Generate comprehensive report including:
- Packages that could be removed (with usage analysis)
- Packages that could be recategorized
- Deprecated packages with recommended replacements
- Available updates categorized by risk (SAFE/MEDIUM/HIGH)
- Overrides pinned below their fixed-in version (with the target they should be raised to)
- Framework drift: is `@lenne.tech/nest-server` / `@lenne.tech/nuxt-extensions` behind,
  and does any advisory sit in a dependency the framework pins? (Those cannot be fixed
  with an override — they need the framework raised.)
- Security vulnerabilities found
- Estimated impact and time requirements

This is useful for planning maintenance windows or getting pre-approval for changes.
