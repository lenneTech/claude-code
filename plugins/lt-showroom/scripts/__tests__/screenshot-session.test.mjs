// screenshot-session.test.mjs — offline tests for the screenshot session manager.
//
// Every CLI test runs against its own LT_SHOWROOM_HOME in a temp directory and never touches
// Docker, lt or a real project. Process tests spawn throwaway `node` sleepers.
//
// Run: node --test plugins/lt-showroom/scripts/__tests__/screenshot-session.test.mjs

import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  classifyUri,
  composeServiceNames,
  isolateCompose,
  isInside,
  pidAlive,
  redactUri,
  repoName,
  scanForUris,
  slugForSource,
  slugify,
  webpSize,
} from '../screenshot-session.mjs';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'screenshot-session.mjs');
const TMP = mkdtempSync(path.join(os.tmpdir(), 'lt-showroom-session-'));
// The CLI's temp folder (where captures land) stays inside the test directory.
const CLI_TMP = path.join(TMP, 'tmp');
mkdirSync(CLI_TMP);
const POSIX = process.platform !== 'win32';
const sleepers = [];

after(() => {
  for (const p of sleepers) {
    try {
      process.kill(p.pid, 'SIGKILL');
    } catch {
      /* already gone */
    }
  }
  rmSync(TMP, { recursive: true, force: true });
});

let homeCounter = 0;
function freshHome() {
  const home = path.join(TMP, `home-${++homeCounter}`);
  mkdirSync(home, { recursive: true });
  return home;
}

/** Runs the CLI asynchronously, so an HTTP server in this process can still answer it. */
function cli(args, { home, pid = process.pid, session = 'test-session', env = {} } = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [SCRIPT, ...args], {
      env: {
        ...process.env,
        LT_SHOWROOM_HOME: home,
        CLAUDE_PID: String(pid),
        CLAUDE_CODE_SESSION_ID: session,
        TMPDIR: CLI_TMP,
        TEMP: CLI_TMP,
        TMP: CLI_TMP,
        ...env,
      },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

function sleeper() {
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore', detached: POSIX });
  child.unref();
  sleepers.push(child);
  return child.pid;
}

function webp(kind, w, h) {
  const b = Buffer.alloc(30);
  b.write('RIFF', 0, 'ascii');
  b.writeUInt32LE(22, 4);
  b.write('WEBP', 8, 'ascii');
  if (kind === 'VP8 ') {
    b.write('VP8 ', 12, 'ascii');
    b[23] = 0x9d;
    b[24] = 0x01;
    b[25] = 0x2a;
    b.writeUInt16LE(w, 26);
    b.writeUInt16LE(h, 28);
  } else if (kind === 'VP8L') {
    b.write('VP8L', 12, 'ascii');
    b[20] = 0x2f;
    b.writeUInt32LE((w - 1) | ((h - 1) << 14), 21);
  } else {
    b.write('VP8X', 12, 'ascii');
    b.writeUIntLE(w - 1, 24, 3);
    b.writeUIntLE(h - 1, 27, 3);
  }
  return b;
}

function session(home, slug) {
  return JSON.parse(readFileSync(path.join(home, slug, 'session.json'), 'utf8'));
}

function gitRepo(dir, { origin } = {}) {
  mkdirSync(dir, { recursive: true });
  const g = (...a) => spawnSync('git', a, { cwd: dir, encoding: 'utf8' });
  g('init', '-q', '-b', 'main');
  g('config', 'user.email', 'test@example.com');
  g('config', 'user.name', 'Test');
  writeFileSync(path.join(dir, 'README.md'), '# fixture\n');
  g('add', '.');
  g('commit', '-q', '-m', 'init');
  if (origin) g('remote', 'add', 'origin', origin);
  return dir;
}

// ── pure helpers ─────────────────────────────────────────────────────────────────────────

test('slug: repository names from every URL form', () => {
  assert.equal(slugify('Ümlaut Projekt_2'), 'umlaut-projekt-2');
  assert.equal(repoName('https://github.com/acme/Shop-App.git'), 'Shop-App');
  assert.equal(repoName('git@gitlab.example.com:group/sub/portal.git'), 'portal');
  assert.equal(repoName('/home/dev/code/portal/'), 'portal');
  assert.equal(slugForSource('https://github.com/acme/Shop-App.git'), 'shop-app');
  assert.equal(slugForSource('git@gitlab.example.com:group/web.site.git'), 'web-site');
});

test('slug: a local checkout is named after its origin, else after its folder', () => {
  const withOrigin = gitRepo(path.join(TMP, 'local-a'), { origin: 'git@gitlab.example.com:team/real-name.git' });
  const without = gitRepo(path.join(TMP, 'Local Folder'));
  assert.equal(slugForSource(withOrigin), 'real-name');
  assert.equal(slugForSource(without), 'local-folder');
});

test('check-db: only this machine and the session Compose services count as local', () => {
  const local = [
    'mongodb://localhost:27017/app',
    'mongodb://127.0.0.1/app-local',
    'mongodb://[::1]:27017/x',
    'postgres://user:pw@api.shop.localhost:5432/db',
    'redis://host.docker.internal:6379',
  ];
  for (const uri of local) assert.equal(classifyUri(uri).verdict, 'local', uri);
  assert.equal(classifyUri('mongodb+srv://u:p@cluster0.abc.mongodb.net/app').verdict, 'remote');
  assert.equal(classifyUri('mongodb://db.staging.example.com:27017/app').verdict, 'remote');
  assert.equal(classifyUri('mongodb://localhost:27017,mongo2.example.com:27017/app?replicaSet=rs').verdict, 'remote');
  assert.equal(classifyUri('mongodb://mongo:27017/app').verdict, 'remote', 'a bare host is not local by itself');
  assert.equal(classifyUri('mongodb://mongo:27017/app', ['mongo']).verdict, 'local');
  assert.equal(classifyUri('not a uri').verdict, 'unknown');
});

test('check-db: printed URIs never carry the password', () => {
  assert.equal(redactUri('mongodb://admin:s3cr3t@db.example.com/app'), 'mongodb://admin:***@db.example.com/app');
  assert.ok(!classifyUri('postgres://u:hunter2@remote.example.com/db').uri.includes('hunter2'));
});

test('check-db --scan: env and Compose files, Compose services, no node_modules', () => {
  const dir = path.join(TMP, 'scan');
  mkdirSync(path.join(dir, 'projects', 'api'), { recursive: true });
  mkdirSync(path.join(dir, 'node_modules', 'pkg'), { recursive: true });
  writeFileSync(path.join(dir, '.env'), 'MONGO_URI=mongodb://127.0.0.1:27017/app\n# MONGO_URI=mongodb://old.example.com/app\n');
  writeFileSync(path.join(dir, 'projects', 'api', '.env.example'), 'MONGO_URI=mongodb://staging.example.com:27017/app\n');
  writeFileSync(path.join(dir, '.env.production'), 'MONGO_URI=mongodb://prod.example.com/app\n');
  writeFileSync(path.join(dir, 'node_modules', 'pkg', '.env'), 'X=mongodb://ignored.example.com/x\n');
  writeFileSync(
    path.join(dir, 'docker-compose.yml'),
    'services:\n  mongo:\n    image: mongo:7\n  api:\n    environment:\n      MONGO_URI: mongodb://mongo:27017/app\n',
  );
  const { services, findings } = scanForUris(dir);
  assert.deepEqual(services, ['mongo', 'api']);
  const byFile = Object.fromEntries(findings.map((f) => [`${f.file}:${f.line}`, f.verdict]));
  assert.equal(byFile['.env:1'], 'local');
  assert.equal(byFile['docker-compose.yml:6'], 'local');
  assert.equal(byFile[path.join('projects', 'api', '.env.example') + ':1'], 'remote');
  assert.equal(findings.length, 3, 'commented lines, production env files and node_modules are skipped');
});

test('compose services: only the keys directly under services:', () => {
  const yaml = 'version: "3"\nservices:\n  app:\n    build: .\n    depends_on:\n      db:\n        condition: x\n  db:\n    image: mongo\nvolumes:\n  data:\n';
  assert.deepEqual(composeServiceNames(yaml), ['app', 'db']);
});

test('webp: dimensions from VP8, VP8L and VP8X headers; anything else is no WebP', () => {
  assert.deepEqual(webpSize(webp('VP8 ', 1440, 900)), [1440, 900]);
  assert.deepEqual(webpSize(webp('VP8L', 780, 1688)), [780, 1688]);
  assert.deepEqual(webpSize(webp('VP8X', 2880, 1800)), [2880, 1800]);
  const png = Buffer.alloc(40);
  png.write('\x89PNG\r\n\x1a\n', 0, 'latin1');
  assert.equal(webpSize(png), null);
});

test('isInside: cleanup paths must stay below the work folder', () => {
  assert.ok(isInside('/a/b', '/a/b/c'));
  assert.ok(!isInside('/a/b', '/a/b'));
  assert.ok(!isInside('/a/b', '/a/bc'));
  assert.ok(!isInside('/a/b', '/a/b/../c'));
});

// ── session lifecycle ────────────────────────────────────────────────────────────────────

test('start: creates the work folder and binds the session to the Claude process', async () => {
  const home = freshHome();
  const r = await cli(['start', 'demo', '--source', '/x/demo'], { home, pid: 4242, session: 'abc' });
  assert.equal(r.code, 0, r.stderr);
  assert.ok(existsSync(path.join(home, 'demo', 'screenshots')));
  const s = session(home, 'demo');
  assert.equal(s.owner.pid, 4242);
  assert.equal(s.owner.sessionId, 'abc');
  assert.equal(s.budgetMinutes, 45);
});

test('start: refuses while another live Claude session owns the slug', async () => {
  const home = freshHome();
  const owner = sleeper();
  assert.equal((await cli(['start', 'busy'], { home, pid: owner })).code, 0);
  const r = await cli(['start', 'busy'], { home, pid: owner + 100000 });
  assert.equal(r.code, 3);
  assert.match(r.stderr, /BUSY/);
});

test('start: an abandoned run is cleaned first, its screenshots survive', async () => {
  const home = freshHome();
  const deadPid = 999_999;
  assert.ok(!pidAlive(deadPid));
  assert.equal((await cli(['start', 'old'], { home, pid: deadPid })).code, 0);
  mkdirSync(path.join(home, 'old', 'checkout', 'src'), { recursive: true });
  writeFileSync(path.join(home, 'old', 'screenshots', 'keep.webp'), webp('VP8 ', 1440, 900));
  const r = await cli(['start', 'old'], { home, pid: process.pid });
  assert.equal(r.code, 0, r.stderr);
  assert.ok(!existsSync(path.join(home, 'old', 'checkout')), 'the abandoned clone is removed');
  assert.ok(existsSync(path.join(home, 'old', 'screenshots', 'keep.webp')), 'deliverables stay');
  assert.equal(session(home, 'old').owner.pid, process.pid);
});

test('run + cleanup: stops exactly the recorded process group and nothing else', { skip: !POSIX }, async () => {
  const home = freshHome();
  await cli(['start', 'proc'], { home });
  const r = await cli(['run', 'proc', 'server', '--cwd', TMP, '--', process.execPath, '-e', 'setInterval(() => {}, 1000)'], { home });
  assert.equal(r.code, 0, r.stderr);
  const { pid } = JSON.parse(r.stdout);
  const bystander = sleeper();
  assert.ok(pidAlive(pid));
  const c = await cli(['cleanup', 'proc'], { home });
  assert.equal(c.code, 0, c.stdout + c.stderr);
  assert.ok(!pidAlive(pid), 'the recorded server is stopped');
  assert.ok(pidAlive(bystander), 'an unrelated process keeps running');
  assert.ok(!existsSync(path.join(home, 'proc', 'session.json')));
});

test('cleanup --keep-checkout: the stack stops, clone and session stay for the fallback chain', { skip: !POSIX }, async () => {
  const home = freshHome();
  await cli(['start', 'keep'], { home });
  mkdirSync(path.join(home, 'keep', 'checkout'));
  const r = await cli(['run', 'keep', 'app', '--cwd', TMP, '--', process.execPath, '-e', 'setInterval(() => {}, 1000)'], { home });
  const { pid } = JSON.parse(r.stdout);
  const c = await cli(['cleanup', 'keep', '--keep-checkout'], { home });
  assert.equal(c.code, 0, c.stdout + c.stderr);
  assert.ok(!pidAlive(pid));
  assert.ok(existsSync(path.join(home, 'keep', 'checkout')));
  assert.deepEqual(session(home, 'keep').resources, [], 'stopped resources leave the session');
  await cli(['cleanup', 'keep'], { home });
  assert.ok(!existsSync(path.join(home, 'keep', 'checkout')));
});

test('cleanup: a recorded PID that now belongs to another process is left alone', { skip: !POSIX }, async () => {
  const home = freshHome();
  await cli(['start', 'reuse'], { home });
  const foreign = sleeper();
  const file = path.join(home, 'reuse', 'session.json');
  const s = JSON.parse(readFileSync(file, 'utf8'));
  s.resources.push({ type: 'process', name: 'old-server', pid: foreign, started: 'Thu Jan  1 00:00:00 1970' });
  writeFileSync(file, JSON.stringify(s));
  const c = await cli(['cleanup', 'reuse'], { home });
  assert.equal(c.code, 0, c.stdout);
  assert.match(c.stdout, /another process/);
  assert.ok(pidAlive(foreign));
});

test('sweep --session: cleans the sessions of the ending Claude session only', async () => {
  const home = freshHome();
  await cli(['start', 'mine'], { home, session: 'ending' });
  await cli(['start', 'theirs'], { home, session: 'other' });
  mkdirSync(path.join(home, 'mine', 'checkout'));
  mkdirSync(path.join(home, 'theirs', 'checkout'));
  const r = await cli(['sweep', '--session', 'ending'], { home, session: 'other' });
  assert.equal(r.code, 0, r.stderr);
  assert.ok(!existsSync(path.join(home, 'mine', 'checkout')));
  assert.ok(existsSync(path.join(home, 'theirs', 'checkout')));
  assert.ok(existsSync(path.join(home, 'theirs', 'session.json')));
});

test('clone: an unreachable origin falls back to the local checkout and records the commit', async () => {
  const home = freshHome();
  const repo = gitRepo(path.join(TMP, 'clone-src'), { origin: 'https://127.0.0.1:9/nowhere/clone-src.git' });
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).stdout.trim();
  await cli(['start', 'clone-src'], { home });
  const r = await cli(['clone', 'clone-src', repo], { home });
  assert.equal(r.code, 0, r.stderr);
  const info = JSON.parse(r.stdout);
  assert.equal(info.commit, head);
  assert.equal(info.fromLocalCheckout, true);
  assert.ok(existsSync(path.join(home, 'clone-src', 'checkout', 'README.md')));
  const checkout = path.join(home, 'clone-src', 'checkout');
  const pushUrl = spawnSync('git', ['remote', 'get-url', '--push', 'origin'], { cwd: checkout, encoding: 'utf8' }).stdout.trim();
  assert.match(pushUrl, /^no-push:/, 'the clone cannot push to the project');
  const push = spawnSync('git', ['push', 'origin', 'HEAD'], { cwd: checkout, encoding: 'utf8', env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
  assert.notEqual(push.status, 0, 'git push from the clone fails');
  const manifest = JSON.parse(readFileSync(path.join(home, 'clone-src', 'manifest.json'), 'utf8'));
  assert.equal(manifest.commit, head);
  await cli(['cleanup', 'clone-src'], { home });
  assert.ok(!existsSync(path.join(home, 'clone-src', 'checkout')));
  assert.ok(existsSync(path.join(repo, 'README.md')), 'the source checkout is untouched');
});

test('verify-source: proves the local checkout given to start is unchanged, and notices a change', async () => {
  const home = freshHome();
  const repo = gitRepo(path.join(TMP, 'verify-src'));
  writeFileSync(path.join(repo, 'wip.txt'), 'uncommitted work of the developer\n');
  await cli(['start', 'verify-src', '--source', repo], { home });
  await cli(['clone', 'verify-src', repo], { home });
  await cli(['cleanup', 'verify-src'], { home });
  const same = await cli(['verify-source', 'verify-src'], { home });
  assert.equal(same.code, 0, same.stdout);
  assert.equal(JSON.parse(same.stdout).verdict, 'unchanged');
  writeFileSync(path.join(repo, '.env'), 'X=1\n');
  const changed = await cli(['verify-source', 'verify-src'], { home });
  assert.equal(changed.code, 2);
  assert.deepEqual(JSON.parse(changed.stdout).added, ['?? .env']);
});

test('manifest add: captures must have the agreed size, legacy images any size', async () => {
  const home = freshHome();
  await cli(['start', 'shots'], { home });
  const shots = path.join(home, 'shots', 'screenshots');
  writeFileSync(path.join(shots, 'overview-desktop.webp'), webp('VP8 ', 1440, 900));
  writeFileSync(path.join(shots, 'overview-mobile.webp'), webp('VP8 ', 780, 1688));
  writeFileSync(path.join(shots, 'retina-desktop.webp'), webp('VP8X', 2880, 1800));
  writeFileSync(path.join(shots, 'old.webp'), webp('VP8L', 1200, 3000));
  writeFileSync(path.join(shots, 'not.webp'), Buffer.from('plain text, not an image'));
  const add = (file, device, level, extra = []) =>
    cli(['manifest', 'add', 'shots', '--file', path.join(shots, file), '--feature', 'Overview', '--device', device, '--level', level, ...extra], { home });

  assert.equal((await add('overview-desktop.webp', 'desktop', 'local', ['--anonymized', '--shows-people'])).code, 0);
  assert.equal((await add('overview-mobile.webp', 'mobile', 'public')).code, 0);
  const wrong = await add('retina-desktop.webp', 'desktop', 'local');
  assert.equal(wrong.code, 2);
  assert.match(wrong.stderr, /1440x900x1/);
  assert.equal((await add('old.webp', 'desktop', 'legacy')).code, 0);
  assert.notEqual((await add('not.webp', 'desktop', 'legacy')).code, 0);

  const outside = path.join(TMP, 'outside.webp');
  writeFileSync(outside, webp('VP8 ', 1440, 900));
  const r = await cli(['manifest', 'add', 'shots', '--file', outside, '--feature', 'x', '--device', 'desktop', '--level', 'local'], { home });
  assert.notEqual(r.code, 0, 'files from anywhere else are refused (a local checkout is never changed)');
  assert.ok(existsSync(outside), 'and stay where they are');

  const cp = await cli(['capture-path', 'shots', 'Kunden Liste', 'mobile'], { home });
  const capture = cp.stdout.trim();
  assert.ok(capture.endsWith(path.join('shots', 'kunden-liste-mobile.webp')), capture);
  assert.ok(path.basename(path.dirname(path.dirname(capture))).startsWith('lt-showroom-'), 'a per-user capture root');
  assert.ok(capture.startsWith(CLI_TMP), 'captures go to the temp folder the browser MCP may write to');
  writeFileSync(capture, webp('VP8X', 780, 1688));
  const moved = await cli(['manifest', 'add', 'shots', '--file', capture, '--feature', 'Kunden Liste', '--device', 'mobile', '--level', 'local'], { home });
  assert.equal(moved.code, 0, moved.stderr);
  assert.ok(existsSync(path.join(shots, 'kunden-liste-mobile.webp')), 'the capture moves into the work folder');
  assert.ok(!existsSync(capture));
  writeFileSync(capture, webp('VP8X', 1440, 900));
  const wrongDevice = await cli(['manifest', 'add', 'shots', '--file', capture, '--feature', 'Kunden Liste', '--device', 'mobile', '--level', 'local'], { home });
  assert.equal(wrongDevice.code, 2);
  assert.ok(existsSync(capture), 'a refused capture is not moved');
  await cli(['cleanup', 'shots'], { home });
  assert.ok(!existsSync(path.dirname(capture)), 'cleanup removes the capture folder');
  assert.ok(existsSync(path.join(shots, 'kunden-liste-mobile.webp')), 'and keeps the screenshots');

  const traversal = await cli(['manifest', 'remove', 'shots', 'x', '../../outside'], { home });
  assert.notEqual(traversal.code, 0, 'only the three devices are accepted');
  const removed = await cli(['manifest', 'remove', 'shots', 'Kunden Liste', 'mobile'], { home });
  assert.equal(JSON.parse(removed.stdout).removed, 1);
  assert.ok(!existsSync(path.join(shots, 'kunden-liste-mobile.webp')), 'remove drops the file too');
  await cli(['manifest', 'meta', 'shots', 'pendingTag=screenshots-ausstehend', 'liveCheck.matchesRepo=false'], { home });
  const m = JSON.parse(readFileSync(path.join(home, 'shots', 'manifest.json'), 'utf8'));
  assert.equal(m.images.length, 3);
  assert.equal(m.images[0].feature, 'overview');
  assert.equal(m.images[0].anonymized, true);
  assert.equal(m.images[0].showsPeople, true);
  assert.equal(m.pendingTag, 'screenshots-ausstehend');
  assert.equal(m.liveCheck.matchesRepo, false);
});

test('elapsed: reports the time budget', async () => {
  const home = freshHome();
  await cli(['start', 'budget'], { home, env: { LT_SHOWROOM_BUDGET_MIN: '30' } });
  const r = await cli(['elapsed', 'budget'], { home });
  const info = JSON.parse(r.stdout);
  assert.equal(info.budgetMinutes, 30);
  assert.equal(info.exceeded, false);
});

test('check-db CLI: exit 2 on any remote URI', async () => {
  const home = freshHome();
  assert.equal((await cli(['check-db', 'mongodb://127.0.0.1/a'], { home })).code, 0);
  assert.equal((await cli(['check-db', 'mongodb://127.0.0.1/a', 'mongodb://db.example.com/a'], { home })).code, 2);
  assert.equal((await cli(['check-db', 'mongodb://mongo/a', '--compose-services', 'mongo,api'], { home })).code, 0);
});

test('wait-http: answers for a local server, refuses remote hosts', async () => {
  const home = freshHome();
  const server = http.createServer((_, res) => res.writeHead(302, { location: '/login' }).end());
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  const ok = await cli(['wait-http', `http://127.0.0.1:${port}/`, '--timeout', '10'], { home });
  server.close();
  assert.equal(ok.code, 0, ok.stderr);
  assert.equal(JSON.parse(ok.stdout).status, 302);
  const remote = await cli(['wait-http', 'https://example.com/'], { home });
  assert.notEqual(remote.code, 0);
});

test('cleanup: a process recorded without a start time is never signalled blind', { skip: !POSIX }, async () => {
  const home = freshHome();
  await cli(['start', 'nostart'], { home });
  const bystander = sleeper();
  const file = path.join(home, 'nostart', 'session.json');
  const s = JSON.parse(readFileSync(file, 'utf8'));
  s.resources.push({ type: 'process', name: 'app', pid: bystander, started: '' });
  writeFileSync(file, JSON.stringify(s));
  const c = await cli(['cleanup', 'nostart'], { home });
  assert.equal(c.code, 1, 'it is reported as a leftover');
  assert.match(c.stdout, /start time unknown/);
  assert.ok(pidAlive(bystander), 'the process keeps running');
});

test('capture root: a planted symlink is refused and cleanup does not follow it', { skip: !POSIX }, async () => {
  const home = freshHome();
  const tmp = path.join(TMP, `tmp-${homeCounter}`);
  const victim = path.join(TMP, `victim-${homeCounter}`);
  mkdirSync(path.join(victim, 'evil', 'src'), { recursive: true });
  writeFileSync(path.join(victim, 'evil', 'src', 'uncommitted.ts'), 'work\n');
  mkdirSync(tmp);
  spawnSync('ln', ['-s', victim, path.join(tmp, `lt-showroom-${process.getuid()}`)]);
  const env = { TMPDIR: tmp, TEMP: tmp, TMP: tmp };
  await cli(['start', 'evil'], { home, env });
  const cp = await cli(['capture-path', 'evil', 'overview', 'desktop'], { home, env });
  assert.notEqual(cp.code, 0);
  assert.match(cp.stderr, /unsafe capture folder/);
  const c = await cli(['cleanup', 'evil'], { home, env });
  assert.match(c.stdout, /unsafe capture folder/);
  assert.ok(existsSync(path.join(victim, 'evil', 'src', 'uncommitted.ts')), 'the symlink target survives');
});

test('isolateCompose: fixed volume, network and container names go; bind mounts outside the clone are flagged', () => {
  const clone = path.join(TMP, 'compose-clone');
  const config = {
    name: 'showroom-shop',
    services: {
      mongo: {
        image: 'mongo:7',
        container_name: 'shop-mongo',
        volumes: [
          { type: 'volume', source: 'data', target: '/data/db' },
          { type: 'bind', source: path.join(clone, 'seed'), target: '/seed' },
        ],
      },
      api: { image: 'api', volumes: [{ type: 'bind', source: '/var/lib/shop', target: '/data' }] },
    },
    volumes: {
      data: { name: 'shop_mongo_data' },
      cache: { name: 'showroom-shop_cache' },
      shared: { external: true, name: 'company-files' },
    },
    networks: { proxy: { external: true, name: 'traefik-public' }, default: { name: 'showroom-shop_default' } },
  };
  const { config: out, changes, unsafeBinds } = isolateCompose(config, clone);
  assert.equal(out.volumes.data.name, undefined, 'a fixed name would mount the developer volume');
  assert.equal(out.volumes.cache.name, 'showroom-shop_cache', 'the project-scoped name stays');
  assert.equal(out.volumes.shared.external, undefined);
  assert.equal(out.networks.proxy.external, undefined);
  assert.equal(out.services.mongo.container_name, undefined);
  assert.equal(changes.length, 4);
  assert.deepEqual(unsafeBinds, ['services.api: /var/lib/shop -> /data']);
  assert.equal(config.volumes.data.name, 'shop_mongo_data', 'the input is not modified');
});
