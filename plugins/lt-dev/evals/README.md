# lt-dev eval suite

Measures what lt-dev does on the current default model instead of assuming it. Run with `claude plugin eval`
(Claude Code 2.1.280 or newer for Opus 5.5), from the repository root:

```bash
# Skill triggering: does the right skill fire on natural phrasing? One arm, no baseline needed.
claude plugin eval plugins/lt-dev --tag trigger --ablation none --trust-plugin --no-publish -j 4

# Output quality with and without the plugin (the Δ column is what lt-dev contributes).
claude plugin eval plugins/lt-dev --tag quality --allow-tools Write Edit --judge-model sonnet --trust-plugin --no-publish -j 4

# Multi-step agent work (slow: minutes per run). Run it when agents or their effort policy change.
# Its judge-scored graders review security logic, so use a strong judge.
claude plugin eval plugins/lt-dev --tag agent --scaffold --allow-tools Write Edit --judge-model claude-opus-5-5 --trust-plugin --no-publish -j 2

# Judge self-test: do the judge-scored rubrics tell a good reference output from a bad one? Run it with the judge the
# measurement uses, before trusting a new or changed rubric (see "Judge self-test" below).
node plugins/lt-dev/evals/selftest/selftest.mjs sync
claude plugin eval plugins/lt-dev --tag selftest --scaffold --ablation none --judge-model claude-opus-5-5 --trust-plugin --no-publish -j 2
node plugins/lt-dev/evals/selftest/selftest.mjs verify

# Effort comparison: the environment variable overrides session and frontmatter effort for every run,
# subagents included. Swap `--tag quality` for `--tag agent` to compare on agent work.
CLAUDE_CODE_EFFORT_LEVEL=medium claude plugin eval plugins/lt-dev --tag quality --allow-tools Write Edit --judge-model sonnet --trust-plugin --no-publish -j 4
CLAUDE_CODE_EFFORT_LEVEL=high   claude plugin eval plugins/lt-dev --tag quality --allow-tools Write Edit --judge-model sonnet --trust-plugin --no-publish -j 4
```

Pass `--model <id>` to pin the model when comparing runs over time. Every run and every `llm` grader is a real model
call that counts against the plan's usage; `--max-cost-usd` caps the list-price estimate of a run.

## Cases

| Group | Case | Measures |
|---|---|---|
| `trigger/` | `nest-module`, `nuxt-form`, `tdd-story`, `npm-audit`, `rebase-branch`, `lt-cli-init`, `unslop-readme`, `frontend-security`, `turboops-deploy`, `upstream-workaround`, `disk-cleanup` | The named skill (or its command) is invoked for a German or English request that does not name it |
| `trigger/` | `ci-pipeline-local`, `k6-load-test`, `framework-local-link`, `toolchain-migration`, `production-readiness`, `stack-release`, `browser-walk` | The same for the skills that no other detector names and no command loads on its own; `detect-skill-keywords.sh` names them in interactive sessions, so these cases measure what their descriptions reach without that hook |
| `trigger/` | `nest-server-update` | Boundary: a nest-server upgrade goes to `nest-server-updating`, not generic npm maintenance |
| `trigger/` | `briefing` | "Was ist noch offen, was muss ich selbst tun?" invokes `/lt-dev:briefing` instead of a retelling from memory |
| `trigger/` | `unrelated-question` | Boundary: an unrelated question fires no lt-dev skill |
| `quality/` | `nest-model` | A model written to lt conventions: `@UnifiedField`, `@Restricted`, `RoleEnum.ADMIN`, `securityCheck`, and the project base `PersistenceModel` that `lt server module` generates |
| `quality/` | `nuxt-form-component` | A form component written to lt conventions: Valibot, `<UForm>`, `<script setup lang="ts">` |
| `quality/` | `unslop-copy` | A prose rewrite without AI tells that keeps every fact |
| `quality/` | `nuxt-landing-design` | A landing page without a design mockup stays on Nuxt UI page components and semantic colors, free of the model's default styles |
| `quality/` | `nuxt-landing-custom-design` | The same page with an explicit request for a distinctive look of its own, where the model writes its own Tailwind and its default styles show up |
| `agent/` | `nest-module-agent` | Multi-step agent work: the `backend-dev` agent builds a complete module (model, service, controller, inputs) to the conventions the `lt server module` generator produces |
| `agent/` | `nuxt-feature-agent` | The `frontend-dev` agent builds a list page and a create modal against generated API types (`types.gen.ts`, `sdk.gen.ts`): Valibot, `UForm`, `useOverlay`, semantic colors, loading/empty/error states |
| `agent/` | `code-review-agent` | The `code-reviewer` agent reviews a commit with five seeded defects (public write endpoints, `$where` injection, purchase price leak, wrong discount formula, missing tests); judge-scored recall plus a false-alarm check |
| `agent/` | `code-review-subtle-agent` | The harder sibling: five subtle defects (stock race under concurrency, regex from user input, 1-based pagination offset, `createdBy` writable by users, ObjectId compared to a string), so a level that finds more has room to show it |
| `agent/` | `vibe-plan-agent` | `/lt-dev:vibe:plan` turns an unambiguous SPEC.md into IMPLEMENTATION_PLAN.md; judge-scored planning depth (ownership, concurrent overlap, transitions, idempotent reminders, UTC) |
| `agent/` | `code-review-blast-radius-agent` | `/lt-dev:review` itself, on a 16-line diff that turns `PricingService.grossPrice` from euros into cents. The only defect sits in an untouched file: `CartService.checkout` converts to cents a second time and charges 100 times the price. Judge-scored: the broken caller is reported as a finding, the unaffected `CatalogService` caller appears as checked, and three decoys in the diff (the name `amt`, a deprecated call, a direct Model access carrying the Informed-Trade-off comment) are not reported as findings |
| `agent/` | `bugfix-shared-helper-agent` | Root-cause bug fixing (the trace-transfer pattern): the report names transfers only, but `transfer()` and `redeem()` both debit through one unchecked private `debit()`. Judge-scored on the service file: the named path is guarded, the unnamed sibling is guarded (weight 2), the guard sits once in the shared helper; plus a regression test in the module's API test file |
| `agent/` | `overbuild-date-field-agent` | Over-building: "add a due date with a date picker" to an existing task form, in an app that already has a `FormDateField` component and `formatDate`/`todayIsoDate` utils. Regex-scored: no new dependency, no new date, calendar or picker file, `FormDateField` reused, the form stays under 131 lines (91 before), the list shows the date through `formatDate`; judge-scored: the field is complete (prefill, nullable schema with a not-in-the-past check, create and update payload) |
| `selftest/` | 15 cases, tag `selftest` | Judge self-test: the rubrics of the three code-review cases and the judge-scored rubrics of the bug-fix and over-build cases, each replayed on a good and on bad reference outputs with the verdict every rubric must reach |

## Reading the results

- Trigger cases stop at a low turn cap on purpose, so "Reached maximum number of turns" in NOTES is expected; the
  score comes from the `skill-fired` grader alone.
- Eval runs are headless, so lt-dev's `UserPromptSubmit` detectors skip themselves and only one plugin is loaded. The
  trigger score is therefore the floor that skill descriptions reach on their own, in a listing with far less
  competition than a machine with several plugins installed.
- A quality case with `Δ` near zero means the model already does it without lt-dev; a negative `Δ` points at the
  skill or at a grader that encodes the wrong convention.
- The `agent` cases seed trimmed starter projects (`fixture/`, run with `--scaffold`). In an empty workspace an agent
  sometimes builds and sometimes stops to ask for the project, which swamps any quality signal.
- `nest-module-agent/fixture`, which five more cases build on, is a verbatim copy of nest-server-starter files at a
  release tag (`v12.0.0`: ES modules). Refresh it file by file with `git show <tag>:<path>`, keep every relative import
  in the cases' own files on `.js`, and typecheck each case laid over a full checkout of that tag: errors may sit only
  in the planted defects. Runs from before a refresh measured another project and compare only with each other.
- `code-review-agent` hands the commit over as `REVIEW.diff` as well: an eval run cannot grant `Bash` on a machine
  whose Docker config holds symlinks (Docker Desktop's `cli-plugins` do), and the comparison needs both effort levels
  to see the change the same way.
- Many parallel runs share one credential. A run that fails with `401 OAuth access token has been revoked` hit a token
  refresh and says nothing about the plugin; rerun that level with lower `-j` (observed 2026-09-25 with about eight
  concurrent runs).
- Its judge rubrics state the lt permission semantics (class-level `@Restricted` is a fallback, field and method
  decisions override it); without them a judge fails correct code.
- A full `/lt-dev:review` run cannot be evaluated here: its git and check-script steps and the provenance script need
  `Bash`, Phase 3B and Phase 7 need the Chrome DevTools server (eval runs start no real MCP server), Phase 6 writes
  fixes, Phase 7 ends at an interactive gate, and the parallel fleet costs five reviewers per run.
  `code-review-blast-radius-agent` therefore keeps its diff under the command's small-diff threshold (fewer than 20
  changed lines, at most 2 files): the command then reads its own bar, spawns one `code-reviewer` with it, gates
  the findings and writes the Phase 5 report, while the prompt skips Phases 6 and 7.
  Everything that decides the outcome comes from the plugin under test, so a main-versus-candidate comparison
  measures a change to `review.md` itself. Raise the case's diff past the threshold, or move the threshold, and it
  measures the parallel path instead at about five times the cost.
- The bug-fix and over-build graders read the files a run leaves behind: `Bash`, and with it any test run, is
  unavailable, and an `llm` judge on `trace` sees only the first and last 12 messages. The trace does carry the
  subagent's tool calls (marked with `parent_tool_use_id`, observed 2026-10-17), so the `files` target of
  `no-new-date-code` sees files the `frontend-dev` agent creates. `regression-test` reads
  `tests/modules/credit-account.e2e-spec.ts`, the file the fixture already has; a fix whose test lands in a new file
  fails it, which the run's report shows.

Results land in `evals/results/`, which is git-ignored.

## Reference measurement (2026-09-25, `claude-opus-5-5`; 3 runs per case and arm with judge `sonnet` unless a row says otherwise)

Compare new runs against these; a drop is a finding.

| Suite | Result |
|---|---|
| `trigger` | 12/12 cases at 1.00 after `nest-server-updating` got German trigger phrases (it scored 0.67 before) |
| `quality`, effort `medium` | with plugin 1.00 on all three cases; Δ +0.11 `nest-model` (the bare model omits `@UnifiedField`), 0.00 `nuxt-form-component`, 0.00 `unslop-copy` |
| `quality`, effort `high` | with plugin 1.00 / 1.00 / 0.89, no gain over `medium`, 30-50 % longer runs |
| `agent`, effort `medium` (5 runs, judge `claude-opus-5-5`) | 0.98; judge-scored permission logic 5/5; one run deviated from the generator's input inheritance; 165-180 s per run |
| `agent`, effort `high` (5 runs, same judge) | 0.94; judge-scored permission logic 5/5; `ProductCreateInput` did not extend `ProductInput` in 5/5; 211-261 s per run. Result: `backend-dev` runs unpinned |
| `nuxt-feature-agent`, `medium` / `high` (5 runs each, judge `claude-opus-5-5`) | 1.00 / 1.00, including the judge-scored page states and form logic; 112-154 s / 220-254 s. Result: `frontend-dev` runs unpinned |
| `code-review-agent`, `medium` / `xhigh` (5 runs each) | 1.00 / 1.00: every seeded defect found, no false alarm; 155-177 s / 355-443 s |
| `code-review-subtle-agent`, `medium` / `xhigh` (5 runs each) | 1.00 / 1.00: every subtle defect named in every report (checked in the reports, not only by the judge), `xhigh` reports about 1.5 times as long; 167-198 s / 511-704 s. Result: `code-reviewer` and `/lt-dev:review` run unpinned |
| `vibe-plan-agent`, `medium` / `xhigh` (4 runs each) | `medium` 1.00 in 4/4, 409-501 s; `xhigh`: 3 of 4 runs hit the 1500 s timeout, the fourth scored 1.00 at 1502 s with a plan twice as long. Result: `/lt-dev:vibe:plan`, `vibe:build-plan` and `architect` run unpinned |
| `nuxt-landing-design` (3 runs per arm) | 1.00 with and without lt-dev: on Nuxt UI page components none of the model's default styles appear |
| `nuxt-landing-custom-design` (4 runs per arm) | without lt-dev 8 of 10 default-style checks fail; before the "Design Without a Mockup" list lt-dev still let monospace labels through in 4/4; with the list 1.00 in 4/4 and no replacement pattern in the traces |
| `code-review-blast-radius-agent`, `bugfix-shared-helper-agent`, `overbuild-date-field-agent` (2026-10-17, 5 runs, judge `claude-opus-5-5`) | 1.00 each on main: every review names the broken `CartService` caller although it sits outside the diff, every fix guards the shared `debit()` once, every date field reuses `FormDateField`; 145 s, 192 s and 96 s per run. Opus 5.5 with lt-dev does these by itself, so a rule aimed at them has no headroom to show |
| `selftest` (2026-10-17, judge `claude-opus-5-5`, 1 run per reference) | 73 of 73 verdicts as expected; the 69 judge-scored ones by three unanimous votes, the 4 regex ones deterministic: all 15 references across the three code-review cases, the bug-fix case and the over-build case, including the near misses (right line, wrong problem) and the transfer-only fix; 167 s and $2.85 for the suite |

The plugin's measurable contribution is lt-specific convention (decorators, base classes); generic practice such as
Valibot forms or plain prose the model already follows unaided. The `quality` graders check that conventions are
*present*, not that the logic is right, so equal scores there are not evidence of equal quality. Effort and model
choices are decided on the `agent` cases, whose judge-scored graders check the logic itself (quality first, speed only
as a tiebreaker). On Opus 5.5 every `agent` case scored the same at `medium` as at `high` or `xhigh`, which is why no
lt-dev agent or command pins an effort level; a case that scores 1.0 at both levels cannot show a gain, so a new case
needs defects or requirements that leave headroom.

## Judge self-test

A judge-scored rubric is a scorer, and a scorer earns trust only by classifying known outputs correctly. A rubric that
passes a near miss inflates every score built on it, and one that fails a correct answer hides a real gain. So every
`llm` rubric of the code-review cases, and the judge-scored rubrics of the bug-fix and over-build cases, is replayed on
fixed reference outputs before its verdict counts:

- Each case under `selftest/` holds one reference: a good report or file and bad ones (a near miss that looks at the
  right lines but names the wrong problem or rates it minor, a report with false alarms at High, a fix that guards
  only the reported path, a hand-built date picker). Its `selftest.json` names the measured case, the reference files
  and the verdict each rubric must reach (`pass` or `fail`). Every rubric meets at least one reference it must pass
  and one it must fail.
- `selftest.mjs sync` copies the rubrics from the measured case without touching their text. The only change is in
  the frontmatter of rubrics that judge the final reply: the copy judges the reference file instead (`focus` or
  `target` set to it), so the judge reads the same criteria and the same kind of evidence. `fixture.sh` places the
  reference, and the run itself is a one-line `haiku` reply nobody grades. The generated files (`case.yaml`,
  `prompt.md`, `fixture.sh`, `graders/`) are git-ignored and written fresh by `sync` before every run, so a copy can
  never lag behind the rubric it copies. Until `sync` runs, a self-test directory is not an eval case at all.
  `selftest.test.mjs` (Plugin CI) builds every case in memory, so a renamed rubric or a missing reference fails there.
- `selftest.mjs verify` reads the newest result (or the `aggregate-result.json` path you pass) and prints every
  rubric's verdict next to the expected one, with the judge's three votes. Exit code 1 means a rubric classified a
  reference wrongly: fix the rubric, or the reference if it is not what it claims to be, before trusting a measurement
  that uses it. A split vote (2 of 3) passes but is listed; `--strict` fails on it too.

Run it with the same `--judge-model` as the measurement, because a rubric that separates outputs under one judge can
blur under a weaker one. Re-run it when a rubric, a reference or the judge model changes; `--runs 3` shows whether a
verdict is stable. Rubrics that judge a workspace file (the bug-fix and over-build cases) are copied byte for byte and
their references are files at the same path. To cover another case, add a directory with `selftest.json` and the
reference, then run `sync`. Graders on `trace` or `files` cannot be replayed this way.

## Paired comparison for rule and text changes

A change to a rule, a command, an agent or an injected text ships when it measurably beats what main does today on the
same cases. The candidate is the working tree, so nothing has to be committed first:

```bash
SCRATCH=<a directory outside the repository, for example the session scratchpad>
# 1. Current main as a clean checkout of HEAD.
git worktree add --detach "$SCRATCH/lt-dev-main" HEAD
# 2. Both arms run the same cases and graders: hand the main arm the working tree's evals/.
rsync -a --delete --exclude results/ plugins/lt-dev/evals/ "$SCRATCH/lt-dev-main/plugins/lt-dev/evals/"
# 3. Same cases, same --model, same judge, at least 5 runs per arm. Add --allow-tools Write Edit for cases that
#    write code (bugfix-*, overbuild-*, nest-module-agent, nuxt-feature-agent); the review cases run without them.
for ARM in main candidate; do
  if [ "$ARM" = main ]; then PLUGIN="$SCRATCH/lt-dev-main/plugins/lt-dev"; else PLUGIN=plugins/lt-dev; fi
  for CASE in code-review-blast-radius-agent code-review-subtle-agent; do
    claude plugin eval "$PLUGIN" --case "$CASE" --runs 5 --ablation none --scaffold \
      --model claude-opus-5-5 --judge-model claude-opus-5-5 --trust-plugin --no-publish -j 2 \
      --output-dir "$SCRATCH/ab/$ARM/$CASE"
  done
done
# 4. Per case and grader, side by side; exit 1 when the arms are not like for like.
node plugins/lt-dev/evals/compare-arms.mjs "$SCRATCH/ab/main" "$SCRATCH/ab/candidate"
# --force: step 2 left modified or untracked files there, and a plain remove refuses them.
git worktree remove --force "$SCRATCH/lt-dev-main"
```

- **Pick one target case and one guard case.** The target is the case the change should improve (the blast-radius
  case for a change to how `review.md` scopes findings, `bugfix-shared-helper-agent` for a bug-fix rule,
  `overbuild-date-field-agent` for a reuse rule); the guard is a case the change could break (`code-review-subtle-agent`
  for a stricter reporting bar, `nest-module-agent` or `nuxt-feature-agent` for a rule injected into every agent).
- **One change at a time where possible.** When several changes sit in the working tree, isolate one in a second
  worktree from HEAD (`git worktree add --detach "$SCRATCH/one" HEAD`), give it the working tree's `evals/` with the
  same `rsync` as step 2 so both arms run the same cases and rubrics, copy only that one file over (for example
  `cp plugins/lt-dev/commands/review.md "$SCRATCH/one/plugins/lt-dev/commands/review.md"`), run that worktree as the
  candidate, and remove it with `git worktree remove --force "$SCRATCH/one"`. A batch that wins says nothing about which part carried it, and a batch that ties can hide a loss.
- **Same everything else.** Both arms on one `--model` and one `--judge-model`, run back to back from the same
  machine, at `-j 2` at most (more parallel runs on one credential can fail with `401 token revoked`). Run the judge
  self-test for every rubric the comparison relies on first.
- **Read it honestly.** Five runs per arm is a small sample: a difference of one run in five is noise. Ship when the
  target case gains clearly (two or more runs on the grader the change is about) and the guard case does not lose; for
  a costly or broad change, confirm a gain at 10 runs per arm. Equal quality with a clearly shorter run also counts,
  the rule from house rule 9: quality first, speed only as the tiebreaker.
- **Record the outcome.** A win goes into the "Reference measurement" table with date, model, judge and runs; a loss
  or a tie goes into "Not shipped" below, so the same idea is not tried again without a new reason.

## Not shipped

Candidates that were measured and lost or tied without a speed gain. A new attempt needs a reason the old measurement
no longer holds (a new default model, a case that leaves headroom).

| Candidate | Measured on | Result | Recorded in |
|---|---|---|---|
| `effort: high` for `backend-dev` | `nest-module-agent`, Opus 5.5, 5 runs per level, judge `claude-opus-5-5` (2026-09-25) | 0.94 against 0.98 at `medium`; `ProductCreateInput` missed the generator's inheritance in 5/5; 211-261 s against 165-180 s | Reference measurement; house rule 10 |
| `effort: high` for `frontend-dev` | `nuxt-feature-agent`, 5 runs per level (2026-09-25) | 1.00 at both levels; 220-254 s against 112-154 s | Reference measurement; house rule 10 |
| `effort: xhigh` for `code-reviewer` and `/lt-dev:review` | `code-review-agent` and `code-review-subtle-agent`, 5 runs per level (2026-09-25) | 1.00 at both levels, every defect found; 2.5 to 3.3 times as long | Reference measurement; house rule 10 |
| `effort: xhigh` for `/lt-dev:vibe:plan`, `vibe:build-plan`, `architect` | `vibe-plan-agent`, 4 runs per level (2026-09-25) | 3 of 4 runs hit the 1500 s timeout, the fourth scored 1.00 at 1502 s; `medium` 1.00 in 4/4 | Reference measurement; house rule 10 |
| `effort: high` for the convention skills | `quality` suite, 3 runs per case (2026-09-25) | 1.00 / 1.00 / 0.89 against 1.00 at `medium`; 30-50 % longer runs | Reference measurement |
| Ponytail-style change rules (github.com/dietrichgebert/ponytail) injected at `SessionStart` in lt projects and at `SubagentStart` into every `lt-dev:*` agent, 2,689 characters: read the change's reach first, a reuse ladder (project, framework, Nuxt UI or platform, installed dependency, then new code), "grep every caller of the function you change, then fix the root cause once in the shared code", nothing built "for later"; plus the same caller rule in `backend-dev`, `frontend-dev`, `resolve-ticket` and `debug` | Targets `bugfix-shared-helper-agent` and `overbuild-date-field-agent`, guards `nest-module-agent` and `nuxt-feature-agent`; main against candidate, Opus 5.5, 5 runs per arm, judge `claude-opus-5-5` (2026-10-17) | Targets 1.00 / 1.00 in both arms; guards 0.98 / 0.98 and 0.98 / 1.00 (one run in five, noise); 185 s against 192 s, 105 s against 96 s, 173 s against 187 s, 136 s against 146 s. In Ponytail's own runs the caller rule lifted root-cause fixes from 1/6 to 6/6 on Sonnet 4.6 and Opus 4.8; on Opus 5.5 with lt-dev the main arm already does it | House rule 37 |
| Blast-radius step in `/lt-dev:review`: Phase 1 lists the exports whose signature, return value or behaviour changed, greps their callers outside the diff and hands them to every reviewer | Target `code-review-blast-radius-agent`, guard `code-review-subtle-agent`; same setup (2026-10-17) | 1.00 / 1.00 and 1.00 / 1.00; main found the broken caller outside the diff in 5/5 without the step; 153 s against 145 s, 186 s against 182 s. What shipped from the same measured bundle: Gate 3 now names a broken untouched caller as in scope (main's reviewers already treated it so), and the report carries the change summary and a "Nicht geprüft" section | House rule 37 |
| Shorter skill descriptions against an assumed per-plugin listing budget of 16,000 characters | Three trimming rounds (2026-08-10 to 2026-08-23); listing measured at 26,935 characters against a global budget of about 8,000 | Cost trigger vocabulary and prevented no dropping: 13 of 27 lt-dev skills were already listed by name only | House rule 4 |
