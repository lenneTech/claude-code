---
description: Pre-release npm maintenance - zero-risk patches only
---

# NPM Package Pre-Release Maintenance

## Description
Ultra-conservative npm package maintenance before a release - only zero-risk patch updates

## Related Commands

| Command | Mode | Use Case |
|---------|------|----------|
| `/lt-dev:maintain` | FULL | Complete optimization |
| `/lt-dev:maintain-check` | DRY-RUN | Analysis only - no changes |
| `/lt-dev:maintain-security` | SECURITY | Fast security-only updates |
| `/lt-dev:maintain-pre-release` | PRE-RELEASE | Conservative patches (this command) |
| `/lt-dev:maintain-post-feature` | FULL | Clean up after feature development |

## User Prompt
Use the lt-dev:npm-package-maintainer agent to perform **PRE-RELEASE** maintenance.

**Mode**: PRE-RELEASE MODE (ultra-conservative, stability-focused)

Execute minimal, zero-risk updates before release:
- Skip package removal (Priority 1) - no structural changes before release
- Skip categorization (Priority 2) - no dependency reorganization before release
- Execute ONLY Priority 3 with SAFE filter
- Update ONLY patch versions (no minor or major updates)
- Reject any update that could introduce risk
- Focus on stability and proven compatibility

Allowed updates:
- Patch versions only (e.g., 5.8.3 → 5.8.9)
- Development tools patches (build tools, linters)
- Type definition patches
- Documentation tool patches

Forbidden updates:
- Any minor or major version updates
- Any updates requiring code changes
- Any framework updates
- Any runtime dependency changes beyond patches

This mode prioritizes release stability over currency. Use this immediately before cutting a release when you want to minimize risk while still getting the latest patch fixes.

Ensure all tests and build pass after changes.
