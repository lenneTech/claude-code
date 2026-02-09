---
description: Adversarial debugging with competing hypotheses using Agent Teams - multiple investigators challenge each other to find root cause (requires CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1)
argument-hint: "[bug-description or issue-id]"
allowed-tools: Read, Grep, Glob, Bash, Task, AskUserQuestion
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
| `/lt-dev:fix-issue` | Implement fix for a Linear issue |

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
> Alternativ kannst du den Bug konventionell mit `/lt-dev:fix-issue` untersuchen.

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

### Step 2: Generate Hypotheses

Analyze the bug description and relevant code areas:

1. Read files mentioned in the bug report or likely affected
2. Check recent git changes in affected areas: `git log --oneline -20 -- <paths>`
3. Look for common patterns: error handling gaps, race conditions, state mutations, config issues

Generate **3-5 hypotheses**, each with:
- One-sentence description
- Brief rationale (why this could be the cause)
- Key files/areas to investigate

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
- Their assigned hypothesis
- All other hypotheses (to argue against)
- Relevant file paths

**Teammate instructions:**
1. Find evidence FOR your hypothesis (code paths, log patterns, git blame, state analysis)
2. Find evidence AGAINST other teammates' hypotheses
3. Share both findings via messages to other teammates
4. Respond to counter-evidence from other teammates

Use delegate mode so the lead only coordinates.

### Step 5: Adversarial Protocol

The lead monitors the investigation:

- **If a teammate finds strong evidence:** Broadcast to all teammates for response
- **If discussion stagnates:** Lead prompts with specific questions:
  - "Teammate X found evidence at file:line - how does this affect your hypothesis?"
  - "No one has checked [specific area] yet - which hypothesis predicts behavior there?"
- **If two hypotheses converge:** Lead suggests merging into a combined theory

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

If implementing: Apply the fix, run tests, present the result.

### Step 8: Cleanup

- Shutdown all teammates
- Clean up team session
- Present final summary to user
