# ADR-012: Installed lenne.Tech plugins keep themselves current: lt-dev runs `lt claude plugins` in the background at session start and, in running sessions, from its hooks module

**Date:** 2026-04-14 · **Status:** accepted · **Topic:** Distribution
**Origin:** reconstructed 2026-11-18 from git history, plugins/lt-dev/hooks/hooks.json, update scripts, hooks module

## Context

Version 7.14.0 (1db380b, 2026-04-14) added "auto-update lt CLI and Claude Code plugins on session start". Sessions
that stay open for days never start again, so on 2026-11-11 (67673d9) lt-dev added a hooks module that also updates
and reloads running sessions.

## Decision

- At `SessionStart` (`startup|resume|clear`), `update-lt-plugins.sh` reports a pending update notice and starts
  `update-lt-plugins-background.sh` detached. That script installs or updates the lt CLI and runs
  `lt claude plugins` under a lock, at most once an hour after a successful run (`_lt-plugins-config.sh`).
- In an interactive session the hooks module (`hooks/plugin-updates.js`) checks every ten minutes. When the last
  update on the machine is twelve hours old it starts `update-lt-plugins-scheduled.sh`; when the installed version of
  a lenne.Tech plugin changed it runs `/reload-plugins`, at once when idle, otherwise when the running turn ends. It
  never reloads with `--force`; a reload that would change plugin MCP servers is reported instead.
- Both paths cover the plugins of the public and of the private marketplace, and both stay out of headless runs
  (`claude -p`).

## Rationale

- `hooks/plugin-updates.js:4-5`: "A machine whose sessions stay open for days gets releases anyway."
- `hooks/plugin-updates.js:11-14`: "Cost model: no model call and no tokens while nothing changes … One reload per
  release, without --force: skills, commands, agents and hooks keep the prompt cache, and a reload that would change
  plugin MCP tools is skipped by Claude Code and reported here."
- 1db380b gives no reason beyond its subject. [inferred] Releases come several times a week (231 version bumps between
  2025-12-08 and 2026-11-18), and a session on an old release follows rules that were already corrected; inferred
  from the release cadence in the git log.

## Rejected alternatives

- **Updating only at session start** (1db380b until 67673d9): kept, but not enough on its own, because long-running
  sessions never reach it (`plugin-updates.js:4-5`).
- **Asking Claude to run `/reload-plugins`**: Claude cannot run it (746e613, 2026-10-18: "The lt-dev update notice
  asks the user to type /reload-plugins, which Claude cannot run itself."). The module runs it through the mods API.

## Consequences

- A release reaches a machine within about twelve hours and a running session within about ten minutes after that;
  there is no staged rollout, so a broken release spreads just as fast.
- A plugin fix takes effect in a session only after the reload (house rule 32).
- The update depends on the lt CLI (ADR-003) and on npm being reachable from the hook's environment.

## Evidence

- 1db380b (2026-04-14) "chore: bump version to 7.14.0", body "auto-update lt CLI and Claude Code plugins on session
  start": `update-lt-plugins.sh`, `update-lt-plugins-background.sh`, `_lt-plugins-config.sh`
- 746e613 (2026-10-18) "chore: bump version to 8.26.1"
- 67673d9 (2026-11-11) "feat(lt-dev): running sessions install and reload lenne.Tech plugin releases on their own"
- `plugins/lt-dev/hooks/hooks.json` (`SessionStart`, `"modules"`); `plugins/lt-dev/hooks/plugin-updates.js:1-30`;
  `plugins/lt-dev/hooks/scripts/_lt-plugins-config.sh` (throttle and schedule);
  `plugins/lt-dev/hooks/scripts/update-lt-plugins-background.sh:54-100`; `plugins/lt-dev/README.md:55`;
  house rules 19a, 32
