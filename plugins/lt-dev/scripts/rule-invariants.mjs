#!/usr/bin/env node
// rule-invariants.mjs
//
// Keeps rules that live in several files from drifting apart.
//
// A rule copied into four agents is only as current as the copy someone last
// edited. Two failures this guards against, both observed in lt-dev
// (2026-10-17): `/lt-dev:production-ready` and `/lt-dev:refactor-frontend` kept
// parsing an "Action Roadmap" and a "Remediation Catalog" that `/lt-dev:review`
// had stopped writing, so production-ready never found its fix list; and the
// follow-up policy said "only note it for the user" in resolve-ticket while
// take-ticket filed the same follow-up as a `Blocked` ticket.
//
// The checks come from `<plugin>/rule-invariants.json`:
//
//   identicalSections  a markdown section (from its heading to the next heading of
//                      the same or a higher level) must be byte-identical in every
//                      listed file, and present in each
//   phrases            a load-bearing phrase must appear in every listed file, so
//                      rewording it in one copy fails until every copy follows
//                      (compared with whitespace collapsed: line wrapping is no drift)
//   forbidden          a regular expression must not match in the listed files
//                      (retired names that consumers must no longer rely on)
//   contracts          terms a provider's output format must still contain,
//                      because the listed consumers parse them
//
// File entries are paths relative to the plugin root; `*` matches within one
// path segment (`agents/*-reviewer.md`). A pattern that matches no file is a
// failure: a check that silently checks nothing is worse than none.
//
// Usage: node rule-invariants.mjs [plugin-dir] [--json]
// Exit codes: 0 ok · 1 an invariant is violated · 2 usage error / unreadable config

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const CONFIG_FILE = 'rule-invariants.json';

/** Expands `dir/*-x.md`-style patterns (one `*` level per segment) relative to root. */
export function expand(root, pattern) {
  const segments = pattern.split('/');
  let paths = [''];
  for (const [i, seg] of segments.entries()) {
    const last = i === segments.length - 1;
    const next = [];
    for (const base of paths) {
      const dir = join(root, base);
      if (!seg.includes('*')) {
        const candidate = base ? `${base}/${seg}` : seg;
        if (existsSync(join(root, candidate))) next.push(candidate);
        continue;
      }
      if (!existsSync(dir) || !statSync(dir).isDirectory()) continue;
      const re = new RegExp(`^${seg.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*')}$`);
      for (const name of readdirSync(dir).sort()) {
        if (!re.test(name)) continue;
        const candidate = base ? `${base}/${name}` : name;
        const isDir = statSync(join(root, candidate)).isDirectory();
        if (last ? !isDir : isDir) next.push(candidate);
      }
    }
    paths = next;
  }
  return paths;
}

/** The section starting at a heading line, up to the next heading of the same or a higher level. */
export function section(text, heading) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const level = (heading.match(/^#+/) || [''])[0].length;
  const start = lines.findIndex((l) => l === heading || l.startsWith(`${heading} `) || l.startsWith(`${heading}(`));
  if (start === -1 || level === 0) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const m = lines[i].match(/^(#+) /);
    if (m && m[1].length <= level) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join('\n').trimEnd();
}

const squash = (text) => text.replace(/\s+/g, ' ');

export function check(root, config) {
  const failures = [];
  const read = (rel) => readFileSync(join(root, rel), 'utf8');
  const files = (entry, list) => {
    const out = [];
    for (const pattern of list || []) {
      const hits = expand(root, pattern);
      if (hits.length === 0) failures.push(`${entry}: "${pattern}" matches no file`);
      out.push(...hits);
    }
    return [...new Set(out)];
  };

  for (const s of config.identicalSections || []) {
    const name = `identical section "${s.name}"`;
    const bodies = new Map();
    for (const f of files(name, s.files)) {
      const body = section(read(f), s.heading);
      if (body === null) failures.push(`${name}: ${f} has no "${s.heading}" section`);
      else bodies.set(f, body);
    }
    const variants = [...new Set(bodies.values())];
    if (variants.length > 1) {
      const groups = variants.map((v) => [...bodies].filter(([, b]) => b === v).map(([f]) => f));
      groups.sort((a, b) => b.length - a.length);
      const odd = groups.slice(1).flat();
      failures.push(`${name}: differs in ${odd.join(', ')} (majority: ${groups[0].length} file(s) agree)`);
    }
  }

  for (const p of config.phrases || []) {
    const name = `phrase "${p.name}"`;
    for (const f of files(name, p.files)) {
      // Markdown wraps lines anywhere, so a phrase is compared with whitespace collapsed.
      if (!squash(read(f)).includes(squash(p.phrase))) failures.push(`${name}: ${f} lacks "${p.phrase}"`);
    }
  }

  for (const r of config.forbidden || []) {
    const name = `forbidden "${r.name}"`;
    const re = new RegExp(r.pattern);
    for (const f of files(name, r.files)) {
      const lines = read(f).split('\n');
      lines.forEach((line, i) => {
        if (re.test(line)) failures.push(`${name}: ${f}:${i + 1} ${line.trim().slice(0, 120)}`);
      });
    }
  }

  for (const c of config.contracts || []) {
    const name = `contract "${c.name}"`;
    const [provider] = files(name, [c.provider]);
    files(name, c.consumers);
    if (!provider) continue;
    const text = read(provider);
    for (const term of c.terms || []) {
      if (!squash(text).includes(squash(term))) {
        failures.push(`${name}: ${provider} no longer contains "${term}", which ${(c.consumers || []).join(', ')} rely on`);
      }
    }
  }
  return failures;
}

function main(argv) {
  const args = argv.filter((a) => !a.startsWith('--'));
  const json = argv.includes('--json');
  const root = resolve(args[0] || join(dirname(fileURLToPath(import.meta.url)), '..'));
  const configPath = join(root, CONFIG_FILE);
  let config;
  try {
    config = JSON.parse(readFileSync(configPath, 'utf8'));
  } catch (e) {
    console.error(`rule-invariants: cannot read ${configPath}: ${e.message}`);
    return 2;
  }
  const failures = check(root, config);
  const counts = ['identicalSections', 'phrases', 'forbidden', 'contracts'].map((k) => (config[k] || []).length);
  if (json) {
    console.log(JSON.stringify({ root, ok: failures.length === 0, failures }, null, 2));
  } else if (failures.length) {
    for (const f of failures) console.error(`FAIL ${f}`);
    console.error(`\n${failures.length} invariant violation(s). Update every copy of the rule, or the config in ${CONFIG_FILE} when the change is deliberate.`);
  } else {
    console.log(
      `OK rule invariants: ${counts[0]} identical sections, ${counts[1]} phrases, ${counts[2]} forbidden patterns, ${counts[3]} contracts`,
    );
  }
  return failures.length ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  process.exit(main(process.argv.slice(2)));
}
