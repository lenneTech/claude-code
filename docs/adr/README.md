# Architecture Decision Records

An **ADR** (*Architecture Decision Record*) records one decision: what was open, what was chosen
and above all **why**, with evidence. Code shows what was built, never why it was not built
differently. That is the part that gets lost, and the part that keeps a later change from undoing
a decision by accident.

- **No ADR without evidence.** Every claim carries a source: a commit, `path:line`, a ticket, a
  measurement or a verbatim quote. A reason that is only inferred is marked `[inferred]`.
- **An ADR is superseded, never deleted or rewritten.** A changed decision gets a new ADR with
  `**Supersedes:**`; the old one keeps its text, and only its status becomes
  `superseded by ADR-NNN`.

**Before changing architecture, dependencies, the data model, API contracts, permissions or
infrastructure**, read the table below. A change that contradicts an accepted ADR needs an explicit
order to change it or the developer's explicit approval, and then a new ADR that supersedes the old
one.

This log is versioned with the code: no secrets, credentials or personal data.

## Adding an ADR

1. Take the next free number, open branches included; file name `NNN-short-slug.md` (lowercase,
   hyphens, ASCII). With the lt-dev plugin for Claude Code, `/lt-dev:adr` does this.
2. Header: `# ADR-NNN: One sentence that states the decision`, below it
   `**Date:** YYYY-MM-DD · **Status:** accepted · **Topic:** <topic>`, plus
   `**Supersedes:** [ADR-NNN](NNN-slug.md)` when it replaces one.
3. Sections: Context, Decision, Rationale, Rejected alternatives, Consequences, Evidence.
4. Add it to the table below.

**Not an ADR:** a bug fix without a choice, a measurement without consequence, an intermediate
state, or a feature that follows an existing decision.

## All ADRs

<!-- adr-index:start -->
| No | Date | Decision | Status |
|---|---|---|---|
| [001](001-the-plugins-are-published-from-one-public-mit-licensed.md) | 2025-12-08 | The plugins are published from one public, MIT-licensed GitHub repository that is a Claude Code marketplace (`lenne-tech`), one directory per plugin under `plugins/` | accepted |
| [002](002-one-version-for-the-whole-marketplace-scripts-bump-version.md) | 2025-12-08 | One version for the whole marketplace: `scripts/bump-version.ts` raises package.json, marketplace.json and every plugin.json together, then commits, tags `v<version>` and pushes | partially superseded by [ADR-018](018-the-release-commit-carries-only-the-version-bump-the.md) (how the release commit is staged) |
| [003](003-the-lt-cli-lt-claude-plugins-is-the-recommended-installer.md) | 2025-12-10 | The lt CLI (`lt claude plugins`) is the recommended installer: it installs the plugins and copies the `permissions.json` of each plugin into the global user settings | accepted |
| [004](004-hook-handlers-are-bash-scripts-that-run-on-macos-bash-3-2.md) | 2025-12-18 | Hook handlers are Bash scripts that run on macOS bash 3.2, Linux and Git Bash and degrade without jq; JavaScript runs only in a hooks module, for what a settings hook cannot do | accepted |
| [005](005-plugin-and-repository-content-is-english-german-appears.md) | 2025-12-18 | Plugin and repository content is English; German appears only in output that is German and as trigger phrases in skill descriptions | accepted |
| [006](006-claude-code-documentation-is-read-from-a-local-cache-under.md) | 2026-01-09 | Claude Code documentation is read from a local cache under `.claude/docs-cache/`, generated from `sources.json`; the cache is the single source of truth for best practices in this repository | accepted |
| [007](007-plugins-ships-to-user-machines-and-references-only-files.md) | 2026-01-09 | `plugins/` ships to user machines and references only files inside `plugins/`; repository tooling lives in `.claude/` and never ships | accepted |
| [008](008-marketplace-optimization-is-the-repository-only-optimize.md) | 2026-01-09 | Marketplace optimization is the repository-only `/optimize` command, which fans out one optimizer agent per element type plus a marketplace agent | accepted |
| [009](009-code-review-is-a-command-that-spawns-domain-specific.md) | 2026-03-10 | Code review is a command that spawns domain-specific reviewer agents, code reviewers in parallel and browser reviewers one after another | accepted |
| [010](010-capabilities-for-different-audiences-ship-as-separate.md) | 2026-03-22 | Capabilities for different audiences ship as separate plugins of the one marketplace (lt-dev, lt-offers, lt-showroom, lt-tools), without declared dependencies between them | accepted |
| [011](011-framework-api-knowledge-ships-inside-the-lt-framework.md) | 2026-04-04 | Framework API knowledge ships inside the lt framework packages; lt-dev hooks and skills point Claude at those files in `node_modules` instead of restating the API | accepted |
| [012](012-installed-lenne-tech-plugins-keep-themselves-current-lt-dev.md) | 2026-04-14 | Installed lenne.Tech plugins keep themselves current: lt-dev runs `lt claude plugins` in the background at session start and, in running sessions, from its hooks module | accepted |
| [013](013-secrets-and-client-data-are-kept-out-of-the-public.md) | 2026-07-18 | Secrets and client data are kept out of the public repository by one scanner run at three layers (pre-commit, pre-push, CI); a finding is fixed by removing the value | partially superseded by [ADR-020](020-main-is-protected-by-a-ruleset-and-the-internal-denylist.md) (where the denylist check runs: its consequence that CI cannot read the denylist) |
| [014](014-two-marketplaces-the-public-one-carries-only-anonymised.md) | 2026-07-18 | Two marketplaces: the public one carries only anonymised content; anything with internal data goes into the private marketplace | accepted |
| [015](015-plugin-scripts-are-dependency-free-node-es-modules-or-bash.md) | 2026-07-24 | Plugin scripts are dependency-free Node ES modules or Bash; npm dependencies and bun are for repository tooling only | accepted |
| [016](016-the-plugins-support-macos-linux-and-windows-gitattributes.md) | 2026-09-14 | The plugins support macOS, Linux and Windows: `.gitattributes` keeps scripts LF, and Plugin CI runs on all three, with Windows reporting without blocking | accepted |
| [017](017-lt-offers-and-lt-showroom-are-tenant-neutral-company-data.md) | 2026-09-25 | lt-offers and lt-showroom are tenant-neutral: company data comes from the signed-in platform account through MCP, and platform maintenance stays out of the public plugins | accepted |
| [018](018-the-release-commit-carries-only-the-version-bump-the.md) | 2026-10-05 | The release commit carries only the version bump; the content of a release is committed beforehand | accepted |
| [019](019-lt-showroom-works-in-a-throwaway-clone-and-stores-its.md) | 2026-10-11 | lt-showroom works in a throwaway clone and stores its results in the Showroom platform; nothing is written into the analysed project or the developer checkout | accepted |
| [020](020-main-is-protected-by-a-ruleset-and-the-internal-denylist.md) | 2026-11-26 | `main` is protected by a ruleset, and the internal denylist is checked server-side inside lenne.Tech, never as a GitHub secret | accepted |
<!-- adr-index:end -->
