---
description: Create plugin element (skill, command, agent, hook, script)
---

# Create Plugin Element

Interactively create a new element for this Claude Code plugin package with automatic best practice compliance, consistent structure, and proper placement.

## When to Use This Command

- Adding a new skill, command, agent, hook, or script to this package
- Unsure which element type is best for your use case
- Want guidance on proper structure and naming

## Related Commands

| Command | Purpose |
|---------|---------|
| `/lt-dev:plugin:check` | Verify all plugin elements against best practices |
| `/lt-dev:skill-optimize` | Optimize existing skill files |

---

## Step 1: Gather Requirements

**Ask the user (in German):**

"Was möchtest du erstellen? Bitte beschreibe dein Vorhaben:
- Was soll erreicht werden?
- Wer/Was löst es aus? (Benutzer, Event, automatisch?)
- Soll es autonom arbeiten oder interaktiv?

Beispiele:
- 'Ich möchte automatisch Code-Reviews nach jedem Commit machen'
- 'Entwickler sollen per Command eine neue API-Route scaffolden können'
- 'Bei NestJS-Projekten soll Claude automatisch wissen, wie die Struktur funktioniert'"

**Wait for user response.**

---

## Step 2: Fetch Best Practices Documentation

**MANDATORY:** Before proceeding, fetch the latest official documentation from GitHub:

```
WebFetch: https://github.com/anthropics/claude-code/blob/main/plugins/README.md
WebFetch: https://github.com/anthropics/skills/blob/main/README.md
```

**For specific element types:** Use `WebSearch: "Claude Code [topic] documentation site:claude.com"`

Topics by element type:
- Plugins: "Claude Code plugins plugin.json"
- Skills: "Claude Code skills SKILL.md"
- Commands: "Claude Code slash commands"
- Subagents: "Claude Code subagents agents"
- Hooks: "Claude Code hooks hooks.json"

---

## Step 3: Recommend Element Type

Based on the user's description, analyze and recommend the appropriate element type(s):

### Decision Matrix

| Requirement | Recommended Element |
|-------------|---------------------|
| Enhance Claude's expertise in a domain | **Skill** |
| User-triggered workflow via `/command` | **Command** |
| Autonomous complex multi-step task | **Agent** |
| Automatic reaction to events | **Hook** |
| Reusable utility function | **Script** |

### Combination Patterns

Sometimes multiple elements work together:
- **Skill + Command**: Expertise that can also be explicitly invoked
- **Agent + Skill**: Agent that uses skill expertise
- **Hook + Script**: Event handler with external logic
- **Command + Agent**: Command that spawns an agent for complex work

**Present recommendation (in German):**

"Basierend auf deiner Beschreibung empfehle ich:

**[Element-Typ]**: [Begründung]

[Optional: Kombination mit anderem Element]

Möchtest du so fortfahren, oder hast du Fragen zu den Element-Typen?"

---

## Step 4: Gather Element Details

Based on the chosen element type, ask for specific details using AskUserQuestion:

### For Skills
- Name (kebab-case)
- When should it activate? (trigger conditions)
- What expertise does it provide?
- Related skills (if any)

### For Commands
- Command name (kebab-case, can include path like `category/name`)
- What workflow does it execute?
- Does it need user interaction during execution?
- Should output be in German or English?

### For Agents
- Agent name (kebab-case)
- What tasks should it handle autonomously?
- Which tools does it need? (Bash, Read, Write, Edit, Grep, Glob, WebFetch, etc.)
- Which model? (haiku for simple, sonnet for complex, opus for critical)
- Does it need any skills?

### For Hooks
- Event type (PreToolCall, PostToolCall, UserPromptSubmit, Notification)
- What should trigger it?
- What action should it take?
- Need external script or inline logic?

### For Scripts
- Script purpose
- Language (TypeScript recommended)
- Where will it be called from?

---

## Step 5: Analyze Existing Elements

Before creating, check for:
1. **Duplicates**: Similar existing elements
2. **Overlap**: Elements that might conflict
3. **Integration**: Elements that should reference the new one

```bash
# Check existing elements
ls -la plugins/lt-dev/skills/
ls -la plugins/lt-dev/commands/
ls -la plugins/lt-dev/agents/
```

**If potential overlap found, inform user (in German):**

"Ich habe ähnliche existierende Elemente gefunden:
- [Element]: [Beschreibung]

Optionen:
1. Neues Element erstellen (mit klarer Abgrenzung)
2. Bestehendes Element erweitern
3. Elemente zusammenführen

Was möchtest du tun?"

---

## Step 6: Generate Element

Create the element with proper structure following the templates from the `developing-claude-plugins` skill.

### Quality Checklist (verify before creating)

- [ ] Name follows kebab-case convention
- [ ] YAML frontmatter is complete and correct
- [ ] Description is concise and actionable
- [ ] Structure matches existing elements in package
- [ ] No overlap with existing elements
- [ ] Cross-references to related elements included
- [ ] Language is English (except user-facing German content)

---

## Step 7: Create Supporting Files (if needed)

### For Skills
- `SKILL.md` (main file)
- `reference.md` (if detailed reference needed)
- `examples.md` (if complex usage patterns)

### For Hooks
- Entry in `hooks.json`
- Script file in `hooks/scripts/` if external logic needed

---

## Step 8: Verify Integration

After creation:
1. Check YAML syntax is valid
2. Verify file is in correct location
3. Confirm cross-references work
4. Test command/skill invocation (if applicable)

**Confirm to user (in German):**

"[Element-Typ] **[Name]** wurde erfolgreich erstellt:
- Pfad: `[Dateipfad]`
- [Weitere relevante Details]

Möchtest du das Element direkt testen oder weitere Anpassungen vornehmen?"

---

## Templates

### Skill Template
See: `plugins/lt-dev/skills/developing-claude-plugins/SKILL.md`

### Command Template
See: `plugins/lt-dev/commands/create-story.md`

### Agent Template
See: `plugins/lt-dev/agents/npm-package-maintainer.md`

---

## Examples

### Example 1: Creating a Code Review Skill

**User:** "Ich möchte, dass Claude bei Code-Reviews automatisch auf unsere Coding-Standards achtet."

**Recommendation:** Skill - Provides expertise that activates during code review contexts.

**Result:**
```
plugins/lt-dev/skills/code-review-standards/
├── SKILL.md
└── standards.md
```

### Example 2: Creating a Scaffold Command

**User:** "Entwickler sollen per Command eine neue API-Route mit Controller, Service und Tests erstellen können."

**Recommendation:** Command - User-triggered workflow with defined steps.

**Result:**
```
plugins/lt-dev/commands/scaffold-api-route.md
```

### Example 3: Creating an Auto-Format Hook

**User:** "Nach jedem File-Write soll automatisch Prettier laufen."

**Recommendation:** Hook - Automatic reaction to PostToolCall event for Write tool.

**Result:**
```
plugins/lt-dev/hooks/hooks.json (updated)
plugins/lt-dev/hooks/scripts/format-on-write.ts
```
