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
  filterByAssignee,
  rankCandidates,
  analyzeBlocked,
} from './pick-next-ticket.mjs';

// Real DevOps/"Entwicklung" workflow states (from list_issue_statuses), trimmed.
const STATES = [
  { id: 's-open', name: 'Open', type: 'unstarted' },
  { id: 's-fix', name: 'Fix Needed', type: 'started' },
  { id: 's-prog', name: 'In Progress', type: 'started' },
  { id: 's-devrev', name: 'Dev Review', type: 'started' },
  { id: 's-porev', name: 'PO Review', type: 'started' },
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

test('rank: reproduces the real SVL pick (DEV-2676 > DEV-2678 > DEV-2681)', () => {
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
