---
name: maintaining-ai-models
description: 'Keeps a project''s LLM models available and measured: provider catalog, announced shutdowns, capability probes and measurement over the project''s own pipeline, via ai-models.mjs and a per-project adapter. Activates on "KI-Modell prüfen", "Modell wird abgeschaltet", "model deprecation", "mittwald AI hosting", or a diff changing a model ID, max_tokens or reasoning parameter. NOT for building the AI feature (use generating-nest-servers).'
---

# Maintaining AI Models

A model choice goes stale without anything breaking: the provider withdraws an ID (and may
redirect it to a "comparable" model, a silent behaviour change), announces a shutdown, or ships
a better model nobody measures. This skill keeps that question answered with two tiers:

| Tier | What it answers | Cost | Tool |
|------|-----------------|------|------|
| **Check** (deterministic) | Is every model still offered? Is a shutdown announced? Does the code match the adapter? Does the model still do what the usage needs? | No Claude tokens; the probes cost a few provider tokens | `ai-models.mjs check [--probe]` |
| **Measurement** | Which model does the job best in this application? | A full benchmark run | `/lt-dev:backend:ai-model-review` |

Quality is measured only through the project's real pipeline, never with raw API calls: prompts,
batching, quality gates and parsers decide together with the model. The check only says whether
that run is needed.

## Gotchas

- **Available is not suitable.** A model in the catalog can still miss a capability the usage
  needs, ignore the reasoning switch, or answer empty when reasoning eats `max_tokens`. The probes
  catch that for a few tokens; the catalog does not.
- **The provider's documentation can be wrong about its own gateway.** Observed 2026-10-12: the
  mittwald docs say thinking turns off through `chat_template_kwargs`, while the gateway ignores
  that field and only `reasoning_effort: "none"` works for Qwen3.x. Trust a probe over a doc page.
- **A gateway cache fakes latency.** mittwald answers identical requests from a cache (2,870
  tokens in 1.2 s). Time only first calls; the `cache` probe tells whether a gateway does this.
- **A quality gate can fall back silently.** A measured text model scored like the vision model
  because a gate rejected its result and the pipeline used the vision path instead. Every
  benchmark row records the `path` the result took and the `modelUsed`, next to the configured
  `model`.
- **Reasoning and answer share `max_tokens`.** A budget of 2,048 or 4,096 cut orders with 16
  items off (HTTP 500). Compare configurations at the same budget, or the comparison measures the
  budget.
- **A shutdown date is not the end of the risk.** After the date the provider may route the old ID
  to another model. The check marks a shutdown within 90 days as urgent (`--urgent-days`).
- **Missing from the catalog is the reliable signal, a redirect often is not visible.** Observed
  2026-10-14: `Mistral-Medium-3.5-128B`, gone from the mittwald catalog, still answered HTTP 200
  under its own ID, with no text. `model-redirected` fires only when the provider reports the
  serving model in the response; mittwald echoes the requested ID. Act on `model-missing`.
- **Speed counts where a person waits.** In a document analysis whose other steps take longer
  anyway, a clearly better but slower model wins. For an assistant the user is waiting on,
  seconds matter next to quality: 16/16 in 7.1 s is not automatically better than 18/21 in
  2.7 s. Each usage carries its `latency` class in the adapter, and the comparison follows it.

## Workflow

### 1. Adapter

The project describes its usages once in `.ai-models.json`: providers (base URL, the
name of the environment variable holding the key), usages (model, role, `needs`, call
parameters, `path`, and the `latency` class: `interactive` with a budget when a person waits,
`background` inside a longer process), where the models are configured in code, an optional
runtime source, and the benchmark command. Without it, every check starts by exploring the code again.
Format, examples and how to derive it: `${CLAUDE_SKILL_DIR}/reference/adapter.md`.

No adapter yet → derive the inventory from the code (`/lt-dev:backend:ai-model-review` STEP 1),
write the adapter, and show it to the user before saving.

### 2. Check

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/ai-models.mjs" check --since-days 30 --out .lt-dev/ai-models-report
node "${CLAUDE_PLUGIN_ROOT}/scripts/ai-models.mjs" check --probe          # plus capability probes
node "${CLAUDE_PLUGIN_ROOT}/scripts/ai-models.mjs" check --offline        # adapter and code only
```

Read `report.md`, not the JSON. Exit code: `0` nothing to do, `1` action needed, `2` urgent
(model gone, shutdown within the urgent window, a needed capability missing), `3` the check
itself failed (no key, no network, invalid adapter).

| Finding | Meaning | Next step |
|---------|---------|-----------|
| `model-missing` | The key no longer sees the model | Urgent: replace, measure the candidates first |
| `model-redirected` | Another model answers for the requested ID (probe; only where the provider reports the serving model) | Urgent: the behaviour already changed; measure and pin the replacement |
| `empty-answer` | A one-word request came back without text (probe) | Check reasoning against the budget; with `model-missing` alongside, the model is on its way out |
| `shutdown-announced` | Provider announced a date | Measure candidates in time; the date is a deadline, not a suggestion |
| `test-phase` | No shutdown notice guaranteed | Fine for trials; production usages want Stable or LTS |
| `capability-missing`, `probe-*-failed` | The model no longer does what the usage needs | Urgent for vision, embeddings or a failing basic call |
| `budget-eaten-by-reasoning` | Empty answer at a small `max_tokens` | Check the usage's budget against reasoning plus answer, or switch reasoning off |
| `adapter-*`, `code-*`, `runtime-*` | Adapter, code and running system disagree | Fix the adapter, or find out who changed the running system |
| `candidate` (information) | Available, unused model | Candidate for the next measurement |

### 3. Measure (only when the check or the user asks for it)

`/lt-dev:backend:ai-model-review` runs the project's benchmark against the candidates. The
benchmark contract (one command, a results JSONL per usage and model), how to build ground truth,
value-based scoring, masking and the traps from earlier measurements:
`${CLAUDE_SKILL_DIR}/reference/measurement.md`.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/ai-models.mjs" summarize results.jsonl --group config
```

The summary ranks per usage by its latency class: goal first; for an interactive usage the
configurations within the latency budget before those over it; then quality; then speed.

### 4. Decide and deliver

- **A model swap with a clear margin** can be prepared: ticket with the measurement report,
  delivery through the normal ticket workflow with review and approval.
- **Routing, switching an option off, accepting worse quality for speed** are product decisions.
  Present them; never apply them on your own.
- Record the reason next to every pin: the measured margin and the date.

### 5. Repeat on a schedule

The check runs without Claude, so it belongs in CI: a GitLab scheduled pipeline per project, the
script pinned to a commit and checksum, the key from a masked CI variable, one Linear ticket in
Triage on a finding. Template, variables, costs and the line between reporting and changing:
`${CLAUDE_SKILL_DIR}/reference/automation.md`.

## Rules

- **Customer data only with explicit consent**, read-only, local (scratchpad), deleted afterwards.
  No values in reports, tickets or plugins: deviations are logged masked (`mask()`: digits → 9,
  letters → a).
- **No keys in the adapter, the report or a ticket.** The adapter names the environment variable;
  the key comes from the shell, a password manager command or a masked CI variable.
- **The check never changes a model.** It reports. Changing one is a measured, approved change.

## Related Skills

- `generating-nest-servers` — the backend code a model change touches
- `filing-ai-proposed-tickets` — Triage, AI label and duplicate rules the scheduled ticket follows
- `validating-production-readiness` — model lifecycle is part of the go-live check
- `checking-upstream-first` — before building a provider workaround, check the provider's current behaviour
