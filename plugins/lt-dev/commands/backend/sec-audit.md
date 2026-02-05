---
description: OWASP security audit for dependencies, config, and code
allowed-tools: Bash, Read, Grep, Glob, Write
argument-hint: [--full | --deps-only | --config-only | --code-only]
---

# OWASP Security Audit

Perform a comprehensive security audit based on OWASP Secure Coding Practices.

## Audit Modes

| Mode | Description |
|------|-------------|
| `--full` (default) | Complete audit of all areas |
| `--deps-only` | Only check npm dependencies |
| `--config-only` | Only check configuration files |
| `--code-only` | Only check code patterns |

## Audit Process

Execute the following audit steps and generate a structured report.

### 1. Dependency Analysis

```bash
# Run npm audit
npm audit --json > /tmp/npm-audit.json 2>/dev/null || true
npm audit

# Check for outdated packages
npm outdated

# List all dependencies
npm list --depth=0
```

**Check for:**
- Known vulnerabilities (CVE)
- Deprecated packages
- Outdated security-critical packages (bcrypt, helmet, etc.)

### 2. Configuration Analysis

Search for configuration files and check security settings:

**Files to analyze:**
- `main.ts` - Application bootstrap, Helmet, CORS, ValidationPipe
- `.env` / `.env.example` - Environment variables (no secrets in example!)
- `nest-cli.json` - Build configuration
- `tsconfig.json` - TypeScript strict mode
- Docker/deployment configs

**Check for:**

| Area | Expected | Risk if Missing |
|------|----------|-----------------|
| Helmet | `app.use(helmet())` | Missing security headers |
| CORS | Explicit origins, not `*` | Cross-origin attacks |
| ValidationPipe | `whitelist: true, forbidNonWhitelisted: true` | Mass assignment |
| Rate Limiting | `ThrottlerModule` configured | DoS attacks |
| HTTPS redirect | Enabled in production | Data interception |

### 3. Code Pattern Analysis

Search for anti-patterns and vulnerabilities:

**Critical Patterns to Find:**

```typescript
// 1. Hardcoded secrets
pattern: /(secret|password|api.?key|token)\s*[:=]\s*['"][^'"]+['"]/i

// 2. Unsafe eval/Function
pattern: /eval\(|new\s+Function\(/

// 3. SQL/NoSQL injection risks
pattern: /\$where|\.find\(\{.*\$|`.*\${/

// 4. Missing input validation
pattern: /@(Body|Query|Param)\([^)]*\)\s+\w+:\s+any/

// 5. Exposed sensitive fields
pattern: /@UnifiedField\([^)]*\)\s+password|@UnifiedField\([^)]*\)\s+secret/

// 6. Disabled security decorators
pattern: /\/\/\s*@Restricted|\/\/\s*@Roles/

// 7. Unsafe file operations
pattern: /path\.join\([^)]*req\.|fs\.(readFile|writeFile)\([^)]*req\./
```

### 4. Authentication & Authorization Check

Search and analyze:
- All `@Restricted` and `@Roles` decorators
- JWT configuration (expiry, secret strength)
- Password hashing (bcrypt cost factor)
- Session/token management

### 5. OWASP Checklist Validation

Cross-reference with `owasp-checklist.md`:

| Category | Items to Verify |
|----------|----------------|
| Input Validation | ValidationPipe, DTOs, class-validator |
| Output Encoding | HTML sanitization, response filtering |
| Authentication | bcrypt, JWT config, password policy |
| Session Management | Token expiry, refresh tokens |
| Access Control | Guards, decorators, ownership checks |
| Cryptography | Secure random, no weak algorithms |
| Error Handling | No stack traces in prod, logging |
| Data Protection | hideField, encryption at rest |
| Communication | HTTPS, HSTS, secure headers |
| Database | Parameterized queries, connection security |
| File Management | Upload validation, path traversal |

## Report Structure

Generate a markdown report with the following structure:

```markdown
# Security Audit Report

**Date:** [Current Date]
**Project:** [Project Name]
**Auditor:** Claude Code Security Audit

## Executive Summary

- **Risk Level:** [Critical/High/Medium/Low]
- **Vulnerabilities Found:** [Count]
- **Configuration Issues:** [Count]
- **Recommendations:** [Count]

## Findings

### Critical

| # | Finding | Location | Recommendation |
|---|---------|----------|----------------|
| 1 | ... | ... | ... |

### High

...

### Medium

...

### Low

...

## Dependency Audit

| Package | Severity | Vulnerability | Fix |
|---------|----------|---------------|-----|
| ... | ... | ... | ... |

## Configuration Analysis

| Setting | Status | Recommendation |
|---------|--------|----------------|
| Helmet | ✅/❌ | ... |
| CORS | ✅/❌ | ... |
| ... | ... | ... |

## Code Analysis

### Anti-Patterns Found

...

### Security Decorators

...

## Recommendations

1. **Immediate:** [Critical fixes]
2. **Short-term:** [High priority improvements]
3. **Long-term:** [Best practice implementations]

## OWASP Compliance

| Category | Status | Coverage |
|----------|--------|----------|
| Input Validation | ✅/⚠️/❌ | X% |
| ... | ... | ... |
```

## When to Use

- Before production deployments
- After major dependency updates
- During security-focused code reviews
- As part of regular security maintenance
- When onboarding new security requirements

## Related Commands

- `/lt-dev:backend:sec-review` - Quick security review of code changes
- `/lt-dev:maintenance:maintain-security` - Security-focused package updates

## Post-Audit Actions

After generating the report:

1. **Critical findings:** Fix immediately before deployment
2. **High findings:** Plan fixes within current sprint
3. **Medium findings:** Add to backlog with priority
4. **Low findings:** Document for future consideration

Save the report to `docs/security-audit-[date].md` for tracking.
