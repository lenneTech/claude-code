---
description: Full npm package maintenance via npm-package-maintainer agent
allowed-tools: Agent
disable-model-invocation: true
---

# NPM Package Maintenance

## When to Use This Command

- Performing routine dependency maintenance on a Node.js project
- After completing multiple features and dependencies need cleanup
- When you want a comprehensive package optimization (removal, recategorization, updates)

## Related Commands

| Command | Mode | Use Case |
|---------|------|----------|
| `/lt-dev:maintenance:maintain` | FULL | Complete optimization (this command) |
| `/lt-dev:maintenance:maintain-check` | DRY-RUN | Analysis only - no changes |
| `/lt-dev:maintenance:maintain-security` | SECURITY | Fast security-only updates |
| `/lt-dev:maintenance:maintain-pre-release` | PRE-RELEASE | Conservative patch-only updates |
| `/lt-dev:maintenance:maintain-post-feature` | FULL | Clean up after feature development |

## User Prompt
Use the lt-dev:npm-package-maintainer agent to perform comprehensive npm package maintenance.

**Mode**: FULL MODE (complete optimization)

Execute all priorities:
1. Remove unused packages
2. Optimize dependency categorization
3. Update packages to latest versions
4. Cleanup unnecessary overrides

Check for:
- Unused dependencies that can be removed
- Packages that should be moved to devDependencies
- Deprecated packages and available replacements
- Outdated dependencies (all types: security, features, patches)
- Security vulnerabilities
- Compatibility issues
- Overrides that are no longer necessary (parent packages now include fixed versions)

Ensure all tests and build pass after changes.
