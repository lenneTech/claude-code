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
| `trigger/` | `nest-module`, `nuxt-form`, `tdd-story`, `npm-audit`, `rebase-branch`, `lt-cli-init`, `unslop-readme`, `frontend-security`, `turboops-deploy`, `upstream-workaround` | The named skill (or its command) is invoked for a German or English request that does not name it |
| `trigger/` | `nest-server-update` | Boundary: a nest-server upgrade goes to `nest-server-updating`, not generic npm maintenance |
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
- `code-review-agent` hands the commit over as `REVIEW.diff` as well: an eval run cannot grant `Bash` on a machine
  whose Docker config holds symlinks (Docker Desktop's `cli-plugins` do), and the comparison needs both effort levels
  to see the change the same way.
- Many parallel runs share one credential. A run that fails with `401 OAuth access token has been revoked` hit a token
  refresh and says nothing about the plugin; rerun that level with lower `-j` (observed 2026-09-25 with about eight
  concurrent runs).
- Its judge rubrics state the lt permission semantics (class-level `@Restricted` is a fallback, field and method
  decisions override it); without them a judge fails correct code.

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

The plugin's measurable contribution is lt-specific convention (decorators, base classes); generic practice such as
Valibot forms or plain prose the model already follows unaided. The `quality` graders check that conventions are
*present*, not that the logic is right, so equal scores there are not evidence of equal quality. Effort and model
choices are decided on the `agent` cases, whose judge-scored graders check the logic itself (quality first, speed only
as a tiebreaker). On Opus 5.5 every `agent` case scored the same at `medium` as at `high` or `xhigh`, which is why no
lt-dev agent or command pins an effort level; a case that scores 1.0 at both levels cannot show a gain, so a new case
needs defects or requirements that leave headroom.
