// fixture-site.mjs — a small local website that contains every trap a mirror has to handle.
//
// Served by a plain Node HTTP server on 127.0.0.1, so the tests need no network:
//   • a page only reachable through navigation (not in the sitemap), a robots-disallowed page
//   • cache-buster query strings on CSS and an SVG (`logo.svg?1787055968`)
//   • srcset, data-src (lazy) images, an inline style background, a CSS @import chain, a font
//   • an ES module entry with a static import, a dynamic import, `new URL(…, import.meta.url)`
//     and a hashed asset only named as a string literal; the module writes visible text,
//     so a backup whose JavaScript does not run shows different content
//   • SRI integrity + crossorigin, modulepreload, <base href>, JSON-LD logo, a protocol-
//     relative external script, a web manifest, a form, a broken image reference
//   • /contact builds an image URL at runtime from an absolute base, so a copy only shows it
//     while the live site is reachable
//   • opt-in traps: `evil` (a module importing a file outside the backup folder) and `ssrf`
//     (a redirect to 169.254.169.254, a sitemap on a private host)

import { createHash } from 'node:crypto';
import http from 'node:http';
import zlib from 'node:zlib';
import { crc32 } from '../lib/zip.mjs';

// A valid 1×1 PNG (Chrome rejects images with wrong chunk CRCs).
function makePng(r, g, b) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0);
  ihdr.writeUInt32BE(1, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const raw = Buffer.from([0, r, g, b]);
  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
const PNG_1X1 = makePng(200, 30, 60);
const MAIN_CSS = '@import url("fonts.css");\nbody{font-family:Fixture,sans-serif;background:url(../img/bg2.png) no-repeat}\nh1{color:rgb(10, 20, 30)}\n';
const MAIN_CSS_SRI = `sha384-${createHash('sha384').update(MAIN_CSS).digest('base64')}`;
const SVG = (color) => `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="${color}"/></svg>`;

function layout(title, body, origin) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<base href="/">
<title>${title}</title>
<meta property="og:image" content="${origin}/img/og.png">
<link rel="stylesheet" href="/css/main.css?v=12" integrity="${MAIN_CSS_SRI}" crossorigin="anonymous">
<link rel="manifest" href="/site.webmanifest">
<link rel="modulepreload" href="/js/chunk.js">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","url":"${origin}/","logo":"${origin.replace(/\//g, '\\/')}\\/img\\/jsonld-logo.svg?1787055968"}</script>
<script type="module" src="/js/main.js" crossorigin></script>
<script src="//cdn.example.invalid/lib.js" async></script>
</head>
<body>
<header id="header"><nav><a href="/">Home</a> <a href="/about/">About</a> <a href="/contact">Contact</a> <a href="https://example.org/">External</a></nav></header>
${body}
<footer><a href="mailto:info@example.invalid">Mail</a></footer>
</body>
</html>`;
}

export function fixtureFiles(origin) {
  return {
    '/': {
      type: 'text/html; charset=utf-8',
      body: layout(
        'Fixture Home',
        `<main>
<h1>Fixture home</h1>
<img src="/img/logo.svg?1787055968" alt="logo">
<img srcset="/img/a-1x.png 1x, /img/a-2x.png 2x" src="/img/a-1x.png" alt="responsive">
<img data-src="/img/lazy.png" src="/img/placeholder.png" class="lazy" alt="lazy">
<div style="background-image:url('/img/bg.png');width:20px;height:20px"></div>
<img src="/img/missing.png" alt="broken on the live site too">
<a href="/private/secret/">Private</a>
<form action="/send" method="post"><input name="email" required><button>Send</button></form>
<p id="js-target"></p>
</main>`,
        origin,
      ),
    },
    '/about/': { type: 'text/html; charset=utf-8', body: layout('About', '<main><h1>About</h1><img src="img/a-1x.png" alt="relative to base"></main>', origin) },
    '/contact': {
      type: 'text/html; charset=utf-8',
      body: layout(
        'Contact',
        `<main data-asset-base="${origin}"><h1>Contact</h1><p>Only linked from the navigation.</p></main>
<script>(function(){var m=document.querySelector('main');var i=new Image();i.alt='runtime';i.src=m.getAttribute('data-asset-base')+'/img/runtime.png';m.appendChild(i);})();</script>`,
        origin,
      ),
    },
    '/private/secret/': { type: 'text/html; charset=utf-8', body: layout('Secret', '<main><h1>Secret</h1></main>', origin) },
    '/robots.txt': { type: 'text/plain', body: `User-agent: *\nDisallow: /private/\nSitemap: ${origin}/sitemap.xml\n` },
    '/sitemap.xml': {
      type: 'application/xml',
      body: `<?xml version="1.0"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>${origin}/sitemap-pages.xml</loc></sitemap></sitemapindex>`,
    },
    '/sitemap-pages.xml': {
      type: 'application/xml',
      body: `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin}/</loc></url><url><loc>${origin}/about/</loc></url><url><loc>https://booking.example.org/x</loc></url></urlset>`,
    },
    '/css/main.css': { type: 'text/css', body: MAIN_CSS },
    '/css/fonts.css': { type: 'text/css', body: '@font-face{font-family:Fixture;src:url("/fonts/fixture.woff2") format("woff2")}\n' },
    '/fonts/fixture.woff2': { type: 'font/woff2', body: Buffer.from('wOF2-dummy') },
    '/js/main.js': {
      type: 'text/javascript',
      body: `import { label } from "./chunk.js";
const icon = new URL("../img/meta-url.png", import.meta.url);
document.getElementById("js-target") && (document.getElementById("js-target").textContent = "JS works: " + label + " " + icon.pathname.split("/").pop());
import("./lazy-chunk.js").then((m) => document.body.setAttribute("data-lazy", String(m.default)));
`,
    },
    '/js/chunk.js': { type: 'text/javascript', body: 'export const label = "chunk";\nexport const hashed = "assets/hashed-abc12345.png";\n' },
    '/js/lazy-chunk.js': { type: 'text/javascript', body: 'export default 2;\n' },
    '/js/hashed-abc12345.png': { type: 'image/png', body: PNG_1X1 },
    '/img/meta-url.png': { type: 'image/png', body: PNG_1X1 },
    '/img/logo.svg': { type: 'image/svg+xml', body: SVG('#0a1e3c') },
    '/img/jsonld-logo.svg': { type: 'image/svg+xml', body: SVG('#123456') },
    '/img/a-1x.png': { type: 'image/png', body: PNG_1X1 },
    '/img/a-2x.png': { type: 'image/png', body: PNG_1X1 },
    '/img/lazy.png': { type: 'image/png', body: PNG_1X1 },
    '/img/placeholder.png': { type: 'image/png', body: PNG_1X1 },
    '/img/bg.png': { type: 'image/png', body: PNG_1X1 },
    '/img/bg2.png': { type: 'image/png', body: PNG_1X1 },
    '/img/og.png': { type: 'image/png', body: PNG_1X1 },
    '/img/runtime.png': { type: 'image/png', body: PNG_1X1 },
    '/img/icon-192.png': { type: 'image/png', body: PNG_1X1 },
    '/site.webmanifest': { type: 'application/manifest+json', body: '{"name":"Fixture","icons":[{"src":"/img/icon-192.png","sizes":"192x192","type":"image/png"}]}' },
  };
}

function addTraps(files, origin, { evil, ssrf }) {
  if (evil) {
    files['/evil/'] = { type: 'text/html; charset=utf-8', body: layout('Evil', '<main><h1>Evil</h1><script type="module" src="/js/evil.js"></script></main>', origin) };
    // On the web this resolves to /sentinel.json (404); on disk it climbs out of the backup.
    files['/js/evil.js'] = { type: 'text/javascript', body: 'import data from "../../../sentinel.json";\nimport "../../../sentinel.css";\ndocument.title = data.marker;\n' };
    // An inline module: `require` is not rewritten before bundling, so esbuild resolves it on disk.
    files['/evil/'].body = files['/evil/'].body.replace('</main>', '<script type="module">import "/js/chunk.js"; const d = require("../../../sentinel.json"); document.title = d.marker;</script></main>');
    files['/'].body = files['/'].body.replace('<a href="/private/secret/">', '<a href="/evil/">Evil</a> <a href="/private/secret/">');
  }
  if (ssrf) {
    files['/img/redirected.png'] = { status: 302, location: 'http://169.254.169.254/latest/meta-data/' };
    files['/'].body = files['/'].body.replace('<img src="/img/missing.png"', '<img src="/img/redirected.png" alt="redirect trap"><img src="/img/missing.png"');
    files['/robots.txt'].body += 'Sitemap: http://10.0.0.1/internal-sitemap.xml\n';
    // A host NAME that resolves to a private address: only the DNS guard can stop it (the test
    // maps intranet.test to 192.0.2.10, a documentation address no real host answers on).
    files['/img/named.png'] = { status: 302, location: 'http://intranet.test/x.png' };
    files['/'].body = files['/'].body.replace('<img src="/img/redirected.png"', '<img src="/img/named.png" alt="dns trap"><img src="/img/redirected.png"');
  }
}

/** Starts the fixture server; resolves to { origin, close }. Options enable the trap pages. */
export async function startFixtureServer({ evil = false, ssrf = false } = {}) {
  let files = {};
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://x').pathname;
    const entry = files[pathname];
    if (!entry || req.method !== 'GET') {
      res.writeHead(404, { 'content-type': 'text/html' });
      res.end('<h1>Not found</h1>');
      return;
    }
    if (entry.status) {
      res.writeHead(entry.status, { location: entry.location });
      res.end();
      return;
    }
    // Real servers compress, so the fixture does too: gzip for text, br for CSS, whenever the
    // client asks. A mirror that stops decompressing then saves raw bytes and the tests fail.
    const accepts = String(req.headers['accept-encoding'] || '');
    const body = Buffer.isBuffer(entry.body) ? entry.body : Buffer.from(entry.body);
    if (typeof entry.body === 'string' && /\bbr\b/.test(accepts) && /css/.test(entry.type)) {
      res.writeHead(200, { 'content-type': entry.type, 'content-encoding': 'br' });
      res.end(zlib.brotliCompressSync(body));
    } else if (typeof entry.body === 'string' && /\bgzip\b/.test(accepts)) {
      res.writeHead(200, { 'content-type': entry.type, 'content-encoding': 'gzip' });
      res.end(zlib.gzipSync(body));
    } else {
      res.writeHead(200, { 'content-type': entry.type });
      res.end(entry.body);
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  files = fixtureFiles(origin);
  addTraps(files, origin, { evil, ssrf });
  return { origin, close: () => new Promise((r) => server.close(r)) };
}

/** A server that accepts connections and never answers (for timeout tests). */
export async function startHangingServer() {
  const sockets = new Set();
  const server = http.createServer(() => {});
  server.on('connection', (s) => {
    sockets.add(s);
    s.on('close', () => sockets.delete(s));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    close: () =>
      new Promise((r) => {
        for (const s of sockets) s.destroy();
        server.close(r);
      }),
  };
}
