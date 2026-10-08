#!/usr/bin/env node
// compare-site.mjs — compares a mirror (opened via file://) with the live site in headless Chrome.
//
// For every page and viewport it loads the original and the backup side by side, each in
// a fresh browser context, and compares:
//   • content: title, headings, visible text, images (and broken ones), background images,
//     loaded web fonts, computed styles of every element, page height;
//   • widgets: slider initialisation, Bootstrap/ARIA toggles, forms (validation set up?),
//     iframes, videos;
//   • behaviour: one disclosure/accordion, tabs, tooltip, slider autoplay and "next",
//     video playback, mobile menu (mobile viewport), horizontal overflow;
//   • problems: console errors, exceptions and failed requests that only the backup has.
//
// The backup is opened exactly like a double-click (no --allow-file-access-from-files),
// so module scripts blocked on file:// show up as differences. Forms are never submitted.
//
// Usage: node compare-site.mjs <mirror-dir> [options]   (see USAGE below)

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs, toInt } from './lib/args.mjs';
import { launchChrome, openPage } from './lib/cdp.mjs';
import { fingerprint, interact } from './lib/page-probe.mjs';

const USAGE = `Usage: node compare-site.mjs <mirror-dir> [options]

<mirror-dir> is the folder mirror-site.mjs wrote (it contains mirror-report.json).

Options:
  --original <url>       live base URL (default: source in mirror-report.json)
  --pages <list>         comma-separated paths to compare, e.g. /,/team/ (default: all pages)
  --viewports <list>     desktop,mobile (default: both)
  --no-interactions      only compare what the pages show
  --concurrency <n>      pages compared in parallel (default 2)
  --ignore <selector>    extra CSS selector to leave out (repeatable)
  --screenshots <dir>    save a viewport screenshot of original and backup per page
  --json <file>          write the full result
  --chrome <path>        Chrome/Chromium binary (default: auto-detect, or CHROME_PATH)
  --page-timeout <ms>    give up on a page that does not load (default 30000)
  --quiet                no progress lines on stderr
`;

export const VIEWPORTS = {
  desktop: { width: 1440, height: 900, mobile: false },
  mobile: { width: 390, height: 844, mobile: true, deviceScaleFactor: 2 },
};

// Consent banners differ per load and are third-party; leave them out by default.
export const DEFAULT_IGNORE = [
  '[id*="cookie" i]',
  '[class*="cookie" i]',
  '[id*="consent" i]',
  '[class*="consent" i]',
  '[id^="ccm" i]',
  '[class^="ccm" i]',
  '#CybotCookiebotDialog',
  '#usercentrics-root',
  '.cmplz-cookiebanner',
  '#onetrust-consent-sdk',
];

const VOLATILE = new Set(['scrollHeight', 'headerScrolled', 'styles', 'interactions']);

function sameJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function normalizeIssue(issue) {
  const text = `${issue.type}: ${issue.text || ''}`
    .replace(/(file|https?):\/\/[^\s'")]+/g, (u) => {
      const name = u.split(/[?#]/)[0].split('/').filter(Boolean).pop() || u;
      return name.replace(/__[qu][0-9a-f]{8}(?=\.|$)/, '').replace(/\.offline\.js$/, '.js');
    })
    .replace(/\s+/g, ' ')
    .trim();
  const url = issue.url ? normalizeIssue({ type: '', text: issue.url }).replace(/^: /, '') : '';
  return url && !text.includes(url) ? `${text} (${url})` : text;
}

function fileKey(url) {
  return (url.split(/[?#]/)[0].split('/').filter(Boolean).pop() || url).replace(/__[qu][0-9a-f]{8}(?=\.|$)/, '');
}

function lineDiff(a, b, limit = 6) {
  const setA = new Set(a.split('\n'));
  const setB = new Set(b.split('\n'));
  const onlyA = a.split('\n').filter((l) => !setB.has(l));
  const onlyB = b.split('\n').filter((l) => !setA.has(l));
  return { onlyOriginal: onlyA.slice(0, limit), onlyBackup: onlyB.slice(0, limit), counts: [onlyA.length, onlyB.length] };
}

/** Differences between two probe results; returns [{ key, detail }]. */
export function diffProbes(o, b) {
  const diffs = [];
  const fo = o.fingerprint;
  const fb = b.fingerprint;
  const add = (key, detail) => diffs.push({ key, detail });

  if (fo.title !== fb.title) add('title', { original: fo.title, backup: fb.title });
  if (!sameJson(fo.headings, fb.headings)) add('headings', { original: fo.headings.slice(0, 8), backup: fb.headings.slice(0, 8) });
  if (fo.textHash !== fb.textHash) add('text', lineDiff(fo.text, fb.text));
  const brokenOnlyBackup = fb.images.broken.filter((x) => !fo.images.broken.includes(x));
  if (fo.images.total !== fb.images.total || brokenOnlyBackup.length) {
    add('images', { total: [fo.images.total, fb.images.total], brokenInBackup: brokenOnlyBackup });
  }
  const missingFiles = fo.images.files.filter((x) => !fb.images.files.includes(x));
  if (missingFiles.length) add('imageFiles', { notShownInBackup: missingFiles.slice(0, 10) });
  const bgMissing = fo.backgroundImages.filter((x) => !fb.backgroundImages.includes(x));
  if (bgMissing.length) add('backgroundImages', { notInBackup: bgMissing.slice(0, 10) });
  const fontsMissing = fo.fonts.filter((x) => !fb.fonts.includes(x));
  if (fontsMissing.length) add('fonts', { notLoadedInBackup: fontsMissing });
  if (Math.abs(fo.scrollHeight - fb.scrollHeight) > 3) add('scrollHeight', { original: fo.scrollHeight, backup: fb.scrollHeight });
  if (fo.styles.length !== fb.styles.length) {
    add('styles', { elements: [fo.styles.length, fb.styles.length], firstOnlyInBackup: fb.styles.filter((s) => !fo.styles.includes(s)).slice(0, 6) });
  } else {
    const changed = [];
    for (let i = 0; i < fo.styles.length; i++) if (fo.styles[i] !== fb.styles[i]) changed.push({ original: fo.styles[i], backup: fb.styles[i] });
    if (changed.length) add('styles', { changedElements: changed.length, first: changed.slice(0, 6) });
  }
  for (const key of ['sliders', 'toggles', 'forms', 'iframes', 'videos', 'headerTop', 'headerScrolled']) {
    if (!sameJson(fo[key], fb[key])) add(key, { original: fo[key], backup: fb[key] });
  }
  if (o.interactions || b.interactions) {
    const io = o.interactions || {};
    const ib = b.interactions || {};
    for (const key of new Set([...Object.keys(io), ...Object.keys(ib)])) {
      if (!sameJson(io[key], ib[key])) add('interactions', { feature: key, original: io[key], backup: ib[key] });
    }
  }
  // A live URL that fails in both is the same failure, even when Chrome words it differently
  // from file:// (e.g. ERR_BLOCKED_BY_ORB instead of HTTP 404).
  const originalIssues = new Set(o.issues.map(normalizeIssue));
  const failedLive = new Set(o.issues.filter((i) => i.url).map((i) => fileKey(i.url)));
  const backupOnly = [
    ...new Set(b.issues.filter((i) => !(i.url && /^https?:/i.test(i.url) && failedLive.has(fileKey(i.url)))).map(normalizeIssue)),
  ].filter((x) => !originalIssues.has(x));
  if (backupOnly.length) add('errors', { onlyInBackup: backupOnly.slice(0, 10), count: backupOnly.length });
  return diffs;
}

async function probe(conn, url, viewport, opts, blockedUrls = []) {
  const page = await openPage(conn, { ...viewport, blockedUrls });
  try {
    await page.goto(url, { timeout: opts.pageTimeout });
    const fp = await page.evaluate(fingerprint.toString(), { ignore: opts.ignore, settle: opts.settle });
    let shot = null;
    if (opts.screenshots) shot = await page.screenshot();
    const interactions = opts.interactions ? await page.evaluate(interact.toString(), { ignore: opts.ignore, mobile: viewport.mobile }) : null;
    return { url, fingerprint: fp, interactions, issues: [...page.issues], screenshot: shot };
  } finally {
    await page.dispose();
  }
}

function slugFor(pagePath) {
  return pagePath.replace(/^\/|\/$/g, '').replace(/[^\w.-]+/g, '_') || 'home';
}

export async function compareSite(options) {
  const reportFile = path.join(options.mirrorDir, 'mirror-report.json');
  if (!existsSync(reportFile)) throw new Error(`No mirror-report.json in ${options.mirrorDir}`);
  const report = JSON.parse(readFileSync(reportFile, 'utf8'));
  const root = existsSync(report.root) ? report.root : path.join(options.mirrorDir, path.basename(report.root));
  const originalBase = options.original || report.source;
  let pages = report.pages.map((p) => {
    const live = new URL(p.url);
    const original = new URL(live.pathname + live.search, originalBase).href;
    return { path: live.pathname + live.search, original, backup: pathToFileURL(path.join(root, ...p.file.split('/'))).href };
  });
  if (options.pages) {
    const wanted = new Set(options.pages.map((p) => p.trim()).filter(Boolean));
    pages = pages.filter((p) => wanted.has(p.path) || wanted.has(new URL(p.original).pathname));
    if (!pages.length) throw new Error(`None of --pages found in the mirror: ${options.pages.join(', ')}`);
  }
  const viewports = options.viewports.map((v) => {
    if (!VIEWPORTS[v]) throw new Error(`Unknown viewport: ${v}`);
    return [v, VIEWPORTS[v]];
  });
  const ignore = [...DEFAULT_IGNORE, ...(options.ignore || [])].join(', ');
  const probeOpts = { ignore, interactions: options.interactions, screenshots: !!options.screenshots, settle: options.settle, pageTimeout: options.pageTimeout ?? 30000 };
  // The backup must work without the live site: block the site's hosts (and --original's)
  // while it is loaded, so a copy that quietly fetches from the original shows up as broken.
  const liveHosts = new Set([new URL(report.source).hostname, new URL(originalBase).hostname]);
  for (const h of [...liveHosts]) liveHosts.add(h.startsWith('www.') ? h.slice(4) : `www.${h}`);
  const blockedUrls = [...liveHosts].flatMap((h) => [`http://${h}/*`, `https://${h}/*`, `http://${h}:*`, `https://${h}:*`]);
  if (options.screenshots) mkdirSync(options.screenshots, { recursive: true });

  const { conn, close, binary } = await launchChrome({ chromePath: options.chrome });
  const results = [];
  const tasks = [];
  for (const page of pages) for (const [name, vp] of viewports) tasks.push({ page, name, vp });
  const say = options.quiet ? () => {} : (m) => process.stderr.write(`${m}\n`);
  try {
    let next = 0;
    const worker = async () => {
      while (next < tasks.length) {
        const task = tasks[next++];
        const run = () => Promise.all([probe(conn, task.page.original, task.vp, probeOpts), probe(conn, task.page.backup, task.vp, probeOpts, blockedUrls)]);
        let o;
        let b;
        let diffs;
        try {
          [o, b] = await run();
          diffs = diffProbes(o, b);
          if (diffs.length && diffs.every((d) => VOLATILE.has(d.key))) {
            [o, b] = await run();
            diffs = diffProbes(o, b);
          }
        } catch (err) {
          results.push({ path: task.page.path, viewport: task.name, error: err.message, diffs: [] });
          say(`! ${task.page.path} ${task.name}: ${err.message}`);
          continue;
        }
        if (options.screenshots) {
          const base = path.join(options.screenshots, `${slugFor(task.page.path)}-${task.name}`);
          writeFileSync(`${base}-original.png`, o.screenshot);
          writeFileSync(`${base}-backup.png`, b.screenshot);
        }
        results.push({
          path: task.page.path,
          viewport: task.name,
          original: task.page.original,
          backup: task.page.backup,
          diffs,
          interactions: { original: o.interactions, backup: b.interactions },
          originalIssues: o.issues.length,
        });
        say(`${diffs.length ? '✗' : '✓'} ${task.page.path} ${task.name}${diffs.length ? `: ${diffs.map((d) => d.key).join(', ')}` : ''}`);
      }
    };
    await Promise.all(Array.from({ length: Math.max(1, options.concurrency) }, worker));
  } finally {
    await close();
  }
  results.sort((a, b) => a.path.localeCompare(b.path) || a.viewport.localeCompare(b.viewport));
  return { originalBase, browser: binary, pages: pages.length, viewports: viewports.map(([n]) => n), results };
}

function printReport(res) {
  const failed = res.results.filter((r) => r.error || r.diffs.length);
  const out = [];
  for (const r of res.results) {
    if (r.error) {
      out.push(`! ${r.path} [${r.viewport}] could not be compared: ${r.error}`);
      continue;
    }
    if (!r.diffs.length) {
      out.push(`✓ ${r.path} [${r.viewport}] identical`);
      continue;
    }
    out.push(`✗ ${r.path} [${r.viewport}] ${r.diffs.map((d) => d.key).join(', ')}`);
    for (const d of r.diffs) out.push(`    ${d.key}: ${JSON.stringify(d.detail).slice(0, 600)}`);
  }
  const features = new Set();
  for (const r of res.results) {
    const i = r.interactions?.original || {};
    if (i.disclosure) features.add('accordion/collapse');
    if (i.tab) features.add('tabs');
    if (i.tooltip) features.add('tooltip');
    if (i.sliders?.length) features.add('sliders');
    if (i.video) features.add('video');
    if (i.menu && i.menu.toggler !== false) features.add('mobile menu');
  }
  out.push(
    `compare-site: ${res.pages} pages × ${res.viewports.join('+')} → ${res.results.length - failed.length} identical, ${failed.length} different` +
      (features.size ? ` | exercised: ${[...features].join(', ')}` : ''),
  );
  process.stdout.write(out.join('\n') + '\n');
  return failed.length;
}

async function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2), { booleans: ['interactions', 'quiet', 'help'], multi: ['ignore'] });
  } catch (err) {
    process.stderr.write(`${err.message}\n\n${USAGE}`);
    process.exit(2);
  }
  const { options: o, positional } = parsed;
  if (o.help || !positional[0]) {
    process.stdout.write(USAGE);
    process.exit(o.help ? 0 : 2);
  }
  const options = {
    mirrorDir: path.resolve(positional[0]),
    original: o.original,
    pages: o.pages ? o.pages.split(',') : null,
    viewports: (o.viewports || 'desktop,mobile').split(',').map((v) => v.trim()),
    interactions: o.interactions !== false,
    concurrency: toInt(o.concurrency, 2),
    ignore: o.ignore,
    screenshots: o.screenshots ? path.resolve(o.screenshots) : null,
    json: o.json ? path.resolve(o.json) : null,
    chrome: o.chrome,
    quiet: !!o.quiet,
    settle: toInt(o.settle, 1500),
    pageTimeout: toInt(o.pageTimeout, 30000),
  };
  try {
    const res = await compareSite(options);
    if (options.json) writeFileSync(options.json, JSON.stringify(res, (k, v) => (k === 'screenshot' ? undefined : v), 2));
    const failed = printReport(res);
    process.exit(failed ? 1 : 0);
  } catch (err) {
    process.stderr.write(`compare-site: ${err.message}\n`);
    process.exit(2);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
