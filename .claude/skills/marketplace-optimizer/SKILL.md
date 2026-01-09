---
name: marketplace-optimizer
description: Optimizes this Claude Code marketplace based on official documentation and optional secondary sources. Use when optimizing plugins, skills, commands, agents, or the marketplace structure. Triggers on "optimize marketplace", "update documentation sources", "sync with best practices", or when user wants to improve the plugin quality.
---

# Marketplace Optimizer

You are an expert in optimizing Claude Code marketplaces and plugins. This skill ensures that all elements in this package follow current best practices from official Anthropic documentation, while optionally incorporating insights from secondary sources.

## When This Skill Activates

- User wants to optimize the marketplace or plugins
- User wants to optimize project-level `.claude/` elements
- User asks to update/verify documentation sources
- User wants to sync with latest Claude Code best practices
- User mentions "optimize", "update docs", or "best practices" in context of this marketplace

## Scope

This skill optimizes **both**:

1. **Project-level elements** (`.claude/`)
   - `.claude/skills/` - Project-specific skills
   - `.claude/agents/` - Project-specific agents
   - `.claude/commands/` - Project-specific commands (available as `/project:*`)

2. **Marketplace elements** (`plugins/`)
   - `plugins/*/skills/` - Published skills
   - `plugins/*/agents/` - Published agents
   - `plugins/*/commands/` - Published commands
   - `plugins/*/hooks/` - Event hooks

## Workflow Overview

### Phase 1: Source Collection

1. **Handle Secondary Sources**
   - If `--none` argument: proceed with primary sources only (no prompts)
   - If other arguments provided: use them as secondary sources
   - If no arguments: ask user via **normal text output** for secondary sources (URLs and/or local files). User responds via normal prompt. Empty response or "none" means no secondary sources.
   - Secondary sources are treated with lower authority than primary sources
   - Conflicting information in secondary sources is ignored

2. **Read Primary URLs from CLAUDE.md**
   - Extract the Primary URLs table
   - These are the authoritative sources directly from Claude Code developers

### Phase 2: Source Validation & Update

1. **Validate Each Primary URL**
   - Attempt to fetch each URL
   - Check for 404 errors or redirects
   - Note which URLs are working/broken

2. **Search for Missing/Updated URLs**
   - Use WebSearch fallback for broken URLs
   - Check for new documentation pages
   - Identify any gaps in coverage

3. **Update CLAUDE.md**
   - Add new **official** documentation URLs discovered (only from code.claude.com, docs.anthropic.com, github.com/anthropics)
   - Update broken URLs with working alternatives
   - Keep the Primary URLs table current and complete
   - **NEVER add secondary sources to Primary URLs** - they are only used for the current session

### Phase 3: Knowledge Extraction

1. **Fetch All Primary Sources** (parallel)
   - Download current best practices from each working URL
   - Extract key patterns, requirements, and guidelines
   - **Document the authoritative standards** for:
     - YAML frontmatter fields and their valid values
     - Element structure (skills, commands, agents, hooks)
     - Naming conventions and file organization
     - Description guidelines and trigger terms

2. **Fetch Secondary Sources** (if provided)
   - Download user-provided sources
   - Mark information as lower authority

3. **Build Knowledge Base**
   - Primary sources = highest authority (MUST be followed)
   - Secondary sources = supplementary, verify against primary
   - **Merge with Content Standards** (see below) - these are mandatory

### Phase 4: Analysis & Recommendations

1. **Analyze Current Marketplace State**
   - Scan all plugins, skills, commands, agents, hooks
   - Compare against **best practices from Primary Sources**
   - Check compliance with **Content Standards** (no history references, token efficiency)

2. **Identify Optimizations**
   - List all potential improvements
   - Categorize by type (structure, frontmatter, content, etc.)
   - **Reference the specific Primary Source** that supports each recommendation
   - Flag any Content Standards violations (history references, over-verbose content)

3. **Handle Conflicts**
   - If secondary source conflicts with primary: **ignore secondary**
   - If secondary source has unique info: **mark for critical review**
   - **Primary Sources always win** - never compromise official standards

### Phase 5: User Selection

1. **Present Optimization List**
   - Use AskUserQuestion with multiSelect checkboxes
   - All options enabled by default
   - Group by category for easier review

2. **Allow Deselection**
   - User can uncheck items they don't want
   - Proceed only with approved optimizations

### Phase 6: Execution & Standards Enforcement

1. **Spawn Background Agents**
   - Use Task tool for independent optimizations
   - Run compatible tasks in parallel
   - **Pass Primary Source standards to each agent**

2. **Sequential Dependencies**
   - Identify tasks that must run in order
   - Execute sequentially where necessary

3. **Apply Standards During Execution**
   - **Every change MUST comply with Primary Source best practices**
   - **Every change MUST follow Content Standards:**
     - No history references ("new", "updated", "since vX.Y")
     - No version-specific markers in descriptions
     - Concise but complete content (no over-compression)
   - Validate frontmatter against Primary Source requirements
   - Ensure descriptions trigger auto-detection correctly

4. **Progress Tracking**
   - Use TodoWrite to track all optimizations
   - Mark completed as work progresses

### Phase 7: Final Verification

1. **Standards Compliance Check**
   - Verify ALL modified files against Primary Source best practices
   - Verify ALL modified files against Content Standards
   - Check for any remaining history references
   - Validate YAML frontmatter syntax and required fields

2. **Cross-Reference Validation**
   - Ensure all element references are valid
   - Check Related Skills sections are accurate
   - Verify no orphaned references

3. **Completeness Check**
   - Confirm no important information was removed
   - Ensure content is actionable and clear
   - Verify examples are included where needed

---

## Execution Protocol

When invoked, follow this exact sequence:

### Step 1: Handle Secondary Sources

**If `--none` argument provided** (e.g., `/optimize --none`):
- Proceed immediately with primary sources only
- NO interactive prompts or questions
- Simply continue to Step 2

**If other arguments provided** (e.g., `/optimize https://example.com ./docs/notes.md`):
- Use arguments as secondary sources
- Parse each argument using source detection rules

**If no arguments provided**:
- Ask the user via **normal text output** (NOT AskUserQuestion tool)
- Output a prompt asking for secondary sources and wait for user response
- **Language**: Output should follow the user's/system's language setting (e.g., German if configured)

**Prompt content** (adapt language as needed):
- Ask for URLs and/or local file paths as additional references
- Explain the format: URLs (`https://...`) and local files (`./path` or `/absolute/path`)
- Mention that multiple sources can be separated by commas, spaces, or line breaks
- Clarify that an empty response or "none" means no secondary sources

- User responds via normal prompt (not AskUserQuestion selection)
- If user provides sources: parse and use them
- If user provides empty response or "none"/"keine": proceed with primary sources only

### Source Detection Rules

Automatically detect source type by pattern:

| Pattern | Type | Action |
|---------|------|--------|
| Starts with `http://` or `https://` | URL | Fetch via WebFetch |
| Everything else | Local file | Read via Read tool |

Examples:
- `https://blog.example.com/tips.md` → URL
- `./docs/notes.md` → Local file (relative)
- `/Users/dev/guide.md` → Local file (absolute)
- `docs/internal.md` → Local file (relative)

### Step 2: Read CLAUDE.md Primary URLs

Extract the Primary URLs table from CLAUDE.md:
- Parse the markdown table
- Store each topic-URL pair

### Step 3: Validate URLs (Parallel)

For each Primary URL, fetch and verify:
```
WebFetch: {url}
Prompt: "Extract key patterns, requirements, and best practices for Claude Code {topic}"
```

If 404 or error:
```
WebSearch: "Claude Code {topic} documentation site:claude.com"
```

### Step 4: Update CLAUDE.md if Needed

If new URLs found or broken URLs identified:
- Edit CLAUDE.md to update the Primary URLs table
- Add discovered new documentation pages

### Step 5: Analyze All Elements

Use Task tool with Explore agent to analyze **both** directories:

```
Analyze .claude/ directory (project-level):
- Skills: Check SKILL.md format, frontmatter, descriptions
- Agents: Check frontmatter completeness, tools, permissions
- Commands: Check frontmatter, verify /project: prefix in docs

Analyze plugins/ directory (marketplace):
- Skills: Check SKILL.md format, frontmatter, descriptions
- Commands: Check frontmatter, allowed-tools, structure
- Agents: Check frontmatter completeness, tools, permissions
- Hooks: Check hooks.json validity, script references

General checks for both:
- Naming conventions (kebab-case)
- Cross-references validity
- YAML frontmatter syntax
- Required fields present
```

### Step 6: Generate Optimization List

Create categorized list:
```markdown
## Proposed Optimizations

### Structure Improvements
- [ ] Improvement 1 (Primary source: skills docs)
- [ ] Improvement 2 (Secondary source - verify needed)

### Frontmatter Updates
- [ ] Update 1 (Primary source: plugins docs)

### Content Enhancements
- [ ] Enhancement 1 (Primary source: sub-agents docs)
```

### Step 7: User Confirmation

Use AskUserQuestion with multiSelect:
- Present all optimizations as checkboxes
- Default: all selected
- Group by category for clarity

### Step 8: Execute Approved Optimizations

For each approved optimization:
1. Determine if parallelizable
2. Spawn Task agents for independent work
   - **Pass Primary Source standards to each agent**
   - **Include Content Standards requirements in agent prompt**
3. Execute sequential work directly
4. Track progress with TodoWrite

### Step 9: Final Verification

After all optimizations complete:
1. **Standards Compliance Check:**
   - Verify ALL modified files against Primary Source best practices
   - Check YAML frontmatter matches Primary Source requirements
   - Confirm descriptions follow auto-detection guidelines
2. **Content Standards Check:**
   - Scan for any history references ("new", "updated", "since vX.Y")
   - Verify no version-specific markers in descriptions
   - Confirm content is complete (no over-compression)
3. **Cross-Reference Validation:**
   - Ensure all Related Skills references are valid
   - Check all element cross-references exist

---

## Source Authority Rules

### Primary Sources (HIGHEST Authority)
- Official Claude Code documentation at code.claude.com
- Anthropic documentation at docs.anthropic.com
- Claude Code CHANGELOG on GitHub

**Primary sources are ALWAYS trusted.**
**Only primary sources can be added to CLAUDE.md Primary URLs table.**

### Secondary Sources (LOWER Authority, SESSION-ONLY)
- User-provided URLs
- Community blog posts
- Third-party tutorials

**Secondary sources are TEMPORARY:**
- Used only for the current optimization session
- **NEVER added to CLAUDE.md Primary URLs**
- If conflicts with primary: **IGNORE secondary**
- If not covered by primary: **FLAG for critical review**
- If confirms primary: **USE with confidence**

---

## Content Standards

### No History References
- **Never use** "new", "updated", "changed from", or version-specific markers
- **Never include** "since v2.1", "added in version X", "previously"
- **Write timelessly** as if features always existed
- **Remove** any existing history references when optimizing

### Token Efficiency
- Keep content concise but complete
- Avoid redundant explanations
- Use tables and lists over prose where appropriate
- Don't sacrifice clarity for brevity
- **Never remove important information for token savings**

### Final Verification

After all optimizations, verify:
1. No history references in any modified files
2. No version-specific markers in descriptions
3. Content is complete and actionable
4. Cross-references are valid

---

## Anti-Patterns to Avoid

1. **Trusting Secondary Over Primary**: Never let community sources override official docs
2. **Skipping URL Validation**: Always verify URLs before using them
3. **Not Updating CLAUDE.md**: Keep the Primary URLs current
4. **Sequential When Parallel Possible**: Maximize parallel execution
5. **Ignoring User Preferences**: Only execute approved optimizations
6. **History References**: Never add "new", "updated", version markers
7. **Over-compression**: Don't remove important information for token savings

---

## Related Skills

- `claude-code-plugin-expert` - For detailed plugin development expertise
- Uses the `marketplace-optimizer-agent` for heavy parallel work

---

## Output Format

After completion, provide summary:

```markdown
## Marketplace Optimization Complete

### Sources Used
- Primary: X URLs validated
- Secondary: Y URLs analyzed (Z conflicts ignored)
- CLAUDE.md: Updated / No changes needed

### Optimizations Applied
- Total approved: N
- Completed: X
- Skipped (user choice): Y
- Failed (with reasons): Z

### Changes Made

#### Project-level (.claude/)
1. [Category] Description of change

#### Marketplace (plugins/)
1. [Category] Description of change

### CLAUDE.md Updates (Official Sources Only)
- Added: new-official-url-1, new-official-url-2
- Fixed: broken-url-1 -> working-url-1
- Removed: deprecated-url-1
- Secondary sources used: X (not added to CLAUDE.md)

### Verification (Primary Source Compliance)
- [ ] All YAML frontmatter follows Primary Source requirements
- [ ] Descriptions match auto-detection guidelines from Primary Sources
- [ ] Element structure follows documented patterns

### Verification (Content Standards)
- [ ] No history references in modified files ("new", "updated", "since vX.Y")
- [ ] No version-specific markers in descriptions
- [ ] Content is complete and actionable (no over-compression)

### Verification (Cross-References)
- [ ] All Related Skills references are valid
- [ ] All element cross-references exist
```
