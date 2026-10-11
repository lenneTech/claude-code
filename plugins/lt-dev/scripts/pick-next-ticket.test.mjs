#!/usr/bin/env node
// pick-next-ticket.test.mjs — offline unit tests for the pure selection logic
// of pick-next-ticket.mjs. No network, no Linear token: these prove that the
// helper's eligibility filter and five-key ranking reproduce take-ticket.md
// STEP 1b exactly, so replacing the MCP `list_issues` dump with the compact
// helper cannot change *which* ticket gets picked.
//
// Run:  node --test scripts/pick-next-ticket.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isFixNeededName,
  isBlockedName,
  priorityRank,
  computeEligibleStates,
  resolveProject,
  filterByAssignee,
  rankCandidates,
  analyzeBlocked,
  repoLineOf,
  repoNameFromRemote,
  isContentIssue,
  repoEligible,
  filterByRepo,
  assessAutopilotRelease,
  mergedInBase,
  resolveBaseRef,
  blockedSortKey,
} from './pick-next-ticket.mjs';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Real DevOps/"Entwicklung" workflow states (from list_issue_statuses), trimmed.
const STATES = [
  { id: 's-open', name: 'Open', type: 'unstarted' },
  { id: 's-fix', name: 'Fix Needed', type: 'started' },
  { id: 's-prog', name: 'In Progress', type: 'started' },
  { id: 's-devrev', name: 'Dev Review', type: 'started' },
  { id: 's-qatest', name: 'QA Testing', type: 'started' },
  { id: 's-backlog', name: 'Backlog', type: 'backlog' },
  { id: 's-done', name: 'Done', type: 'completed' },
  { id: 's-triage', name: 'Triage', type: 'triage' },
];

const ME = 'user-me';
const OTHER = 'user-other';

function issue(o) {
  return {
    id: o.id ?? o.identifier,
    identifier: o.identifier,
    title: o.identifier,
    priority: o.priority,
    createdAt: o.createdAt,
    state: { id: o.stateId },
    assignee: o.assignee === undefined ? null : (o.assignee ? { id: o.assignee } : null),
    labels: { nodes: (o.labels || []).map((n) => ({ name: n })) },
  };
}

test('isFixNeededName matches all documented spellings, nothing else', () => {
  for (const n of ['Fix needed', 'Fix Needed', 'Needs Fix', 'needs-fix', 'fix-needed', 'fix_needed', 'NEEDS FIX']) {
    assert.equal(isFixNeededName(n), true, n);
  }
  for (const n of ['Open', 'In Progress', 'Fixed', 'Fix', 'Needs Review', 'Bugfix']) {
    assert.equal(isFixNeededName(n), false, n);
  }
});

test('priorityRank orders Urgent > High > Medium > Low > None/unset', () => {
  assert.deepEqual([1, 2, 3, 4, 0, null].map(priorityRank), [0, 1, 2, 3, 4, 4]);
});

test('computeEligibleStates: default = unstarted + fix-needed, backlog/started/done excluded', () => {
  const { eligible, fixNeededIds } = computeEligibleStates(STATES);
  assert.deepEqual(eligible.map((s) => s.id).sort(), ['s-fix', 's-open']);
  assert.ok(fixNeededIds.has('s-fix'));
  assert.ok(!fixNeededIds.has('s-open'));
});

test('computeEligibleStates: --status allow-list is absolute, still splits fix-needed', () => {
  const { eligible, fixNeededIds } = computeEligibleStates(STATES, ['Open', 'Fix Needed', 'In Progress']);
  assert.deepEqual(eligible.map((s) => s.id).sort(), ['s-fix', 's-open', 's-prog']);
  assert.ok(fixNeededIds.has('s-fix'));
  assert.equal(fixNeededIds.size, 1);
});

test('computeEligibleStates never admits a backlog-typed state, even if named to match', () => {
  const weird = [{ id: 'x', name: 'fix-needed', type: 'backlog' }];
  assert.equal(computeEligibleStates(weird).eligible.length, 0);
});

test('filterByAssignee: me+null keeps mine + unassigned, drops others', () => {
  const rows = [
    issue({ identifier: 'A', assignee: ME }),
    issue({ identifier: 'B', assignee: null }),
    issue({ identifier: 'C', assignee: OTHER }),
  ];
  assert.deepEqual(filterByAssignee(rows, ME, 'me+null').map((r) => r.identifier), ['A', 'B']);
  assert.deepEqual(filterByAssignee(rows, ME, 'me').map((r) => r.identifier), ['A']);
  assert.deepEqual(filterByAssignee(rows, ME, 'null').map((r) => r.identifier), ['B']);
  assert.deepEqual(filterByAssignee(rows, ME, 'any').map((r) => r.identifier), ['A', 'B', 'C']);
});

test('rank: reproduces a real pick (DEV-2676 > DEV-2678 > DEV-2681)', () => {
  const { fixNeededIds } = computeEligibleStates(STATES);
  const rows = [
    issue({ identifier: 'DEV-2681', priority: 4, createdAt: '2026-07-24T03:59:28.651Z', stateId: 's-open' }),
    issue({ identifier: 'DEV-2678', priority: 3, createdAt: '2026-07-24T02:51:32.874Z', stateId: 's-open' }),
    issue({ identifier: 'DEV-2676', priority: 3, createdAt: '2026-07-24T02:50:55.678Z', stateId: 's-open' }),
  ];
  const ranked = rankCandidates(rows, ME, fixNeededIds).map((d) => d.r.identifier);
  assert.deepEqual(ranked, ['DEV-2676', 'DEV-2678', 'DEV-2681']);
});

test('rank key 1: priority dominates — an Urgent Open beats a Low Fix-needed', () => {
  const { fixNeededIds } = computeEligibleStates(STATES);
  const rows = [
    issue({ identifier: 'FIX-LOW', priority: 4, createdAt: '2026-01-01T00:00:00Z', stateId: 's-fix' }),
    issue({ identifier: 'OPEN-URGENT', priority: 1, createdAt: '2026-01-01T00:00:00Z', stateId: 's-open' }),
  ];
  assert.deepEqual(rankCandidates(rows, ME, fixNeededIds).map((d) => d.r.identifier), ['OPEN-URGENT', 'FIX-LOW']);
});

test('rank key 2: Fix-needed breaks an EQUAL-priority tie, but never jumps a higher priority', () => {
  const { fixNeededIds } = computeEligibleStates(STATES);
  // equal priority (both Medium) → fix-needed wins the tie
  const equal = rankCandidates([
    issue({ identifier: 'MED-OPEN', priority: 3, createdAt: '2026-01-01T00:00:00Z', stateId: 's-open' }),
    issue({ identifier: 'MED-FIX', priority: 3, createdAt: '2026-01-01T00:00:00Z', stateId: 's-fix' }),
  ], ME, fixNeededIds).map((d) => d.r.identifier);
  assert.deepEqual(equal, ['MED-FIX', 'MED-OPEN']);
  // a Medium Open outranks a Low Fix-needed (priority is primary, even against an older fix-needed)
  const across = rankCandidates([
    issue({ identifier: 'LOW-FIX', priority: 4, createdAt: '2020-01-01T00:00:00Z', stateId: 's-fix' }),
    issue({ identifier: 'MED-OPEN', priority: 3, createdAt: '2026-01-01T00:00:00Z', stateId: 's-open' }),
  ], ME, fixNeededIds).map((d) => d.r.identifier);
  assert.deepEqual(across, ['MED-OPEN', 'LOW-FIX']);
});

test('rank key 3+4: assigned-to-me before unassigned; bug before non-bug at equal status/priority', () => {
  const { fixNeededIds } = computeEligibleStates(STATES);
  const base = { priority: 3, createdAt: '2026-01-01T00:00:00Z', stateId: 's-open' };
  // key 3: mine wins the tie
  const byAssignee = rankCandidates([
    issue({ ...base, identifier: 'UNASSIGNED' }),
    issue({ ...base, identifier: 'MINE', assignee: ME }),
  ], ME, fixNeededIds).map((d) => d.r.identifier);
  assert.deepEqual(byAssignee, ['MINE', 'UNASSIGNED']);
  // key 4: bug wins when status+priority+assignment all equal
  const byBug = rankCandidates([
    issue({ ...base, identifier: 'PLAIN' }),
    issue({ ...base, identifier: 'BUG', labels: ['Bug'] }),
  ], ME, fixNeededIds).map((d) => d.r.identifier);
  assert.deepEqual(byBug, ['BUG', 'PLAIN']);
});

test('rank key 1 dominates key 5: higher priority beats older createdAt', () => {
  const { fixNeededIds } = computeEligibleStates(STATES);
  const rows = [
    issue({ identifier: 'OLD-LOW', priority: 4, createdAt: '2020-01-01T00:00:00Z', stateId: 's-open' }),
    issue({ identifier: 'NEW-HIGH', priority: 2, createdAt: '2026-07-24T00:00:00Z', stateId: 's-open' }),
  ];
  assert.deepEqual(rankCandidates(rows, ME, fixNeededIds).map((d) => d.r.identifier), ['NEW-HIGH', 'OLD-LOW']);
});

// ── Project resolution (tolerant --project matching) ────────────────────────

// Two ACME projects (no bare "ACME") + an unrelated one — the real trap that made
// `--project "ACME"` silently return an empty pool under the old `name: { eq }`.
const PROJECTS = [
  { id: 'p-kont', name: 'ACME - Kontingent' },
  { id: 'p-fix', name: 'ACME - Fixpreis' },
  { id: 'p-show', name: 'Showroom' },
];

test('resolveProject: exact (trimmed, case-insensitive) name wins', () => {
  const { project, error } = resolveProject(PROJECTS, '  acme - kontingent ');
  assert.equal(error, null);
  assert.equal(project.id, 'p-kont');
});

test('resolveProject: exact name beats an otherwise-ambiguous substring', () => {
  const withBare = [{ id: 'x', name: 'ACME' }, ...PROJECTS];
  const { project, error } = resolveProject(withBare, 'ACME');
  assert.equal(error, null);
  assert.equal(project.id, 'x'); // "ACME" exact, not ambiguous against the two "ACME - …"
});

test('resolveProject: unique substring resolves a short alias', () => {
  const { project, error } = resolveProject(PROJECTS, 'Kontingent');
  assert.equal(error, null);
  assert.equal(project.id, 'p-kont');
});

test('resolveProject: a unique prefix wins even when the substring set is ambiguous', () => {
  const projs = [{ id: 'a', name: 'Alpha' }, { id: 'b', name: 'Beta Alpha' }];
  const { project, error } = resolveProject(projs, 'alph'); // prefix→Alpha only; substring→both
  assert.equal(error, null);
  assert.equal(project.id, 'a');
});

test('resolveProject: an ambiguous alias fails loudly, does not guess', () => {
  const { project, error } = resolveProject(PROJECTS, 'ACME'); // prefix matches both ACME projects
  assert.equal(project, null);
  assert.match(error, /ambiguous project "ACME"/);
  assert.match(error, /ACME - Kontingent/);
  assert.match(error, /ACME - Fixpreis/);
});

test('resolveProject: an unknown name lists the available projects', () => {
  const { project, error } = resolveProject(PROJECTS, 'Nonexistent');
  assert.equal(project, null);
  assert.match(error, /project not found: "Nonexistent"/);
  assert.match(error, /Showroom/);
});

test('resolveProject: empty needle and empty/absent project list are handled', () => {
  assert.match(resolveProject(PROJECTS, '   ').error, /empty --project value/);
  assert.match(resolveProject([], 'ACME').error, /team has no projects/);
  assert.match(resolveProject(null, 'ACME').error, /team has no projects/);
});

// ── Blocked-column analysis ─────────────────────────────────────────────────

test('isBlockedName matches Blocked as a word, not substrings like "unblocked"', () => {
  for (const n of ['Blocked', 'blocked', 'BLOCKED', 'Blocked by CI', 'Dev Blocked']) {
    assert.equal(isBlockedName(n), true, n);
  }
  for (const n of ['Open', 'In Progress', 'Unblocked', 'unblocked']) {
    assert.equal(isBlockedName(n), false, n);
  }
});

// Build a Blocked issue T with blockers wired via inverseRelations (X blocks T →
// {type:'blocks', issue:X, relatedIssue:T} surfaces on T.inverseRelations).
function blockedIssue(identifier, blockers, { onRelations = false } = {}) {
  const nodes = blockers.map((b) => ({
    type: 'blocks',
    issue: { identifier: b.id, state: { name: b.status, type: b.type } },
    relatedIssue: { identifier, state: { name: 'Blocked', type: 'started' } },
  }));
  return {
    identifier,
    relations: { nodes: onRelations ? nodes : [] },
    inverseRelations: { nodes: onRelations ? [] : nodes },
  };
}

test('analyzeBlocked: all blockers Done/Canceled → likely unblocked', () => {
  const a = analyzeBlocked(blockedIssue('T', [
    { id: 'X', status: 'Done', type: 'completed' },
    { id: 'Y', status: 'Canceled', type: 'canceled' },
  ]));
  assert.equal(a.likelyUnblocked, true);
  assert.deepEqual(a.blockers.map((b) => b.identifier), ['X', 'Y']);
  assert.match(a.reason, /Alle Blocker erledigt/);
});

test('analyzeBlocked: an active blocker → still blocked', () => {
  const a = analyzeBlocked(blockedIssue('T', [
    { id: 'X', status: 'Done', type: 'completed' },
    { id: 'Z', status: 'In Progress', type: 'started' },
  ]));
  assert.equal(a.likelyUnblocked, false);
  assert.match(a.reason, /Noch aktive Blocker: Z/);
});

test('analyzeBlocked: no blocker relation on record → undetermined (needs text check)', () => {
  const a = analyzeBlocked(blockedIssue('T', []));
  assert.equal(a.likelyUnblocked, null);
  assert.equal(a.blockers.length, 0);
  assert.match(a.reason, /nur als Status/);
});

test('analyzeBlocked: direction-robust — a "blocks" relation where THIS ticket is the blocker is ignored', () => {
  // T blocks Y (T is the source) — must NOT be read as a blocker of T.
  const T = {
    identifier: 'T',
    relations: { nodes: [{ type: 'blocks', issue: { identifier: 'T', state: { name: 'Blocked', type: 'started' } }, relatedIssue: { identifier: 'Y', state: { name: 'Open', type: 'unstarted' } } }] },
    inverseRelations: { nodes: [] },
  };
  const a = analyzeBlocked(T);
  assert.equal(a.likelyUnblocked, null);
  assert.equal(a.blockers.length, 0);
});

// ── autopilot: repository routing ────────────────────────────────────────────

test('repoLineOf reads the Repo line: repository with subpath, content work, none', () => {
  assert.deepEqual(repoLineOf('**Typ:** Task\n\n**Repo:** `lenneTech/claude-code` → `plugins/lt-dev`'), {
    kind: 'repo',
    path: 'lenneTech/claude-code',
    name: 'claude-code',
  });
  assert.deepEqual(repoLineOf('**Repo:** — (Inhalt)'), { kind: 'content' });
  assert.deepEqual(repoLineOf('**Repo:** – (Inhalt)'), { kind: 'content' });
  assert.equal(repoLineOf('no routing line here'), null);
  assert.equal(repoLineOf(undefined), null);
});

test('repoNameFromRemote: ssh, https, owner/name', () => {
  assert.equal(repoNameFromRemote('git@gitlab.example.com:intern/showroom.git'), 'showroom');
  assert.equal(repoNameFromRemote('https://github.com/lenneTech/claude-code.git\n'), 'claude-code');
  assert.equal(repoNameFromRemote('intern/offers'), 'offers');
});

test('isContentIssue: label Inhalt or a content Repo line', () => {
  assert.equal(isContentIssue({ labels: { nodes: [{ name: 'Inhalt' }] }, description: '' }), true);
  assert.equal(isContentIssue({ labels: { nodes: [] }, description: '**Repo:** — (Inhalt)' }), true);
  assert.equal(isContentIssue({ labels: { nodes: [{ name: 'Bug' }] }, description: '**Repo:** `a/b`' }), false);
});

test('filterByRepo keeps this repository, unrouted and content tickets; skips foreign ones', () => {
  const rows = [
    { identifier: 'DEV-1', description: '**Repo:** `intern/showroom`' },
    { identifier: 'DEV-2', description: '**Repo:** `lenneTech/claude-code` → `plugins/lt-showroom`' },
    { identifier: 'DEV-3', description: 'no line' },
    { identifier: 'DEV-4', description: '**Repo:** — (Inhalt)' },
    { identifier: 'DEV-5', description: '**Repo:** `intern/Showroom`', labels: { nodes: [] } },
  ];
  const { kept, skipped } = filterByRepo(rows, 'showroom');
  assert.deepEqual(kept.map((r) => r.identifier), ['DEV-1', 'DEV-3', 'DEV-4', 'DEV-5']);
  assert.deepEqual(skipped, [{ identifier: 'DEV-2', repo: 'lenneTech/claude-code' }]);
  assert.equal(repoEligible(rows[1], null), true, 'without a repo filter every ticket stays');
});

// ── autopilot: blocker release ───────────────────────────────────────────────

function autopilotBlocked(identifier, blockers) {
  return {
    identifier,
    relations: { nodes: [] },
    inverseRelations: {
      nodes: blockers.map((b) => ({ type: 'blocks', issue: b, relatedIssue: { identifier } })),
    },
  };
}
const merged = (ids) => (id) => ({ merged: ids.includes(id), evidence: ids.includes(id) ? 'Commit abc auf origin/dev' : 'kein Commit' });

test('autopilot release: never without a blocker relation', () => {
  const r = assessAutopilotRelease(autopilotBlocked('DEV-10', []), { repoName: 'showroom', isMerged: merged([]) });
  assert.equal(r.releasable, false);
  assert.match(r.reason, /Keine Blocker-Relation/);
});

test('autopilot release: all blockers Done or Canceled', () => {
  const r = assessAutopilotRelease(
    autopilotBlocked('DEV-11', [
      { identifier: 'DEV-1', state: { name: 'Done', type: 'completed' } },
      { identifier: 'DEV-2', state: { name: 'Canceled', type: 'canceled' } },
    ]),
    { repoName: 'showroom', isMerged: merged([]) },
  );
  assert.equal(r.releasable, true);
});

test('autopilot release: a code blocker of this repository counts once Git shows it merged', () => {
  const blocker = { identifier: 'DEV-3', state: { name: 'Dev Review', type: 'started' }, description: '**Repo:** `intern/showroom`', labels: { nodes: [] } };
  assert.equal(assessAutopilotRelease(autopilotBlocked('DEV-12', [blocker]), { repoName: 'showroom', isMerged: merged(['DEV-3']) }).releasable, true);
  assert.equal(assessAutopilotRelease(autopilotBlocked('DEV-12', [blocker]), { repoName: 'showroom', isMerged: merged([]) }).releasable, false);
});

test('autopilot release: content and foreign-repository blockers count only when Done', () => {
  const content = { identifier: 'DEV-4', state: { name: 'Dev Review', type: 'started' }, description: '**Repo:** — (Inhalt)', labels: { nodes: [] } };
  const foreign = { identifier: 'DEV-5', state: { name: 'Dev Review', type: 'started' }, description: '**Repo:** `lenneTech/claude-code`', labels: { nodes: [] } };
  const c = assessAutopilotRelease(autopilotBlocked('DEV-13', [content]), { repoName: 'showroom', isMerged: merged(['DEV-4']) });
  assert.equal(c.releasable, false);
  assert.match(c.reason, /Inhalts-Ticket/);
  const f = assessAutopilotRelease(autopilotBlocked('DEV-14', [foreign]), { repoName: 'showroom', isMerged: merged(['DEV-5']) });
  assert.equal(f.releasable, false);
  assert.match(f.reason, /claude-code/);
});

test('autopilot release: one open blocker among done ones keeps the ticket blocked', () => {
  const r = assessAutopilotRelease(
    autopilotBlocked('DEV-15', [
      { identifier: 'DEV-6', state: { name: 'Done', type: 'completed' } },
      { identifier: 'DEV-7', state: { name: 'In Progress', type: 'started' }, description: '', labels: { nodes: [] } },
    ]),
    { repoName: 'showroom', isMerged: merged([]) },
  );
  assert.equal(r.releasable, false);
  assert.deepEqual(r.blockers.map((b) => b.ok), [true, false]);
});

// ── autopilot: merge evidence from Git ───────────────────────────────────────

test('mergedInBase: ticket ID in a base commit or in a merged remote branch, never a prefix match', () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'pick-merge-'));
  const g = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  try {
    const origin = path.join(tmp, 'origin.git');
    const work = path.join(tmp, 'work');
    g(tmp, 'init', '-q', '--bare', '-b', 'dev', origin);
    g(tmp, 'clone', '-q', origin, work);
    g(work, 'config', 'user.email', 'test@example.com');
    g(work, 'config', 'user.name', 'Test');
    g(work, 'checkout', '-q', '-b', 'dev');
    writeFileSync(path.join(work, 'a.txt'), 'a\n');
    g(work, 'add', '.');
    g(work, 'commit', '-q', '-m', 'DEV-3495: MCP-Anmeldung — Consent-Seite');
    g(work, 'checkout', '-q', '-b', 'feature/dev-77-badge');
    writeFileSync(path.join(work, 'b.txt'), 'b\n');
    g(work, 'add', '.');
    g(work, 'commit', '-q', '-m', 'add badge');
    g(work, 'checkout', '-q', 'dev');
    g(work, 'merge', '-q', '--no-ff', '-m', "Merge branch 'feature/dev-77-badge' into 'dev'", 'feature/dev-77-badge');
    // A merge commit whose message names neither branch nor ticket: only the merged branch tip carries it.
    g(work, 'checkout', '-q', '-b', 'feature/dev-88-pr');
    writeFileSync(path.join(work, 'c.txt'), 'c\n');
    g(work, 'add', '.');
    g(work, 'commit', '-q', '-m', 'tidy footer');
    g(work, 'checkout', '-q', 'dev');
    g(work, 'merge', '-q', '--no-ff', '-m', 'Merge pull request #12', 'feature/dev-88-pr');
    // A fast-forward leaves no merge commit: nothing on the base proves the branch was merged rather than stale.
    g(work, 'checkout', '-q', '-b', 'feature/dev-89-ff');
    writeFileSync(path.join(work, 'd.txt'), 'd\n');
    g(work, 'add', '.');
    g(work, 'commit', '-q', '-m', 'tidy header');
    g(work, 'checkout', '-q', 'dev');
    g(work, 'merge', '-q', '--ff-only', 'feature/dev-89-ff');
    // A branch pushed right after `checkout -b`, before its first commit: its tip is a base commit.
    g(work, 'branch', 'feature/dev-200-checkout-flow', 'dev');
    g(work, 'push', '-q', 'origin', 'dev', 'feature/dev-77-badge', 'feature/dev-88-pr', 'feature/dev-89-ff', 'feature/dev-200-checkout-flow');
    g(work, 'fetch', '-q', 'origin');

    const baseRef = resolveBaseRef(work, 'auto');
    assert.equal(baseRef, 'origin/dev');
    assert.equal(mergedInBase('DEV-3495', { cwd: work, baseRef }).merged, true);
    assert.equal(mergedInBase('dev-3495', { cwd: work, baseRef }).merged, true, 'case-insensitive');
    assert.equal(mergedInBase('DEV-349', { cwd: work, baseRef }).merged, false, 'no prefix match');
    assert.equal(mergedInBase('DEV-34951', { cwd: work, baseRef }).merged, false);
    assert.equal(mergedInBase('DEV-77', { cwd: work, baseRef }).merged, true, 'the merge commit names the branch');
    const branch = mergedInBase('DEV-88', { cwd: work, baseRef });
    assert.equal(branch.merged, true);
    assert.match(branch.evidence, /Branch origin\/feature\/dev-88-pr/);
    assert.equal(mergedInBase('DEV-89', { cwd: work, baseRef }).merged, false, 'a fast-forward is no merge evidence');
    assert.equal(mergedInBase('DEV-200', { cwd: work, baseRef }).merged, false, 'an empty pushed branch is not merged');
    assert.equal(mergedInBase('DEV-78', { cwd: work, baseRef }).merged, false);
    assert.equal(mergedInBase('DEV-1', { cwd: work, baseRef: null }).merged, false);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('blockedSortKey: with the autopilot assessment, releasable comes first, then priority', () => {
  const mk = (id, priority, releasable, likelyUnblocked) => ({
    r: { identifier: id, priority, createdAt: '2026-10-01T00:00:00Z' },
    analysis: { likelyUnblocked },
    autopilot: releasable === undefined ? undefined : { releasable },
  });
  const order = (rows) =>
    rows
      .slice()
      .sort((a, b) => {
        const ka = blockedSortKey(a), kb = blockedSortKey(b);
        for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] - kb[i];
        return 0;
      })
      .map((x) => x.r.identifier);
  // Merged-but-not-Done blocker: likelyUnblocked false, yet releasable — it must outrank an unreleasable Urgent.
  assert.deepEqual(order([mk('A', 1, false, true), mk('B', 3, true, false), mk('C', 2, true, false)]), ['C', 'B', 'A']);
  assert.deepEqual(order([mk('A', 3, undefined, false), mk('B', 3, undefined, true)]), ['B', 'A'], 'without --base: likely-unblocked first');
});
