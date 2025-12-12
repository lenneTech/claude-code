---
name: maintain-check
description: Analyze npm packages WITHOUT making any changes - generates a comprehensive report of what would be done
---

# NPM Package Maintenance Check (Dry-Run)

## Description
Analyze npm packages WITHOUT making any changes - generates a comprehensive report of what would be done

## User Prompt
Use the npm-package-maintainer agent to perform **DRY-RUN** analysis.

**Mode**: DRY-RUN MODE (analysis only, no changes)

Analyze and report WITHOUT making changes:
- Analyze unused packages (what WOULD be removed)
- Analyze categorization (what WOULD be moved to devDependencies)
- Discover outdated packages (what WOULD be updated)
- Check security vulnerabilities
- Estimate risk levels for all potential changes

**CRITICAL**: Do NOT modify package.json, do NOT run npm install/uninstall, do NOT make any changes.

Generate comprehensive report including:
- Packages that could be removed (with usage analysis)
- Packages that could be recategorized
- Available updates categorized by risk (SAFE/MEDIUM/HIGH)
- Security vulnerabilities found
- Estimated impact and time requirements

This is useful for planning maintenance windows or getting pre-approval for changes.
