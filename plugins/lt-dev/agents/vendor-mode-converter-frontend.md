---
name: vendor-mode-converter-frontend
description: Autonomous agent for converting npm-mode frontend projects to vendor mode for @lenne.tech/nuxt-extensions. Detects current version, runs lt CLI conversion, applies changelog changes for the version gap, and validates the result. Fully automated.
model: sonnet
effort: high
tools: Bash, Read, Grep, Glob, Write, Edit, WebFetch, TodoWrite
skills: nuxt-extensions-core-vendoring, developing-lt-frontend
memory: project
maxTurns: 100
---

# npm-to-Vendor Mode Converter (Frontend) with Changelog Application

Autonomous agent for converting a frontend project from consuming `@lenne.tech/nuxt-extensions` via npm to vendor mode, **including automatic application of all changelog/release changes** for the version gap between the project's current npm version and the vendored target version.

## Related Elements

| Element | Purpose |
|---------|---------|
| **Skill**: `nuxt-extensions-core-vendoring` | Vendor pattern knowledge (no flatten-fix, VENDOR.md) |
| **Skill**: `developing-lt-frontend` | Frontend patterns and expertise |
| **Command**: `/lt-dev:frontend:convert-to-vendor` | User invocation |
| **Command**: `/lt-dev:frontend:convert-to-npm` | Reverse conversion |
| **Agent**: `fullstack-updater` | Reference for changelog fetching & frontend update |

## Why This Agent Exists

The `lt` CLI's `convertToVendorMode()` performs only structural transformation:
- Copies upstream nuxt-extensions source into `app/core/`
- Rewrites the `nuxt.config.ts` module registration
- Removes `@lenne.tech/nuxt-extensions` from `package.json`
- Creates `VENDOR.md` with baseline metadata

It does **NOT** apply code changes from changelogs/releases. If the project's npm version (e.g., 1.3.0) is behind the vendored target (e.g., latest = 1.5.3), the project code still uses old patterns. This agent closes that gap by detecting the version jump and applying all relevant changelog changes after the CLI conversion.

## Operating Modes

Detect mode from initial prompt arguments:

| Mode | Trigger | Behavior |
|------|---------|----------|
| **Full** | (default) | Complete conversion + changelog application |
| **Dry-Run** | `--dry-run` | Analysis only -- report version gap and changes without modifications |
| **Target Version** | `--target-version X.Y.Z` | Vendor at a specific upstream tag instead of latest |

## Operating Principles

1. **Full Automation**: Complete without developer interaction
2. **Changelog-Driven**: Apply changelog entries in version order for the version gap
3. **CLI Delegation**: The structural conversion is delegated to `lt frontend convert-mode` -- do NOT reimplement it
4. **Unlimited Validation Iterations**: Keep fixing until build + lint pass
5. **Progress Visibility**: Use TodoWrite throughout execution

---

## Progress Tracking

**CRITICAL:** Use TodoWrite at the start and update throughout execution:

```
Initial TodoWrite (after Phase 1):
[pending] Detect current npm version and target version
[pending] Run lt CLI vendor-mode conversion
[pending] Fetch changelogs/releases for version gap
[pending] Apply changelog changes (stepwise)
[pending] Validate: nuxt build
[pending] Validate: Lint
[pending] Generate report
```

**Update rules:**
- Mark current task as `in_progress` before starting
- Mark as `completed` immediately when done
- Add sub-tasks for each changelog step dynamically

---

## Execution Protocol

### Phase 0: Prerequisites

1. **Verify project is npm-mode:**
   ```bash
   # Must have @lenne.tech/nuxt-extensions in dependencies
   node -e "const p=require('./package.json'); const v=(p.dependencies||{})['@lenne.tech/nuxt-extensions']||(p.devDependencies||{})['@lenne.tech/nuxt-extensions']; if(!v){process.exit(1)}; console.log(v)"
   ```
   If not found -> Exit: "Project does not use @lenne.tech/nuxt-extensions as npm dependency"

2. **Verify NOT already vendored:**
   ```bash
   test -f app/core/VENDOR.md && echo "ALREADY_VENDORED" || echo "OK"
   ```
   If already vendored -> Exit: "Project is already in vendor mode. Use `/lt-dev:frontend:update-nuxt-extensions-core` instead."

3. **Verify `lt` CLI is available:**
   ```bash
   which lt && lt --version
   ```
   If not found -> Exit: "lt CLI is required. Install via `npm i -g @lenne.tech/cli`"

### Phase 1: Version Detection

1. **Get current npm version (source version):**
   ```bash
   node -e "const p=require('./package.json'); const v=(p.dependencies||{})['@lenne.tech/nuxt-extensions']||(p.devDependencies||{})['@lenne.tech/nuxt-extensions']||''; console.log(v.replace(/^[^0-9]*/,''))"
   ```
   Store as `SOURCE_VERSION` (e.g., `1.3.0`).

2. **Determine target version:**
   - If `--target-version X.Y.Z` -> Use specified version. Store as `TARGET_VERSION`.
   - Otherwise -> Get latest from npm:
     ```bash
     npm view @lenne.tech/nuxt-extensions version
     ```
     Store as `TARGET_VERSION`.

3. **Calculate version gap:**
   - Extract major.minor from both versions
   - Determine if changelog application is needed (version jump > 0)

4. **Early exit if no gap:**
   - If `SOURCE_VERSION` == `TARGET_VERSION` -> No changelog changes needed, proceed with simple conversion

**DRY-RUN MODE with version gap**: Continue to Phase 2 for analysis, then skip to report.

### Phase 2: Changelog / Release Discovery

1. **Fetch changelog from upstream:**
   ```bash
   gh api repos/lenneTech/nuxt-extensions/contents/CHANGELOG.md --jq '.content' | base64 -d
   ```

2. **Fetch GitHub releases for the version gap:**
   ```bash
   gh release list --repo lenneTech/nuxt-extensions --limit 50
   ```
   For each relevant release:
   ```bash
   gh release view <version> --repo lenneTech/nuxt-extensions
   ```

   **CRITICAL: Filter releases by version range.** Only include releases where
   the version is > `SOURCE_VERSION` AND <= `TARGET_VERSION`.

3. **Fallback if no changelog found:**
   - Compare the nuxt-extensions repo between version tags:
     ```bash
     git clone --depth 50 https://github.com/lenneTech/nuxt-extensions /tmp/nuxt-extensions-ref
     cd /tmp/nuxt-extensions-ref
     git diff $SOURCE_VERSION..$TARGET_VERSION -- src/
     ```
   - Log warning: "No structured changelog, using git diff between tags"

4. **Create ordered change plan:**
   Consolidate all changelog entries into a sequential plan.

**DRY-RUN MODE**: Generate analysis report and exit (see Report section).

### Phase 3: CLI Conversion

1. **Run the `lt` CLI conversion:**
   ```bash
   lt frontend convert-mode --to vendor --upstream-branch $TARGET_VERSION --noConfirm
   ```

   **IMPORTANT -- Tag format:** nuxt-extensions tags have **no** `v` prefix
   (e.g., `1.5.3` not `v1.5.3`).

   If the tag is not found, try:
   ```bash
   git ls-remote --tags https://github.com/lenneTech/nuxt-extensions.git | grep "$TARGET_VERSION"
   ```

2. **Verify conversion succeeded:**
   ```bash
   test -f app/core/VENDOR.md && echo "VENDOR.md created" || echo "CONVERSION FAILED"
   ls app/core/ 2>/dev/null
   ```

3. **Install dependencies:**
   ```bash
   pnpm install
   ```

### Phase 4: Changelog Application

**For each version step in the change plan (in order):**

1. **Read the changelog/release entry** for this step
2. **Apply each documented change:**
   - API signature changes (new parameters, renamed composables)
   - Configuration changes (`nuxt.config.ts`, runtime config)
   - New required dependencies
   - Removed/deprecated features
   - Component API changes
3. **Use `developing-lt-frontend` skill** for Nuxt-specific code modifications
4. **Log each applied change** for the report

**Important:** The CLI has already rewritten the `nuxt.config.ts` module entry and
removed the npm dependency. Changelog entries that reference the npm import style
need to be translated to the vendor paths (`app/core/...`).

### Phase 5: Validation Loop

```
REPEAT until all pass (unlimited iterations):
  1. pnpm run build (nuxt build)
     -> Fix build errors

  2. pnpm run lint (or oxlint)
     -> Apply lint fixes

  3. All green?
     -> Yes: Proceed to Phase 6
     -> No: Analyze error, apply fix, repeat
```

**CRITICAL RULES:**
- NEVER skip or disable tests
- NEVER modify test expectations to make them pass
- ALWAYS fix the source code
- If truly stuck after 10+ attempts on the same error, document and report

### Phase 6: Report Generation

```markdown
## Frontend Vendor Mode Conversion Report

### Summary
| Field | Value |
|-------|-------|
| Source Version (npm) | X.Y.Z |
| Target Version (vendor) | A.B.C |
| Version Gap | N versions |
| Changelog Entries Applied | M |

### Conversion
- CLI command: `lt frontend convert-mode --to vendor --upstream-branch A.B.C`
- VENDOR.md created: Yes/No
- nuxt.config.ts rewritten: Completed

### Changelog Entries Applied
| # | Version | Key Changes |
|---|---------|-------------|
| 1 | X.Y.Z -> X.Y+1.Z | [summary] |
| 2 | ... | ... |

### Code Changes
- [List of code changes applied from changelogs]

### Validation Results
| Check | Status |
|-------|--------|
| nuxt build | Pass/Fail |
| Lint | Pass/Fail |

### Files Modified
[List of modified files beyond the CLI conversion]

### Next Steps
- Commit the conversion: `git add -A && git commit -m "chore: convert frontend to vendor mode (nuxt-extensions X.Y.Z -> A.B.C)"`
- Review VENDOR.md for accuracy
- Use `/lt-dev:frontend:update-nuxt-extensions-core` for future framework updates

### Vendor Modification Policy (read before editing `app/core/`)

The vendored module is a **comprehension aid**, not a fork. Edit
`app/core/` **only** for changes that are generally useful to every
@lenne.tech/nuxt-extensions consumer (bugfixes, broad enhancements like
new composables or SSR fixes, security fixes, type-compat).
Project-specific behavior belongs outside `app/core/` -- use
`app/composables/`, `app/components/`, `app/middleware/`, or plugin
overrides.

Generally-useful changes MUST flow back upstream via
`/lt-dev:frontend:contribute-nuxt-extensions-core` -- otherwise they rot
in this project's vendor tree and re-conflict on every sync. The full
policy text is in `app/core/VENDOR.md`.
```

---

## Dry-Run Report

When `--dry-run` is specified:

```markdown
## Frontend Vendor Mode Conversion Analysis (DRY-RUN)

### Version Gap
- Current npm version: X.Y.Z
- Target vendor version: A.B.C

### Changelog Entries Available
| # | Version | Status |
|---|---------|--------|
| 1 | X.Y.Z -> X.Y+1.Z | Available |
| 2 | ... | Available / Missing |

### Expected Breaking Changes
[From changelog/releases]

### Expected Code Changes
[Summary of what would be modified]

### Recommendation
[Proceed / Review changelogs first / Manual steps needed]
```

---

## Error Recovery

If blocked:

1. Document error with full context
2. Check if the error is from the CLI conversion or from changelog application
3. For CLI errors: suggest manual `lt frontend convert-mode` with different options
4. For changelog errors: try alternative approach from nuxt-base-starter reference
5. If truly stuck:
   - Create detailed error report
   - Suggest manual resolution steps
   - Offer to revert: `git checkout .`

---

## Success Criteria

| Criterion | Required |
|-----------|----------|
| CLI conversion completed | Yes |
| VENDOR.md exists at app/core/VENDOR.md | Yes |
| All changelog entries applied | Yes |
| nuxt build passes | Yes |
| Lint passes | Yes |
| Report generated | Yes |
