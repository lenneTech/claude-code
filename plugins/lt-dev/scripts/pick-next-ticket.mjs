#!/usr/bin/env node
// pick-next-ticket.mjs
//
// Deterministic ticket auto-pick helper for /lt-dev:take-ticket (and the
// /lt-dev:ticket-cycle orchestrator that wraps it). Reproduces the STEP 1b
// selection EXACTLY — same hard filter, same five-key ranking — but talks to
// the Linear GraphQL API directly and requests ONLY the fields the ranking
// needs. That turns a multi-hundred-KB MCP `list_issues` dump (whole team, all
// projects, full descriptions — enough to blow the model's token budget) into a
// compact, pre-ranked candidate list.
//
// Why this does NOT change selection quality: the ranking is a pure function of
// (fix-needed?, priority, assigned-to-me?, bug-label?, createdAt). The issue
// *description* never enters the ranking — it is only needed to describe the
// finalist to the user, and is fetched here for just the top N candidates
// (default 3) so the pick-confirmation and "propose next" both work without any
// follow-up call. The pure ranking functions are exported for unit testing
// (see pick-next-ticket.test.mjs) so this equivalence is provable offline.
//
// ── Selection semantics (mirrors take-ticket.md STEP 1b) ────────────────────
// Phase 1 — hard filter (eligibility). A ticket is a candidate iff BOTH hold:
//   • its state is Open (Linear type `unstarted`) OR Fix-needed (state NAME
//     matches fix[-_ ]needed / needs[-_ ]fix, case-insensitive; any type).
//     Backlog (type `backlog`) is ALWAYS excluded. `--status=<list>` overrides
//     this with an absolute name allow-list, still split into the two buckets
//     so the "Fix needed > Open" sort key keeps working.
//   • it is assigned to me OR unassigned. Tickets assigned to OTHER users are
//     excluded outright and never enter the sort.
// Phase 2 — five-key sort (ranking inside the eligible pool):
//   1. priority DESC          (Urgent > High > Medium > Low > None) — an Urgent
//                             ticket beats a non-Urgent Fix-needed one
//   2. fix-needed flag DESC   (Fix needed before Open, AT EQUAL priority)
//   3. assigned-to-me DESC    (mine before unassigned)
//   4. bug-flag DESC          (carries a `bug` label)
//   5. createdAt ASC          (oldest first)
//
// ── Auth ────────────────────────────────────────────────────────────────────
// A Linear Personal API Key is required (the hosted Linear MCP uses OAuth, which
// is not reusable from a standalone script). Resolution order:
//   1. env  LINEAR_API_KEY
//   2. macOS Keychain:  security find-generic-password -s linear-api -w
// One-time setup:
//   Create a key at Linear → Settings → Security & access → Personal API keys,
//   then store it:
//     security add-generic-password -a "$USER" -s linear-api -w 'lin_api_xxx'
//   (or export LINEAR_API_KEY=lin_api_xxx)
//
// ── Usage ───────────────────────────────────────────────────────────────────
//   node pick-next-ticket.mjs --team <key|name> [options]
//
//   --team <k|n>        Linear team key (e.g. DEV) or name (required)
//   --project <name>    Restrict to one Linear project. Matched TOLERANTLY against
//                       the team's projects: exact name → unique prefix → unique
//                       substring (case-insensitive), so a short alias like "ACME"
//                       resolves "ACME - Kontingent". An unknown or ambiguous name
//                       is a hard error (exit 6) — never a silent empty pool.
//                       STRONGLY recommended — the single biggest token saver.
//   --status <list>     Comma-separated state-name allow-list (absolute filter).
//                       Default: all `unstarted` states + any fix-needed state.
//   --assignee <who>    me+null (default) | me | null | any
//   --desc-count <n>    How many top candidates to fetch descriptions for (default 3)
//   --limit <n>         Max issues to pull before ranking (default 250)
//   --blocked           Also analyse the team's "Blocked" column and report which
//                       blocked tickets are LIKELY no longer blocked (all their
//                       `blocks` blockers are Done/Canceled). Use this when the
//                       primary pool is empty. Such a ticket must NOT be auto-
//                       picked — the caller surfaces the reason and requires an
//                       EXPLICIT user release first.
//   --repo <name|auto>  Autopilot repository filter: drop candidates whose description
//                       names ANOTHER repository in its `**Repo:**` line. Tickets without
//                       the line, content tickets (`**Repo:** — (Inhalt)` or label
//                       `Inhalt`) and tickets naming this repository stay. `auto` reads
//                       the name from `git remote get-url origin`. Dropped tickets are
//                       listed in `pool.skippedForeignRepo`.
//   --base <branch|auto> Autopilot release check for the Blocked column (implies --blocked):
//                       each blocked candidate gets `autopilot: { releasable, reason }`.
//                       Releasable only with at least one `blocks` relation, and every
//                       blocker either Done/Canceled, or a code ticket of THIS repository
//                       whose merge into the base branch Git shows (a commit on
//                       origin/<base> naming its identifier, or a merged remote branch
//                       carrying it). Content tickets and tickets of other repositories
//                       count only when Done. `auto` = first of dev, develop, main, master.
//   --json              Emit ONLY the machine-readable JSON block (no human table)
//
// ── Output ──────────────────────────────────────────────────────────────────
//   • a compact ranked table (human, to stdout) unless --json
//   • a machine block delimited by the markers below, containing the full ranked
//     candidate list + resolved pool metadata; descriptions for the top N; and,
//     with --blocked, a `blocked: { state, candidates:[{likelyUnblocked, reason,
//     blockers}] }` section:
//        ===PICK_RESULT_JSON===
//        { ... }
//        ===END_PICK_RESULT_JSON===
//
// ── Exit codes ──────────────────────────────────────────────────────────────
//   0  at least one candidate found
//   2  usage / argument error
//   3  eligible pool empty (no error — nothing to pick)
//   4  no Linear API key available
//   5  Linear API / network error
//   6  team or project could not be resolved (unknown or ambiguous name)

import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const MARK_START = '===PICK_RESULT_JSON===';
export const MARK_END = '===END_PICK_RESULT_JSON===';
const LINEAR_GQL = 'https://api.linear.app/graphql';

// ── pure selection logic (exported for unit testing) ────────────────────────

const FIX_NEEDED_RE = /^(fix-needed|needs-fix)$/;
/** True if a state NAME denotes "Fix needed" (case-insensitive, _/space → -). */
export function isFixNeededName(name) {
  return FIX_NEEDED_RE.test(String(name).trim().toLowerCase().replace(/[\s_]+/g, '-'));
}

export const PRIORITY_NAME = { 0: 'None', 1: 'Urgent', 2: 'High', 3: 'Medium', 4: 'Low' };
/** Sort rank for "priority DESC": Urgent(1)→0 … Low(4)→3, None(0)/unset→4 (last). */
export function priorityRank(p) {
  return p === 0 || p == null ? 4 : p - 1;
}

/**
 * Phase-1 state eligibility. Given the team's workflow states and an optional
 * `--status` name allow-list, returns the eligible state objects plus the set of
 * state ids that count as "fix-needed".
 */
export function computeEligibleStates(states, statusAllow = null) {
  const allow = statusAllow
    ? new Set([...statusAllow].map((s) => String(s).trim().toLowerCase()).filter(Boolean))
    : null;
  const eligible = states.filter((s) => {
    if (s.type === 'backlog') return false; // never
    if (allow) return allow.has(s.name.toLowerCase());
    return s.type === 'unstarted' || isFixNeededName(s.name);
  });
  const fixNeededIds = new Set(eligible.filter((s) => isFixNeededName(s.name)).map((s) => s.id));
  return { eligible, fixNeededIds };
}

/**
 * Resolve a `--project` needle to exactly one of the team's projects. Mirrors the
 * tolerant team resolution in run(): an exact (trimmed, case-insensitive) name
 * match wins; otherwise a UNIQUE case-insensitive prefix match; otherwise a
 * UNIQUE case-insensitive substring match (so "ACME" resolves "ACME - Kontingent").
 * Anything unmatched or ambiguous returns `{ project: null, error }` so the caller
 * can fail loudly (exit 6) instead of silently filtering the whole pool to empty —
 * a bare server-side `name: { eq }` matches nothing on a short alias, which is
 * indistinguishable from "no tickets" and this helper's most confusing failure.
 *
 * @param {{id:string,name:string}[]} projects  the team's projects
 * @param {string} needle                        the raw --project value
 * @returns {{ project: {id:string,name:string}|null, error: string|null }}
 */
export function resolveProject(projects, needle) {
  const list = (Array.isArray(projects) ? projects : []).filter((p) => p && p.name != null);
  const n = String(needle == null ? '' : needle).trim().toLowerCase();
  if (!n) return { project: null, error: 'empty --project value' };
  const norm = (p) => p.name.trim().toLowerCase();
  const available = () => (list.length ? list.map((p) => p.name).join(', ') : '(team has no projects)');

  const exact = list.filter((p) => norm(p) === n);
  if (exact.length) return { project: exact[0], error: null };

  const tiers = [
    ['prefix', list.filter((p) => norm(p).startsWith(n))],
    ['substring', list.filter((p) => norm(p).includes(n))],
  ];
  for (const [kind, hits] of tiers) {
    if (hits.length === 1) return { project: hits[0], error: null };
    if (hits.length > 1) {
      return { project: null, error: `ambiguous project "${needle}" — ${kind} matches: ${hits.map((p) => p.name).join(', ')}. Pass the exact name.` };
    }
  }
  return { project: null, error: `project not found: "${needle}" (available: ${available()})` };
}

/** Phase-1 assignee eligibility. `mode`: me+null (default) | me | null | any. */
export function filterByAssignee(rows, meId, mode = 'me+null') {
  const wantMe = mode === 'me' || mode === 'me+null';
  const wantNull = mode === 'null' || mode === 'me+null';
  if (mode === 'any') return rows.slice();
  return rows.filter((r) => {
    const aId = r.assignee ? r.assignee.id : null;
    if (aId === null) return wantNull;
    if (aId === meId) return wantMe;
    return false; // assigned to someone else → excluded
  });
}

/**
 * Phase-2 five-key ranking. Returns a new array of decorated candidates sorted
 * best-first. Input rows are Linear issue nodes; `fixNeededIds` is the set from
 * computeEligibleStates.
 */
export function rankCandidates(rows, meId, fixNeededIds) {
  const decorated = rows.map((r) => {
    const fixNeeded = fixNeededIds.has(r.state.id);
    const assignedToMe = !!(r.assignee && r.assignee.id === meId);
    const labels = (r.labels && r.labels.nodes) || [];
    const bug = labels.some((l) => l.name.toLowerCase() === 'bug' || l.name.toLowerCase().includes('bug'));
    return { r, fixNeeded, assignedToMe, bug };
  });
  decorated.sort((a, b) => {
    const pa = priorityRank(a.r.priority), pb = priorityRank(b.r.priority);
    if (pa !== pb) return pa - pb;                                          // 1. priority DESC
    if (a.fixNeeded !== b.fixNeeded) return a.fixNeeded ? -1 : 1;           // 2. fix-needed DESC (same-priority tiebreak)
    if (a.assignedToMe !== b.assignedToMe) return a.assignedToMe ? -1 : 1;  // 3. assigned-to-me DESC
    if (a.bug !== b.bug) return a.bug ? -1 : 1;                             // 4. bug DESC
    return new Date(a.r.createdAt) - new Date(b.r.createdAt);               // 5. createdAt ASC
  });
  return decorated;
}

const BLOCKED_RE = /(^|[^a-z])blocked([^a-z]|$)/;
/** True if a state NAME denotes a "Blocked" workflow state (case-insensitive). */
export function isBlockedName(name) {
  return BLOCKED_RE.test(String(name).trim().toLowerCase());
}

/**
 * Assess whether a Blocked issue is LIKELY no longer blocked, from its issue
 * relations alone. Direction-robust: a `blocks` relation whose `relatedIssue`
 * is this issue means the relation's `issue` blocks us (regardless of whether it
 * surfaced via relations or inverseRelations). Returns:
 *   { likelyUnblocked: true | false | null, reason, blockers: [{identifier,status,statusType}] }
 * `null` = undetermined from relations (no blocker relation on record) — the
 * block is only a status, so the caller must read description/comments for the
 * real reason before asking the user to release it.
 */
export function analyzeBlocked(issue) {
  const rels = [
    ...((issue.relations && issue.relations.nodes) || []),
    ...((issue.inverseRelations && issue.inverseRelations.nodes) || []),
  ];
  const seen = new Set();
  const blockers = [];
  for (const r of rels) {
    if (r.type !== 'blocks' || !r.issue || !r.relatedIssue) continue;
    if (r.relatedIssue.identifier !== issue.identifier) continue; // this issue is blocked BY r.issue
    if (seen.has(r.issue.identifier)) continue;
    seen.add(r.issue.identifier);
    blockers.push({
      identifier: r.issue.identifier,
      status: r.issue.state ? r.issue.state.name : 'unknown',
      statusType: r.issue.state ? r.issue.state.type : 'unknown',
    });
  }
  const DONE = new Set(['completed', 'canceled']);
  if (blockers.length === 0) {
    return {
      likelyUnblocked: null,
      reason: 'Keine Blocker-Relation hinterlegt — der Block ist nur als Status gesetzt. Grund in Beschreibung/Kommentaren prüfen.',
      blockers,
    };
  }
  const active = blockers.filter((b) => !DONE.has(b.statusType));
  if (active.length === 0) {
    return {
      likelyUnblocked: true,
      reason: `Alle Blocker erledigt: ${blockers.map((b) => `${b.identifier} (${b.status})`).join(', ')}.`,
      blockers,
    };
  }
  return {
    likelyUnblocked: false,
    reason: `Noch aktive Blocker: ${active.map((b) => `${b.identifier} (${b.status})`).join(', ')}.`,
    blockers,
  };
}

/**
 * Sort key for blocked candidates: likely-unblocked first, then undetermined, then priority, then oldest.
 * With the autopilot assessment (--base), releasable candidates come first instead, so the first
 * releasable one is also the highest-priority one.
 */
export function blockedSortKey(c) {
  const rank = c.autopilot
    ? (c.autopilot.releasable ? 0 : 1)
    : c.analysis.likelyUnblocked === true ? 0 : c.analysis.likelyUnblocked === null ? 1 : 2;
  return [rank, priorityRank(c.r.priority), new Date(c.r.createdAt).getTime()];
}

// ── autopilot: repository routing + blocker release (exported for unit testing) ──

const REPO_LINE_RE = /\*\*Repo:\*\*\s*(?:`([^`]+)`|[—–-]+\s*\(Inhalt\))/i;

/**
 * The target a ticket names in its `**Repo:**` line: `{ kind: 'repo', name, path }`, `{ kind: 'content' }`
 * for `**Repo:** — (Inhalt)`, or null when the description has no such line.
 */
export function repoLineOf(description) {
  const m = REPO_LINE_RE.exec(String(description || ''));
  if (!m) return null;
  if (!m[1]) return { kind: 'content' };
  const path = m[1].trim();
  return { kind: 'repo', path, name: repoNameFromRemote(path) };
}

/** Repository name from a remote URL or an `owner/name` path (last segment, no `.git`). */
export function repoNameFromRemote(remote) {
  const trimmed = String(remote || '').trim().replace(/[/\\]+$/, '').replace(/\.git$/i, '');
  return trimmed.split(/[/\\:]/).pop() || '';
}

/** Content work: label `Inhalt`, or a `**Repo:** — (Inhalt)` line. */
export function isContentIssue(issue) {
  const labels = ((issue.labels && issue.labels.nodes) || []).map((l) => String(l.name).toLowerCase());
  if (labels.includes('inhalt')) return true;
  const line = repoLineOf(issue.description);
  return !!(line && line.kind === 'content');
}

/** Autopilot candidacy: no Repo line, content work, or this repository. */
export function repoEligible(issue, repoName) {
  if (!repoName || isContentIssue(issue)) return true;
  const line = repoLineOf(issue.description);
  if (!line || line.kind !== 'repo') return true;
  return line.name.toLowerCase() === String(repoName).toLowerCase();
}

/** Splits rows into the candidates this repository may take and the ones another repository owns. */
export function filterByRepo(rows, repoName) {
  const kept = [];
  const skipped = [];
  for (const r of rows) {
    if (repoEligible(r, repoName)) kept.push(r);
    else skipped.push({ identifier: r.identifier, repo: repoLineOf(r.description).path });
  }
  return { kept, skipped };
}

function idPattern(identifier) {
  const esc = String(identifier).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${esc}(?![0-9])`, 'i');
}

function runGit(cwd, args) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
}

/** The ref the base branch is checked against: `origin/<base>` when it exists, else `<base>`. */
export function resolveBaseRef(cwd, base) {
  const candidates = base && base !== 'auto' ? [base] : ['dev', 'develop', 'main', 'master'];
  for (const b of candidates) {
    for (const ref of [`origin/${b}`, b]) {
      if (runGit(cwd, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]) !== null) return ref;
    }
  }
  return null;
}

/**
 * Whether Git shows a ticket merged into the base: a commit on `baseRef` whose message names the
 * identifier (squash subjects such as `DEV-3495: …`), or a remote branch carrying the identifier in
 * its name (`feature/dev-3495-…`) whose tip a merge commit on `baseRef` brought in as a non-first
 * parent. `git branch --merged` is not enough: a branch pushed before its first commit has a base
 * commit as its tip and counts as merged there while the ticket has no code on the base yet.
 * Returns `{ merged, evidence }`.
 */
export function mergedInBase(identifier, { cwd = process.cwd(), baseRef }) {
  if (!baseRef) return { merged: false, evidence: 'kein Basis-Branch gefunden' };
  const re = idPattern(identifier);
  const log = runGit(cwd, ['log', baseRef, '-i', '-F', `--grep=${identifier}`, '--format=%h%x00%B%x1e']);
  for (const entry of (log || '').split('\x1e')) {
    const [hash, body] = entry.split('\x00');
    if (hash && body && re.test(body)) return { merged: true, evidence: `Commit ${hash.trim()} auf ${baseRef}` };
  }
  const mergedTips = new Set();
  for (const line of (runGit(cwd, ['rev-list', '--merges', '--parents', baseRef]) || '').split('\n')) {
    for (const parent of line.trim().split(' ').slice(2)) mergedTips.add(parent);
  }
  const branches = runGit(cwd, ['for-each-ref', '--format=%(objectname) %(refname:short)', 'refs/remotes']);
  for (const row of (branches || '').split('\n').map((x) => x.trim()).filter(Boolean)) {
    const [tip, name] = row.split(' ');
    if (name && re.test(name) && mergedTips.has(tip)) return { merged: true, evidence: `Branch ${name} in ${baseRef} gemergt` };
  }
  return { merged: false, evidence: `kein Commit und kein gemergter Branch zu ${identifier} auf ${baseRef}` };
}

function blockersOf(issue) {
  const rels = [
    ...((issue.relations && issue.relations.nodes) || []),
    ...((issue.inverseRelations && issue.inverseRelations.nodes) || []),
  ];
  const seen = new Set();
  const out = [];
  for (const r of rels) {
    if (r.type !== 'blocks' || !r.issue || !r.relatedIssue) continue;
    if (r.relatedIssue.identifier !== issue.identifier) continue;
    if (seen.has(r.issue.identifier)) continue;
    seen.add(r.issue.identifier);
    out.push(r.issue);
  }
  return out;
}

/**
 * Autopilot release of a Blocked ticket (ticket-cycle `--autopilot`): never without a blocker
 * relation; every blocker Done/Canceled, or a code ticket of this repository that Git shows merged
 * into the base. `isMerged(identifier)` returns `{ merged, evidence }` (see mergedInBase).
 */
export function assessAutopilotRelease(issue, { repoName, isMerged }) {
  const blockers = blockersOf(issue);
  if (blockers.length === 0) {
    return { releasable: false, reason: 'Keine Blocker-Relation hinterlegt: der Autopilot gibt nur über Relationen frei.', blockers: [] };
  }
  const DONE = new Set(['completed', 'canceled']);
  const verdicts = blockers.map((b) => {
    const state = b.state || {};
    if (DONE.has(state.type)) return { identifier: b.identifier, ok: true, why: `${state.name || state.type}` };
    if (isContentIssue(b)) return { identifier: b.identifier, ok: false, why: 'Inhalts-Ticket, zählt nur mit Done' };
    const line = repoLineOf(b.description);
    if (line && line.kind === 'repo' && repoName && line.name.toLowerCase() !== String(repoName).toLowerCase()) {
      return { identifier: b.identifier, ok: false, why: `Repository ${line.path}, zählt nur mit Done` };
    }
    const m = isMerged(b.identifier);
    return { identifier: b.identifier, ok: m.merged, why: m.merged ? `gemergt (${m.evidence})` : `${state.name || 'offen'}, ${m.evidence}` };
  });
  const releasable = verdicts.every((v) => v.ok);
  const reason = verdicts.map((v) => `${v.identifier}: ${v.why}`).join('; ');
  return { releasable, reason: `${releasable ? 'Freigebbar' : 'Nicht freigebbar'}: ${reason}`, blockers: verdicts };
}

// ── CLI plumbing ────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const out = {
    team: null, project: null, status: null, assignee: 'me+null',
    descCount: 3, limit: 250, json: false, help: false, blocked: false,
    repo: null, base: null,
  };
  const setKV = (k, v) => {
    if (k === 'team') out.team = v;
    else if (k === 'project') out.project = v;
    else if (k === 'status') out.status = v;
    else if (k === 'assignee') out.assignee = v;
    else if (k === 'desc-count') out.descCount = parseInt(v, 10);
    else if (k === 'limit') out.limit = parseInt(v, 10);
    else if (k === 'repo') out.repo = v;
    else if (k === 'base') { out.base = v; out.blocked = true; }
    else die(2, `Unknown flag: --${k}`);
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') { out.help = true; }
    else if (a === '--json') { out.json = true; }
    else if (a === '--blocked') { out.blocked = true; }
    else if (a.startsWith('--') && a.includes('=')) {
      const [k, v] = a.slice(2).split(/=(.*)/s);
      setKV(k, v);
    } else if (a.startsWith('--')) {
      setKV(a.slice(2), argv[++i]);
    } else {
      die(2, `Unexpected argument: ${a}`);
    }
  }
  return out;
}

function die(code, msg) {
  process.stderr.write(`pick-next-ticket: ${msg}\n`);
  process.exit(code);
}

function resolveToken() {
  if (process.env.LINEAR_API_KEY && process.env.LINEAR_API_KEY.trim()) {
    return process.env.LINEAR_API_KEY.trim();
  }
  try {
    const key = execFileSync('security', ['find-generic-password', '-s', 'linear-api', '-w'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (key) return key;
  } catch { /* not on macOS or not set — fall through */ }
  return null;
}

async function gql(token, query, variables = {}) {
  let res;
  try {
    res = await fetch(LINEAR_GQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: token },
      body: JSON.stringify({ query, variables }),
    });
  } catch (e) {
    die(5, `network error talking to Linear: ${e.message}`);
  }
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { die(5, `non-JSON response from Linear (HTTP ${res.status}): ${text.slice(0, 300)}`); }
  if (body.errors) die(5, `Linear GraphQL error: ${JSON.stringify(body.errors).slice(0, 500)}`);
  if (!res.ok) die(5, `Linear HTTP ${res.status}`);
  return body.data;
}

function emit(pool, candidates, args, blocked = null) {
  if (!args.json) {
    const p = pool.project ? ` · project "${pool.project}"${pool.projectInput ? ` (matched "${pool.projectInput}")` : ''}` : '';
    process.stdout.write(`Team ${pool.team.key} (${pool.team.name})${p} · viewer ${pool.viewer.name} · eligible states: ${pool.eligibleStates.map((s) => s.name + (s.fixNeeded ? '*' : '')).join(', ')}\n`);
    if (candidates.length === 0) {
      process.stdout.write('No eligible candidates (Open/Fix-needed, mine-or-unassigned).\n');
    } else {
      process.stdout.write(`\n  # ${'ID'.padEnd(10)}${'STATUS'.padEnd(12)}${'PRIO'.padEnd(8)}${'ASG'.padEnd(5)}${'BUG'.padEnd(5)}${'CREATED'.padEnd(12)}TITLE\n`);
      for (const c of candidates) {
        process.stdout.write(
          `${String(c.rank).padStart(3)} ${c.identifier.padEnd(10)}${c.status.padEnd(12)}${c.priorityName.padEnd(8)}` +
          `${(c.assignedToMe ? 'me' : '—').padEnd(5)}${(c.bug ? '🐞' : '—').padEnd(5)}${c.createdAt.slice(0, 10).padEnd(12)}${c.title.slice(0, 64)}\n`,
        );
      }
      process.stdout.write('\n');
    }
    if (blocked && blocked.candidates.length) {
      process.stdout.write(`Blocked column "${blocked.state}" — needs EXPLICIT user release before it may be picked:\n`);
      for (const c of blocked.candidates) {
        const tag = c.likelyUnblocked === true ? '✅ likely unblocked' : c.likelyUnblocked === null ? '❔ undetermined' : '⛔ still blocked';
        process.stdout.write(`  • ${c.identifier} [${c.priorityName}] ${tag} — ${c.reason}\n`);
      }
      process.stdout.write('\n');
    }
  }
  const payload = { pool, top: candidates[0] || null, candidates };
  if (blocked) payload.blocked = blocked;
  process.stdout.write(`${MARK_START}\n${JSON.stringify(payload, null, 2)}\n${MARK_END}\n`);
}

async function run(args, token) {
  // Query A — viewer + teams (minimal), to resolve current user and team id.
  const A = await gql(token, `query { viewer { id name email } teams(first: 250) { nodes { id key name } } }`);
  const meId = A.viewer.id;
  const teamNeedle = args.team.trim().toLowerCase();
  const team = A.teams.nodes.find(
    (t) => t.key.toLowerCase() === teamNeedle || t.name.toLowerCase() === teamNeedle,
  ) || A.teams.nodes.find((t) => t.name.toLowerCase().includes(teamNeedle));
  if (!team) die(6, `team not found: "${args.team}" (available: ${A.teams.nodes.map((t) => t.key).join(', ')})`);

  // Query B — the team's workflow states (+ its projects when --project is set),
  // to compute the eligible state-id set and resolve the project scope.
  const B = await gql(
    token,
    `query($id: String!) { team(id: $id) { states(first: 100) { nodes { id name type } }${args.project ? ' projects(first: 250) { nodes { id name } }' : ''} } }`,
    { id: team.id },
  );
  const statusAllow = args.status ? args.status.split(',') : null;
  const { eligible: eligibleStates, fixNeededIds } = computeEligibleStates(B.team.states.nodes, statusAllow);
  if (eligibleStates.length === 0) {
    die(6, `no eligible states resolved for team ${team.key}` + (args.status ? ` matching --status="${args.status}"` : ''));
  }

  // Resolve --project tolerantly against the team's projects and scope by its ID.
  // A bare `name: { eq }` matches nothing on a short alias ("ACME" vs the real
  // "ACME - Kontingent"), which then reads exactly like an empty pool — so fail
  // loudly (exit 6) on an unknown/ambiguous name instead.
  let resolvedProject = null;
  if (args.project) {
    const { project, error } = resolveProject((B.team.projects && B.team.projects.nodes) || [], args.project);
    if (!project) die(6, error);
    resolvedProject = project;
  }

  // --repo auto → the repository this checkout belongs to.
  let repoName = null;
  if (args.repo) {
    repoName = args.repo === 'auto' ? repoNameFromRemote(runGit(process.cwd(), ['remote', 'get-url', 'origin'])) : args.repo;
    if (!repoName) die(2, '--repo auto: no `origin` remote in the current directory; pass --repo <name>');
  }

  // Query C — candidate issues, minimal fields only (description only for the --repo filter).
  const filter = { team: { id: { eq: team.id } }, state: { id: { in: eligibleStates.map((s) => s.id) } } };
  if (resolvedProject) filter.project = { id: { eq: resolvedProject.id } };
  const C = await gql(token, `
    query($filter: IssueFilter!, $limit: Int!) {
      issues(filter: $filter, first: $limit) {
        nodes {
          id identifier title createdAt url priority
          state { id name type }
          assignee { id }
          labels(first: 30) { nodes { name } }
          project { name }${repoName ? '\n          description' : ''}
        }
      }
    }`, { filter, limit: args.limit });

  let issueRows = C.issues.nodes;
  let skippedForeignRepo;
  if (repoName) {
    const split = filterByRepo(issueRows, repoName);
    issueRows = split.kept;
    skippedForeignRepo = split.skipped;
  }
  const eligibleRows = filterByAssignee(issueRows, meId, args.assignee);
  const decorated = rankCandidates(eligibleRows, meId, fixNeededIds);

  const pool = {
    team: { id: team.id, key: team.key, name: team.name },
    project: resolvedProject ? resolvedProject.name : null,
    // Raw --project alias, surfaced only when it differs from the resolved name,
    // so the caller/user can see "ACME" actually resolved "ACME - Kontingent".
    projectInput: resolvedProject && resolvedProject.name !== args.project ? args.project : undefined,
    viewer: { id: meId, name: A.viewer.name, email: A.viewer.email },
    eligibleStates: eligibleStates.map((s) => ({ name: s.name, type: s.type, fixNeeded: fixNeededIds.has(s.id) })),
    assigneeMode: args.assignee,
    candidateCount: decorated.length,
    repoFilter: repoName || undefined,
    skippedForeignRepo,
  };

  // Optional (--blocked): surface Blocked-column tickets whose blockers look
  // resolved, so the caller can offer them when the primary pool is empty. Run
  // this BEFORE the empty-pool exit — that is exactly when it matters.
  let blocked = null;
  if (args.blocked) {
    blocked = await fetchBlocked(token, {
      team, project: resolvedProject, states: B.team.states.nodes,
      meId, assignee: args.assignee, descCount: args.descCount, limit: args.limit,
      repoName, base: args.base,
    });
  }

  // Query D — descriptions for the top N candidates (one aliased round-trip).
  const topN = Math.max(0, Math.min(args.descCount, decorated.length));
  const descById = {};
  if (topN > 0) {
    const aliases = decorated.slice(0, topN)
      .map((d, i) => `i${i}: issue(id: "${d.r.id}") { id description }`)
      .join(' ');
    const D = await gql(token, `query { ${aliases} }`);
    for (const k of Object.keys(D)) if (D[k]) descById[D[k].id] = D[k].description || '';
  }

  const candidates = decorated.map((d, idx) => ({
    rank: idx + 1,
    identifier: d.r.identifier,
    title: d.r.title,
    priority: d.r.priority,
    priorityName: PRIORITY_NAME[d.r.priority] ?? String(d.r.priority),
    status: d.r.state.name,
    statusType: d.r.state.type,
    fixNeeded: d.fixNeeded,
    assignedToMe: d.assignedToMe,
    bug: d.bug,
    createdAt: d.r.createdAt,
    project: d.r.project ? d.r.project.name : null,
    url: d.r.url,
    description: d.r.id in descById ? descById[d.r.id] : undefined,
  }));

  emit(pool, candidates, args, blocked);
  process.exit(decorated.length === 0 ? 3 : 0);
}

/**
 * Fetch + analyse the team's Blocked column. Returns { state, candidates } where
 * each candidate carries the blocker analysis (likelyUnblocked + reason). Sorted
 * likely-unblocked first. Fetches descriptions for the top N (so the caller can
 * explain the "undetermined" cases without a follow-up call).
 */
async function fetchBlocked(token, { team, project, states, meId, assignee, descCount, limit, repoName, base }) {
  const blockedStates = states.filter((s) => s.type !== 'backlog' && isBlockedName(s.name));
  if (blockedStates.length === 0) return { state: null, candidates: [] };

  const filter = { team: { id: { eq: team.id } }, state: { id: { in: blockedStates.map((s) => s.id) } } };
  if (project) filter.project = { id: { eq: project.id } };
  const blockerSel = base
    ? 'identifier state { name type } description labels(first: 20) { nodes { name } }'
    : 'identifier state { name type }';
  const relSel = `nodes { type issue { ${blockerSel} } relatedIssue { identifier state { name type } } }`;
  const E = await gql(token, `
    query($filter: IssueFilter!, $limit: Int!) {
      issues(filter: $filter, first: $limit) {
        nodes {
          id identifier title createdAt url priority
          state { id name type }
          assignee { id }
          relations(first: 20) { ${relSel} }
          inverseRelations(first: 20) { ${relSel} }${repoName ? '\n          description labels(first: 30) { nodes { name } }' : ''}
        }
      }
    }`, { filter, limit });

  let rows = filterByAssignee(E.issues.nodes, meId, assignee);
  if (repoName) rows = filterByRepo(rows, repoName).kept;
  const baseRef = base ? resolveBaseRef(process.cwd(), base) : null;
  const analysed = rows.map((r) => ({
    r,
    analysis: analyzeBlocked(r),
    autopilot: base
      ? assessAutopilotRelease(r, { repoName, isMerged: (id) => mergedInBase(id, { baseRef }) })
      : undefined,
  }));
  analysed.sort((a, b) => {
    const ka = blockedSortKey(a), kb = blockedSortKey(b);
    for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] - kb[i];
    return 0;
  });

  const topN = Math.max(0, Math.min(descCount, analysed.length));
  const descById = {};
  if (topN > 0) {
    const aliases = analysed.slice(0, topN).map((d, i) => `b${i}: issue(id: "${d.r.id}") { id description }`).join(' ');
    const D = await gql(token, `query { ${aliases} }`);
    for (const k of Object.keys(D)) if (D[k]) descById[D[k].id] = D[k].description || '';
  }

  const candidates = analysed.map((d, idx) => ({
    rank: idx + 1,
    identifier: d.r.identifier,
    title: d.r.title,
    priority: d.r.priority,
    priorityName: PRIORITY_NAME[d.r.priority] ?? String(d.r.priority),
    status: d.r.state.name,
    createdAt: d.r.createdAt,
    url: d.r.url,
    likelyUnblocked: d.analysis.likelyUnblocked,
    reason: d.analysis.reason,
    blockers: d.analysis.blockers,
    autopilot: d.autopilot,
    description: d.r.id in descById ? descById[d.r.id] : undefined,
  }));
  return { state: blockedStates.map((s) => s.name).join('/'), baseRef: baseRef || undefined, candidates };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write('See the header of pick-next-ticket.mjs for full usage.\n');
    process.exit(0);
  }
  if (!args.team) die(2, 'missing required --team <key|name>');
  const token = resolveToken();
  if (!token) {
    die(4, [
      'no Linear API key found.',
      'Provide one of:',
      '  • export LINEAR_API_KEY=lin_api_xxx',
      "  • security add-generic-password -a \"$USER\" -s linear-api -w 'lin_api_xxx'",
      'Create the key at: Linear → Settings → Security & access → Personal API keys',
    ].join('\n'));
  }
  run(args, token).catch((e) => die(5, e.stack || String(e)));
}

// Only run the CLI when executed directly — importing for tests must not fire it.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
