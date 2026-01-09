# Marketplace Optimizer Examples

## Example 1: Standard Optimization Run

### User Invocation
```
/optimize
```

### Phase 1: Cache Update Query

**Claude asks (via normal text output):**
```
Cache aktualisieren?

Soll der Best-Practices-Cache (.claude/skills/marketplace-optimizer/best-practices-cache.md)
mit den aktuellen Reference URLs aus CLAUDE.md neu erstellt werden?

(ja/nein)
```

**User responds:** "nein" (skip cache update)

### Phase 2: Secondary Sources Query

**Claude asks (via normal text output):**
```
Sekundäre Quellen für die Optimierung

Möchtest du zusätzliche Referenzen (URLs oder lokale Dateien) verwenden?

Eingabe:
- URLs: https://example.com/guide.md
- Lokale Dateien: ./docs/notes.md oder /absolute/path/file.md
- Mehrere Quellen durch Kommas, Leerzeichen oder Zeilenumbrüche trennen
- "keine" oder leere Eingabe = nur offizielle Quellen verwenden
```

**User responds:** "keine"

### Phase 3: Cache & Sources Loading

**Claude reports:**
```
Loading knowledge sources...

✅ Local cache: best-practices-cache.md loaded
✅ GitHub sources available for optional fetch

Proceeding with local cache as primary knowledge source.
```

### Phase 4: Element Analysis

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

### Phase 5: Optimization Proposals

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

### Phase 6: Parallel Execution

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

### Phase 7: Summary

```
## Marketplace Optimization Complete

### Sources Used
- Local cache: Loaded
- GitHub sources: Available (not fetched)
- Secondary: 0 (skipped by user)
- Cache update: Skipped by user

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

### Phase 1: Cache Update Query

**Claude asks:** (user chooses to skip)

### Phase 2: Secondary Sources Query

**Claude asks (via normal text output):**
```
Sekundäre Quellen für die Optimierung

Möchtest du zusätzliche Referenzen (URLs oder lokale Dateien) verwenden?
```

**User responds with sources:**
```
https://blog.example.com/claude-tips.md
https://dev.to/article/claude-code-patterns
./docs/internal-guidelines.md
/Users/dev/notes/claude-learnings.md
```

### Phase 3: Source Processing

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
Note: These will NOT be added to CLAUDE.md Primary Sources.
```

### Phase 4: Knowledge Extraction

**Claude analyzes:**
```
Analyzing all sources...

Local Cache: Loaded (best-practices-cache.md)
Secondary Sources (4):
  - 2 external URLs
  - 2 local files

Cross-referencing...

⚠️ Secondary source findings:
  - 5 patterns confirmed by local cache
  - 2 patterns conflict with cache (IGNORED)
  - 3 unique patterns not in cache (FLAGGED for review)
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

## Example 4: Cache Update with Broken URL Discovery

### During Cache Update (Step 1)

**User confirms cache update, Claude reports:**
```
Updating best-practices-cache...

Fetching Reference URLs from CLAUDE.md...

✅ https://code.claude.com/docs/en/plugins - OK
✅ https://code.claude.com/docs/en/skills - OK
❌ https://code.claude.com/docs/en/old-page - 404 Not Found

Searching for replacement...
  WebSearch: "Claude Code old-page documentation site:claude.com"
  Found: https://code.claude.com/docs/en/new-page

Updating CLAUDE.md Reference URLs...
  - Replaced: old-page → new-page

Also discovered new documentation page:
  + https://code.claude.com/docs/en/newly-added-topic

Compiling cache...
Cache updated successfully with 10 Reference URLs.
CLAUDE.md updated with 2 changes.
```

---

## Example 5: No Optimizations Needed

### After Analysis

```
## Optimization Complete

### Sources Used
- Local cache: Loaded
- Cache update: Skipped
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

No optimizations needed. Everything is in excellent shape!
```
