#!/usr/bin/env node
// Side-by-side table for a paired comparison (see README, "Paired comparison for rule and text changes").
//
//   node compare-arms.mjs <main-dir> <candidate-dir>
//
// Each directory is searched recursively for aggregate-result.json files (one per `claude plugin eval` call), and
// the runs of every case are pooled per arm. Prints, per case: runs, mean score, every grader's pass count, mean
// duration and cost, and run errors. Exit code 1 when a case or grader exists in only one arm, or the arms ran on
// different models or judges, because then the comparison is not like for like. Dependency-free (Node 18+).

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function resultFiles(dir) {
  if (!existsSync(dir)) {
    console.error(`compare-arms: ${dir} does not exist`);
    process.exit(2);
  }
  if (statSync(dir).isFile()) {
    return [dir];
  }
  return readdirSync(dir, { recursive: true })
    .filter((entry) => String(entry).endsWith('aggregate-result.json'))
    .map((entry) => join(dir, String(entry)));
}

function collect(dir) {
  const cases = new Map();
  const models = new Set();
  const judges = new Set();
  for (const file of resultFiles(dir)) {
    const result = JSON.parse(readFileSync(file, 'utf8'));
    if (result.partial) {
      console.warn(`compare-arms: ${file} is partial (${result.partialReason}); its runs are included`);
    }
    models.add(result.suite?.modelOverride ?? 'case default');
    judges.add(result.suite?.judgeModel ?? 'default');
    for (const caseResult of result.cases ?? []) {
      const entry = cases.get(caseResult.name) ?? { runs: [] };
      entry.runs.push(...(caseResult.arms?.with ?? []));
      cases.set(caseResult.name, entry);
    }
  }
  return { cases, judges, models };
}

function summarize(entry) {
  const runs = entry?.runs ?? [];
  const graders = new Map();
  for (const run of runs) {
    for (const grader of run.graders ?? []) {
      const counts = graders.get(grader.name) ?? { passed: 0, total: 0 };
      counts.total++;
      counts.passed += grader.passed ? 1 : 0;
      graders.set(grader.name, counts);
    }
  }
  const mean = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : NaN);
  return {
    cost: mean(runs.map((run) => run.costUsd ?? 0)),
    duration: mean(runs.map((run) => run.durationSeconds ?? 0)),
    errors: runs.filter((run) => run.error).map((run) => run.error),
    graders,
    runs: runs.length,
    score: mean(runs.map((run) => run.score ?? 0)),
  };
}

const [mainDir, candidateDir] = process.argv.slice(2);
if (!mainDir || !candidateDir) {
  console.error('usage: node compare-arms.mjs <main-dir> <candidate-dir>');
  process.exit(2);
}
const main = collect(mainDir);
const candidate = collect(candidateDir);
let mismatch = false;
for (const key of ['models', 'judges']) {
  const a = [...main[key]].join(', ');
  const b = [...candidate[key]].join(', ');
  console.log(`${key.padEnd(7)} main: ${a} | candidate: ${b}`);
  if (a !== b) {
    console.log(`  not like for like: the arms used different ${key}`);
    mismatch = true;
  }
}
const names = [...new Set([...main.cases.keys(), ...candidate.cases.keys()])].sort();
for (const name of names) {
  const a = summarize(main.cases.get(name));
  const b = summarize(candidate.cases.get(name));
  console.log(`\n${name}`);
  if (!a.runs || !b.runs) {
    console.log(`  only in ${a.runs ? 'main' : 'candidate'}`);
    mismatch = true;
    continue;
  }
  const row = (label, left, right) => console.log(`  ${label.padEnd(28)} ${String(left).padStart(10)}  ${String(right).padStart(10)}`);
  row('', 'main', 'candidate');
  row('runs', a.runs, b.runs);
  row('mean score', a.score.toFixed(2), b.score.toFixed(2));
  for (const grader of [...new Set([...a.graders.keys(), ...b.graders.keys()])].sort()) {
    const left = a.graders.get(grader);
    const right = b.graders.get(grader);
    if (!left || !right) {
      mismatch = true;
    }
    const delta = left && right && left.passed / left.total !== right.passed / right.total ? '  <-' : '';
    row(grader, left ? `${left.passed}/${left.total}` : '-', `${right ? `${right.passed}/${right.total}` : '-'}${delta}`);
  }
  row('mean duration (s)', a.duration.toFixed(0), b.duration.toFixed(0));
  row('mean cost (USD)', a.cost.toFixed(2), b.cost.toFixed(2));
  if (a.errors.length || b.errors.length) {
    row('run errors', a.errors.length, b.errors.length);
  }
}
process.exit(mismatch ? 1 : 0);
