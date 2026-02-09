#!/usr/bin/env npx ts-node

/**
 * Plugin Frontmatter Validation Hook
 *
 * Validates YAML frontmatter in plugin markdown files (skills, commands, agents).
 * Called as PreToolUse hook for Write operations on plugin files.
 *
 * Usage: Called automatically by hooks.json when writing to **/plugins/**/*.md
 */

import * as fs from 'fs';

// Types
interface HookInput {
  tool: string;
  tool_input: {
    file_path?: string;
    content?: string;
  };
}

interface ValidationResult {
  decision: 'allow' | 'deny';
  reason?: string;
}

interface Frontmatter {
  name?: string;
  description?: string;
  model?: string;
  tools?: string;
  'allowed-tools'?: string;
  'argument-hint'?: string;
  [key: string]: unknown;
}

// Simple YAML frontmatter parser (no external dependencies)
function parseYamlFrontmatter(content: string): Frontmatter | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;

  const yaml = match[1];
  const result: Frontmatter = {};

  for (const line of yaml.split('\n')) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('#')) continue;

    const colonIndex = trimmedLine.indexOf(':');
    if (colonIndex > 0) {
      const key = trimmedLine.slice(0, colonIndex).trim();
      let value = trimmedLine.slice(colonIndex + 1).trim();

      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      result[key] = value;
    }
  }

  return result;
}

// Validation logic
function validateFrontmatter(filePath: string, content: string): ValidationResult {
  // Only validate markdown files
  if (!filePath.endsWith('.md') && !filePath.endsWith('.MD')) {
    return { decision: 'allow' };
  }

  // Only validate files in plugin directories
  const isPluginFile = filePath.match(/\/(skills|commands|agents)\//);
  if (!isPluginFile) {
    return { decision: 'allow' };
  }

  // Check for YAML frontmatter presence
  if (!content.trim().startsWith('---')) {
    return {
      decision: 'deny',
      reason: 'Plugin markdown files require YAML frontmatter (file must start with ---)'
    };
  }

  // Parse frontmatter
  const frontmatter = parseYamlFrontmatter(content);
  if (!frontmatter) {
    return {
      decision: 'deny',
      reason: 'YAML frontmatter is not properly closed (missing closing ---)'
    };
  }

  // Validate SKILL.md files
  if (filePath.includes('/skills/') && filePath.endsWith('SKILL.md')) {
    const missing: string[] = [];

    if (!frontmatter.name) missing.push('name');
    if (!frontmatter.description) missing.push('description');

    if (missing.length > 0) {
      return {
        decision: 'deny',
        reason: `SKILL.md requires these fields in frontmatter: ${missing.join(', ')}`
      };
    }

    // Validate description length (max 1024 chars per official docs)
    if (frontmatter.description && frontmatter.description.length > 1024) {
      return {
        decision: 'deny',
        reason: `Skill description too long (${frontmatter.description.length} chars). Maximum is 1024 characters.`
      };
    }
  }

  // Validate agent files
  if (filePath.includes('/agents/') && !filePath.includes('/skills/')) {
    const required = ['name', 'description', 'model', 'tools'];
    const missing = required.filter(field => !frontmatter[field]);

    if (missing.length > 0) {
      return {
        decision: 'deny',
        reason: `Agent file missing required fields: ${missing.join(', ')}`
      };
    }

    // Validate model value
    const validModels = ['haiku', 'sonnet', 'opus'];
    const model = frontmatter.model?.toLowerCase();
    if (model && !validModels.some(m => model.includes(m))) {
      return {
        decision: 'deny',
        reason: `Invalid model "${frontmatter.model}". Use: haiku, sonnet, or opus`
      };
    }
  }

  // Validate command files
  if (filePath.includes('/commands/')) {
    if (!frontmatter.description) {
      return {
        decision: 'deny',
        reason: 'Command file requires "description" field in frontmatter'
      };
    }
  }

  return { decision: 'allow' };
}

// Main execution
function main(): void {
  try {
    const inputData = fs.readFileSync(0, 'utf-8');
    const input: HookInput = JSON.parse(inputData);

    const filePath = input.tool_input?.file_path || '';
    const content = input.tool_input?.content || '';

    const result = validateFrontmatter(filePath, content);

    if (result.decision === 'deny') {
      console.log(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: result.reason
        }
      }));
    }

    process.exit(0);
  } catch (error) {
    // On any error, allow the operation (fail-open)
    // This prevents the hook from blocking legitimate operations
    process.exit(0);
  }
}

main();
