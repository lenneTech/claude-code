---
description: Post-feature npm maintenance and dependency optimization
---

# NPM Package Post-Feature Maintenance

## When to Use This Command

- After completing a feature that added or changed dependencies
- Cleaning up the dependency tree after feature development
- Ensuring new dependencies are correctly categorized and current

## Related Commands

| Command | Mode | Use Case |
|---------|------|----------|
| `/lt-dev:maintain` | FULL | Complete optimization |
| `/lt-dev:maintain-check` | DRY-RUN | Analysis only - no changes |
| `/lt-dev:maintain-security` | SECURITY | Fast security-only updates |
| `/lt-dev:maintain-pre-release` | PRE-RELEASE | Conservative patch-only updates |
| `/lt-dev:maintain-post-feature` | FULL | Post-feature cleanup (this command) |

## User Prompt
Use the lt-dev:npm-package-maintainer agent to perform **post-feature** maintenance.

**Mode**: FULL MODE (complete optimization)

After feature implementation, ensure the dependency ecosystem is clean and up-to-date:

Execute all priorities:
1. Remove unused packages (especially if feature changed dependencies)
2. Optimize dependency categorization (ensure new deps are correctly placed)
3. Update packages to latest versions (stay current after feature work)
4. Cleanup unnecessary overrides

Check for:
- Unused dependencies that can be removed (especially from feature work)
- New dependencies that should be in devDependencies vs dependencies
- Outdated dependencies (all types: security, features, patches)
- Security vulnerabilities introduced by new dependencies
- Compatibility issues with newly added packages
- Overrides that are no longer necessary (parent packages now include fixed versions)

This is the standard comprehensive maintenance mode, ideal after completing feature development to ensure the codebase stays clean and dependencies stay current.

Ensure all tests and build pass after changes.
