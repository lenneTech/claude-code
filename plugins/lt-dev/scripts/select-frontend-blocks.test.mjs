// Tests for select-frontend-blocks.mjs. Run: node --test plugins/lt-dev/scripts/select-frontend-blocks.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { selectFrontendBlocks } from './select-frontend-blocks.mjs';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'select-frontend-blocks.mjs');

const TEMPLATE = [
  '# {{PROJECT_NAME}}',
  '',
  'Frontend: {{FRONTEND_FRAMEWORK}}',
  '<!-- lt:frontend nuxt -->',
  'Nuxt: app/core/ is the vendored nuxt-extensions core.',
  '<!-- /lt:frontend -->',
  '<!-- lt:frontend angular -->',
  'Angular: src/core/ is the vendored ng-base core.',
  '<!-- /lt:frontend -->',
  '',
  '## Backend',
  '',
].join('\n');

test('a Nuxt project keeps the Nuxt block and loses the Angular one and every marker', () => {
  const out = selectFrontendBlocks(TEMPLATE, 'nuxt');
  assert.match(out, /Nuxt: app\/core\//);
  assert.doesNotMatch(out, /Angular:/);
  assert.doesNotMatch(out, /lt:frontend/);
  assert.match(out, /## Backend/);
});

test('an Angular project keeps the Angular block and loses the Nuxt one', () => {
  const out = selectFrontendBlocks(TEMPLATE, 'angular');
  assert.match(out, /Angular: src\/core\//);
  assert.doesNotMatch(out, /Nuxt: app\/core\//);
  assert.doesNotMatch(out, /lt:frontend/);
});

test('a template without markers passes byte for byte, so a Nuxt sync from it is unchanged', () => {
  const plain = '# Project\n\nUse the developing-lt-frontend skill.\n\n## API\n';
  assert.equal(selectFrontendBlocks(plain, 'nuxt'), plain);
  assert.equal(selectFrontendBlocks(plain, 'angular'), plain);
});

test('text around the blocks keeps its line breaks', () => {
  const out = selectFrontendBlocks(TEMPLATE, 'nuxt');
  assert.equal(out, '# {{PROJECT_NAME}}\n\nFrontend: {{FRONTEND_FRAMEWORK}}\nNuxt: app/core/ is the vendored nuxt-extensions core.\n\n## Backend\n');
});

test('a malformed template is refused, not written half-processed', () => {
  assert.throws(() => selectFrontendBlocks('<!-- lt:frontend nuxt -->\nopen\n', 'nuxt'), /never closed/);
  assert.throws(() => selectFrontendBlocks('text\n<!-- /lt:frontend -->\n', 'nuxt'), /without an open block/);
  assert.throws(
    () => selectFrontendBlocks('<!-- lt:frontend nuxt -->\n<!-- lt:frontend angular -->\n<!-- /lt:frontend -->\n', 'nuxt'),
    /inside block/,
  );
});

test('the CLI reads stdin, writes stdout, and exits 3 with no output on a malformed template', () => {
  const ok = spawnSync(process.execPath, [SCRIPT, 'angular'], { input: TEMPLATE, encoding: 'utf8' });
  assert.equal(ok.status, 0);
  assert.match(ok.stdout, /Angular: src\/core\//);
  const bad = spawnSync(process.execPath, [SCRIPT, 'nuxt'], { input: '<!-- lt:frontend nuxt -->\n', encoding: 'utf8' });
  assert.equal(bad.status, 3);
  assert.equal(bad.stdout, '');
  const usage = spawnSync(process.execPath, [SCRIPT], { input: '', encoding: 'utf8' });
  assert.equal(usage.status, 2);
});
