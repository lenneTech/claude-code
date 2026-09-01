---
description: Adversarial debugging with competing hypotheses using Agent Teams - multiple investigators challenge each other to find root cause (requires CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1)
argument-hint: "[bug-description or issue-id]"
allowed-tools: Read, Grep, Glob, Bash(git:*), Bash(echo:*), Bash(bash ${CLAUDE_PLUGIN_ROOT}/scripts/*), Agent, AskUserQuestion, ListAgents, SendMessage, mcp__plugin_lt-dev_linear__get_issue, mcp__plugin_lt-dev_linear__list_comments
disable-model-invocation: true
---

# Adversarial Debug

## When to Use This Command

- Root cause is unclear with multiple plausible explanations
- Bug has been investigated without conclusive results
- Complex cross-cutting issues (e.g., race conditions, state corruption, intermittent failures)

**Not for:** Obvious bugs with clear cause (typo, missing import, wrong variable). Use direct fixing instead.

## Related Commands

| Command | Purpose |
|---------|---------|
| `/lt-dev:review` | Code review after fix |
| `/lt-dev:resolve-ticket` | Resolve ticket end-to-end with TDD |
| `/lt-dev:backend:sec-review` | Security review if fix touches auth/authz code |

**Related Skills:**

| Skill | Purpose |
|-------|---------|
| `coordinating-agent-teams` | Coordination patterns and heuristics for agent team workflows |

---

## Prerequisites

Check if Agent Teams is enabled:

```bash
echo $CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS
```

**If NOT enabled (empty or 0):**
Inform the user:
> Agent Teams ist nicht aktiviert. Dieses Command benoetigt Agent Teams fuer das adversarial Debugging mit konkurrierenden Hypothesen.
>
> Aktivierung: `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 claude`
>
> Alternativ kannst du den Bug konventionell mit `/lt-dev:resolve-ticket` untersuchen.

**Stop execution if Agent Teams is not enabled.** This command has no single-agent fallback - the team IS the workflow.

---

## Execution

### Step 1: Gather Bug Information

Parse `$ARGUMENTS`:

**If argument matches an issue ID pattern** (e.g., `LIN-123`, `DEV-456`, or a UUID):
- Fetch issue details via Linear MCP: `get_issue` with the ID
- Fetch comments: `list_comments` for additional context
- Extract: title, description, reproduction steps, affected areas

**Otherwise:**
- Treat the argument as a bug description
- If no argument provided, ask the user:
  > Bitte beschreibe den Bug:
  > - Was sind die Symptome?
  > - Wie laesst er sich reproduzieren?
  > - Welche Bereiche sind betroffen?

### Step 1b: Who changed the suspect area, and what were they solving?

A regression has an author, and the author knows what they were trying to do. That is the one input hypotheses cannot be derived from, and it is the cheapest input in the whole command. Get it moving now: the answer arrives while Step 1.5 builds the loop, and nothing here waits.

Cheapest source first:

1. **`git log --oneline -20 -- <paths>` and `git blame` on the suspect lines.** A committed change carries subject, author, date, and usually the ticket. Where that explains it, this step is finished and nobody is disturbed.
2. **`bash ${CLAUDE_PLUGIN_ROOT}/scripts/peer-ledger.sh read`** — a `SOLVED` note from a session that has since closed is sometimes this exact diagnosis, already paid for by somebody else.
3. **Uncommitted work leaves no record at all**, and in a base repo that is the normal state rather than the exception:

   ```bash
   bash ${CLAUDE_PLUGIN_ROOT}/scripts/change-provenance.sh
   ```

   On `WARRANTED`, send the author-peer one `ORIGIN` in the format from the [`coordinating-peer-sessions`](${CLAUDE_PLUGIN_ROOT}/skills/coordinating-peer-sessions/SKILL.md) skill. Lead with the symptom, not with the change: "the invoice list 500s since this morning, and `invoice.service.ts` is uncommitted in the tree — what were you solving there, and what did you already rule out?" That phrasing gets a mechanism back. An accusation gets a defence back.

**Why this beats guessing.** "I moved the tax rounding into the service because the model ran before validation" is a hypothesis with a mechanism already attached, and it usually names the two candidates the author discarded. Step 2 then generates hypotheses in the space that is left instead of rediscovering the author's own reasoning.

**What the answer is not.** It is a lead, never evidence. Intent is what somebody meant to do; the bug is what the code does. Every hypothesis still faces the red loop from Step 1.5, including one that came straight from the author. And never wait: if no answer has arrived by Step 2, generate hypotheses without it and fold the answer in when it lands.

### Step 1.5: Build a tight feedback loop — the gate before any hypothesis

**This is the step that decides whether the debugging works.** With a **tight** signal that goes red on *this* bug, the cause gets found: bisection, hypothesis-testing, and instrumentation all just consume that signal. Without one, the whole team of investigators argues about code they cannot run, and the "winning" hypothesis is the most convincing story rather than the true cause.

So spend disproportionate effort here. Be aggressive, be creative, keep going.

**Ways to build one, roughly in this order:**

1. **Failing test** at whichever seam reaches the bug — API story test via `testHelper.rest()` / `testHelper.graphQl()`, unit test, or Playwright spec (`lt dev test -- <spec>`)
2. **HTTP probe** against a running API (`lt dev up`, then curl or `testHelper`)
3. **CLI invocation** with a fixture input, diffed against a known-good output
4. **Headless browser script** via Chrome DevTools MCP, asserting on DOM, console, or network
5. **Replay a captured trace** — save the real request payload, event, or document to disk and push it through the code path in isolation
6. **Throwaway harness** — the smallest subset of the system (one service, mocked externals) that reaches the bug in one call
7. **Property or fuzz loop** — for "sometimes wrong output", run many random inputs and watch for the failure mode
8. **Bisection harness** — when it appeared between two known-good states, automate "check out state X, run, verify" so `git bisect run` can drive it
9. **Differential loop** — same input through two versions or two configs, outputs diffed

**Then tighten it.** Treat the loop as the product: make it faster (skip unrelated init, narrow the scope), make the signal sharper (assert on the specific symptom, not "did not crash"), make it deterministic (pin time, seed randomness, isolate the DB, freeze network). A flaky 30-second loop is barely better than none; a deterministic 2-second one is a superpower.

**Non-deterministic bugs:** the goal is a higher reproduction rate, not a clean repro. Loop the trigger, parallelise, add load, narrow the timing window. A 50% flake is debuggable; a 1% flake is not, so keep raising the rate until it is.

**Completion criterion.** Step 1.5 is done when you can name **one command** that you have **already run at least once** — paste the invocation and its output — and that is:

- **Red-capable** — it drives the actual bug code path and asserts the user's exact symptom, so it goes red on this bug and green once fixed
- **Deterministic** — same verdict every run (for flaky bugs: a pinned, high reproduction rate)
- **Fast** — seconds, not minutes
- **Agent-runnable** — every teammate can run it unattended, without a human clicking

Reading code to build a theory before this command exists is the exact failure this step prevents. No red-capable command, no Step 2.

**When a loop genuinely cannot be built:** say so explicitly, list what you tried, and ask the user for either access to an environment that reproduces it, a captured artefact (HAR file, log dump, screen recording with timestamps), or permission to add temporary instrumentation on dev. Hypothesising without a loop produces a plausible story, not a fix.

### Step 1.6: Upstream check — is this already fixed?

Before any hypothesis that ends in "so we work around it": if the suspected cause sits in a
dependency or framework, run the `checking-upstream-first` check. A bug that reproduces on the
installed version and not on the current one is not a bug to debug — it is a version to bump,
and every hypothesis built on top of it is wasted.

Cheapest first: what version is actually resolved (`node -e "console.log(require('<pkg>/package.json').version)"`)
versus `npm view <pkg> version`, then read the relevant lines in `node_modules` directly.

### Step 2: Generate Hypotheses

With the loop red, analyze the bug and the code around it:

1. Read files mentioned in the bug report or likely affected
2. Check recent git changes in affected areas: `git log --oneline -20 -- <paths>` — plus whatever Step 1b returned about uncommitted work and author intent
3. Look for common patterns: error handling gaps, race conditions, state mutations, config issues

**Minimise the repro first.** Shrink the failing scenario to the smallest one that still goes red: cut inputs, callers, config, data, and steps one at a time, re-running the loop after each cut. Done when every remaining element is load-bearing — removing any one of them makes it go green. This pays off twice: it shrinks the hypothesis space the teammates work in, and it becomes the regression test in Step 7.

Generate **3-5 hypotheses**, each with:
- One-sentence description
- Brief rationale (why this could be the cause)
- Key files/areas to investigate
- **A falsifiable prediction** — "if X is the cause, then changing Y makes the bug disappear" or "then Z makes it worse". A hypothesis whose prediction you cannot state is a vibe: sharpen it or drop it. The prediction is also what each teammate argues *against* in Step 5, so a hypothesis without one cannot be adversarially tested at all.

### Step 3: User Confirmation

Present hypotheses to the user via AskUserQuestion (multi-select enabled):

**Question:** "Welche Hypothesen sollen untersucht werden? Du kannst auch eigene hinzufuegen."

Show each hypothesis as an option. The user can:
- Confirm all
- Remove unlikely ones
- Add new hypotheses via "Other"

### Step 4: Create Agent Team

Create an agent team with N teammates (one per confirmed hypothesis) using Sonnet:

Each teammate receives:
- The full bug description
- **The feedback-loop command from Step 1.5, plus the minimised repro** — every teammate runs the same loop, so evidence is measured against one shared signal instead of each teammate's reading of the code
- Their assigned hypothesis **and its prediction**
- All other hypotheses and predictions (to argue against)
- Relevant file paths

**Teammate instructions:**
1. **Test your prediction against the loop** — change the one variable your hypothesis names, run the loop, record whether it went green, stayed red, or got worse. One variable per run
2. Find further evidence FOR your hypothesis (code paths, log patterns, git blame, state analysis)
3. Find evidence AGAINST the other teammates' predictions, preferably by running their variable through the loop too
4. Share both findings via messages to other teammates, quoting the loop output rather than describing it
5. Respond to counter-evidence from other teammates

**Instrumentation rules for every teammate:**

- Prefer a debugger or REPL inspection where the environment allows it: one breakpoint beats ten logs
- Otherwise place targeted logs at the boundaries that *distinguish* the hypotheses, never "log everything and grep"
- **Tag every debug log with a unique prefix**, e.g. `[DEBUG-a4f2]` with a different id per teammate. Cleanup in Step 8 is then a single grep, and no untagged instrumentation survives into the branch
- **Performance regressions take the measurement branch:** logs are usually the wrong tool. Establish a baseline (timing harness, `performance.now()`, profiler, the MongoDB query plan via `explain()`), then bisect against it. Measure first, fix second

Use delegate mode so the lead only coordinates.

### Step 5: Adversarial Protocol

The lead monitors the investigation, and weighs evidence by how close it sits to the loop: **a loop run beats a code reading.** A teammate who flipped their variable and watched the loop go green has evidence; a teammate who explains why their hypothesis is plausible has a story.

- **If a teammate finds strong evidence:** Broadcast to all teammates for response
- **If a teammate argues without running the loop:** Ask for the run. "Which variable did you change, and what did the loop say?"
- **If discussion stagnates:** Lead prompts with specific questions:
  - "Teammate X found evidence at file:line - how does this affect your hypothesis?"
  - "No one has checked [specific area] yet - which hypothesis predicts behavior there?"
- **If two hypotheses converge:** Lead suggests merging into a combined theory
- **If every prediction has been tested and none survived:** that is a result, not a failure. Go to Step 6's "no hypothesis survives" branch with the falsification evidence — the loop has now ruled out four wrong causes, which is exactly what narrows the next round

### Step 6: Convergence and Result

Lead collects and synthesizes:

```markdown
## Debug Report

### Ranked Hypotheses

| Rank | Hypothesis | Confidence | Strongest Evidence | Strongest Counter |
|------|-----------|------------|-------------------|-------------------|
| 1    | ...       | High       | ...               | ...               |
| 2    | ...       | Medium     | ...               | ...               |
| 3    | ...       | Low        | ...               | ...               |

### Winning Hypothesis
[Detailed explanation with code references]

### Evidence Summary
[Key findings from all teammates]

### Dissenting Views
[Any unresolved disagreements]
```

**If no hypothesis survives** (all falsified):
- Lead analyzes the collected evidence
- Generates new hypotheses based on what was learned
- Presents to user: either restart with new hypotheses or escalate

### Step 7: Implementation Offer

Ask the user via AskUserQuestion:

**Question:** "Soll der Fix fuer die wahrscheinlichste Ursache implementiert werden?"

Options:
- **Fix implementieren** - Lead or winning teammate implements the fix
- **Weitere Untersuchung** - Generate new hypotheses based on findings
- **Abbrechen** - End debugging session

**If implementing, the regression test comes before the fix** — provided a correct seam exists for it.

A correct seam is one where the test exercises the **real bug pattern as it occurs at the call site**. A unit test that cannot replicate the chain that triggered the bug, or a single-caller test for a bug that needs two callers, gives false confidence: it goes green while the bug remains reachable. **When no correct seam exists, that is itself a finding** — record it, because the architecture is preventing the bug from being locked down, and feed it into Step 8's post-mortem.

With a correct seam:

1. Turn the minimised repro from Step 2 into a failing test at that seam (`projects/api/tests/stories/` for API-level, `projects/app/tests/` for E2E, `*.spec.ts` beside the source for a pure unit)
2. Watch it fail
3. Apply the fix
4. Watch it pass
5. Re-run the Step 1.5 feedback loop against the **original, un-minimised** scenario — the minimised case can go green while the real one still fails
6. Run the full Unit + API suites plus the affected Playwright specs

Present the result: the failing-then-passing test, the loop output before and after, and the files changed.

### Step 7.5: Browser Validation Walk (only when a fix was implemented)

After the fix has been applied and tests are green, run the manual-style end-to-end browser pass. This catches what unit / API tests cannot see — a console error introduced by the fix, a regressed empty state on a sibling page, a layout glitch surfaced by the new behaviour.

**Skip condition:** Step 7.5 is skipped when Step 7's option was `Weitere Untersuchung` or `Abbrechen` (no fix was implemented). It is mandatory when option `Fix implementieren` was chosen.

Follow the [`validating-changes-in-browser`](${CLAUDE_PLUGIN_ROOT}/skills/validating-changes-in-browser/SKILL.md) skill end-to-end. The skill receives:

- `diff_base`: the resolved base branch (default `main`)
- `ticket_id`: extracted from $ARGUMENTS if a Linear ID was provided
- `permission_matrix`: any role context surfaced during Step 5 of the debug investigation
- `mitgefixt_carryover`: anything already noted as pre-existing during the hypothesis investigation

The skill walks the list, fixes everything it finds (including pre-existing issues), renders the final list to the user, and closes with the ship-or-optimize gate. Skill verdict drives the next step:

- `READY-TO-SHIP` → continue to Step 8 cleanup.
- `OPTIMIZE` → user wants more changes; loop back to Step 7 (Implementation Offer) with the new scope.
- `WAITING-FOR-USER` → leave `lt dev up` running, print the walked list + account registry, stop and wait for the user's next message.
- `CANCELLED` → tear the stack down, stop without Step 8.

If the skill returns `boot_failed` or `stall_guard_triggered`, surface the diagnosis and stop. Do NOT proceed to Step 8.

### Step 8: Cleanup & Post-Mortem

**Checklist before declaring the session done:**

- [ ] The original repro no longer reproduces — re-run the Step 1.5 loop one final time and paste its output
- [ ] The regression test passes (or the absence of a correct seam is written down as a finding)
- [ ] **All tagged instrumentation is gone** — `grep -rn "\[DEBUG-" .` over the working tree comes back empty. Each teammate used its own id, so one grep covers them all
- [ ] Throwaway harnesses and prototypes are deleted, or moved somewhere explicitly marked as debug scaffolding
- [ ] The hypothesis that turned out correct is stated in the commit or MR/PR message, so the next person debugging this area inherits it
- [ ] All teammates shut down, team session cleaned up
- [ ] **The cause is recorded where it outlives this session:** `peer-ledger.sh note "<topic>" "cause: … fix: …"`. A diagnosis is the expensive part of debugging and it transfers perfectly, so it is worth the two seconds even when nobody is live to receive it
- [ ] **If the bug sat in another session's code, that session was told** — one `SOLVED` naming the cause, not the symptom. It is about to hit the same thing, and it is the one that can fix its own work without a conflict

**Then ask the question that pays the session forward: what would have prevented this bug?**

Answer it now rather than earlier — you know far more than you did at Step 1. Where the honest answer is architectural (no correct seam existed for the regression test, callers were tangled, the coupling was hidden), name it concretely and hand it on: file it per the ticket rules of the workflow that invoked this command, or run `/lt-dev:review` on the affected area. A "no correct seam" finding from Step 7 belongs here, not in a summary line nobody acts on.

Present the final summary to the user: winning hypothesis, evidence, the fix, the regression test, the loop verdict, and the prevention finding.
