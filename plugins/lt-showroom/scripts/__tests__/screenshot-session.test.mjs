// screenshot-session.test.mjs — offline tests for the screenshot session manager.
//
// Every CLI test runs against its own LT_SHOWROOM_HOME in a temp directory and never touches
// Docker, lt or a real project. Process tests spawn throwaway `node` sleepers.
//
// Run: node --test plugins/lt-showroom/scripts/__tests__/screenshot-session.test.mjs

import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  classifyUri,
  composeServiceNames,
  isolateCompose,
  isInside,
  pidAlive,
  redactUri,
  repoName,
  repositoryFacts,
  withoutCredentials,
  scanForUris,
  slugForSource,
  slugify,
  sourceIdentity,
  webpSize,
  workSlug,
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
function cli(args, { home, pid = process.pid, session = 'test-session', env = {}, input, cwd } = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [SCRIPT, ...args], {
      cwd,
      env: {
        ...process.env,
        LT_SHOWROOM_HOME: home,
        CLAUDE_PID: String(pid),
        CLAUDE_CODE_SESSION_ID: session,
        // Offline: a fixture origin on github.com or elsewhere is refused at once instead of
        // contacting the host (and the developer's SSH agent); file:// and local paths still work.
        GIT_ALLOW_PROTOCOL: 'file',
        TMPDIR: CLI_TMP,
        TEMP: CLI_TMP,
        TMP: CLI_TMP,
        ...env,
      },
      // stdin is a pipe only when there is input: a command that exits before reading it would otherwise
      // fail the test with EPIPE (macOS CI, `run`), and without input the script reads an empty stdin.
      stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    if (input !== undefined) {
      child.stdin.on('error', () => {});
      child.stdin.end(input);
    }
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

test('sourceIdentity: one project, whatever remote form or credentials name it', () => {
  const id = sourceIdentity('https://git.example.com/customers/alpha/website.git');
  assert.equal(id, 'git.example.com/customers/alpha/website');
  assert.equal(sourceIdentity('git@git.example.com:customers/alpha/website.git'), id);
  assert.equal(sourceIdentity('https://deploy:token@git.example.com/Customers/Alpha/website/'), id);
  assert.notEqual(sourceIdentity('https://git.example.com/customers/beta/website.git'), id);
  const local = gitRepo(path.join(TMP, 'identity-local'), { origin: 'git@git.example.com:customers/alpha/website.git' });
  assert.equal(sourceIdentity(local), id, 'a local checkout is its origin');
  const bare = gitRepo(path.join(TMP, 'identity-bare'));
  assert.equal(sourceIdentity(bare), `path:${path.resolve(bare)}`);
  assert.equal(sourceIdentity('Prüfportal für Großhändler'), `name:${slugify('Prüfportal für Großhändler')}`, 'a name run is its name');
  assert.equal(sourceIdentity('/gone/checkout'), `path:${path.resolve('/gone/checkout')}`, 'a path that is gone stays a path');
});

test('workSlug: repositories with the same name get separate work folders, each keeps its own', () => {
  const home = freshHome();
  const claim = (slug, remote) => {
    mkdirSync(path.join(home, slug), { recursive: true });
    writeFileSync(path.join(home, slug, 'manifest.json'), JSON.stringify({ slug, remote, images: [] }));
  };
  const alpha = 'https://git.example.com/customers/alpha/website.git';
  const beta = 'git@git.example.com:customers/beta/website.git';
  const gamma = 'https://other.example.org/customers/beta/website.git';
  assert.equal(workSlug(alpha, home), 'website', 'a free name stays the plain repository name');
  claim('website', alpha);
  assert.equal(workSlug(alpha, home), 'website');
  assert.equal(workSlug(beta, home), 'beta-website', 'the namespace tells the second one apart');
  claim('beta-website', beta);
  assert.equal(workSlug(beta, home), 'beta-website');
  const third = workSlug(gamma, home);
  assert.match(third, /^website-[0-9a-f]{8}$/, 'same namespace on another host: a hash of the source');
  claim(third, gamma);
  assert.equal(workSlug(gamma, home), third);
  rmSync(path.join(home, 'website'), { recursive: true });
  assert.equal(workSlug(beta, home), 'beta-website', 'an existing folder keeps resolving after the plain name is free');
  assert.equal(workSlug('Prüfportal für Großhändler', home), slugify('Prüfportal für Großhändler'), 'a name run keeps its slug');
});

test('repositoryFacts: provider, credential-free URL and project path from every remote form', () => {
  assert.deepEqual(repositoryFacts('https://oauth2:secret-token@gitlab.example.com/kunden/acme/portal.git'), {
    provider: 'gitlab',
    url: 'https://gitlab.example.com/kunden/acme/portal',
    projectPath: 'kunden/acme/portal',
  });
  assert.deepEqual(repositoryFacts('git@github.com:Org/Repo.git'), {
    provider: 'github',
    url: 'https://github.com/Org/Repo',
    projectPath: 'Org/Repo',
  });
  assert.deepEqual(repositoryFacts('ssh://git@git.example.org:2222/team/app/'), {
    provider: 'other',
    url: 'https://git.example.org/team/app',
    projectPath: 'team/app',
  });
  assert.equal(repositoryFacts('/Users/example/code/app'), null, 'a local path names no repository');
  assert.equal(repositoryFacts(''), null);
});

test('withoutCredentials: the user info of a remote URL is gone, everything else stays', () => {
  assert.equal(withoutCredentials('https://deploy:hunter2@gitlab.example.com/a/b.git'), 'https://gitlab.example.com/a/b.git');
  assert.equal(withoutCredentials('HTTPS://glpat-token@gitlab.example.com/a/b'), 'HTTPS://gitlab.example.com/a/b');
  assert.equal(withoutCredentials('ssh://git@git.example.org:2222/team/app'), 'ssh://git.example.org:2222/team/app');
  assert.equal(withoutCredentials('git@github.com:Org/Repo.git'), 'git@github.com:Org/Repo.git', 'the scp form carries no secret');
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
  assert.equal(manifest.remote, 'https://127.0.0.1:9/nowhere/clone-src.git', 'the project remote, not the local path');
  assert.equal(manifest.defaultBranch, 'main');
  await cli(['cleanup', 'clone-src'], { home });
  assert.ok(!existsSync(path.join(home, 'clone-src', 'checkout')));
  assert.ok(existsSync(path.join(repo, 'README.md')), 'the source checkout is untouched');
});

test('workSlug: a folder whose source is unknown but holds deliverables belongs to nobody else', () => {
  const home = freshHome();
  const alpha = 'https://git.example.com/customers/alpha/website.git';
  const beta = 'https://git.example.com/customers/beta/website.git';
  // An older run that recorded neither sourceId nor remote, but left its analysis behind.
  mkdirSync(path.join(home, 'website'), { recursive: true });
  writeFileSync(path.join(home, 'website', 'manifest.json'), JSON.stringify({ slug: 'website', images: [] }));
  writeFileSync(
    path.join(home, 'website', 'analysis.json'),
    JSON.stringify({ source: { repositories: [{ url: 'https://git.example.com/customers/alpha/website' }] } }),
  );
  assert.equal(workSlug(alpha, home), 'website', 'the analysis names the repository the folder belongs to');
  assert.equal(workSlug(beta, home), 'beta-website');
  // Unknown source, but screenshots in the manifest: no other project may take it.
  mkdirSync(path.join(home, 'portal'), { recursive: true });
  writeFileSync(path.join(home, 'portal', 'manifest.json'), JSON.stringify({ slug: 'portal', images: [{ file: 'overview-desktop.webp' }] }));
  assert.notEqual(workSlug('https://git.example.com/customers/gamma/portal.git', home), 'portal');
  assert.notEqual(workSlug('Portal', home), 'portal');
  // An empty folder of unknown source holds nothing to protect.
  mkdirSync(path.join(home, 'empty'), { recursive: true });
  assert.equal(workSlug('https://git.example.com/customers/delta/empty.git', home), 'empty');
});

test('workSlug and start: a legacy folder that recorded a relative source is nobody else\'s, whoever asks', async () => {
  const home = freshHome();
  // A run from before sourceId, started in a checkout without origin: it recorded "." (the default) and no remote.
  const owner = realpathSync(gitRepo(path.join(TMP, 'relative', 'kundenportal')));
  const dir = path.join(home, 'kundenportal');
  mkdirSync(path.join(dir, 'screenshots'), { recursive: true });
  const shot = path.join(dir, 'screenshots', 'overview-desktop.webp');
  writeFileSync(shot, webp('VP8 ', 1440, 900));
  const legacy = { slug: 'kundenportal', source: '.', remote: null, images: [{ file: 'overview-desktop.webp' }] };
  writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(legacy));
  const other = gitRepo(path.join(TMP, 'relative', 'website'), { origin: 'https://127.0.0.1:9/customers/beta/website.git' });

  assert.equal((await cli(['slug', '.'], { home, cwd: other })).stdout.trim(), 'website', 'a relative source names whoever asks, not the folder');
  const start = await cli(['start', 'kundenportal', '--source', '.'], { home, cwd: other });
  assert.equal(start.code, 5, start.stdout + start.stderr);
  assert.equal(JSON.parse(readFileSync(path.join(dir, 'manifest.json'), 'utf8')).sourceId, undefined, 'the folder is not claimed');
  assert.ok(existsSync(shot), 'its screenshots stay');

  // The absolute checkout path an older start recorded still tells the owner its folder.
  writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ ...legacy, sourceCheckout: { path: owner } }));
  assert.equal((await cli(['slug', '.'], { home, cwd: owner })).stdout.trim(), 'kundenportal');
  assert.notEqual((await cli(['slug', '.'], { home, cwd: other })).stdout.trim(), 'kundenportal');
});

test('start: a name run and a repository of the same name never share a work folder', async () => {
  const home = freshHome();
  const repo = 'https://127.0.0.1:9/customers/beta/website.git';
  const shot = (slug) => path.join(home, slug, 'screenshots', 'overview-desktop.webp');
  const capture = async (slug) => {
    writeFileSync(shot(slug), webp('VP8 ', 1440, 900));
    const add = ['manifest', 'add', slug, '--file', shot(slug), '--feature', 'overview', '--device', 'desktop', '--level', 'public'];
    assert.equal((await cli(add, { home })).code, 0);
    assert.equal((await cli(['cleanup', slug], { home })).code, 0);
  };
  const slugOf = async (source) => (await cli(['slug', source], { home })).stdout.trim();

  // A name run first, then a repository whose name slugifies the same.
  assert.equal(await slugOf('Website'), 'website');
  assert.equal((await cli(['start', 'website', '--source', 'Website'], { home })).code, 0);
  await capture('website');
  assert.notEqual(await slugOf(repo), 'website', "the repository does not inherit the name run's screenshots");
  assert.equal((await cli(['start', 'website', '--source', repo], { home })).code, 5);
  assert.equal(await slugOf('Website'), 'website', 'the name run keeps its folder');

  // A repository first, then a name run of the same name.
  const portal = 'https://127.0.0.1:9/customers/gamma/portal.git';
  assert.equal(await slugOf(portal), 'portal');
  assert.equal((await cli(['start', 'portal', '--source', portal], { home })).code, 0);
  await capture('portal');
  assert.notEqual(await slugOf('Portal'), 'portal');
  assert.equal((await cli(['start', 'portal', '--source', 'Portal'], { home })).code, 5);
});

test('start: a run whose clone failed keeps its folder against another repository of the same name', async () => {
  const home = freshHome();
  const alpha = 'https://127.0.0.1:9/customers/alpha/website.git';
  const beta = 'https://127.0.0.1:9/customers/beta/website.git';
  assert.equal((await cli(['start', 'website', '--source', alpha], { home })).code, 0);
  assert.notEqual((await cli(['clone', 'website', alpha], { home })).code, 0, 'unreachable remote, no local checkout');
  const shot = path.join(home, 'website', 'screenshots', 'overview-desktop.webp');
  writeFileSync(shot, webp('VP8 ', 1440, 900));
  const add = ['manifest', 'add', 'website', '--file', shot, '--feature', 'overview', '--device', 'desktop', '--level', 'public'];
  assert.equal((await cli(add, { home })).code, 0);
  assert.equal((await cli(['cleanup', 'website'], { home })).code, 0);
  assert.equal((await cli(['slug', beta], { home })).stdout.trim(), 'beta-website');
  assert.equal((await cli(['start', 'website', '--source', beta], { home })).code, 5);
});

test('start and clone: the work folder of another repository with the same name is refused, its deliverables stay', async () => {
  const home = freshHome();
  const alphaRemote = 'https://127.0.0.1:9/customers/alpha/website.git';
  const alpha = gitRepo(path.join(TMP, 'collide', 'alpha', 'website'), { origin: alphaRemote });
  const beta = gitRepo(path.join(TMP, 'collide', 'beta', 'website'), { origin: 'https://127.0.0.1:9/customers/beta/website.git' });
  const slugOf = async (source) => (await cli(['slug', source], { home })).stdout.trim();
  const manifest = () => JSON.parse(readFileSync(path.join(home, 'website', 'manifest.json'), 'utf8'));
  const shot = path.join(home, 'website', 'screenshots', 'live-start-desktop.webp');

  assert.equal(await slugOf(alpha), 'website');
  assert.equal((await cli(['start', 'website', '--source', alpha], { home })).code, 0);
  assert.equal((await cli(['clone', 'website', alpha], { home })).code, 0);
  writeFileSync(shot, webp('VP8 ', 1440, 900));
  assert.equal((await cli(['cleanup', 'website'], { home })).code, 0);

  assert.equal(await slugOf(beta), 'beta-website', 'the second repository gets its own work folder');
  assert.equal(await slugOf(alpha), 'website', 'the first keeps its slug');

  const start = await cli(['start', 'website', '--source', beta], { home });
  assert.equal(start.code, 5, start.stdout + start.stderr);
  assert.match(start.stderr, /SLUG_TAKEN/);
  // Without --source the start cannot tell; the clone names the repository and must refuse.
  assert.equal((await cli(['start', 'website'], { home })).code, 0);
  const clone = await cli(['clone', 'website', beta], { home });
  assert.equal(clone.code, 5, clone.stdout + clone.stderr);
  assert.ok(!existsSync(path.join(home, 'website', 'checkout')), 'nothing of the other repository is cloned in');
  assert.equal(manifest().remote, alphaRemote, 'the manifest still describes the first repository');
  assert.ok(existsSync(shot), "the first run's screenshots stay");
  await cli(['cleanup', 'website'], { home });

  assert.equal((await cli(['start', 'beta-website', '--source', beta], { home })).code, 0);
  assert.equal((await cli(['clone', 'beta-website', beta], { home })).code, 0);
  assert.equal(await slugOf(beta), 'beta-website');
  assert.equal(await slugOf(alpha), 'website');
});

test('source: the showcase source of the cloned commit, without credentials, also after cleanup', async () => {
  const home = freshHome();
  const repo = gitRepo(path.join(TMP, 'source-src'), {
    origin: 'https://deploy:hunter2@127.0.0.1:9/kunden/source-src.git',
  });
  writeFileSync(path.join(repo, 'package.json'), JSON.stringify({ name: 'source-src', version: '2.4.1' }));
  spawnSync('git', ['add', '.'], { cwd: repo });
  spawnSync('git', ['commit', '-q', '-m', 'version'], { cwd: repo });
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).stdout.trim();
  await cli(['start', 'source-src', '--source', repo], { home });
  assert.equal((await cli(['clone', 'source-src', repo], { home })).code, 0);
  await cli(['cleanup', 'source-src'], { home });

  const r = await cli(['source', 'source-src', '--path', 'projects/app'], { home });
  assert.equal(r.code, 0, r.stderr);
  const { source, fromLocalCheckout } = JSON.parse(r.stdout);
  assert.equal(fromLocalCheckout, true, 'the origin was unreachable, so the local checkout was cloned');
  assert.deepEqual(Object.keys(source).sort(), ['analyzedAt', 'analyzedCommit', 'analyzedVersion', 'analyzerVersion', 'repositories']);
  assert.deepEqual(source.repositories, [
    {
      provider: 'other',
      url: 'https://127.0.0.1:9/kunden/source-src',
      projectPath: 'kunden/source-src',
      defaultBranch: 'main',
      path: 'projects/app',
    },
  ]);
  assert.equal(source.analyzedCommit, head);
  assert.equal(source.analyzedVersion, '2.4.1');
  const plugin = JSON.parse(readFileSync(path.join(path.dirname(SCRIPT), '..', '.claude-plugin', 'plugin.json'), 'utf8'));
  assert.equal(source.analyzerVersion, plugin.version);
  assert.ok(!Number.isNaN(Date.parse(source.analyzedAt)));
  assert.ok(!r.stdout.includes('hunter2'), 'credentials never reach the output');
  const manifest = readFileSync(path.join(home, 'source-src', 'manifest.json'), 'utf8');
  assert.ok(!manifest.includes('hunter2'), 'credentials never reach the manifest either');
});

test('source: a project without version leaves analyzedVersion out instead of sending null', async () => {
  const home = freshHome();
  const repo = gitRepo(path.join(TMP, 'no-version'), { origin: 'git@github.com:Org/no-version.git' });
  await cli(['start', 'no-version'], { home });
  await cli(['clone', 'no-version', repo], { home });
  const { source } = JSON.parse((await cli(['source', 'no-version'], { home })).stdout);
  assert.ok(!('analyzedVersion' in source));
  assert.equal(source.repositories[0].provider, 'github');
  assert.ok(!('path' in source.repositories[0]));
  await cli(['cleanup', 'no-version'], { home });
});

test('changes: the paths changed since the analyzed commit, fetched into a shallow clone', async () => {
  const home = freshHome();
  const repo = gitRepo(path.join(TMP, 'changes-src'));
  const g = (...a) => spawnSync('git', a, { cwd: repo, encoding: 'utf8' });
  g('config', 'uploadpack.allowReachableSHA1InWant', 'true');
  mkdirSync(path.join(repo, 'src', 'orders'), { recursive: true });
  writeFileSync(path.join(repo, 'src', 'orders', 'orders.service.ts'), 'export class OrdersService {}\n');
  g('add', '.');
  g('commit', '-q', '-m', 'orders module');
  const analyzed = g('rev-parse', 'HEAD').stdout.trim();
  mkdirSync(path.join(repo, 'app', 'pages'), { recursive: true });
  writeFileSync(path.join(repo, 'app', 'pages', 'invoices.vue'), '<template />\n');
  writeFileSync(path.join(repo, 'README.md'), '# fixture, changed\n');
  g('mv', 'src/orders', 'src/purchases');
  g('add', '.');
  g('commit', '-q', '-m', 'invoices page, orders renamed');
  await cli(['start', 'changes-src'], { home });
  const url = pathToFileURL(repo).href;
  assert.equal((await cli(['clone', 'changes-src', url], { home })).code, 0);
  const shallow = spawnSync('git', ['rev-parse', '--is-shallow-repository'], { cwd: path.join(home, 'changes-src', 'checkout'), encoding: 'utf8' });
  assert.equal(shallow.stdout.trim(), 'true', 'the clone of a URL is shallow');

  const r = await cli(['changes', 'changes-src', '--since', analyzed], { home });
  assert.equal(r.code, 0, r.stderr);
  const result = JSON.parse(r.stdout);
  assert.equal(result.since, analyzed);
  assert.deepEqual(
    result.files,
    ['README.md', 'app/pages/invoices.vue', 'src/orders/orders.service.ts', 'src/purchases/orders.service.ts'],
    'a moved file names its old path too, so findings citing it are re-analyzed',
  );
  assert.equal(result.unchanged, false);

  const same = JSON.parse((await cli(['changes', 'changes-src', '--since', result.head], { home })).stdout);
  assert.equal(same.unchanged, true);
  assert.deepEqual(same.files, []);

  // A diff that fails is an error, never "unchanged": update would report a stale showcase as current.
  const broken = await cli(['changes', 'changes-src', '--since', analyzed], {
    home,
    env: { GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'diff.orderFile', GIT_CONFIG_VALUE_0: path.join(TMP, 'missing-order-file') },
  });
  assert.notEqual(broken.code, 0, broken.stdout);
  assert.ok(!broken.stdout.includes('"unchanged": true'));
  await cli(['cleanup', 'changes-src'], { home });
});

test('changes: a commit the remote no longer has exits 4, so update falls back to a full analysis', async () => {
  const home = freshHome();
  const repo = gitRepo(path.join(TMP, 'changes-gone'));
  await cli(['start', 'changes-gone'], { home });
  await cli(['clone', 'changes-gone', pathToFileURL(repo).href], { home });
  const r = await cli(['changes', 'changes-gone', '--since', 'f'.repeat(40)], { home });
  assert.equal(r.code, 4, r.stdout + r.stderr);
  assert.match(r.stderr, /not reachable/);
  assert.equal((await cli(['changes', 'changes-gone', '--since', 'HEAD~1'], { home })).code, 1, 'only a full commit id');
  await cli(['cleanup', 'changes-gone'], { home });
});

test('manifest add: a local capture keeps the commit it shows, also after a later clone moves on', async () => {
  const home = freshHome();
  const repo = gitRepo(path.join(TMP, 'shot-commit'));
  const g = (...a) => spawnSync('git', a, { cwd: repo, encoding: 'utf8' });
  await cli(['start', 'shot-commit'], { home });
  await cli(['clone', 'shot-commit', repo], { home });
  const shown = g('rev-parse', 'HEAD').stdout.trim();
  const shots = path.join(home, 'shot-commit', 'screenshots');
  writeFileSync(path.join(shots, 'overview-desktop.webp'), webp('VP8 ', 1440, 900));
  writeFileSync(path.join(shots, 'old.webp'), webp('VP8L', 1200, 3000));
  const add = (file, level) =>
    cli(['manifest', 'add', 'shot-commit', '--file', path.join(shots, file), '--feature', file.split('.')[0], '--device', 'desktop', '--level', level], { home });
  assert.equal((await add('overview-desktop.webp', 'local')).code, 0);
  assert.equal((await add('old.webp', 'legacy')).code, 0);

  writeFileSync(path.join(repo, 'README.md'), '# moved on\n');
  g('commit', '-q', '-am', 'later');
  await cli(['cleanup', 'shot-commit'], { home });
  await cli(['start', 'shot-commit'], { home });
  await cli(['clone', 'shot-commit', repo], { home });
  const m = JSON.parse(readFileSync(path.join(home, 'shot-commit', 'manifest.json'), 'utf8'));
  assert.notEqual(m.commit, shown, 'the re-analysis clone moved the manifest on');
  assert.equal(m.images.find((i) => i.level === 'local').commit, shown);
  assert.equal(m.images.find((i) => i.level === 'legacy').commit, null, 'an older screenshot shows no known commit');
  await cli(['cleanup', 'shot-commit'], { home });
});

test('source: refuses without a cloned commit', async () => {
  const home = freshHome();
  await cli(['start', 'no-clone'], { home });
  const r = await cli(['source', 'no-clone'], { home });
  assert.notEqual(r.code, 0);
  assert.match(r.stderr, /clone/);
});

test('analysis save/show: stores the report from stdin and reads it back', async () => {
  const home = freshHome();
  const report = {
    scope: 'showcase',
    source: { analyzedCommit: 'a'.repeat(40), repositories: [] },
    features: [{ name: 'Rechnungen', evidence: 'src/invoice.ts:12' }],
  };
  const s = await cli(['analysis', 'save', 'stored'], { home, input: JSON.stringify(report) });
  assert.equal(s.code, 0, s.stderr);
  assert.deepEqual(JSON.parse(s.stdout), { slug: 'stored', scope: 'showcase', features: 1, analyzedCommit: 'a'.repeat(40) });
  const r = await cli(['analysis', 'show', 'stored'], { home });
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout), report);
});

test('analysis save: refuses what is no report, and show refuses a missing one', async () => {
  const home = freshHome();
  assert.notEqual((await cli(['analysis', 'save', 'bad'], { home, input: 'not json' })).code, 0);
  const noCommit = await cli(['analysis', 'save', 'bad'], { home, input: JSON.stringify({ scope: 'showcase' }) });
  assert.notEqual(noCommit.code, 0);
  assert.match(noCommit.stderr, /analyzedCommit/);
  for (const analyzedCommit of ['abc1234', 'HEAD', `${'a'.repeat(40)}x`]) {
    const r = await cli(['analysis', 'save', 'bad'], { home, input: JSON.stringify({ source: { analyzedCommit } }) });
    assert.notEqual(r.code, 0, `${analyzedCommit} is no full commit id`);
  }
  assert.ok(!existsSync(path.join(home, 'bad', 'analysis.json')));
  const show = await cli(['analysis', 'show', 'bad'], { home });
  assert.notEqual(show.code, 0);
  assert.match(show.stderr, /no analysis/);
});

test('cleanup: the analysis report stays with the deliverables', async () => {
  const home = freshHome();
  await cli(['start', 'report'], { home });
  mkdirSync(path.join(home, 'report', 'checkout'));
  writeFileSync(path.join(home, 'report', 'analysis.json'), '{"scope":"showcase"}');
  const c = await cli(['cleanup', 'report'], { home });
  assert.equal(c.code, 0, c.stdout + c.stderr);
  assert.ok(!existsSync(path.join(home, 'report', 'checkout')));
  assert.equal(readFileSync(path.join(home, 'report', 'analysis.json'), 'utf8'), '{"scope":"showcase"}');
});

test('analysis current: compares the report with the default branch without a shell, whatever the branch is called', async () => {
  const home = freshHome();
  const repo = gitRepo(path.join(TMP, 'current-src'));
  const g = (...a) => spawnSync('git', a, { cwd: repo, encoding: 'utf8' });
  // A valid ref name (git check-ref-format accepts it): pasted into a command line it would run `touch PWNED`.
  // No `|`: a loose ref is a file under .git/refs, and Windows file names refuse it.
  const hostile = 'main;touch${IFS}PWNED;true';
  assert.equal(g('branch', '-m', hostile).status, 0, 'the hostile branch exists, or the test proves nothing');
  assert.deepEqual(JSON.parse((await cli(['analysis', 'current', 'current-src'], { home })).stdout), {
    current: false,
    reason: 'no analysis report',
  });
  await cli(['start', 'current-src'], { home });
  assert.equal((await cli(['clone', 'current-src', pathToFileURL(repo).href], { home })).code, 0);
  const { source } = JSON.parse((await cli(['source', 'current-src'], { home })).stdout);
  await cli(['analysis', 'save', 'current-src'], { home, input: JSON.stringify({ scope: 'showcase', source }) });
  await cli(['cleanup', 'current-src'], { home });

  const fresh = await cli(['analysis', 'current', 'current-src'], { home });
  assert.equal(fresh.code, 0, fresh.stderr);
  assert.deepEqual(JSON.parse(fresh.stdout), {
    analyzedCommit: source.analyzedCommit,
    branch: hostile,
    head: source.analyzedCommit,
    current: true,
  });

  writeFileSync(path.join(repo, 'README.md'), '# newer\n');
  g('commit', '-q', '-am', 'newer');
  const stale = JSON.parse((await cli(['analysis', 'current', 'current-src'], { home })).stdout);
  assert.equal(stale.current, false);
  assert.equal(stale.head, g('rev-parse', 'HEAD').stdout.trim());
  for (const dir of [process.cwd(), home, repo, CLI_TMP]) assert.ok(!existsSync(path.join(dir, 'PWNED')), `nothing ran in ${dir}`);
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

/** A one-shot upload endpoint like the Showroom's ticket URL; records what it received. */
async function uploadServer(status = 200) {
  const received = [];
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      received.push({ method: req.method, type: req.headers['content-type'] ?? '', body: Buffer.concat(chunks).toString('latin1') });
      if (status !== 200) return res.writeHead(status).end('ticket used');
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ fileId: 'b'.repeat(24), width: 1440, height: 900, device: 'desktop', bytes: 30, deduplicated: false }));
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { server, received, url: `http://127.0.0.1:${server.address().port}/files/upload/ticket/abc` };
}

test('upload: posts one manifest image to the ticket URL and keeps its fileId in the manifest', async () => {
  const home = freshHome();
  await cli(['start', 'up'], { home });
  const shots = path.join(home, 'up', 'screenshots');
  writeFileSync(path.join(shots, 'overview-desktop.webp'), webp('VP8 ', 1440, 900));
  await cli(['manifest', 'add', 'up', '--file', path.join(shots, 'overview-desktop.webp'), '--feature', 'overview', '--device', 'desktop', '--level', 'local', '--customer-branding'], { home });
  const { server, received, url } = await uploadServer();
  const r = await cli(['upload', 'up', 'overview-desktop.webp', '--url', url], { home });
  server.close();
  assert.equal(r.code, 0, r.stderr);
  const answer = JSON.parse(r.stdout);
  assert.equal(answer.fileId, 'b'.repeat(24));
  assert.equal(answer.showsCustomer, true, 'the manifest flag travels with the answer, for showsCustomer');
  assert.equal(received.length, 1);
  assert.equal(received[0].method, 'POST');
  assert.match(received[0].type, /^multipart\/form-data; boundary=/);
  assert.match(received[0].body, /name="file"; filename="overview-desktop\.webp"/);
  assert.match(received[0].body, /name="device"\r\n\r\ndesktop/);
  assert.ok(!r.stdout.includes('RIFF'), 'no file content in the output');
  const entry = JSON.parse(readFileSync(path.join(home, 'up', 'manifest.json'), 'utf8')).images[0];
  assert.equal(entry.fileId, 'b'.repeat(24));
  assert.equal(entry.uploadOrigin, new URL(url).origin);
  await cli(['cleanup', 'up'], { home });
});

test('upload: refuses foreign files, plain http to a remote host, and keeps the manifest on a failed upload', async () => {
  const home = freshHome();
  await cli(['start', 'up2'], { home });
  const shots = path.join(home, 'up2', 'screenshots');
  writeFileSync(path.join(shots, 'a-desktop.webp'), webp('VP8 ', 1440, 900));
  await cli(['manifest', 'add', 'up2', '--file', path.join(shots, 'a-desktop.webp'), '--feature', 'a', '--device', 'desktop', '--level', 'local'], { home });
  writeFileSync(path.join(shots, 'stray.webp'), webp('VP8 ', 1440, 900));
  // A listening server, so the refusal is the manifest guard's and not a failed connection: an image nobody
  // recorded carries no people or branding flags and must never reach the Showroom.
  const listening = await uploadServer();
  const stray = await cli(['upload', 'up2', 'stray.webp', '--url', listening.url], { home });
  listening.server.close();
  assert.notEqual(stray.code, 0, 'only images the manifest lists');
  assert.match(stray.stderr, /not in the manifest/);
  assert.equal(listening.received.length, 0, 'the stray image never left this machine');
  assert.notEqual((await cli(['upload', 'up2', '../manifest.json', '--url', 'http://127.0.0.1:9/x'], { home })).code, 0);
  const plain = await cli(['upload', 'up2', 'a-desktop.webp', '--url', 'http://showroom.example.com/files/upload/ticket/x'], { home });
  assert.notEqual(plain.code, 0);
  assert.match(plain.stderr, /https/);
  const { server, url } = await uploadServer(410);
  const failed = await cli(['upload', 'up2', 'a-desktop.webp', '--url', url], { home });
  server.close();
  assert.notEqual(failed.code, 0);
  assert.match(failed.stderr, /410/);
  const entry = JSON.parse(readFileSync(path.join(home, 'up2', 'manifest.json'), 'utf8')).images[0];
  assert.ok(!('fileId' in entry));
  await cli(['cleanup', 'up2'], { home });
});

/** An upload endpoint that answers each request with the next scripted body; records the device sent. */
async function scriptedServer(bodies) {
  const received = [];
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('latin1');
      received.push({ device: /name="device"\r\n\r\n(\w+)/.exec(body)?.[1] ?? null, body });
      res.writeHead(200, { 'content-type': 'application/json' }).end(bodies[received.length - 1] ?? '{}');
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { server, received, url: `http://127.0.0.1:${server.address().port}/files/upload/ticket/abc` };
}

test('upload: the right entry, its device, only a 24-hex fileId, and nothing outside screenshots/', async () => {
  const home = freshHome();
  await cli(['start', 'up3'], { home });
  const shots = path.join(home, 'up3', 'screenshots');
  const add = async (file, device, w, h, extra = []) => {
    writeFileSync(path.join(shots, file), webp('VP8 ', w, h));
    const r = await cli(['manifest', 'add', 'up3', '--file', path.join(shots, file), '--feature', 'overview', '--device', device, '--level', device === 'cover' ? 'legacy' : 'local', ...extra], { home });
    assert.equal(r.code, 0, r.stderr);
  };
  await add('overview-desktop.webp', 'desktop', 1440, 900);
  await add('overview-mobile.webp', 'mobile', 780, 1688, ['--customer-branding']);
  await add('overview-cover.webp', 'cover', 1200, 630);
  const mf = () => JSON.parse(readFileSync(path.join(home, 'up3', 'manifest.json'), 'utf8')).images;

  // An answer without a proper fileId is no upload, whatever the status says.
  const bad = await scriptedServer(['{}', JSON.stringify({ fileId: `../${'a'.repeat(24)}` }), '<html>login</html>']);
  const codes = [];
  for (let i = 0; i < 3; i++) codes.push((await cli(['upload', 'up3', 'overview-desktop.webp', '--url', bad.url], { home })).code);
  bad.server.close();
  assert.ok(codes.every((c) => c !== 0), `every answer refused: ${codes}`);
  assert.ok(mf().every((e) => !('fileId' in e) && !('uploadedAt' in e)), 'a refused answer leaves the manifest alone');

  // Each image goes up with its own device (none for a cover) and keeps its own fileId.
  const ok = await scriptedServer([JSON.stringify({ fileId: '1'.repeat(24) }), JSON.stringify({ fileId: '2'.repeat(24) })]);
  const mobile = await cli(['upload', 'up3', 'overview-mobile.webp', '--url', ok.url], { home });
  const cover = await cli(['upload', 'up3', 'overview-cover.webp', '--url', ok.url], { home });
  ok.server.close();
  assert.equal(mobile.code, 0, mobile.stderr);
  assert.equal(cover.code, 0, cover.stderr);
  assert.equal(JSON.parse(mobile.stdout).showsCustomer, true);
  assert.equal(JSON.parse(cover.stdout).showsCustomer, false);
  assert.deepEqual(ok.received.map((r) => r.device), ['mobile', null]);
  assert.deepEqual(Object.fromEntries(mf().map((e) => [e.file, e.fileId ?? null])), {
    'screenshots/overview-desktop.webp': null,
    'screenshots/overview-mobile.webp': '1'.repeat(24),
    'screenshots/overview-cover.webp': '2'.repeat(24),
  });

  // A stored fileId is never reused: the server deletes a file with its showcase or block and then hands out
  // a new id, so a later run uploads again and keeps the new one (a stale id shows as a blank image).
  const again = await scriptedServer([JSON.stringify({ fileId: '4'.repeat(24) })]);
  const second = await cli(['upload', 'up3', 'overview-mobile.webp', '--url', again.url], { home });
  again.server.close();
  assert.equal(second.code, 0, second.stderr);
  assert.equal(again.received.length, 1, 'uploaded again despite the stored fileId');
  assert.equal(JSON.parse(second.stdout).fileId, '4'.repeat(24));
  assert.equal(mf().find((e) => e.file === 'screenshots/overview-mobile.webp').fileId, '4'.repeat(24));

  // A manifest entry pointing outside screenshots/ never sends that file anywhere.
  writeFileSync(path.join(home, 'secret.txt'), 'outside the work folder');
  await cli(['manifest', 'meta', 'up3', 'images.0.file=../secret.txt'], { home });
  const outside = await scriptedServer([JSON.stringify({ fileId: '3'.repeat(24) })]);
  const r = await cli(['upload', 'up3', '../../secret.txt', '--url', outside.url], { home });
  outside.server.close();
  assert.notEqual(r.code, 0);
  assert.equal(outside.received.length, 0, 'nothing left this machine');
  await cli(['cleanup', 'up3'], { home });
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
