---
description: Package maintenance after completing a feature - ensures dependencies are current and optimized
---

# NPM Package Post-Feature Maintenance

## Description
Package maintenance after completing a feature - ensures dependencies are current and optimized

## Related Commands

| Command | Mode | Use Case |
|---------|------|----------|
| `/lt-dev:maintain` | FULL | Complete optimization |
| `/lt-dev:maintain-check` | DRY-RUN | Analysis only - no changes |
| `/lt-dev:maintain-security` | SECURITY | Fast security-only updates |
| `/lt-dev:maintain-pre-release` | PRE-RELEASE | Conservative patch-only updates |
| `/lt-dev:maintain-post-feature` | FULL | Post-feature cleanup (this command) |

## User Prompt
Use the npm-package-maintainer agent to perform **post-feature** maintenance.

**Mode**: FULL MODE (complete optimization)

After feature implementation, ensure the dependency ecosystem is clean and up-to-date:

Execute all priorities:
1. Remove unused packages (especially if feature changed dependencies)
2. Optimize dependency categorization (ensure new deps are correctly placed)
3. Update packages to latest versions (stay current after feature work)

Check for:
- Unused dependencies that can be removed (especially from feature work)
- New dependencies that should be in devDependencies vs dependencies
- Outdated dependencies (all types: security, features, patches)
- Security vulnerabilities introduced by new dependencies
- Compatibility issues with newly added packages

This is the standard comprehensive maintenance mode, ideal after completing feature development to ensure the codebase stays clean and dependencies stay current.

Ensure all tests and build pass after changes.
