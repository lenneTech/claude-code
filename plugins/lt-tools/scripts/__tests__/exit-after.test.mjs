// exit-after.test.mjs — a test file that a leaked handle keeps alive ends itself through its
// outer timeout, and without it the same file keeps running.
//
// Run: node --test plugins/lt-tools/scripts/__tests__/exit-after.test.mjs

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const fixture = path.join(path.dirname(fileURLToPath(import.meta.url)), 'leaky-test-file.mjs');

/** Runs the leaky file as its own process and kills it after `waitMs` if it is still running. */
function runLeaky(env, waitMs) {
  return new Promise((resolve) => {
    const childEnv = { ...process.env, ...env };
    // Under `node --test` this variable switches the child's test output to the runner's
    // internal format; the leaky file has to report like a file of its own.
    delete childEnv.NODE_TEST_CONTEXT;
    const child = spawn(process.execPath, [fixture], { env: childEnv, stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    let killed = false;
    child.stderr.on('data', (d) => (stderr += d));
    const timer = setTimeout(() => {
      killed = true;
      child.kill('SIGKILL');
    }, waitMs);
    child.on('exit', (code) => {
      clearTimeout(timer);
      resolve({ code, killed, stderr });
    });
  });
}

test('a file a leaked handle keeps alive ends itself once its outer timeout fires', { timeout: 60000 }, async () => {
  const res = await runLeaky({ LT_EXIT_AFTER_MS: '1500' }, 30000);
  assert.equal(res.killed, false, 'the file ended on its own, not by the kill after 30 s');
  assert.equal(res.code, 1);
  assert.match(res.stderr, /leaky-test-file\.mjs: still running after 2 s/);
});

test('without the outer timeout the same file is still running', { timeout: 30000 }, async () => {
  const res = await runLeaky({}, 4000);
  assert.equal(res.killed, true, 'the leaked handle keeps the process alive, so the outer timeout is what ends it');
});
