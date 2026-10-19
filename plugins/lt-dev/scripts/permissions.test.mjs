#!/usr/bin/env node
// permissions.test.mjs — keeps the permission line of permissions.json and the skills' own
// allowed-tools in step, because the lt CLI copies permissions.json into every user's global
// settings and a skill's allowed-tools only take effect when the skill may load.
//
// The line (house rules 8a and 24c, measured 2026-10-18):
// - A skill with its own allowed-tools is gated on every load unless a named Skill rule allows it,
//   so each such skill has `Skill(lt-dev:<name>)` in permissions.json, and each Skill rule names
//   an existing skill (never a command, never a wildcard).
// - Those skills grant plugin scripts by exact name only. A `*` in a script path also matches
//   `../`, so `scripts/*` approved `bash <root>/scripts/../../dev/stdin`, i.e. any code.
// - permissions.json itself holds no ${CLAUDE_PLUGIN_ROOT} rule: settings do not expand it.
//
// Run:  node --test scripts/permissions.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PLUGIN = join(dirname(fileURLToPath(import.meta.url)), '..');
const perms = JSON.parse(readFileSync(join(PLUGIN, 'permissions.json'), 'utf8'));
const patterns = perms.permissions.map((p) => p.pattern);

function allowedTools(skill) {
  const text = readFileSync(join(PLUGIN, 'skills', skill, 'SKILL.md'), 'utf8');
  const front = text.split('\n---')[0];
  const lines = front.split('\n');
  const i = lines.findIndex((l) => l.startsWith('allowed-tools:'));
  if (i < 0) return null;
  const inline = lines[i].slice('allowed-tools:'.length).trim();
  if (inline) return inline.split(/,\s*/).map((e) => e.trim()).filter(Boolean);
  // YAML block list (documented form): every `  - item` line up to the next key
  const items = [];
  for (const l of lines.slice(i + 1)) {
    const m = /^\s+-\s+(.*)$/.exec(l);
    if (!m) break;
    items.push(m[1].trim());
  }
  assert.ok(items.length, `${skill}: allowed-tools is empty or in a form this test cannot read`);
  return items;
}

const skills = readdirSync(join(PLUGIN, 'skills')).filter((d) => existsSync(join(PLUGIN, 'skills', d, 'SKILL.md')));
const granting = skills.filter((s) => allowedTools(s));

test('every skill with its own allowed-tools has a named Skill rule', () => {
  for (const s of granting) {
    assert.ok(patterns.includes(`Skill(lt-dev:${s})`), `missing Skill(lt-dev:${s}) in permissions.json`);
  }
});

test('every Skill rule names an existing skill that grants tools, without a wildcard', () => {
  for (const p of patterns.filter((x) => /^Skill\b/.test(x))) {
    const m = /^Skill\(lt-dev:([a-z0-9-]+)\)$/.exec(p);
    assert.ok(m, `${p} is not a named lt-dev skill rule`);
    assert.ok(skills.includes(m[1]), `${p} names no skill (commands are never allowed globally)`);
    assert.ok(granting.includes(m[1]), `${p} allows a skill that grants nothing; drop the rule`);
  }
});

test('skill grants name plugin scripts exactly', () => {
  const exact = /^Bash\(bash "?\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/[A-Za-z0-9._-]+\.sh"?:\*\)$/;
  for (const s of granting) {
    for (const g of allowedTools(s)) {
      assert.match(g, exact, `${s}: ${g} is not an exact plugin-script grant`);
      const script = /scripts\/([A-Za-z0-9._-]+\.sh)/.exec(g)[1];
      assert.ok(existsSync(join(PLUGIN, 'scripts', script)), `${s}: ${script} does not exist`);
    }
  }
});

test('no retired rule and no exec-capable shape comes back', () => {
  const former = new Set(perms.formerPatterns || []);
  assert.deepEqual(patterns.filter((p) => former.has(p)), [], 'listed again although in formerPatterns');
  const execShapes = [
    /^Bash$/, // the bare tool
    /^Bash\(\s*:?\*\s*\)$/,
    /^Bash\((command|node|bash|sh|zsh|eval|exec|env|xargs|curl|wget|rm|cp|mv|lt|docker|docker-compose)(:\*|\s\*|\*)\)$/,
    /^Bash\(command (?!-v\b)/, // `command <anything>` runs it
    /^Bash\(git (clone|fetch|ls-remote|rebase|push|remote|tag|-c)(:\*|\s?\*)/, // wildcard right after the subcommand
    /^Bash\((npx|pnpm dlx|yarn dlx|bunx|npm exec|pnpm exec|yarn exec) (?!(vitest|playwright|oxlint|oxfmt|tsc)\b)[^)]*\*/,
  ];
  assert.deepEqual(patterns.filter((p) => execShapes.some((re) => re.test(p))), [], 'exec-capable rule in the global list');
});

test('permissions.json holds no ${CLAUDE_PLUGIN_ROOT} rule', () => {
  assert.deepEqual(patterns.filter((p) => p.includes('CLAUDE_PLUGIN_ROOT')), []);
});
