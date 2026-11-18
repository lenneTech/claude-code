# ADR-004: Hook handlers are Bash scripts that run on macOS bash 3.2, Linux and Git Bash and degrade without jq; JavaScript runs only in a hooks module, for what a settings hook cannot do

**Date:** 2025-12-18 · **Status:** accepted · **Topic:** Hooks
**Origin:** reconstructed 2026-11-18 from git history, plugins/*/hooks/hooks.json, hook scripts, README.md

## Context

The hooks that version 2.2.0 introduced (16a4fce, 2025-12-18) were Bash scripts (`detect-nuxt.sh`,
`detect-nest-server.sh`, `detect-lt-cli.sh`) plus one TypeScript hook started through `npx ts-node`
(`validate-plugin-frontmatter.ts`, timeout 10 s). Version 7.0.3 (bb98b62, 2026-03-16) converted that one to Bash
("convert frontmatter validation to bash", timeout 5 s). On 2026-11-11 (67673d9) lt-dev added its only JavaScript
handler: a hooks module (`hooks/register.js`, a Claude Code mod) for the plugin updates in running sessions
(ADR-012).

## Decision

- Every settings hook of every plugin runs `bash "${CLAUDE_PLUGIN_ROOT}/hooks/scripts/<name>.sh"`.
- The scripts run on macOS bash 3.2, Linux and Git Bash on Windows: stdin is read with the `read` builtin's own
  timeout instead of GNU `timeout` (`_read-stdin.sh`), `stat` formats are chosen by platform
  (`_lt-plugins-config.sh`), and jq is used when present with a grep/sed fallback when it is not (`_read-prompt.sh`).
- Shared behaviour lives in sourced helpers with a leading underscore (`_read-stdin.sh`, `_read-prompt.sh`,
  `_headless-skip.sh`, `_skip-task-notification.sh`).
- JavaScript runs only in a hooks module loaded through `"modules"` in `hooks.json`, for what a settings hook cannot
  do. lt-dev's module keeps a timer in a running session and runs `/reload-plugins` (`hooks/plugin-updates.js`). Its
  tests run with `claude plugin test` in Plugin CI.
- Which events may carry context, where the `if` field goes, quiet detectors on notification turns and a test for
  every fix are house rules 17 to 21; this ADR records only the implementation language.

## Rationale

For Bash as the hook language: not documented. The conversion commit bb98b62 gives no reason.

[inferred] Bash starts without a package fetch and fits the few-second hook timeouts: the TypeScript hook needed
`npx ts-node` at hook time and a 10-second timeout, its Bash replacement 5 seconds. Inferred from the `hooks.json`
diff of bb98b62.

The portability rules are documented in the code:

- `_read-stdin.sh:20`: "Portable to macOS bash 3.2 and Git Bash without GNU `timeout`"
- `_read-prompt.sh:9`: "jq is preferred. Without it (Git Bash on Windows ships none), the JSON string is …"

For the module, `hooks/plugin-updates.js:11`: "Cost model: no model call and no tokens while nothing changes. A timer
reads two small files every CHECK_INTERVAL_MS".

## Rejected alternatives

- **TypeScript hooks run through `npx ts-node`** (`validate-plugin-frontmatter.ts`, 2025-12-18 to 2026-03-16):
  replaced by a Bash script (bb98b62); reason not documented.

## Consequences

- The README lists jq as a requirement "which the hooks use to read their input" (`README.md:52`), yet every hook
  keeps working without it; the hook tests run the fallback with a PATH that lacks jq.
- A hook script stays within what bash 3.2 and Git Bash offer, and its tests run on all three CI systems (ADR-016).
- A second JavaScript handler belongs in the same module (`register.js`), with `*.test.ts` tests for
  `claude plugin test`.

## Evidence

- 16a4fce (2025-12-18) "chore: bump version to 2.2.0", body "… hooks with scripts …"
- bb98b62 (2026-03-16) "chore: bump version to 7.0.3", body "… convert frontmatter validation to bash …":
  `npx ts-node …/validate-plugin-frontmatter.ts` (timeout 10) replaced by `bash …/validate-plugin-frontmatter.sh`
  (timeout 5)
- 67673d9 (2026-11-11) "feat(lt-dev): running sessions install and reload lenne.Tech plugin releases on their own":
  `hooks/register.js`, `hooks/plugin-updates.js`, CI step "Mod tests"
- `plugins/lt-dev/hooks/hooks.json` (every handler under `bash "${CLAUDE_PLUGIN_ROOT}/hooks/scripts/…"`,
  `"modules": ["./register.js"]`); `plugins/lt-offers/hooks/hooks.json`, `plugins/lt-showroom/hooks/hooks.json`
- `plugins/lt-dev/hooks/scripts/_read-stdin.sh:17-21`, `_read-prompt.sh:9`;
  `plugins/lt-dev/hooks/scripts/__tests__/compact-context.test.sh:38` (PATH without jq)
- `README.md:52`; `.github/workflows/plugin-ci.yml` step "Mod tests"; house rules 17 to 21
