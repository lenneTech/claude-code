#!/usr/bin/env node
// select-frontend-blocks.mjs — keep the block of one frontend in a template, drop the others.
//
// The lt-monorepo root CLAUDE.md template wraps frontend-specific text in marker lines:
//
//   <!-- lt:frontend nuxt -->
//   …text for a Nuxt app…
//   <!-- /lt:frontend -->
//   <!-- lt:frontend angular -->
//   …text for an Angular app…
//   <!-- /lt:frontend -->
//
// `lt fullstack init` and `add-app` keep the block of the chosen frontend, drop every other block
// and remove the marker lines; /lt-dev:fullstack:sync-claude-md does the same through this script,
// so a synced CLAUDE.md matches a freshly generated one. Text outside any block passes unchanged,
// so a template without markers comes out byte for byte as it went in.
//
// Usage: node select-frontend-blocks.mjs <nuxt|angular> [file]   (reads stdin without a file)
// Writes the result to stdout. Exits 2 on a usage error and 3 on a malformed template (a block
// that is not closed, a closing marker without an opening one, a block inside a block), and then
// prints nothing to stdout: a template it cannot read safely is never written half-processed.

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const OPEN = /^\s*<!--\s*lt:frontend\s+([a-z0-9-]+)\s*-->\s*$/;
const CLOSE = /^\s*<!--\s*\/lt:frontend\s*-->\s*$/;

export function selectFrontendBlocks(text, frontend) {
  const lines = text.split('\n');
  const out = [];
  let inside = null;
  lines.forEach((line, i) => {
    const open = OPEN.exec(line);
    if (open) {
      if (inside) throw new Error(`line ${i + 1}: block "${open[1]}" opens inside block "${inside}"`);
      inside = open[1];
      return;
    }
    if (CLOSE.test(line)) {
      if (!inside) throw new Error(`line ${i + 1}: closing marker without an open block`);
      inside = null;
      return;
    }
    if (!inside || inside === frontend) out.push(line);
  });
  if (inside) throw new Error(`block "${inside}" is never closed`);
  return out.join('\n');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [frontend, file] = process.argv.slice(2);
  if (!frontend || !/^[a-z0-9-]+$/.test(frontend)) {
    process.stderr.write('usage: select-frontend-blocks.mjs <nuxt|angular> [file]\n');
    process.exit(2);
  }
  let text;
  try {
    text = readFileSync(file ?? 0, 'utf8');
  } catch (error) {
    process.stderr.write(`select-frontend-blocks: cannot read ${file ?? 'stdin'}: ${error.message}\n`);
    process.exit(2);
  }
  try {
    process.stdout.write(selectFrontendBlocks(text, frontend));
  } catch (error) {
    process.stderr.write(`select-frontend-blocks: malformed template, ${error.message}\n`);
    process.exit(3);
  }
}
