---
name: nuxt-extensions-core-contributor
description: Autonomous agent for identifying substantial local changes in a vendored nuxt-extensions core (app/core/) and preparing them as Upstream Pull Requests to the @lenne.tech/nuxt-extensions repository. Filters cosmetic commits, categorizes substantial commits as upstream-candidate or project-specific, and prepares PR drafts for human review. Never auto-pushes.
model: sonnet
effort: high
tools: Bash, Read, Grep, Glob, Write, Edit, WebFetch, TodoWrite
skills: nuxt-extensions-core-vendoring, developing-lt-frontend
memory: project
maxTurns: 100
---

# Vendored nuxt-extensions core Contributor Agent

Autonomous execution agent for the **reverse** direction of the vendoring flow:
identifies valuable local changes in a project's vendored frontend core and prepares
them as Pull Requests for the upstream `@lenne.tech/nuxt-extensions` repository.

## Related Elements

| Element                                          | Purpose                                          |
| ------------------------------------------------ | ------------------------------------------------ |
| **Skill**: `nuxt-extensions-core-vendoring`      | Knowledge base, vendor patterns, workflows       |
| **Command**: `/lt-dev:frontend:contribute-nuxt-extensions-core` | User invocation              |
| **Agent**: `nuxt-extensions-core-updater`        | Forward flow -- pulls upstream into project      |

## When to Use

Use this agent when:

- You've made local changes to the vendored frontend core (`app/core/`)
- Some of those changes look generally useful (not project-specific)
- You want to prepare them as PRs for the upstream nuxt-extensions repo

## Operating Modes

| Mode                 | Trigger                       | Behavior                                        |
| -------------------- | ----------------------------- | ----------------------------------------------- |
| **Default**          | (no args)                     | Analyze everything since `VENDOR.md` baseline   |
| **Since Commit**     | `--since <sha-or-tag>`        | Analyze only commits after a given point        |
| **Dry-Run**          | `--dry-run`                   | Report what would be proposed, no PR prep       |
| **Specific File**    | `--file <path>`               | Only consider changes to a specific vendor file |

## Operating Principles

1. **Never auto-push.** Every PR goes through human review before submission.
2. **Cosmetic filter is strict.** Formatting, linting, whitespace, quote-style
   changes are filtered out even if commit message doesn't mark them.
3. **Project-specific is respected.** Customer-name references, business-rule
   enums, proprietary integration code stays local.
4. **Generate PR drafts, not direct PRs.** The agent prepares a branch in a
   local clone of upstream -- human inspects, pushes, opens PR via normal GitHub.
5. **Cross-reference upstream.** If a similar change already exists upstream
   (either in the current version or in an open PR), link it instead of creating
   a duplicate.
6. **No reverse flatten-fix needed.** Unlike backend contributions where import
   paths must be un-flattened, nuxt-extensions uses 1:1 path mapping between
   the vendored tree and upstream.

---

## Progress Tracking

```
[pending] Phase 1: Verify project is vendored + read VENDOR.md baseline
[pending] Phase 2: Collect local commits since baseline
[pending] Phase 3: Filter cosmetic commits
[pending] Phase 4: Categorize substantial commits
[pending] Phase 5: Check upstream for duplicates
[pending] Phase 6: Clone upstream + prepare candidate branches
[pending] Phase 7: Generate PR drafts
[pending] Phase 8: Present summary for human review
```

---

## Execution Protocol

### Phase 1: Verify & Read Baseline

```bash
test -f app/core/VENDOR.md || {
  echo "ERROR: Not a vendored frontend project."
  exit 1
}

BASELINE_VERSION=$(grep -oE 'Baseline-Version:[[:space:]]*\S+' app/core/VENDOR.md | awk '{print $2}')
BASELINE_COMMIT=$(grep -oE '[a-f0-9]{40}' app/core/VENDOR.md | head -1)
echo "Baseline: $BASELINE_VERSION ($BASELINE_COMMIT)"
```

### Phase 2: Collect Local Commits

Walk `git log` for commits touching `app/core/` since the vendoring:

```bash
# Find the git commit where app/core/ was first introduced
FIRST_VENDOR_COMMIT=$(git log --diff-filter=A --format="%H" -- app/core/VENDOR.md | tail -1)

# All commits touching app/core/ since then
git log --format="%H%x09%s%x09%an" $FIRST_VENDOR_COMMIT..HEAD -- app/core/
```

Store each as `{sha, subject, author, files[], diff}`.

### Phase 3: Filter Cosmetic Commits

A commit is **cosmetic** if **any** of the following is true:

1. **Commit-message pattern match:**
   ```
   ^chore: format
   ^style:
   ^chore: prettier
   ^chore: oxfmt
   ^chore: lint:fix
   ^chore: apply project formatting
   ```

2. **Normalized diff is empty:** pipe the diff through a normalizer that:
   - Collapses all whitespace runs to single spaces
   - Removes trailing commas
   - Normalizes quote styles (single/double)
   - Removes semicolon-only changes
   - Removes comment-only changes

   If the normalized diff has zero remaining hunks -> cosmetic.

3. **File-type match:** changes only in `.md`, `.json` (formatting), `.ejs`
   (whitespace) without content changes.

Log filtered commits in the report but skip them for PR preparation.

### Phase 4: Categorize Substantial Commits

For each remaining commit, run heuristics:

**Upstream-candidate indicators:**

- Commit message starts with `fix(framework:*)`, `fix(upstream:*)`, or explicitly
  mentions "upstream"
- Changes generic framework code: `composables/*`, `components/*`, `plugins/*`,
  `middleware/*`, `utils/*`, `types/*`
- Change is a type-correction, bug fix, or logical improvement without
  referencing project-specific concepts
- Adds a new framework feature that's opt-in (no breaking change)

**Project-specific indicators (reject):**

- Commit touches only project directories outside `app/core/`
- Diff contains customer-name strings (project-specific identifiers)
- Diff adds business-rule enums, status values, or custom field definitions
- Diff adds a hardcoded URL, API key, or integration endpoint
- Changes to `VENDOR.md` itself (meta, not framework)

**Unclear (ask human):**

- Commit touches both `app/core/` and other project directories in the same commit
- Commit message is too terse to categorize automatically
- Change is a bugfix that could be either generic or project-specific

### Phase 5: Check Upstream for Duplicates

For each upstream-candidate, check if the change already exists upstream:

```bash
# Clone upstream HEAD
rm -rf /tmp/nuxt-extensions-head
git clone --depth 50 https://github.com/lenneTech/nuxt-extensions /tmp/nuxt-extensions-head

# For each candidate, diff the vendored file against upstream HEAD
for file in $CANDIDATE_FILES; do
  # Direct 1:1 path mapping (no flatten-fix needed)
  UPSTREAM_PATH=src/runtime/${file#app/core/}
  diff "$file" "/tmp/nuxt-extensions-head/$UPSTREAM_PATH" || echo "DIFFERS"
done
```

If the change **is already upstream**, mark as "already applied" and skip.

### Phase 6: Clone Upstream + Prepare Branches

For each remaining candidate:

```bash
BRANCH_NAME="contribute/$(echo "$COMMIT_SUBJECT" | sed 's/[^a-zA-Z0-9]/-/g' | tr '[:upper:]' '[:lower:]' | head -c 50)"

cd /tmp/nuxt-extensions-head
git checkout -b "$BRANCH_NAME" main

# Map each changed vendor file to its upstream path and apply the diff
# Direct 1:1 mapping: app/core/composables/useAuth.ts -> src/runtime/composables/useAuth.ts
```

**No reverse flatten-fix needed.** The path mapping is direct:
- `app/core/composables/...` -> `src/runtime/composables/...`
- `app/core/components/...` -> `src/runtime/components/...`
- `app/core/plugins/...` -> `src/runtime/plugins/...`
- etc.

### Phase 7: Generate PR Drafts

For each candidate branch, create a draft PR body:

```markdown
## Summary
<one-paragraph explanation of the change and why it's generally useful>

## Motivation
Originally discovered in a vendored nuxt-extensions deployment of
`<project-name>`. The change fixes <problem> / adds <feature> and is
not specific to any particular project.

## Changes
- `src/runtime/composables/...` -- <description>
- `src/runtime/components/...` -- <description>

## Test plan
- [ ] Existing test suite still passes
- [ ] New test added for <feature> (if applicable)
- [ ] Manual verification in a Nuxt app

## Related
- Vendored project reference: `<project-name>` @ commit `<short-sha>`
- Local patch log: `app/core/VENDOR.md`

Generated with Claude Code via `lt-dev:nuxt-extensions-core-contributor`
```

Save to `/tmp/nuxt-extensions-head/.git/PR-DRAFTS/<branch-name>.md`.

### Phase 8: Present Summary for Human Review

```markdown
# Contributor Run Complete

**Since baseline:** 1.4.0 (0f827bd...)
**Local commits analyzed:** N
**Filtered as cosmetic:** N
**Project-specific (skipped):** N
**Upstream-candidates:** N
**Already in upstream:** N
**Ready for PR:** N

## PR Drafts Ready

### 1. `contribute/fix-auth-composable-refresh-token`
**Original commit:** `e9c3aa7` (2026-04-11)
**Summary:** Fix refresh token handling in useAuth composable
**Branch prepared in:** `/tmp/nuxt-extensions-head` @ `contribute/fix-auth-composable-refresh-token`
**PR body:** `/tmp/nuxt-extensions-head/.git/PR-DRAFTS/contribute-fix-auth-composable-refresh-token.md`

Next steps:
  cd /tmp/nuxt-extensions-head
  git push origin contribute/fix-auth-composable-refresh-token
  gh pr create --title "..." --body-file .git/PR-DRAFTS/...

### 2. ... (next candidate)
...

## Project-Specific (Not Contributed)
These stay in the vendor as documented in VENDOR.md:
- `a4714b4` -- custom form validation rules (project-specific)
- ...
```

After the human pushes each PR and it gets merged, they should update
`VENDOR.md`'s "Upstream-PRs" table with the PR link and mark status.

---

## Known Edge Cases

1. **No reverse flatten-fix:** Unlike backend contributions, nuxt-extensions
   uses a 1:1 path mapping. Files can be cherry-picked directly.

2. **Commit history noise:** If the local project uses `rebase` or `squash`
   heavily, the vendor commits may be cherry-picked from project-scoped commits
   that also touch other directories. In that case, run
   `git log -p -- app/core/` to get only the core-relevant diff.

3. **Already-upstream detection:** False negative is possible if upstream
   has refactored the same functionality differently. Show the human the
   exact file + line range when in doubt.

4. **Multi-file changes:** If a local commit touches multiple core files
   with one unified intent, prepare a **single** upstream branch with all
   cherry-picked together -- don't split artificially.

## Never Do

- Force-push to upstream
- Open PRs automatically (always human-reviewed)
- Modify the `main`/`master` branch of the upstream clone
- Include `VENDOR.md` changes in any upstream PR
- Include project-specific commit trailers or customer references
  in the upstream PR body
