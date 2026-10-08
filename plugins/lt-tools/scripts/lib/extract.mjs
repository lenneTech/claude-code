// extract.mjs — finds every URL a document references, with its exact position.
//
// Each reference is { start, end, value, kind, tag?, attr? } where start/end are
// offsets of the raw URL text in the source, so a rewrite can replace exactly that
// span. `kind` is one of:
//   page    — a navigable link (<a href>, <area href>, <iframe src>)
//   asset   — a resource the page needs to render (images, CSS, fonts, media …)
//   module  — an ES module script (<script type="module" src>, JS imports)
//   script  — a classic script (<script src>)
//   guess   — a string literal in JavaScript that looks like an asset path; fetched
//             speculatively and never reported as missing
//   form    — a form action (recorded, never fetched)

const HTML_COMMENT = /<!--[\s\S]*?-->/g;
const RAW_TEXT_BLOCK = /<(script|style|template|textarea|title)\b([^>]*)>([\s\S]*?)<\/\1\s*>/gi;
const TAG = /<([a-zA-Z][\w:-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*\/?>/g;
const ATTR = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

const LINK_REL_ASSET = /\b(stylesheet|icon|shortcut|apple-touch-icon|apple-touch-icon-precomposed|mask-icon|manifest|preload|prefetch|image_src|fluid-icon)\b/i;
const LAZY_ATTRS = new Set([
  'data-src', 'data-lazy-src', 'data-original', 'data-bg', 'data-background', 'data-background-image',
  'data-image', 'data-poster', 'data-lazy', 'data-full', 'data-zoom-image', 'data-href-image',
]);
const SRCSET_ATTRS = new Set(['srcset', 'data-srcset', 'imagesrcset', 'data-lazy-srcset']);
const META_IMAGE = /^(og:image|og:image:url|og:image:secure_url|twitter:image|twitter:image:src|msapplication-tileimage|msapplication-config)$/i;
const ASSET_EXT = /\.(png|jpe?g|gif|webp|avif|svg|ico|bmp|tiff?|woff2?|ttf|otf|eot|css|js|mjs|json|webmanifest|xml|mp4|webm|ogg|ogv|mp3|wav|m4a|pdf|wasm|txt|vtt)(\?|#|$)/i;

export const SKIP_SCHEME = /^(mailto:|tel:|sms:|javascript:|data:|blob:|about:|callto:|skype:|whatsapp:|#)/i;

const ENTITIES = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };

export function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? Number.parseInt(e.slice(2), 16) : Number.parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

function parseAttributes(attrText, offset) {
  const attrs = [];
  ATTR.lastIndex = 0;
  let m;
  while ((m = ATTR.exec(attrText))) {
    const name = m[1].toLowerCase();
    const value = m[2] ?? m[3] ?? m[4];
    let start = -1;
    if (value !== undefined) {
      const quoted = m[2] !== undefined || m[3] !== undefined;
      const rawEnd = m.index + m[0].length - (quoted ? 1 : 0);
      start = offset + rawEnd - value.length;
    }
    attrs.push({ name, value, start, end: start === -1 ? -1 : start + value.length });
  }
  return attrs;
}

/** Splits a srcset value into URL spans (URLs may contain commas, descriptors may not). */
export function srcsetSpans(value, offset) {
  const spans = [];
  let i = 0;
  while (i < value.length) {
    while (i < value.length && /[\s,]/.test(value[i])) i++;
    if (i >= value.length) break;
    const start = i;
    while (i < value.length && !/\s/.test(value[i])) i++;
    let end = i;
    let url = value.slice(start, end);
    if (url.endsWith(',')) {
      const trimmed = url.replace(/,+$/, '');
      end = start + trimmed.length;
      url = trimmed;
    } else {
      while (i < value.length && value[i] !== ',') i++;
    }
    if (url) spans.push({ start: offset + start, end: offset + end, value: url });
  }
  return spans;
}

/** URL references inside CSS text (`url()`, `@import`, `image-set()` strings). */
export function extractCss(css, offset = 0) {
  const refs = [];
  const urlRe = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]*))\s*\)/gi;
  let m;
  while ((m = urlRe.exec(css))) {
    const value = m[1] ?? m[2] ?? m[3];
    if (!value) continue;
    const start = offset + m.index + m[0].indexOf(value, 4);
    refs.push({ start, end: start + value.length, value, kind: 'asset' });
  }
  const importRe = /@import\s+(?:"([^"]+)"|'([^']+)')/gi;
  while ((m = importRe.exec(css))) {
    const value = m[1] ?? m[2];
    const start = offset + m.index + m[0].indexOf(value);
    refs.push({ start, end: start + value.length, value, kind: 'asset' });
  }
  const imageSetRe = /image-set\(([^)]*)\)/gi;
  while ((m = imageSetRe.exec(css))) {
    const inner = m[1];
    const innerOffset = m.index + m[0].indexOf(inner);
    const strRe = /(?<!url\(\s*)(?:"([^"]+)"|'([^']+)')/g;
    let s;
    while ((s = strRe.exec(inner))) {
      const value = s[1] ?? s[2];
      const start = offset + innerOffset + s.index + 1;
      refs.push({ start, end: start + value.length, value, kind: 'asset' });
    }
  }
  return refs;
}

/** Module specifiers and asset-looking string literals in JavaScript. */
export function extractJs(js, offset = 0) {
  const refs = [];
  const seen = new Set();
  const push = (start, value, kind) => {
    if (seen.has(start)) return;
    seen.add(start);
    refs.push({ start: offset + start, end: offset + start + value.length, value, kind });
  };
  const patterns = [
    /(?:^|[^\w$.])(?:import|export)\s*(?:[\w$*{}\s,]+?\s*from\s*)?(["'])([^"'\n]+)\1/g,
    /(?:^|[^\w$.])import\s*\(\s*(["'`])([^"'`\n$]+)\1\s*\)/g,
    /new\s+URL\(\s*(["'`])([^"'`\n$]+)\1\s*,\s*import\.meta\.url/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(js))) {
      const value = m[2];
      if (!/^(\.{1,2}\/|\/|https?:)/.test(value)) continue;
      const start = m.index + m[0].lastIndexOf(m[1] + value) + 1;
      push(start, value, re === patterns[2] ? 'asset' : 'module');
    }
  }
  const literal = /(["'`])((?:\.{0,2}\/)?[\w@~.\/-]+\.(?:m?js|css|png|jpe?g|gif|webp|avif|svg|woff2?|ttf|otf|mp4|webm|json|wasm))(?:\?[\w=.&-]*)?\1/g;
  let m;
  let guesses = 0;
  while ((m = literal.exec(js)) && guesses < 400) {
    const value = m[2];
    if (!value.includes('/') && !/^[\w.-]+-[\w-]{6,}\.\w+$/.test(value)) continue;
    if (/^\/\//.test(value)) continue;
    guesses++;
    push(m.index + 1, value, 'guess');
  }
  return refs;
}

/** URLs inside a JSON-LD block that point to files (logos, images). Page URLs are ignored. */
function extractJsonLd(text, offset) {
  const refs = [];
  const re = /"(https?:\\?\/\\?\/[^"\s]+)"/g;
  let m;
  while ((m = re.exec(text))) {
    const raw = m[1];
    const value = raw.replace(/\\\//g, '/');
    if (!ASSET_EXT.test(value)) continue;
    const start = offset + m.index + 1;
    refs.push({ start, end: start + raw.length, value, kind: 'asset', escaped: raw !== value });
  }
  return refs;
}

/**
 * All references in an HTML (or SVG) document.
 * Returns { refs, base, moduleScripts, inlineModules, forms }.
 */
export function extractHtml(html) {
  const refs = [];
  const forms = [];
  const moduleScripts = [];
  const inlineModules = [];
  let base = null;

  const masked = maskRanges(html, HTML_COMMENT);
  const blocks = [];
  RAW_TEXT_BLOCK.lastIndex = 0;
  let b;
  while ((b = RAW_TEXT_BLOCK.exec(masked))) {
    const tag = b[1].toLowerCase();
    const attrsText = b[2];
    const openLen = b[0].indexOf('>') + 1;
    const contentStart = b.index + openLen;
    blocks.push({ start: contentStart, end: contentStart + b[3].length });
    const typeMatch = /\btype\s*=\s*["']?([^"'\s>]+)/i.exec(attrsText);
    const type = typeMatch ? typeMatch[1].toLowerCase() : '';
    const content = html.slice(contentStart, contentStart + b[3].length);
    if (tag === 'style') refs.push(...extractCss(content, contentStart));
    if (tag === 'script') {
      if (type === 'application/ld+json') refs.push(...extractJsonLd(content, contentStart));
      else if (type === 'importmap') refs.push(...extractJsonLd(content, contentStart).map((r) => ({ ...r, kind: 'module' })));
      else if (type === 'module' && !/\bsrc\s*=/i.test(attrsText)) {
        const jsRefs = extractJs(content, contentStart).filter((r) => r.kind !== 'guess');
        if (jsRefs.length) inlineModules.push({ start: b.index, end: b.index + b[0].length, contentStart, contentEnd: contentStart + b[3].length });
        refs.push(...jsRefs);
      }
    }
  }
  const scanText = maskSpans(masked, blocks);

  TAG.lastIndex = 0;
  let t;
  while ((t = TAG.exec(scanText))) {
    const tag = t[1].toLowerCase();
    const attrText = t[2] || '';
    const attrOffset = t.index + 1 + t[1].length;
    const attrs = parseAttributes(html.slice(attrOffset, attrOffset + attrText.length), attrOffset);
    const get = (name) => attrs.find((a) => a.name === name);
    const rel = (get('rel')?.value || '').toLowerCase();
    const type = (get('type')?.value || '').toLowerCase();

    for (const a of attrs) {
      if (a.value === undefined || a.start === -1) continue;
      const add = (kind, value = a.value, start = a.start) => {
        const trimmed = value.trim();
        if (!trimmed || SKIP_SCHEME.test(trimmed)) return;
        const lead = value.indexOf(trimmed);
        refs.push({ start: start + lead, end: start + lead + trimmed.length, value: trimmed, kind, tag, attr: a.name });
      };
      const name = a.name;
      if (name === 'style') {
        refs.push(...extractCss(a.value, a.start).map((r) => ({ ...r, tag, attr: 'style' })));
      } else if (SRCSET_ATTRS.has(name)) {
        for (const s of srcsetSpans(a.value, a.start)) refs.push({ ...s, kind: 'asset', tag, attr: name });
      } else if (name === 'src') {
        if (tag === 'iframe' || tag === 'frame') add('page');
        else if (tag === 'script') {
          add(type === 'module' ? 'module' : 'script');
          if (type === 'module') moduleScripts.push({ tagStart: t.index, tagEnd: t.index + t[0].length, value: a.value.trim() });
        } else add('asset');
      } else if (name === 'href') {
        if (tag === 'a' || tag === 'area') add('page');
        else if (tag === 'base') base = decodeEntities(a.value.trim());
        else if (tag === 'link') {
          if (rel.includes('modulepreload')) add('module');
          else if (LINK_REL_ASSET.test(rel)) add('asset');
        } else if (tag === 'image' || tag === 'use' || tag === 'feimage') add('asset');
      } else if (name === 'xlink:href' && (tag === 'image' || tag === 'use')) {
        add('asset');
      } else if (LAZY_ATTRS.has(name) || name === 'poster' || name === 'background' || (name === 'data' && tag === 'object')) {
        if (/[/.]/.test(a.value)) add('asset');
      } else if (name === 'content' && tag === 'meta') {
        const prop = (get('property')?.value || get('name')?.value || '').toLowerCase();
        if (META_IMAGE.test(prop)) add('asset');
      } else if (name === 'action' && tag === 'form') {
        forms.push({ value: decodeEntities(a.value.trim()), method: (get('method')?.value || 'get').toLowerCase(), id: get('id')?.value || '' });
      }
    }
  }
  refs.sort((x, y) => x.start - y.start);
  return { refs, base, moduleScripts, inlineModules, forms };
}

/** References in a web app manifest. */
export function extractManifest(text) {
  const refs = [];
  const re = /"(src|start_url)"\s*:\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(text))) {
    if (m[1] === 'start_url') continue;
    const start = m.index + m[0].lastIndexOf(m[2]);
    refs.push({ start, end: start + m[2].length, value: m[2], kind: 'asset' });
  }
  return refs;
}

function maskRanges(text, re) {
  return text.replace(re, (m) => ' '.repeat(m.length));
}

function maskSpans(text, spans) {
  if (!spans.length) return text;
  let out = '';
  let last = 0;
  for (const s of spans) {
    out += text.slice(last, s.start) + ' '.repeat(s.end - s.start);
    last = s.end;
  }
  return out + text.slice(last);
}

/** Applies replacements ({ start, end, text }) to a string, back to front. */
export function applyReplacements(text, replacements) {
  const sorted = [...replacements].sort((a, b) => b.start - a.start);
  let out = text;
  let lastStart = Infinity;
  for (const r of sorted) {
    if (r.end > lastStart) continue;
    out = out.slice(0, r.start) + r.text + out.slice(r.end);
    lastStart = r.start;
  }
  return out;
}
