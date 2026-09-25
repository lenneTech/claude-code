# Claude Code Marketplace & Plugin Development

This repository is a **Claude Code marketplace** containing plugins, agents, commands, hooks, skills, and scripts. When working in this codebase, you are developing Claude Code extensions - apply best practices accordingly.

## Automatic Quality Assurance

**CRITICAL:** Before ANY modification to this package, use the `developing-claude-plugins` skill to ensure:
- Consistency with existing patterns and structure
- Adherence to current Claude Code best practices
- Optimal configuration and naming conventions

## Documentation Sources (MUST READ before implementation)

All Claude Code best practices are cached locally in `.claude/docs-cache/*.md`. This is the **single source of truth** for this repository.

### Documentation Cache

| File | Content |
|------|---------|
| **Authoring elements** | |
| `skill-building-guide.md` | Anthropic's official complete guide to building skills **(primary reference)** |
| `platform-skills-best-practices.md` | Skill authoring best practices and patterns **(primary source)** |
| `skills.md` | Skill and command frontmatter and configuration (commands are skills; there is no separate command page) |
| `sub-agents.md` | Agent configuration and tools |
| `hooks.md` | Hook event types and JSON structure |
| `mcp.md` | MCP server configuration |
| `tools-reference.md` | Built-in tool names and behaviour — the authority for `tools` / `allowed-tools` entries, including which task-tracking tools exist on which model |
| `permissions.md` | Permission rule syntax behind `allowed-tools`, `permissions.json` patterns and hook `if` |
| `model-config.md` | Model aliases and what they resolve to, effort levels and their per-model defaults, frontmatter `effort`, `ultrathink` |
| `features-overview.md` | When to use CLAUDE.md, skills, subagents, hooks, MCP and plugins |
| `commands.md` | Built-in commands and bundled skills — names a plugin command must not shadow |
| **Prompting the current models** | |
| `claude-prompting-best-practices.md` | Prompting techniques across current Claude models |
| `prompting-claude-opus-5-5.md` | Model-specific guidance for the default model: effort calibration, early stops in unattended runs, progress updates |
| `effort.md` | Effort parameter: levels, per-model recommendations and defaults |
| **Plugins and marketplace** | |
| `plugins.md` | Plugins overview and the reading map for the plugin pages |
| `plugins-components.md` | Skills, hooks, MCP servers, agents and other components inside a plugin, including which agent frontmatter fields plugin agents honor |
| `plugins-reference.md` | `plugin.json` manifest reference: fields, path forms, `userConfig`, environment variables |
| `plugins-loading.md` | Where each plugin loads from, which settings decide it, why an update changed nothing |
| `plugins-create.md` | Building and testing a plugin without a marketplace |
| `plugins-cli-reference.md` | `claude plugin` commands (`validate`, `eval` …), `/plugin`, `/reload-plugins` |
| `plugin-evals.md` | `claude plugin eval`: testing skill triggering and plugin behaviour, CI gating |
| `plugins-measure.md` | A plugin's token cost and usage |
| `plugin-dependencies.md` | Plugin dependencies and version ranges |
| `plugin-marketplaces.md` | Creating a marketplace from `marketplace.json` |
| `plugins-marketplace-reference.md` | `marketplace.json` reference: fields, plugin entries, source objects |
| `plugins-host-marketplace.md` | Hosting a marketplace, releasing updates and renames without breaking installs |
| `plugins-publish.md` | Publishing, with a pre-release checklist |
| `plugin-relevance.md` | Relevance blocks that let Claude Code suggest a plugin |
| `plugin-hints.md` | The CLI marker that suggests installing a plugin |
| `discover-plugins.md` | How users install and manage plugins |
| `plugins-security.md` | What a plugin can do on a user's machine; how users review it |
| `plugins-troubleshooting.md` | Plugin error messages by stage |
| **Sessions, parallelism, configuration** | |
| `agent-teams.md` | Agent Teams coordination, messaging, hooks, and best practices |
| `cross-session-messaging.md` | Messaging between independent sessions: `ListAgents`/`SendMessage`, inbound controls, `notify_when_idle`, the inbox socket **(primary source)** |
| `worktrees.md` | Worktree isolation for sessions and subagents: `isolation: worktree`, `worktree.baseRef`, cleanup |
| `workflows.md` | Dynamic workflows orchestrating many subagents |
| `common-workflows.md` | Prompt recipes, resuming sessions, Plan Mode, delegating to subagents, piping Claude into scripts |
| `best-practices.md` | Claude Code best practices |
| `memory.md` | CLAUDE.md structure and usage |
| `settings.md` | Settings files, scopes and precedence |
| `settings-reference.md` | Full settings key reference, including `crossSessionInbound`, `isolatePeerMachines`, `dialogExpiry`, `worktree.baseRef` |
| `cli-reference.md` | CLI options and flags |
| `env-vars.md` | Environment variables exported to hooks and Bash, including `CLAUDE_CODE_MESSAGING_SOCKET` and `CLAUDE_CODE_MESSAGING_TOKEN` |
| `agents.md` | Subagents, agent view, agent teams, dynamic workflows and projects compared |
| `goal.md` | `/goal` completion conditions for long-running tasks |
| `headless.md` | `claude -p`: running Claude Code programmatically, the harness for empirical hook and skill tests |
| `permission-modes.md` | Permission modes and how elements behave under each |
| `sandboxing.md` | The sandboxed Bash tool that hooks, launchers and MCP servers run under |
| `large-codebases.md` | Monorepos: nested CLAUDE.md, sparse worktrees, code intelligence |
| `claude-directory.md` | What Claude Code reads from `.claude/` and `~/.claude/` |
| `context-window.md` | What loads into context automatically and what each element costs |
| `prompt-caching.md` | Claude Code's prompt caching: invalidation, effort changes, CLAUDE.md edits |
| `debug-your-config.md` | Why CLAUDE.md, settings, hooks, MCP servers or skills do not take effect |
| `hooks-guide.md` | Hook recipes and the `if` field in practice |
| `output-styles.md` | Output styles, including ones a plugin can ship |
| `channels-reference.md` | Channel contract for MCP servers that push events into a session |
| `errors.md` | Runtime error messages with meaning and fix |
| **Upstream and reference** | |
| `github-changelog.md` | Claude Code changelog |
| `github-plugins-readme.md` | Plugin structure, examples (from GitHub) |
| `github-official-plugins.md` | Official plugin standards, quality guidelines (from GitHub) |
| `github-skills-readme.md` | Skill specifications, templates (from GitHub) |
| `lt-cli-reference.md` | lt CLI command reference |
| `owasp-secure-coding-checklist.md` | OWASP Secure Coding Practices (security reference) |

**Pages split upstream, not duplicates.** `settings` covers files and precedence while every key lives in
`settings-reference`, so a key looked up only in `settings.md` can come back absent while being fully documented
(`crossSessionInbound`, `isolatePeerMachines` and `dialogExpiry` are the concrete case). `common-workflows` likewise
handed its worktree material to `worktrees`. When a cache update reports a page shrinking sharply, check the live page
for content that moved to a page of its own, add that page as a source, then accept the smaller page with
`--source=<name> --accept-shrink`.

### Cache Management

- **Configuration:** `.claude/docs-cache/sources.json` (SINGLE SOURCE OF TRUTH)
- **Auto-Update:** The `/optimize` command checks for version changes and offers to update

**Scripts:**

| Script | Description | Usage |
|--------|-------------|-------|
| `update-docs-cache.ts` | Downloads & converts documentation | `bun .claude/scripts/update-docs-cache.ts [--source=<name>] [--accept-shrink]` |
| `check-cache-version.ts` | Checks if cache is outdated | `bun .claude/scripts/check-cache-version.ts` |
| `check-cache-integrity.ts` | Verifies all cache files exist | `bun .claude/scripts/check-cache-integrity.ts [--fix]` |
| `check-cross-references.ts` | Verifies markdown links and "Rule N" references across `plugins/` resolve | `bun .claude/scripts/check-cross-references.ts [--json] [--plugin=<name>]` |
| `check-docs-coverage.ts` | Lists code.claude.com pages the cache lacks (minus `coverage.ignore`) | `bun .claude/scripts/check-docs-coverage.ts [--json]` |
| `changelog-delta.ts` | Prints changelog entries newer than a version | `bun .claude/scripts/changelog-delta.ts --from=<version> [--to=<version>] [--stat]` |

**Source types in `sources.json`:**
- `md`: Markdown served directly — GitHub raw files, and the `.md` form of every code.claude.com and platform.claude.com page (downloaded as-is, relative links made absolute, the llms.txt preamble and YAML frontmatter turned into one `# Title` heading). **Prefer this for Anthropic docs:** the rendered pages lose every heading, the `.md` form keeps them and carries more content.
- `html`: HTML pages (converted to Markdown via Turndown)
- `spa`: Single Page Applications (rendered with Playwright, then converted) — fallback for sites without a `.md` form
- `pdf`: PDF documents (converted to Markdown by hand; the script skips them)

**Error handling:** If a source fails to fetch, existing cache is preserved (no data loss)

### Fallback Strategy

If documentation cache is insufficient:

1. **WebSearch:** Use `WebSearch` with query: `"Claude Code [topic] documentation site:anthropic.com OR site:claude.com"`
2. **Claude's Built-in Knowledge:** Claude knows Claude Code best practices (Knowledge Cutoff: May 2025)

## Repository Structure

```
claude-code/
├── .claude/                  # Project-level Claude Code extensions
│   ├── docs-cache/           # Cached Claude Code documentation (Markdown)
│   │   ├── sources.json      # URL configuration (SINGLE SOURCE OF TRUTH)
│   │   └── *.md              # Auto-generated from sources.json
│   ├── scripts/              # Utility scripts
│   │   ├── update-docs-cache.ts    # Downloads & converts docs (parallel)
│   │   ├── check-cache-version.ts  # Checks if cache is outdated
│   │   ├── check-cache-integrity.ts # Verifies all cache files exist
│   │   ├── check-docs-coverage.ts  # Lists docs pages the cache lacks
│   │   ├── changelog-delta.ts      # Changelog entries since a given version
│   │   ├── check-cross-references.ts # Verifies links across plugins/
│   │   ├── types.ts                # Shared TypeScript types
│   │   └── modules.d.ts            # Ambient module declarations (a types.d.ts next to types.ts is ignored by TypeScript)
│   ├── skills/               # Project-specific skills
│   │   └── marketplace-optimizer/
│   │       ├── SKILL.md              # Marketplace optimization orchestrator
│   │       ├── house-rules.md        # Settled decisions, each with its reason
│   │       └── agent-protocol.md     # Modes, evidence and report format for optimizer agents
│   ├── agents/               # Project-specific agents (optimizer specialists)
│   │   ├── optimizer-skills.md       # Skills optimization expert
│   │   ├── optimizer-commands.md     # Commands optimization expert
│   │   ├── optimizer-agents.md       # Agents optimization expert
│   │   ├── optimizer-hooks.md        # Hooks optimization expert
│   │   ├── optimizer-mcp.md          # MCP optimization expert
│   │   └── optimizer-marketplace.md  # Cross-references & features expert
│   └── commands/             # Project-specific commands
│       └── optimize.md       # /optimize command
├── .claude-plugin/
│   └── marketplace.json      # Marketplace definition
├── plugins/
│   └── lt-dev/               # Main plugin
│       ├── .claude-plugin/
│       │   └── plugin.json   # Plugin manifest
│       ├── agents/           # Autonomous agents (.md files)
│       ├── commands/         # Slash commands (.md files, can be nested)
│       ├── hooks/            # Event hooks
│       │   ├── hooks.json    # Hook definitions
│       │   └── scripts/      # Hook handler scripts (.sh, .ts)
│       ├── scripts/          # Plugin helper scripts referenced by commands/agents/skills
│       │                     # (e.g. discover-check-scripts.sh) — narrow Bash permission
│       │                     # pattern: Bash(bash ${CLAUDE_PLUGIN_ROOT}/scripts/*)
│       ├── skills/           # Context-aware expertise (SKILL.md + references)
│       ├── evals/            # `claude plugin eval` suite: trigger/ and quality/ cases (results/ is git-ignored)
│       ├── permissions.json  # Bash permission patterns for auto-approval
│       ├── permissions.schema.json  # JSON Schema for permissions validation
│       └── .mcp.json         # MCP server dependencies
```

## Important: Plugin Isolation

**CRITICAL:** The `plugins/` directory is deployed to client machines and runs in isolation.

| Location | Access | Can Reference |
|----------|--------|---------------|
| `.claude/` | This repository only | Everything in this repo |
| `CLAUDE.md` | This repository only | Everything in this repo |
| `plugins/` | **Client machines** | Only files within `plugins/` |

**Consequences:**
- Elements in `plugins/` **cannot** access `.claude/docs-cache/`, `.claude/scripts/`, or any other repository files
- Elements in `plugins/` must use **external sources** (WebFetch to GitHub, WebSearch) for documentation
- Elements in `.claude/` and `CLAUDE.md` **can** access `plugins/` and all repository files

**When developing plugin elements:**
- Use `WebFetch` with GitHub raw URLs for documentation
- Use `WebSearch` for Claude Code documentation lookups
- Never reference paths like `.claude/docs-cache/` or `bun .claude/scripts/...`

## Configuration Files (MUST UPDATE when adding features)

### permissions.json
Defines Bash command patterns that can be auto-approved without user confirmation.

**Update when:**
- Adding new Bash commands to skills or agents (npm, lt, npx, etc.)
- Creating new skills that use CLI tools

**Structure:**
```json
{
  "permissions": [
    {
      "pattern": "Bash(npm test:*)",
      "description": "Run npm test commands",
      "usedBy": ["skill-name-1", "skill-name-2"]
    }
  ]
}
```

**Rules:**
- Always add `usedBy` array with skill/agent names that need the permission
- Use wildcard patterns (`:*`) for flexible matching
- Keep descriptions clear and concise

**Validation:** Use `permissions.schema.json` for IDE autocompletion and validation. Reference it via `"$schema": "./permissions.schema.json"` in permissions.json.

### .mcp.json
Defines MCP (Model Context Protocol) servers required by the plugin.

**Update when:**
- Commands or skills require external MCP tools (Linear, Chrome DevTools, etc.)
- Adding new integrations that use MCP servers

**Current servers:**
| Server | Type | Used By |
|--------|------|---------|
| `chrome-devtools` | stdio | validating-changes-in-browser, developing-lt-frontend, building-stories-with-tdd, managing-dev-servers, vibe commands, frontend-reviewer, ux-reviewer, a11y-reviewer, frontend-dev agent (browser testing & debugging) |
| `linear` | http | take-ticket, ticket-cycle, resolve-ticket, spec-to-tasks, create-story, create-ticket (indirectly, through create-story / create-task / create-bug), create-task, create-bug, review, debug, interview, linear-comment, dev-submit, git:ship, rebasing-branches, branch-rebaser, backend-reviewer, code-reviewer, frontend-reviewer, writing-linear-comments, filing-ai-proposed-tickets (issue tracking, project management, issue documents for long-form detail) |
| `nuxt-ui-remote` | http | developing-lt-frontend, figma-to-code, frontend-dev agent, the offers schema sync in the internal `lt-projects` plugin (Nuxt UI component reference from the official endpoint `https://ui.nuxt.com/mcp`) |

**Tool naming:** a plugin-bundled server's callable tool name is `mcp__plugin_<plugin>_<server>__<tool>` — e.g. `mcp__plugin_lt-dev_chrome-devtools__take_snapshot`. The unscoped form (`mcp__chrome-devtools__…`) never matches for a bundled server, so an `allowed-tools` entry written that way silently grants nothing.

**Pin stdio server versions.** A stdio server started through npx names an exact version, never `@latest`: resolving "latest" costs an npm-registry roundtrip on every start (measured 3-22s) against Claude Code's 30s MCP startup timeout, so a slow network becomes a server that never comes up. It also runs through a launcher script that sources `scripts/lib/ensure-node-path.sh` first, because Claude Code starts MCP servers with a minimal PATH that misses fnm/nvm/volta/asdf/mise. `chrome-devtools` is the model: its launcher has a global-binary fast path plus a pinned npx fallback. `linear` and `nuxt-ui-remote` are HTTP endpoints and need no launcher.

**Prove a server speaks MCP before shipping it.** Run its exact launch command and send an `initialize` plus `tools/list`; every tool name the plugin references must appear in the reply. Observed 2026-09-24: `nuxt-ui-remote` pointed at the npm package `nuxt-ui-mcp@1.0.1`, whose `bin` file has no shebang (the shell ran it, `import` resolved to ImageMagick) and which only serves HTTP on port 3000 — sessions reported `CONNECTION_CLOSED`, while the official endpoint `https://ui.nuxt.com/mcp` answered with the tools the plugin needs.

**Figma runs through the official `figma` plugin, not through lt-dev.** All Figma work — `figma-init`, `figma-research`, `figma-to-code`, and the `--figma=<url>` flag of `take-ticket` / `ticket-cycle` — uses `mcp__plugin_figma_figma__*`, served by that plugin's HTTP endpoint. lt-dev declares no Figma server of its own, so the plugin is a **required companion** for those commands; everything else in lt-dev works without it.

### plugin.json
Plugin manifest with metadata. Update `version` before releases.

## Element Types & When to Use

| Element | Purpose | Activation |
|---------|---------|------------|
| **Skill** | Contextual expertise that enhances capabilities | Auto-detected or manually invoked |
| **Command** | User-triggered actions via `/command-name` | Explicit user invocation |
| **Agent** | Autonomous task execution with specific tools | Spawned by the Agent tool |
| **Hook** | Automated responses to events | Event-triggered (PreToolUse, PostToolUse, UserPromptSubmit, Stop, SubagentStart, SubagentStop, SessionStart, SessionEnd, etc.) |
| **Script** | Utility functions for hooks or CLI | Called by hooks or directly |

## File Naming Conventions

- **Skills**: `SKILL.md` (main) + supporting `.md` files in skill directory
- **Commands**: `command-name.md` (kebab-case)
- **Agents**: `agent-name.md` (kebab-case)
- **Hooks**: `hooks.json` + referenced scripts

## YAML Frontmatter Requirements

### Skills (SKILL.md)
```yaml
---
name: skill-name
description: Concise description for auto-detection (max 1024 chars). Must explain WHEN to use this skill. Include trigger terms for auto-detection.
# Optional fields:
allowed-tools: Read, Grep, Glob  # Restrict available tools
model: sonnet | opus | haiku     # Override default model
# effort: omit it unless a measurement shows a gain (house rule 10)
context: fork                     # Run in isolated sub-agent
user-invocable: false            # Hide from slash command menu
---
```

### Commands
```yaml
---
description: What this command does (shown in /help)
# Optional fields:
allowed-tools: Bash(git:*), Read  # Restrict available tools
argument-hint: "[branch-name]"    # MUST quote values with brackets (YAML parses [...] as arrays)
model: haiku                      # Use specific model
# effort: omit it — the command then runs at the session level; pin only with an agent-case measurement (house rule 10)
disable-model-invocation: false   # true blocks model invocation, including through the Skill tool
---
```

### YAML Quoting Rules
- **`argument-hint`**: Always quote values containing `[...]` brackets: `"[arg-name]"`
- **`description`**: Quote with single quotes when containing embedded `"..."` double quotes: `'Activates when user mentions "keyword"'`
- **Validation**: Run `claude plugin validate plugins/lt-dev` to catch YAML parse errors

### Agents
```yaml
---
name: agent-name                 # required
description: When and how to use this agent   # required
model: inherit                   # inherit | sonnet | opus | haiku — lt-dev agents inherit the session model
# effort: omit it — unpinned = session level; pin only with an agent-case measurement and an Effort policy note (house rule 10)
tools: Bash, Read, Grep, Glob, Write, Edit, ...   # names from tools-reference.md; omit to inherit all
skills: optional-skill-names     # preloads skill content (listing `Skill` in tools does not)
---
```

Plugin-shipped agents ignore `permissionMode`, `mcpServers` and `hooks`. Task-tracking tools (`TaskCreate` … /
`TodoWrite`) are absent on current models unless the user opts in, so agents describe their work as phases whose
outcomes go in the final report instead of mandating a to-do tool. `isolation: worktree` in frontmatter isolates every
spawn from the default branch (not the caller's HEAD); callers pass isolation per spawn when they need it.

## Quality Standards

### Description Guidelines
- **Skills**: Focus on WHEN to use (triggers auto-detection)
- **Commands**: Focus on WHAT it does
- **Agents**: Focus on WHAT tasks it handles autonomously

### Structural Consistency
- Use consistent heading levels (# for title, ## for sections)
- Include examples for complex workflows
- Reference related elements explicitly
- Keep markdown clean and scannable

### Best Practices
- One responsibility per element
- Clear separation between skill (expertise) and command (action)
- Prefer composition over duplication
- Document dependencies between elements
- Test all commands and workflows manually

### Content Rules
- **No history references:** Never mention "new", "updated", "changed from", or version-specific info in descriptions
- **Timeless documentation:** Write as if features always existed (no "since v2.1" or "added in")
- **Compact content:** Minimize tokens while maintaining clarity and completeness
- **No over-compression:** Never remove important information for token savings

#### Exception: documented incidents are kept, deliberately

The two rules above target *changelog noise* — a feature described by when it arrived rather than by what it does. They do **not** cover the incident notes that carry a rule's reason:

> Observed live on DEV-2574: the MR merged on a `pending` pipeline, so the full validation ran post-merge on `dev` instead of gating the merge.

That sentence is why the rule around it exists. It names a concrete failure, so a future reader can tell whether the rule still applies to their situation, and a future optimizer cannot quietly delete it as "obviously redundant". Stripped to a timeless paraphrase, the rule survives but its justification does not, and the next person removes the rule.

**Keep** an incident note when it records something actually observed and names the failure precisely: the ticket id, the deploy that served a 22h-old build while reporting healthy, the advisory that went green in the audit but stayed vulnerable. Give it a date or a ticket reference — that is what makes it checkable rather than folklore.

**Do not** turn this into a licence for version chatter. "Added in v5.4.0", "new since 2.1.80", "recently changed" in a description are still exactly what the rules above forbid.

The test: does the passage explain **why a rule exists** (keep), or merely **when something was built** (cut)?

## Creating New Elements

Use the `/lt-dev:plugin:element` command to interactively create new elements with:
- Best practice compliance
- Consistent structure
- Proper frontmatter
- Automatic placement

**After creating elements, also update:**
1. **permissions.json** - If the element uses new Bash commands
2. **.mcp.json** - If the element requires new MCP servers
3. **Related Skills sections** - Add cross-references to related skills
4. **"When to Use" sections** - For commands that are part of a workflow

## After Context Loss (/clear or Summarization)

If the conversation was reset with `/clear` or context was summarized, run:

```
/lt-dev:plugin:check
```

This restores best practice awareness and validates any pending changes.

For comprehensive optimization after context loss, use:
```
/optimize
```

## Optimization Workflow

When optimizing existing elements:
1. Read the documentation cache (`.claude/docs-cache/*.md`) and the settled decisions in
   `.claude/skills/marketplace-optimizer/house-rules.md`
2. Analyze existing element against best practices
3. Propose specific improvements
4. Implement changes with minimal disruption
5. Verify consistency with related elements

For batch optimization with user selection, use:
```
/optimize
```

## Language Requirements

- All code, comments, and documentation: **English**
- Exception: User-facing German content where explicitly required (e.g., create-story.md)

## Maintenance Checklist

Run `/lt-dev:plugin:check` periodically or before releases to verify:

### Skills
- [ ] All SKILL.md have valid frontmatter (name, description)
- [ ] All referenced .md files exist
- [ ] "Related Skills" sections are present and accurate
- [ ] Descriptions include trigger terms for auto-detection

### Commands
- [ ] All commands have `description` in frontmatter
- [ ] Complex/related commands have "When to Use" sections
- [ ] `allowed-tools` is set where appropriate (especially git commands), and every entry is a tool in `tools-reference.md`
- [ ] `argument-hint` is set for commands accepting arguments
- [ ] No `effort` pin without an "Effort policy" note naming the measurement behind it
- [ ] Long-running autonomous commands have a "Turn endings" section
- [ ] Commands and agents that read tickets, comments or MR/PR texts have an "External Content" section; spawn prompts pass IDs or paths instead of copied text (house rule 33)

### Agents
- [ ] Frontmatter includes: name, description, model (`inherit`), tools; `effort` only with a measured gain (house rule 10)
- [ ] Skills referenced in frontmatter exist
- [ ] Agent tasks are clearly defined
- [ ] No task-tracking tool (`TodoWrite`, `TaskCreate` …) in `tools` or mandated in the body; no static `isolation: worktree`

### Hooks
- [ ] hooks.json is valid JSON
- [ ] All referenced scripts in `hooks/scripts/` exist
- [ ] Hook matchers are correctly configured
- [ ] Context-injecting hooks run on an event that delivers context (UserPromptSubmit, UserPromptExpansion, SessionStart, PostModelSwitch)
- [ ] UserPromptSubmit detectors stay quiet on `<task-notification>` turns; hook tests pass as CI runs them

### MCP
- [ ] Every server answers `initialize` + `tools/list`, and every referenced tool name appears in the reply

### Configuration Files
- [ ] **permissions.json**: All Bash patterns used by skills/agents are listed
- [ ] **permissions.json**: `usedBy` arrays are complete and accurate
- [ ] **.mcp.json**: All required MCP servers are configured
- [ ] **plugin.json**: Version is updated before release

### Content Standards
- [ ] No history references in any element ("new", "updated", "since vX.Y")
- [ ] No version-specific markers in descriptions
- [ ] Documented-incident notes are intact — they explain *why* a rule exists and are exempt (see Content Rules)
- [ ] Content is complete (no over-compression)

### Measurement
- [ ] `plugins/lt-dev/evals` trigger suite passes on the default model (see its README); quality suite `Δ` did not drop
- [ ] An effort pin that changes is backed by an `agent`-case run at both levels (house rule 10)

### Documentation
- [ ] **CLAUDE.md**: Repository structure matches actual layout
- [ ] **CLAUDE.md**: Configuration file docs are current
- [ ] All cross-references between elements are valid

## 🔒 Sicherheit: Keine Kundendaten/Secrets im öffentlichen Marktplatz

**Dieses Repo ist ÖFFENTLICH.** NIEMALS committen: echte Kundennamen/Kundenlisten, Projekt-/Ticket-Zuordnungen mit Kundenbezug, geschäftssensible Notizen (Abrechnungs-/Vertragsdetails), API-Tokens/Secrets, `.env`-Dateien, lokale `/Users/<name>/`-Pfade oder sonstige personenbezogene Daten.

Plugins liefern NUR **anonymisierte Beispiele** (ohne Rechtsform, z. B. „Beispielkunde", „Muster-Kunde"). Echte Stammdaten werden pro Nutzer LOKAL generiert (z. B. `~/.lt-time`) oder liegen in PRIVATEN Repos — nie im Marktplatz.

**Commit/Push in dieses Repo IMMER nur mit ausdrücklicher Freigabe des Maintainers.**

**Schutzschichten** (nach dem Klonen einmalig `scripts/install-hooks.sh` ausführen):
- `scripts/scan-secrets.sh` — Scanner (Secrets, 32-Hex-Tokens, `/Users/`-Pfade, Kunden-Roster mit Rechtsform).
  Zusätzlich Check 7: Kunden-/Projektnamen **ohne** Rechtsform aus der Sperrliste `public-denylist.txt` im privaten Repo `claude-code-internal` (Geschwister-Checkout oder `LT_PUBLIC_DENYLIST`). Die Liste liegt bewusst nicht hier, sonst veröffentlicht sie genau diese Namen. Neue Kunden dort eintragen.
- `.githooks/pre-commit` + `.githooks/pre-push` — blocken lokal vor Commit/Push.
- `.github/workflows/secrets-guard.yml` — CI-Backstop (serverseitig, lokal nicht umgehbar).
- Empfohlen serverseitig: Branch-Schutz auf `main` (PR-Pflicht + grüner „Secrets & Client-Data Guard"-Check, keine Direct-/Force-Pushes) sowie GitHub **Secret Scanning + Push Protection**.

Fehlalarm? Datei/Muster in `.secrets-allow` eintragen — mit Bedacht und Review.
