#!/usr/bin/env node
// ng-base-paths.mjs — the tsconfig `paths` a vendored @lenne.tech/ng-base needs, derived from the core itself.
//
// In vendor mode the library source sits in <app>/src/core/ and the app's tsconfig.json maps every
// package specifier onto it, one key per entry point: `@lenne.tech/ng-base` → the root entry file,
// `@lenne.tech/ng-base/<entry>` → that entry's file. Every entry point is a directory with an
// `ng-package.json` whose `lib.entryFile` names the file (ng-packagr's default `src/public_api.ts`
// when it names none). An upstream sync can add, nest or remove entry points
// (`@lenne.tech/ng-base/ui/provide`, `@lenne.tech/ng-base/files/ui`), so the mapping is re-derived
// after every sync instead of being edited by hand. Same rules as the lt CLI's ngBaseTsconfigPaths
// (cli src/lib/ng-base-vendor.ts): symlinks are never followed, node_modules and dist are skipped,
// and an entry whose file is missing or points outside its directory is left out, because a mapping
// onto nothing turns every import of it into a confusing TS2307.
//
// Usage:
//   node ng-base-paths.mjs [<app dir>]           print the derived mapping as JSON
//   node ng-base-paths.mjs [<app dir>] --check   compare it with <app>/tsconfig.json
// Exit codes: 0 mapping printed / tsconfig agrees, 1 tsconfig differs (missing, stale or wrong keys
// listed on stderr), 2 usage error or no vendored core, 3 tsconfig.json not readable.

import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import { pathToFileURL } from 'node:url';

export const NG_BASE_PACKAGE = '@lenne.tech/ng-base';
const DEFAULT_ENTRY_FILE = 'src/public_api.ts';
const SKIP_DIRS = new Set(['node_modules', 'dist', '.claude']);

function entryFileOf(ngPackageJson) {
  let config;
  try {
    config = JSON.parse(readFileSync(ngPackageJson, 'utf8'));
  } catch {
    return undefined;
  }
  const entryFile = config?.lib?.entryFile ?? DEFAULT_ENTRY_FILE;
  if (typeof entryFile !== 'string' || !entryFile) return undefined;
  const normalized = posix.normalize(entryFile.replaceAll('\\', '/')).replace(/^\.\//, '');
  if (normalized.startsWith('/') || /^[A-Za-z]:/.test(normalized) || normalized.split('/').includes('..')) {
    return undefined;
  }
  return normalized;
}

/** The mapping for the core at `<appDir>/src/core`, keyed by package specifier, sorted. */
export function deriveNgBasePaths(appDir, prefix = './src/core') {
  const core = join(appDir, 'src', 'core');
  const paths = {};
  const walk = (dir, rel) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(join(dir, entry.name), [...rel, entry.name]);
        continue;
      }
      if (!entry.isFile() || entry.name !== 'ng-package.json') continue;
      const entryFile = entryFileOf(join(dir, entry.name));
      if (!entryFile) continue;
      const target = join(dir, ...entryFile.split('/'));
      try {
        if (!lstatSync(target).isFile()) continue;
      } catch {
        continue;
      }
      const key = rel.length ? `${NG_BASE_PACKAGE}/${rel.join('/')}` : NG_BASE_PACKAGE;
      paths[key] = [posix.join(prefix, ...rel, entryFile).replace(/^(?!\.)/, './')];
    }
  };
  walk(core, []);
  return Object.fromEntries(Object.entries(paths).sort(([a], [b]) => a.localeCompare(b)));
}

/** JSON with comments and trailing commas, as `ng new` writes tsconfig.json. Strings are left intact. */
export function parseJsonc(text) {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"') j += text[j] === '\\' ? 2 : 1;
      out += text.slice(i, j + 1);
      i = j;
    } else if (c === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      out += '\n';
    } else if (c === '/' && text[i + 1] === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++;
      i++;
    } else {
      out += c;
    }
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'));
}

/** Differences between the derived mapping and the ng-base keys of a tsconfig's compilerOptions.paths. */
export function comparePaths(derived, tsconfigPaths = {}) {
  const current = Object.fromEntries(
    Object.entries(tsconfigPaths).filter(([key]) => key === NG_BASE_PACKAGE || key.startsWith(`${NG_BASE_PACKAGE}/`)),
  );
  const problems = [];
  for (const [key, value] of Object.entries(derived)) {
    if (!current[key]) problems.push(`missing: ${key} -> ${value[0]}`);
    else if (JSON.stringify(current[key]) !== JSON.stringify(value)) {
      problems.push(`wrong: ${key} is ${JSON.stringify(current[key])}, expected ${JSON.stringify(value)}`);
    }
  }
  for (const key of Object.keys(current)) {
    if (!derived[key]) problems.push(`stale: ${key} has no entry point in src/core any more`);
  }
  return problems;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const appDir = args.find((a) => !a.startsWith('--')) ?? process.cwd();
  const derived = deriveNgBasePaths(appDir);
  if (!Object.keys(derived).length) {
    process.stderr.write(`ng-base-paths: no vendored ng-base entry point under ${join(appDir, 'src', 'core')}\n`);
    process.exit(2);
  }
  if (!check) {
    process.stdout.write(`${JSON.stringify(derived, null, 2)}\n`);
    process.exit(0);
  }
  let tsconfig;
  try {
    tsconfig = parseJsonc(readFileSync(join(appDir, 'tsconfig.json'), 'utf8'));
  } catch (error) {
    process.stderr.write(`ng-base-paths: cannot read tsconfig.json: ${error.message}\n`);
    process.exit(3);
  }
  const problems = comparePaths(derived, tsconfig?.compilerOptions?.paths);
  if (problems.length) {
    process.stderr.write(`${problems.join('\n')}\n`);
    process.exit(1);
  }
  process.stdout.write(`tsconfig.json maps all ${Object.keys(derived).length} ng-base entry points\n`);
}
