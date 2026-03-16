---
description: Dry-run npm package analysis without changes
allowed-tools: Agent
disable-model-invocation: true
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
- Analyze overrides (which COULD be removed)
- Check security vulnerabilities
- Estimate risk levels for all potential changes

**CRITICAL**: Do NOT modify package.json, do NOT run pnpm install/remove, do NOT make any changes.

Generate comprehensive report including:
- Packages that could be removed (with usage analysis)
- Packages that could be recategorized
- Deprecated packages with recommended replacements
- Available updates categorized by risk (SAFE/MEDIUM/HIGH)
- Overrides that may no longer be necessary (with analysis)
- Security vulnerabilities found
- Estimated impact and time requirements

This is useful for planning maintenance windows or getting pre-approval for changes.
