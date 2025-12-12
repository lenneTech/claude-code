---
name: maintain-pre-release
description: Ultra-conservative npm package maintenance before a release - only zero-risk patch updates
---

# NPM Package Pre-Release Maintenance

## Description
Ultra-conservative npm package maintenance before a release - only zero-risk patch updates

## User Prompt
Use the npm-package-maintainer agent to perform **PRE-RELEASE** maintenance.

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
