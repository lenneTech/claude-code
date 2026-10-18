# Project Adapter: `.ai-models.json`

One file per project tells `ai-models.mjs` and `/lt-dev:backend:ai-model-review` which models the
project uses, for what, and how to reach them. It sits in the project root and is committed, like
`.turboops.json`; the scheduled CI check reads it from a clean checkout. It does not go under
`.lt-dev/`: lt projects git-ignore that folder (the lt CLI keeps the rule in place), so a file
there never reaches the repository. It holds no key; it names the environment variable that
holds one.

## Example

```json
{
  "project": "example-crm",
  "providers": [
    { "id": "mittwald", "kind": "mittwald", "baseUrl": "https://llm.aihosting.mittwald.de/v1", "keyEnv": "MITTWALD_API_KEY" }
  ],
  "usages": [
    {
      "id": "summarize",
      "provider": "mittwald",
      "model": "Qwen3.6-35B-A3B-FP8",
      "role": "chat",
      "path": "summary",
      "latency": "interactive",
      "latencyBudgetMs": 5000,
      "needs": ["reasoning-off", "json"],
      "params": { "maxTokens": 4096, "reasoningEffort": "none", "temperature": 0.2 },
      "source": "projects/api/src/server/common/config/ai-usage-model.ts"
    },
    {
      "id": "document-fast-path",
      "provider": "mittwald",
      "model": "Ministral-3-14B-Instruct-2512",
      "role": "vision",
      "path": "fast-path",
      "latency": "background",
      "needs": ["vision", "max-images:4"],
      "params": { "maxTokens": 8192 }
    },
    {
      "id": "search",
      "provider": "mittwald",
      "model": "Qwen3-Embedding-8B",
      "role": "embeddings",
      "latency": "interactive",
      "latencyBudgetMs": 1000,
      "needs": ["embeddings"],
      "params": { "dims": 4096 }
    }
  ],
  "inventory": {
    "seed": { "files": ["projects/api/src/server/common/config/ai-usage-model.ts"] },
    "runtime": { "command": "node scripts/ai-models-runtime.mjs" }
  },
  "benchmark": {
    "command": "pnpm --dir projects/api run bench:ai -- --repeat=3",
    "results": "projects/api/tests/benchmark/results/latest.jsonl"
  }
}
```

## Fields

| Field | Required | Meaning |
|-------|----------|---------|
| `project` | no | Name in reports and tickets; default `CI_PROJECT_PATH` or the folder name |
| `providers[].id` | yes | Referenced by `usages[].provider` |
| `providers[].kind` | yes | `openai` (any OpenAI-compatible endpoint), `mittwald` (OpenAI-compatible plus lifecycle from mittwald's developer portal), `anthropic` (catalog only) |
| `providers[].baseUrl` | yes, except `anthropic` | Up to `/v1`; the script appends `/models`, `/chat/completions`, `/embeddings` |
| `providers[].keyEnv` | yes | Name of the environment variable with the key. A key in the adapter is refused |
| `usages[].id` | yes | One task the application gives a model (summarize, OCR, import mapping …) |
| `usages[].model` | yes | The model ID exactly as the provider spells it |
| `usages[].role` | no | `chat`, `vision`, `embeddings`, `audio`; candidates for a usage share its role |
| `usages[].path` | no | The route through the application (e.g. `fast-path`, `text-layer`, `ocr+analysis`). Some routes accept only some models (a text route only text-only registered models); benchmark rows report the path they actually took |
| `usages[].needs` | no | Capabilities the usage depends on, each one a probe: `vision` (answers a question about an image), `ocr` (transcribes the text in an image; a document-OCR model such as GLM-OCR is listed with `ocr`, not `vision`), `json` (`response_format: json_object`), `tools` (native tool calls, not JSON in the text), `reasoning-off`, `embeddings`, `max-images:<n>`. Any other word is reported as `unknown-need`, because nothing would check it |
| `usages[].latency` | recommended | How much speed counts: `interactive` when a person waits for the answer (chat, assistant, inline generation, search), `background` when the call is one step of a longer process whose other steps take longer anyway (document analysis, import, batch). Decides how a measurement weighs latency against quality (`measurement.md`, "Reading the result") |
| `usages[].latencyBudgetMs` | for `interactive` | The P90 latency the person will accept, measured end to end through the application. `summarize` ranks configurations within it first and flags the ones over it |
| `usages[].params` | no | The call parameters the application sends: `maxTokens`, `reasoningEffort`, `temperature`, `maxImages`, `dims`. Probes send the same, so they test the call the application makes |
| `usages[].source` | no | Where the model is set in code, for the reader |
| `inventory.seed.files` | no | Files where models are configured in code (registry, seeds, env defaults). The check reports declared models missing there and catalog models quoted there but not declared |
| `inventory.runtime.command` | no | A command that prints the models the running system uses, as JSON: `["id", …]`, `[{ "model": "…", "usage": "…" }]` or `{ "models": [...] }`. Runs from the project root; skipped with `--no-runtime` |
| `benchmark.command` | no | How the project measures its usages (see `measurement.md`) |
| `benchmark.results` | no | Where that command writes its JSONL |

## Where models live, and which source counts

- **Code registry** (a per-usage table): the inventory and the adapter come from it; keep both in
  step.
- **Seeds written into the database** (default models a migration inserts): the database is the
  truth, because admins change entries and later migrations re-point them. Declare the seed file
  under `inventory.seed`, and a runtime command for the database when the check can reach it.
- **Environment variables**: name them in the usage's `source`; the deployed value is the truth.

A runtime source usually needs privileged access (an admin session, a database). A scheduled CI
check rarely has that; it runs with `--no-runtime` and reports the code side. A small read-only
endpoint or token that lists the configured model IDs (never keys) makes the runtime side
checkable unattended, and is worth its own ticket in projects that store models in the database.

## Deriving the adapter

1. Search the code for model IDs, provider base URLs and key variables
   (`/lt-dev:backend:ai-model-review` STEP 1 has the searches).
2. One usage per task, not per call site: two call sites doing the same task share a usage.
3. Copy the call parameters from the code, not from defaults: they decide what the probes test.
4. Run `ai-models.mjs check --offline`: every `adapter-model-not-in-code` and
   `code-model-not-in-adapter` finding is a gap in the adapter or a leftover in the code.
