# Claude Code Best Practices Cache

> Komprimierte Referenz aus offizieller Dokumentation (Januar 2026)
> Quellen: code.claude.com/docs/en/*

---

## 1. Skills (SKILL.md)

### Speicherorte
- Projekt: `.claude/skills/<skill-name>/SKILL.md`
- Plugin: `plugins/<plugin>/skills/<skill-name>/SKILL.md`

### YAML Frontmatter

| Feld | Required | Typ | Constraints | Beschreibung |
|------|----------|-----|-------------|--------------|
| `name` | **Ja** | string | max 64 chars, lowercase, letters/numbers/hyphens, keine XML-Tags | Skill-Identifikator |
| `description` | **Ja** | string | max 1024 chars, non-empty, keine XML-Tags | Wann/warum Skill nutzen (Trigger-Terms!) |
| `allowed-tools` | Nein | string/list | Komma-getrennt oder YAML-Liste | Beschraenkt verfuegbare Tools |
| `model` | Nein | string | `sonnet`, `opus`, `haiku` oder Model-ID | Ueberschreibt Standard-Model |
| `context` | Nein | string | `fork` | Laeuft in isoliertem Sub-Agent |
| `user-invocable` | Nein | boolean | `true`/`false` | `false` = nicht im Slash-Menu |
| `disable-model-invocation` | Nein | boolean | `true`/`false` | Verhindert programmatischen Aufruf |
| `hooks` | Nein | object | PreToolUse, PostToolUse, Stop | Event-Handler |

### Beispiel
```yaml
---
name: sql-analysis
description: Use when analyzing business data: revenue, ARR, customer segments, product usage, or sales pipeline. Triggers on database queries, SQL, analytics requests.
allowed-tools: Read, Grep, Glob, Bash(psql:*)
model: sonnet
context: fork
user-invocable: true
---
```

### Best Practices
- Description muss Trigger-Terms enthalten fuer Auto-Detection
- SKILL.md unter 500 Zeilen halten
- Gerund-Form fuer Namen (verb + -ing beschreibt Aktivitaet)

---

## 2. Slash Commands (*.md)

### Speicherorte
- Projekt: `.claude/commands/<command-name>.md`
- User: `~/.claude/commands/<command-name>.md`
- Plugin: `plugins/<plugin>/commands/<command-name>.md`

### Naming
- Dateiname (ohne .md) = Command-Name
- kebab-case: `security-check.md` -> `/security-check`
- Verschachtelt erlaubt: `git/commit.md` -> `/git:commit`

### YAML Frontmatter

| Feld | Required | Typ | Constraints | Beschreibung |
|------|----------|-----|-------------|--------------|
| `description` | Empfohlen | string | - | Kurzbeschreibung (in /help) |
| `allowed-tools` | Nein | string/list | Tool-Pattern mit Wildcards | Beschraenkt verfuegbare Tools |
| `argument-hint` | Nein | string | z.B. `[message]`, `[file] [options]` | Zeigt erwartete Argumente |
| `model` | Nein | string | Model-ID oder Alias | Spezifisches Model |
| `disable-model-invocation` | Nein | boolean | `true`/`false` | Verhindert Skill-Tool Aufruf |
| `hooks` | Nein | object | PreToolUse, PostToolUse, Stop | Event-Handler |

### Beispiel
```yaml
---
description: Run security vulnerability scan on codebase
allowed-tools: Read, Grep, Glob, Bash(npm audit:*)
argument-hint: [severity-level]
model: claude-sonnet-4-5-20250929
---
```

### Tool-Pattern Syntax
```yaml
allowed-tools: Bash(git add:*), Bash(git status:*), Bash(git commit:*)
# Oder als Liste:
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash(npm:*)
```

---

## 3. Agents/Subagents (*.md)

### Speicherorte
- User: `~/.claude/agents/<agent-name>.md`
- Projekt: `.claude/agents/<agent-name>.md`
- Plugin: `plugins/<plugin>/agents/<agent-name>.md`

### YAML Frontmatter

| Feld | Required | Typ | Constraints | Beschreibung |
|------|----------|-----|-------------|--------------|
| `name` | **Ja** | string | kebab-case | Agent-Identifikator |
| `description` | **Ja** | string | - | Wann/wie Agent nutzen |
| `tools` | Empfohlen | string/list | Komma-getrennt oder YAML-Liste | Verfuegbare Tools (sonst alle) |
| `model` | Nein | string | `sonnet`, `opus`, `haiku`, `inherit` | Model fuer Agent |
| `permissionMode` | Nein | string | siehe Tabelle | Permission-Verhalten |
| `skills` | Nein | string/list | Skill-Namen | Auto-load Skills |

### permissionMode Werte

| Wert | Verhalten |
|------|-----------|
| `default` | Standard Permission-Checks |
| `acceptEdits` | Auto-approve File-Operationen |
| `bypassPermissions` | Keine Permission-Checks |
| `plan` | Nur Planung, keine Ausfuehrung |

### Beispiel
```yaml
---
name: code-reviewer
description: Expert code review specialist. Use for quality, security, and maintainability reviews.
tools: Read, Grep, Glob, Bash(npm test:*)
model: sonnet
permissionMode: acceptEdits
skills: code-analysis, security-check
---
Your system prompt goes here. Describe the agent's expertise,
approach, and specific instructions.
```

### Verfuegbare Tools
```
Read, Write, Edit, Bash, Grep, Glob,
WebFetch, WebSearch, Task, TodoWrite,
NotebookEdit, LSP, mcp__*
```

---

## 4. Hooks (hooks.json)

### Speicherorte
- Projekt: `.claude/hooks/hooks.json`
- User Settings: In settings.json unter `hooks`
- Plugin: `plugins/<plugin>/hooks/hooks.json`

### Event-Typen

| Event | Beschreibung | Matcher |
|-------|--------------|---------|
| `PreToolUse` | Vor Tool-Ausfuehrung | Tool-Name Pattern |
| `PostToolUse` | Nach erfolgreicher Tool-Ausfuehrung | Tool-Name Pattern |
| `PostToolUseFailure` | Nach fehlgeschlagener Tool-Ausfuehrung | Tool-Name Pattern |
| `PermissionRequest` | Bei Permission-Anfrage | Tool-Name Pattern |
| `UserPromptSubmit` | Bei User-Eingabe | - |
| `SessionStart` | Bei Session-Start | - |
| `SessionEnd` | Bei Session-Ende | - |
| `Stop` | Bei Agent-Stop | - |
| `SubagentStart` | Bei Subagent-Start | - |
| `SubagentStop` | Bei Subagent-Stop | - |
| `PreCompact` | Vor Context-Komprimierung | - |
| `Notification` | Bei Benachrichtigungen | - |

### JSON Schema

```json
{
  "hooks": {
    "<EventType>": [
      {
        "matcher": "<ToolPattern>",
        "hooks": [
          {
            "type": "command",
            "command": "./scripts/handler.sh",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

### Hook-Typen

| Type | Felder | Beschreibung |
|------|--------|--------------|
| `command` | `command`, `timeout` | Bash-Command ausfuehren |
| `prompt` | `prompt`, `timeout` | LLM-Evaluation |

### Matcher-Syntax
- Exakt: `Write` (nur Write-Tool)
- Wildcard: `*` (alle Tools)
- Regex: `Edit\|Write` (Edit oder Write)
- Leer: `""` (alle Tools)

### Exit Codes

| Code | Bedeutung | Verhalten |
|------|-----------|-----------|
| 0 | Erfolg | stdout wird verarbeitet |
| 2 | Blocking Error | stderr = Fehlermeldung, Aktion blockiert |
| andere | Fehler | stderr in verbose mode |

### JSON Output Felder (bei Exit 0)

```json
{
  "decision": "approve|block|allow|deny",
  "reason": "Erklaerung fuer Claude",
  "continue": true,
  "stopReason": "Message wenn continue=false",
  "updatedInput": {},
  "suppressOutput": false,
  "systemMessage": "Warning fuer User"
}
```

### Beispiel hooks.json
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/scripts/security-check.sh",
            "timeout": 30
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "./scripts/run-linter.sh"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "prompt",
            "prompt": "Verify all tasks are complete before stopping."
          }
        ]
      }
    ]
  }
}
```

---

## 5. Plugins (plugin.json)

### Verzeichnisstruktur

```
my-plugin/
├── .claude-plugin/
│   └── plugin.json       # Required: Plugin Manifest
├── commands/             # Slash Commands (*.md)
├── agents/               # Subagents (*.md)
├── skills/               # Skills (*/SKILL.md)
│   └── my-skill/
│       └── SKILL.md
├── hooks/
│   └── hooks.json        # Hook-Konfiguration
├── .mcp.json             # MCP Server Definitionen
├── .lsp.json             # LSP Server Definitionen
├── permissions.json      # Bash Auto-Approve Patterns
└── output-styles/        # Custom Output Styles
```

### plugin.json Schema

```json
{
  "name": "plugin-name",
  "version": "1.2.0",
  "description": "Kurze Plugin-Beschreibung",
  "author": {
    "name": "Author Name",
    "email": "[email protected]",
    "url": "https://github.com/author"
  },
  "homepage": "https://docs.example.com/plugin",
  "repository": "https://github.com/author/plugin",
  "license": "MIT",
  "keywords": ["keyword1", "keyword2"],
  "commands": ["./custom/commands/special.md"],
  "agents": "./custom/agents/",
  "skills": "./custom/skills/",
  "hooks": "./config/hooks.json",
  "mcpServers": "./mcp-config.json",
  "outputStyles": "./styles/",
  "lspServers": "./.lsp.json"
}
```

### Felder

| Feld | Required | Typ | Beschreibung |
|------|----------|-----|--------------|
| `name` | **Ja** | string | Plugin-Identifikator |
| `version` | Empfohlen | string | Semantic Version |
| `description` | Empfohlen | string | Kurzbeschreibung |
| `author` | Nein | object | name, email, url |
| `homepage` | Nein | string | Dokumentations-URL |
| `repository` | Nein | string | Source-Repository URL |
| `license` | Nein | string | Lizenz-Typ |
| `keywords` | Nein | string[] | Suchbegriffe |
| `commands` | Nein | string[] | Custom Command-Pfade |
| `agents` | Nein | string | Agents-Verzeichnis |
| `skills` | Nein | string | Skills-Verzeichnis |
| `hooks` | Nein | string | hooks.json Pfad |
| `mcpServers` | Nein | string | MCP-Config Pfad |
| `outputStyles` | Nein | string | Styles-Verzeichnis |
| `lspServers` | Nein | string | LSP-Config Pfad |

### Wichtige Regeln
- Custom paths ergaenzen Standard-Verzeichnisse, ersetzen sie nicht
- Plugins koennen nicht auf Dateien ausserhalb ihres Root-Verzeichnisses zugreifen
- `.claude-plugin/` muss plugin.json enthalten
- Alle anderen Verzeichnisse (commands/, agents/, etc.) auf Plugin-Root Ebene

---

## 6. Marketplaces (marketplace.json)

### Speicherort
`.claude-plugin/marketplace.json` im Repository-Root

### Schema

```json
{
  "name": "marketplace-name",
  "description": "Marketplace Beschreibung",
  "plugins": [
    {
      "name": "plugin-name",
      "description": "Plugin Beschreibung",
      "git": "https://github.com/org/repo.git",
      "path": "plugins/plugin-name",
      "ref": "main"
    }
  ]
}
```

### Plugin-Referenz Felder

| Feld | Required | Beschreibung |
|------|----------|--------------|
| `name` | **Ja** | Plugin-Name |
| `description` | Empfohlen | Plugin-Beschreibung |
| `git` | **Ja** (wenn nicht lokal) | Git Repository URL |
| `path` | Nein | Pfad zum Plugin im Repo |
| `ref` | Nein | Git Branch/Tag/Commit |

---

## 7. Quick Reference

### Model Aliases
| Alias | Model ID |
|-------|----------|
| `opus` | claude-opus-4-5-20251101 |
| `sonnet` | claude-sonnet-4-5-20250929 |
| `haiku` | claude-haiku-4-5-20251001 |

### Tool Categories
| Kategorie | Tools |
|-----------|-------|
| File Read | `Read`, `Grep`, `Glob` |
| File Write | `Write`, `Edit`, `NotebookEdit` |
| Execution | `Bash`, `Task` |
| Web | `WebFetch`, `WebSearch` |
| Code Intelligence | `LSP` |
| MCP | `mcp__<server>__<tool>` |
| Management | `TodoWrite` |

### Bash Tool Pattern
```
Bash(command:*)         # Wildcard am Ende
Bash(git add:*)         # Spezifischer Command
Bash(npm test:*)        # npm test mit beliebigen Args
Bash(docker:*)          # Alle docker Commands
```

---

## Quellen

- [Agent Skills](https://code.claude.com/docs/en/skills)
- [Slash Commands](https://code.claude.com/docs/en/slash-commands)
- [Subagents](https://code.claude.com/docs/en/sub-agents)
- [Hooks Reference](https://code.claude.com/docs/en/hooks)
- [Plugins](https://code.claude.com/docs/en/plugins)
- [Plugins Reference](https://code.claude.com/docs/en/plugins-reference)
- [Model Configuration](https://code.claude.com/docs/en/model-config)
- [Configure Permissions](https://platform.claude.com/docs/en/agent-sdk/permissions)
