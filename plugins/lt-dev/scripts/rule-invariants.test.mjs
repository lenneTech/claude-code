#!/usr/bin/env node
// rule-invariants.test.mjs — tests for rule-invariants.mjs against throwaway fixture plugins,
// plus one run against lt-dev itself so a drifted copy fails Plugin CI.
//
// Run:  node --test scripts/rule-invariants.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { check, expand, section, CONFIG_FILE } from './rule-invariants.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, 'rule-invariants.mjs');
const PLUGIN = join(HERE, '..');

function write(root, rel, text) {
  const p = join(root, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, text);
}

const BAR = '## Bar\n\nOnly proven findings.\n\n### Detail\n\nkept with the section\n';

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'rule-invariants-'));
  write(root, 'agents/a-reviewer.md', `# A\n\n${BAR}\n## Next\n\nother text A\n`);
  write(root, 'agents/b-reviewer.md', `# B\n\n${BAR}\n## Next\n\nother text B\n`);
  write(root, 'agents/dev.md', '# Dev\n\nBefore editing, grep every caller of\nthe function you change.\n');
  write(root, 'commands/review.md', '# Review\n\n### Nicht geprüft\n\n**Ergebnis:** ok\n');
  write(root, 'commands/consumer.md', '# Consumer\n\nReads the Nicht geprüft section.\n');
  return root;
}

const CONFIG = {
  identicalSections: [{ name: 'bar', heading: '## Bar', files: ['agents/*-reviewer.md'] }],
  phrases: [{ name: 'caller grep', phrase: 'grep every caller of the function you change', files: ['agents/dev.md'] }],
  forbidden: [{ name: 'old catalog', pattern: 'Remediation Catalog', files: ['commands/*.md'] }],
  contracts: [
    {
      name: 'review report',
      provider: 'commands/review.md',
      consumers: ['commands/consumer.md'],
      terms: ['### Nicht geprüft', '**Ergebnis:**'],
    },
  ],
};

test('a consistent fixture passes every check', () => {
  assert.deepEqual(check(fixture(), CONFIG), []);
});

test('expand matches one path segment per star and skips directories for the last segment', () => {
  const root = fixture();
  assert.deepEqual(expand(root, 'agents/*-reviewer.md'), ['agents/a-reviewer.md', 'agents/b-reviewer.md']);
  assert.deepEqual(expand(root, 'agents/dev.md'), ['agents/dev.md']);
  assert.deepEqual(expand(root, 'agents/missing.md'), []);
});

test('section runs to the next heading of the same or a higher level, sub-headings included', () => {
  const body = section(`x\n${BAR}## Next\n`, '## Bar');
  assert.match(body, /### Detail/);
  assert.doesNotMatch(body, /## Next/);
  assert.equal(section('no heading here', '## Bar'), null);
});

test('a section that differs in one copy names that copy', () => {
  const root = fixture();
  write(root, 'agents/b-reviewer.md', `# B\n\n${BAR.replace('Only proven', 'Mostly proven')}\n## Next\n`);
  write(root, 'agents/c-reviewer.md', `# C\n\n${BAR}\n## Next\n`);
  const failures = check(root, CONFIG);
  assert.equal(failures.length, 1);
  assert.match(failures[0], /differs in agents\/b-reviewer\.md \(majority: 2 file/);
});

test('a copy without the section fails', () => {
  const root = fixture();
  write(root, 'agents/c-reviewer.md', '# C\n\nno bar here\n');
  assert.match(check(root, CONFIG).join('\n'), /agents\/c-reviewer\.md has no "## Bar" section/);
});

test('a phrase wrapped across lines passes, a reworded one fails', () => {
  const root = fixture();
  assert.deepEqual(check(root, CONFIG), []);
  write(root, 'agents/dev.md', '# Dev\n\nBefore editing, look at the callers.\n');
  assert.match(check(root, CONFIG).join('\n'), /agents\/dev\.md lacks "grep every caller/);
});

test('a forbidden pattern is reported with file and line', () => {
  const root = fixture();
  write(root, 'commands/consumer.md', '# Consumer\n\nread the Remediation Catalog from the review\n');
  assert.match(check(root, CONFIG).join('\n'), /commands\/consumer\.md:3 read the Remediation Catalog/);
});

test('a provider that drops a term its consumers rely on fails and names them', () => {
  const root = fixture();
  write(root, 'commands/review.md', '# Review\n\n**Ergebnis:** ok\n');
  assert.match(
    check(root, CONFIG).join('\n'),
    /commands\/review\.md no longer contains "### Nicht geprüft", which commands\/consumer\.md rely on/,
  );
});

test('a pattern that matches no file is a failure, not a silent pass', () => {
  const root = fixture();
  const config = { phrases: [{ name: 'gone', phrase: 'x', files: ['agents/renamed.md'] }] };
  assert.match(check(root, config).join('\n'), /"agents\/renamed\.md" matches no file/);
});

test('the CLI exits 1 on a violation and 2 without a config', () => {
  const root = fixture();
  write(root, CONFIG_FILE, JSON.stringify(CONFIG));
  assert.equal(spawnSync(process.execPath, [SCRIPT, root]).status, 0);
  write(root, 'agents/dev.md', '# Dev\n');
  const bad = spawnSync(process.execPath, [SCRIPT, root], { encoding: 'utf8' });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /FAIL phrase "caller grep"/);
  const empty = mkdtempSync(join(tmpdir(), 'rule-invariants-empty-'));
  assert.equal(spawnSync(process.execPath, [SCRIPT, empty]).status, 2);
});

test('lt-dev keeps every rule listed in its rule-invariants.json consistent', () => {
  const config = JSON.parse(readFileSync(join(PLUGIN, CONFIG_FILE), 'utf8'));
  assert.deepEqual(check(PLUGIN, config), []);
});
