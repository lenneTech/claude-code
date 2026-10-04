#!/usr/bin/env bun

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

const rootDir = join(import.meta.dir, '..');
const pluginsDir = join(rootDir, 'plugins');

const bumpType = Bun.argv[2] || 'patch';
const changeDescription = Bun.argv.slice(3).join(' ');

if (!['patch', 'minor', 'major'].includes(bumpType)) {
  console.error('Usage: npm run version:[patch|minor|major] "<description of changes>"');
  console.error('');
  console.error('Examples:');
  console.error('  npm run version:patch "Fixed hook detection for monorepos"');
  console.error('  npm run version:minor "Added new skill for API testing"');
  console.error('  npm run version:major "Breaking changes in hook configuration"');
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

/** Runs git in the repository root and returns stdout; exits with git's own message on failure. */
function git(args: string[], input?: string): string {
  const result = Bun.spawnSync(['git', ...args], {
    cwd: rootDir,
    stdin: input === undefined ? 'ignore' : Buffer.from(input),
  });
  if (result.exitCode !== 0) {
    console.error(`git ${args.join(' ')} failed:\n${result.stderr.toString().trim()}`);
    process.exit(1);
  }
  return result.stdout.toString();
}

// The release commit is the version bump and nothing else. Several sessions work in this
// checkout at once and leave their work uncommitted by house rule, so anything already
// staged belongs to somebody — refuse rather than ship it under a release tag.
if (git(['diff', '--cached', '--name-only']).trim()) {
  console.error('The index already holds staged changes. Commit or unstage them first:');
  console.error('this script commits the version bump only.');
  process.exit(1);
}

/**
 * Applies `bump` to one JSON file twice: to the working tree copy, and to HEAD's copy, which
 * is what gets staged. The commit therefore holds HEAD plus the new version and nothing more,
 * and a foreign uncommitted edit in the same file stays in the tree instead of riding along.
 * A file HEAD does not track is somebody's uncommitted work: it is bumped, never staged.
 */
function bumpJsonFile(relPath: string, bump: (json: any) => void): boolean {
  const absPath = join(rootDir, relPath);
  if (!existsSync(absPath)) return false;

  const working = JSON.parse(readFileSync(absPath, 'utf8'));
  bump(working);
  writeFileSync(absPath, JSON.stringify(working, null, 2) + '\n');

  const indexEntry = git(['ls-files', '--stage', '--', relPath]).trim();
  if (!indexEntry) return true;

  const committed = JSON.parse(git(['show', `HEAD:${relPath}`]));
  bump(committed);
  const blob = git(['hash-object', '-w', '--stdin'], JSON.stringify(committed, null, 2) + '\n').trim();
  git(['update-index', '--cacheinfo', `${indexEntry.split(/\s+/)[0]},${blob},${relPath}`]);
  return true;
}

// The committed version is the base, not whatever the working tree says.
const oldVersion: string = JSON.parse(git(['show', 'HEAD:package.json'])).version;
const newVersion = bumpVersion(oldVersion, bumpType);
const setVersion = (json: any) => {
  json.version = newVersion;
};

bumpJsonFile('package.json', setVersion);
console.log(`✓ Updated package.json: ${oldVersion} → ${newVersion}`);

// package-lock.json carries the version in the root and in packages[""]
const lockBumped = bumpJsonFile('package-lock.json', (json) => {
  json.version = newVersion;
  if (json.packages?.['']) {
    json.packages[''].version = newVersion;
  }
});
if (lockBumped) console.log(`✓ Updated package-lock.json: ${oldVersion} → ${newVersion}`);

// The marketplace manifest stays in lock-step with package.json
if (bumpJsonFile('.claude-plugin/marketplace.json', setVersion)) {
  console.log(`✓ Updated .claude-plugin/marketplace.json: ${oldVersion} → ${newVersion}`);
}

// Every plugins/*/.claude-plugin/plugin.json
const pluginDirs = readdirSync(pluginsDir, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name);

for (const pluginName of pluginDirs) {
  if (bumpJsonFile(`plugins/${pluginName}/.claude-plugin/plugin.json`, setVersion)) {
    console.log(`✓ Updated plugins/${pluginName}/.claude-plugin/plugin.json: ${oldVersion} → ${newVersion}`);
  }
}

// Build commit message
let commitMessage = `chore: bump version to ${newVersion}`;
if (changeDescription) {
  commitMessage += `\n\n${changeDescription}`;
}

// Git commit, tag and push. Only the index is committed, never `git add .`.
console.log(`\n📦 Committing and pushing...`);

const tag = `v${newVersion}`;
const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']).trim();
const remote = Bun.spawnSync(['git', 'config', '--get', `branch.${branch}.remote`], { cwd: rootDir }).stdout.toString().trim() || 'origin';

git(['commit', '-m', commitMessage]);
git(['tag', '-a', tag, '-m', changeDescription || `Version ${newVersion}`]);
git(['push']);
// The tag by name: `git push --tags` would also publish every stray local tag.
git(['push', remote, `refs/tags/${tag}`]);

console.log(`\n🎉 Version ${newVersion} released!`);
if (changeDescription) {
  console.log(`📝 Changes: ${changeDescription}`);
}
