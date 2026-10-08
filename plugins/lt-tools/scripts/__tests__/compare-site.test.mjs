// compare-site.test.mjs — compares fixture mirrors with the live fixture in headless Chrome.
//
// Proves the comparison in every direction that matters:
//   • a bundled mirror compares identical where it is complete;
//   • a page that only works while the live site is reachable (an image URL built at
//     runtime) is reported, because the live hosts are blocked while the backup loads;
//   • a mirror whose ES modules were left as they are (blocked on file://) is reported —
//     the failure a plain wget mirror shows as a dead slider;
//   • a live site that never answers ends in an error per page, not in a hang.
// Locally the tests skip without Chrome or esbuild; in CI both are required.
//
// Run: node --test plugins/lt-tools/scripts/__tests__/compare-site.test.mjs

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { compareSite } from '../compare-site.mjs';
import { findChrome } from '../lib/cdp.mjs';
import { esbuildAvailable, mirrorSite } from '../mirror-site.mjs';
import { startFixtureServer, startHangingServer } from './fixture-site.mjs';

const chrome = findChrome();
const canBundle = esbuildAvailable();
const ci = !!process.env.CI;
const skipChrome = !chrome && !ci && 'Chrome/Chromium not found';
const skipBundled = skipChrome || (!canBundle && !ci && 'esbuild not available via npx');

let server;
let tmp;
const mirror = (out, bundle) =>
  mirrorSite({
    url: `${server.origin}/`,
    out,
    maxPages: 20,
    concurrency: 4,
    delay: 0,
    timeout: 10000,
    maxFileMb: 10,
    sitemap: true,
    bundle,
    quiet: true,
    userAgent: 'lt-tools-test',
    allowPrivateHosts: ['127.0.0.1'],
  });
const compare = (mirrorDir, extra = {}) =>
  compareSite({ mirrorDir, viewports: ['desktop'], interactions: true, concurrency: 2, quiet: true, settle: 400, ...extra });

before(async () => {
  server = await startFixtureServer();
  tmp = mkdtempSync(path.join(os.tmpdir(), 'lt-compare-test-'));
});

after(async () => {
  await server?.close();
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

test('Chrome and esbuild are available in CI', { skip: !ci && 'only enforced in CI' }, () => {
  assert.ok(chrome, 'Chrome/Chromium is required in CI; otherwise the comparison tests would be skipped');
  assert.ok(canBundle, 'esbuild is required in CI');
});

test('a bundled mirror is identical where it is complete, and pages that need the live site are reported', { skip: skipBundled, timeout: 180000 }, async () => {
  const report = await mirror(path.join(tmp, 'bundled'), true);
  const res = await compare(report.outDir);
  assert.equal(res.results.length, 3);
  const byPath = Object.fromEntries(res.results.map((r) => [r.path, r]));
  assert.deepEqual(byPath['/'].diffs, [], JSON.stringify(byPath['/'].diffs, null, 2));
  assert.deepEqual(byPath['/about/'].diffs, [], JSON.stringify(byPath['/about/'].diffs, null, 2));
  // /contact loads img/runtime.png from the live host at runtime; with the live hosts
  // blocked for the backup, the image breaks and the comparison says so.
  const contactKeys = byPath['/contact'].diffs.map((d) => d.key);
  assert.ok(contactKeys.includes('images') || contactKeys.includes('errors'), `expected /contact to be reported, got ${contactKeys.join(', ')}`);
  // The blocked request is named, so the skill's diagnosis row (ERR_BLOCKED_BY_CLIENT) matches.
  const contactErrors = JSON.stringify(byPath['/contact'].diffs.find((d) => d.key === 'errors') ?? {});
  assert.match(contactErrors, /ERR_BLOCKED_BY_CLIENT/, `blocked request named in ${contactErrors}`);
});

test('a mirror with unbundled ES modules is reported as broken', { skip: skipChrome, timeout: 180000 }, async () => {
  const report = await mirror(path.join(tmp, 'unbundled'), false);
  assert.equal(report.modulesNeedServer, true);
  const res = await compare(report.outDir, { pages: ['/'] });
  const keys = res.results[0].diffs.map((d) => d.key);
  assert.ok(keys.includes('text'), `expected a text difference, got ${keys.join(', ')}`);
  assert.ok(keys.includes('errors'), `expected backup-only errors, got ${keys.join(', ')}`);
});

test('a live site that never answers ends with an error instead of hanging', { skip: skipChrome, timeout: 60000 }, async () => {
  const hang = await startHangingServer();
  const dir = path.join(tmp, 'hang');
  try {
    mkdirSync(path.join(dir, 'site'), { recursive: true });
    writeFileSync(path.join(dir, 'site', 'index.html'), '<!doctype html><title>x</title><p>local</p>');
    writeFileSync(
      path.join(dir, 'mirror-report.json'),
      JSON.stringify({ source: `${hang.origin}/`, root: path.join(dir, 'site'), pages: [{ url: `${hang.origin}/`, file: 'index.html', inSitemap: true }] }),
    );
    const started = Date.now();
    const res = await compare(dir, { pageTimeout: 2000 });
    assert.ok(Date.now() - started < 45000, 'comparison must give up on a page that never loads');
    assert.match(res.results[0].error || '', /timed out|Navigation failed/);
  } finally {
    await hang.close();
  }
});
