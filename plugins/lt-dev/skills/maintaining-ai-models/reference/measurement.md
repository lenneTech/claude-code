# Measuring Models Over the Project's Pipeline

The measurement decides which model a usage gets. It runs through the application's real path
(upload route, prompt builder, batching, quality gates, parser), because those decide together
with the model: a raw API call to a candidate measures a call shape the application never sends.

## The benchmark contract

A project exposes one command (in the adapter: `benchmark.command`) that writes one JSON line per
case and configuration. Fields:

| Field | Meaning |
|-------|---------|
| `usage` | The usage from the adapter |
| `config` | The configuration measured, e.g. `text:Qwen3.6-35B-A3B-FP8:none` (route, model, reasoning) |
| `model` | The model the configuration asked for |
| `modelUsed` | The model the run actually called (from the run record, not from the config) |
| `path` | The route the result actually took (e.g. `unified`, `analysis`, `ocr+analysis`) |
| `case` | Case id (no customer data in the id) |
| `tags` | Grouping, e.g. `{ "source": "real" \| "synthetic", "input": "digital" \| "scan" }` |
| `goal` | Did the result do the job (boolean); decides on its own |
| `accuracy` | Exact-match share of the checked fields, % |
| `lenient` | The same after value-based comparison (`1.000` = `1000`, `03.09.2026` = `2026-09-03`), % |
| `checked`, `correct`, `missing`, `different`, `countDeviations` | Counts behind the scores; `countDeviations` for wrong numbers of rows or parts |
| `ms` | Latency of a first call |
| `cached` | `true` when the answer came from a gateway cache; excluded from latency |
| `tokens` | Total tokens of the run |
| `error` | Error text (HTTP status, timeout); a failed case is a result, not a retry |
| `deviations` | Masked deviations: `kind:where [expected-shape \| actual-shape]` |

`ai-models.mjs summarize <file> --group config` turns it into one table per configuration:
goal %, accuracy, lenient, median and P90 latency without cached calls, tokens, and the rows that
came from another model or more than one route. Group further with `--group config,tags.source`.

`ai-models.mjs` also exports the helpers for a project's own runner: `valueEqual`,
`parseNumber`, `parseDate`, `mask`, `percentile`, `summarize`.

## Ground truth

- **Human-confirmed results** from production are good ground truth, with three corrections:
  - Leave out automatically confirmed runs (a flag, or seconds between upload and confirmation).
  - Deduplicate by file checksum: in one project 22 of 26 "documents" were the same two PDFs.
  - Unchanged confirmed values favour the model that produced them. Name this conservative bias
    in the report.
- **Synthetic cases** with known values cover layout traps real data shows rarely: several
  layouts, digital and as a "scan" (skew, noise). Generate them from HTML (headless Chrome) and
  rasterise for the scan variant.
- **Customer data** only with the customer's consent, read-only, in a local scratchpad, deleted
  afterwards. Reports, tickets and plugins carry masked shapes only.

## Rules that keep the numbers honest

- **Switch off what would hide the model.** A quality gate that falls back to another route makes
  every text model score like the fallback. The benchmark disables the gate or measures the
  route directly, and `path`/`modelUsed` prove which one ran.
- **One model per configuration, switchable without a restart** (e.g. one test tenant per
  candidate), so a run never mixes models.
- **Same budget per configuration.** Reasoning and answer share `max_tokens`; compare at the
  budget the application uses, and record it.
- **Reasoning settings are measured, not assumed.** Each setting is its own configuration
  (`none`, `low`, default). Observed: `reasoning_effort: "none"` worked for Qwen3.6/3.8 on mittwald,
  `low` behaved like the default for Qwen3.6, `chat_template_kwargs` was ignored by the gateway,
  and Qwen3.8 reasons at `xhigh` by default (33 s instead of 3 s).
- **Time only first calls.** Repeats of an identical request may come from a gateway cache; vary
  the prompt or mark the row `cached`.
- **Do not parallelise and do not retry.** Concurrent calls measure the queue; a retry quietly
  improves a candidate's score.
- **Repeat.** One pass is a sample of one; three passes before moving production.
- **Score by value.** Numbers and dates compare by value; format differences are reported
  separately. Raw string equality cost one model 16 points it did not deserve.

## Reading the result

Goal attainment decides first, always: a fast wrong answer loses. After that, how much speed
counts depends on who waits, which the usage's `latency` class in the adapter records:

- **`background`** (the call is one step of a longer process, e.g. a document analysis whose
  upload, OCR and checks take longer anyway): quality decides, latency only breaks a tie. A model
  that is clearly better but slower is the right choice; the user never feels the difference.
- **`interactive`** (a person waits for the answer, e.g. an assistant or chat): latency is a
  criterion next to quality, not a tie-break. A configuration over the usage's `latencyBudgetMs`
  (P90, end to end through the application) needs a quality lead large enough that the user
  would rather wait; a small lead does not justify seconds of waiting. Present that trade-off
  with both numbers, e.g. "16/16 in 7.1 s against 18/21 in 2.7 s", and let the user decide it.
- **Cost** comes last in both classes.

Measure latency where the user feels it: through the application path, first calls only, and as
P90 as well as median, because the slow tail is what an interactive user remembers.

Read the failures, not only the rates: swapping the customer's and the supplier's article number
is worse than an empty field, because the empty field is visible and the swapped one looks right.

Report per usage: the table, the recommendation, the margin, the bias, and every configuration
whose rows came from another model or route. A one-case difference is noise; say when a
challenger led but not by enough.
