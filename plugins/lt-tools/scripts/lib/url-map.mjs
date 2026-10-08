// url-map.mjs — maps live URLs to file paths inside a website mirror.
//
// The mapping decides three things that make a mirror work from file://:
//   • pages always end in .html (directory URLs become <dir>/index.html), so a
//     double-click opens them and relative links resolve;
//   • asset names keep a real extension (added from the Content-Type when the
//     URL has none), because Chrome picks the MIME type from the extension on
//     file:// — `logo.svg?123` saved verbatim renders as an empty image;
//   • cache-buster queries (`?v=3`, `?1787055968`) are dropped, other queries
//     become a short hash suffix so different variants do not overwrite each other.

import { createHash } from 'node:crypto';
import path from 'node:path';

const CONTENT_TYPE_EXT = {
  'text/html': '.html',
  'application/xhtml+xml': '.html',
  'text/css': '.css',
  'text/javascript': '.js',
  'application/javascript': '.js',
  'application/x-javascript': '.js',
  'application/json': '.json',
  'application/ld+json': '.json',
  'application/manifest+json': '.webmanifest',
  'application/xml': '.xml',
  'text/xml': '.xml',
  'text/plain': '.txt',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/avif': '.avif',
  'image/svg+xml': '.svg',
  'image/x-icon': '.ico',
  'image/vnd.microsoft.icon': '.ico',
  'font/woff2': '.woff2',
  'font/woff': '.woff',
  'font/ttf': '.ttf',
  'font/otf': '.otf',
  'application/font-woff': '.woff',
  'application/font-woff2': '.woff2',
  'application/vnd.ms-fontobject': '.eot',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'audio/mpeg': '.mp3',
  'application/pdf': '.pdf',
  'application/wasm': '.wasm',
};

const CACHE_BUSTER_KEYS = new Set(['v', 'ver', 'version', 't', 'ts', 'cb', 'rev', 'hash', 'h', '_']);
const TRACKING_PARAMS = /^(utm_[a-z]+|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|_ga|_gl|igshid|ref_src)$/i;
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

export function extForContentType(contentType) {
  return CONTENT_TYPE_EXT[(contentType || '').split(';')[0].trim().toLowerCase()] || '';
}

export function isHtmlType(contentType) {
  const t = (contentType || '').split(';')[0].trim().toLowerCase();
  return t === 'text/html' || t === 'application/xhtml+xml';
}

function shortHash(value) {
  return createHash('sha1').update(value).digest('hex').slice(0, 8);
}

/** A query that only busts caches (`?v=3`, `?1787055968`, `?ver=1.2.3`) can be dropped. */
export function isCacheBusterQuery(search) {
  const q = search.replace(/^\?/, '');
  if (!q) return true;
  const parts = q.split('&').filter(Boolean);
  if (parts.length !== 1) return false;
  const [key, value] = parts[0].split('=');
  if (value === undefined) return /^[\w.-]{1,64}$/.test(key);
  return CACHE_BUSTER_KEYS.has(key.toLowerCase()) && /^[\w.-]{0,64}$/.test(value);
}

/** Removes tracking parameters so `?utm_source=x` does not create duplicate pages. */
export function stripTracking(url) {
  const u = new URL(url);
  for (const key of [...u.searchParams.keys()]) {
    if (TRACKING_PARAMS.test(key)) u.searchParams.delete(key);
  }
  u.hash = '';
  return u.href;
}

function sanitizeSegment(segment) {
  // `.` and `..` (also decoded from %2e%2e or ..%2F) must never reach the file system as
  // path steps; store() additionally refuses any path that leaves the backup folder.
  if (segment === '.' || segment === '..') return segment.replace(/\./g, '_');
  let s = segment.replace(/[<>:"\\|?*\u0000-\u001f]/g, '_').replace(/[. ]+$/, (m) => '_'.repeat(m.length));
  if (WINDOWS_RESERVED.test(s)) s = `_${s}`;
  if (s.length > 120) {
    const ext = path.posix.extname(s).slice(0, 12);
    s = `${s.slice(0, 100)}-${shortHash(s)}${ext}`;
  }
  return s || '_';
}

function decodePath(pathname) {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return pathname;
  }
}

function withSuffix(file, suffix) {
  if (!suffix) return file;
  const ext = path.posix.extname(file);
  return ext ? `${file.slice(0, -ext.length)}${suffix}${ext}` : `${file}${suffix}`;
}

/**
 * @param {string[]} siteHosts hosts that belong to the site (e.g. example.com and www.example.com)
 */
export function createUrlMapper(siteHosts) {
  const hosts = new Set(siteHosts.map((h) => h.toLowerCase()));

  function isSameSite(url) {
    try {
      return hosts.has(new URL(url).hostname.toLowerCase());
    } catch {
      return false;
    }
  }

  function prefixFor(u) {
    return hosts.has(u.hostname.toLowerCase()) ? '' : `_external/${sanitizeSegment(u.host)}/`;
  }

  /** Local path (POSIX, relative to the mirror root) for an HTML document. */
  function pagePath(url) {
    const u = new URL(stripTracking(url));
    const suffix = u.search ? `__q${shortHash(u.search)}` : '';
    let p = decodePath(u.pathname);
    let file;
    if (p.endsWith('/') || p === '') {
      file = `${p}index${suffix}.html`;
    } else {
      const ext = path.posix.extname(p).toLowerCase();
      if (ext === '.html' || ext === '.htm') file = withSuffix(p, suffix);
      else if (ext) file = `${p}${suffix}.html`;
      else file = `${p}${suffix}/index.html`;
    }
    return prefixFor(u) + file.split('/').filter(Boolean).map(sanitizeSegment).join('/');
  }

  /** Local path for any non-HTML resource. */
  function assetPath(url, contentType) {
    const u = new URL(url);
    u.hash = '';
    const suffix = isCacheBusterQuery(u.search) ? '' : `__q${shortHash(u.search)}`;
    let p = decodePath(u.pathname);
    if (p.endsWith('/') || p === '') p = `${p}index`;
    const typeExt = extForContentType(contentType);
    const segments = p.split('/').filter(Boolean);
    let last = segments.pop() || 'index';
    if (!path.posix.extname(last) && typeExt) last += typeExt;
    last = withSuffix(last, suffix);
    segments.push(last);
    return prefixFor(u) + segments.map(sanitizeSegment).join('/');
  }

  return { isSameSite, pagePath, assetPath, hosts };
}

/** Relative URL from one mirror file to another, safe to place in an HTML attribute. */
export function relativeHref(fromFile, toFile, fragment = '') {
  let rel = path.posix.relative(path.posix.dirname(fromFile), toFile);
  if (!rel) rel = path.posix.basename(toFile);
  const encoded = rel
    .split('/')
    .map((seg) => (seg === '..' || seg === '.' ? seg : encodeURIComponent(seg).replace(/%40/g, '@').replace(/%2B/g, '+')))
    .join('/');
  return encoded + (fragment || '');
}

/** The hosts that count as the same site: the start host plus its www / apex twin. */
export function siteHostsFor(startUrl) {
  const host = new URL(startUrl).hostname.toLowerCase();
  const twin = host.startsWith('www.') ? host.slice(4) : `www.${host}`;
  return [host, twin];
}
