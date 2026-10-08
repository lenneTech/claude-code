#!/usr/bin/env node
// context-budget.test.mjs — tests for context-budget.mjs against throwaway fixture plugins.
// No claude CLI and no network: the --details path is not exercised here.
//
// Run:  node --test scripts/context-budget.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter, collect, summarize, compare, writeBaseline, readBaseline, ENTRY_CAP } from './context-budget.mjs';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'context-budget.mjs');

function write(root, rel, text) {
  const p = join(root, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, text);
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'context-budget-'));
  write(root, '.claude-plugin/plugin.json', JSON.stringify({ name: 'demo', version: '0.0.1' }));
  // 10-char description, plus when_to_use
  write(root, 'skills/alpha/SKILL.md', '---\nname: alpha\ndescription: 0123456789\nwhen_to_use: abcde\n---\nbody\n');
  // quoted description with an escaped single quote: "it's" = 4 chars
  write(root, 'skills/beta/SKILL.md', "---\nname: beta\ndescription: 'it''s'\n---\nbody\n");
  // slash-only skill: never in the listing
  write(root, 'skills/gamma/SKILL.md', '---\nname: gamma\ndescription: xxxxxxxxxx\ndisable-model-invocation: true\n---\n');
  // top-level and nested commands, model-invocable and slash-only
  write(root, 'commands/top.md', '---\ndescription: 12345\n---\nbody\n');
  write(root, 'commands/git/ship.md', '---\ndescription: 123\ndisable-model-invocation: false\n---\nbody\n');
  write(root, 'commands/git/rebase.md', '---\ndescription: 1234567\ndisable-model-invocation: true\n---\nbody\n');
  write(root, 'agents/rev.md', '---\nname: rev\ndescription: 123456\ntools: Read\n---\nbody\n');
  return root;
}

test('parseFrontmatter reads plain, quoted, continued and block scalars', () => {
  const fm = parseFrontmatter(
    [
      '---',
      'a: plain value',
      "b: 'single ''quoted'' text'",
      'c: "double \\"quoted\\""',
      'd: first line',
      '  continued here',
      'e: >',
      '  folded',
      '  block',
      'f: true',
      '---',
      'body',
    ].join('\n'),
  );
  assert.equal(fm.a, 'plain value');
  assert.equal(fm.b, "single 'quoted' text");
  assert.equal(fm.c, 'double "quoted"');
  assert.equal(fm.d, 'first line continued here');
  assert.equal(fm.e, 'folded block');
  assert.equal(fm.f, 'true');
});

test('parseFrontmatter handles CRLF files and files without frontmatter', () => {
  assert.equal(parseFrontmatter('---\r\ndescription: x\r\n---\r\n').description, 'x');
  assert.deepEqual(parseFrontmatter('no frontmatter'), {});
});

test('the listing counts model-invocable skills and commands at every depth, never slash-only ones', () => {
  const root = fixture();
  try {
    const { plugin, entries } = collect(root);
    assert.equal(plugin, 'demo');
    const byName = Object.fromEntries(entries.map((e) => [e.name, e]));
    assert.equal(byName['demo:alpha'].chars, 'demo:alpha'.length + 10 + 5);
    assert.equal(byName['demo:beta'].chars, 'demo:beta'.length + 4);
    assert.equal(byName['demo:git:ship'].slashOnly, false, 'a nested command is listed like a top-level one');
    assert.equal(byName['demo:git:rebase'].slashOnly, true);
    assert.equal(byName['demo:gamma'].slashOnly, true);

    const t = summarize(entries);
    const expectedListing =
      'demo:alpha'.length + 15 + 'demo:beta'.length + 4 + 'demo:top'.length + 5 + 'demo:git:ship'.length + 3;
    assert.equal(t.listingChars, expectedListing);
    assert.equal(t.listingSkills, 2);
    assert.equal(t.listingCommands, 2);
    assert.equal(t.agentChars, 'demo:rev'.length + 6);
    assert.equal(t.slashOnlyEntries, 2);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('compare fails on growth and on a missing baseline, passes with a hint when it shrank', () => {
  const totals = { listingChars: 100, agentChars: 50, overCap: [] };
  assert.equal(compare(totals, null).ok, false);
  assert.equal(compare(totals, { listingChars: 100, agentChars: 50 }).ok, true);

  const grew = compare(totals, { listingChars: 99, agentChars: 50 });
  assert.equal(grew.ok, false);
  assert.match(grew.problems[0], /listing grew: 100 chars, baseline 99 \(\+1\)/);

  const agentsGrew = compare(totals, { listingChars: 100, agentChars: 49 });
  assert.equal(agentsGrew.ok, false);
  assert.match(agentsGrew.problems[0], /agent descriptions grew/);

  const shrank = compare(totals, { listingChars: 120, agentChars: 50 });
  assert.equal(shrank.ok, true);
  assert.match(shrank.hints[0], /shrank.*--update/);
});

test('an entry over the per-entry cap fails the check', () => {
  const root = fixture();
  try {
    write(root, 'skills/huge/SKILL.md', `---\nname: huge\ndescription: ${'x'.repeat(ENTRY_CAP + 1)}\n---\n`);
    const t = summarize(collect(root).entries);
    assert.deepEqual(t.overCap, ['demo:huge']);
    const v = compare(t, { listingChars: 1e9, agentChars: 1e9 });
    assert.equal(v.ok, false);
    assert.match(v.problems[0], /demo:huge.*1536/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('the CLI writes a baseline with --update and gates growth with --check', () => {
  const root = fixture();
  try {
    const run = (...args) => spawnSync(process.execPath, [SCRIPT, root, ...args], { encoding: 'utf8' });

    const missing = run('--check');
    assert.equal(missing.status, 1, 'no baseline yet');
    assert.match(missing.stdout, /no context-budget\.json/);

    assert.equal(run('--update').status, 0);
    const written = JSON.parse(readFileSync(join(root, 'context-budget.json'), 'utf8'));
    assert.equal(typeof written.listingChars, 'number');
    assert.equal(written.listingChars, readBaseline(root).listingChars);

    assert.equal(run('--check').status, 0, 'unchanged plugin passes');

    write(root, 'commands/top.md', '---\ndescription: 12345 and a longer text\n---\nbody\n');
    const grew = run('--check');
    assert.equal(grew.status, 1, 'a longer description fails the check');
    assert.match(grew.stdout, /FAIL\s+skill\/command listing grew/);

    write(root, 'commands/top.md', '---\ndescription: 12345 and a longer text\ndisable-model-invocation: true\n---\nbody\n');
    const slash = run('--check');
    assert.equal(slash.status, 0, 'making it slash-only takes it out of the listing');
    assert.match(slash.stdout, /NOTE\s+skill\/command listing shrank/);

    const json = JSON.parse(run('--json').stdout);
    assert.equal(json.plugin, 'demo');
    assert.equal(json.totals.listingCommands, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('the CLI rejects unknown flags and an unreadable plugin with exit 2', () => {
  assert.equal(spawnSync(process.execPath, [SCRIPT, '--nope'], { encoding: 'utf8' }).status, 2);
  const empty = mkdtempSync(join(tmpdir(), 'context-budget-empty-'));
  try {
    assert.equal(spawnSync(process.execPath, [SCRIPT, empty], { encoding: 'utf8' }).status, 2);
  } finally {
    rmSync(empty, { recursive: true, force: true });
  }
});

test('writeBaseline keeps only the gated totals and an explanation', () => {
  const root = fixture();
  try {
    const data = writeBaseline(root, { listingChars: 1, agentChars: 2, overCap: [] });
    assert.deepEqual(Object.keys(data), ['$comment', 'listingChars', 'agentChars']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
