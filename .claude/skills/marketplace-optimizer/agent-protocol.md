# Optimizer Agent Protocol

Shared operating rules for the six `optimizer-*` agents. Read this file and [house-rules.md](house-rules.md) before
any analysis or edit.

## Modes

- **ANALYSIS (default).** Read, measure and report. No edits, no staging, no commits.
- **APPLY.** Only when the prompt says so and names your partition. Edit only files inside it; anything else you need
  goes under "Needed outside my partition" in the report.

## Where to start

1. **The delta.** When the prompt says the cache was just refreshed, run `git diff .claude/docs-cache/<page>.md` for
   each of your primary pages and read the added lines first. New fields, changed defaults, renamed tools and removed
   behaviour appear there. Grep the changelog delta file (path in the prompt) for your element type; never read it
   whole.
2. **Then the full pages** your agent file lists, as needed for each check.
3. **Then the elements**, measured with commands rather than read and estimated.

Source of truth, in order: the fresh cache, then `house-rules.md`, then everything else (memory notes, older skill
text, a previous run's report). A claim from the last group is a hypothesis until the cache confirms it.

## Evidence

- **Scratch files carry your agent's name** (for example `$SCRATCH/commands-before.txt`): parallel agents share the
  scratchpad, and a generic `before.txt` gets overwritten by a sibling mid-run.
- **Reproduce instead of reasoning.** Validators, test suites, MCP handshakes, synthetic hook input, `npm view`: if a
  command can answer the question, the report contains its output.
- **Live signals from the coordinator** (a failed MCP connection, hook context that fired on the wrong turn) are
  evidence to reproduce and explain, not conclusions to repeat.
- **Emphasis, severity labels and incident notes are context-dependent.** A caps word inside a code block, a
  `CRITICAL` severity label, or a dated incident note is not a prompt defect.

## Analysis report

Final message, compact:

- One entry per finding: **ID** (S1, C1, A1, H1, M1, X1 …), **severity** (high/medium/low), **`file:line`**, what is
  wrong or missing in one or two sentences, **evidence** (cache file + short quote, changelog version, or
  reproduction output), **proposed change** (exact text or frontmatter where short), **confidence** (high/medium).
- Then **"Checked, no action needed"**: one line per notable thing verified as correct.
- Drop anything you cannot back with evidence. Five solid findings beat twenty speculative ones. A clean area is a
  valid result.

## Apply rules

- Work directly in the working tree on the current branch; never stage, commit, stash, reset, branch or check out.
  Other agents' uncommitted edits appear in `git status` — leave them alone.
- Surgical edits: change what the task names, keep structure, headings and cross-references; no reformatting of
  untouched text. When a heading changes, update the anchors that point at it.
- Authoring: English; timeless wording except documented-incident notes; target behaviour stated positively at
  normal volume with its reason; `plugins/` never references `.claude/` or repository files; no customer data,
  secrets or `/Users/<name>/` paths.
- Before reporting, run and summarise:
  ```bash
  for p in plugins/*/; do claude plugin validate "$p"; done
  bun .claude/scripts/check-cross-references.ts
  ```
  plus the tests of anything you touched (hook tests run as CI does:
  `find plugins -path '*/__tests__/*.test.sh'`), and a grep proving every renamed or removed identifier is gone
  from your partition.
- Apply report: per task ID the files changed with a one-line summary each; anything skipped and why; "Needed outside
  my partition"; validation summary.
