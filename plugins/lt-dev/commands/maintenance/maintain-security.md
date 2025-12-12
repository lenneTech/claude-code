---
name: maintain-security
description: Fast security-focused npm package maintenance - updates only packages with known vulnerabilities
---

# NPM Package Security Maintenance

## Description
Fast security-focused npm package maintenance - updates only packages with known vulnerabilities

## User Prompt
Use the npm-package-maintainer agent to perform **SECURITY-ONLY** maintenance.

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
