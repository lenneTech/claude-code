// Tests for ng-base-paths.mjs. Run: node --test plugins/lt-dev/scripts/ng-base-paths.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { comparePaths, deriveNgBasePaths, parseJsonc } from './ng-base-paths.mjs';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'ng-base-paths.mjs');

function entry(core, rel, entryFile = 'src/public-api.ts', { config } = {}) {
  const dir = join(core, ...rel);
  mkdirSync(join(dir, dirname(entryFile)), { recursive: true });
  writeFileSync(join(dir, 'ng-package.json'), JSON.stringify(config ?? { lib: { entryFile } }));
  writeFileSync(join(dir, entryFile), 'export {};\n');
}

function app() {
  const root = mkdtempSync(join(tmpdir(), 'ng-base-paths-'));
  const core = join(root, 'src', 'core');
  entry(core, []);
  entry(core, ['auth']);
  entry(core, ['ui']);
  entry(core, ['ui', 'provide']);
  entry(core, ['files', 'ui']);
  return { root, core };
}

test('maps the root, every entry point and nested entries, sorted', (t) => {
  const { root } = app();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  assert.deepEqual(deriveNgBasePaths(root), {
    '@lenne.tech/ng-base': ['./src/core/src/public-api.ts'],
    '@lenne.tech/ng-base/auth': ['./src/core/auth/src/public-api.ts'],
    '@lenne.tech/ng-base/files/ui': ['./src/core/files/ui/src/public-api.ts'],
    '@lenne.tech/ng-base/ui': ['./src/core/ui/src/public-api.ts'],
    '@lenne.tech/ng-base/ui/provide': ['./src/core/ui/provide/src/public-api.ts'],
  });
});

test('leaves out entries that point at nothing or outside their directory, and never follows a symlink', (t) => {
  const { root, core } = app();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(core, 'ghost'));
  writeFileSync(join(core, 'ghost', 'ng-package.json'), JSON.stringify({ lib: { entryFile: 'src/missing.ts' } }));
  mkdirSync(join(core, 'escape'));
  writeFileSync(join(core, 'escape', 'ng-package.json'), JSON.stringify({ lib: { entryFile: '../auth/src/public-api.ts' } }));
  const outside = mkdtempSync(join(tmpdir(), 'ng-base-outside-'));
  t.after(() => rmSync(outside, { recursive: true, force: true }));
  entry(outside, ['planted']);
  symlinkSync(join(outside, 'planted'), join(core, 'planted'));
  mkdirSync(join(core, 'node_modules', 'x'), { recursive: true });
  entry(join(core, 'node_modules'), ['x']);
  const keys = Object.keys(deriveNgBasePaths(root));
  assert.ok(!keys.some((k) => /ghost|escape|planted|node_modules|\/x$/.test(k)), keys.join(', '));
});

test('uses ng-packagr\'s default entry file when ng-package.json names none', (t) => {
  const { root, core } = app();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  entry(core, ['legacy'], 'src/public_api.ts', { config: { lib: {} } });
  assert.deepEqual(deriveNgBasePaths(root)['@lenne.tech/ng-base/legacy'], ['./src/core/legacy/src/public_api.ts']);
});

test('reads a tsconfig with comments and trailing commas, and keeps // inside strings', () => {
  const parsed = parseJsonc('/* header */\n{\n  // a comment\n  "compilerOptions": { "baseUrl": "http://x//y", "paths": {}, },\n}\n');
  assert.equal(parsed.compilerOptions.baseUrl, 'http://x//y');
});

test('reports missing, wrong and stale ng-base keys, and ignores other paths', () => {
  const derived = {
    '@lenne.tech/ng-base': ['./src/core/src/public-api.ts'],
    '@lenne.tech/ng-base/auth': ['./src/core/auth/src/public-api.ts'],
  };
  const problems = comparePaths(derived, {
    '@lenne.tech/ng-base': ['./src/core/src/public-api.ts'],
    '@lenne.tech/ng-base/auth': ['./src/core/auth/public-api.ts'],
    '@lenne.tech/ng-base/sync': ['./src/core/sync/src/public-api.ts'],
    '@app/*': ['./src/app/*'],
  });
  assert.equal(problems.length, 2);
  assert.match(problems.join('\n'), /wrong: @lenne\.tech\/ng-base\/auth/);
  assert.match(problems.join('\n'), /stale: @lenne\.tech\/ng-base\/sync/);
  assert.match(comparePaths(derived, {}).join('\n'), /missing: @lenne\.tech\/ng-base\/auth/);
});

test('the CLI exits 1 on a stale tsconfig, 0 once it agrees, and 2 without a vendored core', (t) => {
  const { root } = app();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, 'tsconfig.json'), '// generated\n{ "compilerOptions": { "paths": { "@lenne.tech/ng-base": ["./src/core/src/public-api.ts"] } } }\n');
  const stale = spawnSync(process.execPath, [SCRIPT, root, '--check'], { encoding: 'utf8' });
  assert.equal(stale.status, 1);
  assert.match(stale.stderr, /missing: @lenne\.tech\/ng-base\/ui\/provide/);
  const printed = spawnSync(process.execPath, [SCRIPT, root], { encoding: 'utf8' });
  assert.equal(printed.status, 0);
  const paths = JSON.parse(printed.stdout);
  writeFileSync(join(root, 'tsconfig.json'), JSON.stringify({ compilerOptions: { paths } }));
  assert.equal(spawnSync(process.execPath, [SCRIPT, root, '--check'], { encoding: 'utf8' }).status, 0);
  const empty = mkdtempSync(join(tmpdir(), 'ng-base-empty-'));
  t.after(() => rmSync(empty, { recursive: true, force: true }));
  assert.equal(spawnSync(process.execPath, [SCRIPT, empty], { encoding: 'utf8' }).status, 2);
});
