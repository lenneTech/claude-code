// mirror-site.test.mjs — end-to-end mirror of the local fixture site (no network).
//
// The bundling step needs esbuild through npx; without it (offline, no npm cache) the
// bundling assertions are skipped locally. In CI a missing esbuild fails the run instead,
// so the bundling tests can never be skipped silently.
//
// Run: node --test plugins/lt-tools/scripts/__tests__/mirror-site.test.mjs

import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import dns from 'node:dns';
import { after, before, mock, test } from 'node:test';
import http from 'node:http';
import { gzipSync } from 'node:zlib';
import { esbuildAvailable, mirrorSite } from '../mirror-site.mjs';
import { listZip } from '../lib/zip.mjs';
import { startFixtureServer } from './fixture-site.mjs';

let server;
let tmp;
let report;
let root;
const canBundle = esbuildAvailable();
const skipBundle = !canBundle && !process.env.CI && 'esbuild not available via npx';

const options = (overrides) => ({
  maxPages: 50,
  concurrency: 4,
  delay: 0,
  timeout: 10000,
  maxFileMb: 10,
  sitemap: true,
  ignoreRobots: false,
  externalAssets: false,
  bundle: true,
  zip: true,
  force: false,
  quiet: true,
  userAgent: 'lt-tools-test',
  allowPrivateHosts: ['127.0.0.1'],
  ...overrides,
});

before(async () => {
  server = await startFixtureServer();
  tmp = mkdtempSync(path.join(os.tmpdir(), 'lt-mirror-test-'));
  report = await mirrorSite(options({ url: `${server.origin}/`, out: path.join(tmp, 'backup') }));
  root = report.root;
});

after(async () => {
  await server?.close();
  rmSync(tmp, { recursive: true, force: true });
});

const read = (rel) => readFileSync(path.join(root, rel), 'utf8');

test('finds pages from the sitemap and from navigation links, honours robots.txt', () => {
  const files = report.pages.map((p) => p.file).sort();
  assert.deepEqual(files, ['about/index.html', 'contact/index.html', 'index.html']);
  assert.equal(report.pages.find((p) => p.file === 'contact/index.html').inSitemap, false);
  assert.ok(report.skipped.robots.some((u) => u.includes('/private/')));
  assert.deepEqual(report.sitemapExternalLinks, ['https://booking.example.org/x']);
});

test('downloads every requisite, including JS chunks and JS-referenced assets', () => {
  for (const rel of [
    'css/main.css',
    'css/fonts.css',
    'fonts/fixture.woff2',
    'img/logo.svg',
    'img/jsonld-logo.svg',
    'img/a-1x.png',
    'img/a-2x.png',
    'img/lazy.png',
    'img/bg.png',
    'img/bg2.png',
    'img/og.png',
    'img/icon-192.png',
    'site.webmanifest',
    'js/main.js',
    'js/chunk.js',
    'js/lazy-chunk.js',
    'js/hashed-abc12345.png',
    'img/meta-url.png',
  ]) {
    assert.ok(existsSync(path.join(root, rel)), `missing ${rel}`);
  }
  assert.ok(!existsSync(path.join(root, 'private')), 'robots-disallowed page must not be saved');
});

test('drops cache-buster queries from file names', () => {
  assert.ok(report.cacheBustersDropped >= 2);
  assert.ok(!report.pages.some((p) => p.file.includes('?')));
});

test('rewrites links to relative paths and removes what blocks file://', () => {
  const home = read('index.html');
  // Only three live URLs may remain: the page URL inside JSON-LD (structured data stays
  // canonical), the image that is 404 on the live site too, and the robots-excluded page,
  // which keeps working online through its absolute link.
  const live = [...home.matchAll(new RegExp(`${server.origin.replace(/[.:]/g, '\\$&')}[^"'\\s)]*`, 'g'))].map((m) => m[0].slice(server.origin.length));
  assert.deepEqual(live.sort(), ['/', '/img/missing.png', '/private/secret/']);
  assert.ok(home.includes('href="css/main.css"'));
  assert.ok(home.includes('src="img/logo.svg"'));
  assert.ok(home.includes('srcset="img/a-1x.png 1x, img/a-2x.png 2x"'));
  assert.ok(home.includes('data-src="img/lazy.png"'));
  assert.ok(home.includes("url('img/bg.png')"));
  assert.ok(home.includes('href="about/index.html"'));
  assert.ok(home.includes('href="contact/index.html"'));
  assert.ok(!/<base\b/i.test(home), '<base> removed');
  assert.ok(!/integrity=/.test(home), 'SRI removed on local files');
  // `//host/x` resolves to file://host/x from disk; the mirror pins the page's own scheme.
  assert.ok(home.includes('src="http://cdn.example.invalid/lib.js"'), 'protocol-relative URLs get an explicit scheme');
  assert.ok(home.includes('https://example.org/'), 'external links stay absolute');
  assert.ok(home.includes('img\\/jsonld-logo.svg'), 'JSON-LD keeps its escaping');
  const about = read('about/index.html');
  assert.ok(about.includes('src="../img/a-1x.png"'), '<base href> taken into account');
  assert.ok(read('css/main.css').includes('url(../img/bg2.png)'));
  assert.ok(read('css/fonts.css').includes('url("../fonts/fixture.woff2")'));
});

test('records forms, failed references and external hosts', () => {
  assert.ok(report.forms.some((f) => f.action.endsWith('/send') && f.method === 'post'));
  assert.ok(report.errors.some((e) => e.url.endsWith('/img/missing.png') && e.status === 404));
  assert.ok(report.external.requisites['cdn.example.invalid'] >= 1);
  assert.ok(report.external.links['example.org'] >= 1);
  assert.deepEqual(report.missing, []);
});

test('writes README, report and a verified ZIP', () => {
  assert.ok(existsSync(path.join(report.outDir, 'README.md')));
  assert.ok(existsSync(path.join(report.outDir, 'mirror-report.json')));
  assert.ok(report.zip.verified);
  const names = listZip(report.zip.path).map((e) => e.name);
  assert.ok(names.includes('backup/README.md'));
});

test('refuses to overwrite a non-empty output folder without --force', async () => {
  await assert.rejects(mirrorSite(options({ url: `${server.origin}/`, out: report.outDir, zip: false })), /not empty/);
});

test('esbuild is reachable in CI', { skip: !process.env.CI && 'only enforced in CI' }, () => {
  assert.ok(canBundle, 'esbuild must be available in CI; otherwise the bundling tests would be skipped');
});

test('bundles module scripts into classic scripts for file://', { skip: skipBundle }, () => {
  assert.equal(report.bundleFailures.length, 0, JSON.stringify(report.bundleFailures));
  assert.ok(existsSync(path.join(root, 'js/main.offline.js')));
  const home = read('index.html');
  assert.ok(home.includes('<script defer src="js/main.offline.js">'));
  assert.ok(!/modulepreload/.test(home));
  assert.ok(!/type="module"/.test(home));
  const bundle = read('js/main.offline.js');
  assert.ok(bundle.includes('chunk') && bundle.includes('__ltMetaUrl'), 'chunks inlined, import.meta.url shimmed');
  assert.equal(report.modulesNeedServer, false);
});

test('refuses a start URL on a private address without --allow-private-hosts', async () => {
  await assert.rejects(
    mirrorSite(options({ url: `${server.origin}/`, out: path.join(tmp, 'private'), zip: false, allowPrivateHosts: false })),
    /--allow-private-hosts/,
  );
});

test('blocks redirects and sitemaps that lead to private addresses (SSRF)', async () => {
  const trap = await startFixtureServer({ ssrf: true });
  // intranet.test resolves to a documentation address: only the DNS guard can refuse it.
  const realLookup = dns.lookup;
  mock.method(dns, 'lookup', (host, opts, cb) => {
    const callback = typeof opts === 'function' ? opts : cb;
    const all = typeof opts === 'object' && opts.all;
    if (host === 'intranet.test') return all ? callback(null, [{ address: '192.0.2.10', family: 4 }]) : callback(null, '192.0.2.10', 4);
    return realLookup(host, opts, cb);
  });
  try {
    const r = await mirrorSite(options({ url: `${trap.origin}/`, out: path.join(tmp, 'ssrf'), zip: false, bundle: false }));
    const blockedAt = r.blocked.map((b) => b.at);
    assert.ok(blockedAt.some((u) => u.startsWith('http://169.254.169.254/')), JSON.stringify(r.blocked));
    assert.ok(blockedAt.some((u) => u.startsWith('http://10.0.0.1/')), JSON.stringify(r.blocked));
    assert.ok(blockedAt.some((u) => u.startsWith('http://intranet.test/')), `a host name resolving to a private address is refused: ${JSON.stringify(r.blocked)}`);
    assert.ok(!existsSync(path.join(r.root, '_external')), 'nothing from a private host is stored');
    assert.ok(!existsSync(path.join(r.root, 'img', 'redirected.png')));
  } finally {
    mock.restoreAll();
    await trap.close();
  }
});

test('never bundles files from outside the backup folder', { skip: skipBundle }, async () => {
  const trap = await startFixtureServer({ evil: true });
  const dir = mkdtempSync(path.join(os.tmpdir(), 'lt-evil-'));
  try {
    // tmp/sentinel.json sits next to the output folder: <out>/<host>/js/../../../sentinel.json
    writeFileSync(path.join(dir, 'sentinel.json'), JSON.stringify({ marker: 'SENTINEL-TOKEN-4711' }));
    // A CSS import makes esbuild write a second output (<entry>.offline.css) next to the JS one.
    writeFileSync(path.join(dir, 'sentinel.css'), 'body::after { content: "CSS-SENTINEL-4712"; }\n');
    const r = await mirrorSite(options({ url: `${trap.origin}/`, out: path.join(dir, 'backup'), zip: true }));
    const failure = r.bundleFailures.find((f) => f.entry === 'js/evil.js');
    assert.ok(failure && /outside the backup folder/.test(failure.error), JSON.stringify(r.bundleFailures));
    assert.ok(!existsSync(path.join(r.root, 'js', 'evil.offline.js')));
    const inline = r.bundleFailures.find((f) => f.entry === 'evil/index.html (inline module)');
    assert.ok(inline && /outside the backup folder/.test(inline.error), `inline module refused: ${JSON.stringify(r.bundleFailures)}`);
    const walk = (d) => readdirSync(d).flatMap((n) => (statSync(path.join(d, n)).isDirectory() ? walk(path.join(d, n)) : [path.join(d, n)]));
    for (const f of walk(r.outDir)) {
      const content = readFileSync(f);
      assert.ok(!content.includes('SENTINEL-TOKEN-4711'), `sentinel leaked into ${f}`);
      assert.ok(!content.includes('CSS-SENTINEL-4712'), `CSS sentinel leaked into ${f}`);
    }
    assert.ok(!walk(r.outDir).some((f) => f.endsWith('.offline.css')), 'no CSS output of a refused bundle survives');
    const zip = readFileSync(r.zip.path);
    assert.ok(!zip.includes('SENTINEL-TOKEN-4711'));
    assert.ok(!zip.includes('CSS-SENTINEL-4712'));
    for (const e of listZip(r.zip.path)) assert.ok(e.crcOk);
  } finally {
    await trap.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a compressed response cut off mid-transfer fails that file instead of hanging the mirror', { timeout: 30000 }, async () => {
  // gzip-encoded asset whose connection drops halfway through the body: before the fix the
  // decompressor never ended, the request never settled, and the CLI exited 0 without a report.
  const gz = gzipSync(Buffer.from('console.log(1);\n'.repeat(20000)));
  const srv = http.createServer((req, res) => {
    if (req.url === '/cut.js') {
      res.writeHead(200, { 'content-type': 'text/javascript', 'content-encoding': 'gzip' });
      res.write(gz.subarray(0, Math.floor(gz.length / 2)));
      setTimeout(() => res.socket.destroy(), 50);
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end('<!doctype html><html><head><title>Cut</title></head><body><h1>Cut</h1><script src="/cut.js"></script></body></html>');
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${srv.address().port}`;
  try {
    const r = await mirrorSite(options({ url: `${origin}/`, out: path.join(tmp, 'cut'), zip: false, bundle: false, timeout: 3000 }));
    assert.ok(r.errors.some((e) => e.url.endsWith('/cut.js')), JSON.stringify(r.errors));
    assert.ok(existsSync(path.join(r.outDir, 'mirror-report.json')), 'the report is written');
  } finally {
    srv.closeAllConnections?.();
    await new Promise((r) => srv.close(r));
  }
});

test('npx never reads configuration the mirrored site planted in the backup', { skip: skipBundle, timeout: 120000 }, async () => {
  // A site can serve /.npmrc; stored in the backup root it would point npx at a registry the
  // site controls (and run whatever "esbuild" it serves). Bundling must not run npx in there.
  let registryHits = 0;
  const registry = http.createServer((req, res) => {
    registryHits++;
    res.writeHead(404);
    res.end();
  });
  await new Promise((r) => registry.listen(0, '127.0.0.1', r));
  const registryUrl = `http://127.0.0.1:${registry.address().port}/`;
  const site = http.createServer((req, res) => {
    if (req.url === '/.npmrc') {
      res.writeHead(200, { 'content-type': 'application/octet-stream' });
      res.end(`registry=${registryUrl}\n`);
    } else if (req.url === '/js/m.js') {
      res.writeHead(200, { 'content-type': 'text/javascript' });
      res.end('export const a = 1;\ndocument.title = String(a);\n');
    } else {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end('<!doctype html><html><head><title>R</title><link rel="stylesheet" href="/.npmrc"></head><body><h1>R</h1><script type="module" src="/js/m.js"></script></body></html>');
    }
  });
  await new Promise((r) => site.listen(0, '127.0.0.1', r));
  try {
    const r = await mirrorSite(options({ url: `http://127.0.0.1:${site.address().port}/`, out: path.join(tmp, 'npmrc'), zip: false }));
    assert.ok(existsSync(path.join(r.root, '.npmrc')), 'precondition: the planted .npmrc is in the backup root');
    assert.equal(registryHits, 0, 'npx contacted the registry the site planted');
    assert.ok(r.bundled.some((b) => b.entry === 'js/m.js'), JSON.stringify(r.bundleFailures));
  } finally {
    await new Promise((r) => registry.close(r));
    await new Promise((r) => site.close(r));
  }
});

test('an oversized or broken gzip sitemap is reported, not fatal', async () => {
  const bomb = gzipSync(Buffer.alloc(20 * 1024 * 1024)); // 20 MiB of zeros, above maxFileMb: 10
  const sitemap = gzipSync(Buffer.from('<?xml version="1.0"?><urlset><url><loc>/a/</loc></url></urlset>'));
  const cut = sitemap.subarray(0, Math.floor(sitemap.length / 2));
  const srv = http.createServer((req, res) => {
    if (req.url === '/robots.txt') {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end(`User-agent: *\nAllow: /\nSitemap: ${origin}/bomb.xml.gz\nSitemap: ${origin}/cut.xml.gz\n`);
    } else if (req.url === '/bomb.xml.gz' || req.url === '/cut.xml.gz') {
      res.writeHead(200, { 'content-type': 'application/octet-stream' });
      res.end(req.url === '/bomb.xml.gz' ? bomb : cut);
    } else {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end('<!doctype html><html><head><title>S</title></head><body><h1>S</h1></body></html>');
    }
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${srv.address().port}`;
  try {
    const r = await mirrorSite(options({ url: `${origin}/`, out: path.join(tmp, 'sitemaps'), zip: false, bundle: false }));
    assert.ok(r.errors.some((e) => e.url.endsWith('/bomb.xml.gz')), JSON.stringify(r.errors));
    assert.ok(r.errors.some((e) => e.url.endsWith('/cut.xml.gz')), JSON.stringify(r.errors));
    assert.ok(r.pages.length >= 1, 'the crawl still runs');
  } finally {
    await new Promise((r) => srv.close(r));
  }
});

test('a response that keeps streaming is cut off at maxTime and not retried', { timeout: 30000 }, async () => {
  // A live stream (webcam, radio) never goes idle, so only an overall deadline ends it.
  let streamRequests = 0;
  const timers = new Set();
  const srv = http.createServer((req, res) => {
    if (req.url === '/cam.mjpg') {
      streamRequests++;
      res.writeHead(200, { 'content-type': 'image/jpeg' });
      const t = setInterval(() => res.write(Buffer.alloc(1024)), 50);
      timers.add(t);
      res.on('close', () => clearInterval(t));
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end('<!doctype html><html><head><title>Cam</title></head><body><h1>Cam</h1><img src="/cam.mjpg" alt="live"></body></html>');
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${srv.address().port}`;
  try {
    const started = Date.now();
    const r = await mirrorSite(options({ url: `${origin}/`, out: path.join(tmp, 'stream'), zip: false, bundle: false, timeout: 5000, maxTime: 1500 }));
    assert.ok(r.skipped.tooSlow.some((u) => u.endsWith('/cam.mjpg')), JSON.stringify(r.skipped));
    assert.equal(streamRequests, 1, 'a stream that hit the deadline is not retried');
    assert.ok(Date.now() - started < 15000, 'the run is not held up by the stream');
  } finally {
    for (const t of timers) clearInterval(t);
    srv.closeAllConnections?.();
    await new Promise((r) => srv.close(r));
  }
});

test('a failed ZIP leaves no partial file and does not fail the mirror', async () => {
  const r = await mirrorSite(options({ url: `${server.origin}/`, out: path.join(tmp, 'zip-limit'), bundle: false, zipLimit: 1000 }));
  assert.match(r.zip.error, /exceed/);
  assert.ok(!existsSync(r.zip.path));
  assert.ok(r.pages.length >= 3, 'the mirror itself is complete');
});
