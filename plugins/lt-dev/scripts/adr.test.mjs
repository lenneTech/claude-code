#!/usr/bin/env node
// adr.test.mjs — offline tests for adr.mjs: parsing the ADR formats in use, status classification,
// numbering across branches, the skeleton and supersede marking, the index, and the lint (secrets
// included). Every test works in its own temporary directory.
//
// Run:  node --test scripts/adr.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  INDEX_START,
  checkLog,
  classifyLanguage,
  classifyStatus,
  findLogs,
  main,
  markSuperseded,
  nextNumber,
  parseAdr,
  projectLanguage,
  referencedNumbers,
  refuseWrite,
  renderIndex,
  replaceIndex,
  scanSecrets,
  slugify,
} from './adr.mjs';

function tempRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'adr-test-'));
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

function write(root, rel, text) {
  const p = join(root, rel);
  mkdirSync(join(p, '..'), { recursive: true });
  writeFileSync(p, text);
}

function run(args, root) {
  const lines = [];
  const out = { log: (l) => lines.push(String(l)), error: (l) => lines.push(`ERR ${l}`) };
  const code = main([...args, '--root', root], root, out);
  return { code, text: lines.join('\n') };
}

const EN_ADR = `# ADR-003: REST only, no GraphQL endpoints in new modules

**Date:** 2026-03-02 · **Status:** accepted · **Topic:** API
**Origin:** DEV-1234

## Context

x
`;

test('parses the lt default header in English', () => {
  const a = parseAdr(EN_ADR, '003-rest-only.md');
  assert.equal(a.number, 3);
  assert.equal(a.title, 'REST only, no GraphQL endpoints in new modules');
  assert.equal(a.status, 'accepted');
  assert.equal(a.date, '2026-03-02');
  assert.equal(a.topic, 'API');
  assert.equal(a.origin, 'DEV-1234');
});

test('parses a German header with ASCII umlauts, several fields and a partial supersede', () => {
  const text = `# ADR-063: Dateispeicher je Lane

**Datum:** 2026-09-15, Fassung 5 vom 18.09.2026 · **Status:** gueltig; Punkt 11 ueberholt durch [ADR-067](067-k8up.md) · **Ersetzt:** [ADR-046](046-sfs.md) (Mount-Weg) · **Thema:** Daten/Speicher
`;
  const a = parseAdr(text, '063-dateispeicher.md');
  assert.equal(a.number, 63);
  assert.equal(a.date, '2026-09-15');
  assert.equal(a.status, 'partially-superseded');
  assert.deepEqual(a.supersededBy, [67]);
  assert.deepEqual(a.supersedes, [46]);
  assert.equal(a.topic, 'Daten/Speicher');
});

test('parses MADR frontmatter and adr-tools sections', () => {
  const madr = parseAdr('---\nstatus: superseded by ADR-0007\ndate: 2025-01-04\n---\n# Use PostgreSQL\n', '0004-use-postgres.md');
  assert.equal(madr.title, 'Use PostgreSQL');
  assert.equal(madr.status, 'superseded');
  assert.deepEqual(madr.supersededBy, [7]);
  assert.equal(madr.date, '2025-01-04');

  const tools = parseAdr('# 1. Record architecture decisions\n\nDate: 2019-05-01\n\n## Status\n\nAccepted\n\n## Context\n', '0001-record-architecture-decisions.md');
  assert.equal(tools.title, 'Record architecture decisions');
  assert.equal(tools.status, 'accepted');
  assert.equal(tools.date, '2019-05-01');
});

test('classifies statuses by their first status word', () => {
  assert.equal(classifyStatus('accepted'), 'accepted');
  assert.equal(classifyStatus('gültig'), 'accepted');
  assert.equal(classifyStatus('gebaut (nonprod), prod folgt'), 'accepted');
  assert.equal(classifyStatus('superseded by ADR-005'), 'superseded');
  assert.equal(classifyStatus('überholt durch [ADR-024](024-x.md)'), 'superseded');
  assert.equal(classifyStatus('teilweise ueberholt durch [ADR-063](063-x.md)'), 'partially-superseded');
  assert.equal(classifyStatus('in nonprod abgeloest durch 076, in prod noch gueltig'), 'partially-superseded');
  assert.equal(classifyStatus('gueltig; teilweise Abloesung vorgeschlagen in [ADR-082](082-x.md)'), 'accepted');
  assert.equal(classifyStatus('gueltig; Punkt 2 aufgehoben am 23.09.2026'), 'partially-superseded');
  assert.equal(classifyStatus('vorgeschlagen, nicht gebaut'), 'proposed');
  assert.equal(classifyStatus('verworfen am 25.09.2026'), 'rejected');
  assert.equal(classifyStatus('deprecated'), 'deprecated');
  assert.equal(classifyStatus('ueberholt durch [ADR-9](009-gueltigkeit-pruefen.md)'), 'superseded');
  assert.equal(classifyStatus('whatever'), 'unknown');
  assert.equal(classifyStatus(''), 'unknown');
});

test('reads ADR references in every form', () => {
  assert.deepEqual(referencedNumbers('ueberholt durch [063](entscheidungen/063-a.md), [067](067-b.md)'), [63, 67]);
  assert.deepEqual(referencedNumbers('nonprod abgeloest durch 076 (29.09.2026)'), [76]);
  assert.deepEqual(referencedNumbers('superseded by ADR-0012'), [12]);
});

test('slugs are ASCII, lowercase and bounded', () => {
  assert.equal(slugify('Löschen über Soft-Delete, nicht hart!'), 'loeschen-ueber-soft-delete-nicht-hart');
  assert.ok(slugify('a'.repeat(30) + ' ' + 'b'.repeat(40)).length <= 60);
  assert.equal(slugify('???'), 'decision');
});

test('finds root and subproject logs, skips empty folders without a README', () => {
  const { dir, cleanup } = tempRepo();
  try {
    write(dir, 'docs/adr/001-a.md', EN_ADR);
    write(dir, 'projects/api/docs/adr/001-b.md', EN_ADR);
    mkdirSync(join(dir, 'decisions'));
    assert.deepEqual(findLogs(dir), ['docs/adr', 'projects/api/docs/adr']);
  } finally {
    cleanup();
  }
});

test('init writes the README with index markers once, in the requested language', () => {
  const { dir, cleanup } = tempRepo();
  try {
    assert.equal(run(['init', '--lang', 'de'], dir).code, 0);
    const readme = readFileSync(join(dir, 'docs/adr/README.md'), 'utf8');
    assert.match(readme, /Architekturentscheidungen/);
    assert.ok(readme.includes(INDEX_START));
    writeFileSync(join(dir, 'docs/adr/README.md'), 'kept');
    run(['init'], dir);
    assert.equal(readFileSync(join(dir, 'docs/adr/README.md'), 'utf8'), 'kept');
  } finally {
    cleanup();
  }
});

test('new writes the skeleton, supersedes the old ADR and rewrites the index', () => {
  const { dir, cleanup } = tempRepo();
  try {
    run(['init', '--lang', 'en'], dir);
    write(dir, 'docs/adr/001-rest-only.md', EN_ADR.replace('ADR-003', 'ADR-001'));
    const r = run(['new', '--title', 'GraphQL allowed for the reporting module', '--topic', 'API', '--supersedes', '1', '--origin', 'DEV-2000', '--date', '2026-11-18'], dir);
    assert.equal(r.code, 0, r.text);
    const created = readFileSync(join(dir, 'docs/adr/002-graphql-allowed-for-the-reporting-module.md'), 'utf8');
    assert.match(created, /^# ADR-002: GraphQL allowed for the reporting module$/m);
    assert.match(created, /\*\*Date:\*\* 2026-11-18 · \*\*Status:\*\* accepted · \*\*Topic:\*\* API/);
    assert.match(created, /\*\*Supersedes:\*\* \[ADR-001\]\(001-rest-only\.md\)/);
    assert.match(created, /## Rejected alternatives/);
    const old = parseAdr(readFileSync(join(dir, 'docs/adr/001-rest-only.md'), 'utf8'), '001-rest-only.md');
    assert.equal(old.status, 'superseded');
    assert.deepEqual(old.supersededBy, [2]);
    const readme = readFileSync(join(dir, 'docs/adr/README.md'), 'utf8');
    assert.match(readme, /\| \[002\]\(002-graphql-allowed-for-the-reporting-module\.md\) \| 2026-11-18 \|/);
    // The skeleton still carries its placeholders, so the lint refuses it until it is filled.
    const lint = checkLog(dir, 'docs/adr');
    assert.ok(lint.issues.some((i) => i.kind === 'error' && /placeholder/.test(i.message)));
  } finally {
    cleanup();
  }
});

test('a German log that writes ASCII umlauts keeps that style when it marks a superseded ADR', () => {
  const { dir, cleanup } = tempRepo();
  try {
    write(dir, 'docs/entscheidungen/001-alt.md', '# ADR-001: Alt\n\n**Datum:** 2026-01-01 · **Status:** gueltig · **Thema:** X\n');
    write(dir, 'docs/README.md', '| [001](entscheidungen/001-alt.md) |');
    const r = run(['new', '--title', 'Neu statt alt', '--supersedes', '1', '--lang', 'de', '--date', '2026-02-02'], dir);
    assert.equal(r.code, 0, r.text);
    const old = readFileSync(join(dir, 'docs/entscheidungen/001-alt.md'), 'utf8');
    assert.match(old, /\*\*Status:\*\* ueberholt durch \[ADR-002\]\(002-neu-statt-alt\.md\) · \*\*Thema:\*\* X/);
    const created = readFileSync(join(dir, 'docs/entscheidungen/002-neu-statt-alt.md'), 'utf8');
    assert.match(created, /\*\*Status:\*\* gueltig/);
    assert.match(r.text, /by hand/);
  } finally {
    cleanup();
  }
});

test('markSuperseded rewrites only the status value', () => {
  const text = '# ADR-1: X\n\n**Date:** 2026-01-01 · **Status:** accepted · **Topic:** Y\n';
  assert.equal(markSuperseded(text, 'superseded by [ADR-002](002-x.md)'), '# ADR-1: X\n\n**Date:** 2026-01-01 · **Status:** superseded by [ADR-002](002-x.md) · **Topic:** Y\n');
  assert.equal(markSuperseded('---\nstatus: accepted\n---\n# X\n', 'superseded by [ADR-002](002-x.md)'), '---\nstatus: superseded by ADR-002\n---\n# X\n');
  assert.equal(markSuperseded('# X\n\nno status here\n', 'x'), undefined);
});

test('next counts numbers on other branches, so parallel branches do not collide', () => {
  const { dir, cleanup } = tempRepo();
  const g = (...a) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', ...a], { cwd: dir, stdio: 'ignore' });
  try {
    g('init', '-q', '-b', 'main');
    write(dir, 'docs/adr/001-a.md', EN_ADR);
    g('add', '.');
    g('commit', '-q', '-m', 'a');
    g('checkout', '-q', '-b', 'feature');
    write(dir, 'docs/adr/002-b.md', EN_ADR);
    write(dir, 'docs/adr/003-c.md', EN_ADR);
    g('add', '.');
    g('commit', '-q', '-m', 'b');
    g('checkout', '-q', 'main');
    assert.equal(nextNumber(dir, 'docs/adr'), 4);
    assert.equal(run(['next'], dir).text, '004');
  } finally {
    cleanup();
  }
});

test('check reports duplicates, unknown status, dangling references and a stale index', () => {
  const { dir, cleanup } = tempRepo();
  try {
    run(['init', '--lang', 'en'], dir);
    write(dir, 'docs/adr/001-a.md', EN_ADR);
    write(dir, 'docs/adr/001-b.md', EN_ADR);
    write(dir, 'docs/adr/002-c.md', '# ADR-002: C\n\n**Date:** 2026-01-01 · **Status:** maybe\n');
    write(dir, 'docs/adr/003-d.md', '# ADR-003: D\n\n**Date:** 2026-01-01 · **Status:** accepted · **Supersedes:** [ADR-009](009-x.md)\n');
    const { issues } = checkLog(dir, 'docs/adr');
    const errors = issues.filter((i) => i.kind === 'error').map((i) => i.message).join('\n');
    assert.match(errors, /ADR-001 is used by 2 files/);
    assert.match(errors, /status "maybe" is not a known status/);
    assert.match(errors, /supersedes ADR-009, which does not exist/);
    assert.match(errors, /index table is out of date/);
    assert.equal(run(['index', '--write'], dir).code, 0);
    assert.ok(!checkLog(dir, 'docs/adr').issues.some((i) => /index table/.test(i.message)));
    assert.equal(run(['check'], dir).code, 1);
  } finally {
    cleanup();
  }
});

test('a reference into an inherited log is not checked against the root log', () => {
  const { dir, cleanup } = tempRepo();
  try {
    run(['init', '--lang', 'en'], dir);
    write(dir, 'docs/adr/001-no-jest.md', '# ADR-001: Keep vitest\n\n**Date:** 2026-01-01 · **Status:** accepted\n**Supersedes:** [api ADR-007](../../projects/api/docs/adr/007-vitest.md)\n\n## Context\n');
    run(['index', '--write'], dir);
    const a = parseAdr(readFileSync(join(dir, 'docs/adr/001-no-jest.md'), 'utf8'), '001-no-jest.md');
    assert.deepEqual(a.supersedes, []);
    assert.equal(run(['check'], dir).code, 0);
  } finally {
    cleanup();
  }
});

test('new decisions go into the root log, never into a subproject log a starter brought along', () => {
  const { dir, cleanup } = tempRepo();
  try {
    write(dir, 'projects/api/docs/adr/001-vitest.md', EN_ADR.replace('ADR-003', 'ADR-001'));
    const r = run(['new', '--title', 'Invoices are soft deleted', '--lang', 'en', '--date', '2026-01-01'], dir);
    assert.equal(r.code, 0, r.text);
    assert.ok(existsSync(join(dir, 'docs/adr/001-invoices-are-soft-deleted.md')), r.text);
    assert.ok(!existsSync(join(dir, 'projects/api/docs/adr/002-invoices-are-soft-deleted.md')));
  } finally {
    cleanup();
  }
});

test('a clean log passes check', () => {
  const { dir, cleanup } = tempRepo();
  try {
    run(['init', '--lang', 'en'], dir);
    write(dir, 'docs/adr/001-rest-only.md', EN_ADR.replace('ADR-003', 'ADR-001'));
    run(['index', '--write'], dir);
    const r = run(['check'], dir);
    assert.equal(r.code, 0, r.text);
    assert.match(r.text, /0 error\(s\), 0 warning\(s\)/);
  } finally {
    cleanup();
  }
});

test('secret scan flags real credentials and lets placeholders pass', () => {
  // Fixtures are assembled at runtime, so the repository's own secret guard does not read them as real values.
  const userPart = 'app:' + 's3cret' + 'Pw9';
  const keyValue = 'a1b2c3d4' + 'e5f6g7h8';
  const home = '/Us' + 'ers/';
  const flagged = (text) => scanSecrets(text).filter((f) => f.kind === 'error').map((f) => f.rule);
  assert.deepEqual(flagged(`url: postgres://${userPart}@db.internal/app`), ['credentials in URL']);
  assert.deepEqual(flagged('mongodb://user:password@localhost/db and https://<user>:<token>@host'), []);
  assert.deepEqual(flagged('NSC__DATABASE__URL=${DATABASE_URL}'), []);
  assert.deepEqual(flagged(`apiKey: "${keyValue}"`), ['secret assignment']);
  assert.deepEqual(flagged('token: required, password: <password>'), []);
  assert.deepEqual(flagged(['-----BEGIN', 'RSA', 'PRIVATE', 'KEY-----'].join(' ')), ['private key']);
  assert.deepEqual(flagged(`key ${'AKIA'}ABCDEFGHIJKLMNOP`), ['AWS access key']);
  assert.deepEqual(flagged(`glpat-${'x'.repeat(20)}`), ['GitLab token']);
  const warn = scanSecrets(`see ${home}someone/notes.md, not ${home}<name>/x`).filter((f) => f.kind === 'warning');
  assert.equal(warn.length, 1);
});

test('secret scan catches the stack\'s prefixed variables, markdown fields and token prefixes', () => {
  // Assembled at runtime, like the fixtures above.
  const v = 'Sup3r' + 'S3cret' + 'Pw';
  const flagged = (text) => scanSecrets(text).filter((f) => f.kind === 'error').map((f) => f.rule);
  for (const line of [
    `NSC__JWT__SECRET=${v}`,
    `DB_PASSWORD=${v}`,
    `MONGO_INITDB_ROOT_PASSWORD: ${v}`,
    `**Password:** ${v}`,
    `| password | ${v} |`,
    `accessToken: "${v}"`,
    `auth: { pass: "${v}" }`,
  ]) {
    assert.deepEqual(flagged(line), ['secret assignment'], line);
  }
  assert.deepEqual(flagged(`redis://:${v}@redis:6379`), ['credentials in URL']);
  assert.deepEqual(flagged('lin_api_' + 'a'.repeat(30)), ['Linear API key']);
  assert.deepEqual(flagged('github_pat_' + 'A'.repeat(30)), ['GitHub token']);
  assert.deepEqual(flagged('xkeysib-' + 'b'.repeat(30)), ['Brevo API key']);
  assert.deepEqual(flagged('Authorization: Bearer ' + 'c'.repeat(30)), ['bearer token']);
});

test('secret scan lets references, names and code through', () => {
  const flagged = (text) => scanSecrets(text).filter((f) => f.kind === 'error');
  for (const line of [
    'PASSWORD_FILE=/run/secrets/db1',
    'tokenizer=v2model',
    'secret: process.env.JWT_SECRET',
    'token: NSC__AUTH__TOKEN',
    'token: CoreRedisService',
    'bypass: true',
    'pass = var.registry_password,',
    'envFromSecret: grafana-oauth',
    "const token = req.cookies['x.session_token'];",
    '/auth/verify-email?token=…&email=…',
    '| `token` | `Authorization: Bearer <token>` header |',
    '| **Hook** | x | `argocd_webhook_secret` | GitLab-Webhook, y |',
  ]) {
    assert.deepEqual(flagged(line), [], line);
  }
});

test('check fails on an ADR that quotes a credential', () => {
  const { dir, cleanup } = tempRepo();
  try {
    run(['init', '--lang', 'en'], dir);
    write(dir, 'docs/adr/001-db.md', `${EN_ADR.replace('ADR-003', 'ADR-001')}\nDB_PASSWORD=${'Sup3r' + 'S3cret' + 'Pw'}\n`);
    run(['index', '--write'], dir);
    const r = run(['check'], dir);
    assert.equal(r.code, 1, r.text);
    assert.match(r.text, /ERROR docs\/adr\/001-db\.md:\d+ secret assignment/);
  } finally {
    cleanup();
  }
});

test('list --active shows exactly the binding and proposed ADRs, with the statuses new writes', () => {
  const { dir, cleanup } = tempRepo();
  try {
    const statuses = [
      'accepted',
      'partially superseded by [ADR-002](002-x.md)',
      'proposed',
      'superseded by [ADR-002](002-x.md)',
      'rejected',
      'deprecated',
    ];
    statuses.forEach((status, i) => write(dir, `docs/adr/00${i + 1}-x${i}.md`, `# ADR-00${i + 1}: Decision ${i + 1}\n\n**Date:** 2026-01-01 · **Status:** ${status}\n`));
    const r = run(['list', '--active'], dir);
    assert.equal(r.code, 0, r.text);
    assert.match(r.text, /\(6 ADRs, 2 binding\)/);
    assert.match(r.text, /ADR-001 \| accepted \|/);
    assert.match(r.text, /ADR-002 \| partially-superseded by ADR-002 \||ADR-002 \| partially-superseded \|/);
    assert.match(r.text, /ADR-003 \| proposed \|/);
    for (const hidden of ['ADR-004', 'ADR-005', 'ADR-006']) assert.ok(!r.text.includes(hidden), hidden);
  } finally {
    cleanup();
  }
});

const DE_PROSE = 'Die Entscheidung ist gefallen, und der Kontext ist klar. Das Team wird mit der Lösung auf die Daten zugreifen, die nicht im Repository liegen. Das ist die Regel für alle Module und die Datenbank.';
const EN_PROSE = 'The decision is made, and the context is clear. The team works with the solution on the data that is not in the repository. That is the rule for all modules and for the database, which the team keeps.';

test('classifyLanguage tells German, English, mixed and too-short text apart', () => {
  assert.equal(classifyLanguage(DE_PROSE).lang, 'de');
  assert.equal(classifyLanguage(EN_PROSE).lang, 'en');
  assert.equal(classifyLanguage(`${DE_PROSE}\n${EN_PROSE}`).lang, 'mixed');
  assert.equal(classifyLanguage('# Title').lang, 'short');
  // Code carries identifiers, not the document's language.
  assert.equal(classifyLanguage(`${DE_PROSE}\n\`\`\`\n${EN_PROSE}\n${EN_PROSE}\n\`\`\``).lang, 'de');
});

test('the project language comes from the log first, then from documentation that agrees', () => {
  const { dir, cleanup } = tempRepo();
  try {
    write(dir, 'README.md', EN_PROSE);
    write(dir, 'docs/guide.md', EN_PROSE);
    assert.deepEqual([projectLanguage(dir, 'docs/adr').lang, projectLanguage(dir, 'docs/adr').decidedBy], ['en', 'docs']);
    write(dir, 'CLAUDE.md', DE_PROSE);
    assert.equal(projectLanguage(dir, 'docs/adr').lang, 'unclear');
    write(dir, 'docs/adr/001-x.md', `# ADR-001: X\n\n**Datum:** 2026-01-01 · **Status:** gültig\n\n${DE_PROSE}\n`);
    assert.deepEqual([projectLanguage(dir, 'docs/adr').lang, projectLanguage(dir, 'docs/adr').decidedBy], ['de', 'log']);
  } finally {
    cleanup();
  }
});

test('init and new stop on an unclear language and refuse to mix the log\'s language', () => {
  const { dir, cleanup } = tempRepo();
  try {
    write(dir, 'README.md', EN_PROSE);
    write(dir, 'CLAUDE.md', DE_PROSE);
    const lang = run(['lang'], dir);
    assert.equal(lang.code, 3, lang.text);
    assert.match(lang.text, /lang: unclear/);
    const unclear = run(['new', '--title', 'Use PostgreSQL'], dir);
    assert.equal(unclear.code, 3, unclear.text);
    assert.match(unclear.text, /ask the developer/);
    assert.ok(!existsSync(join(dir, 'docs/adr')), 'nothing is written while the language is unclear');
    assert.equal(run(['new', '--title', 'PostgreSQL statt MongoDB', '--lang', 'de', '--date', '2026-01-01'], dir).code, 0);
    assert.match(readFileSync(join(dir, 'docs/adr/README.md'), 'utf8'), /Architekturentscheidungen/);
    const mixed = run(['new', '--title', 'Use Redis', '--lang', 'en'], dir);
    assert.equal(mixed.code, 2, mixed.text);
    assert.match(mixed.text, /written in de/);
    assert.equal(run(['lang'], dir).code, 0);
  } finally {
    cleanup();
  }
});

test('check names an ADR written in the other language than the rest of the log', () => {
  const { dir, cleanup } = tempRepo();
  try {
    write(dir, 'docs/adr/001-a.md', `# ADR-001: A\n\n**Date:** 2026-01-01 · **Status:** accepted\n\n${EN_PROSE}\n`);
    write(dir, 'docs/adr/002-b.md', `# ADR-002: B\n\n**Date:** 2026-01-01 · **Status:** accepted\n\n${EN_PROSE}\n`);
    write(dir, 'docs/adr/003-c.md', `# ADR-003: C\n\n**Datum:** 2026-01-01 · **Status:** gültig\n\n${DE_PROSE}\n`);
    const warnings = checkLog(dir, 'docs/adr').issues.filter((i) => i.kind === 'warning' && /written in/.test(i.message));
    assert.deepEqual(warnings.map((w) => w.file), ['docs/adr/003-c.md']);
  } finally {
    cleanup();
  }
});

test('writes stay inside the repository and out of .claude/ and .git/', () => {
  const { dir, cleanup } = tempRepo();
  const outside = mkdtempSync(join(tmpdir(), 'adr-outside-'));
  try {
    write(dir, 'README.md', EN_PROSE);
    assert.equal(refuseWrite(dir, 'docs/adr', dir), undefined);
    assert.match(refuseWrite(dir, '../escape', dir), /outside the repository/);
    assert.match(refuseWrite(dir, outside, dir) ?? '', /outside the repository/);
    assert.match(refuseWrite(dir, '.claude/rules', dir), /\.claude/);
    assert.match(refuseWrite(dir, 'docs/.git/x', dir), /\.git/);
    assert.match(refuseWrite(outside, 'docs/adr', dir), /outside the repository/);
    const r = run(['new', '--title', 'Planted', '--log', '.claude/rules', '--lang', 'en'], dir);
    assert.equal(r.code, 2, r.text);
    assert.ok(!existsSync(join(dir, '.claude')), 'nothing written into .claude/');
  } finally {
    cleanup();
    rmSync(outside, { recursive: true, force: true });
  }
});

test('the index renders one row per ADR and replaces only the marked block', () => {
  const adrs = [parseAdr(EN_ADR, '003-rest-only.md')];
  const table = renderIndex(adrs, 3, 'en');
  assert.match(table, /\| \[003\]\(003-rest-only\.md\) \| 2026-03-02 \| REST only, no GraphQL endpoints in new modules \| accepted \|/);
  const readme = `intro\n${INDEX_START}\nold\n<!-- adr-index:end -->\noutro\n`;
  const next = replaceIndex(readme, table);
  assert.ok(next.startsWith('intro\n'));
  assert.ok(next.endsWith('<!-- adr-index:end -->\noutro\n'));
  assert.ok(!next.includes('old'));
  assert.equal(replaceIndex('no markers', table), undefined);
});
