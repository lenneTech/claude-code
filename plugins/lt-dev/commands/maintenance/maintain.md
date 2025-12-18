---
description: Comprehensive npm package maintenance using the specialized npm-package-maintainer agent
---

# NPM Package Maintenance

## Description
Comprehensive npm package maintenance using the specialized npm-package-maintainer agent

## Related Commands

| Command | Mode | Use Case |
|---------|------|----------|
| `/lt-dev:maintain` | FULL | Complete optimization (this command) |
| `/lt-dev:maintain-check` | DRY-RUN | Analysis only - no changes |
| `/lt-dev:maintain-security` | SECURITY | Fast security-only updates |
| `/lt-dev:maintain-pre-release` | PRE-RELEASE | Conservative patch-only updates |
| `/lt-dev:maintain-post-feature` | FULL | Clean up after feature development |

## User Prompt
Use the npm-package-maintainer agent to perform comprehensive npm package maintenance.

**Mode**: FULL MODE (complete optimization)

Execute all priorities:
1. Remove unused packages
2. Optimize dependency categorization
3. Update packages to latest versions

Check for:
- Unused dependencies that can be removed
- Packages that should be moved to devDependencies
- Outdated dependencies (all types: security, features, patches)
- Security vulnerabilities
- Compatibility issues

Ensure all tests and build pass after changes.
