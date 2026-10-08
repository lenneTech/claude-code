// cdp.mjs — a small Chrome DevTools Protocol client without dependencies.
//
// Starts a headless Chrome with a throw-away profile and talks to it over the
// WebSocket that Node ≥ 22 provides globally. Each page runs in its own browser
// context, so cookies and sessionStorage never leak from one run into the next
// (a calculator that restores its last input from sessionStorage otherwise makes
// the original and the backup disagree for reasons that have nothing to do with
// the backup).

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CANDIDATES = {
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ],
  linux: ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge'],
  win32: [
    path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  ],
};

export function findChrome(explicit) {
  if (explicit) return existsSync(explicit) ? explicit : null;
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  for (const c of CANDIDATES[process.platform] || []) {
    if (path.isAbsolute(c)) {
      if (existsSync(c)) return c;
    } else {
      const r = spawnSync('which', [c], { encoding: 'utf8' });
      if (r.status === 0 && r.stdout.trim()) return r.stdout.trim();
    }
  }
  return null;
}

export class CdpConnection {
  constructor(ws, { timeout = 60000 } = {}) {
    this.ws = ws;
    this.id = 0;
    this.timeout = timeout;
    this.closed = null;
    this.pending = new Map();
    this.listeners = new Set();
    // A dead browser must not leave callers waiting forever: reject everything still open.
    const fail = (reason) => {
      this.closed = reason;
      for (const { reject, timer } of this.pending.values()) {
        clearTimeout(timer);
        reject(new Error(reason));
      }
      this.pending.clear();
    };
    ws.addEventListener('close', () => fail('DevTools connection closed'));
    ws.addEventListener('error', () => fail('DevTools connection failed'));
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : Buffer.from(ev.data).toString('utf8'));
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject, timer } = this.pending.get(msg.id);
        clearTimeout(timer);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(`${msg.error.message} (${msg.error.code})`));
        else resolve(msg.result);
      } else if (msg.method) {
        for (const fn of this.listeners) fn(msg);
      }
    });
  }

  /** Sends a command; rejects after `timeout` ms or when the connection closes. */
  send(method, params = {}, sessionId, { timeout = this.timeout } = {}) {
    if (this.closed) return Promise.reject(new Error(this.closed));
    const id = ++this.id;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} timed out after ${timeout} ms`));
      }, timeout);
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.ws.send(JSON.stringify(payload));
      } catch (err) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(err);
      }
    });
  }

  on(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

export async function launchChrome({ chromePath, extraArgs = [] } = {}) {
  const binary = findChrome(chromePath);
  if (!binary) throw new Error('Chrome/Chromium not found (set CHROME_PATH or pass --chrome <path>)');
  const profile = mkdtempSync(path.join(os.tmpdir(), 'lt-cdp-'));
  const child = spawn(
    binary,
    [
      '--headless=new',
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--disable-component-update',
      '--disable-background-networking',
      '--mute-audio',
      '--autoplay-policy=no-user-gesture-required',
      ...extraArgs,
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
  const portFile = path.join(profile, 'DevToolsActivePort');
  const deadline = Date.now() + 20000;
  while (!existsSync(portFile) || readFileSync(portFile, 'utf8').split('\n').length < 2) {
    if (Date.now() > deadline || child.exitCode !== null) {
      child.kill();
      throw new Error('Chrome did not open a DevTools port');
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  const [port, wsPath] = readFileSync(portFile, 'utf8').trim().split('\n');
  const ws = new WebSocket(`ws://127.0.0.1:${port}${wsPath}`);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', () => reject(new Error('DevTools WebSocket failed')), { once: true });
  });
  const conn = new CdpConnection(ws);
  const close = async () => {
    try {
      await conn.send('Browser.close', {}, undefined, { timeout: 2000 });
    } catch {}
    try {
      ws.close();
    } catch {}
    if (child.exitCode === null) child.kill();
    await new Promise((r) => setTimeout(r, 300));
    try {
      rmSync(profile, { recursive: true, force: true, maxRetries: 3 });
    } catch {}
  };
  return { conn, close, binary };
}

/**
 * Opens a page in a fresh browser context. Returns helpers bound to that page:
 * goto(url), evaluate(fnSource, arg), screenshot(), issues (errors seen since goto), dispose().
 */
export async function openPage(conn, { width = 1440, height = 900, mobile = false, deviceScaleFactor = 1, blockedUrls = [] } = {}) {
  const { browserContextId } = await conn.send('Target.createBrowserContext', { disposeOnDetach: true });
  const { targetId } = await conn.send('Target.createTarget', { url: 'about:blank', browserContextId });
  const { sessionId } = await conn.send('Target.attachToTarget', { targetId, flatten: true });
  const send = (method, params, opts) => conn.send(method, params, sessionId, opts);
  await Promise.all([send('Page.enable'), send('Runtime.enable'), send('Network.enable'), send('Log.enable')]);
  if (blockedUrls.length) await send('Network.setBlockedURLs', { urls: blockedUrls });
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor, mobile });
  if (mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });

  let issues = [];
  let inflight = new Set();
  const urls = new Map();
  let lastNetwork = Date.now();
  let loadResolve = null;
  const off = conn.on((msg) => {
    if (msg.sessionId !== sessionId) return;
    const p = msg.params || {};
    switch (msg.method) {
      case 'Page.loadEventFired':
        if (loadResolve) loadResolve();
        break;
      case 'Runtime.exceptionThrown':
        issues.push({ type: 'exception', text: p.exceptionDetails?.exception?.description || p.exceptionDetails?.text || 'exception' });
        break;
      case 'Runtime.consoleAPICalled':
        if (p.type === 'error') issues.push({ type: 'console', text: (p.args || []).map((a) => a.value ?? a.description ?? '').join(' ') });
        break;
      case 'Log.entryAdded':
        if (p.entry?.level === 'error') issues.push({ type: 'log', text: p.entry.text, url: p.entry.url });
        break;
      case 'Network.requestWillBeSent':
        urls.set(p.requestId, p.request?.url);
        inflight.add(p.requestId);
        lastNetwork = Date.now();
        break;
      case 'Network.loadingFinished':
        inflight.delete(p.requestId);
        lastNetwork = Date.now();
        break;
      case 'Network.loadingFailed':
        inflight.delete(p.requestId);
        lastNetwork = Date.now();
        // A request Network.setBlockedURLs stops arrives with an empty errorText and only a
        // blockedReason; name it, so a blocked live-site file reads as what it is.
        if (!p.canceled) issues.push({ type: 'request', text: p.errorText || (p.blockedReason ? `net::ERR_BLOCKED_BY_CLIENT (${p.blockedReason})` : ''), url: urls.get(p.requestId) });
        break;
      case 'Network.responseReceived':
        if (p.response?.status >= 400) issues.push({ type: 'http', text: `HTTP ${p.response.status}`, url: p.response.url });
        break;
      default:
    }
  });
  async function goto(url, { timeout = 30000, idle = 600, maxIdleWait = 6000 } = {}) {
    issues = [];
    inflight = new Set();
    const loaded = new Promise((r) => {
      loadResolve = r;
    });
    // Page.navigate answers only once the server sends a response; a server that never
    // answers would otherwise block the whole comparison.
    const nav = await send('Page.navigate', { url }, { timeout });
    if (nav.errorText) throw new Error(`Navigation failed: ${nav.errorText}`);
    await Promise.race([loaded, new Promise((r) => setTimeout(r, timeout))]);
    const until = Date.now() + maxIdleWait;
    while (Date.now() < until && (inflight.size > 0 || Date.now() - lastNetwork < idle)) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  async function evaluate(fnSource, arg, { timeout = 120000 } = {}) {
    const expression = `(${fnSource})(${JSON.stringify(arg ?? {})})`;
    const res = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true }, { timeout });
    if (res.exceptionDetails) throw new Error(res.exceptionDetails.exception?.description || res.exceptionDetails.text);
    return res.result.value;
  }

  async function screenshot() {
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    return Buffer.from(data, 'base64');
  }

  async function dispose() {
    off();
    try {
      await conn.send('Target.closeTarget', { targetId }, undefined, { timeout: 5000 });
      await conn.send('Target.disposeBrowserContext', { browserContextId }, undefined, { timeout: 5000 });
    } catch {}
  }

  return { goto, evaluate, screenshot, dispose, get issues() { return issues; } };
}
