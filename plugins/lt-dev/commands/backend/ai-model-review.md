---
description: Recurring model review — deterministic check of catalog, announced shutdowns and capabilities, then inventory, research, measurement against the project's own benchmark, and adoption of the confirmed winners
allowed-tools: Bash(pnpm run bench\:ai:*), Bash(npm run bench:ai:*), Bash(yarn run bench\:ai:*), Bash(pnpm run test:*), Bash(npm run test:*), Bash(yarn run test:*), Bash(pnpm run check:*), Bash(npm run check:*), Bash(yarn run check:*), Bash(git:*), Bash(curl:*), Bash(jq:*), Bash(node:*), Bash(grep:*), Bash(ls:*), Bash(cat:*), Bash(test:*), Read, Grep, Glob, Write, Edit, WebFetch, WebSearch, AskUserQuestion, Skill
argument-hint: "[--quick] [--probe] [--usage=<list>] [--dry-run] [--no-research] [--repeat=<n>]"
disable-model-invocation: true
---

# AI Model Review

Answer one question, repeatably: **is every AI usage in this project still on the
best available model — and if not, move it.**

The value is in the repetition. Model catalogs change every few weeks; a decision
made once quietly becomes wrong, and nobody notices because nothing breaks — the
answers just get a little worse, or a little more expensive, than they had to be.

Load the `maintaining-ai-models` skill first: it holds the adapter format, the
measurement rules and the traps earlier measurements ran into. The deterministic part
runs through `node "${CLAUDE_PLUGIN_ROOT}/scripts/ai-models.mjs"`; its output is what
you read, so the cheap questions cost no exploration.

## When to Use This Command

- Periodically (a quarter is a reasonable cadence), or when the provider
  announces new models
- After adding a new AI usage to a project
- When AI answers have visibly degraded, or the token quota is running out faster
  than expected

## Related Commands & Skills

| Element | Purpose |
|---------|---------|
| `maintaining-ai-models` skill | Adapter format, benchmark contract, measurement traps, the scheduled CI check |
| `/lt-dev:backend:sec-audit` | Security audit — unrelated, but the same "run it regularly" shape |
| `/lt-dev:maintenance:maintain-check` | Dependency dry-run — likewise a recurring review |
| `generating-nest-servers` skill | Backend conventions for any code change this command makes |
| `running-check-script` skill | Drives the final `check` loop |

## Argument Parsing

| Flag | Effect |
|------|--------|
| `--quick` | Only STEP 0: the deterministic check and its report. No research, no benchmark, no change |
| `--probe` | STEP 0 also runs the capability probes (a few provider tokens per usage) |
| `--usage=<list>` | Restrict to these usages (comma-separated), e.g. `--usage=ocr,scoring` |
| `--dry-run` | Report only — never edit a pin, never commit |
| `--no-research` | Skip the web research step (useful offline, or to save time on a re-run) |
| `--repeat=<n>` | Passes per case in the measurement. The harness itself defaults to **1**; always pass `--repeat=3` for a decision — one pass is a sample of one, and this command's own Hard Rules say so |

---

## STEP 0 — Bootstrap and deterministic check

Work through these steps in order; the final report states each step's outcome:

0. Check — catalog, announced shutdowns, adapter drift, optionally capability probes
1. Inventory — every AI usage and the model it currently uses
2. Research — the provider's current catalog + recent third-party evidence
3. Test — run the project's benchmark against the candidates
4. Report — comparison table + recommendation per usage
5. Adopt — apply the confirmed recommendations, then `check`

### 0a. Adapter

```bash
ls .ai-models.json 2>/dev/null
```

**Present** → run the check (0b). **Absent** → derive the inventory first (STEP 1),
write the adapter from it (format: the `maintaining-ai-models` skill,
`reference/adapter.md`), show it to the user, and save it after their OK; then run the
check. On `--quick` without an adapter, stop after proposing it.

The adapter lives in the project root and is committed, like `.turboops.json`. Not under
`.lt-dev/`: lt projects git-ignore that folder, so an adapter there never reaches the
repository or the scheduled CI check.

### 0b. Run the check

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/ai-models.mjs" check --since-days 90 --out .lt-dev/ai-models-report [--probe]
```

The provider key comes from the variable the adapter names in `keyEnv`. When it is not
set, ask the user how to provide it for this shell (an export, or their password
manager's CLI); never write it into a file, and never print it. Exit `3` with "no key"
is that case.

Read `.lt-dev/ai-models-report/report.md` and present the findings ranked: urgent,
action, information. The report is output, not source: lt projects git-ignore `.lt-dev/`;
elsewhere suggest adding `.lt-dev/ai-models-report/` to `.gitignore`.

**`--quick` ends here** with the report and, per finding, the next step from the skill's
findings table. Exit `0` without `--quick` → say so and ask whether the full review
should still run (research and measurement cost real time and tokens).

---

## STEP 1 — Inventory: what AI does this project actually do?

**Never take a list from a ticket, a README or memory. Read the code.** An
inventory that misses a usage leaves it on a stale model forever, and a phantom
entry sends you measuring something that does not exist.

### 1a. Is there already a usage registry?

```bash
ls projects/api/src/server/common/config/ai-usage-model.ts 2>/dev/null \
  || ls src/server/common/config/ai-usage-model.ts 2>/dev/null
```

**Present** → it is the inventory. Read it, and still spot-check it against the
code (1b) — a registry is only as good as its last update. If the project also
has `tests/benchmark/coverage.spec.ts`, that check is enforced in `pnpm test`,
so a green suite means the registry is complete; say so in the report instead of
re-deriving it.

**Absent** → derive the inventory now (1b) and offer to create the registry as
part of STEP 5. Without one there is nowhere to record the outcome, and the next
review starts from zero again.

### 1b. Derive the usages from the code

Search for every call site that reaches a model:

```bash
# Provider-layer calls (the framework's LLM abstraction)
grep -rn "provider.chat(\|\.chat(" --include='*.ts' src/ | grep -v '\.spec\.'
# Direct HTTP calls to an OpenAI-compatible endpoint
grep -rn "chat/completions\|audio/transcriptions\|/embeddings" --include='*.ts' src/
# Model ids configured anywhere
grep -rniE "model\s*[:=]\s*['\"\`]" --include='*.ts' src/ | grep -viE "@InjectModel|Model<|mongoose"
```

Also check the framework core (vendored under `src/core/`, or in
`node_modules/@lenne.tech/nest-server/`) — the chat orchestrator makes calls the
project never wrote, such as context compaction.

For each hit record: **what task**, **which model resolves it**, **which
modality** (chat / vision / audio / embedding), and the **call parameters**
(`maxTokens`, `temperature`, timeout). The modality is a hard filter — a
text-only model cannot do OCR.

**Verify before you list.** A task that sounds like AI is often not: duplicate
detection, vCard parsing and fuzzy matching are usually deterministic helpers.
Open the file. Listing a deterministic helper as an AI usage wastes a whole
measurement cycle on it.

### 1c. Report the inventory

Print a table: usage · current model · modality · latency class · call site ·
call parameters. Flag any usage whose model is *implicit* (inherited from a shared
connection rather than chosen) — those are the ones this command exists for.

The latency class answers "does a person wait for this answer?": `interactive`
(assistant, chat, inline generation, search) or `background` (one step of a longer
process such as a document analysis or an import). Derive it from the call site (a
request handler answering the UI versus a queue, job or pipeline step) and confirm it
with the user, together with the latency an interactive user will accept. It decides
how STEP 4 weighs speed, and it goes into the adapter as `latency` / `latencyBudgetMs`.

---

## STEP 2 — Research: what is available now?

Skip entirely on `--no-research`.

### 2a. The provider's live catalog

Ask the endpoint, not the documentation — a docs page lags behind, and a model
that is not in the catalog cannot be measured. With an adapter, STEP 0's report already
lists the unused models as `candidate` information: for an `openai` or `anthropic`
provider every catalog model no usage declares, for `mittwald` every model of the
provider's overview with its lifecycle status and capabilities (check those against
`ai-models.mjs catalog` before measuring, since the overview is not per key). The full
catalog of the adapter's providers:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/ai-models.mjs" catalog
```

Without an adapter, ask the endpoint directly; the key stays in the variable:

```bash
curl -s -H "Authorization: Bearer $PROVIDER_KEY" <baseUrl>/models | jq -r '.data[].id' | sort
```

Then read the provider's model page for context the catalog does not carry
(reasoning control, image limits per request, licence):

- mittwald: https://developer.mittwald.de/de/docs/v2/platform/aihosting/models/

Treat a documented parameter as a claim until a probe confirms it: the mittwald
gateway ignored the documented `chat_template_kwargs` switch for thinking, while
`reasoning_effort: "none"` worked (`ai-models.mjs probe`).

### 2b. Third-party evidence

`WebSearch` / `WebFetch` for current benchmarks and reports on the models in the
catalog — especially tool/function-calling quality, instruction following,
long-context behaviour, and German-language quality when the project is German.

**Record the retrieval date with every source.** Benchmarks age in weeks.

**And treat them as a hint, not a verdict.** Published benchmarks measure other
hardware, other prompts and other tasks. A documented example from this stack:
the model with the strongest published tool-use score called **zero** tools in
the real application, because it emitted its calls as JSON text instead of via
the native field. Your own measurement (STEP 3) always outranks a foreign one.

### 2c. Pick candidates per usage

For each usage from STEP 1, shortlist the models that are (a) present in the
catalog and (b) of the right modality. Include the incumbent — a comparison
without it cannot show whether a change is warranted. Prefer a spread over a
"best of" list: a specialist (e.g. a dedicated OCR model) and a very small model
both earn a slot, because short structured tasks often do not need a large one.

---

## STEP 3 — Test: measure against the project's own benchmark

### 3a. Does the project have one?

```bash
ls projects/api/tests/benchmark 2>/dev/null || ls tests/benchmark 2>/dev/null
grep -n '"bench:ai"' projects/api/package.json 2>/dev/null || grep -n '"bench:ai"' package.json
```

**Absent** → stop and say so plainly: without project-owned test cases this
command can only repeat foreign benchmarks, which is exactly what the previous
step warned against. Offer to build one (the shape below), and note that the
first run is the expensive one — afterwards every review is a single command.

A usable benchmark has, per usage:
- **realistic inputs** from the project's own domain,
- **machine-checkable expectations** — not "did it answer" but "does the answer
  contain the fact / the id / the number it must contain", built from the
  PRODUCTION prompt builder and validated with the PRODUCTION parser, so it
  cannot drift from what the application actually sends,
- **a configurable model**, so one case set compares many models,
- **recorded metrics**: goal attainment, quality, latency, tokens — one JSON line
  per case in the benchmark contract of the `maintaining-ai-models` skill
  (`reference/measurement.md`), including the `path` the result took and the
  `modelUsed`, so a silent fallback cannot pass for the configured model.

Where a document pipeline decides through a quality gate, the benchmark measures
through the real upload route with the gate switchable off; otherwise every
candidate on the gated route scores like the fallback.

### 3b. Check the case set for currency — BEFORE measuring

This step is the one most easily skipped and the most expensive to skip. The
application moves; a case set that still tests last quarter's task ranks models
on work nobody does any more, and the resulting switch is worse than no switch.

```bash
pnpm test        # coverage + prompt-drift guards, if the project has them
git log --oneline -20 -- src/server/modules  # what changed since the last review?
```

Then read the case files against the current prompts and ask, per usage:

- Does a usage exist in the code with **no** case? (A `coverage.spec.ts` answers
  this mechanically — prefer that over reading.)
- Does a case still reflect the current prompt and the current parser?
- Did a feature gain a requirement no case asserts yet?

**Bring the cases up to date first, and say in the report what you changed.** A
comparison run against a stale set is worse than no comparison, because it looks
authoritative.

### 3c. Run it

```bash
pnpm run bench:ai -- --repeat=3           # or the project's equivalent
pnpm run bench:ai -- --usage=ocr,scoring  # a subset, when --usage was passed
```

Rules that keep the numbers honest:

- **Do not parallelize.** Concurrent requests to one endpoint measure the queue,
  not the model.
- **Do not retry.** A wrong answer IS the measurement; a retry silently improves
  a candidate's score.
- **Vary the prompt between passes.** Providers cache identical prompts —
  mittwald answers a repeat in ~25 ms, which destroys every latency figure. A row
  that still came from the cache carries `cached: true` and drops out of latency.
- **Repeat.** One pass per case is a sample of one; three is the minimum on which
  to move production.
- **Same budget, every reasoning setting its own configuration.** Reasoning and
  answer share `max_tokens`; a smaller budget measures the budget, not the model.
  `none`, `low` and the default are separate rows, with the setting proven by the
  `reasoning-off` probe.
- **Ground truth from human-confirmed results** leaves out auto-confirmed runs,
  deduplicates by file checksum, and names the bias toward the incumbent model.
- **Customer data** only with consent, locally, deleted afterwards; deviations are
  logged masked.

---

## STEP 4 — Report

Print one table per usage, ranked, plus a recommendation. A benchmark that writes
the contract's JSONL gets its table from the script, which compares values by
value, leaves cached calls out of latency and flags rows from another model or
route:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/ai-models.mjs" summarize <results.jsonl> --group config
```

Order the criteria the way they actually decide, per usage and its latency class:

1. **Goal attainment** — did the answer do the job? Decides on its own, in every
   class.
2. **Quality and speed, weighed by who waits:**
   - **`background`** (the call is one step of a longer process whose other steps
     take longer anyway, e.g. a document analysis): quality decides; response time
     only breaks a tie. A clearly better but slower model is the right choice.
   - **`interactive`** (a person waits for the answer, e.g. an assistant): speed is
     a criterion next to quality. A candidate over the usage's latency budget (P90,
     end to end through the application) needs a quality lead the user would rather
     wait for. Present that trade-off with both numbers ("16/16 in 7.1 s against
     18/21 in 2.7 s") and let the user decide it; never settle it on quality alone.
3. **Cost** — where the provider bills per quota rather than per model, a switch
   changes CONSUMPTION, not the unit price. Cost is then a tie-break, never a
   reason on its own.

`summarize` applies this order when the adapter carries the latency classes: within a
usage it ranks goal first, then (interactive) the configurations within the budget,
then quality, then median latency, and it flags interactive configurations over the
budget.

**Recommend a switch only on a material margin.** Models are not deterministic
and case sets are small; a one-case difference is noise, and a review that
reshuffles models every quarter for noise costs more trust than it saves tokens.
State explicitly when a challenger led but not by enough.

Also report, because the numbers alone hide them:

- Models that failed for a STRUCTURAL reason (no native tool calls, output budget
  spent on a reasoning channel, JSON returned as prose). Those are not "bad
  models" — they are incompatible with this call shape, and the distinction
  matters when the next version appears.
- Usages where every candidate scored the same — a sign the cases do not
  discriminate and need sharpening before the next review.
- The failure patterns, read case by case: a swapped identifier that looks right is
  worse than an empty field the operator sees.

---

## STEP 5 — Adopt

Skip entirely on `--dry-run`.

1. **Confirm with the user** via `AskUserQuestion`, one decision per recommended
   switch, showing the measured margin. Never switch a production model silently.
   Routing changes and switching an option off are product decisions: present them
   as such, with the measurement, and leave them to the user.
2. **Apply** the confirmed pins in the registry (or the project's equivalent
   configuration), and record next to each one WHY — the measured margin and the
   date. A pin without a reason is indistinguishable from a guess a year later.
   Update `.ai-models.json` in the same change, then run
   `ai-models.mjs check --offline`: it must report no drift between adapter and code.
   Where models live in the database, the change needs a migration that re-points
   existing entries, not only new seed defaults.
3. **Update the documentation** with the new comparison table, the run date, the
   endpoint and the sources with their retrieval dates. Keep the previous table
   or a link to it, so the trend stays visible.
4. **Run the quality gates**: `pnpm test` and the `check` script
   (`running-check-script` skill). A model pin can break a test that asserted the
   old model's output shape.
5. **Do not commit or push** unless the user asks. Report what changed.

---

## Hard Rules

- **Derive the inventory from the code, every time.** A usage missing from the
  list stays on a stale model indefinitely, and nothing will surface it. The
  adapter is checked against the code by `ai-models.mjs`, never trusted blindly.
- **An announced shutdown is a deadline.** Measure the replacement before the date:
  afterwards the provider may route the old ID to another model without notice.
- **Your own measurement outranks any published benchmark.** Foreign benchmarks
  run other hardware, other prompts and other tasks; use them to pick candidates,
  never to pick winners.
- **Check the case set for currency before measuring** (STEP 3b). A stale set
  produces an authoritative-looking comparison of the wrong task.
- **Goal attainment decides.** A faster, cheaper model that gets the answer wrong
  never outranks a slower one that gets it right.
- **Speed counts where a person waits.** For an interactive usage, response time
  stands next to quality; for a background step inside a longer process, quality
  decides and speed only breaks ties.
- **No switch without a material margin.** Say when a challenger led but not by
  enough, and leave the model alone.
- **Never switch a production model without explicit user confirmation.**
- **Record the reason with the pin.** Measured margin + date, next to the value.
- **Respect modality.** A text model cannot do OCR; a speech model cannot chat.
  Filter candidates before spending tokens on them.
- **The run costs real tokens.** Say so before starting a full matrix, and honour
  `--usage=` to keep a re-run cheap.

## Failure Handling

1. **No API key / endpoint unreachable** → stop before STEP 3, report the
   inventory and the research; those are useful on their own.
2. **No benchmark in the project** → report it as the finding it is, offer to
   build one, and do not substitute foreign benchmarks for a measurement.
3. **A candidate is not in the catalog** → skip it with a note; never fabricate a
   row for a model that was not measured.
4. **The measurement is inconclusive** (every candidate level, or high variance
   across passes) → recommend NO change and say the cases need sharpening. An
   honest "no answer" beats a coin flip applied to production.
