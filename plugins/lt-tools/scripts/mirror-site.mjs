#!/usr/bin/env node
// mirror-site.mjs — saves a website with all its pages and assets so it opens from file://.
//
// One run does what otherwise takes a wget mirror plus several manual repairs:
//   1. discovers pages from robots.txt sitemaps and by following same-site links
//      (pages that only appear in navigation are found too);
//   2. downloads every requisite: images incl. srcset/data-src/lazy attributes, CSS and
//      everything CSS references, fonts, video, icons, manifest, JSON-LD images, and the
//      JavaScript chunks a bundle imports (`import … from "./vendor-x.js"`), which wget
//      never sees because it does not parse JavaScript;
//   3. names files so file:// works: pages end in .html, assets keep a real extension,
//      cache-buster queries are dropped (`logo.svg?123` would render as an empty image);
//   4. rewrites links to relative paths, removes <base>, SRI `integrity` and
//      `crossorigin` on local files (both block loading from file://), turns protocol-
//      relative `//host/x` into https://;
//   5. bundles `<script type="module">` entries into classic scripts with esbuild,
//      because Chrome refuses ES modules on file:// (CORS, origin "null");
//   6. checks every local reference, then writes README.md, mirror-report.json and,
//      with --zip, a ZIP archive next to the output folder.
//
// The script never submits forms and only issues GET requests.
//
// Usage: node mirror-site.mjs <url> [options]   (see USAGE below)

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { parseArgs, toInt } from './lib/args.mjs';
import {
  applyReplacements,
  decodeEntities,
  extractCss,
  extractHtml,
  extractJs,
  extractManifest,
  SKIP_SCHEME,
} from './lib/extract.mjs';
import { checkLiteralHost, guardedLookup } from './lib/net-guard.mjs';
import { createUrlMapper, isHtmlType, relativeHref, siteHostsFor, stripTracking } from './lib/url-map.mjs';
import { verifyZip, zipDirectory } from './lib/zip.mjs';

export const ESBUILD_VERSION = process.env.LT_TOOLS_ESBUILD_VERSION || '0.28.2';

const USAGE = `Usage: node mirror-site.mjs <url> [options]

Options:
  --out <dir>            output folder (default: ~/Downloads/<host>-backup-<date>, else ./)
  --max-pages <n>        page limit (default 500)
  --concurrency <n>      parallel requests (default 4)
  --delay <ms>           minimum gap between request starts (default 150)
  --timeout <ms>         give up on a request that sends nothing for this long (default 30000)
  --max-time <ms>        give up on a download still running after this long, e.g. a live stream (default 300000)
  --max-file-mb <n>      skip larger files (default 200)
  --include <regex>      only crawl pages whose path matches (repeatable)
  --exclude <regex>      skip pages whose path matches (repeatable)
  --external-assets      also download CSS/JS/fonts/images from other hosts (CDNs, Google Fonts)
  --no-sitemap           do not read sitemaps
  --ignore-robots        crawl pages robots.txt disallows (only with the site owner's consent)
  --no-bundle            keep ES modules as they are (backup then needs a local web server)
  --zip                  also write <out>.zip
  --force                replace an existing, non-empty output folder
  --allow-private-hosts  allow loopback/LAN/link-local addresses (internal or local sites only)
  --user-agent <ua>      custom User-Agent
  --quiet                no progress lines on stderr
`;

// ───────────────────────────── HTTP ─────────────────────────────

const MAX_REDIRECTS = 10;

/** One request without following redirects; resolves to { status, headers, body } or rejects. */
function requestOnce(url, { headers, timeout, maxTime, maxBytes, allowPrivate }) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return reject(new Error(`unsupported protocol ${u.protocol}`));
    try {
      checkLiteralHost(u.hostname, allowPrivate);
    } catch (err) {
      return reject(err);
    }
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request(u, { method: 'GET', headers, lookup: guardedLookup(allowPrivate) }, (res) => {
      // A connection that drops mid-body ends `res` without `end`. Listening only on the
      // decompressor left a compressed download pending forever, and the mirror exited 0
      // without its report; settle on the response itself.
      res.on('error', reject);
      res.on('close', () => {
        if (!res.complete) reject(new Error('connection closed before the response was complete'));
      });
      const length = Number(res.headers['content-length'] || 0);
      if (length > maxBytes) {
        res.destroy();
        return resolve({ status: res.statusCode, headers: res.headers, tooLarge: true });
      }
      let stream = res;
      const encoding = String(res.headers['content-encoding'] || '').toLowerCase();
      if (encoding === 'gzip' || encoding === 'x-gzip') stream = res.pipe(zlib.createGunzip());
      else if (encoding === 'deflate') stream = res.pipe(zlib.createInflate());
      else if (encoding === 'br') stream = res.pipe(zlib.createBrotliDecompress());
      const chunks = [];
      let size = 0;
      stream.on('data', (chunk) => {
        size += chunk.length;
        if (size > maxBytes) {
          res.destroy();
          stream.destroy();
          resolve({ status: res.statusCode, headers: res.headers, tooLarge: true });
          return;
        }
        chunks.push(chunk);
      });
      stream.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
      stream.on('error', reject);
    });
    req.setTimeout(timeout, () => req.destroy(new Error('timeout')));
    // The socket timeout above only fires when nothing arrives. A live stream (webcam image,
    // web radio) never goes quiet and would run until --max-file-mb, for hours; only an
    // overall deadline ends it.
    const deadline = maxTime
      ? setTimeout(() => {
          const err = new Error(`still downloading after ${maxTime} ms`);
          err.code = 'EDEADLINE';
          reject(err);
          req.destroy(err);
        }, maxTime)
      : null;
    req.on('close', () => deadline && clearTimeout(deadline));
    req.on('error', reject);
    req.end();
  });
}

class Fetcher {
  constructor({ delay, timeout, maxTime, userAgent, maxBytes, allowPrivate, log }) {
    this.delay = delay;
    this.timeout = timeout;
    this.maxTime = maxTime;
    this.userAgent = userAgent;
    this.maxBytes = maxBytes;
    this.allowPrivate = allowPrivate;
    this.nextSlot = 0;
    this.log = log;
    this.blocked = [];
  }

  async slot() {
    const now = Date.now();
    const wait = Math.max(0, this.nextSlot - now);
    this.nextSlot = Math.max(now, this.nextSlot) + this.delay;
    if (wait) await sleep(wait);
  }

  /** GET with manual redirects; every hop is checked against the address policy. */
  async get(url, accept = '*/*') {
    let lastError;
    const headers = { 'user-agent': this.userAgent, accept, 'accept-language': 'de,en;q=0.8', 'accept-encoding': 'gzip, deflate, br' };
    for (let attempt = 0; attempt < 3; attempt++) {
      await this.slot();
      let current = url;
      try {
        for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
          const res = await requestOnce(current, { headers, timeout: this.timeout, maxTime: this.maxTime, maxBytes: this.maxBytes, allowPrivate: this.allowPrivate });
          if (res.status >= 300 && res.status < 400 && res.headers.location) {
            if (hop === MAX_REDIRECTS) throw new Error('too many redirects');
            current = new URL(res.headers.location, current).href;
            continue;
          }
          if (res.tooLarge) {
            this.log(`SKIP ${url} too large`);
            return { ok: false, status: res.status, tooLarge: true, url: current };
          }
          if (res.status === 429 || res.status === 503) {
            const retryAfter = Math.min(30, Number(res.headers['retry-after']) || 2 ** attempt);
            lastError = `HTTP ${res.status}`;
            this.log(`RETRY ${url} ${res.status} in ${retryAfter}s`);
            await sleep(retryAfter * 1000);
            break;
          }
          this.log(`${res.status} ${url}${current !== url ? ` -> ${current}` : ''} ${res.body.length}`);
          return {
            ok: res.status >= 200 && res.status < 300,
            status: res.status,
            url: current,
            contentType: String(res.headers['content-type'] || '').toLowerCase(),
            body: res.body,
          };
        }
      } catch (err) {
        if (err.code === 'EDEADLINE') {
          // A stream would hit the deadline again on every retry; one deadline is enough.
          this.log(`SKIP ${url} ${err.message}`);
          return { ok: false, status: 0, error: err.message, tooSlow: true, url: current };
        }
        if (err.code === 'EBLOCKED') {
          this.log(`BLOCKED ${url}${current !== url ? ` -> ${current}` : ''} ${err.message}`);
          this.blocked.push({ url, at: current, reason: err.message });
          return { ok: false, status: 0, error: err.message, blocked: true, url: current };
        }
        lastError = err.message;
        this.log(`ERROR ${url} ${lastError}`);
        await sleep(500 * 2 ** attempt);
      }
    }
    return { ok: false, status: 0, error: lastError, url };
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Real path of `p`, also for a file that does not exist yet: the nearest existing ancestor
 * is resolved (macOS: /var → /private/var) and the rest appended, so a new file and its
 * existing folder compare on the same footing.
 */
function realPath(p) {
  let current = path.resolve(p);
  const rest = [];
  for (;;) {
    try {
      return path.join(realpathSync(current), ...rest.reverse());
    } catch {
      const parent = path.dirname(current);
      if (parent === current) return path.resolve(p);
      rest.push(path.basename(current));
      current = parent;
    }
  }
}

/** True when `target` lies inside `dir` (never `dir` itself, never through `..`). */
export function isInside(dir, target) {
  const rel = path.relative(realPath(dir), realPath(target));
  return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}

// ───────────────────────────── robots.txt & sitemaps ─────────────────────────────

export function parseRobots(text) {
  const rules = { allow: [], disallow: [], sitemaps: [] };
  let applies = false;
  let inGroupHeader = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (field === 'sitemap') {
      rules.sitemaps.push(value);
      continue;
    }
    if (field === 'user-agent') {
      if (!inGroupHeader) applies = false;
      inGroupHeader = true;
      if (value === '*') applies = true;
      continue;
    }
    inGroupHeader = false;
    if (!applies) continue;
    if (field === 'allow' && value) rules.allow.push(value);
    if (field === 'disallow' && value) rules.disallow.push(value);
  }
  return rules;
}

function robotsPatternToRegex(pattern) {
  const anchored = pattern.endsWith('$');
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split('*')
    .map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${body}${anchored ? '$' : ''}`);
}

export function robotsAllows(rules, pathWithQuery) {
  let best = { len: -1, allow: true };
  for (const [list, allow] of [[rules.disallow, false], [rules.allow, true]]) {
    for (const p of list) {
      if (robotsPatternToRegex(p).test(pathWithQuery) && p.length >= best.len) {
        if (p.length > best.len || allow) best = { len: p.length, allow };
      }
    }
  }
  return best.allow;
}

/** Unpacks a gzip body, never beyond `limit` bytes: a small file can expand to gigabytes. */
function maybeGunzip(buf, limit) {
  return buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b ? zlib.gunzipSync(buf, { maxOutputLength: limit }) : buf;
}

export function parseSitemap(xml) {
  const locs = [...xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]]+?)\s*(?:\]\]>)?\s*<\/loc>/gi)].map((m) => decodeEntities(m[1]));
  return { isIndex: /<sitemapindex[\s>]/i.test(xml), locs };
}

// ───────────────────────────── helpers ─────────────────────────────

function keyFor(url) {
  const u = new URL(url);
  u.hash = '';
  return u.href;
}

function resolveUrl(value, base) {
  const decoded = decodeEntities(value.trim());
  if (!decoded || SKIP_SCHEME.test(decoded)) return null;
  try {
    const u = new URL(decoded, base);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u;
  } catch {
    return null;
  }
}

function charsetOf(contentType, body) {
  const fromHeader = /charset=([\w-]+)/i.exec(contentType || '')?.[1];
  const sniff = fromHeader || /<meta[^>]+charset=["']?([\w-]+)/i.exec(body.subarray(0, 2048).toString('latin1'))?.[1];
  const cs = (sniff || 'utf-8').toLowerCase();
  return cs === 'utf-8' || cs === 'utf8' ? 'utf8' : 'latin1';
}

function defaultOutDir(host) {
  const date = new Date().toISOString().slice(0, 10);
  const downloads = path.join(os.homedir(), 'Downloads');
  const parent = existsSync(downloads) ? downloads : process.cwd();
  return path.join(parent, `${host.replace(/^www\./, '')}-backup-${date}`);
}

function formatBytes(n) {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1)} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.round(n / 1024)} KB`;
}

function kindOfResource(contentType, url) {
  const ct = (contentType || '').split(';')[0].trim();
  const ext = path.extname(new URL(url).pathname).toLowerCase();
  if (isHtmlType(ct)) return 'html';
  if (ct === 'text/css' || ext === '.css') return 'css';
  if (/javascript|ecmascript/.test(ct) || ext === '.js' || ext === '.mjs') return 'js';
  if (ct === 'image/svg+xml' || ext === '.svg') return 'svg';
  if (ct === 'application/manifest+json' || ext === '.webmanifest') return 'manifest';
  return 'binary';
}

// ───────────────────────────── esbuild ─────────────────────────────

function npxCommand() {
  const dir = path.dirname(process.execPath);
  for (const candidate of [
    path.join(dir, 'node_modules', 'npm', 'bin', 'npx-cli.js'),
    path.join(dir, '..', 'lib', 'node_modules', 'npm', 'bin', 'npx-cli.js'),
  ]) {
    if (existsSync(candidate)) return { cmd: process.execPath, pre: [candidate], shell: false };
  }
  return { cmd: process.platform === 'win32' ? 'npx.cmd' : 'npx', pre: [], shell: process.platform === 'win32' };
}

let npxDir = null;
/**
 * npm's project folder for the npx call. npm reads project configuration (.npmrc: registry,
 * node-options, scripts) from the working directory upwards. esbuild has to run in the backup,
 * which is the mirrored site's content, and a site can serve /.npmrc into it, pointing npx at a
 * registry it controls. `--prefix` moves npm's project folder to this private, empty one, so no
 * configuration from the backup is read, while esbuild keeps its working directory.
 */
function npxWorkDir() {
  if (!npxDir) {
    npxDir = mkdtempSync(path.join(os.tmpdir(), 'lt-npx-'));
    writeFileSync(path.join(npxDir, 'package.json'), '{"private":true}\n');
    process.once('exit', () => rmSync(npxDir, { recursive: true, force: true }));
  }
  return npxDir;
}

function runEsbuildOnce(args, { cwd, input } = {}) {
  const npx = npxCommand();
  const prefix = npx.shell ? `--prefix="${npxWorkDir()}"` : `--prefix=${npxWorkDir()}`;
  const res = spawnSync(npx.cmd, [...npx.pre, prefix, '--yes', `esbuild@${ESBUILD_VERSION}`, ...args], {
    cwd,
    input,
    encoding: 'utf8',
    shell: npx.shell,
    timeout: 180000,
  });
  return { ok: res.status === 0, stderr: (res.stderr || '') + (res.error ? String(res.error) : '') };
}

/**
 * Runs esbuild through npx, retrying once: two npx processes that fill an empty npx cache
 * at the same time collide (TAR_ENTRY_ERROR, spawn sh ENOENT) and the second attempt succeeds.
 */
function runEsbuild(args, opts = {}) {
  const first = runEsbuildOnce(args, opts);
  if (first.ok) return first;
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500 + Math.floor(Math.random() * 1000));
  return runEsbuildOnce(args, opts);
}

export function esbuildAvailable() {
  return runEsbuild(['--version']).ok;
}

// ───────────────────────────── main routine ─────────────────────────────

export async function mirrorSite(options) {
  const startedAt = new Date();
  const progress = options.quiet ? () => {} : (msg) => process.stderr.write(`${msg}\n`);
  const logLines = [];
  const log = (line) => logLines.push(`${new Date().toISOString()} ${line}`);

  const fetcher = new Fetcher({
    delay: options.delay,
    timeout: options.timeout,
    maxTime: options.maxTime ?? 300000,
    userAgent: options.userAgent,
    maxBytes: options.maxFileMb * 1024 * 1024,
    allowPrivate: options.allowPrivateHosts ?? false,
    log,
  });

  // Preflight: the start URL may redirect (http → https, apex → www).
  const first = await fetcher.get(options.url, 'text/html,*/*');
  if (!first.ok) {
    if (first.blocked) throw new Error(`Start URL ${options.url} resolves to a private address; pass --allow-private-hosts for an internal or local site`);
    throw new Error(`Start URL failed: ${options.url} (${first.status || first.error})`);
  }
  const startUrl = first.url;
  const siteHosts = [...new Set([...siteHostsFor(options.url), ...siteHostsFor(startUrl)])];
  const mapper = createUrlMapper(siteHosts);
  const host = new URL(startUrl).hostname;
  const outDir = path.resolve(options.out || defaultOutDir(host));
  const root = path.join(outDir, host);

  if (existsSync(outDir) && readdirSync(outDir).length) {
    if (!options.force) throw new Error(`Output folder exists and is not empty: ${outDir} (use --force to replace it)`);
    rmSync(outDir, { recursive: true, force: true });
  }
  mkdirSync(root, { recursive: true });

  const origin = new URL(startUrl).origin;
  const includes = (options.include || []).map((r) => new RegExp(r));
  const excludes = (options.exclude || []).map((r) => new RegExp(r));

  // robots.txt
  let robots = { allow: [], disallow: [], sitemaps: [] };
  const robotsRes = await fetcher.get(`${origin}/robots.txt`, 'text/plain');
  if (robotsRes.ok && !isHtmlType(robotsRes.contentType)) robots = parseRobots(robotsRes.body.toString('utf8'));

  const resources = new Map(); // url key → resource
  const aliases = new Map(); // requested key → final key
  const byLocalPath = new Map(); // local path → url key
  const queued = new Set();
  const queue = [];
  const errors = [];
  const skipped = { robots: [], filter: [], limit: [], tooLarge: [], tooSlow: [], offSite: [] };
  const external = { requisites: {}, links: {} };
  const forms = [];
  const sitemapPages = new Set();
  const sitemapExternal = new Set();
  let pageCount = 0;
  let guessMisses = 0;

  const pageAllowed = (u) => {
    const p = u.pathname + u.search;
    if (includes.length && !includes.some((r) => r.test(u.pathname))) return 'filter';
    if (excludes.some((r) => r.test(u.pathname))) return 'filter';
    if (!options.ignoreRobots && !robotsAllows(robots, p)) return 'robots';
    return null;
  };

  const enqueuePage = (u, from) => {
    const key = keyFor(stripTracking(u.href));
    if (queued.has(key)) return;
    queued.add(key);
    const blocked = pageAllowed(new URL(key));
    if (blocked) {
      skipped[blocked].push(key);
      return;
    }
    if (pageCount >= options.maxPages) {
      skipped.limit.push(key);
      return;
    }
    pageCount++;
    queue.push({ url: key, kind: 'page', from });
  };

  const enqueueAsset = (u, kind, from, candidates) => {
    const key = keyFor(u.href);
    if (queued.has(key)) return;
    queued.add(key);
    queue.push({ url: key, kind, from, candidates });
  };

  const countExternal = (bucket, u) => {
    external[bucket][u.host] = (external[bucket][u.host] || 0) + 1;
  };

  const handleRef = (ref, base, from) => {
    if (ref.kind === 'form') return;
    const u = resolveUrl(ref.value, base);
    if (!u) return;
    const same = mapper.isSameSite(u.href);
    if (ref.kind === 'page') {
      if (same) enqueuePage(u, from);
      else countExternal('links', u);
      return;
    }
    if (ref.kind === 'guess') {
      if (!same) return;
      const value = ref.value.split(/[?#]/)[0];
      const candidates = [];
      if (!/^(\.|\/)/.test(value) && value.includes('/')) candidates.push(new URL(path.posix.basename(value), base).href);
      candidates.push(u.href);
      if (!/^(\.|\/)/.test(value)) candidates.push(new URL(`/${value}`, base).href);
      const fresh = [...new Set(candidates)].filter((c) => !queued.has(keyFor(c)));
      if (fresh.length) enqueueAsset(new URL(fresh[0]), 'guess', from, fresh.slice(1));
      return;
    }
    if (same || options.externalAssets) enqueueAsset(u, ref.kind, from);
    else countExternal('requisites', u);
  };

  const store = (requestedUrl, res) => {
    const finalKey = keyFor(res.url);
    const reqKey = keyFor(requestedUrl);
    if (reqKey !== finalKey) aliases.set(reqKey, finalKey);
    if (resources.has(finalKey)) return null;
    const kind = kindOfResource(res.contentType, res.url);
    let localPath = kind === 'html' ? mapper.pagePath(res.url) : mapper.assetPath(res.url, res.contentType);
    const existing = byLocalPath.get(localPath);
    if (existing && existing !== finalKey) {
      const ext = path.posix.extname(localPath);
      const hash = createHash('sha1').update(finalKey).digest('hex').slice(0, 8);
      localPath = `${ext ? localPath.slice(0, -ext.length) : localPath}__u${hash}${ext}`;
    }
    const file = path.join(root, ...localPath.split('/'));
    if (!isInside(root, file)) {
      errors.push({ url: res.url, status: 'refused: local path outside the backup folder', from: null });
      return null;
    }
    byLocalPath.set(localPath, finalKey);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, res.body);
    const resource = {
      url: res.url,
      key: finalKey,
      localPath,
      kind,
      contentType: res.contentType,
      charset: kind === 'binary' ? null : charsetOf(res.contentType, res.body),
      bytes: res.body.length,
      sameSite: mapper.isSameSite(res.url),
    };
    resources.set(finalKey, resource);
    return resource;
  };

  const processResource = (resource, item) => {
    const text = readFileSync(path.join(root, ...resource.localPath.split('/'))).toString(resource.charset || 'utf8');
    if (resource.kind === 'html') {
      const doc = extractHtml(text);
      const base = doc.base ? resolveUrl(doc.base, resource.url)?.href || resource.url : resource.url;
      for (const f of doc.forms) {
        forms.push({ page: resource.url, action: resolveUrl(f.value || resource.url, base)?.href || f.value, method: f.method });
      }
      for (const ref of doc.refs) handleRef(ref, base, resource.url);
    } else if (resource.kind === 'css') {
      for (const ref of extractCss(text)) handleRef(ref, resource.url, item.from);
    } else if (resource.kind === 'js') {
      for (const ref of extractJs(text)) handleRef(ref, resource.url, resource.url);
    } else if (resource.kind === 'svg') {
      for (const ref of extractHtml(text).refs) if (ref.kind !== 'page') handleRef(ref, resource.url, item.from);
    } else if (resource.kind === 'manifest') {
      for (const ref of extractManifest(text)) handleRef(ref, resource.url, item.from);
    }
  };

  const work = async (item) => {
    const accept = item.kind === 'page' ? 'text/html,application/xhtml+xml,*/*;q=0.8' : '*/*';
    const res = await fetcher.get(item.url, accept);
    if (!res.ok) {
      if (res.blocked) return;
      if (res.tooLarge) skipped.tooLarge.push(item.url);
      else if (res.tooSlow) skipped.tooSlow.push(item.url);
      else if (item.kind === 'guess') {
        const next = (item.candidates || []).find((c) => !queued.has(keyFor(c)));
        if (next) enqueueAsset(new URL(next), 'guess', item.from, item.candidates.filter((c) => c !== next));
        else guessMisses++;
      } else errors.push({ url: item.url, status: res.status || res.error, from: item.from });
      return;
    }
    const servedHtml = isHtmlType(res.contentType);
    const expectsFile = /\.[a-z0-9]{2,5}$/i.test(new URL(item.url).pathname) && !/\.html?$/i.test(new URL(item.url).pathname);
    if (item.kind !== 'page' && servedHtml && expectsFile) {
      // SPA fallbacks answer unknown files with index.html and status 200.
      if (item.kind === 'guess') guessMisses++;
      else errors.push({ url: item.url, status: 'html instead of file', from: item.from });
      return;
    }
    if (item.kind === 'page' && servedHtml && !mapper.isSameSite(res.url)) {
      skipped.offSite.push(item.url);
      return;
    }
    const resource = store(item.url, res);
    if (resource) processResource(resource, item);
  };

  // Seeds: the start page, then sitemap URLs.
  queue.push({ url: keyFor(startUrl), kind: 'page', from: null });
  queued.add(keyFor(stripTracking(startUrl)));
  pageCount = 1;
  if (options.sitemap) {
    const sitemapUrls = robots.sitemaps.length ? [...robots.sitemaps] : [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`];
    const seen = new Set();
    let budget = 50;
    while (sitemapUrls.length && budget-- > 0) {
      const sm = sitemapUrls.shift();
      if (seen.has(sm)) continue;
      seen.add(sm);
      const r = await fetcher.get(sm, 'application/xml,text/xml,*/*');
      if (!r.ok || isHtmlType(r.contentType)) continue;
      let sitemap;
      try {
        sitemap = parseSitemap(maybeGunzip(r.body, fetcher.maxBytes).toString('utf8'));
      } catch (err) {
        // An oversized, truncated or corrupt sitemap costs its own entries, never the whole run.
        errors.push({ url: sm, status: `unreadable sitemap: ${err.message}`, from: null });
        continue;
      }
      const { isIndex, locs } = sitemap;
      for (const loc of locs) {
        const u = resolveUrl(loc, sm);
        if (!u) continue;
        if (isIndex) sitemapUrls.push(u.href);
        else if (mapper.isSameSite(u.href)) {
          sitemapPages.add(keyFor(stripTracking(u.href)));
          enqueuePage(u, sm);
        } else sitemapExternal.add(u.href);
      }
    }
  }

  // Crawl with a worker pool; workers keep pulling until the queue stays empty.
  let active = 0;
  let done = 0;
  await new Promise((resolve) => {
    const pump = () => {
      while (active < options.concurrency && queue.length) {
        const item = queue.shift();
        active++;
        work(item)
          .catch((err) => errors.push({ url: item.url, status: err.message, from: item.from }))
          .finally(() => {
            active--;
            done++;
            if (done % 50 === 0) progress(`… ${done} requests, ${resources.size} files, ${pageCount} pages queued`);
            pump();
          });
      }
      if (!active && !queue.length) resolve();
    };
    pump();
  });

  // ─────────── rewrite ───────────
  const lookup = (u) => {
    for (const key of [keyFor(stripTracking(u.href)), keyFor(u.href)]) {
      const k = aliases.get(key) || key;
      if (resources.has(k)) return resources.get(k);
    }
    return null;
  };
  const filePath = (r) => path.join(root, ...r.localPath.split('/'));

  let cacheBustersDropped = 0;
  for (const r of resources.values()) {
    if (new URL(r.url).search && !r.localPath.includes('__q')) cacheBustersDropped++;
  }

  // Same-site resources the copy still loads from the live site (skipped, failed or only
  // referenced in places the crawler does not read). compare-site blocks the live hosts for
  // the backup, so these show up there as differences.
  const onlineOnly = new Set();
  const rewriteRefs = (resource, text, refs, base) => {
    const replacements = [];
    for (const ref of refs) {
      if (ref.kind === 'form') continue;
      const u = resolveUrl(ref.value, base);
      if (!u) continue;
      const target = lookup(u);
      let replacement = null;
      if (!target && ref.kind !== 'page' && mapper.isSameSite(u.href)) onlineOnly.add(keyFor(u.href));
      if (target) replacement = relativeHref(resource.localPath, target.localPath, u.hash);
      else if (/^\/\//.test(ref.value.trim())) replacement = u.href;
      else if (mapper.isSameSite(u.href) && !/^https?:/i.test(ref.value.trim())) replacement = u.href;
      if (replacement === null) continue;
      if (ref.escaped) replacement = replacement.replace(/\//g, '\\/');
      replacements.push({ start: ref.start, end: ref.end, text: replacement });
    }
    return applyReplacements(text, replacements);
  };

  for (const r of resources.values()) {
    if (!['html', 'css', 'svg', 'manifest', 'js'].includes(r.kind)) continue;
    const file = filePath(r);
    const text = readFileSync(file).toString(r.charset || 'utf8');
    let out = text;
    if (r.kind === 'html') {
      const doc = extractHtml(text);
      const base = doc.base ? resolveUrl(doc.base, r.url)?.href || r.url : r.url;
      out = rewriteRefs(r, text, doc.refs, base);
      out = out.replace(/<base\b[^>]*>/gi, '');
      out = stripLocalSri(out);
    } else if (r.kind === 'css') out = rewriteRefs(r, text, extractCss(text), r.url);
    else if (r.kind === 'svg') out = rewriteRefs(r, text, extractHtml(text).refs.filter((x) => x.kind !== 'page'), r.url);
    else if (r.kind === 'manifest') out = rewriteRefs(r, text, extractManifest(text), r.url);
    else if (r.kind === 'js') {
      // Only module specifiers that point at the site root or an absolute URL: esbuild
      // and file:// cannot follow `/assets/x.js`, relative ones already work.
      const refs = extractJs(text).filter((x) => x.kind === 'module' && /^(\/[^/]|https?:)/.test(x.value));
      out = rewriteRefs(r, text, refs, r.url);
    }
    if (out !== text) writeFileSync(file, Buffer.from(out, r.charset || 'utf8'));
  }

  // ─────────── bundle ES modules for file:// ───────────
  const bundled = [];
  const bundleFailures = [];
  const htmlResources = [...resources.values()].filter((r) => r.kind === 'html');
  const moduleUse = htmlResources.some((r) => /type\s*=\s*["']?module/i.test(readFileSync(filePath(r), 'latin1')));
  let bundlingRan = false;
  if (options.bundle && moduleUse) {
    if (!esbuildAvailable()) {
      bundleFailures.push({ entry: '*', error: `esbuild@${ESBUILD_VERSION} not available via npx (offline?)` });
    } else {
      bundlingRan = true;
      const shimDir = path.join(os.tmpdir(), `lt-mirror-${process.pid}`);
      mkdirSync(shimDir, { recursive: true });
      const shim = path.join(shimDir, 'import-meta-url.js');
      const metafile = path.join(shimDir, 'meta.json');
      writeFileSync(shim, 'export const __ltMetaUrl = (document.currentScript && document.currentScript.src) || location.href;\n');
      const esbuildCommon = ['--bundle', '--format=iife', '--log-level=error', '--define:import.meta.url=__ltMetaUrl', `--inject:${shim}`, `--metafile=${metafile}`, '--tsconfig-raw={}'];
      const shimReal = realPath(shim);
      // esbuild resolves relative imports on the real disk: `import "../../../x.json"` that the
      // web server clamps to /x.json would read a file next to the output folder and embed it.
      // Every input esbuild used must therefore lie inside the backup.
      const outsideInputs = (cwd) => {
        const meta = JSON.parse(readFileSync(metafile, 'utf8'));
        return Object.keys(meta.inputs)
          .filter((k) => !/^<.*>$/.test(k) && !k.startsWith('('))
          .map((k) => path.resolve(cwd, k))
          .filter((abs) => realPath(abs) !== shimReal && !isInside(root, abs));
      };
      const refuse = (output, cwd, outside) => {
        rmSync(output, { force: true });
        // esbuild writes one output per content type: a CSS import yields <entry>.offline.css
        // next to the JS, and it carries the refused file's content just the same.
        try {
          const meta = JSON.parse(readFileSync(metafile, 'utf8'));
          for (const o of Object.keys(meta.outputs || {})) {
            const abs = path.resolve(cwd, o);
            if (isInside(root, abs)) rmSync(abs, { force: true });
          }
        } catch {
          // No readable metafile: esbuild wrote nothing beyond the output removed above.
        }
        return { ok: false, stderr: `refused: bundle would read files outside the backup folder (${outside.slice(0, 3).map((x) => path.relative(cwd, x).split(path.sep).join('/')).join(', ')})` };
      };
      const rel = (abs) => path.relative(root, abs).split(path.sep).join('/');
      const entryOutputs = new Map(); // absolute entry file → output file or null
      const inlineDone = new Set();
      for (const r of htmlResources) {
        const file = filePath(r);
        let html = readFileSync(file).toString(r.charset || 'utf8');
        const doc = extractHtml(html);
        const replacements = [];
        for (const ms of doc.moduleScripts) {
          if (/^(https?:)?\/\//i.test(ms.value)) continue;
          let src = ms.value.split(/[?#]/)[0];
          try {
            src = decodeURIComponent(src);
          } catch {}
          const entry = path.resolve(path.dirname(file), src);
          if (!entryOutputs.has(entry)) {
            let res;
            const output = entry.replace(/\.m?js$/i, '') + '.offline.js';
            if (!isInside(root, entry)) res = { ok: false, stderr: 'refused: module entry outside the backup folder' };
            else if (!existsSync(entry)) res = { ok: false, stderr: 'entry file missing' };
            else {
              rmSync(metafile, { force: true });
              res = runEsbuild([entry, ...esbuildCommon, `--outfile=${output}`], { cwd: root });
              if (res.ok) {
                const outside = outsideInputs(root);
                if (outside.length) res = refuse(output, root, outside);
              }
            }
            entryOutputs.set(entry, res.ok ? output : null);
            if (res.ok) bundled.push({ entry: rel(entry), output: rel(output) });
            else bundleFailures.push({ entry: isInside(root, entry) ? rel(entry) : ms.value, error: res.stderr.trim().slice(0, 400) });
          }
          const output = entryOutputs.get(entry);
          if (!output) continue;
          const tag = html.slice(ms.tagStart, ms.tagEnd);
          replacements.push({ start: ms.tagStart, end: ms.tagEnd, text: classicScriptTag(tag, relativeHref(r.localPath, rel(output))) });
        }
        for (const im of doc.inlineModules) {
          const code = html.slice(im.contentStart, im.contentEnd);
          const hash = createHash('sha1').update(code).digest('hex').slice(0, 10);
          const outRel = `_offline/inline-${hash}.js`;
          const outAbs = path.join(root, '_offline', `inline-${hash}.js`);
          const cwd = path.dirname(file);
          if (!inlineDone.has(outAbs)) {
            mkdirSync(path.dirname(outAbs), { recursive: true });
            rmSync(metafile, { force: true });
            let res = runEsbuild([...esbuildCommon, `--outfile=${outAbs}`], { cwd, input: code });
            if (res.ok) {
              const outside = outsideInputs(cwd);
              if (outside.length) res = refuse(outAbs, cwd, outside);
            }
            if (!res.ok) {
              bundleFailures.push({ entry: `${r.localPath} (inline module)`, error: res.stderr.trim().slice(0, 400) });
              continue;
            }
            inlineDone.add(outAbs);
            bundled.push({ entry: `${r.localPath} (inline module)`, output: outRel });
          }
          replacements.push({ start: im.start, end: im.end, text: `<script defer src="${relativeHref(r.localPath, outRel)}"></script>` });
        }
        if (replacements.length) html = applyReplacements(html, replacements);
        html = html.replace(/<link\b[^>]*\brel\s*=\s*["']?modulepreload["']?[^>]*>/gi, '');
        writeFileSync(file, Buffer.from(html, r.charset || 'utf8'));
      }
      rmSync(shimDir, { recursive: true, force: true });
    }
  }

  // ─────────── verify ───────────
  const missing = [];
  for (const r of resources.values()) {
    if (!['html', 'css', 'svg'].includes(r.kind)) continue;
    const file = filePath(r);
    const text = readFileSync(file).toString(r.charset || 'utf8');
    const refs = r.kind === 'css' ? extractCss(text) : extractHtml(text).refs;
    for (const ref of refs) {
      if (ref.kind === 'form' || ref.kind === 'guess') continue;
      const v = decodeEntities(ref.value.trim());
      if (!v || SKIP_SCHEME.test(v) || /^([a-z][a-z0-9+.-]*:|\/\/)/i.test(v)) continue;
      let rel = v.split(/[?#]/)[0];
      try {
        rel = decodeURIComponent(rel);
      } catch {}
      if (!rel) continue;
      const target = rel.startsWith('/') ? path.join(root, rel) : path.resolve(path.dirname(file), rel);
      if (!existsSync(target)) missing.push({ file: r.localPath, ref: v });
    }
  }

  // ─────────── report ───────────
  const pages = htmlResources
    .filter((r) => r.sameSite)
    .map((r) => ({ url: r.url, file: r.localPath, inSitemap: sitemapPages.has(keyFor(stripTracking(r.url))) }))
    .sort((a, b) => a.file.localeCompare(b.file));
  const totalBytes = [...resources.values()].reduce((s, r) => s + r.bytes, 0) + bundled.reduce((s, b) => {
    try {
      return s + statSync(path.join(root, b.output)).size;
    } catch {
      return s;
    }
  }, 0);

  const errorUrls = new Set(errors.map((e) => keyFor(e.url)));
  const report = {
    tool: 'lt-tools mirror-site',
    source: startUrl,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    outDir,
    root,
    options: {
      maxPages: options.maxPages,
      concurrency: options.concurrency,
      delay: options.delay,
      externalAssets: !!options.externalAssets,
      sitemap: !!options.sitemap,
      ignoreRobots: !!options.ignoreRobots,
      bundle: !!options.bundle,
    },
    pages,
    files: resources.size + bundled.length,
    bytes: totalBytes,
    cacheBustersDropped,
    bundled,
    bundleFailures,
    modulesNeedServer: moduleUse && (!options.bundle || !bundlingRan || bundleFailures.length > 0),
    missing,
    errors,
    blocked: fetcher.blocked,
    onlineOnly: [...onlineOnly].filter((u) => !errorUrls.has(u)).sort(),
    skipped,
    guessMisses,
    external,
    sitemapExternalLinks: [...sitemapExternal],
    forms: dedupeForms(forms, mapper),
  };

  writeFileSync(path.join(outDir, 'mirror-report.json'), JSON.stringify(report, null, 2));
  writeFileSync(path.join(outDir, 'mirror.log'), logLines.join('\n') + '\n');
  writeFileSync(path.join(outDir, 'README.md'), renderReadme(report));

  if (options.zip) {
    const zipPath = `${outDir}.zip`;
    try {
      const { files, bytes } = zipDirectory(outDir, zipPath, { limit: options.zipLimit });
      const check = verifyZip(zipPath);
      report.zip = { path: zipPath, files, bytes, verified: check.entries === files && check.ok };
    } catch (err) {
      // A failed archive never leaves a partial file and never fails the mirror itself.
      rmSync(zipPath, { force: true });
      report.zip = { path: zipPath, error: err.message };
    }
    writeFileSync(path.join(outDir, 'mirror-report.json'), JSON.stringify(report, null, 2));
  }
  return report;
}

/** Turns `<script type="module" src="x.js">` into `<script defer src="x.offline.js">`. */
export function classicScriptTag(tag, newSrc) {
  let t = tag
    .replace(/\s(type|crossorigin|integrity|nomodule)(\s*=\s*("[^"]*"|'[^']*'|[^\s>]+))?/gi, '')
    .replace(/\ssrc\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i, ` src="${newSrc}"`);
  if (!/\s(defer|async)\b/i.test(t)) t = t.replace(/^<script/i, '<script defer');
  return t;
}

/** Drops SRI and crossorigin on script/link tags that now load local files. */
export function stripLocalSri(html) {
  return html.replace(/<(script|link)\b[^>]*>/gi, (tag) => {
    const ref = /\s(?:src|href)\s*=\s*["']?([^"'\s>]+)/i.exec(tag)?.[1] || '';
    if (/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(ref)) return tag;
    return tag.replace(/\s(integrity|crossorigin)(\s*=\s*("[^"]*"|'[^']*'|[^\s>]+))?/gi, '');
  });
}

function dedupeForms(forms, mapper) {
  const seen = new Map();
  for (const f of forms) {
    const key = `${f.page}|${f.action}`;
    if (!seen.has(key)) seen.set(key, { ...f, sameSite: mapper.isSameSite(f.action || f.page) });
  }
  return [...seen.values()];
}

function renderReadme(report) {
  const hosts = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1]).map(([h]) => h);
  const requisiteHosts = hosts(report.external.requisites);
  const formPages = [...new Set(report.forms.map((f) => new URL(f.page).pathname))];
  const firstPage = report.pages.find((p) => new URL(p.url).pathname === new URL(report.source).pathname) || report.pages[0];
  const lines = [
    `# Website backup: ${report.source}`,
    '',
    `Saved on ${report.finishedAt.slice(0, 10)} with lt-tools mirror-site: ${report.pages.length} pages, ${report.files} files, ${formatBytes(report.bytes)}.`,
    '',
    '## Opening it',
    '',
    report.modulesNeedServer
      ? `This site uses JavaScript modules that could not be bundled, so open it through a local web server:\n\n\`\`\`bash\nnpx --yes http-server@14.1.1 "${path.basename(report.root)}" -p 8080\n# or: python3 -m http.server 8080 --directory "${path.basename(report.root)}"\n# then open http://localhost:8080/\n\`\`\``
      : `Double-click \`${path.basename(report.root)}/${firstPage ? firstPage.file : 'index.html'}\`. No web server is needed.`,
    '',
    '## Pages',
    '',
    ...report.pages.map((p) => `- \`${p.file}\` ← ${p.url}${p.inSitemap ? '' : ' (found via links, not in the sitemap)'}`),
    '',
    '## Changes compared to the live site',
    '',
    '- Links point to relative local paths; pages end in `.html`.',
    `- Cache-buster query strings were dropped from ${report.cacheBustersDropped} file names, so every file keeps its real extension.`,
    '- `<base>`, SRI `integrity` and `crossorigin` attributes on local files were removed (they block loading from `file://`).',
  ];
  if (report.bundled.length) {
    lines.push(
      `- ES module scripts are bundled into classic scripts (\`*.offline.js\`, esbuild ${ESBUILD_VERSION}) because browsers refuse modules on \`file://\`. The original module files are kept next to them.`,
    );
  }
  lines.push('', '## Not included / not working offline', '');
  lines.push('- This is the rendered output only: no CMS database, backend, server-side code or files no page links to.');
  if (formPages.length) lines.push(`- Forms cannot be submitted offline (they post to the server): ${formPages.map((p) => `\`${p}\``).join(', ')}.`);
  if (requisiteHosts.length) lines.push(`- Loaded from the internet, not part of the backup: ${requisiteHosts.join(', ')}.`);
  if (report.onlineOnly.length) lines.push(`- ${report.onlineOnly.length} files of the site itself are not in the backup and load from the live site (see \`mirror-report.json\` → onlineOnly).`);
  if (report.blocked.length) lines.push(`- ${report.blocked.length} requests to private network addresses were refused (see \`mirror-report.json\` → blocked).`);
  if (report.errors.length) lines.push(`- ${report.errors.length} references could not be downloaded (see \`mirror-report.json\` → errors). A 4xx is missing on the live site as well; a timeout, dropped connection, 429 or 5xx failed during this crawl, still loads from the live site, and a new mirror with \`--force\` usually gets it.`);
  if (report.missing.length) lines.push(`- ${report.missing.length} local references point to files that are missing (see \`mirror-report.json\` → missing).`);
  lines.push('', 'Details: `mirror-report.json`. Request log: `mirror.log`.', '');
  return lines.join('\n');
}

function printSummary(report) {
  const sitemapCount = report.pages.filter((p) => p.inSitemap).length;
  const skippedTotal = Object.values(report.skipped).reduce((s, l) => s + l.length, 0);
  const hosts = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1]).map(([h, n]) => `${h} (${n})`).join(', ') || '-';
  const formPages = [...new Set(report.forms.map((f) => new URL(f.page).pathname))];
  const out = [
    `mirror-site: ${report.source} → ${report.outDir}`,
    `pages        ${report.pages.length} (sitemap ${sitemapCount}, links only ${report.pages.length - sitemapCount}) | skipped ${skippedTotal} (robots ${report.skipped.robots.length}, filter ${report.skipped.filter.length}, limit ${report.skipped.limit.length}, too large ${report.skipped.tooLarge.length}, too slow ${report.skipped.tooSlow.length})`,
    `files        ${report.files} | ${formatBytes(report.bytes)} | not downloaded ${report.errors.length}`,
    `js modules   ${report.bundled.length ? `${report.bundled.length} bundled for file://` : 'none bundled'}${report.bundleFailures.length ? ` | FAILED ${report.bundleFailures.length}: ${report.bundleFailures.map((f) => f.entry).join(', ')}` : ''}${report.modulesNeedServer ? ' | backup needs a local web server' : ''}`,
    `renamed      ${report.cacheBustersDropped} cache-buster query strings dropped from file names`,
    `missing refs ${report.missing.length}${report.missing.length ? ': ' + report.missing.slice(0, 5).map((m) => `${m.file} → ${m.ref}`).join(' | ') : ''}`,
    `external     loaded online: ${hosts(report.external.requisites)}`,
    `links out    ${hosts(report.external.links)}`,
    `forms        ${formPages.length ? `${formPages.length} pages post to a server (not submittable offline): ${formPages.join(', ')}` : 'none'}`,
    `report       ${path.join(report.outDir, 'mirror-report.json')}`,
  ];
  if (report.errors.length) out.push(`errors       ${report.errors.slice(0, 5).map((e) => `${e.status} ${e.url}`).join(' | ')}`);
  if (report.onlineOnly.length) out.push(`online only  ${report.onlineOnly.length} same-site resources still load from the live site: ${report.onlineOnly.slice(0, 3).join(' | ')}`);
  if (report.blocked.length) out.push(`blocked      ${report.blocked.length} requests to private addresses refused: ${report.blocked.slice(0, 3).map((b) => b.at).join(' | ')}`);
  if (report.zip?.error) out.push(`zip          FAILED, no archive written: ${report.zip.error}`);
  else if (report.zip) out.push(`zip          ${report.zip.path} (${formatBytes(report.zip.bytes)}, ${report.zip.files} files, ${report.zip.verified ? 'verified' : 'VERIFY FAILED'})`);
  process.stdout.write(out.join('\n') + '\n');
}

async function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2), {
      booleans: ['external-assets', 'sitemap', 'ignore-robots', 'bundle', 'zip', 'force', 'quiet', 'help', 'allow-private-hosts'],
      multi: ['include', 'exclude'],
    });
  } catch (err) {
    process.stderr.write(`${err.message}\n\n${USAGE}`);
    process.exit(2);
  }
  const { options: o, positional } = parsed;
  if (o.help || !positional[0]) {
    process.stdout.write(USAGE);
    process.exit(o.help ? 0 : 2);
  }
  let url = positional[0];
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  const options = {
    url,
    out: o.out,
    maxPages: toInt(o.maxPages, 500),
    concurrency: Math.max(1, toInt(o.concurrency, 4)),
    delay: toInt(o.delay, 150),
    timeout: toInt(o.timeout, 30000),
    maxTime: toInt(o.maxTime, 300000),
    maxFileMb: toInt(o.maxFileMb, 200),
    include: o.include,
    exclude: o.exclude,
    externalAssets: !!o.externalAssets,
    sitemap: o.sitemap !== false,
    ignoreRobots: !!o.ignoreRobots,
    bundle: o.bundle !== false,
    zip: !!o.zip,
    force: !!o.force,
    quiet: !!o.quiet,
    allowPrivateHosts: !!o.allowPrivateHosts,
    userAgent: o.userAgent || 'Mozilla/5.0 (compatible; lt-tools-mirror/1.0; website backup)',
  };
  try {
    const report = await mirrorSite(options);
    printSummary(report);
    process.exit(report.missing.length || report.bundleFailures.length ? 1 : 0);
  } catch (err) {
    process.stderr.write(`mirror-site: ${err.message}\n`);
    process.exit(2);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
