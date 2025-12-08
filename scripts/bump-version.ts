#!/usr/bin/env bun

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { $ } from 'bun';

const rootDir = join(import.meta.dir, '..');
const pluginJsonPath = join(rootDir, '.claude-plugin', 'plugin.json');
const packageJsonPath = join(rootDir, 'package.json');

const bumpType = Bun.argv[2] || 'patch';
const changeDescription = Bun.argv.slice(3).join(' ');

if (!['patch', 'minor', 'major'].includes(bumpType)) {
  console.error('Usage: bun scripts/bump-version.ts [patch|minor|major] [description of changes]');
  console.error('');
  console.error('Examples:');
  console.error('  bun run version:patch "Fixed hook detection for monorepos"');
  console.error('  bun run version:minor "Added new skill for API testing"');
  console.error('  bun run version:major "Breaking changes in hook configuration"');
  process.exit(1);
}

function bumpVersion(version: string, type: string): string {
  const [major, minor, patch] = version.split('.').map(Number);

  switch (type) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
    default:
      return `${major}.${minor}.${patch + 1}`;
  }
}

// Read plugin.json
const pluginJson = JSON.parse(readFileSync(pluginJsonPath, 'utf8'));
const oldVersion = pluginJson.version;
const newVersion = bumpVersion(oldVersion, bumpType);

// Update plugin.json
pluginJson.version = newVersion;
writeFileSync(pluginJsonPath, JSON.stringify(pluginJson, null, 2) + '\n');
console.log(`✓ Updated .claude-plugin/plugin.json: ${oldVersion} → ${newVersion}`);

// Update package.json
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
packageJson.version = newVersion;
writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
console.log(`✓ Updated package.json: ${oldVersion} → ${newVersion}`);

// Build commit message
let commitMessage = `chore: bump version to ${newVersion}`;
if (changeDescription) {
  commitMessage += `\n\n${changeDescription}`;
}

// Git commit, tag and push
console.log(`\n📦 Committing and pushing...`);

$.cwd(rootDir);

await $`git add .`;
await $`git commit -m ${commitMessage}`;
await $`git tag -a ${'v' + newVersion} -m ${changeDescription || `Version ${newVersion}`}`;
await $`git push`;
await $`git push --tags`;

console.log(`\n🎉 Version ${newVersion} released!`);
if (changeDescription) {
  console.log(`📝 Changes: ${changeDescription}`);
}
