// lib.test.mjs — offline unit tests for the mirror helpers.
//
// Run: node --test plugins/lt-tools/scripts/__tests__/lib.test.mjs

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { extractCss, extractHtml, extractJs, srcsetSpans, applyReplacements } from '../lib/extract.mjs';
import { createUrlMapper, isCacheBusterQuery, relativeHref, siteHostsFor, stripTracking } from '../lib/url-map.mjs';
import { existsSync } from 'node:fs';
import { addressAllowed, isPrivateAddress } from '../lib/net-guard.mjs';
import { listZip, verifyZip, zipDirectory } from '../lib/zip.mjs';
import { classicScriptTag, isInside, parseRobots, parseSitemap, robotsAllows, stripLocalSri } from '../mirror-site.mjs';

const mapper = createUrlMapper(siteHostsFor('https://www.example.com/'));

test('site hosts include the www / apex twin', () => {
  assert.deepEqual(siteHostsFor('https://www.example.com/x'), ['www.example.com', 'example.com']);
  assert.ok(mapper.isSameSite('https://example.com/a'));
  assert.ok(!mapper.isSameSite('https://cdn.example.com/a'));
});

test('pages always map to .html files', () => {
  assert.equal(mapper.pagePath('https://www.example.com/'), 'index.html');
  assert.equal(mapper.pagePath('https://www.example.com/team/'), 'team/index.html');
  assert.equal(mapper.pagePath('https://www.example.com/contact'), 'contact/index.html');
  assert.equal(mapper.pagePath('https://www.example.com/a/b.html'), 'a/b.html');
  assert.equal(mapper.pagePath('https://www.example.com/shop.php'), 'shop.php.html');
  assert.match(mapper.pagePath('https://www.example.com/news/?page=2'), /^news\/index__q[0-9a-f]{8}\.html$/);
  assert.equal(mapper.pagePath('https://www.example.com/?utm_source=x'), 'index.html');
});

test('cache-buster queries are dropped, real queries become a hash suffix', () => {
  assert.ok(isCacheBusterQuery('?1787055968'));
  assert.ok(isCacheBusterQuery('?v=3.2.1'));
  assert.ok(isCacheBusterQuery(''));
  assert.ok(!isCacheBusterQuery('?w=200&h=100'));
  assert.equal(mapper.assetPath('https://www.example.com/img/logo.svg?1787055968', 'image/svg+xml'), 'img/logo.svg');
  assert.equal(mapper.assetPath('https://www.example.com/css/a.css?v=12', 'text/css'), 'css/a.css');
  assert.match(mapper.assetPath('https://www.example.com/img/p.jpg?w=200&h=100', 'image/jpeg'), /^img\/p__q[0-9a-f]{8}\.jpg$/);
});

test('assets without extension get one from the Content-Type', () => {
  assert.equal(mapper.assetPath('https://www.example.com/api/image', 'image/png'), 'api/image.png');
  assert.equal(mapper.assetPath('https://www.example.com/styles', 'text/css; charset=utf-8'), 'styles.css');
});

test('external assets live under _external/<host>/', () => {
  assert.equal(mapper.assetPath('https://fonts.gstatic.com/s/x.woff2', 'font/woff2'), '_external/fonts.gstatic.com/s/x.woff2');
});

test('file names are safe on Windows', () => {
  assert.equal(mapper.assetPath('https://www.example.com/a:b/con.txt', 'text/plain'), 'a_b/_con.txt');
});

test('encoded dot segments never become path steps', () => {
  // Without the dot-segment guard /a/..%2F..%2F..%2Fescape/x.png maps to a/../../../escape/x.png.
  const urls = [
    'https://www.example.com/a/..%2F..%2F..%2Fescape/x.png',
    'https://www.example.com/a/%2e%2e%2F%2e%2e%2Fx.png',
    'https://www.example.com/a/..%5C..%5Cx.png',
    'https://www.example.com/a/.%2F..%2Fb.css',
  ];
  for (const url of urls) {
    const p = mapper.assetPath(url, 'image/png');
    assert.ok(!path.posix.normalize(p).startsWith('..'), `${url} → ${p}`);
    assert.ok(!p.split('/').some((seg) => seg === '..' || seg === '.'), `${url} → ${p}`);
  }
  const page = mapper.pagePath('https://www.example.com/..%2F..%2Fetc/passwd');
  assert.ok(!path.posix.normalize(page).startsWith('..') && !page.split('/').includes('..'), page);
});

test('containment check for paths inside the backup folder', () => {
  const root = path.join(os.tmpdir(), 'lt-root-check', 'site');
  assert.ok(isInside(root, path.join(root, 'img', 'a.png')));
  assert.ok(!isInside(root, root));
  assert.ok(!isInside(root, `${root}-other/a.png`));
  assert.ok(!isInside(root, path.join(root, '..', '..', 'secret.json')));
  // An existing folder behind a symlinked temp dir (macOS: /var → /private/var) and a file
  // that does not exist yet must compare on the same footing.
  const real = mkdtempSync(path.join(os.tmpdir(), 'lt-inside-'));
  try {
    assert.ok(isInside(real, path.join(real, 'new', 'file.png')));
    assert.ok(!isInside(real, path.join(real, '..', 'outside.png')));
  } finally {
    rmSync(real, { recursive: true, force: true });
  }
});

test('private, loopback, link-local and CGNAT addresses are blocked', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.20.0.1', '192.168.178.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', '::', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1', '64:ff9b::a9fe:a9fe', '2002:a9fe:a9fe::1']) {
    assert.ok(isPrivateAddress(ip), ip);
  }
  for (const ip of ['93.184.216.34', '8.8.8.8', '2606:4700:4700::1111', '::ffff:8.8.8.8']) assert.ok(!isPrivateAddress(ip), ip);
  assert.ok(addressAllowed('127.0.0.1', ['127.0.0.1']));
  assert.ok(!addressAllowed('169.254.169.254', ['127.0.0.1']));
  assert.ok(addressAllowed('10.0.0.1', true));
});

test('relative hrefs between mirror files', () => {
  assert.equal(relativeHref('index.html', 'img/logo.svg'), 'img/logo.svg');
  assert.equal(relativeHref('team/index.html', 'img/logo.svg'), '../img/logo.svg');
  assert.equal(relativeHref('team/index.html', 'team/index.html', '#top'), 'index.html#top');
  assert.equal(relativeHref('index.html', 'img/a b#1.png'), 'img/a%20b%231.png');
});

test('tracking parameters are stripped from page URLs', () => {
  assert.equal(stripTracking('https://x.de/a?utm_source=n&id=1#h'), 'https://x.de/a?id=1');
});

test('srcset keeps commas that belong to the URL', () => {
  const v = '/a.png 1x, /b,w_200.png 2x,/c.png';
  assert.deepEqual(srcsetSpans(v, 0).map((s) => s.value), ['/a.png', '/b,w_200.png', '/c.png']);
});

test('HTML extraction finds every kind of reference with exact offsets', () => {
  const html = `<html><head><base href="/">
<link rel="stylesheet" href="/a.css"><link rel="canonical" href="https://x/">
<link rel="modulepreload" href="/m.js">
<script type="module" src="/main.js"></script><script src="/classic.js"></script>
<script type="application/ld+json">{"logo":"https:\\/\\/www.example.com\\/logo.png","url":"https://www.example.com/"}</script>
<style>.x{background:url("/bg.png")}</style></head>
<body><!-- <img src="/commented.png"> -->
<a href="/page/">p</a><img src="/i.png" srcset="/s1.png 1x, /s2.png 2x" data-src="/lazy.png">
<div style="background:url(/inline.png)"></div><video poster="/poster.jpg"></video>
<iframe src="/embed/"></iframe><form action="/send" method="post"></form>
<meta property="og:image" content="https://www.example.com/og.png"><a href="mailto:x@y.z">m</a>
</body></html>`;
  const { refs, base, moduleScripts, forms } = extractHtml(html);
  for (const r of refs) assert.equal(html.slice(r.start, r.end), r.value.includes('\\/') ? r.value : html.slice(r.start, r.end));
  const byValue = Object.fromEntries(refs.map((r) => [r.value, r.kind]));
  assert.equal(base, '/');
  assert.equal(byValue['/a.css'], 'asset');
  assert.equal(byValue['https://x/'], undefined, 'canonical is not a requisite');
  assert.equal(byValue['/m.js'], 'module');
  assert.equal(byValue['/main.js'], 'module');
  assert.equal(byValue['/classic.js'], 'script');
  assert.equal(byValue['https://www.example.com/logo.png'], 'asset');
  assert.equal(byValue['https://www.example.com/'], undefined, 'JSON-LD page URLs are not fetched');
  assert.equal(byValue['/bg.png'], 'asset');
  assert.equal(byValue['/commented.png'], undefined, 'comments are skipped');
  assert.equal(byValue['/page/'], 'page');
  for (const v of ['/i.png', '/s1.png', '/s2.png', '/lazy.png', '/inline.png', '/poster.jpg']) assert.equal(byValue[v], 'asset', v);
  assert.equal(byValue['/embed/'], 'page');
  assert.equal(byValue['https://www.example.com/og.png'], 'asset');
  assert.equal(byValue['mailto:x@y.z'], undefined);
  assert.equal(moduleScripts.length, 1);
  assert.deepEqual(forms, [{ value: '/send', method: 'post', id: '' }]);
});

test('CSS extraction covers url(), @import and image-set()', () => {
  const css = '@import "base.css";@import url(fonts.css);a{background:url( "x.png" )}b{background:image-set("a.png" 1x, url(b.png) 2x)}';
  const values = extractCss(css).map((r) => r.value).sort();
  assert.deepEqual(values, ['a.png', 'b.png', 'base.css', 'fonts.css', 'x.png']);
  for (const r of extractCss(css)) assert.equal(css.slice(r.start, r.end), r.value);
});

test('JS extraction finds static, dynamic and import.meta.url references', () => {
  const js = 'import{a}from"./rolldown-runtime-hePW80VL.js";import "./side.js";export{b}from"../c.js";const l=()=>import("./lazy.js");new URL("../img/x.png",import.meta.url);const s="assets/logo-Ab12Cd34.svg";import vue from "vue";';
  const refs = extractJs(js);
  const byValue = Object.fromEntries(refs.map((r) => [r.value, r.kind]));
  assert.equal(byValue['./rolldown-runtime-hePW80VL.js'], 'module');
  assert.equal(byValue['./side.js'], 'module');
  assert.equal(byValue['../c.js'], 'module');
  assert.equal(byValue['./lazy.js'], 'module');
  assert.equal(byValue['../img/x.png'], 'asset');
  assert.equal(byValue['assets/logo-Ab12Cd34.svg'], 'guess');
  assert.equal(byValue.vue, undefined, 'bare specifiers are not files');
  for (const r of refs) assert.equal(js.slice(r.start, r.end), r.value);
});

test('replacements apply back to front', () => {
  assert.equal(applyReplacements('a-b-c', [{ start: 0, end: 1, text: 'AA' }, { start: 4, end: 5, text: 'C' }]), 'AA-b-C');
});

test('robots.txt rules for the * group, longest match wins', () => {
  const rules = parseRobots('User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nDisallow: /private/\nAllow: /private/open/\nSitemap: https://x/s.xml\n');
  assert.deepEqual(rules.sitemaps, ['https://x/s.xml']);
  assert.ok(robotsAllows(rules, '/team/'));
  assert.ok(!robotsAllows(rules, '/private/a'));
  assert.ok(robotsAllows(rules, '/private/open/b'));
});

test('sitemap index and url sets', () => {
  assert.deepEqual(parseSitemap('<sitemapindex><sitemap><loc>https://x/a.xml</loc></sitemap></sitemapindex>'), { isIndex: true, locs: ['https://x/a.xml'] });
  assert.deepEqual(parseSitemap('<urlset><url><loc><![CDATA[https://x/?a=1&amp;b=2]]></loc></url></urlset>').locs, ['https://x/?a=1&b=2']);
});

test('module script tags become deferred classic scripts', () => {
  assert.equal(classicScriptTag('<script type="module" src="a.js" crossorigin integrity="sha-x">', 'a.offline.js'), '<script defer src="a.offline.js">');
  assert.equal(classicScriptTag('<script async type="module" src="a.js">', 'a.offline.js'), '<script async src="a.offline.js">');
});

test('SRI and crossorigin are removed only on local files', () => {
  const html = '<link rel="stylesheet" href="css/a.css" integrity="sha-1" crossorigin="anonymous"><script src="https://cdn.x/y.js" integrity="sha-2" crossorigin></script>';
  assert.equal(stripLocalSri(html), '<link rel="stylesheet" href="css/a.css"><script src="https://cdn.x/y.js" integrity="sha-2" crossorigin></script>');
});

test('zip archives round-trip with valid checksums', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'lt-zip-'));
  try {
    const src = path.join(dir, 'site');
    mkdirSync(path.join(src, 'img'), { recursive: true });
    writeFileSync(path.join(src, 'index.html'), '<h1>Ä</h1>'.repeat(200));
    writeFileSync(path.join(src, 'img', 'ö.bin'), Buffer.from([1, 2, 3]));
    writeFileSync(path.join(src, '.DS_Store'), 'x');
    const zip = path.join(dir, 'site.zip');
    const res = zipDirectory(src, zip);
    assert.equal(res.files, 2);
    const entries = listZip(zip);
    assert.deepEqual(entries.map((e) => e.name).sort(), ['site/img/ö.bin', 'site/index.html']);
    assert.ok(entries.every((e) => e.crcOk));
    assert.deepEqual(verifyZip(zip), { ok: true, entries: 2 });
    // An archive over the limit is refused before writing; no partial file stays behind.
    const tooBig = path.join(dir, 'too-big.zip');
    assert.throws(() => zipDirectory(src, tooBig, { limit: 100 }), /exceed/);
    assert.ok(!existsSync(tooBig));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
