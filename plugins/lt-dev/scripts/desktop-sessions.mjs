#!/usr/bin/env node
// desktop-sessions.mjs
//
// Claude Desktop keeps its session list per Claude account. After switching accounts (a weekly limit is the usual
// reason) the sessions of the previous account are missing from the sidebar, although their transcripts under
// ~/.claude/projects are shared by every account. This script lists those sessions with the context needed to choose,
// and hands the chosen ones over to the account Desktop is signed in with now, history included, through the official
// route: `claude --desktop --resume <cliSessionId>` in the session's original folder.
//
//   node desktop-sessions.mjs [list] [--days N] [--json]
//   node desktop-sessions.mjs carry --id <cliSessionId> [--id …] [--json] [--no-pty]
//   node desktop-sessions.mjs hook        SessionStart: context JSON once per newly found session, otherwise nothing
//
// Exit codes: 0 done, 1 no Claude Desktop data on this machine, 2 usage error.
//
// Where it reads (all overridable, the tests use fixtures):
//   LT_DESKTOP_APP_DIR      the Desktop app folder (macOS ~/Library/Application Support/Claude, Windows %APPDATA%\Claude)
//   CLAUDE_CONFIG_DIR       the Claude Code folder holding projects/<dir>/<id>.jsonl (default ~/.claude)
//   LT_DESKTOP_CLAUDE_BIN   the CLI to hand over with (default: claude on PATH, then the CLI Desktop bundles)
//   LT_DESKTOP_CARRY_WAIT_MS how long to wait for Desktop to write the new session entry (default 20000)
//   CLAUDE_PLUGIN_DATA      where the hook remembers which sessions it already named
//
// It never writes into the app folder. From config.json it reads only `lastKnownAccountUuid`; the file also holds
// OAuth token caches, which are neither parsed nor printed.
//
// Windows has no `script` to give `--desktop` the terminal it insists on, and a ConPTY route would need a native
// package. There `carry` runs nothing and hands back the PowerShell command per session instead.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = 86_400_000;
const STATE_FILE = 'desktop-sessions-announced.json';
const STATE_KEEP_DAYS = 30;
const HOOK_LIST_CAP = 5;

// ── Locations ────────────────────────────────────────────────────────────────────────────────────────────────────

export function resolveAppDir({ env = process.env, home = os.homedir(), platform = process.platform } = {}) {
  if (env.LT_DESKTOP_APP_DIR) return env.LT_DESKTOP_APP_DIR;
  if (platform === 'darwin') return path.join(home, 'Library', 'Application Support', 'Claude');
  if (platform === 'win32') return env.APPDATA ? path.join(env.APPDATA, 'Claude') : null;
  return null;
}

export function resolveConfigDir({ env = process.env, home = os.homedir() } = {}) {
  return env.CLAUDE_CONFIG_DIR || path.join(home, '.claude');
}

/** The account Desktop is signed in with. Only this one key is taken from config.json, by pattern. */
export function readActiveAccount(appDir) {
  let text;
  try {
    text = fs.readFileSync(path.join(appDir, 'config.json'), 'utf8');
  } catch {
    return null;
  }
  return text.match(/"lastKnownAccountUuid"\s*:\s*"([^"\\]+)"/)?.[1] ?? null;
}

const isDir = (p) => {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
};

const listDirs = (p) => {
  try {
    return fs
      .readdirSync(p, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    return [];
  }
};

/** Every Desktop session entry on this machine: claude-code-sessions/<account>/<organization>/local_*.json. */
export function loadSessions(appDir) {
  const root = path.join(appDir, 'claude-code-sessions');
  const sessions = [];
  for (const account of listDirs(root)) {
    for (const org of listDirs(path.join(root, account))) {
      const dir = path.join(root, account, org);
      let files = [];
      try {
        files = fs.readdirSync(dir).filter((f) => /^local_.+\.json$/.test(f));
      } catch {
        continue;
      }
      for (const file of files) {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
          sessions.push({ account, data, desktopId: file.slice(0, -'.json'.length), dir });
        } catch {
          // An entry Desktop is writing right now, or a broken one: not a candidate.
        }
      }
    }
  }
  return sessions;
}

function transcriptFinder(configDir) {
  const projects = path.join(configDir, 'projects');
  const dirs = listDirs(projects);
  return (id) => {
    for (const d of dirs) {
      const file = path.join(projects, d, `${id}.jsonl`);
      if (fs.existsSync(file)) return file;
    }
    return null;
  };
}

// ── Context ──────────────────────────────────────────────────────────────────────────────────────────────────────

const cut = (text, max = 400) => {
  if (typeof text !== 'string' || !text.trim()) return null;
  const t = text.trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
};

/** The newest assistant text in a transcript, read from its end only, because transcripts reach tens of megabytes. */
export function lastAssistantText(file, { maxBytes = 262_144, maxChars = 400 } = {}) {
  let fd;
  try {
    fd = fs.openSync(file, 'r');
    const { size } = fs.fstatSync(fd);
    const start = Math.max(0, size - maxBytes);
    const buffer = Buffer.alloc(size - start);
    fs.readSync(fd, buffer, 0, buffer.length, start);
    const lines = buffer.toString('utf8').split('\n');
    if (start > 0) lines.shift();
    for (let i = lines.length - 1; i >= 0; i--) {
      let entry;
      try {
        entry = JSON.parse(lines[i]);
      } catch {
        continue;
      }
      if (entry?.type !== 'assistant') continue;
      const content = entry.message?.content;
      const text =
        typeof content === 'string'
          ? content
          : Array.isArray(content)
            ? content
                .filter((part) => part?.type === 'text' && typeof part.text === 'string')
                .map((part) => part.text)
                .join('\n')
            : '';
      if (text.trim()) return cut(text, maxChars);
    }
    return null;
  } catch {
    return null;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

// ── Candidates ───────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Sessions of other accounts that belong in the active one: not archived, active within `days`, not in the active
 * account yet (by file name, cliSessionId or lastAssistantCliSessionId), with a transcript and an existing folder.
 * The folder is the session's original one (`originCwd`), because `/desktop` from a CLI session that changed folders
 * records the last folder instead.
 */
export function findCandidates({ appDir, configDir, days = 7, now = Date.now(), withContext = true }) {
  const active = readActiveAccount(appDir);
  const sessions = loadSessions(appDir);
  const skipped = { alreadyActive: 0, archived: 0, noCwd: 0, noTranscript: 0, tooOld: 0 };
  if (!active) return { active: null, candidates: [], days, sessions, skipped };

  const activeSessions = sessions.filter((s) => s.account === active);
  const known = new Set();
  for (const s of activeSessions) {
    known.add(s.desktopId.replace(/^local_/, ''));
    if (s.data.cliSessionId) known.add(s.data.cliSessionId);
    if (s.data.lastAssistantCliSessionId) known.add(s.data.lastAssistantCliSessionId);
  }

  const transcriptOf = transcriptFinder(configDir);
  const candidates = [];
  for (const s of sessions) {
    if (s.account === active) continue;
    const d = s.data;
    if (d.isArchived) {
      skipped.archived++;
      continue;
    }
    if (!(now - (Number(d.lastActivityAt) || 0) <= days * DAY)) {
      skipped.tooOld++;
      continue;
    }
    const id = d.cliSessionId;
    if (known.has(s.desktopId.replace(/^local_/, '')) || known.has(id) || known.has(d.lastAssistantCliSessionId)) {
      skipped.alreadyActive++;
      continue;
    }
    const transcript = typeof id === 'string' && UUID.test(id) ? transcriptOf(id) : null;
    if (!transcript) {
      skipped.noTranscript++;
      continue;
    }
    const cwd = [d.originCwd, d.cwd].find((p) => typeof p === 'string' && isDir(p));
    if (!cwd) {
      skipped.noCwd++;
      continue;
    }
    candidates.push({
      account: s.account,
      cliSessionId: id,
      cwd,
      desktopId: s.desktopId,
      error: cut(d.error, 200),
      lastActivityAt: Number(d.lastActivityAt) || null,
      lastAssistant: withContext ? lastAssistantText(transcript) : null,
      lastTurnReport: cut(d.lastTurnReport),
      name: d.spawnedFrom?.name ?? null,
      parentDesktopId: d.spawnedFrom?.sessionId ?? null,
      prs: (Array.isArray(d.prs) ? d.prs : []).map((pr) => ({ branch: pr.branch, state: pr.state, url: pr.url })),
      queuedNotes: (Array.isArray(d.queuedSideSessionNotes) ? d.queuedSideSessionNotes : []).map((n) => ({
        body: n.body ?? null,
        report: n.report ?? null,
        sessionId: n.sessionId ?? null,
        title: n.title ?? null,
      })),
      sideReports: (Array.isArray(d.sideSessionNotes) ? d.sideSessionNotes : [])
        .slice(-3)
        .map((n) => ({ report: cut(n.report, 200), title: n.title ?? null })),
      title: cut(d.title, 120) ?? '(ohne Titel)',
      transcript,
      writtenBranches: Array.isArray(d.writtenBranches) ? d.writtenBranches : [],
    });
  }
  candidates.sort((a, b) => (b.lastActivityAt ?? 0) - (a.lastActivityAt ?? 0));
  return { active, candidates, days, sessions, skipped };
}

/**
 * Families for the choice: a main session with the sub-sessions it spawned (`spawnedFrom.sessionId`) is one unit,
 * so they move together and the main moves first. A sub-session whose main is not a candidate names where the main
 * is now (`mainElsewhere`), so it can be told its main's new id.
 */
export function groupFamilies({ active, candidates, sessions }) {
  const families = new Map();
  const familyOf = (key) => {
    if (!families.has(key)) families.set(key, { children: [], key, main: null, mainElsewhere: null });
    return families.get(key);
  };
  for (const c of candidates) {
    if (c.parentDesktopId) familyOf(c.parentDesktopId).children.push(c);
    else familyOf(c.desktopId).main = c;
  }
  for (const family of families.values()) {
    if (family.main) continue;
    const parent = sessions.find((s) => s.desktopId === family.key);
    if (!parent) continue;
    const pid = parent.data.cliSessionId;
    const here = sessions.find(
      (s) => s.account === active && (s.desktopId === `local_${pid}` || s.data.cliSessionId === pid),
    );
    family.mainElsewhere = { desktopId: here?.desktopId ?? null, title: parent.data.title ?? null };
  }
  const newest = (f) => Math.max(...[f.main, ...f.children].filter(Boolean).map((c) => c.lastActivityAt ?? 0));
  return [...families.values()].sort((a, b) => newest(b) - newest(a));
}

// ── Handover ─────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The handover line for PowerShell. PowerShell ends a single-quoted string at any of five quote characters (the ASCII
 * one and U+2018 to U+201B), so each is doubled: a folder named `Kai’s Projekte` or one carrying `’; iex …` from an
 * extracted archive must stay inside the literal.
 */
export function powershellCommand(cwd, id) {
  const literal = String(cwd).replace(/['‘’‚‛]/g, (q) => q + q);
  return `Set-Location -LiteralPath '${literal}'; claude --desktop --resume ${id}`;
}

/** The CLI to hand over with: the override, `claude` on PATH, then the newest CLI Desktop bundles. */
export function resolveClaudeBin({ appDir, env = process.env, platform = process.platform } = {}) {
  if (env.LT_DESKTOP_CLAUDE_BIN) return env.LT_DESKTOP_CLAUDE_BIN;
  const names = platform === 'win32' ? ['claude.exe', 'claude.cmd'] : ['claude'];
  for (const dir of String(env.PATH ?? '').split(path.delimiter)) {
    for (const name of names) {
      const candidate = path.join(dir, name);
      if (dir && fs.existsSync(candidate)) return candidate;
    }
  }
  if (!appDir) return null;
  const bundled = path.join(appDir, 'claude-code');
  const versions = listDirs(bundled).sort((a, b) => b.localeCompare(a, 'en', { numeric: true }));
  for (const version of versions) {
    for (const build of listDirs(path.join(bundled, version))) {
      const file =
        platform === 'win32'
          ? path.join(bundled, version, build, 'claude.exe')
          : path.join(bundled, version, build, 'claude.app', 'Contents', 'MacOS', 'claude');
      if (fs.existsSync(file)) return file;
    }
  }
  return null;
}

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

const samePath = (a, b, platform) => {
  const norm = (p) => {
    let r;
    try {
      r = fs.realpathSync(p);
    } catch {
      r = path.resolve(p);
    }
    return platform === 'win32' ? r.toLowerCase() : r;
  };
  return norm(a) === norm(b);
};

function activeEntry(appDir, active, id) {
  const root = path.join(appDir, 'claude-code-sessions', active);
  for (const org of listDirs(root)) {
    const file = path.join(root, org, `local_${id}.json`);
    if (fs.existsSync(file)) return file;
  }
  return null;
}

/**
 * Hands one session over to the active account and checks the result. Statuses: carried, open-in-terminal (the CLI
 * refuses while a terminal holds the session), cwd-mismatch (the new entry works in another folder), failed, and
 * manual on Windows (the command to run by hand).
 */
export function carrySession(
  c,
  {
    active,
    appDir,
    bin,
    env = process.env,
    platform = process.platform,
    pollMs = 250,
    timeoutMs = 90_000,
    usePty = platform === 'darwin',
    waitMs = 20_000,
  },
) {
  const base = {
    cliSessionId: c.cliSessionId,
    cwd: c.cwd,
    desktopId: c.desktopId,
    newDesktopId: `local_${c.cliSessionId}`,
    title: c.title,
  };
  if (!UUID.test(String(c.cliSessionId))) return { ...base, detail: 'ungültige Session-ID', status: 'failed' };
  if (platform === 'win32') {
    return {
      ...base,
      command: powershellCommand(c.cwd, c.cliSessionId),
      detail: 'Unter Windows im Terminal ausführen',
      status: 'manual',
    };
  }
  if (!bin) return { ...base, detail: 'claude nicht gefunden (weder im PATH noch in Claude Desktop)', status: 'failed' };

  const resumeArgs = ['--desktop', '--resume', c.cliSessionId];
  let cmd = bin;
  let args = resumeArgs;
  if (/\.(c|m)?js$/.test(bin)) {
    cmd = process.execPath;
    args = [bin, ...resumeArgs];
  }
  if (usePty) {
    // `--desktop` refuses to run without a terminal; script(1) on macOS provides one.
    args = ['-q', '/dev/null', cmd, ...args];
    cmd = 'script';
  }
  const r = spawnSync(cmd, args, {
    cwd: c.cwd,
    encoding: 'utf8',
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: timeoutMs,
  });
  // Strips the terminal escapes script(1) passes through.
  const out = `${r.stdout ?? ''}\n${r.stderr ?? ''}`.replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, '').replace(/\r/g, '');
  const lines = out
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const openLine = lines.find((l) => /is open in another terminal/i.test(l));
  if (openLine) return { ...base, detail: openLine, status: 'open-in-terminal' };
  if (r.error) return { ...base, detail: r.error.message, status: 'failed' };
  if (r.status !== 0) return { ...base, detail: lines[0] ?? `Exit ${r.status}`, status: 'failed' };

  const deadline = Date.now() + waitMs;
  let entry = activeEntry(appDir, active, c.cliSessionId);
  while (!entry && Date.now() < deadline) {
    sleep(pollMs);
    entry = activeEntry(appDir, active, c.cliSessionId);
  }
  if (!entry) {
    return {
      ...base,
      detail: `Kein Eintrag local_${c.cliSessionId}.json im aktiven Account nach ${Math.round(waitMs / 1000)} s`,
      status: 'failed',
    };
  }
  let newCwd = null;
  try {
    newCwd = JSON.parse(fs.readFileSync(entry, 'utf8')).cwd ?? null;
  } catch {
    // The entry is still being written; the folder check is left out rather than guessed.
  }
  if (newCwd && !samePath(newCwd, c.cwd, platform)) {
    return { ...base, detail: `Der neue Eintrag arbeitet in ${newCwd}, erwartet war ${c.cwd}`, status: 'cwd-mismatch' };
  }
  return { ...base, status: 'carried' };
}

// ── Hook ─────────────────────────────────────────────────────────────────────────────────────────────────────────

function readState(file) {
  try {
    const state = JSON.parse(fs.readFileSync(file, 'utf8'));
    return state && typeof state.announced === 'object' && state.announced ? state : { announced: {} };
  } catch {
    return { announced: {} };
  }
}

/**
 * SessionStart context naming the sessions this machine has not announced yet, or null. Each session is named once;
 * the list in the text is capped and says how many it left out.
 */
export function hookReport({ appDir, configDir, days = 7, now = Date.now(), stateFile }) {
  const { active, candidates } = findCandidates({ appDir, configDir, days, now, withContext: false });
  if (!active || candidates.length === 0) return null;
  const state = readState(stateFile);
  const fresh = candidates.filter((c) => !state.announced[c.cliSessionId]);
  if (fresh.length === 0) return null;

  for (const c of fresh) state.announced[c.cliSessionId] = now;
  for (const [id, at] of Object.entries(state.announced)) {
    if (now - at > STATE_KEEP_DAYS * DAY) delete state.announced[id];
  }
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  fs.writeFileSync(stateFile, `${JSON.stringify(state, null, 2)}\n`);

  const n = fresh.length;
  const titles =
    fresh
      .slice(0, HOOK_LIST_CAP)
      .map((c) => `„${c.title}“`)
      .join(', ') + (n > HOOK_LIST_CAP ? ` und ${n - HOOK_LIST_CAP} weitere` : '');
  const additionalContext =
    `Claude Desktop: Im Claude-Account, der vorher angemeldet war, liegen ${n === 1 ? '1 Session' : `${n} Sessions`} ` +
    `aus den letzten ${days} Tagen, die in diesem Account fehlen: ${titles}. ` +
    'Der Nutzer weiß davon noch nichts. Mit /lt-dev:desktop-sessions sieht er sie mit Kontext und holt die ' +
    'ausgewählten samt Verlauf in diesen Account.';
  return JSON.stringify({ hookSpecificOutput: { additionalContext, hookEventName: 'SessionStart' } });
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────────────────────────────

const STATUS_DE = {
  carried: 'übernommen',
  'cwd-mismatch': 'übernommen, aber anderer Ordner',
  failed: 'fehlgeschlagen',
  manual: 'von Hand ausführen',
  'open-in-terminal': 'offen in einem Terminal',
};

const tilde = (p) => (p && p.startsWith(os.homedir()) ? `~${p.slice(os.homedir().length)}` : p);
const when = (ms) =>
  ms
    ? new Date(ms).toLocaleString('de-DE', { day: '2-digit', hour: '2-digit', minute: '2-digit', month: '2-digit' })
    : '?';

function printList(result, families) {
  const s = result.skipped;
  const lines = [
    `Aktiver Account: ${result.active.slice(0, 8)}… · Sessions anderer Accounts aus den letzten ${result.days} Tagen: ${result.candidates.length}`,
    `Nicht zur Wahl: ${s.alreadyActive} schon hier, ${s.archived} archiviert, ${s.tooOld} älter, ${s.noTranscript} ohne Transkript, ${s.noCwd} ohne Ordner`,
  ];
  families.forEach((f, i) => {
    lines.push('', `${i + 1}. ${f.main ? `„${f.main.title}“` : `Sub-Sessions von „${f.mainElsewhere?.title ?? '?'}“`}`);
    for (const c of [f.main, ...f.children].filter(Boolean)) {
      const prefix = c === f.main ? '   ' : `   Sub-Session ${c.name ? `${c.name} ` : ''}„${c.title}“: `;
      lines.push(`${prefix}zuletzt aktiv ${when(c.lastActivityAt)} · Ordner ${tilde(c.cwd)} · ID ${c.cliSessionId}`);
      if (c.error) lines.push(`   Abbruch: ${c.error}`);
      if (c.lastTurnReport) lines.push(`   Letzter Stand: ${c.lastTurnReport}`);
      if (c.lastAssistant) lines.push(`   Letzte Antwort: ${c.lastAssistant}`);
      for (const pr of c.prs) lines.push(`   PR: ${pr.url} (${pr.branch ?? '?'}, ${pr.state ?? '?'})`);
      if (c.writtenBranches.length) lines.push(`   Branches: ${c.writtenBranches.join(', ')}`);
      for (const r of c.sideReports) lines.push(`   Bericht ${r.title ? `„${r.title}“` : ''}: ${r.report ?? ''}`);
      if (c.queuedNotes.length) lines.push(`   Nicht zugestellte Berichte: ${c.queuedNotes.length}`);
    }
    if (!f.main && f.mainElsewhere?.desktopId) lines.push(`   Main-Session ist schon hier: ${f.mainElsewhere.desktopId}`);
  });
  process.stdout.write(`${lines.join('\n')}\n`);
}

function parseArgs(argv) {
  const opts = { days: 7, ids: [], json: false, pty: true, sub: 'list' };
  const rest = [...argv];
  if (rest[0] && !rest[0].startsWith('--')) opts.sub = rest.shift();
  while (rest.length) {
    const a = rest.shift();
    if (a === '--json') opts.json = true;
    else if (a === '--no-pty') opts.pty = false;
    else if (a === '--days') opts.days = Number(rest.shift());
    else if (a === '--id') opts.ids.push(String(rest.shift() ?? ''));
    else throw new Error(`Unbekannte Option: ${a}`);
  }
  if (!Number.isFinite(opts.days) || opts.days <= 0) throw new Error('--days braucht eine positive Zahl');
  return opts;
}

function main(argv) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (e) {
    process.stderr.write(`${e.message}\n`);
    return 2;
  }
  const appDir = resolveAppDir();
  const configDir = resolveConfigDir();
  const hasDesktop = appDir && isDir(path.join(appDir, 'claude-code-sessions'));

  if (opts.sub === 'hook') {
    if (!hasDesktop) return 0;
    try {
      const dataDir = process.env.CLAUDE_PLUGIN_DATA || path.join(configDir, 'plugins', 'data', 'lt-dev-lenne-tech');
      const out = hookReport({ appDir, configDir, days: opts.days, stateFile: path.join(dataDir, STATE_FILE) });
      if (out) process.stdout.write(`${out}\n`);
    } catch {
      // A session start never fails because of this hint.
    }
    return 0;
  }

  if (!hasDesktop) {
    process.stderr.write('Keine Daten von Claude Desktop auf diesem Rechner gefunden.\n');
    return 1;
  }
  // `carry` takes ids the user picked from a list, maybe one with a wider --days, maybe a while ago: the age window
  // applies to the list, not to the choice. Archived and already carried sessions stay out either way.
  const result = findCandidates({ appDir, configDir, days: opts.sub === 'carry' ? Number.POSITIVE_INFINITY : opts.days });
  if (!result.active) {
    process.stderr.write('Der angemeldete Desktop-Account ließ sich nicht bestimmen (config.json).\n');
    return 1;
  }
  const families = groupFamilies(result);

  if (opts.sub === 'list') {
    const strip = (c) => c && (({ transcript, ...rest }) => rest)(c);
    if (opts.json) {
      const payload = {
        active: result.active,
        days: result.days,
        families: families.map((f) => ({ ...f, children: f.children.map(strip), main: strip(f.main) })),
        platform: process.platform,
        skipped: result.skipped,
      };
      process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    } else printList(result, families);
    return 0;
  }

  if (opts.sub === 'carry') {
    if (opts.ids.length === 0) {
      process.stderr.write('carry übernimmt nur ausgewählte Sessions: mindestens ein --id <cliSessionId> angeben.\n');
      return 2;
    }
    const byId = new Map(result.candidates.map((c) => [c.cliSessionId, c]));
    const unknown = opts.ids.filter((id) => !byId.has(id));
    if (unknown.length) {
      process.stderr.write(`kein Kandidat: ${unknown.join(', ')} (siehe list)\n`);
      return 2;
    }
    const chosen = [...new Set(opts.ids)].map((id) => byId.get(id));
    chosen.sort((a, b) => Number(Boolean(a.parentDesktopId)) - Number(Boolean(b.parentDesktopId)));
    const bin = resolveClaudeBin({ appDir });
    const waitMs = Number(process.env.LT_DESKTOP_CARRY_WAIT_MS) || 20_000;
    const carriedMain = new Map();
    const results = [];
    for (const c of chosen) {
      const r = carrySession(c, { active: result.active, appDir, bin, usePty: opts.pty && process.platform === 'darwin', waitMs });
      if (!c.parentDesktopId && (r.status === 'carried' || r.status === 'cwd-mismatch')) {
        carriedMain.set(c.desktopId, r.newDesktopId);
      }
      const family = families.find((f) => f.key === (c.parentDesktopId ?? c.desktopId));
      results.push({
        ...r,
        name: c.name,
        parentDesktopId: c.parentDesktopId,
        parentNewDesktopId: c.parentDesktopId
          ? (carriedMain.get(c.parentDesktopId) ?? family?.mainElsewhere?.desktopId ?? null)
          : null,
        queuedNotes: c.parentDesktopId ? [] : c.queuedNotes,
      });
    }
    if (opts.json) process.stdout.write(`${JSON.stringify({ active: result.active, results }, null, 2)}\n`);
    else {
      for (const r of results) {
        process.stdout.write(`„${r.title}“: ${STATUS_DE[r.status] ?? r.status}${r.detail ? ` (${r.detail})` : ''}\n`);
        if (r.command) process.stdout.write(`   ${r.command}\n`);
      }
    }
    return 0;
  }

  process.stderr.write(`Unbekannter Befehl: ${opts.sub} (list, carry, hook)\n`);
  return 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2));
}
