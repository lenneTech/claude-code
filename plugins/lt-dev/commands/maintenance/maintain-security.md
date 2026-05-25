---
description: Security-only npm updates for vulnerable packages
allowed-tools: Agent
disable-model-invocation: true
---

# NPM Package Security Maintenance

## When to Use This Command

- Responding to security advisories or vulnerability alerts
- Quick security patching without full dependency overhaul
- When stability matters more than staying on latest versions

## Related Commands

| Command | Mode | Use Case |
|---------|------|----------|
| `/lt-dev:maintenance:maintain` | FULL | Complete optimization |
| `/lt-dev:maintenance:maintain-check` | DRY-RUN | Analysis only - no changes |
| `/lt-dev:maintenance:maintain-security` | SECURITY | Fast security-only (this command) |
| `/lt-dev:maintenance:maintain-pre-release` | PRE-RELEASE | Conservative patch-only updates |
| `/lt-dev:maintenance:maintain-post-feature` | FULL | Clean up after feature development |

## User Prompt
Use the lt-dev:npm-package-maintainer agent to perform **SECURITY-ONLY** maintenance.

**Mode**: SECURITY-ONLY MODE

Focus exclusively on security updates:
- Skip package removal analysis (Priority 1) — EXCEPT when an unused direct dependency is the root of an advisory chain: removing it is a valid (often cheaper) security fix and may eliminate the need for overrides.
- Skip categorization optimization (Priority 2)
- Execute Priority 3 with security filter (direct-dep updates that close advisories)
- **Also execute Phase 6 (override management)** — most real-world advisories are TRANSITIVE and cannot be closed by a direct-dep update or by `audit --fix`; they require a scoped override. Apply the Vulnerability Resolution Workflow: group findings by root advisory, target the fixed-in version (target MUST be `>=` the advisory's fixed-in version — an exact-but-too-low target silently leaves the advisory open), then re-audit.
- Skip non-security updates to minimize risk and execution time

Check for:
- Security vulnerabilities (audit with the project's OWN package manager — npm and pnpm resolve transitive trees differently and report different results)
- Security-critical package updates only
- Deprecated packages (these are a security risk — replace with maintained alternatives where possible)

This is a faster, minimal-change mode for urgent security fixes.

**Completion gate:** Re-run `audit` after changes and confirm the vulnerability count dropped to the expected residual. If a package that received an override still appears, the override target is too low or mis-scoped — fix it. Do NOT report a transitive advisory as "blocked" or "needs a framework update" before a correctly-targeted override has been proven unable to clear it. Ensure all tests and build pass after changes.
