// cdp.test.mjs — closing Chrome leaves none of its processes behind.
//
// The test lists the processes itself instead of trusting the helper it checks. Locally it
// skips without Chrome; in CI Chrome is required (compare-site.test.mjs enforces that), so the
// windows leg proves that taskkill /T ends what child.kill() alone left running.
//
// Run: node --test plugins/lt-tools/scripts/__tests__/cdp.test.mjs

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { findChrome, launchChrome } from '../lib/cdp.mjs';
import { exitAfter } from './exit-after.mjs';

exitAfter(5 * 60 * 1000, 'cdp.test.mjs');

const skip = !findChrome() && !process.env.CI && 'Chrome/Chromium not found';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** { pid, ppid, name } of every process on the machine (the name on Windows only). */
function processTable() {
  const r =
    process.platform === 'win32'
      ? spawnSync(
          'powershell',
          ['-NoProfile', '-NonInteractive', '-Command', 'Get-CimInstance Win32_Process | ForEach-Object { "$($_.ProcessId) $($_.ParentProcessId) $($_.Name)" }'],
          { encoding: 'utf8', windowsHide: true, timeout: 60000 },
        )
      : spawnSync('ps', ['-A', '-o', 'pid=,ppid='], { encoding: 'utf8', timeout: 10000 });
  assert.equal(r.status, 0, `process listing failed: ${r.stderr || r.error}`);
  return r.stdout
    .split('\n')
    .map((line) => {
      const [pid, ppid, ...name] = line.trim().split(/\s+/);
      return { pid: Number(pid), ppid: Number(ppid), name: name.join(' ') };
    })
    .filter((p) => p.pid > 0 && p.ppid >= 0);
}

/** The root and every process below it. */
function treeOf(root) {
  const rows = processTable();
  const tree = new Map(rows.filter((p) => p.pid === root).map((p) => [p.pid, p]));
  for (let grew = true; grew; ) {
    grew = false;
    for (const p of rows) {
      if (tree.has(p.ppid) && !tree.has(p.pid)) {
        tree.set(p.pid, p);
        grew = true;
      }
    }
  }
  return [...tree.values()];
}

// Windows hands a freed PID to the next process quickly and keeps a process's parent PID after
// the parent has gone, so a survivor matches on PID, parent PID and name. The name keeps the
// powershell this test starts for its listing, whose parent is the test process like the
// browser's, from passing for the browser when it gets the browser's freed PID. macOS and Linux
// reparent a survivor and rarely reuse a PID within seconds: there the PID alone decides.
const stillRunning = (tree) => {
  const now = processTable();
  const same =
    process.platform === 'win32'
      ? (a, b) => a.pid === b.pid && a.ppid === b.ppid && a.name === b.name
      : (a, b) => a.pid === b.pid;
  return tree.filter((t) => now.some((n) => same(t, n))).map((t) => t.pid);
};

test('close() ends Chrome together with every process it started', { skip, timeout: 180000 }, async () => {
  const chrome = await launchChrome();
  let tree = [];
  try {
    // Chrome starts its GPU, network and renderer processes right after the DevTools port opens.
    for (const until = Date.now() + 20000; Date.now() < until; await sleep(250)) {
      tree = treeOf(chrome.pid);
      if (tree.length > 1) break;
    }
    assert.ok(tree.length > 1, `Chrome started no helper processes; nothing to prove (tree: ${tree.map((p) => p.pid).join(', ')})`);
  } finally {
    await chrome.close();
  }
  let left = stillRunning(tree);
  for (const until = Date.now() + 20000; left.length && Date.now() < until; ) {
    await sleep(250);
    left = stillRunning(tree);
  }
  assert.deepEqual(left, [], `still running after close(): ${left.join(', ')} of ${tree.map((p) => p.pid).join(', ')}`);
});
