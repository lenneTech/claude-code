# ADR-016: The plugins support macOS, Linux and Windows: `.gitattributes` keeps scripts LF, and Plugin CI runs on all three, with Windows reporting without blocking

**Date:** 2026-09-14 · **Status:** accepted · **Topic:** CI
**Origin:** reconstructed 2026-11-18 from git history, .gitattributes, .github/workflows/plugin-ci.yml

## Context

On 2026-09-14 a series of commits made the plugins work outside macOS: `block-dangerous-bash` also checks PowerShell
commands (08ae97d), the update lock helper picks the `stat` format by platform (1094429), and a missing `timeout`
falls back to `gtimeout` or perl (49b43da). b8093c6 found that "Git for Windows defaults to core.autocrlf=true.
Without attributes, a marketplace clone there gets CRLF in every .sh file and bash aborts on the first line." The
same day 3929105 added Plugin CI.

## Decision

- The plugins support macOS, Linux and Windows (Git Bash, and PowerShell where Claude Code runs commands through it).
- `.gitattributes` sets `* text=auto eol=lf`, forces LF for `*.sh` and `.githooks/*`, and marks binaries as binary.
- `.github/workflows/plugin-ci.yml` runs on `ubuntu-latest`, `macos-latest` and `windows-latest`, with
  `core.autocrlf=true` set before the checkout. It fails on CRLF in scripts (checked through `git ls-files --eol`)
  and runs every Bash and Node test, the context budgets, the rule invariants, `claude plugin validate` for each
  plugin and the mod tests; later steps run even when an earlier one fails.
- The Windows leg runs with `continue-on-error`: it shows what is red there without blocking.

## Rationale

- b8093c6: "A checkout with autocrlf=true produced 51 script files with CRLF without this file and none with it."
- 3929105: "The windows leg uses continue-on-error: it shows what is red there without blocking."
  `plugin-ci.yml:18`: "Windows reports what is red there without blocking until the plugin runs natively."
- 30102b7: line endings are checked through git because "The first windows run reported every script as CRLF through
  grep, while ubuntu and macos passed the same check."
- Why Windows is supported at all: not documented. [inferred] The plugins are meant to run on Windows clients too;
  inferred from the Windows fixes on 2026-09-14 and later (ed86948, "CRLF from native jq on Windows").

## Rejected alternatives

None documented.

## Consequences

- Every hook and script stays portable (ADR-004); a fix that works only on macOS fails CI on ubuntu.
- While the Windows leg does not block, a Windows regression is visible in CI but stops neither a merge nor a release.
- Tests avoid timing that slow runners break (85d4749, "hook tests no longer race the 2 s stdin limit on slow Windows
  runners").

## Evidence

- 08ae97d, 1094429, 49b43da (2026-09-14): PowerShell check, `stat` by platform, `timeout` fallback
- b8093c6 (2026-09-14) "chore: add .gitattributes to keep scripts LF on every OS"
- 3929105 (2026-09-14) "ci: add plugin CI on ubuntu, macos and windows"
- 30102b7 (2026-09-14) "ci: check line endings via git and keep running later steps"
- ed86948 (2026-10-08) "fix(lt-dev): CRLF from native jq on Windows, Windows-only test gates"; 85d4749 (2026-10-19)
- `.gitattributes:1-4`; `.github/workflows/plugin-ci.yml:17-19`, `:27`, `:32-41`; house rule 21
