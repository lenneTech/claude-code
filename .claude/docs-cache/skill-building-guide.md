# The Complete Guide to Building Skills for Claude

> Source: [Anthropic PDF Guide](https://resources.anthropic.com/hubfs/The-Complete-Guide-to-Building-Skill-for-Claude.pdf)

## Introduction

A skill is a set of instructions — packaged as a simple folder — that teaches Claude how to handle specific tasks or workflows. Skills are one of the most powerful ways to customize Claude for your specific needs.

Skills are powerful when you have repeatable workflows: generating frontend designs from specs, conducting research with consistent methodology, creating documents that follow your team's style guide, or orchestrating multi-step processes.

**What you'll learn:**
- Technical requirements and best practices for skill structure
- Patterns for standalone skills and MCP-enhanced workflows
- How to test, iterate, and distribute your skills

## Chapter 1: Fundamentals

### What is a skill?

A skill is a folder containing:
- **SKILL.md** (required): Instructions in Markdown with YAML frontmatter
- **scripts/** (optional): Executable code (Python, Bash, etc.)
- **references/** (optional): Documentation loaded as needed
- **assets/** (optional): Templates, fonts, icons used in output

### Core Design Principles

#### Progressive Disclosure

Skills use a three-level system:
- **First level (YAML frontmatter):** Always loaded in Claude's system prompt. Provides just enough information for Claude to know when each skill should be used without loading all of it into context.
- **Second level (SKILL.md body):** Loaded when Claude thinks the skill is relevant to the current task. Contains the full instructions and guidance.
- **Third level (Linked files):** Additional files bundled within the skill directory that Claude can choose to navigate and discover only as needed.

This progressive disclosure minimizes token usage while maintaining specialized expertise.

#### Composability

Claude can load multiple skills simultaneously. Your skill should work well alongside others, not assume it's the only capability available.

#### Portability

Skills work identically across Claude.ai, Claude Code, and API. Create a skill once and it works across all surfaces without modification.

### For MCP Builders: Skills + Connectors

**MCP provides the professional kitchen:** access to tools, ingredients, and equipment.
**Skills provide the recipes:** step-by-step instructions on how to create something valuable.

| MCP (Connectivity) | Skills (Knowledge) |
|---|---|
| Connects Claude to your service | Teaches Claude how to use your service effectively |
| Provides real-time data access and tool invocation | Captures workflows and best practices |
| What Claude can do | How Claude should do it |

## Chapter 2: Planning and Design

### Start with use cases

Before writing any code, identify 2-3 concrete use cases your skill should enable.

**Good use case definition:**
```
Use Case: Project Sprint Planning
Trigger: User says "help me plan this sprint" or "create sprint tasks"
Steps:
1. Fetch current project status from Linear (via MCP)
2. Analyze team velocity and capacity
3. Suggest task prioritization
4. Create tasks in Linear with proper labels and estimates
Result: Fully planned sprint with tasks created
```

**Ask yourself:**
- What does a user want to accomplish?
- What multi-step workflows does this require?
- Which tools are needed (built-in or MCP)?
- What domain knowledge or best practices should be embedded?

### Common skill use case categories

#### Category 1: Document & Asset Creation
Used for: Creating consistent, high-quality output including documents, presentations, apps, designs, code, etc.

#### Category 2: Workflow Automation
Used for: Multi-step processes that benefit from consistent methodology.

#### Category 3: MCP Enhancement
Used for: Workflow guidance to enhance the tool access an MCP server provides.

### Define success criteria

**Quantitative metrics:**
- Skill triggers on 90% of relevant queries
- Completes workflow in X tool calls
- 0 failed API calls per workflow

**Qualitative metrics:**
- Users don't need to prompt Claude about next steps
- Workflows complete without user correction
- Consistent results across sessions

### Technical requirements

#### File structure
```
your-skill-name/
├── SKILL.md                # Required - main skill file
├── scripts/                # Optional - executable code
│   ├── process_data.py
│   └── validate.sh
├── references/             # Optional - documentation
│   ├── api-guide.md
│   └── examples/
└── assets/                 # Optional - templates, etc.
    └── report-template.md
```

#### Critical rules

**SKILL.md naming:**
- Must be exactly `SKILL.md` (case-sensitive)
- No variations accepted (SKILL.MD, skill.md, etc.)

**Skill folder naming:**
- Use kebab-case: `notion-project-setup`
- No spaces: ~~Notion Project Setup~~
- No underscores: ~~notion_project_setup~~
- No capitals: ~~NotionProjectSetup~~

**No README.md:**
- Don't include README.md inside your skill folder
- All documentation goes in SKILL.md or references/

### YAML frontmatter: The most important part

The YAML frontmatter is how Claude decides whether to load your skill. Get this right.

**Minimal required format:**
```yaml
---
name: your-skill-name
description: What it does. Use when user asks to [specific phrases].
---
```

#### Field requirements

**name** (required):
- kebab-case only
- No spaces or capitals
- Should match folder name

**description** (required):
- MUST include BOTH: What the skill does + When to use it (trigger conditions)
- Under 1024 characters
- No XML tags (< or >)
- Include specific tasks users might say
- Mention file types if relevant

### Writing effective skills

#### The description field

**Structure:**
```
[What it does] + [When to use it] + [Key capabilities]
```

**Examples of good descriptions:**
```
# Good - specific and actionable
description: Analyzes Figma design files and generates developer handoff documentation. Use when user uploads .fig files, asks for "design specs", "component documentation", or "design-to-code handoff".

# Good - includes trigger phrases
description: Manages Linear project workflows including sprint planning, task creation, and status tracking. Use when user mentions "sprint", "Linear tasks", "project planning", or asks to "create tickets".

# Good - clear value proposition
description: End-to-end customer onboarding workflow for PayFlow. Handles account creation, payment setup, and subscription management. Use when user says "onboard new customer", "set up subscription", or "create PayFlow account".
```

**Examples of bad descriptions:**
```
# Too vague
description: Helps with projects.

# Missing triggers
description: Creates sophisticated multi-page documentation systems.

# Too technical, no user triggers
description: Implements the Project entity model with hierarchical relationships.
```

#### Writing the main instructions

**Recommended structure:**
```markdown
---
name: your-skill
description: [...]
---

# Your Skill Name

## Instructions

### Step 1: [First Major Step]
Clear explanation of what happens.
```

#### Best Practices for Instructions

**Be Specific and Actionable:**

Good:
```
Run `python scripts/validate.py --input {filename}` to check data format.
If validation fails, common issues include:
- Missing required fields (add them to the CSV)
- Invalid date formats (use YYYY-MM-DD)
```

Bad:
```
Validate the data before proceeding.
```

**Include error handling:**
```markdown
## Common Issues

### MCP Connection Failed
If you see "Connection refused":
1. Verify MCP server is running
2. Confirm API key is valid
3. Try reconnecting
```

**Reference bundled resources clearly:**
```
Before writing queries, consult `references/api-patterns.md` for:
- Rate limiting guidance
- Pagination patterns
- Error codes and handling
```

**Use progressive disclosure:**
Keep SKILL.md focused on core instructions. Move detailed documentation to `references/` and link to it.

## Chapter 3: Testing and Iteration

Skills can be tested at varying levels:
- **Manual testing in Claude.ai** - Run queries directly and observe behavior
- **Scripted testing in Claude Code** - Automate test cases for repeatable validation
- **Programmatic testing via skills API** - Build evaluation suites

### Recommended Testing Approach

#### 1. Triggering tests
Goal: Ensure your skill loads at the right times.
- Triggers on obvious tasks
- Triggers on paraphrased requests
- Doesn't trigger on unrelated topics

#### 2. Functional tests
Goal: Verify the skill produces correct outputs.
- Valid outputs generated
- API calls succeed
- Error handling works
- Edge cases covered

#### 3. Performance comparison
Goal: Prove the skill improves results vs. baseline.

### Using the skill-creator skill

The `skill-creator` skill - available in Claude.ai via plugin directory or download for Claude Code - can help you build and iterate on skills.

### Iteration based on feedback

**Undertriggering signals:**
- Skill doesn't load when it should
- Users manually enabling it
- **Solution:** Add more detail and nuance to the description

**Overtriggering signals:**
- Skill loads for irrelevant queries
- Users disabling it
- **Solution:** Add negative triggers, be more specific

## Chapter 4: Distribution and Sharing

### Current distribution model

**How individual users get skills:**
1. Download the skill folder
2. Zip the folder (if needed)
3. Upload to Claude.ai via Settings > Capabilities > Skills
4. Or place in Claude Code skills directory

**Organization-level skills:**
- Admins can deploy skills workspace-wide
- Automatic updates
- Centralized management

### Using skills via API

Key capabilities:
- `/v1/skills` endpoint for listing and managing skills
- Add skills to Messages API requests via the `container.skills` parameter
- Version control and management through the Claude Console
- Works with the Claude Agent SDK for building custom agents

### Positioning your skill

**Focus on outcomes, not features.**

Good: "The ProjectHub skill enables teams to set up complete project workspaces in seconds — including pages, databases, and templates — instead of spending 30 minutes on manual setup."

Bad: "The ProjectHub skill is a folder containing YAML frontmatter and Markdown instructions that calls our MCP server tools."

## Chapter 5: Patterns and Troubleshooting

### Choosing your approach: Problem-first vs. tool-first

- **Problem-first:** "I need to set up a project workspace" → Your skill orchestrates the right MCP calls in the right sequence.
- **Tool-first:** "I have Notion MCP connected" → Your skill teaches Claude the optimal workflows and best practices.

### Pattern 1: Sequential workflow orchestration
**Use when:** Multi-step processes in a specific order.

### Pattern 2: Multi-MCP coordination
**Use when:** Workflows span multiple services.

### Pattern 3: Iterative refinement
**Use when:** Output quality improves with iteration.

### Pattern 4: Context-aware tool selection
**Use when:** Same outcome, different tools depending on context.

### Pattern 5: Domain-specific intelligence
**Use when:** Your skill adds specialized knowledge beyond tool access.

### Troubleshooting

#### Skill won't upload
- **"Could not find SKILL.md"** → Rename to exactly `SKILL.md` (case-sensitive)
- **"Invalid frontmatter"** → YAML formatting issue, check delimiters (`---`)
- **"Invalid skill name"** → Name has spaces or capitals

#### Skill doesn't trigger
- **Symptom:** Skill never loads automatically
- **Fix:** Revise description field. Check: Is it too generic? Does it include trigger phrases? Does it mention file types?
- **Debug:** Ask Claude: "When would you use the [skill name] skill?" to test description

#### Skill triggers too often
1. Add negative triggers: `"Do NOT use for simple data exploration (use data-viz skill instead)."`
2. Be more specific
3. Clarify scope

#### Instructions not followed
1. **Instructions too verbose** → Keep concise, use bullet points, move details to reference files
2. **Instructions buried** → Put critical instructions at the top, use ## Important or ## Critical headers
3. **Ambiguous language** → Be specific and actionable
4. **Model "laziness"** → Add explicit encouragement in Performance Notes

#### Large context issues
- **Symptom:** Skill seems slow or responses degraded
- **Solutions:**
  1. Optimize SKILL.md size: Move detailed docs to references/, keep under 5,000 words
  2. Reduce enabled skills: Evaluate if you have more than 20-50 skills simultaneously

## Chapter 6: Resources and References

### Official Documentation
- [Best Practices Guide](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
- [Skills Documentation](https://code.claude.com/docs/en/skills)
- [API Reference](https://docs.anthropic.com/en/docs/build-with-claude/skills)
- [MCP Documentation](https://modelcontextprotocol.io/)

### Tools and Utilities

**skill-creator skill:**
- Built into Claude.ai and available for Claude Code
- Can generate skills from descriptions
- Reviews and provides recommendations
- Use: "Help me build a skill using skill-creator"

**Validation:**
- skill-creator can assess your skills
- Ask: "Review this skill and suggest improvements"

### Public skills repository
- GitHub: [anthropics/skills](https://github.com/anthropics/skills)
- Contains Anthropic-created skills you can customize
