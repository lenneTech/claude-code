#!/usr/bin/env node
// screenshot-session.mjs — work folder, session state and teardown for one screenshot run.
//
// Every run lives in ~/.lt-showroom/<slug>/ (override: LT_SHOWROOM_HOME):
//   checkout/        throwaway clone the project is started from (never the developer's checkout)
//   screenshots/     the WebP files the run delivers           (kept by cleanup)
//   manifest.json    one entry per image plus run metadata      (kept by cleanup)
//   logs/            output of processes started through `run`
//   session.json     everything the run started, so cleanup can stop exactly that and nothing else
//
// Cleanup only touches what session.json records: process groups started through `run` (checked
// against their start time, so a reused PID is never hit), the `lt ticket` stack, Compose projects,
// containers and volumes the run created, and the work folder minus its deliverables. It never
// searches for processes by name or port.
//
// Usage: node screenshot-session.mjs <command> [args]   (see USAGE below)

import { spawn, spawnSync } from 'node:child_process';
import {
  closeSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const USAGE = `Usage: node screenshot-session.mjs <command> [args]

Session
  slug <path-or-url>                         print the work-folder slug for a project
  start <slug> [--source <path-or-url>]      open a session (cleans an abandoned earlier run first)
  clone <slug> <path-or-url> [--ref <branch>] clone the project into <work>/checkout
  run <slug> <name> --cwd <dir> [--env K=V]... -- <command> [args...]
                                             start a long-running process in its own process group
  compose-file <slug> --cwd <dir> [--files a.yml,b.yml]
                                             write an isolated copy of the Compose project and record it
                                             (no fixed volume, network or container names; refuses bind
                                             mounts outside the clone)
  record <slug> <type> <value> [--cwd <dir>] record a resource: lt-ticket | compose | container | volume
  elapsed <slug>                             minutes used of the time budget (LT_SHOWROOM_BUDGET_MIN, default 45)
  status [<slug>]                            show open sessions
  verify-source <slug>                       exit 2 if the local checkout given to start changed since then
  cleanup <slug> [--keep-checkout]           stop and remove everything the session recorded
                                             (--keep-checkout: stop the stack, keep the clone and the session)
  sweep [--session <id>] [--detach]          clean sessions whose Claude process is gone (or that belong to <id>)

Checks
  check-db <uri>... [--compose-services a,b] exit 2 unless every database URI points at this machine
  check-db --scan <dir>                      the same for every URI in the env and Compose files under <dir>
  connections <slug>                         exit 2 if a process of the run talks to a remote database port
  wait-http <url> [--timeout <s>]            wait until a local URL answers (only localhost, *.localhost, 127.0.0.1)
  free-port                                  print a free TCP port on 127.0.0.1

Manifest
  capture-path <slug> <feature> <device>     where take_screenshot saves a capture (Chrome DevTools MCP writes
                                             only below the workspace roots and the temp folder)
  manifest add <slug> --file <webp> --feature <slug> --device desktop|mobile|cover
               --level local|demo-access|public|legacy|teaser [--page <url-or-path>]
               [--customer-branding] [--shows-people] [--anonymized]
  manifest remove <slug> <feature> <device>  drop an image that failed the visual check (entry and file)
  manifest meta <slug> <key>=<value>...      set run metadata (pendingTag, liveCheck.*, notes …)
  manifest show <slug>
`;

const HOME_DIR = process.env.LT_SHOWROOM_HOME || path.join(os.homedir(), '.lt-showroom');
const BUDGET_MIN = Number(process.env.LT_SHOWROOM_BUDGET_MIN || 45);
const KEEP = new Set(['screenshots', 'manifest.json']);
const NO_PUSH_URL = 'no-push://lt-showroom-throwaway-clone';
const LEVELS = ['local', 'demo-access', 'public', 'legacy', 'teaser'];
const DB_PORTS = new Set([27017, 27018, 27019, 5432, 3306, 6379, 6380, 5672, 9200, 6333, 6334]);
/** Device → the exact pixel size a capture at the agreed emulation must have. */
export const DEVICE_SIZES = { desktop: [1440, 900], mobile: [780, 1688] };

// ── pure helpers (exported for the tests) ────────────────────────────────────────────────

export function slugify(input) {
  const s = String(input)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
  return s || 'project';
}

export function looksLikeUrl(input) {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(input) || /^[\w.-]+@[\w.-]+:/.test(input);
}

/** Repository name from a clone URL (https, ssh, scp-like) or a path. */
export function repoName(source) {
  const trimmed = String(source).replace(/[/\\]+$/, '').replace(/\.git$/i, '');
  const last = trimmed.split(/[/\\:]/).pop();
  return last || trimmed;
}

export function slugForSource(source) {
  if (!looksLikeUrl(source) && existsSync(source) && statSync(source).isDirectory()) {
    const origin = git(['-C', source, 'remote', 'get-url', 'origin']);
    if (origin) return slugify(repoName(origin));
    return slugify(path.basename(path.resolve(source)));
  }
  return slugify(repoName(source));
}

export function isInside(dir, candidate) {
  const rel = path.relative(path.resolve(dir), path.resolve(candidate));
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

const LOCAL_HOSTS = new Set(['localhost', '::1', '0.0.0.0', 'host.docker.internal']);

export function isLocalHost(host, composeServices = []) {
  const h = String(host).toLowerCase().replace(/^\[|\]$/g, '');
  if (LOCAL_HOSTS.has(h) || h.endsWith('.localhost')) return true;
  if (/^127(?:\.\d{1,3}){3}$/.test(h)) return true;
  if (/^::ffff:127(?:\.\d{1,3}){3}$/.test(h)) return true;
  return composeServices.map((s) => s.toLowerCase()).includes(h);
}

/** Masks the password in a connection URI so it can be printed. */
export function redactUri(uri) {
  return String(uri).replace(/(\/\/[^:/@]+:)[^@/]*@/, '$1***@');
}

/**
 * Classifies a database URI: `local` when every host is this machine (or a service of the
 * session's own Compose project), `remote` otherwise. `mongodb+srv` always resolves through DNS
 * to a remote cluster.
 */
export function classifyUri(uri, composeServices = []) {
  const m = /^([a-z][a-z0-9+.-]*):\/\/(?:[^@/]*@)?([^/?#]*)/i.exec(String(uri).trim());
  if (!m) return { uri: redactUri(uri), verdict: 'unknown', hosts: [], reason: 'not a URI' };
  const scheme = m[1].toLowerCase();
  const hosts = m[2]
    .split(',')
    .map((h) => h.trim())
    .filter(Boolean)
    .map((h) => (h.startsWith('[') ? h.slice(0, h.indexOf(']') + 1) : h.replace(/:\d+$/, '')));
  if (scheme === 'mongodb+srv') {
    return { uri: redactUri(uri), verdict: 'remote', hosts, reason: 'mongodb+srv resolves to a remote cluster' };
  }
  if (hosts.length === 0) return { uri: redactUri(uri), verdict: 'unknown', hosts, reason: 'no host' };
  const foreign = hosts.filter((h) => !isLocalHost(h, composeServices));
  return foreign.length === 0
    ? { uri: redactUri(uri), verdict: 'local', hosts, reason: '' }
    : { uri: redactUri(uri), verdict: 'remote', hosts, reason: `not on this machine: ${foreign.join(', ')}` };
}

const URI_RE = /\b(?:mongodb(?:\+srv)?|postgres(?:ql)?|mysql|mariadb|rediss?|amqps?):\/\/[^\s'"`<>]+/gi;
// Env files a dev start reads, plus .env.example because the run copies it to .env in the clone.
const ENV_FILE_RE = /^\.env(?:\.(?:local|development|development\.local|dev|example|sample|dist))?$/;
const COMPOSE_FILE_RE = /^(?:docker-)?compose(?:\.[\w-]+)?\.ya?ml$/;

function listCandidateFiles(dir, depth = 0, out = []) {
  if (depth > 3) return out;
  let entries = [];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (['node_modules', '.git', 'dist', '.nuxt', '.output', 'build'].includes(e.name)) continue;
      listCandidateFiles(path.join(dir, e.name), depth + 1, out);
    } else if (ENV_FILE_RE.test(e.name) || COMPOSE_FILE_RE.test(e.name)) {
      out.push(path.join(dir, e.name));
    }
  }
  return out;
}

/** Service names declared in a Compose file (keys directly under `services:`). */
export function composeServiceNames(text) {
  const names = [];
  let inServices = false;
  let indent = null;
  for (const line of text.split(/\r?\n/)) {
    if (/^services:\s*$/.test(line)) {
      inServices = true;
      indent = null;
      continue;
    }
    if (inServices && /^\S/.test(line)) inServices = false;
    if (!inServices) continue;
    const m = /^(\s+)([A-Za-z0-9._-]+):\s*(?:#.*)?$/.exec(line);
    if (!m) continue;
    if (indent === null) indent = m[1].length;
    if (m[1].length === indent) names.push(m[2]);
  }
  return names;
}

/** Every database URI in the env and Compose files under `dir`, classified. */
export function scanForUris(dir) {
  const files = listCandidateFiles(dir);
  const services = files
    .filter((f) => COMPOSE_FILE_RE.test(path.basename(f)))
    .flatMap((f) => composeServiceNames(readFileSync(f, 'utf8')));
  const findings = [];
  for (const file of files) {
    readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .forEach((line, i) => {
        if (/^\s*#/.test(line)) return;
        for (const uri of line.match(URI_RE) ?? []) {
          findings.push({ file: path.relative(dir, file), line: i + 1, ...classifyUri(uri, services) });
        }
      });
  }
  return { services, findings };
}

/** Width and height of a WebP file from its header (VP8, VP8L, VP8X); null if it is no WebP. */
export function webpSize(buf) {
  if (buf.length < 30 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') {
    return null;
  }
  const chunk = buf.toString('ascii', 12, 16);
  if (chunk === 'VP8X') {
    return [1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3)];
  }
  if (chunk === 'VP8 ') {
    if (buf[23] !== 0x9d || buf[24] !== 0x01 || buf[25] !== 0x2a) return null;
    return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
  }
  if (chunk === 'VP8L') {
    if (buf[20] !== 0x2f) return null;
    const b = buf.readUInt32LE(21);
    return [1 + (b & 0x3fff), 1 + ((b >>> 14) & 0x3fff)];
  }
  return null;
}

/**
 * Makes a resolved Compose config (`docker compose config --format json`) safe to start next to the
 * developer's own stack: a volume or network with a fixed `name:` or `external: true` would otherwise
 * be the developer's real one, so the run's demo data (or a seed that empties collections first)
 * would land in their database, and a shared network lets a service name resolve to their
 * container. Fixed `container_name`s are dropped too, so nothing collides. Bind mounts outside
 * `cloneDir` are reported as `unsafeBinds`: the caller refuses to start them.
 */
export function isolateCompose(config, cloneDir) {
  const cfg = JSON.parse(JSON.stringify(config));
  const changes = [];
  const unsafeBinds = [];
  for (const kind of ['volumes', 'networks']) {
    for (const [key, def] of Object.entries(cfg[kind] ?? {})) {
      if (!def || typeof def !== 'object') continue;
      if (def.external) {
        changes.push(`${kind}.${key}: external dropped (was ${def.name ?? key})`);
        delete def.external;
        delete def.name;
      } else if (def.name && def.name !== `${cfg.name}_${key}`) {
        changes.push(`${kind}.${key}: fixed name ${def.name} dropped`);
        delete def.name;
      }
    }
  }
  for (const [name, svc] of Object.entries(cfg.services ?? {})) {
    if (svc.container_name) {
      changes.push(`services.${name}: container_name ${svc.container_name} dropped`);
      delete svc.container_name;
    }
    for (const v of svc.volumes ?? []) {
      if (v && v.type === 'bind' && v.source && !(path.resolve(v.source) === path.resolve(cloneDir) || isInside(cloneDir, v.source))) {
        unsafeBinds.push(`services.${name}: ${v.source} -> ${v.target}`);
      }
    }
  }
  return { config: cfg, changes, unsafeBinds };
}

// ── state ────────────────────────────────────────────────────────────────────────────────

const workDir = (slug) => path.join(HOME_DIR, slug);
/**
 * Captures land in the temp folder first: the browser MCP may write there, not to ~/.lt-showroom.
 * The root is per user and verified before every use. On a host with a shared /tmp, a folder or
 * symlink another user planted under a predictable name would otherwise steer the recursive
 * delete in cleanup into a directory of theirs choosing, or slip their file into the screenshots.
 */
export function captureRoot() {
  const id = typeof process.getuid === 'function' ? process.getuid() : os.userInfo().username;
  const root = path.join(os.tmpdir(), `lt-showroom-${id}`);
  try {
    mkdirSync(root, { recursive: true, mode: 0o700 });
    const st = lstatSync(root);
    const foreign =
      st.isSymbolicLink() ||
      !st.isDirectory() ||
      (process.platform !== 'win32' && (st.uid !== process.getuid() || (st.mode & 0o077) !== 0));
    if (foreign) return { root, error: `unsafe capture folder ${root}: it must be your own directory with mode 700` };
  } catch (e) {
    return { root, error: `capture folder ${root} unusable: ${e.code ?? e.message}` };
  }
  return { root, error: null };
}

function captureDir(slug) {
  const { root, error } = captureRoot();
  if (error) fail(error);
  return path.join(root, slug);
}
const sessionFile = (slug) => path.join(workDir(slug), 'session.json');
const manifestFile = (slug) => path.join(workDir(slug), 'manifest.json');

function readJson(file, fallback = null) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

function assertSlug(slug) {
  if (!/^[a-z0-9][a-z0-9-]{0,59}$/.test(slug ?? '')) fail(`invalid slug "${slug}" (use the output of \`slug\`)`);
}

function loadSession(slug) {
  assertSlug(slug);
  const s = readJson(sessionFile(slug));
  if (!s) fail(`no open session for "${slug}" — run \`start ${slug}\` first`);
  return s;
}

function saveSession(slug, s) {
  writeJson(sessionFile(slug), s);
}

function ownerNow() {
  return {
    pid: Number(process.env.CLAUDE_PID) || 0,
    sessionId: process.env.CLAUDE_CODE_SESSION_ID || '',
  };
}

export function pidAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
}

/** Start time of a process as the OS reports it; used to tell our PID from a reused one. */
function processStart(pid) {
  const r =
    process.platform === 'win32'
      ? spawnSync(
          'powershell',
          ['-NoProfile', '-Command', `(Get-Process -Id ${Number(pid)}).StartTime.ToUniversalTime().ToString('o')`],
          { encoding: 'utf8' },
        )
      : spawnSync('ps', ['-o', 'lstart=', '-p', String(pid)], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : '';
}

function ownerGone(s) {
  if (s.owner?.pid) return !pidAlive(s.owner.pid);
  // Unbound sessions (no CLAUDE_PID) count as abandoned after 12 hours.
  return Date.now() - Date.parse(s.startedAt) > 12 * 3600 * 1000;
}

// ── small process helpers ────────────────────────────────────────────────────────────────

function git(args, opts = {}) {
  const r = spawnSync('git', args, {
    encoding: 'utf8',
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    ...opts,
  });
  return r.status === 0 ? r.stdout.trim() : '';
}

function runQuiet(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', timeout: 180_000, ...opts });
  return { ok: r.status === 0, out: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim(), missing: r.error?.code === 'ENOENT' };
}

function fail(message, code = 1) {
  process.stderr.write(`error: ${message}\n`);
  process.exit(code);
}

function out(obj) {
  process.stdout.write(typeof obj === 'string' ? `${obj}\n` : `${JSON.stringify(obj, null, 2)}\n`);
}

function parseFlags(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') {
      flags['--'] = argv.slice(i + 1);
      break;
    }
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      const value = next !== undefined && !next.startsWith('--') ? (i++, next) : true;
      if (key === 'env') (flags.env ??= []).push(value);
      else flags[key] = value;
    } else positional.push(a);
  }
  return { flags, positional };
}

// ── commands ─────────────────────────────────────────────────────────────────────────────

function cmdStart(slug, flags) {
  assertSlug(slug);
  const sweepReport = sweep({});
  const existing = readJson(sessionFile(slug));
  const me = ownerNow();
  if (existing) {
    const foreign = existing.owner?.pid && existing.owner.pid !== me.pid && pidAlive(existing.owner.pid);
    if (foreign) {
      fail(`BUSY: another Claude session (pid ${existing.owner.pid}) runs screenshots for "${slug}" right now`, 3);
    }
    cleanup(slug, { quiet: true });
  }
  for (const d of ['screenshots', 'logs']) mkdirSync(path.join(workDir(slug), d), { recursive: true });
  const session = {
    slug,
    source: flags.source ?? null,
    startedAt: new Date().toISOString(),
    budgetMinutes: BUDGET_MIN,
    owner: me,
    checkout: null,
    resources: [],
  };
  saveSession(slug, session);
  const manifest = readJson(manifestFile(slug), null) ?? { slug, images: [] };
  manifest.runStartedAt = session.startedAt;
  // A local checkout is only read. Its state is kept with the deliverables, so `verify-source`
  // can prove at the end that the run left it exactly as it was.
  manifest.sourceCheckout = sourceCheckoutState(flags.source);
  writeJson(manifestFile(slug), manifest);
  out({
    workDir: workDir(slug),
    checkoutDir: path.join(workDir(slug), 'checkout'),
    screenshotsDir: path.join(workDir(slug), 'screenshots'),
    budgetMinutes: BUDGET_MIN,
    cleanedEarlierRun: Boolean(existing),
    sweptOtherSessions: sweepReport.map((r) => r.slug),
  });
}

function sourceCheckoutState(source) {
  if (typeof source !== 'string' || looksLikeUrl(source) || !existsSync(path.join(source, '.git'))) return null;
  const r = spawnSync('git', ['-C', source, 'status', '--porcelain=v1'], { encoding: 'utf8' });
  return {
    path: path.resolve(source),
    head: git(['-C', source, 'rev-parse', 'HEAD']),
    porcelain: r.status === 0 ? r.stdout.split('\n').filter(Boolean) : null,
  };
}

function cmdVerifySource(slug) {
  assertSlug(slug);
  const recorded = readJson(manifestFile(slug), {}).sourceCheckout;
  if (!recorded) {
    out({ verdict: 'no local checkout was given' });
    return;
  }
  const now = sourceCheckoutState(recorded.path);
  const before = new Set(recorded.porcelain ?? []);
  const after = new Set(now?.porcelain ?? []);
  const result = {
    path: recorded.path,
    headUnchanged: now?.head === recorded.head,
    added: [...after].filter((l) => !before.has(l)),
    removed: [...before].filter((l) => !after.has(l)),
  };
  result.verdict = result.headUnchanged && !result.added.length && !result.removed.length ? 'unchanged' : 'changed';
  out(result);
  process.exit(result.verdict === 'unchanged' ? 0 : 2);
}

function defaultBranchOf(localRepo) {
  const head = git(['-C', localRepo, 'symbolic-ref', '--short', 'refs/remotes/origin/HEAD']);
  const name = head.replace(/^origin\//, '');
  if (name && git(['-C', localRepo, 'rev-parse', '--verify', '--quiet', `refs/heads/${name}`])) return name;
  return '';
}

function cmdClone(slug, source, flags) {
  const s = loadSession(slug);
  if (!source) fail('clone needs <path-or-url>');
  const dest = path.join(workDir(slug), 'checkout');
  if (existsSync(dest)) fail(`${dest} already exists — run cleanup first`);
  const isLocal = !looksLikeUrl(source) && existsSync(source);
  const candidates = [];
  if (isLocal) {
    const origin = git(['-C', source, 'remote', 'get-url', 'origin']);
    if (origin) candidates.push({ from: origin, local: false, branch: flags.ref ?? '' });
    candidates.push({ from: path.resolve(source), local: true, branch: flags.ref ?? defaultBranchOf(source) });
  } else {
    candidates.push({ from: source, local: false, branch: flags.ref ?? '' });
  }
  const errors = [];
  for (const c of candidates) {
    const args = ['clone', '--quiet'];
    if (!c.local) args.push('--depth', '1');
    if (c.branch) args.push('--branch', c.branch);
    args.push('--', c.from, dest);
    const r = runQuiet('git', args, { env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }, timeout: 600_000 });
    if (r.ok) {
      // Changes in the clone never reach the project: every remote gets a push URL no git
      // transport accepts. The lt ticket worktree shares this config, so it cannot push either.
      for (const remote of git(['-C', dest, 'remote']).split('\n').filter(Boolean)) {
        git(['-C', dest, 'remote', 'set-url', '--push', remote, NO_PUSH_URL]);
      }
      s.checkout = {
        path: dest,
        from: c.local ? 'local checkout' : redactUri(c.from),
        fromLocalCheckout: c.local,
        branch: git(['-C', dest, 'rev-parse', '--abbrev-ref', 'HEAD']),
        commit: git(['-C', dest, 'rev-parse', 'HEAD']),
        committedAt: git(['-C', dest, 'log', '-1', '--format=%cI']),
      };
      saveSession(slug, s);
      const manifest = readJson(manifestFile(slug), { slug, images: [] });
      Object.assign(manifest, { source: s.source, commit: s.checkout.commit, branch: s.checkout.branch });
      writeJson(manifestFile(slug), manifest);
      out(s.checkout);
      return;
    }
    errors.push(`${c.local ? 'local checkout' : redactUri(c.from)}: ${r.out.split('\n').pop()}`);
    rmSync(dest, { recursive: true, force: true });
  }
  fail(`clone failed\n  ${errors.join('\n  ')}`);
}

function cmdRun(slug, name, flags) {
  const s = loadSession(slug);
  const command = flags['--'] ?? [];
  if (!name || command.length === 0 || !flags.cwd) fail('usage: run <slug> <name> --cwd <dir> -- <command> [args...]');
  const cwd = path.resolve(String(flags.cwd));
  if (!existsSync(cwd)) fail(`cwd does not exist: ${cwd}`);
  const env = { ...process.env };
  for (const pair of flags.env ?? []) {
    const i = String(pair).indexOf('=');
    if (i > 0) env[pair.slice(0, i)] = pair.slice(i + 1);
  }
  const log = path.join(workDir(slug), 'logs', `${slugify(name)}.log`);
  mkdirSync(path.dirname(log), { recursive: true });
  const fd = openSync(log, 'a');
  const child = spawn(command[0], command.slice(1), {
    cwd,
    env,
    detached: true,
    stdio: ['ignore', fd, fd],
    shell: process.platform === 'win32',
  });
  closeSync(fd);
  if (!child.pid) fail(`could not start ${command[0]}`);
  child.unref();
  s.resources.push({ type: 'process', name, pid: child.pid, started: processStart(child.pid), cwd, log });
  saveSession(slug, s);
  out({ name, pid: child.pid, log });
}

function cmdRecord(slug, type, value, flags) {
  const s = loadSession(slug);
  if (!['lt-ticket', 'compose', 'container', 'volume'].includes(type) || !value) {
    fail('usage: record <slug> lt-ticket|compose|container|volume <value> [--cwd <dir>]');
  }
  const entry = { type, value: String(value), cwd: flags.cwd ? path.resolve(String(flags.cwd)) : null };
  if (!s.resources.some((r) => r.type === entry.type && r.value === entry.value)) s.resources.push(entry);
  saveSession(slug, s);
  out(entry);
}

function cmdComposeFile(slug, flags) {
  const s = loadSession(slug);
  if (typeof flags.cwd !== 'string') fail('usage: compose-file <slug> --cwd <dir> [--files a.yml,b.yml]');
  const cwd = path.resolve(flags.cwd);
  const project = `showroom-${slug}`;
  const files = typeof flags.files === 'string' ? flags.files.split(',').filter(Boolean) : [];
  const args = ['compose', '-p', project, ...files.flatMap((f) => ['-f', f]), 'config', '--format', 'json'];
  const r = spawnSync('docker', args, { cwd, encoding: 'utf8', timeout: 120_000 });
  if (r.status !== 0) fail(`docker compose config failed: ${(r.stderr || r.error?.message || '').trim()}`);
  const { config, changes, unsafeBinds } = isolateCompose(JSON.parse(r.stdout), cwd);
  if (unsafeBinds.length) {
    fail(`bind mounts outside the clone, not started:\n  ${unsafeBinds.join('\n  ')}`, 2);
  }
  const file = path.join(workDir(slug), 'compose.showroom.json');
  writeJson(file, config);
  if (!s.resources.some((x) => x.type === 'compose' && x.value === project)) {
    s.resources.push({ type: 'compose', value: project, cwd, file });
  }
  saveSession(slug, s);
  out({ file, changes, up: `docker compose -p ${project} -f ${file} up -d` });
}

function elapsedInfo(s) {
  const minutes = Math.floor((Date.now() - Date.parse(s.startedAt)) / 60000);
  const budget = s.budgetMinutes ?? BUDGET_MIN;
  return {
    elapsedMinutes: minutes,
    budgetMinutes: budget,
    remainingMinutes: Math.max(0, budget - minutes),
    exceeded: minutes >= budget,
  };
}

function cmdElapsed(slug) {
  out(elapsedInfo(loadSession(slug)));
}

function listSessions() {
  if (!existsSync(HOME_DIR)) return [];
  return readdirSync(HOME_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => readJson(path.join(HOME_DIR, e.name, 'session.json')))
    .filter(Boolean);
}

function cmdStatus(slug) {
  const sessions = listSessions().filter((s) => !slug || s.slug === slug);
  out(
    sessions.map((s) => ({
      slug: s.slug,
      ownerPid: s.owner?.pid ?? 0,
      ownerAlive: pidAlive(s.owner?.pid),
      ...elapsedInfo(s),
      resources: s.resources.map((r) => `${r.type}:${r.name ?? r.value}`),
      checkout: s.checkout?.path ?? null,
    })),
  );
}

function descendants(pids) {
  if (process.platform === 'win32') return pids;
  const r = spawnSync('ps', ['-A', '-o', 'pid=,ppid='], { encoding: 'utf8' });
  const children = new Map();
  for (const line of (r.stdout ?? '').split('\n')) {
    const [pid, ppid] = line.trim().split(/\s+/).map(Number);
    if (!pid) continue;
    if (!children.has(ppid)) children.set(ppid, []);
    children.get(ppid).push(pid);
  }
  const all = new Set(pids);
  const queue = [...pids];
  while (queue.length) {
    for (const c of children.get(queue.shift()) ?? []) {
      if (!all.has(c)) {
        all.add(c);
        queue.push(c);
      }
    }
  }
  return [...all];
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function stopProcess(r) {
  if (!pidAlive(r.pid)) return { done: true, note: 'already stopped' };
  // Without a recorded start time a PID cannot be told from a reused one: never signal it blind.
  if (!r.started) return { done: false, note: `pid ${r.pid}: start time unknown, left alone — check it by hand` };
  if (processStart(r.pid) !== r.started) {
    return { done: true, note: `pid ${r.pid} now belongs to another process — left alone` };
  }
  if (process.platform === 'win32') {
    const t = runQuiet('taskkill', ['/T', '/F', '/PID', String(r.pid)]);
    return { done: t.ok || !pidAlive(r.pid), note: t.out };
  }
  const signalGroup = (sig) => {
    try {
      process.kill(-r.pid, sig);
    } catch {
      try {
        process.kill(r.pid, sig);
      } catch {
        /* gone */
      }
    }
  };
  signalGroup('SIGTERM');
  for (let i = 0; i < 40 && pidAlive(r.pid); i++) sleep(250);
  if (pidAlive(r.pid)) signalGroup('SIGKILL');
  for (let i = 0; i < 20 && pidAlive(r.pid); i++) sleep(250);
  return { done: !pidAlive(r.pid), note: '' };
}

function composeLeftovers(project) {
  const ps = runQuiet('docker', ['ps', '-aq', '--filter', `label=com.docker.compose.project=${project}`]);
  const vols = runQuiet('docker', ['volume', 'ls', '-q', '--filter', `label=com.docker.compose.project=${project}`]);
  return {
    containers: ps.ok ? ps.out.split('\n').filter(Boolean) : [],
    volumes: vols.ok ? vols.out.split('\n').filter(Boolean) : [],
    dockerMissing: ps.missing,
  };
}

function stopResource(r, s) {
  switch (r.type) {
    case 'process':
      return stopProcess(r);
    case 'lt-ticket': {
      const cwd = r.cwd && existsSync(r.cwd) ? r.cwd : s.checkout?.path;
      if (!cwd || !existsSync(cwd)) return { done: false, note: 'clone is gone — run `lt ticket stop` by hand' };
      const t = runQuiet('lt', ['ticket', 'stop', r.value, '--force', '--noConfirm'], { cwd, timeout: 300_000 });
      return { done: t.ok, note: t.out.split('\n').slice(-3).join(' | ') };
    }
    case 'compose': {
      const fileArgs = r.file && existsSync(r.file) ? ['-f', r.file] : [];
      const args = ['compose', '-p', r.value, ...fileArgs, 'down', '-v', '--remove-orphans', '--timeout', '20'];
      const cwd = r.cwd && existsSync(r.cwd) ? r.cwd : undefined;
      const d = runQuiet('docker', args, { cwd, timeout: 300_000 });
      const left = composeLeftovers(r.value);
      if (left.containers.length) runQuiet('docker', ['rm', '-f', '-v', ...left.containers]);
      if (left.volumes.length) runQuiet('docker', ['volume', 'rm', '-f', ...left.volumes]);
      const after = composeLeftovers(r.value);
      return {
        done: !after.dockerMissing && after.containers.length === 0 && after.volumes.length === 0,
        note: after.dockerMissing ? 'docker not available' : d.ok ? '' : d.out.split('\n').pop(),
      };
    }
    case 'container': {
      const d = runQuiet('docker', ['rm', '-f', '-v', r.value]);
      const gone = runQuiet('docker', ['inspect', r.value]);
      return { done: !gone.ok, note: d.ok ? '' : d.out };
    }
    case 'volume': {
      runQuiet('docker', ['volume', 'rm', '-f', r.value]);
      const gone = runQuiet('docker', ['volume', 'inspect', r.value]);
      return { done: !gone.ok, note: '' };
    }
    default:
      return { done: false, note: `unknown resource type ${r.type}` };
  }
}

/**
 * Stops everything the session recorded, newest first, then empties the work folder except its
 * deliverables. Returns the report; `leftovers` lists what could not be removed.
 */
export function cleanup(slug, { quiet = false, keepCheckout = false } = {}) {
  assertSlug(slug);
  const dir = workDir(slug);
  const s = readJson(sessionFile(slug));
  const report = { slug, stopped: [], leftovers: [] };
  const stillRunning = [];
  if (s) {
    // lt ticket and Compose need the clone, so they go before the folder is removed; processes
    // first, because they hold ports and files.
    const order = { process: 0, 'lt-ticket': 1, compose: 2, container: 3, volume: 4 };
    const resources = [...s.resources].reverse().sort((a, b) => (order[a.type] ?? 9) - (order[b.type] ?? 9));
    for (const r of resources) {
      const label = `${r.type}:${r.name ?? r.value}${r.pid ? ` (pid ${r.pid})` : ''}`;
      const res = stopResource(r, s);
      (res.done ? report.stopped : report.leftovers).push(res.note ? `${label} — ${res.note}` : label);
      if (!res.done) stillRunning.push(r);
    }
  }
  if (keepCheckout && s) {
    // The run goes on (fallback chain): the stack is down, the clone and the session stay.
    s.resources = stillRunning;
    saveSession(slug, s);
    if (!quiet) out(report);
    return report;
  }
  if (existsSync(dir)) {
    for (const entry of readdirSync(dir)) {
      if (KEEP.has(entry)) continue;
      const p = path.join(dir, entry);
      try {
        rmSync(p, { recursive: true, force: true, maxRetries: 3 });
      } catch (e) {
        report.leftovers.push(`${p} — ${e.code ?? e.message}`);
      }
    }
  }
  const capture = captureRoot();
  if (capture.error) report.leftovers.push(capture.error);
  else rmSync(path.join(capture.root, slug), { recursive: true, force: true });
  if (!quiet) out(report);
  return report;
}

function cmdCleanup(slug, flags) {
  const report = cleanup(slug, { quiet: true, keepCheckout: flags['keep-checkout'] === true });
  out(report);
  process.exit(report.leftovers.length ? 1 : 0);
}

export function sweep({ session = '' } = {}) {
  const reports = [];
  for (const s of listSessions()) {
    if ((session && s.owner?.sessionId === session) || ownerGone(s)) {
      reports.push(cleanup(s.slug, { quiet: true }));
    }
  }
  return reports;
}

function cmdSweep(flags) {
  if (flags.detach) {
    const args = [fileURLToPath(import.meta.url), 'sweep'];
    if (typeof flags.session === 'string') args.push('--session', flags.session);
    spawn(process.execPath, args, { detached: true, stdio: 'ignore', env: process.env }).unref();
    return;
  }
  out(sweep({ session: typeof flags.session === 'string' ? flags.session : '' }));
}

function cmdCheckDb(positional, flags) {
  if (flags.scan) {
    const dir = path.resolve(String(flags.scan));
    const { services, findings } = scanForUris(dir);
    out({ composeServices: services, findings });
    process.exit(findings.some((f) => f.verdict !== 'local') ? 2 : 0);
  }
  if (positional.length === 0) fail('usage: check-db <uri>... | check-db --scan <dir>');
  const services = typeof flags['compose-services'] === 'string' ? flags['compose-services'].split(',') : [];
  const results = positional.map((u) => classifyUri(u, services));
  out(results);
  process.exit(results.every((r) => r.verdict === 'local') ? 0 : 2);
}

function cmdConnections(slug) {
  const s = loadSession(slug);
  if (process.platform === 'win32') fail('connections is not available on Windows', 4);
  const roots = s.resources.filter((r) => r.type === 'process' && pidAlive(r.pid)).map((r) => r.pid);
  if (roots.length === 0) {
    out({ checked: [], remote: [] });
    return;
  }
  const pids = descendants(roots);
  const r = runQuiet('lsof', ['-nP', '-a', '-iTCP', '-sTCP:ESTABLISHED', '-p', pids.join(',')]);
  if (r.missing) fail('lsof is not installed', 4);
  const remote = [];
  for (const line of r.out.split('\n')) {
    const m = /->(\[[^\]]+\]|[^:\s]+):(\d+)/.exec(line);
    if (!m) continue;
    const host = m[1];
    const port = Number(m[2]);
    if (DB_PORTS.has(port) && !isLocalHost(host)) remote.push(`${host}:${port}`);
  }
  out({ checked: pids, remote: [...new Set(remote)] });
  process.exit(remote.length ? 2 : 0);
}

function cmdWaitHttp(url, flags) {
  let u;
  try {
    u = new URL(url);
  } catch {
    fail(`not a URL: ${url}`);
  }
  if (!isLocalHost(u.hostname)) fail('wait-http only probes local URLs (localhost, *.localhost, 127.0.0.1)');
  const deadline = Date.now() + Number(flags.timeout ?? 180) * 1000;
  const lib = u.protocol === 'https:' ? https : http;
  const attempt = () =>
    new Promise((resolve) => {
      const req = lib.get(u, { rejectUnauthorized: false, timeout: 5000 }, (res) => {
        res.resume();
        resolve(res.statusCode);
      });
      req.on('timeout', () => req.destroy());
      req.on('error', () => resolve(0));
    });
  (async () => {
    let last = 0;
    while (Date.now() < deadline) {
      last = await attempt();
      if (last > 0 && last < 500) {
        out({ url, status: last });
        return;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    fail(`no answer below 500 from ${url} (last status ${last || 'none'})`, 2);
  })();
}

function cmdFreePort() {
  const srv = net.createServer();
  srv.listen(0, '127.0.0.1', () => {
    const { port } = srv.address();
    srv.close(() => out(String(port)));
  });
}

function cmdCapturePath(slug, feature, device) {
  assertSlug(slug);
  if (!feature || !['desktop', 'mobile', 'cover'].includes(device)) {
    fail('usage: capture-path <slug> <feature> desktop|mobile|cover');
  }
  mkdirSync(captureDir(slug), { recursive: true });
  out(path.join(captureDir(slug), `${slugify(feature)}-${device}.webp`));
}

function setPath(obj, dotted, value) {
  const keys = dotted.split('.');
  let cur = obj;
  for (const k of keys.slice(0, -1)) cur = cur[k] ??= {};
  cur[keys.at(-1)] = value;
}

function cmdManifest(sub, slug, rest, flags) {
  assertSlug(slug);
  const file = manifestFile(slug);
  const manifest = readJson(file, { slug, images: [] });
  if (sub === 'show') {
    out(manifest);
    return;
  }
  if (sub === 'meta') {
    for (const pair of rest) {
      const i = pair.indexOf('=');
      if (i <= 0) fail(`expected key=value, got "${pair}"`);
      const raw = pair.slice(i + 1);
      let value = raw;
      if (raw === 'true' || raw === 'false') value = raw === 'true';
      else if (raw === 'null') value = null;
      setPath(manifest, pair.slice(0, i), value);
    }
    writeJson(file, manifest);
    out(manifest);
    return;
  }
  if (sub === 'remove') {
    const [feature, device] = rest;
    if (!feature || !['desktop', 'mobile', 'cover'].includes(device)) {
      fail('usage: manifest remove <slug> <feature> desktop|mobile|cover');
    }
    const key = `screenshots/${slugify(feature)}-${device}.webp`;
    const before = (manifest.images ?? []).length;
    manifest.images = (manifest.images ?? []).filter((e) => String(e.file).replaceAll('\\', '/') !== key);
    rmSync(path.join(workDir(slug), key), { force: true });
    writeJson(file, manifest);
    out({ removed: before - manifest.images.length, file: key });
    return;
  }
  if (sub !== 'add') fail('usage: manifest add|remove|meta|show <slug> …');
  const required = ['file', 'feature', 'device', 'level'];
  for (const k of required) if (typeof flags[k] !== 'string') fail(`manifest add needs --${k}`);
  if (!LEVELS.includes(flags.level)) fail(`--level must be one of ${LEVELS.join(', ')}`);
  if (!['desktop', 'mobile', 'cover'].includes(flags.device)) fail('--device must be desktop, mobile or cover');
  const shots = path.join(workDir(slug), 'screenshots');
  const given = path.resolve(flags.file);
  if (!existsSync(given)) fail(`file not found: ${given}`);
  const size = webpSize(readFileSync(given));
  if (!size) fail(`${path.basename(given)} is not a WebP file`);
  const expected = DEVICE_SIZES[flags.device];
  const strict = ['local', 'demo-access', 'public'].includes(flags.level);
  if (strict && expected && (size[0] !== expected[0] || size[1] !== expected[1])) {
    fail(
      `${path.basename(given)} is ${size[0]}x${size[1]}, a ${flags.device} capture must be ${expected[0]}x${expected[1]} ` +
        `(emulate ${flags.device === 'desktop' ? '1440x900x1' : '390x844x2,mobile,touch'}, viewport screenshot)`,
      2,
    );
  }
  const feature = slugify(flags.feature);
  let abs = given;
  if (isInside(captureDir(slug), given)) {
    // A fresh capture: it moves into the work folder under its canonical name.
    abs = path.join(shots, `${feature}-${flags.device}.webp`);
    mkdirSync(shots, { recursive: true });
    copyFileSync(given, abs);
    rmSync(given, { force: true });
  } else if (!isInside(shots, given)) {
    fail(
      `the file must be a capture from \`capture-path\` or live in ${shots}; ` +
        'convert or copy older screenshots into the capture folder first (a local checkout is never changed)',
    );
  }
  const entry = {
    // Forward slashes on every platform: `remove` and the showcase upload address images by this key.
    file: path.relative(workDir(slug), abs).split(path.sep).join('/'),
    feature,
    device: flags.device,
    width: size[0],
    height: size[1],
    bytes: statSync(abs).size,
    level: flags.level,
    page: typeof flags.page === 'string' ? flags.page : null,
    showsCustomerBranding: flags['customer-branding'] === true,
    showsPeople: flags['shows-people'] === true,
    anonymized: flags.anonymized === true,
    capturedAt: new Date().toISOString(),
  };
  manifest.images = (manifest.images ?? []).filter((e) => e.file !== entry.file);
  manifest.images.push(entry);
  writeJson(file, manifest);
  out(entry);
}

// ── main ─────────────────────────────────────────────────────────────────────────────────

function main(argv) {
  const [command, ...rest] = argv;
  const { flags, positional } = parseFlags(rest);
  switch (command) {
    case 'slug':
      if (!positional[0]) fail('usage: slug <path-or-url>');
      return out(slugForSource(positional[0]));
    case 'start':
      return cmdStart(positional[0], flags);
    case 'clone':
      return cmdClone(positional[0], positional[1], flags);
    case 'run':
      return cmdRun(positional[0], positional[1], flags);
    case 'record':
      return cmdRecord(positional[0], positional[1], positional[2], flags);
    case 'compose-file':
      return cmdComposeFile(positional[0], flags);
    case 'elapsed':
      return cmdElapsed(positional[0]);
    case 'status':
      return cmdStatus(positional[0]);
    case 'verify-source':
      return cmdVerifySource(positional[0]);
    case 'cleanup':
      return cmdCleanup(positional[0], flags);
    case 'sweep':
      return cmdSweep(flags);
    case 'check-db':
      return cmdCheckDb(positional, flags);
    case 'connections':
      return cmdConnections(positional[0]);
    case 'wait-http':
      return cmdWaitHttp(positional[0], flags);
    case 'free-port':
      return cmdFreePort();
    case 'capture-path':
      return cmdCapturePath(positional[0], positional[1], positional[2]);
    case 'manifest':
      return cmdManifest(positional[0], positional[1], positional.slice(2), flags);
    case undefined:
    case '-h':
    case '--help':
    case 'help':
      return out(USAGE);
    default:
      fail(`unknown command "${command}"\n\n${USAGE}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main(process.argv.slice(2));
}
