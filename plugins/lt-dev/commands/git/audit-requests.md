---
description: Audit open Pull Requests (GitHub) and Merge Requests (GitLab) of the current repository — or of all repositories in the immediate sub-directories — and produce a tabular report with sense-check and obsolescence analysis per request.
allowed-tools: Bash(git:*), Bash(gh:*), Bash(glab:*), Bash(ls:*), Bash(find:*), Bash(test:*), Read, Grep, Glob, AskUserQuestion
argument-hint: "[--scope=current|children|auto] [--include-drafts] [--limit=N]"
disable-model-invocation: true
---

# Audit Open Pull / Merge Requests

## When to Use This Command

- Periodic spring-cleaning of stale PRs/MRs across one or many repositories
- Before a release: ensure no obsolete dependabot/automation PRs are blocking the queue
- Onboarding: get an overview of open contributions in a repo or workspace
- After large refactors: identify which open requests have been overtaken by `dev`/`main`

## Related Commands

| Command | Purpose |
|---------|---------|
| `/lt-dev:git:rebase-mrs` | Batch-rebase open MRs/PRs onto dev |
| `/lt-dev:git:create-request` | Create a new MR/PR from current branch |
| `/lt-dev:review` | Full code review of the current branch |

---

## Execution

Parse arguments from `$ARGUMENTS`:

- **`--scope=current`** — only audit the repo at the current working directory (must contain `.git`)
- **`--scope=children`** — audit every immediate sub-directory that is a git repository
- **`--scope=auto`** (default) — `current` if `$(pwd)/.git` exists, otherwise `children`
- **`--include-drafts`** (optional) — include Draft MRs / Draft PRs in the audit (default: included; pass `--no-drafts` to skip)
- **`--no-drafts`** (optional) — skip drafts
- **`--limit=N`** (optional, default `50`) — cap the number of requests fetched per repo

### STEP 0: Pre-Flight

1. **CLI availability:** verify `gh` and `glab` are installed (`which gh && which glab`). If only one is available, continue but mark the other provider as "skipped — CLI missing".
2. **Auth check:**
   ```bash
   gh auth status 2>&1 | head -5
   glab auth status 2>&1 | head -10
   ```
   For each provider that is not authenticated, mark as "skipped — not authenticated" and report at the end.

### STEP 1: Discover Repositories

Build the list of target repos based on `--scope`:

```bash
# scope=current
test -d .git && pwd

# scope=children
for dir in */; do
  if [ -d "$dir/.git" ]; then
    cd "$dir" && git remote get-url origin 2>/dev/null && cd ..
  fi
done
```

For each repo:

1. Resolve `origin` URL via `git remote get-url origin`
2. Classify provider:
   - URL contains `github.com` → **GitHub** (use `gh`)
   - URL contains `gitlab` (e.g. `gitlab.com`, `gitlab.lenne.tech`) → **GitLab** (use `glab`)
   - Otherwise → mark as "unsupported provider" and skip

### STEP 2: Fetch Open Requests Per Repo

Run inside each repo directory.

**GitHub:**
```bash
gh pr list --state open --limit <N> --json number,title,author,createdAt,updatedAt,url,isDraft,headRefName,baseRefName
```

**GitLab:**
```bash
glab mr list --per-page <N> 2>&1
# detailed view per MR:
glab mr view <NUMBER>
```

If `--no-drafts` was passed, filter out drafts (GitHub `isDraft=true`, GitLab title prefix `Draft:`).

### STEP 3: Per-Request Deep-Dive

For every open request, gather **enough context to make a sense-check call**:

1. **Metadata:** number, title, author, age (createdAt → today), updatedAt
2. **Branch info:** `headRefName`, `baseRefName`
3. **Diff size & body:**
   - GitHub: `gh pr view <N> --json body,additions,deletions,mergeable,mergeStateStatus,files`
   - GitLab: `glab mr view <N>` (read body, then `glab mr diff <N> | wc -l` for size)
4. **Mergeability signals:**
   - GitHub `mergeStateStatus`: `DIRTY` / `BEHIND` / `BLOCKED` / `CLEAN`
   - GitLab: parse "Conflicts" hint from `glab mr view`
5. **Obsolescence checks** — for each request, decide whether it is overtaken by current `main`/`dev`:
   - **Branch still exists?** `git ls-remote --heads origin <headRefName>` (empty = branch deleted)
   - **Title/Linear-ID already merged?** `git log origin/<baseRefName> --oneline --grep="<TICKET-ID>" -i | head -5`
   - **For dependency bumps** (dependabot / renovate): read the affected `package.json` field and compare current version vs. the bump's target. If current >= target, **OBSOLETE**.
   - **For refactors / feature swaps** (e.g. "swap eslint with oxlint"): check whether the target tool is already in use (`grep` `package.json` scripts).
   - **For file removals** (e.g. "remove X package"): check whether the file/dependency still exists.

Be efficient: read `package.json`, top-level configs, and `git log --grep` rather than diffing entire trees.

### STEP 4: Classify Each Request

Assign exactly one classification per request:

| Classification | Criteria |
|---|---|
| **MERGE** | Sinnvolle Änderung, nicht obsolet, mergeable, recent activity. Empfehlung: rebasen + mergen. |
| **OBSOLETE** | Inhalt ist bereits auf base branch oder durch andere PRs überholt; Dependency schon weiter; entferntes Paket schon weg. Empfehlung: schließen. |
| **STALE** | Alt (>6 Monate), keine kürzliche Aktivität, Konflikte, kein klarer Owner. Empfehlung: mit Owner klären oder schließen. |
| **CLARIFY** | Inhalt prinzipiell sinnvoll, aber Status unklar (Draft, viele Kommentare, fehlt Reviewer). Empfehlung: prüfen / finalisieren. |
| **DEPENDABOT-OBSOLETE** | Dependabot-Bump auf veraltete Zielversion; aktuelle Version im Repo ist gleich oder neuer. Empfehlung: schließen, Bot regeneriert bei Bedarf. |

### STEP 5: Tabular Output

Print exactly two tables (one per provider) plus a summary block. Use German for the analysis text (per CLAUDE.md), English for column headers and code identifiers.

```markdown
## GitHub Pull Requests

| Repo | PR | Titel | Autor | Alter | Analyse | Empfehlung |
|---|---|---|---|---|---|---|
| <repo> | [#<n>](<url>) | <title> | <login> | <relative> | <2-3 Sätze: was tut der PR, ist er noch aktuell, was deutet auf Obsoleszenz hin> | **<MERGE/OBSOLETE/STALE/CLARIFY>** — <kurze Begründung> |

## GitLab Merge Requests

| Repo | MR | Titel | Autor | Alter | Analyse | Empfehlung |
|---|---|---|---|---|---|---|
| <repo> | [!<n>](<url>) | <title> | <username> | <relative> | <2-3 Sätze> | **<...>** — <Begründung> |

## Zusammenfassung

- **Sofort schließen (obsolet):** <Liste mit Repo + #N>
- **Mergen (sinnvoll, aktuell):** <Liste>
- **Klären / Diff prüfen:** <Liste>
- **Finalisieren oder schließen (Drafts):** <Liste>
```

### STEP 6: Optional Follow-Up

After printing the report, ask the user via `AskUserQuestion` whether to:

1. **Close all OBSOLETE requests now** (executes `gh pr close <N> --comment "..."` / `glab mr close <N>` for each, with a brief German closing comment). Confirm per-request before any close, since it's a write operation visible to authors.
2. **Open `/lt-dev:git:rebase-mrs`** to rebase MERGE-classified requests.
3. **Skip** — leave it as a read-only audit.

**Important safety rules:**
- **Never auto-close a request without explicit user confirmation** (one prompt per close, list shown first).
- Skip closing requests authored by the current user without asking.
- Never leave editor processes or background tasks running.

---

## Notes for the Agent Performing the Audit

- Do not over-fetch: per-PR diffs are expensive — pull bodies + file lists, only fetch full diffs when classification needs it (e.g. ambiguous "Dev 609" titles).
- For dependabot PRs, the obsolescence call is almost mechanical: compare current vs. target version. Don't read the whole package-lock.
- For old dependency bumps (>6 months), default to `DEPENDABOT-OBSOLETE` unless the bump is still relevant (rare).
- For Drafts with many comments and recent commits on the branch, lean toward `CLARIFY` (likely active work).
- Cite the evidence in the analysis column (e.g. `package.json hat oxfmt 0.45.0 → PR überholt`).
- Keep each analysis cell to 2-3 sentences; the value is in the verdict + reason, not a wall of text.
- Honour the user's CLAUDE.md preferences: no emoji unless requested, German for explanations, terse style.
