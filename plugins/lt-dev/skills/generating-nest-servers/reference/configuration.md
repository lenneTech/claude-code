---
name: nest-server-generator-configuration
description: Complete guide to lt.config.json configuration and lt server command syntax reference for non-interactive usage
---

# Configuration Guide

## Table of Contents
- [Configuration File (lt.config.json)](#configuration-file-ltconfigjson)
- [Command Syntax Reference](#command-syntax-reference)

## Configuration File (lt.config.json)

The lenne.tech CLI supports project-level configuration via `lt.config.json` files. This allows you to set default values for commands, eliminating the need for repeated CLI parameters or interactive prompts.

### File Location and Hierarchy

- **Location**: Place `lt.config.json` in your project root or any parent directory
- **Hierarchy**: The CLI searches from the current directory up to the root, merging configurations
- **Priority** (lowest to highest):
  1. Default values (hardcoded in CLI)
  2. Config from parent directories (higher up = lower priority)
  3. Config from current directory
  4. CLI parameters (`--flag value`)
  5. Interactive user input

### Configuration Structure

```json
{
  "meta": {
    "version": "1.0.0",
    "name": "My Project",
    "description": "Optional project description"
  },
  "commands": {
    "server": {
      "module": {
        "controller": "Both",
        "skipLint": false
      },
      "object": {
        "skipLint": false
      },
      "addProp": {
        "skipLint": false
      }
    }
  }
}
```

### Available Configuration Options

**Server Module Configuration (`commands.server.module`)**:
- `controller`: Default controller type (`"Rest"` | `"GraphQL"` | `"Both"` | `"auto"`)
- `skipLint`: Skip lint prompt after module creation (boolean)

**Server Object Configuration (`commands.server.object`)**:
- `skipLint`: Skip lint prompt after object creation (boolean)

**Server AddProp Configuration (`commands.server.addProp`)**:
- `skipLint`: Skip lint prompt after adding property (boolean)

### Using Configuration in Commands

**Example 1: Configure controller type globally**
```json
{
  "commands": {
    "server": {
      "module": {
        "controller": "Rest"
      }
    }
  }
}
```

Now all `lt server module` commands will default to REST controllers:
```bash
# Uses "Rest" from config (no prompt)
lt server module --name Product --prop-name-0 name --prop-type-0 string
```

**Example 2: Override config with CLI parameter**
```bash
# Ignores config, uses GraphQL
lt server module --name Product --controller GraphQL
```

**Example 3: Auto-detect from config**
```json
{
  "commands": {
    "server": {
      "module": {
        "controller": "auto"
      }
    }
  }
}
```

Now the CLI will auto-detect controller type from existing modules without prompting.

### Managing Configuration

**Initialize configuration**:
```bash
lt config init
```

**Show current configuration** (merged from all hierarchy levels):
```bash
lt config show
```

**Get help**:
```bash
lt config help
```

### When to Use Configuration

** Use configuration when:**
- Creating multiple modules with the same controller type
- Working in a team with agreed-upon conventions
- Automating module generation in CI/CD
- You want to skip repetitive prompts

** Don't use configuration when:**
- Creating a single module with specific requirements
- Each module needs a different controller type
- You're just testing or experimenting

### Best Practices

1. **Project Root**: Place `lt.config.json` in your project root
2. **Version Control**: Commit the config file to share with your team
3. **Documentation**: Add a README note explaining the config choices
4. **Override When Needed**: Use CLI parameters to override for special cases

###  IMPORTANT: Configuration After Server Creation

**CRITICAL WORKFLOW**: After creating a new server with `lt server create`, you **MUST** initialize the configuration file to set project conventions.

#### Automatic Post-Creation Setup

When you create a new NestJS server, immediately follow these steps:

1. **Navigate to the API directory**:
   ```bash
   cd projects/api
   ```

2. **Create the configuration file manually**:
   ```bash
   # Create lt.config.json with controller preference
   ```

3. **Ask the developer for their preference** (if not already specified):
   ```
   What controller type do you prefer for new modules in this project?
   1. Rest - REST controllers only
   2. GraphQL - GraphQL resolvers only
   3. Both - Both REST and GraphQL
   4. auto - Auto-detect from existing modules
   ```

4. **Write the configuration** based on the answer:
   ```json
   {
     "meta": {
       "version": "1.0.0"
     },
     "commands": {
       "server": {
         "module": {
           "controller": "Rest"
         }
       }
     }
   }
   ```

#### Why This Is Important

-  **Consistency**: All modules will follow the same pattern
-  **No Prompts**: Developers won't be asked for controller type repeatedly
-  **Team Alignment**: Everyone uses the same conventions
-  **Automation**: Scripts and CI/CD can create modules without interaction

#### Example Workflow

```bash
# User creates new server
lt server create --name MyAPI

# You (Claude) navigate to API directory
cd projects/api

# You ask the user
"I've created the server. What controller type would you like to use for modules?"
"1. Rest (REST only)"
"2. GraphQL (GraphQL only)"
"3. Both (REST + GraphQL)"
"4. auto (Auto-detect)"

# User answers: "Rest"

# You create lt.config.json
{
  "meta": {
    "version": "1.0.0"
  },
  "commands": {
    "server": {
      "module": {
        "controller": "Rest"
      }
    }
  }
}

# Confirm to user
" Configuration saved! All new modules will default to REST controllers."
"You can change this anytime by editing lt.config.json or running 'lt config init'."
```

#### Configuration Options Explained

**"Rest"**:
-  Creates REST controllers (`@Controller()`)
-  No GraphQL resolvers
-  No PubSub integration
- **Best for**: Traditional REST APIs, microservices

**"GraphQL"**:
-  No REST controllers
-  Creates GraphQL resolvers (`@Resolver()`)
-  Includes PubSub for subscriptions
- **Best for**: GraphQL-first APIs, real-time apps

**"Both"**:
-  Creates REST controllers
-  Creates GraphQL resolvers
-  Includes PubSub
- **Best for**: Hybrid APIs, gradual migration

**"auto"**:
- 🤖 Analyzes existing modules
- 🤖 Detects pattern automatically
- 🤖 No user prompt
- **Best for**: Following existing conventions

#### When NOT to Create Config

Skip config creation if:
-  User is just testing/experimenting
-  User explicitly says "no configuration"
-  Project already has lt.config.json

### Integration with Commands

When generating code, **ALWAYS check for configuration**:
1. Load config via `lt config show` or check for `lt.config.json`
2. Use configured values in command construction
3. Only pass CLI parameters when overriding config

**Example: Generating module with config**
```bash
# Check if config exists and what controller type is configured
# If config has "controller": "Rest", use it
lt server module --name Product --prop-name-0 name --prop-type-0 string

# If config has "controller": "auto", let CLI detect
lt server module --name Order --prop-name-0 total --prop-type-0 number

# Override config when needed
lt server module --name User --controller Both
```

## Command Syntax Reference

### CLI-First Approach

When creating modules, objects, or adding properties, **prefer using `lt server` CLI commands** over manually creating files. The CLI generates consistent, complete code with all required decorators, imports, and module integration.

**Benefits:**
- Generates all files at once (model, service, controller/resolver, inputs, outputs, module)
- Automatically integrates into `server.module.ts`
- Consistent decorator patterns (`@UnifiedField`, `@Restricted`, `@Roles`)
- Correct mongoose configuration
- Proper TypeScript typing with generics

**When to use the CLI:**
- Creating new modules or objects
- Adding properties to existing modules/objects
- Scaffolding new server projects

**When manual editing is appropriate:**
- Customizing generated code (business logic, custom methods, security rules)
- Modifying existing properties
- Adding complex relationships not supported by CLI flags

### Non-Interactive Usage (Claude Code)

All `lt server` commands support non-interactive mode. **Always use `--noConfirm --skipLint`** when running from Claude Code to avoid interactive prompts that would block execution.

```bash
# Standard pattern for Claude Code
lt server module --name <Name> --controller <Type> --noConfirm --skipLint [property-flags]
lt server object --name <Name> --noConfirm --skipLint [property-flags]
lt server addProp --type <Module|Object> --element <Name> --noConfirm --skipLint [property-flags]
```

### `lt server module` — Create Module

**Alias:** `lt server m`

Creates a complete module with model, service, controller/resolver, inputs, outputs, and module file. Automatically integrates into `server.module.ts`.

```bash
lt server module --name <ModuleName> --controller <Rest|GraphQL|Both|auto> [--noConfirm] [--skipLint] [property-flags]
```

**Options:**

| Option | Required | Description |
|--------|----------|-------------|
| `--name <name>` | Yes | Module name (PascalCase) |
| `--controller <type>` | Yes* | `Rest`, `GraphQL`, `Both`, or `auto` (*resolved from lt.config.json if not set) |
| `--noConfirm` | No | Skip confirmation prompts |
| `--skipLint` | No | Skip lint fix after creation |

**Generated files:**

| File | Condition |
|------|-----------|
| `<name>.model.ts` | Always |
| `<name>.service.ts` | Always |
| `<name>.module.ts` | Always |
| `<name>.controller.ts` | If `Rest` or `Both` |
| `<name>.resolver.ts` | If `GraphQL` or `Both` |
| `inputs/<name>.input.ts` | Always |
| `inputs/<name>-create.input.ts` | Always |
| `outputs/find-and-count-<name>s-result.output.ts` | Always |

**Configuration:** `commands.server.module.*`, `defaults.controller`, `defaults.skipLint`, `defaults.noConfirm`

**Examples:**
```bash
# REST module with properties
lt server module --name Product --controller Rest --noConfirm --skipLint \
  --prop-name-0 name --prop-type-0 string \
  --prop-name-1 price --prop-type-1 number \
  --prop-name-2 description --prop-type-2 string --prop-nullable-2 true

# GraphQL module with reference
lt server module --name Comment --controller GraphQL --noConfirm --skipLint \
  --prop-name-0 text --prop-type-0 string \
  --prop-name-1 author --prop-type-1 ObjectId --prop-reference-1 User

# Auto-detect controller from existing modules
lt server module --name Category --controller auto --noConfirm --skipLint
```

---

### `lt server object` — Create Embedded Object

**Alias:** `lt server o`

Creates a reusable data structure (sub-document) in `src/server/common/objects/`.

```bash
lt server object --name <ObjectName> [--noConfirm] [--skipLint] [property-flags]
```

**Options:**

| Option | Required | Description |
|--------|----------|-------------|
| `--name <name>` | Yes | Object name (PascalCase) |
| `--noConfirm` | No | Skip confirmation prompts |
| `--skipLint` | No | Skip lint fix after creation |

**Generated files:**

| File | Location |
|------|----------|
| `<name>.object.ts` | `src/server/common/objects/<name>/` |
| `<name>.input.ts` | Same directory |
| `<name>-create.input.ts` | Same directory |

**Configuration:** `commands.server.object.skipLint`, `defaults.skipLint`

**Examples:**
```bash
# Address object
lt server object --name Address --noConfirm --skipLint \
  --prop-name-0 city --prop-type-0 string \
  --prop-name-1 street --prop-type-1 string \
  --prop-name-2 zipCode --prop-type-2 string

# Object with optional and array fields
lt server object --name Settings --noConfirm --skipLint \
  --prop-name-0 theme --prop-enum-0 ThemeEnum \
  --prop-name-1 tags --prop-type-1 string --prop-array-1 true \
  --prop-name-2 metadata --prop-type-2 Json --prop-nullable-2 true
```

---

### `lt server addProp` — Add Properties

**Alias:** `lt server ap`

Adds properties to an existing module or object. Updates model/object file, input file, and create-input file using `ts-morph` AST manipulation.

```bash
lt server addProp --type <Module|Object> --element <Name> [--noConfirm] [--skipLint] [property-flags]
```

**Options:**

| Option | Required | Description |
|--------|----------|-------------|
| `--type <type>` | Yes | `Module` or `Object` |
| `--element <name>` | Yes | Name of existing module/object |
| `--noConfirm` | No | Skip confirmation prompts |
| `--skipLint` | No | Skip lint fix after addition |

**Configuration:** `commands.server.addProp.skipLint`, `defaults.skipLint`

**Examples:**
```bash
# Add properties to a module
lt server addProp --type Module --element User --noConfirm --skipLint \
  --prop-name-0 avatar --prop-type-0 string --prop-nullable-0 true \
  --prop-name-1 roles --prop-type-1 string --prop-array-1 true

# Add reference to a module
lt server addProp --type Module --element Post --noConfirm --skipLint \
  --prop-name-0 category --prop-type-0 ObjectId --prop-reference-0 Category

# Add embedded object to a module
lt server addProp --type Module --element User --noConfirm --skipLint \
  --prop-name-0 profile --prop-schema-0 UserProfile
```

---

### Property Flags Reference

Property flags follow the pattern `--prop-<attribute>-<index>` where index starts at 0.

| Flag | Values | Description |
|------|--------|-------------|
| `--prop-name-X` | string | Property name (camelCase) |
| `--prop-type-X` | `string`, `number`, `boolean`, `bigint`, `Date`, `ObjectId`, `Json` | Property type |
| `--prop-nullable-X` | `true` / `false` | Optional field (default: `false`) |
| `--prop-array-X` | `true` / `false` | Array of this type (default: `false`) |
| `--prop-enum-X` | EnumName | Reference to an enum type (e.g., `StatusEnum`) |
| `--prop-schema-X` | ObjectName | Reference to an embedded object/schema |
| `--prop-reference-X` | ModuleName | Reference module for ObjectId fields (e.g., `User`) |

**Type combinations:**

| Property Type | Flags | Generated Code |
|--------------|-------|----------------|
| Simple string | `--prop-type-X string` | `name: string` |
| Optional number | `--prop-type-X number --prop-nullable-X true` | `price?: number` |
| String array | `--prop-type-X string --prop-array-X true` | `tags: string[]` |
| Enum | `--prop-enum-X StatusEnum` | `status: StatusEnum` |
| ObjectId ref | `--prop-type-X ObjectId --prop-reference-X User` | `author: Reference` (model) / `author: ReferenceInput` (input) |
| Embedded object | `--prop-schema-X Address` | `address: Address` |
| JSON data | `--prop-type-X Json --prop-nullable-X true` | `metadata?: JSON` |

**Multiple properties:** Increment the index for each property:
```bash
--prop-name-0 title --prop-type-0 string \
--prop-name-1 content --prop-type-1 string --prop-nullable-1 true \
--prop-name-2 author --prop-type-2 ObjectId --prop-reference-2 User \
--prop-name-3 tags --prop-type-3 string --prop-array-3 true \
--prop-name-4 status --prop-enum-4 PostStatusEnum
```

---

### `lt server create` — Create Server Project

**Alias:** `lt server c`

Creates a new NestJS server project from nest-server-starter template.

```bash
lt server create [name] [--noConfirm] [--branch <branch>] [--copy <path>] [--link <path>]
```

**Options:**

| Option | Required | Description |
|--------|----------|-------------|
| `name` | Yes | Server project name |
| `--description <text>` | No | Project description |
| `--author <name>` | No | Author name |
| `--branch <branch>` | No | Branch of nest-server-starter to use as template |
| `--copy <path>` | No | Copy from local template directory |
| `--link <path>` | No | Symlink to local template (fastest for testing) |
| `--git` | No | Initialize git repository |
| `--noConfirm` | No | Skip confirmation prompts |

**Configuration:** `commands.server.create.*`, `defaults.author`, `defaults.noConfirm`

---

### `lt server permissions` — Security Audit

**Alias:** `lt server p`

Scans all modules for `@Roles`, `@Restricted`, and `securityCheck()` usage.

```bash
lt server permissions [--format <md|json|html>] [--path <dir>] [--open] [--failOnWarnings]
```

**Options:**

| Option | Required | Description |
|--------|----------|-------------|
| `--format <type>` | No | `md`, `json`, or `html` (default: `html` for TTY, `md` for non-interactive) |
| `--output <file>` | No | Output file path |
| `--path <dir>` | No | Path to NestJS project (default: auto-detect) |
| `--open` | No | Open report in browser |
| `--failOnWarnings` | No | Exit code 1 on warnings (CI/CD mode) |
| `--console` | No | Print summary to console |
| `--noConfirm` | No | Skip confirmation prompts |

**Configuration:** `commands.server.permissions.*`, `defaults.noConfirm`

---

### `lt server test` — Create Test File

Creates an e2e test file for a module.

```bash
lt server test --name <ModuleName>
```

---

### `lt server createSecret` — Generate Secret

**Alias:** `lt server cs`

Generates a random base64 secret string (512 bytes).

```bash
lt server createSecret
```

---

### `lt server setConfigSecrets` — Set Config Secrets

**Alias:** `lt server scs`

Replaces `SECRET` and `PRIVATE_KEY` placeholders in configuration files.

```bash
lt server setConfigSecrets <config-file>
```
