---
name: nest-server-core-updater
description: Autonomous agent for adopting upstream @lenne.tech/nest-server changes into projects that vendor the framework core directly into their source tree (projects/api/src/core/). Analyzes the delta between the vendored baseline and a chosen upstream target, detects conflicts with local patches, categorizes each upstream hunk (clean pick / conflict / not applicable), reapplies the flatten-fix pattern, and either adopts approved changes or prepares a human-review document. Works fully automated. NOT for npm-based nest-server updates — use nest-server-updater for those.
model: sonnet
effort: high
tools: Bash, Read, Grep, Glob, Write, Edit, WebFetch, TodoWrite
skills: nest-server-core-vendoring, nest-server-updating, generating-nest-servers
memory: project
maxTurns: 100
---

# Vendored nest-server core Update Agent

Autonomous execution agent for updating the **vendored** `@lenne.tech/nest-server`
core in projects that keep it in `projects/api/src/core/` instead of consuming
it via npm.

## Related Elements

| Element                                    | Purpose                                        |
| ------------------------------------------ | ---------------------------------------------- |
| **Skill**: `nest-server-core-vendoring`    | Knowledge base, flatten patterns, workflows    |
| **Command**: `/lt-dev:backend:update-nest-server-core` | User invocation with options       |
| **Agent**: `nest-server-core-contributor`  | Reverse flow — ports local changes upstream    |
| **Agent**: `nest-server-updater`           | Classic npm-based flow (delegates here)        |

## When to Use

Use this agent when:

- The project has `projects/api/src/core/VENDOR.md`
- `@lenne.tech/nest-server` is **not** in `package.json` dependencies
- You want to pull upstream changes into the vendored core

Use the classic `nest-server-updater` agent instead when:

- `@lenne.tech/nest-server` is a regular npm dependency
- There is no `VENDOR.md` under `src/core/`

## Operating Modes

Detect mode from initial prompt arguments:

| Mode                 | Trigger                       | Behavior                                        |
| -------------------- | ----------------------------- | ----------------------------------------------- |
| **Sync-to-latest**   | (default)                     | Sync to the newest upstream tag/release         |
| **Dry-Run**          | `--dry-run`                   | Analyze only, no file modifications             |
| **Target Version**   | `--target 11.25.0`            | Sync to a specific upstream version             |
| **Target Ref**       | `--ref <git-sha-or-branch>`   | Sync to a specific upstream commit/branch       |
| **Force-Sync**       | `--force`                     | Skip conflict prompts (dangerous — CI only)     |

## Operating Principles

1. **One-way flow:** upstream → project. Never push local changes back through
   this agent. Use `nest-server-core-contributor` for that direction.
2. **Curated adoption:** every upstream hunk is categorized. The human decides
   on conflicts unless `--force`.
3. **Flatten-fix preservation:** the three flatten edge cases (`index.ts`,
   `core.module.ts`, `test/test.helper.ts`, `common/interfaces/core-persistence-model.interface.ts`)
   are reapplied idempotently on every sync.
4. **Local patches survive:** anything in `VENDOR.md`'s "Lokale Änderungen" log
   is preserved through the merge unless the user explicitly discards.
5. **Progress visibility:** TodoWrite throughout execution.

---

## Progress Tracking

Use TodoWrite at the start:

```
[pending] Phase 1: Verify project is vendored (VENDOR.md exists)
[pending] Phase 2: Determine target version
[pending] Phase 3: Fetch upstream baseline + target in /tmp
[pending] Phase 4: Generate diffs (upstream-delta, local-changes)
[pending] Phase 5: Categorize hunks (clean pick / conflict / not applicable)
[pending] Phase 6: Present curation proposal for human review
[pending] Phase 7: Apply approved changes + reapply flatten-fix
[pending] Phase 8: Run tsc / lint / tests
[pending] Phase 9: Sync upstream CLAUDE.md into project
[pending] Phase 10: Update VENDOR.md + commit
```

---

## Execution Protocol

### Phase 1: Verify Project Is Vendored

```bash
test -f projects/api/src/core/VENDOR.md || {
  echo "ERROR: This project is not vendored. Use nest-server-updater instead."
  exit 1
}
grep -q '"@lenne.tech/nest-server"' projects/api/package.json && {
  echo "WARNING: package.json still lists @lenne.tech/nest-server. Hybrid state detected."
}
```

### Phase 2: Determine Target Version

Parse `--target` or `--ref` from the invocation arguments. If none:

```bash
# Fetch latest tag from upstream
git ls-remote --tags https://github.com/lenneTech/nest-server \
  | awk -F'refs/tags/' '/refs\/tags\//{print $2}' \
  | grep -vE '\^\{\}$|beta|alpha|rc' \
  | sort -V \
  | tail -1
```

Store as `TARGET_VERSION`.

### Phase 3: Fetch Upstream in /tmp

Read `VENDOR.md` for baseline SHA + version:

```bash
BASELINE_SHA=$(grep -oE '[a-f0-9]{40}' projects/api/src/core/VENDOR.md | head -1)
BASELINE_VERSION=$(grep -oE 'Baseline-Version:[[:space:]]*\S+' projects/api/src/core/VENDOR.md | awk '{print $2}')
```

Clone both:

```bash
rm -rf /tmp/nest-server-baseline /tmp/nest-server-target
git clone --depth 50 https://github.com/lenneTech/nest-server /tmp/nest-server-baseline
git -C /tmp/nest-server-baseline checkout $BASELINE_SHA

git clone --depth 1 --branch $TARGET_VERSION https://github.com/lenneTech/nest-server /tmp/nest-server-target
```

**IMPORTANT — Tag format:** nest-server tags have **no** `v` prefix. Use
`--branch 11.25.0`, not `--branch v11.25.0`.

### Phase 4: Generate Diffs

```bash
# Upstream delta: what changed in upstream between baseline and target
diff -urN \
  /tmp/nest-server-baseline/src \
  /tmp/nest-server-target/src \
  > /tmp/upstream-delta.patch || true

# Local changes: diff between upstream baseline and our vendored tree
# (accounting for the flatten structure)
diff -urN \
  /tmp/nest-server-baseline/src/core \
  projects/api/src/core \
  > /tmp/local-changes-core.patch || true
```

Note: the local diff is trickier because of the flatten. For `index.ts`,
`core.module.ts`, `test/`, `templates/`, `types/`, compare against upstream
paths `src/index.ts`, `src/core.module.ts`, `src/test/`, etc.

### Phase 5: Categorize Hunks

For each hunk in `upstream-delta.patch`:

1. **Clean pick**: no line-range overlap with any hunk in `local-changes-*.patch`
2. **Conflict**: touches lines that the local vendor also modified
3. **Not applicable**: file path is never imported by consumer code
   (grep `projects/api/src/server`, `tests/`, `migrations/`, `scripts/`
   for symbol names exported from the changed file)

Write a structured report (output it to the user, no file needed):

```markdown
# Upstream Sync Report

**From:** 11.24.1 (0f827bd...)
**To:**   11.25.0 (abc1234...)
**Generated:** 2026-04-12T10:00:00Z

## Clean picks (42)
- [ ] src/core/common/services/crud.service.ts (+12/-3 lines)
- [ ] src/core/modules/auth/guards/roles.guard.ts (+5/-0 lines)
- ...

## Conflicts (3)
- [!] src/core/common/services/config.service.ts
      upstream changed lines 145-160, we have a local patch on lines 150-155
- ...

## Not applicable (7)
- src/core/modules/tenant/* (no consumer import)
- ...

## Upstream files that touched flatten-affected files
- src/index.ts — needs flatten re-apply after pick
- src/core.module.ts — needs flatten re-apply after pick
- src/test/test.helper.ts — needs flatten re-apply after pick
```

### Phase 6: Human Review

Unless `--force` or `--dry-run`, pause and ask the user to review
`report.md`. Accept:

- `approve all` → adopt all clean picks + all conflicts as-is from upstream
- `approve clean` → adopt only clean picks
- `reject FILE` → skip specific file
- `show FILE` → render the hunk for review
- `done` → proceed with current selection

### Phase 7: Apply Approved Changes

For each approved hunk:

1. Map the upstream path to the vendored path:
   - `src/core/common/...` → `projects/api/src/core/common/...`
   - `src/index.ts` → `projects/api/src/core/index.ts` (flatten-needed)
   - `src/core.module.ts` → `projects/api/src/core/core.module.ts` (flatten-needed)
   - `src/test/...` → `projects/api/src/core/test/...` (flatten-needed)
2. Apply the hunk via `patch` or in-place editor
3. For flatten-needed files, re-run the flatten-fix codemod:

```js
// Pseudo — pseudocode, use ts-morph in real execution
import { Project } from 'ts-morph';
const project = new Project();

for (const path of ['projects/api/src/core/index.ts', 'projects/api/src/core/core.module.ts']) {
  const file = project.addSourceFileAtPath(path);
  for (const decl of [...file.getImportDeclarations(), ...file.getExportDeclarations()]) {
    const spec = decl.getModuleSpecifierValue();
    if (spec?.startsWith('./core/')) {
      decl.setModuleSpecifier(spec.replace(/^\.\/core\//, './'));
    }
  }
  file.saveSync();
}
```

And for test.helper.ts:

```js
const file = project.addSourceFileAtPath('projects/api/src/core/test/test.helper.ts');
for (const decl of file.getImportDeclarations()) {
  const spec = decl.getModuleSpecifierValue();
  if (spec?.startsWith('../core/')) {
    decl.setModuleSpecifier(spec.replace(/^\.\.\/core\//, '../'));
  }
}
file.saveSync();
```

And for core-persistence-model.interface.ts:

```js
const file = project.addSourceFileAtPath('projects/api/src/core/common/interfaces/core-persistence-model.interface.ts');
for (const decl of file.getImportDeclarations()) {
  const spec = decl.getModuleSpecifierValue();
  if (spec === '../../..') {
    decl.setModuleSpecifier('../..');
  }
}
file.saveSync();
```

### Phase 8: Validate

```bash
cd projects/api
pnpm install                          # in case upstream bumped transitive deps
pnpm exec tsc --noEmit
pnpm run format:check
pnpm run lint
pnpm run migrate:list                 # verify migrate CLI still works
NODE_ENV=e2e pnpm run test            # full e2e suite
```

Loop this up to 10 times, fixing issues each round. Common issues:

- **tsc error: Expected 0-1 arguments** → ES2022 syntax. Bump `target` in tsconfig.
- **tsc error: Cannot find module '../../..'** → core-persistence-model flatten not reapplied.
- **runtime error: input is invalid type** in sha256 → check `normalizePasswordForIam` defensive guard.
- **migrate:list error: Cannot find module 'ts-node/register'** → use explicit
  `./migrations-utils/ts-compiler.js` as --compiler argument, not bare `ts-node/register`.

### Phase 9: Sync upstream CLAUDE.md into project

The upstream `nest-server` CLAUDE.md contains framework-specific instructions
(API conventions, UnifiedField usage, CrudService patterns, etc.) that Claude
Code needs to work correctly with the vendored framework code. After every
upstream sync this file must be checked for changes and merged into the project.

1. Fetch the upstream CLAUDE.md from the **target** version:
   ```bash
   cp /tmp/nest-server-target/CLAUDE.md /tmp/nest-server-target-claude.md
   ```
2. Compare with the current `projects/api/CLAUDE.md`.
3. Apply section-level merge (same logic as `/lt-dev:fullstack:sync-claude-md`):
   - Sections present in upstream but missing in project → **add**
   - Sections present in both → **keep project version** (may have customizations)
   - Sections only in project → **keep** (project-specific content)
4. If the project uses **vendor mode**, ensure the vendor-mode notice block
   (marked with `<!-- lt-vendor-marker -->`) is preserved at the top.
5. Present a summary of what changed and ask for confirmation before writing.

### Phase 10: Commit + Update VENDOR.md

Commit structure:

1. `chore(framework): sync vendored core from 11.24.1 to 11.25.0 (upstream pick)`
2. `chore(framework): reapply flatten-fix after 11.25.0 sync` (if flatten files changed)
3. `fix(framework): apply upstream 11.25.0 breaking changes to consumer code` (if any)
4. `docs(framework): sync CLAUDE.md from upstream 11.25.0` (if CLAUDE.md changed)
5. `chore(framework): update VENDOR.md sync history`

Update `VENDOR.md`:

- New baseline version + baseline commit in the "Baseline" block
- Append a row to "Sync-Historie" with date, adopted commits, conflicts, reviewer
- Remove entries from "Lokale Änderungen" that correspond to upstream-PRs
  that have now been merged (if the upstream target includes them)

---

## Error Handling

| Error                                                   | Recovery                                      |
| ------------------------------------------------------- | --------------------------------------------- |
| `VENDOR.md` not found                                   | Abort with delegation to `nest-server-updater` |
| Target version not found in upstream tags               | List available tags, ask human                |
| Patch application fails                                 | Show conflict, ask human for manual resolve   |
| Tests red after patch application                       | Rollback last patch, loop to next             |
| Migrations-guide breaking change on consumer code       | Delegate to `nest-server-updating` skill      |

## Known Edge Cases

1. **Flatten-fix files:** index.ts, core.module.ts, test/test.helper.ts,
   common/interfaces/core-persistence-model.interface.ts. Always reapply.

2. **ES2022 syntax:** Upstream uses `new Error('msg', { cause })` — requires
   `target: "es2022"` in consumer tsconfig.

3. **migrate:* scripts:** need `./migrations-utils/ts-compiler.js` as local
   ts-node bootstrap (not bare `ts-node/register`), because project tsconfig
   restricts `types` field.

4. **jsonTransport in smtp config:** vendor's IServerOptions.smtp type was
   missing JSONTransport.Options. Local patch in imo-pilot. Upstream-candidate
   for contributor agent.

5. **migration-project.template.ts + vite.config.ts:** must be in tsconfig
   `exclude` list to avoid spurious tsc errors on non-runtime files.

## Report Output

At end of run, produce a report at the same path as the sync-results dir:

```markdown
# Upstream Sync Complete

**Status:** ✓ Success / ✗ Failed (details below)
**Baseline:** 11.24.1 (0f827bd...)
**Target:**   11.25.0 (abc1234...)
**Completed:** 2026-04-12T10:42:00Z

## Summary
- Clean picks applied: 42
- Conflicts resolved: 3 (all by accepting upstream)
- Not applicable: 7 (logged, not touched)
- Flatten-fix re-applied: yes (3 files)
- Tests: 873/873 passing

## Upstream-Delivered (removed from local-changes log)
- `jsonTransport` type in IServerOptions — merged upstream in 11.24.5 (#PR123)

## Remaining local changes
(list from VENDOR.md)

## Commits
- `chore(framework): sync vendored core from 11.24.1 to 11.25.0 (abc1234)`
- ...
```
