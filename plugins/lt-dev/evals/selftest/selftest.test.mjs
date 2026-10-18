#!/usr/bin/env node
// selftest.test.mjs — every judge self-test case builds, and builds the same on every platform.
//
// Run:  node --test plugins/lt-dev/evals/selftest/selftest.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildCases, sourceLabel } from './selftest.mjs';

const SCRIPT = fileURLToPath(new URL('./selftest.mjs', import.meta.url));

// Regression: path.relative on Windows returns backslashes, so a copy written on Windows differed from one
// written on macOS (observed in review, 2026-10-18).
test('sourceLabel uses forward slashes whatever the platform path module', () => {
  assert.equal(
    sourceLabel('C:\\repo\\evals', 'C:\\repo\\evals\\agent\\case\\graders\\rubric.md', path.win32),
    'agent/case/graders/rubric.md',
  );
  assert.equal(sourceLabel('/repo/evals', '/repo/evals/agent/case/graders/rubric.md', path.posix), 'agent/case/graders/rubric.md');
});

// A file:// URL, not a plain path: on Windows `import('D:\\…')` fails with ERR_UNSUPPORTED_ESM_URL_SCHEME
// (reproduced in review, 2026-10-18).
test('importing the module runs no command', () => {
  const url = pathToFileURL(SCRIPT).href;
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', `import(${JSON.stringify(url)}).then(() => console.log('imported'))`], { encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), 'imported');
});

// The generated files are not committed, so this is what keeps a renamed rubric or a missing reference output from
// surfacing only when someone runs the self-test.
test('every self-test case builds from its selftest.json, references and source rubrics', () => {
  const cases = buildCases();
  assert.ok(cases.length > 0);
  for (const { entry, files } of cases) {
    for (const name of ['case.yaml', 'prompt.md', 'fixture.sh']) assert.ok(files[name], `${entry}: ${name}`);
    const graders = Object.keys(files).filter((name) => name.startsWith('graders/'));
    assert.ok(graders.length > 0, `${entry}: no grader`);
    for (const grader of graders) assert.doesNotMatch(files[grader], /\(source: [^)]*\\/, `${entry}/${grader}: backslash in source`);
  }
});
