# Claude Code Plugin Examples

Complete, copy-paste-ready examples for each element type.

---

## Skill Example: Code Review Standards

A read-only skill that provides code review expertise with restricted tool access.

**File:** `skills/code-review-standards/SKILL.md`

```yaml
---
name: code-review-standards
description: Use when reviewing code or discussing code quality. Applies company coding standards and best practices for TypeScript, NestJS, and Angular projects.
allowed-tools: Read, Grep, Glob
---

# Code Review Standards Expert

You ensure all code follows our established standards.

## When This Skill Activates

- Reviewing pull requests or code changes
- Discussing code quality improvements
- Checking compliance with coding standards

## Standards

### TypeScript
- Use strict mode
- Prefer interfaces over types for object shapes
- Use explicit return types on public methods

### Naming
- camelCase for variables and functions
- PascalCase for classes and interfaces
- SCREAMING_SNAKE_CASE for constants

### File Organization
- One component/class per file
- Group imports: external → internal → relative
- Export public API from index.ts
```

---

## Command Example: API Route Scaffolding

A command that generates multiple files following project conventions.

**File:** `commands/scaffold-api-route.md`

```yaml
---
description: Generate a new API route with controller, service, DTO, and tests
argument-hint: <route-name>
allowed-tools: Read, Write, Glob
---

# Scaffold API Route

Creates a complete API route structure following project conventions.

## When to Use This Command

- Adding a new REST endpoint
- Need consistent structure for controllers and services

## Workflow

### Step 1: Gather Route Details

Ask the user using AskUserQuestion:
- Route path (e.g., `/users`, `/products/:id`)
- HTTP methods needed (GET, POST, PUT, DELETE)
- Authentication required?

### Step 2: Analyze Existing Patterns

Read existing controllers to match the project's coding style:
- Decorator patterns
- Error handling approach
- Response formatting

### Step 3: Generate Files

Create the following files:
1. `src/controllers/[name].controller.ts`
2. `src/services/[name].service.ts`
3. `src/dto/[name].dto.ts`
4. `tests/[name].spec.ts`

### Step 4: Register Route

Add route to the router configuration or module imports.

## Example Output

For `$ARGUMENTS = "products"`:

**src/controllers/products.controller.ts**
```typescript
import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ProductsService } from '../services/products.service';
import { CreateProductDto } from '../dto/products.dto';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll() {
    return this.productsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Post()
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }
}
```
```

---

## Agent Example: Documentation Generator

An autonomous agent that generates documentation from code analysis.

**File:** `agents/documentation-generator.md`

```yaml
---
name: documentation-generator
description: Generates comprehensive documentation from code. Use when creating or updating API docs, README files, or code documentation.
model: sonnet
tools: Read, Grep, Glob, Write
permissionMode: default
---

You are a documentation specialist. Generate clear, accurate documentation.

## Use Cases

- Generating API documentation from controllers
- Creating README files for new modules
- Updating existing documentation after code changes

## Execution Protocol

### Phase 1: Code Analysis
1. Scan relevant source files using Glob
2. Extract public APIs, types, and exports using Grep
3. Read file contents to understand implementation
4. Identify dependencies and relationships

### Phase 2: Documentation Generation
1. Generate markdown documentation
2. Include code examples where helpful
3. Add usage instructions
4. Create table of contents for large docs

### Phase 3: Validation
1. Verify all internal links work
2. Check code examples are syntactically correct
3. Ensure consistency with existing documentation style

## Output Format

Documentation in markdown format with:
- Overview section
- Installation/setup if applicable
- API reference with parameters and return types
- Usage examples
- Troubleshooting section

## Quality Checklist

Before completing, verify:
- [ ] All public APIs documented
- [ ] Code examples are runnable
- [ ] No broken internal links
- [ ] Consistent formatting throughout
```

---

## Hook Example: Format on Save

Automatic formatting hook that runs after file writes.

**File:** `hooks/hooks.json`

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": {
          "tool": "Write",
          "file_path": "**/*.ts"
        },
        "hooks": [
          {
            "type": "command",
            "command": "npx prettier --write $CLAUDE_FILE_PATH",
            "timeout": 10
          }
        ]
      },
      {
        "matcher": {
          "tool": "Write",
          "file_path": "src/**/*.ts"
        },
        "hooks": [
          {
            "type": "command",
            "command": "npx eslint $CLAUDE_FILE_PATH --fix",
            "timeout": 15
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "echo '{\"hookSpecificOutput\":{\"additionalContext\":\"Remember: All code must follow TypeScript strict mode\"}}'",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

---

## Hook Script Example: Frontmatter Validation

TypeScript validation script for PreToolUse hooks.

**File:** `hooks/scripts/validate-frontmatter.ts`

```typescript
#!/usr/bin/env npx ts-node

import * as fs from 'fs';

interface HookInput {
  tool: string;
  tool_input: {
    file_path?: string;
    content?: string;
  };
}

interface ValidationResult {
  decision: 'allow' | 'block';
  reason?: string;
}

function parseYamlFrontmatter(content: string): Record<string, unknown> | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;

  // Simple YAML parsing for frontmatter
  const yaml = match[1];
  const result: Record<string, unknown> = {};

  for (const line of yaml.split('\n')) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();
      result[key] = value;
    }
  }

  return result;
}

function validate(input: HookInput): ValidationResult {
  const filePath = input.tool_input.file_path || '';
  const content = input.tool_input.content || '';

  // Only validate markdown files in plugin directories
  if (!filePath.endsWith('.md')) {
    return { decision: 'allow' };
  }

  if (!filePath.match(/\/(skills|commands|agents)\//)) {
    return { decision: 'allow' };
  }

  // Check for YAML frontmatter
  const frontmatter = parseYamlFrontmatter(content);
  if (!frontmatter) {
    return {
      decision: 'block',
      reason: 'Plugin markdown files require YAML frontmatter (starting with ---)'
    };
  }

  // Validate based on file type
  if (filePath.includes('/skills/') && filePath.endsWith('SKILL.md')) {
    if (!frontmatter.name || !frontmatter.description) {
      return {
        decision: 'block',
        reason: 'SKILL.md requires "name" and "description" in frontmatter'
      };
    }
  }

  if (filePath.includes('/agents/') && !filePath.includes('/skills/')) {
    const required = ['name', 'description', 'model', 'tools'];
    const missing = required.filter(f => !frontmatter[f]);
    if (missing.length > 0) {
      return {
        decision: 'block',
        reason: `Agent file missing required fields: ${missing.join(', ')}`
      };
    }
  }

  if (filePath.includes('/commands/')) {
    if (!frontmatter.description) {
      return {
        decision: 'block',
        reason: 'Command file requires "description" in frontmatter'
      };
    }
  }

  return { decision: 'allow' };
}

// Main execution
const inputData = fs.readFileSync(0, 'utf-8');
const input: HookInput = JSON.parse(inputData);
const result = validate(input);

if (result.decision === 'block') {
  console.log(JSON.stringify(result));
}

process.exit(0);
```

---

## Minimal Examples

### Minimal Skill

```yaml
---
name: my-skill
description: Use when [trigger condition]. Provides [capability].
---

# My Skill

[What this skill does]

## When This Skill Activates

- [Condition 1]
- [Condition 2]
```

### Minimal Command

```yaml
---
description: What this command does
---

[Command instructions]
```

### Minimal Agent

```yaml
---
name: my-agent
description: What this agent does autonomously
model: sonnet
tools: Read, Write, Grep, Glob
---

[Agent instructions and protocol]
```
