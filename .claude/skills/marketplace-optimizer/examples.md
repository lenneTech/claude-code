# Marketplace Optimizer Examples

## Example 1: Standard Optimization Run

### User Invocation
```
/optimize
```

### Phase 1: Secondary Sources Query

**Claude asks (via normal text output):**
```
**Secondary Sources for Optimization**

Please provide URLs and/or local file paths to be used as additional references.

Format:
- URLs: https://example.com/guide.md
- Local files: ./docs/notes.md or /absolute/path/file.md

Multiple sources can be separated by commas, spaces, or line breaks.

If you do not want to use secondary sources, simply respond with an empty message or "none".
```

**User responds:** (empty message or "none")

### Phase 2: Primary URL Validation

**Claude reports:**
```
Validating Primary URLs from CLAUDE.md...

✅ https://code.claude.com/docs/en/plugins - OK
✅ https://code.claude.com/docs/en/skills - OK
✅ https://code.claude.com/docs/en/slash-commands - OK
✅ https://code.claude.com/docs/en/sub-agents - OK
✅ https://code.claude.com/docs/en/hooks - OK
✅ https://code.claude.com/docs/en/mcp - OK
✅ https://code.claude.com/docs/en/memory - OK
✅ https://code.claude.com/docs/en/settings - OK
✅ https://code.claude.com/docs/en/cli-reference - OK
✅ https://code.claude.com/docs/en/plugins-reference - OK
✅ https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md - OK

All 11 Primary URLs validated successfully.
No CLAUDE.md updates needed.
```

### Phase 3: Element Analysis

**Claude analyzes and reports:**
```
Analyzing all elements...

Project-level (.claude/):
  Skills: 1 found
  Agents: 1 found
  Commands: 1 found

Marketplace (plugins/):
  Skills: 7 found
  Commands: 15 found
  Agents: 2 found
  Hooks: 1 configuration

Comparing against best practices...
```

### Phase 4: Optimization Proposals

**Claude presents checkbox list:**
```
Found 6 potential optimizations:

Project-level (.claude/)
☑ [command] optimize: Verify /project: prefix in all usage examples

Marketplace (plugins/)
Frontmatter Updates
☑ [skill] generating-nest-servers: Add missing "Related Skills" section
☑ [command] git/commit-message: Add allowed-tools restriction

Content Enhancements
☑ [skill] using-lt-cli: Add more trigger terms to description
☑ [agent] npm-package-maintainer: Add self-verification checklist

Structure Improvements
☑ [skill] developing-lt-frontend: Split large reference.md into subtopics

Select optimizations to apply (all selected by default):
```

**User deselects one item and confirms**

### Phase 5: Parallel Execution

**Claude executes:**
```
Executing 4 approved optimizations...

Parallel Group 1:
  ├─ Updating generating-nest-servers/SKILL.md... ✅
  ├─ Updating git/commit-message.md... ✅
  └─ Updating using-lt-cli/SKILL.md... ✅

Sequential:
  └─ Updating npm-package-maintainer.md... ✅

All optimizations completed successfully.
```

### Phase 6: Summary

```
## Marketplace Optimization Complete

### Sources Used
- Primary: 11 URLs validated
- Secondary: 0 (skipped by user)
- CLAUDE.md: No changes needed

### Optimizations Applied
- Total approved: 4
- Completed: 4
- Skipped (user choice): 1
- Failed: 0

### Changes Made

#### Project-level (.claude/)
1. [Command] optimize: Verified /project: prefix in docs

#### Marketplace (plugins/)
1. [Frontmatter] generating-nest-servers: Added Related Skills section
2. [Frontmatter] git/commit-message: Added allowed-tools: Bash(git:*)
3. [Content] using-lt-cli: Enhanced description with trigger terms
4. [Content] npm-package-maintainer: Added self-verification checklist
```

---

## Example 2: With Secondary Sources (via Arguments)

### User Invocation
```
/optimize https://blog.example.com/claude-tips.md ./docs/internal-guidelines.md
```

### Phase 1: Argument Detection

**Claude detects arguments and skips the question:**
```
Secondary sources provided via arguments:

Detecting source types...
  https://blog.example.com/claude-tips.md → URL
  ./docs/internal-guidelines.md → Local file

Proceeding with 2 secondary sources.
```

---

## Example 3: With Secondary Sources (Interactive)

### User Invocation
```
/optimize
```

### Phase 1: Secondary Sources Query

**Claude asks (via normal text output):**
```
**Secondary Sources for Optimization**

Please provide URLs and/or local file paths to be used as additional references.

Format:
- URLs: https://example.com/guide.md
- Local files: ./docs/notes.md or /absolute/path/file.md

Multiple sources can be separated by commas, spaces, or line breaks.

If you do not want to use secondary sources, simply respond with an empty message or "none".
```

**User responds with sources:**
```
https://blog.example.com/claude-tips.md
https://dev.to/article/claude-code-patterns
./docs/internal-guidelines.md
/Users/dev/notes/claude-learnings.md
```

### Phase 2: Source Processing

**Claude reports:**
```
Processing secondary sources...

URLs (2):
  ✅ https://blog.example.com/claude-tips.md - Fetched
  ✅ https://dev.to/article/claude-code-patterns - Fetched

Local Files (2):
  ✅ ./docs/internal-guidelines.md - Read (2.3 KB)
  ✅ /Users/dev/notes/claude-learnings.md - Read (1.1 KB)

Total: 4 secondary sources loaded for this session.
Note: These will NOT be added to CLAUDE.md Primary URLs.
```

### Phase 3: Knowledge Extraction

**Claude analyzes:**
```
Analyzing all sources...

Primary Sources (11): Official documentation
Secondary Sources (4):
  - 2 external URLs
  - 2 local files

Cross-referencing...

⚠️ Secondary source findings:
  - 5 patterns confirmed by primary sources
  - 2 patterns conflict with official docs (IGNORED)
  - 3 unique patterns not in primary (FLAGGED for review)
    • From: blog.example.com - "Consider X approach"
    • From: internal-guidelines.md - "Team prefers Y pattern"
    • From: claude-learnings.md - "Z works well in practice"
```

### Optimization Proposals

```
Found 8 potential optimizations:

From Primary Sources (trusted)
☑ [skill] example-skill: Add Related Skills section
☑ [command] example-cmd: Add allowed-tools

From Secondary Sources (flagged for review)
☐ [suggestion] Consider X approach (from blog.example.com)
☐ [suggestion] Team prefers Y pattern (from internal-guidelines.md)
☐ [suggestion] Z works well in practice (from claude-learnings.md)

⚠️ Secondary suggestions are disabled by default.
   Review against official docs before enabling.
```

---

## Example 4: Broken URL Discovery (Auto-Fix)

### During Validation

**Claude reports:**
```
Validating Primary URLs from CLAUDE.md...

✅ https://code.claude.com/docs/en/plugins - OK
✅ https://code.claude.com/docs/en/skills - OK
❌ https://code.claude.com/docs/en/old-page - 404 Not Found

Searching for replacement...
  WebSearch: "Claude Code old-page documentation site:claude.com"
  Found: https://code.claude.com/docs/en/new-page

Updating CLAUDE.md...
  - Replaced: old-page → new-page

Also discovered new documentation page:
  + https://code.claude.com/docs/en/newly-added-topic

CLAUDE.md updated with 2 changes.
```

---

## Example 5: No Optimizations Needed

### After Analysis

```
## Optimization Complete

### Sources Used
- Primary: 11 URLs validated
- Secondary: 0

### Analysis Results
All elements follow current best practices.

Project-level (.claude/):
✅ Skills: 1/1 compliant
✅ Agents: 1/1 compliant
✅ Commands: 1/1 compliant

Marketplace (plugins/):
✅ Skills: 7/7 compliant
✅ Commands: 15/15 compliant
✅ Agents: 2/2 compliant
✅ Hooks: Valid configuration

✅ CLAUDE.md: Up to date

No optimizations needed. Everything is in excellent shape!
```
