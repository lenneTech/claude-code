# Marketplace Optimizer Reference

## Primary URL Categories

The following categories should be covered in CLAUDE.md Primary URLs:

| Category | Topic | Expected URL Pattern |
|----------|-------|---------------------|
| Core | Plugins & Marketplaces | `code.claude.com/docs/en/plugins` |
| Core | Skills | `code.claude.com/docs/en/skills` |
| Core | Slash Commands | `code.claude.com/docs/en/slash-commands` |
| Core | Subagents | `code.claude.com/docs/en/sub-agents` |
| Core | Hooks | `code.claude.com/docs/en/hooks` |
| Integration | MCP Servers | `code.claude.com/docs/en/mcp` |
| Configuration | Memory (CLAUDE.md) | `code.claude.com/docs/en/memory` |
| Configuration | Settings | `code.claude.com/docs/en/settings` |
| Reference | CLI Reference | `code.claude.com/docs/en/cli-reference` |
| Reference | Plugin Reference | `code.claude.com/docs/en/plugins-reference` |
| Updates | CHANGELOG | `github.com/anthropics/claude-code/blob/main/CHANGELOG.md` |

## URL Validation Patterns

### Valid Response Indicators
- HTTP 200 status
- Content contains Claude Code documentation
- No redirect to error page

### Invalid Response Indicators
- HTTP 404 status
- Redirect to login page
- Generic error message
- Empty content

### Fallback Domains

If primary domain fails, try in order:
1. `code.claude.com/docs/en/{topic}`
2. `docs.claude.com/en/docs/claude-code/{topic}`
3. `docs.anthropic.com/en/docs/claude-code/{topic}`

## Secondary Source Validation

**IMPORTANT:** Secondary sources are NEVER added to CLAUDE.md Primary URLs.
They are only used for the current optimization session.

### Trust Indicators (Higher Confidence)
- Published by Anthropic employees
- Referenced in official docs
- Recent publication date (< 6 months)
- Technical accuracy matches primary sources

### Distrust Indicators (Lower Confidence)
- Conflicts with primary documentation
- Outdated publication date (> 12 months)
- Generic AI tutorials not specific to Claude Code
- Missing citations or references

### Usage Rules
- Secondary sources provide supplementary insights only
- If secondary conflicts with primary: **IGNORE secondary**
- If secondary has unique info not in primary: **FLAG for critical review**
- Never persist secondary sources to CLAUDE.md

## Optimization Categories

### High Priority (Always Check)
1. **Frontmatter Completeness**
   - Required fields present
   - Valid field values
   - No deprecated fields

2. **Description Quality**
   - Skills: Focus on WHEN (auto-detection)
   - Commands: Focus on WHAT (user clarity)
   - Agents: Focus on TASKS (spawning decisions)

3. **Cross-References**
   - Related Skills sections present
   - Links are valid
   - No circular dependencies

### Medium Priority (Check if Time Permits)
1. **Structure Alignment**
   - Consistent heading levels
   - Logical section order
   - Examples where helpful

2. **Tool Restrictions**
   - allowed-tools set appropriately
   - Minimal permissions principle
   - Security-sensitive commands restricted

### Low Priority (Nice to Have)
1. **Documentation Enhancements**
   - Additional examples
   - Edge case coverage
   - Performance tips

## Parallel Execution Rules

### Safe to Parallelize
- Independent file edits (different files)
- URL validations
- Read-only analysis tasks
- WebSearch queries

### Must Be Sequential
- Multiple edits to same file
- Tasks with output dependencies
- CLAUDE.md updates (single writer)
- Verification after changes

## Common Optimization Patterns

### Pattern 1: Missing Frontmatter Field
```diff
 ---
 name: skill-name
+description: Required description explaining WHEN to use this skill
 ---
```

### Pattern 2: Improve Description for Auto-Detection
```diff
 ---
 name: my-skill
-description: A skill for doing things
+description: Handles X when user mentions Y or Z. Use for A, B, C tasks.
 ---
```

### Pattern 3: Add Related Skills Section
```diff
 ## Related Skills

+- `related-skill-1` - For complementary functionality
+- `related-skill-2` - Alternative approach for similar tasks
```

### Pattern 4: Fix allowed-tools
```diff
 ---
 description: Git commit message generator
+allowed-tools: Bash(git:*), Read, Grep
 ---
```

## Verification Commands

### Check Frontmatter Syntax
```bash
# Validate YAML frontmatter in all markdown files
find plugins/ -name "*.md" -exec sh -c '
  head -50 "$1" | grep -q "^---" && echo "Valid: $1" || echo "Missing frontmatter: $1"
' _ {} \;
```

### Find Missing Descriptions
```bash
grep -L "description:" plugins/**/*.md 2>/dev/null
```

### Check Cross-References
```bash
grep -r "Related Skills" plugins/ --include="*.md" -A 5
```

### Validate File References
```bash
# Find referenced files that don't exist
grep -roh "\.md" plugins/ | sort | uniq | while read f; do
  [ -f "plugins/lt-dev/$f" ] || echo "Missing: $f"
done
```
