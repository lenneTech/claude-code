---
description: Post-feature npm maintenance and dependency optimization
allowed-tools: Agent
disable-model-invocation: true
---

# NPM Package Post-Feature Maintenance

## When to Use This Command

- After completing a feature that added or changed dependencies
- Cleaning up the dependency tree after feature development
- Ensuring new dependencies are correctly categorized and current

## Related Commands

| Command | Mode | Use Case |
|---------|------|----------|
| `/lt-dev:maintenance:maintain` | FULL | Complete optimization |
| `/lt-dev:maintenance:maintain-check` | DRY-RUN | Analysis only - no changes |
| `/lt-dev:maintenance:maintain-security` | SECURITY | Fast security-only updates |
| `/lt-dev:maintenance:maintain-pre-release` | PRE-RELEASE | Conservative patch-only updates |
| `/lt-dev:maintenance:maintain-post-feature` | FULL | Post-feature cleanup (this command) |

## User Prompt
Use the lt-dev:npm-package-maintainer agent to perform **post-feature** maintenance.

**Mode**: FULL MODE (complete optimization)

After feature implementation, ensure the dependency ecosystem is clean and up-to-date:

Execute all priorities:
1. Remove unused packages (especially if feature changed dependencies)
2. Optimize dependency categorization (ensure new deps are correctly placed)
3. Update packages to latest versions (stay current after feature work)
4. **Raise** overrides that sit below their advisory's fixed-in version

Check for:
- Unused dependencies that can be removed (especially from feature work)
- New dependencies that should be in devDependencies vs dependencies
- Deprecated packages and available replacements (especially newly added ones)
- Outdated dependencies (all types: security, features, patches)
- Security vulnerabilities introduced by new dependencies
- Compatibility issues with newly added packages
- Overrides pinned **below** their fixed-in version (raise them — this is the common
  real finding). Overrides are never deleted just because the audit is clean; the
  audit is clean *because* they work. Removal requires `pnpm why` proof that the
  package has left the dependency tree.

This is the standard comprehensive maintenance mode, ideal after completing feature development to ensure the codebase stays clean and dependencies stay current.

Ensure all tests and build pass after changes.
