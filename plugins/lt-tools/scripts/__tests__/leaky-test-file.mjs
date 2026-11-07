// leaky-test-file.mjs — a test file whose only test passes but leaves a server listening: the
// shape of a browser process that outlives its test. exit-after.test.mjs runs it with and
// without the outer timeout. Not a *.test.mjs file, so `node --test` never runs it directly.

import net from 'node:net';
import { test } from 'node:test';
import { exitAfter } from './exit-after.mjs';

if (process.env.LT_EXIT_AFTER_MS) exitAfter(Number(process.env.LT_EXIT_AFTER_MS), 'leaky-test-file.mjs');

test('passes and leaves a server listening', () => {
  net.createServer().listen(0, '127.0.0.1');
});
