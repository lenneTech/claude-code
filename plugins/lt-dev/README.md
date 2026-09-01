# lt-dev Plugin

lenne.tech Development Skills, Commands and Hooks for Claude Code - Frontend (Nuxt 4), Backend (NestJS), TDD and CLI Tools.

## Installation

```bash
claude plugins install lt-dev --marketplace lenne-tech
```

## Recommended Plugins

These plugins are **optional** but enhance the experience when working with this plugin:

| Plugin | Marketplace | Purpose | Install Command |
|--------|-------------|---------|-----------------|
| `typescript-lsp` | claude-plugins-official | TypeScript language server for better code intelligence | `claude plugins install typescript-lsp --marketplace claude-plugins-official` |

## Features

- **Backend Development**: NestJS with @lenne.tech/nest-server (supports both npm-mode and vendored-mode projects — see below)
- **Frontend Development**: Nuxt 4 with Nuxt UI
- **TDD Workflows**: Test-Driven Development with story-based implementation
- **Nest-Server Updates**: Automated migration guides and stepwise upgrades (auto-delegates to `nest-server-core-updater` in vendored projects)
- **Fullstack Updates**: Synchronize projects with latest starter templates
- **CLI Tools**: lenne.tech CLI integration
- **Git Workflows**: Commit messages, MR descriptions, branch rebasing
- **Code Review**: Comprehensive review across 9 review domains
- **Runnability Gate**: `/lt-dev:check` runs the project's `check` script with iterate-until-green auto-fix and mandatory audit-finding fix escalation (also integrated into review + rebase workflows)
- **Linear Integration**: Issue management and story creation
- **Docker**: Development and production setup generation
- **Package Maintenance**: npm dependency management and security audits
- **Frontend Security**: OWASP-based security auditing (XSS, CSRF, CSP)
- **Agent Teams**: Parallel workflow coordination for complex tasks
- **Plugin Development**: Claude Code plugin best practices and validation
- **Framework Contribution**: Local `pnpm link` workflow for modifying `@lenne.tech/nest-server` / `@lenne.tech/nuxt-extensions` and validating changes from a starter
- **Dev Server Lifecycle**: Enforced `run_in_background` / `pkill` contract to prevent orphaned processes across TDD, framework linking, and MCP-driven debugging
- **Alignment before code**: A grilling loop that walks the open decisions one at a time, each with a recommendation, and looks facts up in the codebase rather than asking — wired into ticket creation, planning, and the implementation flow
- **Parallel sessions**: Coordination rules for several sessions working one project or the base repos at once. Linear and Git stay the claim protocol, `ListAgents` gives the live picture for free, and a cross-session message is spent only where it changes what the other session does next: a warning, a claim, a diagnosis worth handing over, or a question the peer answers cheaply
- **Writing quality**: An `unslop` pass that strips AI tells from tickets, commit bodies, MR descriptions, docs, and customer copy, with a German pattern set (Nominalstil, Floskeln, Füllwörter, Gedankenstrich) on top of the English one

## Included

- **27 Skills** - Auto-detected contextual expertise (includes `grilling-decisions` for settling open decisions before implementation, `running-check-script` for runnability validation, `managing-dev-servers` for dev-server lifecycle rules, `contributing-to-lt-framework` for pnpm link workflows, `coordinating-peer-sessions` for parallel sessions on one project, and `unslop` for cutting AI tells out of every text that reaches a human)
- **25 Agents** - Autonomous task execution
- **64 Commands** - User-triggered actions via `/lt-dev:<name>`
- **18 Hook Scripts** across 8 event types (SessionStart, PreToolUse, PostToolUse, PostToolUseFailure, UserPromptSubmit, StopFailure, SessionEnd, PostCompact) - Automated project detection and validation
- **Helper Scripts** - Plugin-local shell helpers under `plugins/lt-dev/scripts/` (e.g. `discover-check-scripts.sh` for monorepo-aware `check` discovery, `peer-ledger.sh` for cross-session claims and diagnoses, `change-provenance.sh` for attributing changes this session did not write, `chrome-devtools-mcp-launcher.sh` as Chrome MCP wrapper)
- **3 MCP Servers** - Chrome DevTools, Linear, and Nuxt UI (Figma via the official `figma` plugin as a companion)

## Chrome DevTools MCP — Canary auto-detection

The `chrome-devtools` MCP server is launched via `scripts/chrome-devtools-mcp-launcher.sh`. On macOS the launcher checks for Google Chrome Canary in `/Applications/`, `~/Applications/`, and via `mdfind` on the bundle identifier `com.google.Chrome.canary`. If Canary is present, it appends `--channel=canary` so the automated browser shows up with the yellow Canary icon in the window switcher and is clearly distinguishable from the developer's daily-driver Chrome. Without Canary (or on non-macOS systems) the launcher behaves exactly like the previous static invocation — stable Chrome, no extra flags.

Override the auto-detection with the `CHROME_MCP_CHANNEL` environment variable:

```bash
CHROME_MCP_CHANNEL=stable claude   # force stable even if Canary is installed
CHROME_MCP_CHANNEL=canary claude   # force canary (only useful for testing the flag)
```

## Parallel sessions on one project

Claude Code sessions can list and message each other (v2.1.224+, on by default). The plugin uses that sparingly and in a fixed order.

**Cheapest channel first.** Linear stays the claim protocol for tickets and Git for branches, because both are free to read and stay true after a session ends. `ListAgents` adds who is alive right now. Only what none of those carry goes over a message, since a delivered message costs the receiving session a full prompt in the middle of its work.

**Seven occasions justify one.** Three protect a peer from doing the wrong thing (`LANDED`, `CLAIM`, `CONFLICT`), two save it work (`SOLVED`, `READY`), one asks it for something it answers cheaply (`ASK`), and one asks who wrote a change and what they were solving (`ORIGIN`). Progress reports, "I am finished", and anything readable in the repo are not on the list. The `coordinating-peer-sessions` skill holds the protocol; `take-ticket`, `ticket-cycle`, `review`, `git:ship`, `dev-submit`, `debug`, `running-check-script`, `contributing-to-lt-framework`, `maintaining-lt-stack`, `rebasing-branches`, and `validating-changes-in-browser` each apply it at the point where parallel work actually collides or actually helps.

**A diff says what changed, never why.** That gap is invisible while the session reading the diff is the session that wrote it, and three routine situations open it: base-repo work stays uncommitted by house rule, `/clear` drops a session's own memory while its files live on, and two sessions occasionally share a checkout. `scripts/change-provenance.sh` separates what this process wrote from what it found and names the live sessions that could explain the difference, so `review`, `git:ship`, `dev-submit`, `debug`, and `rebasing-branches` ask one targeted question instead of reviewing, committing, or resolving somebody else's work in progress as if it were their own. Reviewer sub-agents cannot reach a peer, so the orchestrator resolves it once and passes the answer down in every prompt.

**What has to outlive a session gets written down.** Messages are not history: a session starting later never learns what was sent before it existed, and a claim dies with the session that made it. `scripts/peer-ledger.sh` persists the two cases where that loss is expensive — open claims on cross-cutting work, and diagnoses worth keeping — per repository under `${CLAUDE_PLUGIN_DATA}`, never inside a project. A claim is bound to its session's process, so a crashed session's claim reads as stale and free to take instead of blocking the topic forever.

**`/lt-dev:peers` answers it on demand.** Live sessions, open claims, recorded diagnoses, and any foreign uncommitted changes in one read-only report. It sends nothing.

**A `SessionStart` hook says when it matters.** `detect-peer-sessions.sh` reports how many other sessions are live and how many of them sit in this repository, so coordination is a question only when there is something to coordinate with.

**Coordination is settled between sessions; decisions go to you.** Who takes which ticket, who fixes a shared finding, and who waits for whom are resolved session-to-session without a prompt. Scope, priority, risk, anything destructive, anything a permission prompt would cover, and a contested claim that one exchange did not settle always reach the user.

**One setup caveat.** With `crossSessionInbound` unset, Claude Code decides per message from both sessions' permission modes and delivers only when the two match (both bypassing prompts, or both prompting). Mixed in either direction means an approval dialog that expires after `dialogExpiry`, five minutes by default — which is exactly how coordination fails on unattended sessions. Setting `crossSessionInbound: "accept"` in user settings (or via `/config` → "Messages from your other sessions") removes the classification and is the fix; matching permission modes is the workaround when the default has to stay.

## Framework consumption modes (nest-server)

lenne.tech api projects can consume `@lenne.tech/nest-server` in one of two modes:

- **npm mode** (classic): `@lenne.tech/nest-server` is installed as a dependency. Framework source lives in `node_modules/@lenne.tech/nest-server/`. Imports use the bare specifier `from '@lenne.tech/nest-server'`. Updated via `/lt-dev:backend:update-nest-server` → `nest-server-updater` agent.
- **vendored mode**: the framework's `core/` directory is copied directly into the project at `<api-root>/src/core/` and managed as first-class project code. There is NO `@lenne.tech/nest-server` npm dependency. Imports use relative paths (`from '../../../core'`). Local patches are allowed and logged in `<api-root>/src/core/VENDOR.md`. Updated via `/lt-dev:backend:update-nest-server-core` → `nest-server-core-updater` agent; local changes are proposed back upstream via `/lt-dev:backend:contribute-nest-server-core` → `nest-server-core-contributor` agent.

**Detection**: `test -f <api-root>/src/core/VENDOR.md` → vendored, else npm. The `detect-nest-server` hook, the `nest-server-updater` agent, and the `nest-server-core-vendoring` skill all perform this check automatically and branch accordingly. All skills and agents that reference framework files (`generating-nest-servers`, `building-stories-with-tdd`, `backend-dev`, etc.) carry a preamble listing both path conventions.

## Linear conventions

**New tickets are created in `Open` — always, unless the user explicitly asks for
another status.** This is not cosmetic: the auto-pick pool of
`/lt-dev:take-ticket` and `/lt-dev:ticket-cycle` is *Open ∪ Fix needed* and
deliberately **excludes `Backlog`** (what the team consciously deferred must not
be picked up automatically). A ticket filed in `Backlog` is therefore invisible to
the whole cycle until someone moves it by hand.

This applies everywhere a ticket is created — the guided `/lt-dev:create-*`
commands, follow-ups spun off during `take-ticket` / `ticket-cycle` / `review`,
and ad-hoc tickets created directly via the Linear MCP.

The one deliberate exception: a follow-up that can only be worked **after the
current change is merged** is not created at all until that merge has landed
(see the dependency gate in `take-ticket` STEP 9a) — precisely because an `Open`
ticket is immediately pickable by a parallel session.

## Further Reading

The comprehensive guide for the full lenne.tech fullstack ecosystem — covering both the `lt` CLI and this `lt-dev` plugin — is maintained in the CLI repository:

- **[LT-ECOSYSTEM-GUIDE](https://github.com/lenneTech/cli/blob/main/docs/LT-ECOSYSTEM-GUIDE.md)** — Full reference: architecture, CLI commands, plugin commands, agents, skills, vendor-mode workflows, decision matrix, glossary
- **[VENDOR-MODE-WORKFLOW](https://github.com/lenneTech/cli/blob/main/docs/VENDOR-MODE-WORKFLOW.md)** — Step-by-step guide: npm → vendor conversion, update workflows, vendor → npm rollback, troubleshooting

Both documents reference each other and are kept in sync with CLI releases.

## For lenne.tech team members

Authorized lenne.tech team members have access to **additional internal plugins** via a private, unlisted marketplace (separate from the public `lenne-tech` marketplace). Access and setup are covered in internal onboarding — ask your team lead if you don't have it yet.

## License

MIT - lenne.tech GmbH
