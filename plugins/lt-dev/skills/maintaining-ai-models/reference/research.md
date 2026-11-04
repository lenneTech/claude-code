# Research Beyond the Provider Catalog

The provider catalog answers "which hosted model is best". Three questions it cannot answer
decide just as much, and each review asks them again:

1. **What does the model actually get to see?** Input resolution, the number of images per
   request, the text the pipeline adds. A better model fed a downscaled page loses to a weaker
   model fed the full page.
2. **Is there a self-hostable engine that does part of the job better or cheaper?** Open-source
   OCR and document models move every few months.
3. **Does a combination beat the best single route?** Image plus text, a cascade, a vote.

## 1. Input resolution

- **Probe first, measure second.** `ai-models.mjs probe` runs a `resolution` probe for every
  usage that needs `vision` or `ocr`: the same page-shaped image at 1024, 1540, 2048 and
  3508 px, reading the prompt tokens. Tokens that stop growing mean the provider downscales
  server-side; observed 2026-11-03: one vision model stopped at about 1540 px, two others took a
  full 300 DPI A4 page (8,598 instead of 754 image tokens). Declare what the application sends
  as `params.imageEdgePx`; the probe then reports `resolution-headroom` or `resolution-wasted`.
- **Check the application's own ceiling.** A pipeline that renders PDF pages at a fixed DPI caps
  every configured edge silently: 2x (144 DPI) gives an A4 page 1,684 px, so a setting of
  2,048 px was sent at 1,684 and 300 DPI could not be reached at all. Verify the rendered size
  in the log or the render cache before measuring an edge.
- **Measure the edge as its own dimension** (one configuration per model and edge). The effect
  is not monotonic and differs per model and per document: in one measurement a larger edge read
  small print better but changed how the model interpreted column headers. Measure, do not derive.
- **The provider's recommendation is a hint.** A model card that says "resize to 1024 px"
  optimises time-to-first-token, not extraction quality on small print.
- **More pixels can cost a small model its reasoning.** Observed 2026-11-03 on a mixture-of-experts
  model with few active parameters: at 2,048 px it read every value but crossed two similar fields
  on some layouts in every run, at 1,024 px never. A prompt hint changed nothing; asked to explain,
  the model contradicted itself only at the larger edge. Decide the edge per input class (a phone
  photo needs more pixels than a rendered PDF page), not one edge for everything.
- **Check what the application does with large inputs.** A tiler that cuts an image larger than
  twice the edge into a grid can split tables down the middle; raising the edge for photos removed
  that failure entirely (31 % to 100 % of fields).
- **A model switch changes provider limits.** Images per request differed between two vision
  models of the same provider (4 and 5). Re-run the probes after a switch; a model that takes more
  than the application sends is information (`image-limit-headroom`), not a failure.

## 2. Self-hostable engines

Search for current open-source OCR and document-understanding engines (classic detector plus
recogniser, and small document VLMs) and keep only those that pass every gate:

| Gate | What to verify | Typical failure |
|------|----------------|-----------------|
| Licence of the code | Apache-2.0, MIT, BSD | GPL/AGPL in a SaaS: network copyleft |
| Licence of the weights | Separate file or model card, commercial use allowed | "research only", revenue caps, non-commercial clauses |
| Runs on the target hardware | Read the server: `nproc`, memory, GPU (e.g. TurboOps `exec_in_container`: `nproc; grep MemTotal /proc/meminfo; ls /dev \| grep -i nvidia`) | A VLM that needs a GPU on a CPU-only, shared server |
| Stays local | No call home, no runtime model download from a third-party host; weights bundled into the image | A library that fetches language data from a CDN on first use |
| Language | German umlauts and ß, the project's document languages | Latin-only recogniser models |
| Maintained | Release within the last year | Abandoned forks |

A strong engine that needs a GPU is not out: a GDPR-compliant hosting provider may serve it
(providers have enabled a requested OCR model before). List those separately as "ask the
provider to host", with the evidence.

Benchmarks to read (record the retrieval date): OmniDocBench, olmOCR-Bench, OCRBench v2, and
independent comparisons on business documents. Then measure the shortlist in the project's own
pipeline, as an OCR stage feeding the project's analysis model, against the incumbent routes.

## 3. Combinations

Measure a combination as a configuration of its own, with its cost in calls, tokens and time:

| Combination | Expected gain | Cost | How to measure |
|-------------|---------------|------|----------------|
| Image plus the PDF's text layer in one vision call | Exact characters from the text, columns from the image | No extra call; more prompt tokens | Digital cases only (a scan has no text layer) |
| Image plus OCR text (local engine or OCR model) | The same for scans | One OCR pass, local or hosted | All cases; compare against image only |
| Cascade: cheap route first, stronger route when a gate fails | Speed of the cheap route, quality of the strong one where needed | The second route only on failures | Measure the gate's hit rate and what it lets through |
| Vote: two or three routes, take agreement, flag disagreement | Detects uncertain fields for review; picking a value needs three | 2-3 times the calls | Count fields where the vote fixes or flags an error |

A combination earns its cost only with a material margin on the cases where the single route
fails. Report the error kinds it fixes (reading, swap, format, missing), not only the score.

A per-input-class strategy (route or edge chosen by input class) can be scored from existing
runs before anything is built: relabel the matching result rows of the single configurations
and report them together. Rank only configurations that cover every weighted input class; a
route that ran on digital PDFs alone otherwise tops the table.

**Who decides the route per document.** Decision models that return calibrated choices are
offered as hosted services; check where they run and whether they take the input at all (one
evaluated in 2026-11 was US-hosted and accepted no PDFs). For choosing a route or an edge, a
fixed rule over cheap signals (upload type, text layer present, smallest font height in the text
layer, scan DPI) is usually enough and stays explainable; verify it with the benchmark. A learned
decision earns its keep on "does a person need to review this", calibrated against confirmed
results (logistic regression plus conformal calibration, e.g. MAPIE, BSD-3), once a few hundred
reviewed documents per type exist.

## 4. Improving the review itself

Every review ends by improving the next one (`/lt-dev:backend:ai-model-review` STEP 6). The
questions, in order:

1. **What did this run find that the method did not ask for?** A dimension nobody measured
   (resolution, a route, a combination), a ceiling nobody checked, a trap that cost time.
2. **Did the case set discriminate?** Candidates level on a set mean the set is too easy for
   the question. Add cases where the candidates differ (small print, faxes, photos, landscape
   tables, more pages than one request takes) and keep the easy ones as a regression floor.
3. **Which errors were real reading errors?** Separate reading (same shape, other characters),
   semantic swaps (two fields exchanged), format (units, spacing) and missing values. A swap
   that follows a resolution change is an interpretation effect, not an OCR effect.
4. **What would the model running this review do differently?** A newer model may know engines,
   methods or failure modes the method predates. Write down its proposals; test the cheap ones
   in this run, file the rest.
5. **What does the next run need?** Record it where the next run reads it first: the project's
   benchmark harness (a new flag, a new case kind), its measurement log, this skill (generic
   lessons only, anonymised), and `benchmark.lastReview` in the adapter.

The log entry names the date, the model that ran the review, the configurations measured, the
decision and the process changes. Without the log, the next review repeats this one's mistakes.
