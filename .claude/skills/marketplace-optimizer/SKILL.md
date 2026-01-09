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

### Phase 1: Cache & Sources (Steps 1-2)

1. **Cache Update** (Step 1)
   - Ask if cache should be updated (Default: ja)
   - If yes: Fetch Reference URLs from CLAUDE.md, rebuild cache
   - Flags: `--update-cache` (auto-yes), `--skip-cache` (auto-no)

2. **Secondary Sources** (Step 2)
   - Ask for optional secondary sources (Default: keine)
   - Flags: `--none` (skip), or provide sources as arguments
   - Secondary sources have lower authority than cache

### Phase 2: Knowledge Building (Steps 3-5)

1. **Read Documentation Cache** (Step 3 - REQUIRED)
   - Read all `.md` files from `.claude/docs-cache/`
   - Contains: Official Claude Code documentation converted to Markdown
   - **This is the primary knowledge source**

2. **Fetch Quick Sources** (Step 4 - Optional)
   - GitHub: Plugins README, Official Plugins, Skills Repository
   - CHANGELOG for recent updates

3. **Build Knowledge Base** (Step 5)
   - Documentation cache = highest authority
   - Claude's built-in knowledge = interpretation
   - Secondary sources = supplementary (lowest authority)

### Phase 3: Analysis (Step 6-7)

1. **Analyze Marketplace** (Step 6)
   - Scan all plugins, skills, commands, agents, hooks
   - Compare against best practices from cache
   - Check Content Standards compliance

2. **Generate Optimization List** (Step 7)
   - Categorize by type (structure, frontmatter, content)
   - Reference the source that supports each recommendation

### Phase 4: Execution (Steps 8-10)

1. **User Confirmation** (Step 8)
   - Present optimizations with multiSelect checkboxes
   - All options enabled by default

2. **Execute Optimizations** (Step 9)
   - Spawn agents for parallel work
   - Track progress with TodoWrite

3. **Final Verification** (Step 10)
   - Standards compliance check
   - Cross-reference validation
   - Completeness check

---

## Execution Protocol

When invoked, follow this exact sequence:

### Step 1: Update Cache (Optional)

**If `--update-cache` flag provided**:
- Execute cache update immediately (Step 1b)
- NO interactive prompt

**If `--skip-cache` flag provided**:
- Skip to Step 2 immediately
- NO interactive prompt

**If no cache flag provided**:
- Ask via **normal text output**
- **Language**: Adapt to user's/system's language setting (e.g., German if configured)
- **Suggestions**: Set "ja" (German) or "yes" (English) as suggestion

**Prompt text** (adapt language as needed):
```
Dokumentations-Cache aktualisieren?

Soll der Cache (.claude/docs-cache/*.md) mit den aktuellen
Claude Code Dokumentationsseiten neu erstellt werden?

Hinweis: Dies lädt 10 Seiten von code.claude.com herunter (~2 Minuten).

(ja/nein)
```

**Processing user response**:
- If "ja"/"yes"/empty: Execute cache update (see Step 1b)
- If "nein"/"no": Skip to Step 2

#### Step 1b: Execute Cache Update

If user confirmed cache update:

1. **Run the cache update script**
   ```bash
   bun .claude/scripts/update-docs-cache.ts
   ```
   - Reads source URLs from `.claude/docs-cache/sources.json`
   - Downloads pages in parallel (5 concurrent) using Playwright
   - Converts HTML to Markdown using Turndown
   - Saves to `.claude/docs-cache/<name>.md`

2. **Verify output**
   - Script outputs success/failure count
   - Check that `.claude/docs-cache/` contains the expected `.md` files

3. **Confirm completion**
   - Output: "Cache erfolgreich aktualisiert" / "Cache updated successfully"
   - Show count of updated files and duration

### Step 2: Handle Secondary Sources

**If `--none` flag provided** (e.g., `/optimize --none`):
- Proceed immediately with primary sources only
- NO interactive prompt
- Simply continue to Step 3

**If source arguments provided** (e.g., `/optimize https://example.com ./docs/notes.md`):
- Use arguments as secondary sources (ignore flags like `--update-cache`)
- Parse each argument using source detection rules
- Continue to Step 3

**If no source arguments and no `--none` flag**:
- Ask the user via **normal text output** for secondary sources
- **Language**: Adapt to user's/system's language setting (e.g., German if configured)
- **Suggestions**: Set "keine" (German) or "none" (English) as suggestion

**Prompt text** (adapt language as needed):
```
Sekundäre Quellen für die Optimierung

Möchtest du zusätzliche Referenzen (URLs oder lokale Dateien) verwenden?

Eingabe:
- URLs: https://example.com/guide.md
- Lokale Dateien: ./docs/notes.md oder /absolute/path/file.md
- Mehrere Quellen durch Kommas, Leerzeichen oder Zeilenumbrüche trennen
- "keine" oder leere Eingabe = nur offizielle Quellen verwenden
```

**Processing user response**:
- If empty or "keine"/"none": proceed with primary sources only
- Otherwise: parse the provided text as sources (URLs and/or local files)
- Sources can be separated by commas, spaces, or line breaks

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

### Step 3: Read Documentation Cache (REQUIRED)

Read **all** `.md` files from the documentation cache directory:

```bash
# Read the entire docs-cache directory
Glob: .claude/docs-cache/*.md
# Then read each found .md file (excluding sources.json)
```

The cached documentation contains:
- YAML frontmatter requirements and valid values
- Element structure definitions
- Naming conventions
- JSON schemas for hooks.json, plugin.json, .mcp.json

**This is the primary knowledge source - do NOT skip this step.**

**Important:** Do NOT hardcode specific filenames. The available documentation is defined
in `.claude/docs-cache/sources.json` and may change. Always read the entire directory.

### Step 4: Fetch Quick-Fetch Sources (Optional)

Only fetch these if explicitly needed (e.g., checking for recent changes):

1. **Plugins README** (plugin structure, examples):
   ```
   WebFetch: https://github.com/anthropics/claude-code/blob/main/plugins/README.md
   Prompt: "Extract plugin structure, components, and examples"
   ```

2. **Official Plugins** (standards, quality guidelines):
   ```
   WebFetch: https://github.com/anthropics/claude-plugins-official
   Prompt: "Extract plugin standards and quality guidelines"
   ```

3. **Skills Repository** (skill specs):
   ```
   WebFetch: https://github.com/anthropics/skills
   Prompt: "Extract skill structure and best practices"
   ```

4. **CHANGELOG** (recent updates):
   ```
   WebFetch: https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md
   Prompt: "List changes from the last 3 months"
   ```

**Do NOT fetch code.claude.com URLs directly - use cache update (Step 1) instead.**

### Step 5: Build Knowledge Base

Combine sources in priority order:
1. Local cache (highest authority - constraints, schemas)
2. GitHub sources (Plugins README, Official Plugins, Skills Repo)
3. Claude's built-in knowledge (edge cases, interpretation)
4. Secondary sources if provided (lowest authority)

### Step 6: Analyze All Elements

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

### Step 7: Generate Optimization List

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

### Step 8: User Confirmation

Use AskUserQuestion with multiSelect:
- Present all optimizations as checkboxes
- Default: all selected
- Group by category for clarity

### Step 9: Execute Approved Optimizations

For each approved optimization:
1. Determine if parallelizable
2. Spawn Task agents for independent work
   - **Pass Primary Source standards to each agent**
   - **Include Content Standards requirements in agent prompt**
3. Execute sequential work directly
4. Track progress with TodoWrite

### Step 10: Final Verification

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

### Documentation Cache (HIGHEST Authority)
- `.claude/docs-cache/*.md` files
- Contains official Claude Code documentation converted to Markdown
- Updated via `bun .claude/scripts/update-docs-cache.ts`
- **This is the fastest and most reliable source**

### GitHub Sources (HIGH Authority - Quick-Fetch)
- `github.com/anthropics/claude-code/blob/main/plugins/README.md` - Plugin structure
- `github.com/anthropics/claude-plugins-official` - Plugin standards
- `github.com/anthropics/skills` - Skill specifications
- `github.com/anthropics/claude-code/blob/main/CHANGELOG.md` - Recent changes
- **Use for updates and patterns not in cache**

### Claude's Built-in Knowledge (MEDIUM Authority)
- Claude has extensive knowledge about Claude Code best practices
- Valid for patterns, conventions, and general guidance
- Use for interpretation and edge cases not in cache

### Reference URLs (FOR CACHE-UPDATE ONLY)
- code.claude.com documentation pages (React apps)
- Downloaded and converted by the cache update script
- **Do NOT fetch directly via WebFetch - requires JavaScript rendering**

### Secondary Sources (LOWEST Authority, SESSION-ONLY)
- User-provided URLs
- Community blog posts
- Third-party tutorials

**Secondary sources are TEMPORARY:**
- Used only for the current optimization session
- **NEVER added to CLAUDE.md Primary Sources**
- If conflicts with cache: **IGNORE secondary**
- If not covered by cache: **FLAG for critical review**
- If confirms cache: **USE with confidence**

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
3. **Not Updating Cache**: Keep `.claude/docs-cache/` current via the update script
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
