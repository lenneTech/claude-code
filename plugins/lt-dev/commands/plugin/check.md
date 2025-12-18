---
description: Verify plugin elements against current best practices and optimize for consistency
---

# Plugin Best Practice Check

Analyze and optimize plugin elements against current Claude Code best practices. Use this command after `/clear`, context summarization, or when you want to ensure elements are up-to-date and consistent.

## When to Use This Command

- After `/clear` to restore best practice awareness
- After context summarization when working on plugin elements
- Before releasing or publishing plugin updates
- Periodic maintenance to ensure consistency
- When unsure if elements follow current best practices

## Related Commands

| Command | Purpose |
|---------|---------|
| `/lt-dev:plugin:element` | Create new plugin elements with best practices |
| `/lt-dev:skill-optimize` | Optimize skill files specifically |

---

## Step 1: Fetch Current Best Practices

**MANDATORY:** Fetch the latest official documentation to ensure up-to-date checks:

```
WebFetch: https://code.claude.com/docs/en/plugins
WebFetch: https://code.claude.com/docs/en/skills
WebFetch: https://code.claude.com/docs/en/slash-commands
WebFetch: https://code.claude.com/docs/en/sub-agents
WebFetch: https://code.claude.com/docs/en/hooks
```

**Fallback:** If any URL returns 404, use `WebSearch: "Claude Code [topic] documentation site:claude.com"`

---

## Step 2: Determine Scope

Use AskUserQuestion to determine the check scope:

**Question (German):** "Was soll geprüft werden?"

**Options:**
1. **Gesamtes Paket** - Alle Elemente in plugins/lt-dev prüfen (empfohlen)
2. **Nur Skills** - Alle Skills auf Best Practices prüfen
3. **Nur Commands** - Alle Commands auf Best Practices prüfen
4. **Nur Agents** - Alle Agents auf Best Practices prüfen
5. **Nur Konfiguration** - permissions.json, .mcp.json, plugin.json prüfen
6. **Einzelnes Element** - Ein spezifisches Element prüfen

If "Einzelnes Element" is selected, ask for the element path.

---

## Step 3: Inventory Elements

Based on scope, inventory all elements to check:

```bash
# Skills
find plugins/lt-dev/skills -name "SKILL.md" -type f

# Commands
find plugins/lt-dev/commands -name "*.md" -type f

# Agents
find plugins/lt-dev/agents -name "*.md" -type f

# Hooks
cat plugins/lt-dev/hooks/hooks.json 2>/dev/null || echo "No hooks.json"
```

---

## Step 4: Execute Checks

For each element, perform the following checks:

### 4.1 YAML Frontmatter Validation

- [ ] Frontmatter exists and is properly formatted
- [ ] All required fields present (name, description for skills/agents; description for commands)
- [ ] Description follows guidelines (WHEN for skills, WHAT for commands)
- [ ] Description length appropriate (max 280 chars for skills)

### 4.2 Structural Consistency

- [ ] File naming follows kebab-case convention
- [ ] Directory structure matches conventions
- [ ] Heading hierarchy is consistent (# title, ## sections, ### subsections)
- [ ] Markdown is clean and well-organized

### 4.3 Content Quality

- [ ] Purpose is clearly stated
- [ ] "When to Use" section exists (for skills and commands)
- [ ] Examples are provided where helpful
- [ ] Related elements are cross-referenced
- [ ] Language is English (except designated German content)

### 4.4 Best Practice Compliance

Compare against fetched documentation:
- [ ] Follows current recommended patterns
- [ ] Uses correct field names and values
- [ ] No deprecated patterns or fields

### 4.5 Integration Checks

- [ ] No duplicate functionality with other elements
- [ ] Cross-references point to existing elements
- [ ] No orphaned elements

### 4.6 Configuration Files

**permissions.json:**
- [ ] All Bash patterns used by skills/agents are listed
- [ ] `usedBy` arrays include all skills/agents using each pattern
- [ ] No orphaned patterns (patterns without valid usedBy references)
- [ ] Patterns follow correct format: `Bash(command:*)`

**Check against skills:**
```bash
# Find all Bash commands used in skills
grep -r "npm \|npx \|lt " plugins/lt-dev/skills/ --include="*.md"

# Compare with permissions.json patterns
cat plugins/lt-dev/permissions.json
```

**.mcp.json:**
- [ ] All MCP servers used by commands/skills are configured
- [ ] Server configurations are valid (type, command/url)
- [ ] No unused MCP server entries

**Check MCP usage:**
```bash
# Find MCP references in commands
grep -r "Linear\|Chrome\|chrome-devtools\|linear" plugins/lt-dev/commands/ --include="*.md"
grep -r "Chrome MCP\|Linear MCP" plugins/lt-dev/commands/ --include="*.md"
```

**plugin.json:**
- [ ] Version follows semver format
- [ ] All required fields present (name, version, description, author)
- [ ] Keywords are relevant and complete

### 4.7 Documentation Consistency

**CLAUDE.md:**
- [ ] Repository structure matches actual file layout
- [ ] Configuration file documentation is current
- [ ] All referenced commands/skills exist

**Check structure:**
```bash
# Compare documented structure with actual
ls -la plugins/lt-dev/
ls -la plugins/lt-dev/.claude-plugin/
```

---

## Step 5: Generate Report

Create a comprehensive report of findings:

```markdown
## Plugin Best Practice Check Report

### Summary
- **Elements Checked:** X
- **Passed:** Y
- **Issues Found:** Z
- **Suggestions:** N

### Detailed Findings

#### Skills (X checked)

| Skill | Status | Issues |
|-------|--------|--------|
| skill-name | ✅/⚠️/❌ | [issues if any] |

[Detailed issues per skill]

#### Commands (X checked)

| Command | Status | Issues |
|---------|--------|--------|
| /command-name | ✅/⚠️/❌ | [issues if any] |

[Detailed issues per command]

#### Agents (X checked)

| Agent | Status | Issues |
|-------|--------|--------|
| agent-name | ✅/⚠️/❌ | [issues if any] |

[Detailed issues per agent]

#### Configuration Files

| File | Status | Issues |
|------|--------|--------|
| permissions.json | ✅/⚠️/❌ | [issues if any] |
| .mcp.json | ✅/⚠️/❌ | [issues if any] |
| plugin.json | ✅/⚠️/❌ | [issues if any] |

[Detailed issues per config file]

#### Documentation

| File | Status | Issues |
|------|--------|--------|
| CLAUDE.md | ✅/⚠️/❌ | [issues if any] |

### Recommended Actions

**Critical (fix immediately):**
1. [Critical issue 1]
2. [Critical issue 2]

**Improvements (recommended):**
1. [Improvement 1]
2. [Improvement 2]

**Suggestions (optional):**
1. [Suggestion 1]
2. [Suggestion 2]
```

---

## Step 6: Offer Automated Fixes

After presenting the report, ask (in German):

"Ich habe [N] Probleme und [M] Verbesserungsvorschläge gefunden.

Möchtest du:
1. **Alle automatisch beheben** - Ich korrigiere alle Probleme automatisch
2. **Einzeln durchgehen** - Wir besprechen jedes Problem einzeln
3. **Nur kritische beheben** - Nur die kritischen Probleme automatisch beheben
4. **Nichts ändern** - Nur den Bericht als Referenz verwenden"

---

## Step 7: Execute Fixes (if requested)

For each fix:
1. Show the current state
2. Show the proposed change
3. Apply the change
4. Verify the change

After all fixes:
```markdown
## Fix Summary

- **Applied:** X fixes
- **Skipped:** Y items
- **Manual action required:** Z items

### Changes Made
1. [Change 1]
2. [Change 2]

### Manual Actions Required
1. [Action 1] - [Reason]
```

---

## Check Categories

### Critical Issues (❌)
- Missing required frontmatter fields
- Invalid YAML syntax
- Broken cross-references
- Duplicate element names
- Deprecated patterns from outdated documentation
- **permissions.json**: Missing patterns for used Bash commands
- **permissions.json**: Invalid pattern format
- **.mcp.json**: Missing required MCP server
- **plugin.json**: Invalid or missing required fields

### Warnings (⚠️)
- Description too long or too short
- Missing "When to Use" section
- Inconsistent heading hierarchy
- Missing examples for complex elements
- Potential overlap with other elements
- **permissions.json**: Incomplete `usedBy` arrays
- **permissions.json**: Orphaned patterns (no valid usedBy)
- **.mcp.json**: Unused MCP server entries
- **CLAUDE.md**: Repository structure doesn't match actual layout

### Suggestions (💡)
- Could add more examples
- Could improve description clarity
- Could add cross-references
- Minor formatting improvements
- **permissions.json**: Add descriptions for clarity
- **plugin.json**: Add more keywords for discoverability

---

## Quick Check Mode

For a fast check without full documentation fetch, use this condensed checklist:

### Frontmatter Quick Check
```
Skills: name + description (max 280 chars, WHEN focus)
Commands: description (WHAT focus)
Agents: name + description + model + tools
```

### Structure Quick Check
```
- File name is kebab-case
- # Title exists
- ## Sections use level 2
- Language is English
```

### Content Quick Check
```
- Purpose stated in first paragraph
- "When to Use" section exists
- Related elements mentioned
```

### Configuration Quick Check
```
permissions.json:
- All npm/npx/lt commands have patterns
- usedBy arrays reference existing skills

.mcp.json:
- All used MCP servers are configured
- Server types are valid (stdio/http)

plugin.json:
- Version is semver format
- Required fields present (name, version, description)

CLAUDE.md:
- Repository structure matches actual layout
- Configuration docs are current
```
