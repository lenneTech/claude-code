---
description: Security-only npm updates for vulnerable packages
---

# NPM Package Security Maintenance

## When to Use This Command

- Responding to security advisories or vulnerability alerts
- Quick security patching without full dependency overhaul
- When stability matters more than staying on latest versions

## Related Commands

| Command | Mode | Use Case |
|---------|------|----------|
| `/lt-dev:maintain` | FULL | Complete optimization |
| `/lt-dev:maintain-check` | DRY-RUN | Analysis only - no changes |
| `/lt-dev:maintain-security` | SECURITY | Fast security-only (this command) |
| `/lt-dev:maintain-pre-release` | PRE-RELEASE | Conservative patch-only updates |
| `/lt-dev:maintain-post-feature` | FULL | Clean up after feature development |

## User Prompt
Use the lt-dev:npm-package-maintainer agent to perform **SECURITY-ONLY** maintenance.

**Mode**: SECURITY-ONLY MODE

Focus exclusively on security updates:
- Skip package removal analysis (Priority 1)
- Skip categorization optimization (Priority 2)
- Execute ONLY Priority 3 with security filter
- Update packages with known vulnerabilities from npm audit
- Skip non-security updates to minimize risk and execution time

Check for:
- Security vulnerabilities (npm audit)
- Security-critical package updates only

This is a faster, minimal-change mode for urgent security fixes.

Ensure all tests and build pass after changes.
