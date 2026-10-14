#!/usr/bin/env node
// ai-models.mjs
//
// Deterministic AI model check for projects that call LLMs. It answers the cheap
// questions without a model in the loop, so a scheduled run costs no tokens:
//
//   inventory  which models the project uses (adapter + code seeds + optional runtime)
//   catalog    is every model in use still offered for this key (GET /models)
//   lifecycle  announced shutdowns, lifecycle status, capabilities (mittwald docs)
//   probe      does the model do what the usage needs (vision, reasoning off,
//              budget, cache, JSON mode, native tool calls, embeddings) — a few
//              tokens per probe, only for what a usage declares in `needs`
//   check      inventory + catalog + lifecycle (+ probe with --probe) as one report
//   summarize  benchmark results (JSONL) per configuration: value-based scores,
//              median/P90 latency without cached calls
//   ticket     files the report as one Linear ticket in Triage (fingerprint dedupe)
//
// Quality is NOT measured here. That needs the project's own pipeline (prompts,
// batching, gates, parsers decide with the model); /lt-dev:backend:ai-model-review
// runs it. This script only says whether that expensive run is needed.
//
// Configuration: `.ai-models.json` in the project (see the
// maintaining-ai-models skill, reference/adapter.md). No keys in the adapter —
// only the name of the environment variable that holds one.
//
// Exit codes (every command): 0 nothing to do · 1 action needed · 2 urgent ·
// 3 usage, configuration or network error.
//
// Dependency-free (Node >= 20). Pure functions are exported for
// ai-models.test.mjs; the CLI runs only when this file is executed directly.

import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

export const EXIT = { ERROR: 3, OK: 0, URGENT: 2, WARN: 1 };

/**
 * How much speed counts for a usage. `interactive`: a person waits for the answer
 * (chat, assistant, inline generation), so latency is a criterion next to quality.
 * `background`: one step of a longer process (document analysis, batch, import)
 * whose other steps take longer anyway, so quality decides and latency only
 * breaks ties.
 */
export const LATENCY_CLASSES = ['interactive', 'background'];
export const LEVEL_NAMES = { 0: 'info', 1: 'action', 2: 'urgent', 3: 'error' };

const MITTWALD_REPO = 'mittwald/developer-portal';
const MITTWALD_BRANCH = 'master';
const MITTWALD_MODELS_DIR = 'docs/platform/aihosting/30-models';
const ANTHROPIC_BASE = 'https://api.anthropic.com/v1';

// ── Arguments ────────────────────────────────────────────────────────────────

export function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) {
      args._.push(a);
      continue;
    }
    const eq = a.indexOf('=');
    if (eq > -1) {
      args[a.slice(2, eq)] = a.slice(eq + 1);
    } else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
      args[a.slice(2)] = argv[++i];
    } else {
      args[a.slice(2)] = true;
    }
  }
  return args;
}

// ── Adapter ──────────────────────────────────────────────────────────────────

/** Reads and validates the adapter. Throws with a message naming the problem. */
export function loadAdapter(path) {
  if (!existsSync(path)) {
    throw new Error(`adapter not found: ${path} (create .ai-models.json, see the maintaining-ai-models skill)`);
  }
  let adapter;
  try {
    adapter = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    throw new Error(`adapter is not valid JSON: ${path}: ${e.message}`);
  }
  validateAdapter(adapter);
  return adapter;
}

export function validateAdapter(adapter) {
  const problems = [];
  if (!Array.isArray(adapter.providers) || adapter.providers.length === 0) problems.push('providers[] is missing');
  if (!Array.isArray(adapter.usages) || adapter.usages.length === 0) problems.push('usages[] is missing');
  const providerIds = new Set((adapter.providers ?? []).map((p) => p.id));
  for (const p of adapter.providers ?? []) {
    if (!p.id) problems.push('a provider has no id');
    if (!['anthropic', 'mittwald', 'openai'].includes(p.kind)) problems.push(`provider ${p.id}: kind must be openai, mittwald or anthropic`);
    if (p.kind !== 'anthropic' && !p.baseUrl) problems.push(`provider ${p.id}: baseUrl is missing`);
    if (p.key || p.apiKey) problems.push(`provider ${p.id}: the adapter must not hold a key; name the variable in keyEnv`);
  }
  for (const u of adapter.usages ?? []) {
    if (!u.id) problems.push('a usage has no id');
    if (!u.model) problems.push(`usage ${u.id}: model is missing`);
    if (!providerIds.has(u.provider)) problems.push(`usage ${u.id}: provider "${u.provider}" is not declared`);
    if (u.latency !== undefined && !LATENCY_CLASSES.includes(u.latency)) problems.push(`usage ${u.id}: latency must be ${LATENCY_CLASSES.join(' or ')}`);
    if (u.latencyBudgetMs !== undefined && !(Number(u.latencyBudgetMs) > 0)) problems.push(`usage ${u.id}: latencyBudgetMs must be a positive number`);
  }
  if (problems.length) throw new Error(`adapter is invalid:\n  - ${problems.join('\n  - ')}`);
}

// ── Findings ─────────────────────────────────────────────────────────────────

/** One finding. `code` is stable (fingerprints and dedupe build on it). */
export function finding(level, code, subject, message, extra = {}) {
  return { code, level, message, subject, ...extra };
}

export function exitCodeOf(findings) {
  return findings.reduce((max, f) => Math.max(max, f.level), 0);
}

// ── Inventory ────────────────────────────────────────────────────────────────

/** Every quoted string in `text` that equals one of `ids` (exact, case-sensitive). */
export function findModelIds(text, ids) {
  const found = new Set();
  for (const m of text.matchAll(/["'`]([A-Za-z0-9][A-Za-z0-9._:/-]{1,120})["'`]/g)) {
    if (ids.has(m[1])) found.add(m[1]);
  }
  return found;
}

/** Reads the runtime inventory: the command prints JSON (array of {model, usage?} or {models: [...]}). */
export function parseRuntime(stdout) {
  const data = JSON.parse(stdout);
  const list = Array.isArray(data) ? data : (data.models ?? data.usages ?? []);
  return list
    .map((e) => (typeof e === 'string' ? { model: e } : { model: e.model ?? e.modelId ?? e.id, usage: e.usage ?? e.name }))
    .filter((e) => e.model);
}

/**
 * Compares adapter, code seeds and runtime. `catalogIds` (optional) widens the
 * seed scan: a catalog model quoted in the seed files but not declared in the
 * adapter is a usage the adapter misses.
 */
export function compareInventory({ adapter, catalogIds = new Set(), runtime = null, seedTexts = [] }) {
  const findings = [];
  const declared = new Set(adapter.usages.map((u) => u.model));
  const known = new Set([...declared, ...catalogIds]);
  const inSeeds = new Set();
  for (const { file, text } of seedTexts) {
    for (const id of findModelIds(text, known)) inSeeds.add(id);
    if (!text) findings.push(finding(1, 'seed-file-missing', file, `seed file ${file} is missing or empty`));
  }
  if (seedTexts.length) {
    for (const u of adapter.usages) {
      if (!inSeeds.has(u.model)) {
        findings.push(finding(1, 'adapter-model-not-in-code', u.id, `usage ${u.id}: ${u.model} is declared in the adapter but appears in no seed file`, { model: u.model }));
      }
    }
    for (const id of inSeeds) {
      if (!declared.has(id)) {
        findings.push(finding(1, 'code-model-not-in-adapter', id, `${id} appears in the seed files but no usage in the adapter declares it`, { model: id }));
      }
    }
  }
  if (runtime) {
    const live = new Set(runtime.map((r) => r.model));
    for (const u of adapter.usages) {
      if (!live.has(u.model)) {
        findings.push(finding(1, 'runtime-drift', u.id, `usage ${u.id}: the running system does not use ${u.model} (it uses ${[...live].join(', ') || 'nothing'})`, { model: u.model }));
      }
    }
    for (const id of live) {
      if (!declared.has(id)) {
        findings.push(finding(1, 'runtime-model-not-in-adapter', id, `the running system uses ${id}, which no usage in the adapter declares`, { model: id }));
      }
    }
  }
  return { declared: [...declared], findings, inSeeds: [...inSeeds], runtime };
}

export function runInventory(adapter, root, { catalogIds, noRuntime } = {}) {
  const seedTexts = (adapter.inventory?.seed?.files ?? []).map((file) => {
    const path = resolve(root, file);
    return { file, text: existsSync(path) ? readFileSync(path, 'utf8') : '' };
  });
  let runtime = null;
  const findings = [];
  const cmd = adapter.inventory?.runtime?.command;
  if (cmd && !noRuntime) {
    try {
      runtime = parseRuntime(execSync(cmd, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 }));
    } catch (e) {
      findings.push(finding(1, 'runtime-unavailable', 'inventory', `runtime inventory failed: ${String(e.message).split('\n')[0]}`));
    }
  }
  const result = compareInventory({ adapter, catalogIds, runtime, seedTexts });
  result.findings.unshift(...findings);
  return result;
}

// ── HTTP ─────────────────────────────────────────────────────────────────────

async function http(url, { body, headers = {}, method = 'GET', timeoutMs = 60_000 } = {}) {
  const started = Date.now();
  const res = await fetch(url, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
    method,
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // keep text
  }
  return { json, ms: Date.now() - started, status: res.status, text };
}

function keyOf(provider) {
  const name = provider.keyEnv ?? (provider.kind === 'anthropic' ? 'ANTHROPIC_API_KEY' : undefined);
  return name ? process.env[name] : undefined;
}

function authHeaders(provider, key) {
  return provider.kind === 'anthropic'
    ? { 'anthropic-version': '2023-06-01', 'x-api-key': key }
    : { Authorization: `Bearer ${key}` };
}

// ── Catalog ──────────────────────────────────────────────────────────────────

/** Normalises a /models answer (OpenAI-compatible or Anthropic) to [{id, maxInput, maxOutput}]. */
export function parseCatalog(json) {
  const rows = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
  return rows
    .map((m) => ({
      id: m.id,
      maxInput: m.max_input_tokens ?? m.context_length ?? m.context_window ?? null,
      maxOutput: m.max_output_tokens ?? null,
    }))
    .filter((m) => m.id);
}

/**
 * Models in use that the key no longer sees (urgent), and unused catalog models
 * as candidates. For mittwald the candidates come from the provider's model
 * overview instead (compareLifecycle), which adds status and capabilities.
 */
export function compareCatalog(adapter, catalogs) {
  const findings = [];
  for (const u of adapter.usages) {
    const cat = catalogs[u.provider];
    if (!cat || cat.error) continue;
    if (!cat.models.some((m) => m.id === u.model)) {
      findings.push(finding(2, 'model-missing', u.id, `usage ${u.id}: ${u.model} is not in the ${u.provider} catalog for this key — calls fail now or are silently redirected`, { model: u.model, provider: u.provider }));
    }
  }
  for (const p of adapter.providers) {
    const cat = catalogs[p.id];
    if (!cat || cat.error || p.kind === 'mittwald') continue;
    const used = new Set(adapter.usages.filter((u) => u.provider === p.id).map((u) => u.model));
    for (const m of cat.models) {
      if (!used.has(m.id)) {
        findings.push(finding(0, 'candidate', m.id, `available, not used: ${m.id} (${p.id} catalog${m.maxInput ? `; ${m.maxInput} input tokens` : ''})`, { model: m.id, provider: p.id }));
      }
    }
  }
  return findings;
}

export async function fetchCatalog(provider) {
  const key = keyOf(provider);
  if (!key) return { error: `no key: set ${provider.keyEnv ?? 'ANTHROPIC_API_KEY'}`, models: [] };
  const base = provider.kind === 'anthropic' ? (provider.baseUrl ?? ANTHROPIC_BASE) : provider.baseUrl.replace(/\/$/, '');
  const models = [];
  let after = null;
  for (let page = 0; page < 20; page++) {
    const url = provider.kind === 'anthropic' ? `${base}/models?limit=1000${after ? `&after_id=${after}` : ''}` : `${base}/models`;
    const res = await http(url, { headers: authHeaders(provider, key) });
    if (res.status >= 400) return { error: `GET ${url} → HTTP ${res.status}`, models };
    models.push(...parseCatalog(res.json));
    if (provider.kind !== 'anthropic' || !res.json?.has_more) break;
    after = res.json.last_id;
  }
  return { models };
}

// ── Lifecycle (mittwald) ─────────────────────────────────────────────────────

function toIsoDate(s) {
  let m = String(s).match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = String(s).match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/** Capabilities from the overview's Type and Modalities columns. */
export function capabilitiesOf(type = '', modalities = '') {
  const t = `${type} ${modalities}`.toLowerCase();
  const caps = [];
  if (/\bchat\b/.test(t)) caps.push('chat');
  if (/vision|image(?! to text)/.test(t)) caps.push('vision');
  if (/reasoning/.test(t)) caps.push('reasoning');
  if (/tool-calling|tool calling/.test(t)) caps.push('tools');
  if (/embedding/.test(t)) caps.push('embeddings');
  if (/ocr/.test(t)) caps.push('ocr');
  if (/speech-to-text|audio to text/.test(t)) caps.push('audio-in');
  if (/text-to-speech|text to audio/.test(t)) caps.push('audio-out');
  if (/rerank/.test(t)) caps.push('rerank');
  return caps;
}

/**
 * Parses the model overview table of mittwald's developer portal
 * (docs/platform/aihosting/<n>-models/index.mdx). Columns are found by header
 * name, so a reordered or extended table still parses.
 */
export function parseMittwaldOverview(mdx) {
  const lines = mdx.split('\n').filter((l) => l.trim().startsWith('|'));
  if (lines.length < 2) return [];
  const cells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
  const header = cells(lines[0]).map((h) => h.toLowerCase());
  const col = (name) => header.findIndex((h) => h.includes(name));
  const iName = col('model');
  const iType = col('type');
  const iMod = col('modalit');
  const iCtx = col('context');
  const iStatus = col('status');
  if (iName < 0 || iStatus < 0) return [];
  return lines
    .slice(1)
    .filter((l) => !/^\|\s*:?-{3,}/.test(l.trim()))
    .map((l) => {
      const c = cells(l);
      const statusCell = c[iStatus] ?? '';
      const shutdown = /disabled|shut ?down|abgeschaltet|deprecated|end of life/i.test(statusCell) ? toIsoDate(statusCell) : null;
      const ctx = Number(String(c[iCtx] ?? '').replace(/[^\d]/g, ''));
      return {
        capabilities: capabilitiesOf(c[iType], c[iMod]),
        context: Number.isFinite(ctx) && ctx > 0 ? ctx : null,
        id: c[iName].replace(/`/g, ''),
        shutdown,
        status: statusCell.split(',')[0].trim(),
        statusText: statusCell,
      };
    })
    .filter((m) => m.id);
}

export function daysUntil(isoDate, today = new Date()) {
  const t = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const [y, m, d] = isoDate.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - t) / 86_400_000);
}

const NEED_TO_CAP = { embeddings: 'embeddings', tools: 'tools', vision: 'vision' };

export function compareLifecycle(adapter, docs, { today = new Date(), urgentDays = 90 } = {}) {
  const findings = [];
  const byId = new Map(docs.map((d) => [d.id, d]));
  for (const u of adapter.usages) {
    const provider = adapter.providers.find((p) => p.id === u.provider);
    if (provider?.kind !== 'mittwald') continue;
    const doc = byId.get(u.model);
    if (!doc) {
      findings.push(finding(1, 'model-undocumented', u.id, `usage ${u.id}: ${u.model} is not in the provider's model overview (renamed or withdrawn?)`, { model: u.model }));
      continue;
    }
    if (doc.shutdown) {
      const days = daysUntil(doc.shutdown, today);
      const level = days <= urgentDays ? 2 : 1;
      findings.push(finding(level, 'shutdown-announced', u.id, `usage ${u.id}: ${u.model} will be disabled on ${doc.shutdown} (${days} days)${days <= 0 ? ' — already past; the provider may redirect the ID to a "comparable" model, a silent behaviour change' : ''}`, { days, model: u.model, shutdown: doc.shutdown }));
    } else if (/test/i.test(doc.status)) {
      findings.push(finding(1, 'test-phase', u.id, `usage ${u.id}: ${u.model} is in the provider's test phase — no shutdown notice is guaranteed`, { model: u.model }));
    }
    for (const need of u.needs ?? []) {
      const cap = NEED_TO_CAP[need];
      if (cap && doc.capabilities.length && !doc.capabilities.includes(cap)) {
        findings.push(finding(2, 'capability-missing', u.id, `usage ${u.id} needs ${need}, which the provider does not list for ${u.model}`, { model: u.model }));
      }
    }
  }
  const used = new Set(adapter.usages.map((u) => u.model));
  for (const d of docs) {
    if (!used.has(d.id) && !d.shutdown) {
      findings.push(finding(0, 'candidate', d.id, `available, not used: ${d.id} (${d.statusText}; ${d.capabilities.join(', ') || 'no capabilities listed'})`, { model: d.id }));
    }
  }
  return findings;
}

async function github(path) {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'lt-dev-ai-models' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return http(`https://api.github.com${path}`, { headers });
}

export async function fetchMittwaldDocs({ since } = {}) {
  let dir = MITTWALD_MODELS_DIR;
  let res = await http(`https://raw.githubusercontent.com/${MITTWALD_REPO}/${MITTWALD_BRANCH}/${dir}/index.mdx`);
  if (res.status === 404) {
    // The numeric prefix of the folder may change; find it again.
    const listing = await github(`/repos/${MITTWALD_REPO}/contents/docs/platform/aihosting?ref=${MITTWALD_BRANCH}`);
    const found = (listing.json ?? []).find((e) => e.type === 'dir' && /-models$/.test(e.name));
    if (!found) return { error: 'mittwald model overview not found in the developer portal', models: [] };
    dir = found.path;
    res = await http(`https://raw.githubusercontent.com/${MITTWALD_REPO}/${MITTWALD_BRANCH}/${dir}/index.mdx`);
  }
  if (res.status >= 400) return { error: `mittwald overview → HTTP ${res.status}`, models: [] };
  const models = parseMittwaldOverview(res.text);
  if (!models.length) return { error: 'mittwald overview table could not be parsed', models };
  let changes = [];
  if (since) {
    const c = await github(`/repos/${MITTWALD_REPO}/commits?path=${encodeURIComponent(dir)}&since=${encodeURIComponent(`${since}T00:00:00Z`)}&per_page=50`);
    if (Array.isArray(c.json)) {
      changes = c.json.map((e) => ({ date: e.commit?.author?.date?.slice(0, 10), message: e.commit?.message?.split('\n')[0], sha: e.sha?.slice(0, 8) }));
    }
  }
  return { changes, models, source: `https://github.com/${MITTWALD_REPO}/blob/${MITTWALD_BRANCH}/${dir}/index.mdx` };
}

// ── Probes ───────────────────────────────────────────────────────────────────

/** A minimal PNG: left half red, right half blue. Built in-process, no files. */
export function twoColourPng(width = 64, height = 32) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, sum]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  const rows = [];
  for (let y = 0; y < height; y++) {
    const row = [0];
    for (let x = 0; x < width; x++) row.push(...(x < width / 2 ? [220, 20, 20] : [20, 20, 220]));
    rows.push(Buffer.from(row));
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function reasoningOf(message, usage) {
  const tokens = usage?.completion_tokens_details?.reasoning_tokens ?? null;
  const text = message?.reasoning_content ?? message?.reasoning ?? '';
  return { chars: text.length, tokens };
}

/**
 * Builds the chat request a probe sends. `params` are the usage's own call
 * parameters, so the probe asks the way the application asks (temperature,
 * reasoning effort); without them it sends temperature 0.
 */
export function chatBody(model, content, { extra = {}, maxTokens = 256, params = {} } = {}) {
  const body = { max_tokens: maxTokens, messages: [{ content, role: 'user' }], model, temperature: params.temperature ?? 0, ...extra };
  if (params.reasoningEffort && !('reasoning_effort' in extra)) body.reasoning_effort = params.reasoningEffort;
  return body;
}

/** The image limit of a usage: `params.maxImages`, or `max-images:<n>` in `needs`. */
export function maxImagesOf(usage) {
  if (usage.params?.maxImages) return Number(usage.params.maxImages);
  const tag = (usage.needs ?? []).find((n) => /^max-images:\d+$/.test(n));
  return tag ? Number(tag.split(':')[1]) : null;
}

/** Judges the two calls of the cache probe: same usage, far faster second call. */
export function looksCached(first, second) {
  if (!first || !second || first.status >= 400 || second.status >= 400) return false;
  const u1 = JSON.stringify(first.json?.usage ?? {});
  const u2 = JSON.stringify(second.json?.usage ?? {});
  return u1 === u2 && second.ms < first.ms * 0.3;
}

const PROBES = {
  async basic(ctx) {
    const r = await ctx.chat(chatBody(ctx.usage.model, 'Reply with the single word OK.', { maxTokens: 64, params: ctx.usage.params }));
    const c = r.json?.choices?.[0];
    const content = c?.message?.content;
    return {
      answeredBy: r.json?.model ?? null,
      empty: !content,
      ms: r.ms,
      ok: r.status < 400 && !!c,
      status: r.status,
      text: String(content ?? (c ? '' : r.text)).slice(0, 80),
    };
  },
  async vision(ctx) {
    const img = `data:image/png;base64,${twoColourPng().toString('base64')}`;
    const r = await ctx.chat(chatBody(ctx.usage.model, [
      { text: 'The image has two halves. What colour is the LEFT half? Answer with one English word.', type: 'text' },
      { image_url: { url: img }, type: 'image_url' },
    ], { maxTokens: 512, params: ctx.usage.params }));
    const answer = r.json?.choices?.[0]?.message?.content ?? '';
    return { answer: answer.slice(0, 40), ms: r.ms, ok: /\bred\b|\brot\b/i.test(answer), status: r.status };
  },
  async 'reasoning-off'(ctx) {
    const effort = ctx.usage.params?.reasoningEffort ?? 'none';
    const prompt = 'What is 17 + 25? Answer with the number only.';
    // Same budget for both calls, otherwise the comparison measures the budget, not the setting.
    // The trailing space keeps the second call out of a gateway cache.
    const on = await ctx.chat(chatBody(ctx.usage.model, prompt, { maxTokens: 2048 }));
    const off = await ctx.chat(chatBody(ctx.usage.model, `${prompt} `, { extra: { reasoning_effort: effort }, maxTokens: 2048 }));
    const rOn = reasoningOf(on.json?.choices?.[0]?.message, on.json?.usage);
    const rOff = reasoningOf(off.json?.choices?.[0]?.message, off.json?.usage);
    const offAmount = rOff.tokens ?? rOff.chars;
    return { default: { ...rOn, ms: on.ms }, effort, ok: off.status < 400 && offAmount === 0, setting: { ...rOff, ms: off.ms }, status: off.status };
  },
  async budget(ctx) {
    const r = await ctx.chat(chatBody(ctx.usage.model, 'Count from 1 to 60, separated by commas.', { maxTokens: 64, params: ctx.usage.params }));
    const c = r.json?.choices?.[0];
    const empty = !(c?.message?.content ?? '').trim();
    return { emptyOnLength: c?.finish_reason === 'length' && empty, finish: c?.finish_reason, ok: !(c?.finish_reason === 'length' && empty), status: r.status };
  },
  async cache(ctx) {
    const body = chatBody(ctx.usage.model, 'Name three primary colours, comma separated.', { maxTokens: 512, params: ctx.usage.params });
    const a = await ctx.chat(body);
    const b = await ctx.chat(body);
    return { cached: looksCached(a, b), first: a.ms, ok: true, second: b.ms };
  },
  async json(ctx) {
    const r = await ctx.chat(chatBody(ctx.usage.model, 'Return a JSON object with the key "ok" set to true.', { extra: { response_format: { type: 'json_object' } }, maxTokens: 512, params: ctx.usage.params }));
    let parsed = null;
    try {
      parsed = JSON.parse(r.json?.choices?.[0]?.message?.content ?? '');
    } catch {
      // not JSON
    }
    return { ok: r.status < 400 && parsed?.ok === true, status: r.status };
  },
  async tools(ctx) {
    const r = await ctx.chat(chatBody(ctx.usage.model, 'What is the weather in Berlin? Use the tool.', {
      extra: { tool_choice: 'auto', tools: [{ function: { description: 'Weather for a city', name: 'get_weather', parameters: { properties: { city: { type: 'string' } }, required: ['city'], type: 'object' } }, type: 'function' }] },
      maxTokens: 512,
      params: ctx.usage.params,
    }));
    const m = r.json?.choices?.[0]?.message;
    const native = Array.isArray(m?.tool_calls) && m.tool_calls.length > 0;
    return { asText: !native && /get_weather/.test(m?.content ?? ''), native, ok: native, status: r.status };
  },
  async 'image-limit'(ctx) {
    const max = maxImagesOf(ctx.usage);
    if (!max) return { ok: true, skipped: 'no image limit declared' };
    const img = { image_url: { url: `data:image/png;base64,${twoColourPng(8, 8).toString('base64')}` }, type: 'image_url' };
    const atLimit = await ctx.chat(chatBody(ctx.usage.model, [{ text: 'Reply OK.', type: 'text' }, ...Array(max).fill(img)], { maxTokens: 512, params: ctx.usage.params }));
    const over = await ctx.chat(chatBody(ctx.usage.model, [{ text: 'Reply OK.', type: 'text' }, ...Array(max + 1).fill(img)], { maxTokens: 512, params: ctx.usage.params }));
    return { atLimit: atLimit.status, ok: atLimit.status < 400 && over.status >= 400, over: over.status };
  },
  async embeddings(ctx) {
    const r = await ctx.post('/embeddings', { input: 'probe', model: ctx.usage.model });
    const dims = r.json?.data?.[0]?.embedding?.length ?? null;
    const want = ctx.usage.params?.dims;
    return { dims, ok: r.status < 400 && (!want || dims === want), status: r.status };
  },
};

/** The probes a usage gets: always basic and cache; the rest from `needs`. */
export function probesFor(usage) {
  if (usage.role === 'embeddings' || (usage.needs ?? []).includes('embeddings')) return ['embeddings'];
  const set = ['basic', 'cache'];
  for (const need of usage.needs ?? []) {
    if (PROBES[need] && !set.includes(need)) set.push(need);
  }
  if (usage.params?.reasoningEffort && !set.includes('reasoning-off')) set.push('reasoning-off');
  if (usage.params?.maxTokens && !set.includes('budget')) set.push('budget');
  if (maxImagesOf(usage) && !set.includes('image-limit')) set.push('image-limit');
  return set;
}

/**
 * Did another model answer? Providers may route a withdrawn ID to a "comparable"
 * model and still answer 200. The same model may come back with a provider
 * prefix (`openai/…`), in another case, or as the dated snapshot an alias
 * resolves to (`gpt-4o-mini` → `gpt-4o-mini-2024-07-18`, `gpt-4` → `gpt-4-0613`);
 * anything else is a redirect.
 */
export function isRedirect(requested, answeredBy) {
  if (!answeredBy) return false;
  const a = String(answeredBy).toLowerCase();
  const r = String(requested).toLowerCase();
  if (a === r || a.endsWith(`/${r}`)) return false;
  const i = a.lastIndexOf(`${r}-`);
  const snapshot = i > -1 && (i === 0 || a[i - 1] === '/') && /^(\d{4}|\d{8}|\d{4}-\d{2}-\d{2})$/.test(a.slice(i + r.length + 1));
  return !snapshot;
}

export function judgeProbes(usage, results) {
  const findings = [];
  if (isRedirect(usage.model, results.basic?.answeredBy)) {
    findings.push(finding(2, 'model-redirected', usage.id, `usage ${usage.id}: requests for ${usage.model} are answered by ${results.basic.answeredBy} — the provider redirects the ID, a silent behaviour change`, { answeredBy: results.basic.answeredBy, model: usage.model }));
  }
  // A one-word answer at 64 tokens, sent with the usage's own parameters, must not come back
  // empty: either reasoning eats the budget or the model is no longer served properly.
  if (results.basic?.ok && results.basic.empty) {
    findings.push(finding(1, 'empty-answer', usage.id, `usage ${usage.id}: ${usage.model} answered a one-word request with no text (HTTP ${results.basic.status}) — reasoning may consume the budget, or the model is no longer served properly`, { model: usage.model }));
  }
  for (const [name, r] of Object.entries(results)) {
    if (r.error) {
      findings.push(finding(1, 'probe-error', usage.id, `usage ${usage.id}: probe ${name} failed: ${r.error}`, { model: usage.model }));
    } else if (name === 'cache' && r.cached) {
      findings.push(finding(0, 'gateway-cache', usage.id, `usage ${usage.id}: identical requests are answered from a cache (${r.first} ms → ${r.second} ms); time only first calls`, { model: usage.model }));
    } else if (name === 'budget' && r.emptyOnLength) {
      findings.push(finding(1, 'budget-eaten-by-reasoning', usage.id, `usage ${usage.id}: at a small max_tokens the answer comes back EMPTY (reasoning consumed the budget) — check the usage's maxTokens against reasoning plus answer`, { model: usage.model }));
    } else if (!r.ok && !r.skipped) {
      const urgent = ['basic', 'embeddings', 'vision'].includes(name);
      findings.push(finding(urgent ? 2 : 1, `probe-${name}-failed`, usage.id, `usage ${usage.id}: probe ${name} failed (${JSON.stringify(r).slice(0, 160)})`, { model: usage.model }));
    }
  }
  return findings;
}

/** A gateway cache is a property of the provider, not of a usage: one line per provider. */
export function collapseCacheFindings(adapter, findings) {
  const providerOf = new Map(adapter.usages.map((u) => [u.id, u.provider]));
  const cache = new Map();
  const rest = [];
  for (const f of findings) {
    if (f.code !== 'gateway-cache') {
      rest.push(f);
      continue;
    }
    const p = providerOf.get(f.subject) ?? f.subject;
    if (!cache.has(p)) cache.set(p, { example: f.message.match(/\((\d+ ms → \d+ ms)\)/)?.[1], usages: [] });
    cache.get(p).usages.push(f.subject);
  }
  for (const [p, c] of cache) {
    rest.push(finding(0, 'gateway-cache', p, `${p} answers identical requests from a cache (${c.example ?? 'second call far faster'}; usages ${c.usages.join(', ')}); time only first calls`));
  }
  return rest;
}

export async function runProbes(adapter, { only } = {}) {
  const out = [];
  const reportedNoKey = new Set();
  for (const usage of adapter.usages) {
    if (only && !only.includes(usage.id)) continue;
    const provider = adapter.providers.find((p) => p.id === usage.provider);
    const key = keyOf(provider);
    if (provider.kind === 'anthropic') {
      out.push({ findings: [], results: { skipped: 'probes cover OpenAI-compatible endpoints' }, usage: usage.id });
      continue;
    }
    if (!key) {
      // One finding per provider: the cause is the same for every usage behind it.
      const findings = reportedNoKey.has(provider.id) ? [] : [finding(3, 'no-key', provider.id, `probes of ${provider.id} not run: no key in ${provider.keyEnv}`)];
      reportedNoKey.add(provider.id);
      out.push({ findings, results: { skipped: 'no key' }, usage: usage.id });
      continue;
    }
    const base = provider.baseUrl.replace(/\/$/, '');
    const post = (path, body) => http(`${base}${path}`, { body, headers: authHeaders(provider, key), method: 'POST', timeoutMs: 180_000 });
    const ctx = { chat: (body) => post('/chat/completions', body), post, usage };
    const results = {};
    for (const name of probesFor(usage)) {
      try {
        results[name] = await PROBES[name](ctx);
      } catch (e) {
        results[name] = { error: e.message };
      }
    }
    out.push({ findings: judgeProbes(usage, results), results, usage: usage.id });
  }
  return out;
}

// ── Benchmark summary (value-based scoring helpers) ──────────────────────────

/** "1.000" = 1000, "5,52" = 5.52, "1,234.50" = 1234.5; null when not a number. */
export function parseNumber(v) {
  let t = String(v ?? '').replace(/\s|€|EUR|\$/gi, '');
  if (!/^-?[\d.,]+$/.test(t) || !/\d/.test(t)) return null;
  const lc = t.lastIndexOf(',');
  const ld = t.lastIndexOf('.');
  if (lc >= 0 && ld >= 0) t = lc > ld ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  else if (lc >= 0) t = /^-?\d{1,3}(,\d{3})+$/.test(t) ? t.replace(/,/g, '') : t.replace(',', '.');
  else if (ld >= 0 && /^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** "03.09.2026", "3.9.26" and "2026-09-03" → "2026-09-03"; null otherwise. */
export function parseDate(v) {
  const s = String(v ?? '').trim();
  let m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/);
  if (m) return `${m[3].length === 2 ? `20${m[3]}` : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/** Same value in a different spelling? Dates and numbers compare by value; anything else exactly after trim. */
export function valueEqual(a, b) {
  const da = parseDate(a);
  const db = parseDate(b);
  if (da && db) return da === db;
  const na = parseNumber(a);
  const nb = parseNumber(b);
  if (na !== null && nb !== null) return Math.abs(na - nb) < 1e-9;
  return String(a ?? '').trim() === String(b ?? '').trim();
}

/** Masks a value for reports: digits → 9, letters → a. Keeps the shape, drops the content. */
export function mask(v, max = 40) {
  return String(v ?? '').replace(/\d/g, '9').replace(/\p{L}/gu, 'a').slice(0, max);
}

export function percentile(values, p) {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const idx = Math.min(v.length - 1, Math.max(0, Math.ceil((p / 100) * v.length) - 1));
  return v[idx];
}

const mean = (xs) => {
  const v = xs.filter((x) => Number.isFinite(x));
  return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
};

const get = (row, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), row);

/**
 * Summarises benchmark rows per group (default: config). Latency counts only
 * rows not marked `cached`; a cached answer measures the gateway, not the model.
 * `otherModel` counts rows whose `modelUsed` differs from the configured
 * `model`, and `paths` lists the routes the results actually took: a quality
 * gate that silently falls back to another route or model would otherwise be
 * scored as the configured one.
 *
 * `usages` (from the adapter) carries each usage's `latency` class and
 * `latencyBudgetMs`. Groups are ranked per usage: goal first; for an
 * `interactive` usage, configurations within the latency budget (P90) come
 * before those over it; then quality; then median latency.
 */
export function summarize(rows, groupKeys = ['config'], { usages = {} } = {}) {
  const groups = new Map();
  for (const r of rows) {
    const key = groupKeys.map((k) => String(get(r, k) ?? '-')).join(' · ');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  return [...groups.entries()]
    .map(([group, rs]) => {
      const ok = rs.filter((r) => !r.error);
      const timed = ok.filter((r) => !r.cached).map((r) => r.ms);
      const goals = ok.filter((r) => typeof r.goal === 'boolean');
      const usageIds = [...new Set(rs.map((r) => r.usage).filter(Boolean))];
      const usage = usageIds.length === 1 ? usageIds[0] : null;
      const latency = usage ? (usages[usage]?.latency ?? null) : null;
      const budgetMs = usage ? (usages[usage]?.latencyBudgetMs ?? null) : null;
      const p90Ms = percentile(timed, 90);
      return {
        accuracy: mean(ok.map((r) => r.accuracy)),
        budgetMs,
        cachedExcluded: ok.filter((r) => r.cached).length,
        errors: rs.length - ok.length,
        goal: goals.length ? Math.round((goals.filter((r) => r.goal).length / goals.length) * 100) : null,
        group,
        latency,
        lenient: mean(ok.map((r) => r.lenient ?? r.accuracy)),
        medianMs: percentile(timed, 50),
        n: rs.length,
        otherModel: ok.filter((r) => r.modelUsed && r.model && r.modelUsed !== r.model).length,
        overBudget: budgetMs && p90Ms !== null ? p90Ms > budgetMs : null,
        p90Ms,
        paths: [...new Set(ok.map((r) => r.path ?? r.stage).filter(Boolean))],
        tokens: percentile(ok.map((r) => r.tokens), 50),
        usage,
      };
    })
    .sort(
      (a, b) =>
        String(a.usage ?? '').localeCompare(String(b.usage ?? '')) ||
        (b.goal ?? -1) - (a.goal ?? -1) ||
        (a.latency === 'interactive' ? (a.overBudget ? 1 : 0) - (b.overBudget ? 1 : 0) : 0) ||
        (b.lenient ?? -1) - (a.lenient ?? -1) ||
        (a.medianMs ?? Infinity) - (b.medianMs ?? Infinity),
    );
}

export function summaryMarkdown(summary) {
  const fmt = (v, unit = '') => (v === null || v === undefined ? '–' : `${v}${unit}`);
  const s = (ms) => (ms === null ? '–' : (ms / 1000).toFixed(1));
  const latencyCell = (g) => {
    if (!g.latency) return '–';
    if (!g.budgetMs) return g.latency;
    return `${g.latency}, ${g.overBudget ? 'OVER' : 'within'} ${s(g.budgetMs)} s`;
  };
  const lines = ['| Group | n | errors | goal % | accuracy % | lenient % | median s | P90 s | latency | tokens | cached | other model | paths |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|'];
  for (const g of summary) {
    lines.push(`| ${g.group} | ${g.n} | ${g.errors} | ${fmt(g.goal)} | ${fmt(g.accuracy)} | ${fmt(g.lenient)} | ${s(g.medianMs)} | ${s(g.p90Ms)} | ${latencyCell(g)} | ${fmt(g.tokens)} | ${g.cachedExcluded} | ${g.otherModel} | ${g.paths.join(', ') || '–'} |`);
  }
  const suspect = summary.filter((g) => g.otherModel > 0 || g.paths.length > 1);
  if (suspect.length) {
    lines.push('', `Check before comparing: ${suspect.map((g) => g.group).join('; ')} — results came from another model or more than one route.`);
  }
  const slow = summary.filter((g) => g.latency === 'interactive' && g.overBudget);
  if (slow.length) {
    lines.push('', `Over the latency budget of an interactive usage: ${slow.map((g) => g.group).join('; ')} — a person waits for these answers; a quality lead does not settle it on its own.`);
  }
  return lines.join('\n');
}

// ── Report ───────────────────────────────────────────────────────────────────

export function reportMarkdown(report) {
  const icon = { 0: 'info', 1: 'ACTION', 2: 'URGENT', 3: 'ERROR' };
  const lines = [`# AI model check: ${report.project}`, '', `Date: ${report.date} · Result: ${LEVEL_NAMES[report.exitCode]} (exit ${report.exitCode})`, ''];
  const real = report.findings.filter((f) => f.level > 0).sort((a, b) => b.level - a.level);
  const info = report.findings.filter((f) => f.level === 0);
  lines.push('## Findings', '');
  if (!real.length) lines.push('Nothing to do.');
  for (const f of real) lines.push(`- **${icon[f.level]}** ${f.message}`);
  if (info.length) {
    lines.push('', '## Information', '');
    for (const f of info) lines.push(`- ${f.message}`);
  }
  if (report.lifecycle?.changes?.length) {
    lines.push('', `## Provider documentation changes since ${report.since}`, '');
    for (const c of report.lifecycle.changes) lines.push(`- ${c.date} ${c.sha} ${c.message}`);
  }
  lines.push('', '## Usages', '', '| Usage | Path | Latency | Provider | Model | Needs |', '|---|---|---|---|---|---|');
  for (const u of report.usages) {
    const latency = u.latency ? `${u.latency}${u.latencyBudgetMs ? ` (P90 ≤ ${(u.latencyBudgetMs / 1000).toFixed(1)} s)` : ''}` : '–';
    lines.push(`| ${u.id} | ${u.path ?? '–'} | ${latency} | ${u.provider} | ${u.model} | ${(u.needs ?? []).join(', ') || '–'} |`);
  }
  if (report.lifecycle?.source) lines.push('', `Lifecycle source: ${report.lifecycle.source}`);
  lines.push('', 'Quality is not measured here. When a model has to change, run `/lt-dev:backend:ai-model-review` for the measurement over the project pipeline.');
  return lines.join('\n');
}

/** Stable across runs with the same findings, so a scheduled run does not file the same ticket twice. */
export function fingerprintOf(report) {
  const keys = report.findings
    .filter((f) => f.level > 0)
    .map((f) => `${f.code}|${f.subject}|${f.model ?? ''}|${f.shutdown ?? ''}`)
    .sort();
  return createHash('sha256').update(`${report.project}\n${keys.join('\n')}`).digest('hex').slice(0, 16);
}

export async function runCheck(adapter, root, opts = {}) {
  const findings = [];
  const catalogs = {};
  if (!opts.offline) {
    for (const p of adapter.providers) {
      try {
        catalogs[p.id] = await fetchCatalog(p);
      } catch (e) {
        catalogs[p.id] = { error: e.message, models: [] };
      }
      if (catalogs[p.id].error) findings.push(finding(3, 'catalog-unavailable', p.id, `catalog of ${p.id} not checked: ${catalogs[p.id].error}`));
    }
    findings.push(...compareCatalog(adapter, catalogs));
  }
  const catalogIds = new Set(Object.values(catalogs).flatMap((c) => c.models.map((m) => m.id)));
  const inventory = runInventory(adapter, root, { catalogIds, noRuntime: opts.noRuntime });
  findings.push(...inventory.findings);

  let lifecycle = null;
  if (!opts.offline && adapter.providers.some((p) => p.kind === 'mittwald')) {
    try {
      lifecycle = await fetchMittwaldDocs({ since: opts.since });
    } catch (e) {
      lifecycle = { error: e.message, models: [] };
    }
    if (lifecycle.error) findings.push(finding(3, 'lifecycle-unavailable', 'mittwald', `lifecycle not checked: ${lifecycle.error}`));
    else findings.push(...compareLifecycle(adapter, lifecycle.models, { urgentDays: opts.urgentDays }));
  }

  let probes = null;
  if (opts.probe && !opts.offline) {
    probes = await runProbes(adapter, { only: opts.usage });
    findings.push(...collapseCacheFindings(adapter, probes.flatMap((p) => p.findings)));
  }

  const report = {
    date: new Date().toISOString().slice(0, 10),
    exitCode: exitCodeOf(findings),
    findings,
    inventory: { declared: inventory.declared, inSeeds: inventory.inSeeds, runtime: inventory.runtime },
    lifecycle: lifecycle && { changes: lifecycle.changes, source: lifecycle.source },
    probes,
    project: adapter.project ?? process.env.CI_PROJECT_PATH ?? basename(resolve(root)),
    since: opts.since ?? null,
    usages: adapter.usages.map(({ id, latency, latencyBudgetMs, model, needs, path, provider }) => ({ id, latency, latencyBudgetMs, model, needs, path, provider })),
  };
  report.fingerprint = fingerprintOf(report);
  return report;
}

// ── Linear ticket ────────────────────────────────────────────────────────────

const AI_LABELS = ['KI-Vorschlag', 'KI-Idee', 'KI', 'AI-Suggestion', 'AI Suggestion', 'ai-suggested', 'AI', 'Claude'];

export function ticketContent(report) {
  const real = report.findings.filter((f) => f.level > 0).sort((a, b) => b.level - a.level);
  const urgent = real.some((f) => f.level >= 2);
  const title = `${urgent ? 'Dringend: ' : ''}KI-Modelle in ${report.project} prüfen (${real.length} Befund${real.length === 1 ? '' : 'e'})`;
  const description = [
    '> Vorschlag aus dem geplanten KI-Modell-Check (lt-dev `ai-models.mjs`), nicht beauftragt. Bitte in Triage fachlich prüfen.',
    '',
    '## Befunde',
    '',
    ...real.map((f) => `- ${f.level >= 2 ? '**dringend** ' : ''}${f.message}`),
    '',
    '## Nächster Schritt',
    '',
    'Bei einem nötigen Modellwechsel misst `/lt-dev:backend:ai-model-review` die Kandidaten über die Pipeline des Projekts. Der Wechsel selbst läuft danach als normales Ticket mit Freigabe.',
    '',
    `<!-- ai-models-fingerprint: ${report.fingerprint} -->`,
  ].join('\n');
  return { description, title };
}

async function linear(query, variables) {
  const key = process.env.LINEAR_API_KEY;
  if (!key) throw new Error('LINEAR_API_KEY is not set');
  const r = await http('https://api.linear.app/graphql', { body: { query, variables }, headers: { Authorization: key }, method: 'POST' });
  if (r.status >= 400 || r.json?.errors) throw new Error(`Linear: ${JSON.stringify(r.json?.errors ?? r.text).slice(0, 300)}`);
  return r.json.data;
}

/**
 * Which earlier ticket with the same fingerprint stops a new one: any that is
 * still open, and any a human declined (canceled) — the same facts would only
 * be filed again every week. Only a completed ticket lets them through again:
 * the fix did not remove the finding.
 */
export function blockingDuplicate(issues) {
  return issues.find((i) => i.state?.type !== 'completed') ?? null;
}

export async function fileTicket(report, { dryRun, team }) {
  const { description, title } = ticketContent(report);
  if (dryRun) return { dryRun: true, payload: { description, team, title } };
  const t = await linear(
    'query($key:String!){teams(filter:{key:{eq:$key}}){nodes{id states{nodes{id type name}} labels(first:250){nodes{id name}}}}}',
    { key: team },
  );
  const teamNode = t.teams.nodes[0];
  if (!teamNode) throw new Error(`Linear team ${team} not found`);
  const dup = await linear(
    'query($team:String!,$fp:String!){issues(filter:{team:{key:{eq:$team}},description:{contains:$fp}}){nodes{identifier url state{type name}}}}',
    { fp: report.fingerprint, team },
  );
  const blocking = blockingDuplicate(dup.issues.nodes);
  if (blocking) return { duplicate: { identifier: blocking.identifier, state: blocking.state?.name, url: blocking.url } };
  const states = teamNode.states.nodes;
  const state = states.find((s) => s.type === 'triage') ?? states.find((s) => s.type === 'unstarted');
  const labels = teamNode.labels.nodes;
  let label = AI_LABELS.map((n) => labels.find((l) => l.name.toLowerCase() === n.toLowerCase())).find(Boolean);
  if (!label) {
    const made = await linear(
      'mutation($input:IssueLabelCreateInput!){issueLabelCreate(input:$input){issueLabel{id name}}}',
      { input: { color: '#8B5CF6', description: 'Von Claude Code automatisch vorgeschlagenes Ticket — vor der Umsetzung fachlich prüfen', name: 'KI-Vorschlag', teamId: teamNode.id } },
    );
    label = made.issueLabelCreate.issueLabel;
  }
  const created = await linear(
    'mutation($input:IssueCreateInput!){issueCreate(input:$input){issue{identifier url}}}',
    { input: { description, labelIds: [label.id], stateId: state?.id, teamId: teamNode.id, title } },
  );
  return { created: created.issueCreate.issue, label: label.name, state: state?.name ?? null };
}

// ── CLI ──────────────────────────────────────────────────────────────────────

const HELP = `Usage: node ai-models.mjs <command> [options]

Commands:
  check       inventory + catalog + lifecycle (+ --probe) → report (Markdown + JSON)
  inventory   adapter vs code seeds vs runtime
  catalog     models in use vs the provider catalog
  lifecycle   announced shutdowns and status (mittwald)
  probe       capability probes for each usage (costs a few tokens)
  summarize   <results.jsonl> [--group config,tags.source]  benchmark summary, ranked per usage
              by the adapter's latency class (interactive: latency budget counts; background: quality)
  ticket      --report <report.json> --team <KEY> [--dry-run]  file one Linear ticket

Options:
  --adapter <path>     default .ai-models.json under --root
  --root <dir>         project root (default: cwd)
  --since <YYYY-MM-DD> list provider documentation changes since this date
  --since-days <n>     the same, relative: changes of the last n days
  --urgent-days <n>    a shutdown within n days is urgent (default 90)
  --usage <a,b>        restrict probes to these usages
  --no-runtime         skip the runtime inventory command
  --offline            check: adapter and code only, no network
  --probe              check: also run the capability probes
  --out <dir>          write report.md and report.json there (check)
  --json               print JSON instead of Markdown

Exit: 0 nothing to do · 1 action needed · 2 urgent · 3 error`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0];
  if (!cmd || args.help) {
    console.log(HELP);
    return cmd ? EXIT.OK : EXIT.ERROR;
  }
  const root = resolve(args.root ?? process.cwd());

  if (cmd === 'summarize') {
    const file = args._[1];
    if (!file || !existsSync(file)) throw new Error('summarize needs a results JSONL file');
    const rows = readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
    // The adapter's latency classes decide how speed is weighed; without one the ranking is quality first.
    const adapterPath = resolve(root, args.adapter ?? '.ai-models.json');
    const usages = existsSync(adapterPath)
      ? Object.fromEntries(loadAdapter(adapterPath).usages.map((u) => [u.id, { latency: u.latency, latencyBudgetMs: u.latencyBudgetMs }]))
      : {};
    const summary = summarize(rows, String(args.group ?? 'config').split(','), { usages });
    console.log(args.json ? JSON.stringify(summary, null, 2) : summaryMarkdown(summary));
    return EXIT.OK;
  }
  if (cmd === 'ticket') {
    if (!args.report || !args.team) throw new Error('ticket needs --report <report.json> and --team <KEY>');
    const report = JSON.parse(readFileSync(args.report, 'utf8'));
    if (report.exitCode === 0) {
      console.log('nothing to file');
      return EXIT.OK;
    }
    console.log(JSON.stringify(await fileTicket(report, { dryRun: !!args['dry-run'], team: args.team }), null, 2));
    return EXIT.OK;
  }

  const adapter = loadAdapter(resolve(root, args.adapter ?? '.ai-models.json'));
  const urgentDays = Number(args['urgent-days'] ?? 90);
  if (args['since-days'] && !args.since) {
    args.since = new Date(Date.now() - Number(args['since-days']) * 86_400_000).toISOString().slice(0, 10);
  }
  const usage = args.usage ? String(args.usage).split(',') : undefined;

  if (cmd === 'inventory') {
    const inv = runInventory(adapter, root, { noRuntime: !!args['no-runtime'] });
    console.log(JSON.stringify(inv, null, 2));
    return exitCodeOf(inv.findings);
  }
  if (cmd === 'catalog') {
    const catalogs = {};
    for (const p of adapter.providers) catalogs[p.id] = await fetchCatalog(p);
    const findings = [
      ...Object.entries(catalogs).filter(([, c]) => c.error).map(([id, c]) => finding(3, 'catalog-unavailable', id, c.error)),
      ...compareCatalog(adapter, catalogs),
    ];
    console.log(JSON.stringify({ catalogs, findings }, null, 2));
    return exitCodeOf(findings);
  }
  if (cmd === 'lifecycle') {
    const docs = await fetchMittwaldDocs({ since: args.since });
    const findings = docs.error ? [finding(3, 'lifecycle-unavailable', 'mittwald', docs.error)] : compareLifecycle(adapter, docs.models, { urgentDays });
    console.log(JSON.stringify({ changes: docs.changes, findings, models: docs.models, source: docs.source }, null, 2));
    return exitCodeOf(findings);
  }
  if (cmd === 'probe') {
    const probes = await runProbes(adapter, { only: usage });
    console.log(JSON.stringify(probes, null, 2));
    return exitCodeOf(probes.flatMap((p) => p.findings));
  }
  if (cmd === 'check') {
    const report = await runCheck(adapter, root, { noRuntime: !!args['no-runtime'], offline: !!args.offline, probe: !!args.probe, since: args.since, urgentDays, usage });
    const md = reportMarkdown(report);
    if (args.out) {
      mkdirSync(args.out, { recursive: true });
      writeFileSync(join(args.out, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
      writeFileSync(join(args.out, 'report.md'), `${md}\n`);
    }
    console.log(args.json ? JSON.stringify(report, null, 2) : md);
    return report.exitCode;
  }
  throw new Error(`unknown command: ${cmd}\n\n${HELP}`);
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  main().then(
    (code) => process.exit(code),
    (e) => {
      console.error(`ai-models: ${e.message}`);
      process.exit(EXIT.ERROR);
    },
  );
}
