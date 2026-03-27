---
description: Detect source code changes via tree hash comparison, re-analyze only affected areas, update SHOWCASE.md and refresh the showcase on showroom.lenne.tech
argument-hint: "[project-path]"
allowed-tools: Read, Grep, Glob, Bash(git:*), Bash(ls:*), Bash(curl:*), Bash(node:*), Bash(grep:*), Agent, WebFetch
disable-model-invocation: true
---

# /showroom:update — Update an Existing Showcase

Detects what changed since the last analysis using git tree hashes, re-analyzes only affected areas, updates SHOWCASE.md, and publishes changes.

## Workflow

### Step 1: Read Current State

```bash
# Read SHOWCASE.md frontmatter
old_version=$(grep "^version:" SHOWCASE.md | head -1 | awk '{print $2}' | tr -d '"')
old_hash=$(grep "^source_hash:" SHOWCASE.md | head -1 | awk '{print $2}' | tr -d '"')
old_date=$(grep "^analyzed_at:" SHOWCASE.md | head -1 | awk '{print $2}' | tr -d '"')

# Read current project state
new_version=$(node -p "require('./package.json').version" 2>/dev/null)
new_hash=$(git rev-parse HEAD:projects 2>/dev/null || git rev-parse HEAD:src 2>/dev/null || git rev-parse HEAD^{tree})
new_commit=$(git rev-parse --short HEAD)
```

### Step 2: Compare and Report

```
Change Detection:
  Version:     1.0.0 → 1.3.0  (CHANGED)
  Source Hash:  abc123 → def456  (CHANGED — code modified)
  Last Commit: a1b2c3d → e4f5g6h
  Analyzed:    2026-01-15 (70 days ago)

Status: OUTDATED — source code has changed since last analysis
```

If `old_hash == new_hash`: report "NO CHANGES" and exit (no update needed).

### Step 3: Find Exactly What Changed

```bash
# Find the commit that had the old tree hash
old_commit=$(git log --all --format='%H %T' | while read hash tree; do
  [ "$tree" = "$old_hash" ] && echo "$hash" && break
done)

# If found: precise diff
if [ -n "$old_commit" ]; then
  echo "=== Changed files since last analysis ==="
  git diff --name-only "$old_commit"..HEAD -- src/ projects/ package.json

  echo "=== Diff stats ==="
  git diff --stat "$old_commit"..HEAD -- src/ projects/ package.json
fi

# Fallback: date-based
if [ -z "$old_commit" ]; then
  echo "=== Commits since $old_date ==="
  git log --oneline --since="$old_date" -- src/ projects/
fi
```

### Step 4: Classify Changes

Map changed files to SHOWCASE.md sections:

| Changed files | SHOWCASE.md section to update |
|---|---|
| `package.json` | Technologie-Stack, frontmatter technologies |
| `src/server/modules/new-feature/` | Add new Feature section |
| `src/pages/` or `app/pages/` | Pages Inventory + new screenshots |
| `tests/` | Testing section |
| `docker-compose.yml` | Architektur, startupInfo |
| `*.controller.ts` or `*.resolver.ts` | API Surface |
| `nuxt.config.ts` | Technologie-Stack, UI/UX |

### Step 5: Targeted Re-Analysis

Spawn `project-analyzer` for changed areas ONLY:

```
Perform a TARGETED analysis of <project-path>.

Only analyze these changed files:
<list from git diff>

For each changed file, determine:
1. What feature was added or changed
2. Whether the SHOWCASE.md section needs updating
3. Whether new screenshots are needed

Do NOT re-analyze unchanged code.
```

### Step 6: Update SHOWCASE.md

Update only affected sections:
- Bump `version` to current `package.json` version
- Recalculate `source_hash`: `git rev-parse HEAD:projects`
- Update `last_commit`: `git rev-parse --short HEAD`
- Update `analyzed_at` to today
- Add/update feature sections
- Update tech stack if dependencies changed
- Add changelog entry

### Step 7: Screenshots for New/Changed Features

Only capture screenshots for features that were added or whose pages changed. Skip unchanged features entirely.

### Step 8: Update Showcase via API

```bash
curl -s -b /tmp/showroom-cookies.txt -X PATCH http://localhost:3000/showcases/{id} \
  -H 'Content-Type: application/json' -d '{"contentBlocks": [...]}'
```

### Step 9: Report

```
SHOWCASE.md updated: v1.0.0 → v1.3.0
  Source Hash:    abc123 → def456
  Features added: 2
  Features changed: 1
  Technologies:   +Stripe, +Nodemailer
  Screenshots:    2 new
  Changelog:      v1.3.0 entry added
```
