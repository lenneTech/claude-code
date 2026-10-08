#!/usr/bin/env node
// context-budget.mjs
//
// Measures what a plugin adds to every Claude Code session and guards it against
// silent growth.
//
// Claude Code shows the model a listing of every skill and command (name plus
// `description` and `when_to_use`) on every turn. That listing has a character
// budget of 1 % of the context window, shared by every installed plugin and
// personal skill. When it overflows, the descriptions of the least-used entries
// are dropped: the skill keeps its name but is hardly ever chosen on its own, and
// "least used" is not "least important" (security is typically hit first). Agent
// descriptions reach every session as well, through the Agent tool.
//
// Why this counts by itself instead of reading `claude plugin details`: measured
// on 2026-10-08 (Claude Code 2.1.292) with a probe plugin, `details` counts a
// command with `disable-model-invocation: true` in full although it never enters
// the listing, and skips every command in a subdirectory (`commands/git/ship.md`
// → `lt-dev:git:ship`) although those are listed. Both levers that shrink the
// listing were therefore invisible in its figure. This script reads the same
// frontmatter Claude Code reads and counts exactly what reaches the model:
//
//   listing  skills and commands at any depth whose `disable-model-invocation` is
//            not true: name + description + when_to_use (characters, the unit the
//            listing budget is measured in)
//   agents   every agent: name + description
//   slash    commands and skills with `disable-model-invocation: true`, reported
//            for information only (they appear in the / menu, not in the listing)
//
// A per-entry cap applies as well: Claude Code cuts description + when_to_use at
// 1,536 characters (`skillListingMaxDescChars`), so a longer entry loses its tail.
//
// ── Baseline ────────────────────────────────────────────────────────────────
// `<plugin>/context-budget.json` holds the accepted values. `--check` fails when
// the listing or the agent total exceeds them, so growth is always a decision:
// whoever lengthens a description raises the baseline in the same change with
// `--update`, and the diff shows it. A total below the baseline passes and prints
// a hint to lock the gain in with `--update`.
//
// ── Usage ───────────────────────────────────────────────────────────────────
//   node context-budget.mjs [plugin-dir] [--check] [--update] [--details] [--json] [--top <n>]
//
//   plugin-dir   the plugin root (holds .claude-plugin/plugin.json); default: the
//                plugin this script belongs to
//   --check      compare against <plugin>/context-budget.json; exit 1 on growth,
//                on an entry over the cap, or when the baseline file is missing
//   --update     write the current totals to <plugin>/context-budget.json
//   --details    also run `claude plugin details` and print its Always-on figure
//                (skipped with a note when the claude CLI is not on PATH)
//   --json       print the full measurement as JSON instead of the report
//   --top <n>    number of largest entries listed per group in the report (default 10)
//
// Exit codes: 0 ok · 1 check failed · 2 usage error / unreadable plugin

import { readFileSync, readdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, relative, dirname, basename, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ENTRY_CAP = 1536;
export const BASELINE_FILE = 'context-budget.json';

// ── Frontmatter ─────────────────────────────────────────────────────────────

function unquote(raw) {
  const v = raw.trim();
  if (v.length >= 2 && v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1).replace(/''/g, "'");
  if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) {
    try {
      return JSON.parse(v);
    } catch {
      return v.slice(1, -1);
    }
  }
  return v;
}

/**
 * Reads the top-level scalar keys of a YAML frontmatter block. Covers what plugin
 * frontmatter uses: plain, single- and double-quoted scalars, plain scalars
 * continued on indented lines, and `>` / `|` block scalars.
 */
export function parseFrontmatter(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  if (lines[0].trim() !== '---') return {};
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === '---');
  if (end === -1) return {};
  const body = lines.slice(1, end);
  const out = {};
  for (let i = 0; i < body.length; i++) {
    const m = /^([A-Za-z0-9_-]+):(.*)$/.exec(body[i]);
    if (!m) continue;
    const key = m[1];
    const rest = m[2].trim();
    const cont = [];
    while (i + 1 < body.length && /^\s+\S/.test(body[i + 1])) cont.push(body[++i].trim());
    if (/^[>|][+-]?$/.test(rest)) {
      out[key] = cont.join(rest.startsWith('>') ? ' ' : '\n');
    } else if (cont.length && !/^['"]/.test(rest)) {
      out[key] = [rest, ...cont].join(' ');
    } else {
      out[key] = unquote([rest, ...cont].join(' '));
    }
  }
  return out;
}

const isTrue = (v) => String(v ?? '').trim().toLowerCase() === 'true';

// ── Collection ──────────────────────────────────────────────────────────────

function listMarkdown(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...listMarkdown(p));
    else if (name.endsWith('.md')) out.push(p);
  }
  return out;
}

function entry({ kind, name, fm, file }) {
  const description = fm.description ?? '';
  const whenToUse = fm.when_to_use ?? '';
  const slashOnly = kind !== 'agent' && isTrue(fm['disable-model-invocation']);
  return {
    kind,
    name,
    file,
    slashOnly,
    descChars: description.length + whenToUse.length,
    chars: name.length + description.length + whenToUse.length,
  };
}

export function readPluginName(pluginDir) {
  const manifest = join(pluginDir, '.claude-plugin', 'plugin.json');
  if (!existsSync(manifest)) throw new Error(`no .claude-plugin/plugin.json in ${pluginDir}`);
  const name = JSON.parse(readFileSync(manifest, 'utf8')).name;
  return name || basename(resolve(pluginDir));
}

export function collect(pluginDir) {
  const plugin = readPluginName(pluginDir);
  const entries = [];

  const skillsDir = join(pluginDir, 'skills');
  if (existsSync(skillsDir)) {
    for (const dir of readdirSync(skillsDir).sort()) {
      const file = join(skillsDir, dir, 'SKILL.md');
      if (!existsSync(file)) continue;
      const fm = parseFrontmatter(readFileSync(file, 'utf8'));
      entries.push(entry({ kind: 'skill', name: `${plugin}:${fm.name || dir}`, fm, file }));
    }
  }

  const commandsDir = join(pluginDir, 'commands');
  for (const file of listMarkdown(commandsDir)) {
    const fm = parseFrontmatter(readFileSync(file, 'utf8'));
    const rel = relative(commandsDir, file).slice(0, -'.md'.length).split(sep).join(':');
    entries.push(entry({ kind: 'command', name: `${plugin}:${rel}`, fm, file }));
  }

  const agentsDir = join(pluginDir, 'agents');
  if (existsSync(agentsDir)) {
    for (const f of readdirSync(agentsDir).sort()) {
      if (!f.endsWith('.md')) continue;
      const file = join(agentsDir, f);
      const fm = parseFrontmatter(readFileSync(file, 'utf8'));
      entries.push(entry({ kind: 'agent', name: `${plugin}:${fm.name || f.slice(0, -3)}`, fm, file }));
    }
  }

  return { plugin, entries };
}

export function summarize(entries) {
  const sum = (list) => list.reduce((s, e) => s + e.chars, 0);
  const listing = entries.filter((e) => e.kind !== 'agent' && !e.slashOnly);
  const agents = entries.filter((e) => e.kind === 'agent');
  const slash = entries.filter((e) => e.slashOnly);
  return {
    listingChars: sum(listing),
    listingEntries: listing.length,
    listingSkills: listing.filter((e) => e.kind === 'skill').length,
    listingCommands: listing.filter((e) => e.kind === 'command').length,
    agentChars: sum(agents),
    agentEntries: agents.length,
    slashOnlyChars: sum(slash),
    slashOnlyEntries: slash.length,
    overCap: entries.filter((e) => e.kind !== 'agent' && e.descChars > ENTRY_CAP).map((e) => e.name),
  };
}

// ── Baseline ────────────────────────────────────────────────────────────────

export function readBaseline(pluginDir) {
  const file = join(pluginDir, BASELINE_FILE);
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, 'utf8'));
}

export function writeBaseline(pluginDir, totals) {
  const data = {
    $comment:
      'Accepted always-on size of this plugin, in characters. Checked by scripts/context-budget.mjs --check in Plugin CI and /lt-dev:plugin:check. Raise it only on purpose, with --update in the same change that grows a description.',
    listingChars: totals.listingChars,
    agentChars: totals.agentChars,
  };
  writeFileSync(join(pluginDir, BASELINE_FILE), `${JSON.stringify(data, null, 2)}\n`);
  return data;
}

/** Returns { ok, problems[], hints[] } for the totals against a baseline. */
export function compare(totals, baseline) {
  const problems = [];
  const hints = [];
  if (!baseline) {
    problems.push(`no ${BASELINE_FILE}: create one with --update`);
    return { ok: false, problems, hints };
  }
  for (const [key, label] of [
    ['listingChars', 'skill/command listing'],
    ['agentChars', 'agent descriptions'],
  ]) {
    const now = totals[key];
    const base = baseline[key];
    if (typeof base !== 'number') problems.push(`${BASELINE_FILE} has no numeric ${key}`);
    else if (now > base) problems.push(`${label} grew: ${now} chars, baseline ${base} (+${now - base})`);
    else if (now < base) hints.push(`${label} shrank: ${now} chars, baseline ${base} (−${base - now}); lock it in with --update`);
  }
  for (const name of totals.overCap) problems.push(`${name}: description + when_to_use exceed ${ENTRY_CAP} chars and get cut`);
  return { ok: problems.length === 0, problems, hints };
}

// ── claude plugin details (informational) ───────────────────────────────────

function runDetails(pluginDir, plugin) {
  const res = spawnSync('claude', ['--plugin-dir', resolve(pluginDir), 'plugin', 'details', plugin], {
    encoding: 'utf8',
    timeout: 60_000,
  });
  if (res.error) return { skipped: `claude CLI not available (${res.error.code ?? res.error.message})` };
  const m = /Always-on:\s*~?([\d,.]+)\s*tok/.exec(res.stdout ?? '');
  if (!m) return { skipped: 'no Always-on line in `claude plugin details` output' };
  return { alwaysOnTokens: Number(m[1].replace(/[,.]/g, '')) };
}

// ── Report ──────────────────────────────────────────────────────────────────

function report({ plugin, entries, totals, baseline, verdict, details, top }) {
  const lines = [];
  const pad = (s, n) => String(s).padEnd(n);
  lines.push(`Context budget: ${plugin}`);
  lines.push('');
  lines.push(
    `  listing   ${pad(totals.listingChars, 7)} chars  ${totals.listingSkills} skills + ${totals.listingCommands} commands (model-invocable)`,
  );
  lines.push(`  agents    ${pad(totals.agentChars, 7)} chars  ${totals.agentEntries} agents`);
  lines.push(`  slash     ${pad(totals.slashOnlyChars, 7)} chars  ${totals.slashOnlyEntries} slash-only, not in the listing (info)`);
  if (baseline) lines.push(`  baseline  listing ${baseline.listingChars} · agents ${baseline.agentChars}`);
  if (details) {
    lines.push(
      details.skipped
        ? `  details   skipped: ${details.skipped}`
        : `  details   ~${details.alwaysOnTokens} tok Always-on per \`claude plugin details\` (counts slash-only top-level commands, misses nested ones)`,
    );
  }
  const groups = [
    ['Largest listing entries', entries.filter((e) => e.kind !== 'agent' && !e.slashOnly)],
    ['Largest agent entries', entries.filter((e) => e.kind === 'agent')],
  ];
  for (const [title, list] of groups) {
    lines.push('');
    lines.push(`${title}:`);
    for (const e of [...list].sort((a, b) => b.chars - a.chars).slice(0, top)) {
      lines.push(`  ${pad(e.chars, 6)} ${e.name}`);
    }
  }
  if (verdict) {
    lines.push('');
    for (const p of verdict.problems) lines.push(`FAIL  ${p}`);
    for (const h of verdict.hints) lines.push(`NOTE  ${h}`);
    if (verdict.ok) lines.push('OK    within baseline');
  }
  return lines.join('\n');
}

// ── CLI ─────────────────────────────────────────────────────────────────────

export function main(argv) {
  const args = argv.slice(2);
  const flags = new Set(args.filter((a) => a.startsWith('--')));
  const topIdx = args.indexOf('--top');
  const top = topIdx >= 0 ? Number(args[topIdx + 1]) : 10;
  const positional = args.filter((a, i) => !a.startsWith('--') && !(topIdx >= 0 && i === topIdx + 1));
  const known = new Set(['--check', '--update', '--details', '--json', '--top']);
  const unknown = [...flags].filter((f) => !known.has(f));
  if (unknown.length || !Number.isInteger(top) || top < 0) {
    console.error(`usage: context-budget.mjs [plugin-dir] [--check] [--update] [--details] [--json] [--top <n>]`);
    return 2;
  }
  const pluginDir = positional[0] ?? join(dirname(fileURLToPath(import.meta.url)), '..');

  let collected;
  try {
    collected = collect(pluginDir);
  } catch (err) {
    console.error(`context-budget: ${err.message}`);
    return 2;
  }
  const { plugin, entries } = collected;
  const totals = summarize(entries);

  if (flags.has('--update')) writeBaseline(pluginDir, totals);
  const baseline = readBaseline(pluginDir);
  const verdict = flags.has('--check') ? compare(totals, baseline) : null;
  const details = flags.has('--details') ? runDetails(pluginDir, plugin) : null;

  if (flags.has('--json')) {
    console.log(JSON.stringify({ plugin, totals, baseline, verdict, details, entries }, null, 2));
  } else {
    console.log(report({ plugin, entries, totals, baseline, verdict, details, top }));
  }
  return verdict && !verdict.ok ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv);
}
