// Offline tests for ai-models.mjs. No network: every function that talks to a
// provider is either avoided or fed a recorded answer.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import {
  blockingDuplicate,
  capabilitiesOf,
  collapseCacheFindings,
  chatBody,
  compareCatalog,
  compareInventory,
  compareLifecycle,
  daysUntil,
  exitCodeOf,
  fileTicket,
  findModelIds,
  fingerprintOf,
  isRedirect,
  judgeProbes,
  looksCached,
  mask,
  maxImagesOf,
  parseArgs,
  parseCatalog,
  parseDate,
  parseMittwaldOverview,
  parseNumber,
  parseRuntime,
  percentile,
  probesFor,
  runCheck,
  runInventory,
  summarize,
  summaryMarkdown,
  ticketContent,
  KNOWN_NEEDS,
  OCR_PROBE_TEXT,
  textPng,
  twoColourPng,
  unknownNeeds,
  validateAdapter,
  valueEqual,
} from './ai-models.mjs';

const SCRIPT = fileURLToPath(new URL('./ai-models.mjs', import.meta.url));

const adapter = () => ({
  project: 'example-crm',
  providers: [{ baseUrl: 'https://llm.example.test/v1', id: 'mw', keyEnv: 'EXAMPLE_KEY', kind: 'mittwald' }],
  usages: [
    { id: 'summarize', model: 'Qwen3.5-122B-A10B-FP8', needs: ['reasoning-off'], params: { maxTokens: 4096, reasoningEffort: 'none' }, provider: 'mw' },
    { id: 'ocr', model: 'Ministral-3-14B-Instruct-2512', needs: ['vision', 'max-images:4'], path: 'fast-path', provider: 'mw' },
  ],
});

// The overview table as mittwald's developer portal publishes it (public documentation).
const OVERVIEW = `# Available models

| Model Name                      | Type                      | Modalities                                      | Context (Tokens)  | License    | Status                           |
| ------------------------------- | ------------------------- | ----------------------------------------------- | ----------------- | ---------- | -------------------------------- |
| gpt-oss-120b                    | Chat + reasoning          | Text, tool-calling                              | 131,072           | Apache 2.0 | LTS                              |
| Ministral-3-14B-Instruct-2512   | Chat + vision             | Text, image, tool-calling                       | 262,144           | Apache 2.0 | LTS                              |
| Qwen3.5-122B-A10B-FP8           | Chat + reasoning + vision | Text, image, tool-calling                       | 245,760           | Apache 2.0 | Stable, disabled from 28.12.2026 |
| Qwen3.8-27B-NVFP4               | Chat + reasoning + vision | Text, image, tool-calling                       | 256,000           | Apache 2.0 | Testphase                        |
| GLM-OCR                         | Document OCR              | PDF, DOCX, PPTX, XLSX, HTML, SVG, image to text | 131,072           | MIT        | Stable                           |
| Qwen3-Embedding-8B              | Embedding                 | Text to vector                                  | 32,768            | Apache 2.0 | LTS                              |

Status shows the lifecycle phase of each model.
`;

test('parseArgs reads flags, values and positionals', () => {
  const a = parseArgs(['check', '--root', '/x', '--probe', '--since=2026-10-01', 'extra']);
  assert.deepEqual(a._, ['check', 'extra']);
  assert.equal(a.root, '/x');
  assert.equal(a.probe, true);
  assert.equal(a.since, '2026-10-01');
});

test('validateAdapter accepts a complete adapter', () => {
  assert.doesNotThrow(() => validateAdapter(adapter()));
});

test('validateAdapter refuses a key in the adapter and an undeclared provider', () => {
  const a = adapter();
  a.providers[0].apiKey = 'placeholder';
  a.usages[0].provider = 'nope';
  assert.throws(() => validateAdapter(a), /must not hold a key[\s\S]*provider "nope" is not declared/);
});

test('findModelIds matches only quoted, exact model IDs', () => {
  const text = `model: 'Qwen3.5-122B-A10B-FP8', // not Qwen3.5-122B-A10B-FP8 unquoted\nconst x = "gpt-oss-120b-old";`;
  const ids = new Set(['Qwen3.5-122B-A10B-FP8', 'gpt-oss-120b']);
  assert.deepEqual([...findModelIds(text, ids)], ['Qwen3.5-122B-A10B-FP8']);
});

test('compareInventory reports adapter/code drift in both directions', () => {
  const { findings } = compareInventory({
    adapter: adapter(),
    catalogIds: new Set(['gpt-oss-120b']),
    seedTexts: [{ file: 'seed.ts', text: `{ model: 'Qwen3.5-122B-A10B-FP8' }, { model: 'gpt-oss-120b' }` }],
  });
  const codes = findings.map((f) => `${f.code}:${f.subject}`).sort();
  assert.deepEqual(codes, ['adapter-model-not-in-code:ocr', 'code-model-not-in-adapter:gpt-oss-120b']);
  assert.equal(exitCodeOf(findings), 1);
});

test('compareInventory reports runtime drift', () => {
  const { findings } = compareInventory({
    adapter: adapter(),
    runtime: [{ model: 'Qwen3.5-122B-A10B-FP8' }, { model: 'Qwen3.6-35B-A3B-FP8' }],
  });
  const codes = findings.map((f) => `${f.code}:${f.subject}`).sort();
  assert.deepEqual(codes, ['runtime-drift:ocr', 'runtime-model-not-in-adapter:Qwen3.6-35B-A3B-FP8']);
});

test('parseRuntime accepts arrays of strings, objects and {models}', () => {
  assert.deepEqual(parseRuntime('["a","b"]'), [{ model: 'a' }, { model: 'b' }]);
  assert.deepEqual(parseRuntime('{"models":[{"modelId":"a","name":"ocr"}]}'), [{ model: 'a', usage: 'ocr' }]);
});

test('runInventory runs the runtime command and reads its JSON', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ai-models-'));
  writeFileSync(join(dir, 'runtime.mjs'), `console.log(JSON.stringify(["Qwen3.5-122B-A10B-FP8","Ministral-3-14B-Instruct-2512"]))`);
  const a = adapter();
  a.inventory = { runtime: { command: `"${process.execPath}" runtime.mjs` } };
  const inv = runInventory(a, dir);
  assert.equal(inv.runtime.length, 2);
  assert.deepEqual(inv.findings, []);
});

test('runInventory reports a failing runtime command instead of throwing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ai-models-'));
  const a = adapter();
  a.inventory = { runtime: { command: `"${process.execPath}" -e "process.exit(4)"` } };
  const inv = runInventory(a, dir);
  assert.equal(inv.findings[0].code, 'runtime-unavailable');
});

test('parseCatalog and compareCatalog flag a model in use that the key no longer sees', () => {
  const models = parseCatalog({ data: [{ id: 'Ministral-3-14B-Instruct-2512', max_input_tokens: 262144 }, { id: 'gpt-oss-120b' }] });
  assert.equal(models[0].maxInput, 262144);
  const findings = compareCatalog(adapter(), { mw: { models } });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].code, 'model-missing');
  assert.equal(findings[0].level, 2);
  assert.equal(findings[0].subject, 'summarize');
});

test('compareCatalog lists unused catalog models as candidates, except for mittwald', () => {
  const a = adapter();
  a.providers.push({ baseUrl: 'https://api.example.test/v1', id: 'oa', keyEnv: 'OA_KEY', kind: 'openai' });
  a.usages.push({ id: 'chat', model: 'gpt-4o', provider: 'oa' });
  const findings = compareCatalog(a, {
    mw: { models: [{ id: 'Qwen3.5-122B-A10B-FP8' }, { id: 'Ministral-3-14B-Instruct-2512' }, { id: 'gpt-oss-120b' }] },
    oa: { models: [{ id: 'gpt-4o' }, { id: 'gpt-4.1', maxInput: 1000000 }] },
  });
  const candidates = findings.filter((f) => f.code === 'candidate');
  assert.deepEqual(candidates.map((f) => f.subject), ['gpt-4.1']);
  assert.equal(candidates[0].level, 0);
  assert.match(candidates[0].message, /oa catalog; 1000000 input tokens/);
});

test('parseMittwaldOverview reads status, shutdown date, context and capabilities', () => {
  const docs = parseMittwaldOverview(OVERVIEW);
  assert.equal(docs.length, 6);
  const q = docs.find((d) => d.id === 'Qwen3.5-122B-A10B-FP8');
  assert.equal(q.status, 'Stable');
  assert.equal(q.shutdown, '2026-12-28');
  assert.equal(q.context, 245760);
  assert.deepEqual(q.capabilities, ['chat', 'vision', 'reasoning', 'tools']);
  assert.deepEqual(docs.find((d) => d.id === 'GLM-OCR').capabilities, ['ocr']);
  assert.deepEqual(docs.find((d) => d.id === 'Qwen3-Embedding-8B').capabilities, ['embeddings']);
  assert.equal(docs.find((d) => d.id === 'gpt-oss-120b').shutdown, null);
});

test('capabilitiesOf does not mistake OCR input "image to text" for vision chat', () => {
  assert.deepEqual(capabilitiesOf('Document OCR', 'PDF, image to text'), ['ocr']);
});

test('daysUntil counts calendar days in UTC', () => {
  assert.equal(daysUntil('2026-12-28', new Date('2026-10-13T23:30:00Z')), 76);
});

test('compareLifecycle: shutdown within the urgent window is urgent, later is action', () => {
  const docs = parseMittwaldOverview(OVERVIEW);
  const urgent = compareLifecycle(adapter(), docs, { today: new Date('2026-10-13T00:00:00Z'), urgentDays: 90 });
  const s = urgent.find((f) => f.code === 'shutdown-announced');
  assert.equal(s.level, 2);
  assert.equal(s.shutdown, '2026-12-28');
  const early = compareLifecycle(adapter(), docs, { today: new Date('2026-06-01T00:00:00Z'), urgentDays: 90 });
  assert.equal(early.find((f) => f.code === 'shutdown-announced').level, 1);
});

test('compareLifecycle: test phase, missing capability, undocumented model, candidates', () => {
  const docs = parseMittwaldOverview(OVERVIEW);
  const a = adapter();
  a.usages.push({ id: 'agent', model: 'Qwen3.8-27B-NVFP4', provider: 'mw' });
  a.usages.push({ id: 'chat-vision', model: 'gpt-oss-120b', needs: ['vision'], provider: 'mw' });
  a.usages.push({ id: 'gone', model: 'Mistral-Medium-3.5-128B', provider: 'mw' });
  const f = compareLifecycle(a, docs, { today: new Date('2026-10-13T00:00:00Z') });
  assert.equal(f.find((x) => x.code === 'test-phase').subject, 'agent');
  assert.equal(f.find((x) => x.code === 'capability-missing').level, 2);
  assert.equal(f.find((x) => x.code === 'model-undocumented').subject, 'gone');
  const candidates = f.filter((x) => x.code === 'candidate').map((x) => x.subject).sort();
  assert.deepEqual(candidates, ['GLM-OCR', 'Qwen3-Embedding-8B']);
});

test('twoColourPng builds a valid PNG of the requested size', () => {
  const png = twoColourPng(64, 32);
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(png.subarray(12, 16).toString(), 'IHDR');
  assert.equal(png.readUInt32BE(16), 64);
  assert.equal(png.readUInt32BE(20), 32);
});

test('chatBody uses the usage parameters and lets a probe override them', () => {
  const b = chatBody('m', 'hi', { maxTokens: 10, params: { reasoningEffort: 'none', temperature: 0.2 } });
  assert.equal(b.temperature, 0.2);
  assert.equal(b.reasoning_effort, 'none');
  assert.equal(chatBody('m', 'hi', { extra: { reasoning_effort: 'low' }, params: { reasoningEffort: 'none' } }).reasoning_effort, 'low');
  assert.equal(chatBody('m', 'hi').temperature, 0);
});

test('maxImagesOf reads params.maxImages or a max-images:<n> need', () => {
  assert.equal(maxImagesOf({ params: { maxImages: 5 } }), 5);
  assert.equal(maxImagesOf({ needs: ['vision', 'max-images:4'] }), 4);
  assert.equal(maxImagesOf({}), null);
});

test('probesFor picks probes from needs and params', () => {
  const [summarizeUsage, ocrUsage] = adapter().usages;
  assert.deepEqual(probesFor(summarizeUsage), ['basic', 'cache', 'reasoning-off', 'budget']);
  assert.deepEqual(probesFor(ocrUsage), ['basic', 'cache', 'vision', 'image-limit']);
  assert.deepEqual(probesFor({ needs: ['embeddings'] }), ['embeddings']);
});

test('looksCached needs identical usage and a far faster second call', () => {
  const u = { usage: { completion_tokens: 12, prompt_tokens: 30 } };
  assert.equal(looksCached({ json: u, ms: 2000, status: 200 }, { json: u, ms: 40, status: 200 }), true);
  assert.equal(looksCached({ json: u, ms: 2000, status: 200 }, { json: u, ms: 1900, status: 200 }), false);
  assert.equal(looksCached({ json: u, ms: 2000, status: 200 }, { json: { usage: { completion_tokens: 13 } }, ms: 40, status: 200 }), false);
});

test('judgeProbes: failed vision is urgent, eaten budget is action, cache is information', () => {
  const usage = adapter().usages[1];
  const f = judgeProbes(usage, {
    budget: { emptyOnLength: true, ok: false },
    cache: { cached: true, first: 2000, ok: true, second: 40 },
    vision: { answer: 'blue', ok: false },
  });
  const byCode = Object.fromEntries(f.map((x) => [x.code, x.level]));
  assert.deepEqual(byCode, { 'budget-eaten-by-reasoning': 1, 'gateway-cache': 0, 'probe-vision-failed': 2 });
});

test('isRedirect tolerates a provider prefix, case and a dated snapshot, nothing else', () => {
  assert.equal(isRedirect('Qwen3.6-35B-A3B-FP8', 'Qwen3.6-35B-A3B-FP8'), false);
  assert.equal(isRedirect('Qwen3.6-35B-A3B-FP8', 'hosted_vllm/qwen3.6-35b-a3b-fp8'), false);
  assert.equal(isRedirect('gpt-4o-mini', 'gpt-4o-mini-2024-07-18'), false);
  assert.equal(isRedirect('gpt-4', 'gpt-4-0613'), false);
  assert.equal(isRedirect('gpt-4o', 'openai/gpt-4o-2024-08-06'), false);
  assert.equal(isRedirect('gpt-4o', 'gpt-4o-mini-2024-07-18'), true);
  assert.equal(isRedirect('Mistral-Medium-3.5-128B', 'Qwen3.6-35B-A3B-FP8'), true);
  assert.equal(isRedirect('m', null), false);
});

test('judgeProbes reports an empty answer to the one-word request', () => {
  // Observed 2026-10-14: a model withdrawn from the catalog still answered HTTP 200, under its own ID, with no text.
  const f = judgeProbes({ id: 'legacy', model: 'Mistral-Medium-3.5-128B' }, { basic: { answeredBy: 'Mistral-Medium-3.5-128B', empty: true, ok: true, status: 200 } });
  assert.deepEqual(f.map((x) => `${x.code}:${x.level}`), ['empty-answer:1']);
});

test('collapseCacheFindings keeps one cache line per provider', () => {
  const a = adapter();
  const out = collapseCacheFindings(a, [
    { code: 'gateway-cache', level: 0, message: 'usage summarize: identical requests are answered from a cache (281 ms → 40 ms); time only first calls', subject: 'summarize' },
    { code: 'gateway-cache', level: 0, message: 'usage ocr: identical requests are answered from a cache (185 ms → 38 ms); time only first calls', subject: 'ocr' },
    { code: 'empty-answer', level: 1, message: 'x', subject: 'ocr' },
  ]);
  assert.equal(out.length, 2);
  const cache = out.find((x) => x.code === 'gateway-cache');
  assert.equal(cache.subject, 'mw');
  assert.match(cache.message, /mw answers identical requests from a cache \(281 ms → 40 ms; usages summarize, ocr\)/);
});

test('judgeProbes reports a redirected model as urgent', () => {
  const f = judgeProbes({ id: 'legacy', model: 'Mistral-Medium-3.5-128B' }, { basic: { answeredBy: 'Qwen3.6-35B-A3B-FP8', ok: true } });
  assert.equal(f[0].code, 'model-redirected');
  assert.equal(f[0].level, 2);
});

test('parseNumber reads German and English number formats', () => {
  assert.equal(parseNumber('1.000'), 1000);
  assert.equal(parseNumber('5,52'), 5.52);
  assert.equal(parseNumber('1,234.50'), 1234.5);
  assert.equal(parseNumber('1.234,50 €'), 1234.5);
  assert.equal(parseNumber('200.00'), 200);
  assert.equal(parseNumber('A-12'), null);
});

test('parseDate and valueEqual compare by value, not spelling', () => {
  assert.equal(parseDate('03.09.2026'), '2026-09-03');
  assert.equal(parseDate('3.9.26'), '2026-09-03');
  assert.equal(valueEqual('03.09.2026', '2026-09-03'), true);
  assert.equal(valueEqual('1.000', '1000'), true);
  assert.equal(valueEqual('5,52', '5.52'), true);
  assert.equal(valueEqual('09218OPZP120AK', '09218OPZP160AK'), false);
});

test('mask keeps the shape and drops the content', () => {
  assert.equal(mask('Müller 4711-AB'), 'aaaaaa 9999-aa');
  assert.equal(mask('x'.repeat(60)).length, 40);
});

test('percentile returns the nearest-rank value', () => {
  assert.equal(percentile([5, 1, 3, 2, 4], 50), 3);
  assert.equal(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 90), 9);
  assert.equal(percentile([], 50), null);
});

test('summarize excludes cached rows from latency and flags fallbacks', () => {
  const rows = [
    { accuracy: 90, config: 'T:a', goal: true, model: 'A', modelUsed: 'A', ms: 1000, path: 'analysis' },
    { accuracy: 80, cached: true, config: 'T:a', goal: true, model: 'A', modelUsed: 'A', ms: 10, path: 'analysis' },
    { accuracy: 95, config: 'T:b', goal: true, model: 'B', modelUsed: 'M', ms: 3000, path: 'unified' },
    { config: 'T:b', error: 'HTTP 500', model: 'B' },
  ];
  const s = summarize(rows);
  const a = s.find((g) => g.group === 'T:a');
  assert.equal(a.medianMs, 1000);
  assert.equal(a.cachedExcluded, 1);
  assert.equal(a.goal, 100);
  const b = s.find((g) => g.group === 'T:b');
  assert.equal(b.errors, 1);
  assert.equal(b.otherModel, 1);
  assert.deepEqual(b.paths, ['unified']);
  assert.match(summaryMarkdown(s), /Check before comparing: T:b/);
});

test('summarize: an interactive usage ranks configurations within the latency budget first', () => {
  const rows = [
    { config: 'A:slow-better', lenient: 95, goal: true, ms: 7100, usage: 'assistant' },
    { config: 'A:fast', lenient: 88, goal: true, ms: 2700, usage: 'assistant' },
    { config: 'D:slow-better', lenient: 95, goal: true, ms: 40000, usage: 'documents' },
    { config: 'D:fast', lenient: 88, goal: true, ms: 9000, usage: 'documents' },
  ];
  const usages = { assistant: { latency: 'interactive', latencyBudgetMs: 5000 }, documents: { latency: 'background' } };
  const s = summarize(rows, ['config'], { usages });
  assert.deepEqual(s.map((g) => g.group), ['A:fast', 'A:slow-better', 'D:slow-better', 'D:fast']);
  assert.equal(s.find((g) => g.group === 'A:slow-better').overBudget, true);
  assert.equal(s.find((g) => g.group === 'D:slow-better').overBudget, null);
  const md = summaryMarkdown(s);
  assert.match(md, /interactive, OVER 5\.0 s/);
  assert.match(md, /Over the latency budget of an interactive usage: A:slow-better/);
});

test('summarize: without latency classes, quality decides and latency breaks the tie', () => {
  const s = summarize([
    { config: 'slow', lenient: 90, goal: true, ms: 9000 },
    { config: 'fast', lenient: 90, goal: true, ms: 3000 },
    { config: 'best', lenient: 95, goal: true, ms: 20000 },
  ]);
  assert.deepEqual(s.map((g) => g.group), ['best', 'fast', 'slow']);
});

test('validateAdapter checks latency class and budget', () => {
  const a = adapter();
  a.usages[0].latency = 'fast';
  a.usages[1].latencyBudgetMs = 0;
  assert.throws(() => validateAdapter(a), /latency must be interactive or background[\s\S]*latencyBudgetMs must be a positive number/);
});

test('fingerprintOf ignores finding order and information, changes with the facts', () => {
  const base = { findings: [finding2('a'), finding2('b'), { code: 'candidate', level: 0, subject: 'x' }], project: 'p' };
  const swapped = { findings: [finding2('b'), finding2('a')], project: 'p' };
  assert.equal(fingerprintOf(base), fingerprintOf(swapped));
  const moved = { findings: [finding2('a'), { ...finding2('b'), shutdown: '2027-01-01' }], project: 'p' };
  assert.notEqual(fingerprintOf(base), fingerprintOf(moved));
});

function finding2(subject) {
  return { code: 'shutdown-announced', level: 1, model: 'M', shutdown: '2026-12-28', subject };
}

test('ticketContent writes a German Triage ticket that carries the fingerprint', () => {
  const report = { findings: [{ level: 2, message: 'usage summarize: M will be disabled' }, { level: 0, message: 'candidate' }], fingerprint: 'abc123', project: 'example-crm' };
  const { description, title } = ticketContent(report);
  assert.match(title, /^Dringend: KI-Modelle in example-crm prüfen \(1 Befund\)$/);
  assert.match(description, /ai-models-fingerprint: abc123/);
  assert.doesNotMatch(description, /candidate/);
});

test('blockingDuplicate: open and declined tickets block, completed ones do not', () => {
  assert.equal(blockingDuplicate([{ identifier: 'A', state: { type: 'completed' } }]), null);
  assert.equal(blockingDuplicate([{ identifier: 'A', state: { type: 'completed' } }, { identifier: 'B', state: { type: 'canceled' } }]).identifier, 'B');
  assert.equal(blockingDuplicate([{ identifier: 'C', state: { type: 'triage' } }]).identifier, 'C');
  assert.equal(blockingDuplicate([]), null);
});

test('fileTicket --dry-run returns the payload without touching Linear', async () => {
  const r = await fileTicket({ findings: [{ level: 1, message: 'x' }], fingerprint: 'f', project: 'p' }, { dryRun: true, team: 'DEV' });
  assert.equal(r.dryRun, true);
  assert.equal(r.payload.team, 'DEV');
});

test('runCheck --offline reports the inventory without network', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ai-models-'));
  writeFileSync(join(dir, 'seed.ts'), `const a = 'Qwen3.5-122B-A10B-FP8';`);
  const a = adapter();
  a.inventory = { seed: { files: ['seed.ts'] } };
  const report = await runCheck(a, dir, { offline: true });
  assert.equal(report.exitCode, 1);
  assert.equal(report.findings[0].code, 'adapter-model-not-in-code');
  assert.equal(report.project, 'example-crm');
  assert.match(report.fingerprint, /^[0-9a-f]{16}$/);
});

test('CLI: a clean check exits 0 and the ticket command files nothing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ai-models-'));
  writeFileSync(join(dir, '.ai-models.json'), JSON.stringify(adapter()));
  const out = join(dir, 'out');
  assert.equal(spawnSync(process.execPath, [SCRIPT, 'check', '--root', dir, '--offline', '--out', out]).status, 0);
  const t = spawnSync(process.execPath, [SCRIPT, 'ticket', '--report', join(out, 'report.json'), '--team', 'DEV', '--dry-run'], { encoding: 'utf8' });
  assert.equal(t.status, 0);
  assert.match(t.stdout, /nothing to file/);
});

// The CI template files a ticket whenever `check` exits >= 1; this pins that contract end to end.
test('CLI: check exits with the finding level and ticket turns the report into a ticket', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ai-models-'));
  writeFileSync(join(dir, 'seed.ts'), `const a = 'Qwen3.5-122B-A10B-FP8';`);
  writeFileSync(join(dir, '.ai-models.json'), JSON.stringify({ ...adapter(), inventory: { seed: { files: ['seed.ts'] } } }));
  const out = join(dir, 'out');
  assert.equal(spawnSync(process.execPath, [SCRIPT, 'check', '--root', dir, '--offline', '--out', out]).status, 1);
  const reportPath = join(out, 'report.json');
  assert.equal(JSON.parse(readFileSync(reportPath, 'utf8')).exitCode, 1);
  assert.match(readFileSync(join(out, 'report.md'), 'utf8'), /\*\*ACTION\*\*/);
  const t = spawnSync(process.execPath, [SCRIPT, 'ticket', '--report', reportPath, '--team', 'DEV', '--dry-run'], { encoding: 'utf8' });
  assert.equal(t.status, 0);
  assert.match(JSON.parse(t.stdout).payload.title, /^KI-Modelle in example-crm prüfen \(1 Befund\)$/);
});

test('CLI: a missing adapter is a configuration error (exit 3)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ai-models-'));
  let code = 0;
  try {
    execFileSync(process.execPath, [SCRIPT, 'check', '--root', dir, '--offline'], { stdio: 'pipe' });
  } catch (e) {
    code = e.status;
  }
  assert.equal(code, 3);
});

// Regression for a document-OCR usage (observed 2026-10-17): GLM-OCR is listed with `ocr`, not
// `vision`. `needs: ["vision"]` was reported URGENT, and `needs: ["ocr"]` was checked by nothing.
test('compareLifecycle maps the ocr need to the ocr capability', () => {
  const docs = parseMittwaldOverview(OVERVIEW);
  const usage = (id, model, needs) => ({ id, model, needs, provider: 'mw' });
  const a = { ...adapter(), usages: [usage('doc-ocr', 'GLM-OCR', ['ocr']), usage('ocr-as-vision', 'GLM-OCR', ['vision']), usage('chat-ocr', 'gpt-oss-120b', ['ocr'])] };
  const missing = compareLifecycle(a, docs, { today: new Date('2026-10-13T00:00:00Z') })
    .filter((f) => f.code === 'capability-missing')
    .map((f) => f.subject)
    .sort();
  assert.deepEqual(missing, ['chat-ocr', 'ocr-as-vision']);
});

test('the ocr need gets its own probe, and a failed one is urgent', () => {
  assert.deepEqual(probesFor({ needs: ['ocr'] }), ['basic', 'cache', 'ocr']);
  const f = judgeProbes({ id: 'doc-ocr', model: 'GLM-OCR' }, { ocr: { answer: 'unreadable', ok: false } });
  assert.deepEqual(f.map((x) => `${x.code}:${x.level}`), ['probe-ocr-failed:2']);
});

test('textPng renders the OCR probe text as a valid PNG and refuses glyphs it does not have', () => {
  const png = textPng(OCR_PROBE_TEXT);
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(png.subarray(12, 16).toString(), 'IHDR');
  // 2 margins of 12 px plus 8 cells of 36 px, 7 dot rows of 6 px plus margins
  assert.equal(png.readUInt32BE(16), 24 + OCR_PROBE_TEXT.length * 36);
  assert.equal(png.readUInt32BE(20), 24 + 42);
  assert.throws(() => textPng('Hello?'), /no glyph/);
  // the probe text must not be a number a model could guess from memory
  assert.doesNotMatch(OCR_PROBE_TEXT, /4711|1234|0000/);
});

test('unknownNeeds flags a need nothing checks and accepts every known one', () => {
  const a = {
    ...adapter(),
    usages: [
      { id: 'ok', model: 'm', needs: [...KNOWN_NEEDS, 'max-images:4'], provider: 'mw' },
      { id: 'typo', model: 'm', needs: ['visoin'], provider: 'mw' },
    ],
  };
  const f = unknownNeeds(a);
  assert.deepEqual(f.map((x) => `${x.code}:${x.level}:${x.subject}`), ['unknown-need:1:typo']);
  assert.match(f[0].message, /need "visoin" is not checked by anything/);
});

test('runCheck reports unknown needs offline', async () => {
  const root = mkdtempSync(join(tmpdir(), 'ai-models-needs-'));
  const a = { ...adapter(), usages: [{ id: 'typo', model: 'm', needs: ['ocrr'], provider: 'mw' }] };
  const report = await runCheck(a, root, { noRuntime: true, offline: true });
  assert.ok(report.findings.some((f) => f.code === 'unknown-need' && f.subject === 'typo'));
});

// Regression (2026-10-18): the team query had no `first`, Linear counted its default of 50 per
// connection level and refused it as too complex (18,305 > 10,000), so every real ticket run failed.
// --dry-run sends no query, so only a stubbed fetch sees the query strings.
test('fileTicket sends only queries whose connections all name a size', async () => {
  const unsized = (query) => {
    const out = [];
    for (const m of query.matchAll(/(\w+)(?:\(([^()]*)\))?\s*\{\s*nodes\s*\{/g)) {
      if (!/\bfirst\s*:/.test(m[2] ?? '')) out.push(m[1]);
    }
    return out;
  };
  const answers = [
    { teams: { nodes: [{ id: 't1', labels: { nodes: [{ id: 'l1', name: 'KI-Vorschlag' }] }, states: { nodes: [{ id: 's1', name: 'Triage', type: 'triage' }] } }] } },
    { issues: { nodes: [] } },
    { issueCreate: { issue: { identifier: 'DEV-1', url: 'https://linear.example.test/DEV-1' } } },
  ];
  const queries = [];
  const realFetch = globalThis.fetch;
  const realKey = process.env.LINEAR_API_KEY;
  process.env.LINEAR_API_KEY = 'test-key';
  globalThis.fetch = async (_url, init) => {
    const { query } = JSON.parse(init.body);
    queries.push(query);
    const missing = unsized(query);
    const body = missing.length
      ? { errors: [{ message: `connection without first: ${missing.join(', ')}` }] }
      : { data: answers[queries.length - 1] };
    return new Response(JSON.stringify(body), { status: 200 });
  };
  try {
    const r = await fileTicket({ findings: [{ level: 1, message: 'x' }], fingerprint: 'fp', project: 'p' }, { team: 'DEV' });
    assert.equal(r.created.identifier, 'DEV-1');
    assert.equal(queries.length, 3);
    assert.deepEqual(queries.flatMap(unsized), []);
  } finally {
    globalThis.fetch = realFetch;
    if (realKey === undefined) delete process.env.LINEAR_API_KEY;
    else process.env.LINEAR_API_KEY = realKey;
  }
});
