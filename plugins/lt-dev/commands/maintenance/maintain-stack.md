---
description: 'Fully automated maintenance of all lt base repos in dependency order. Wave 1 (nuxt-extensions, nest-server, lt-monorepo, cli) is maintained and released (npm via GitHub release/publish.yml, or template tagging). After npm propagation, wave 2 (nuxt-base-starter, nest-server-starter) is raised to the new versions and released. Then the full /lt-dev:fullstack:smoke-test runs as the release gate, including TurboOps deploy, online verification and a complete cleanup. Each finding is fixed in the base repo that caused it, re-released as a patch, and the smoke test repeats until the stack is clean. Leaves no test artifacts behind.'
argument-hint: '[--only=<repo,repo>] [--skip-smoke-test] [--smoke-rounds=1] [--release-as=patch|minor|major] [--dry-run]'
allowed-tools: Read, Edit, Write, Grep, Glob, Bash, Agent, AskUserQuestion, Skill, SendMessage, ToolSearch
disable-model-invocation: true
---

# Maintain Stack

Orchestrates stack-wide maintenance following the skill **`maintaining-lt-stack`**.
The skill is the single source of truth for order, recipes, wait patterns and
pitfalls, so load it first. This command describes only the orchestration.

**Why unrestricted `Bash`:** this command drives six repos through `git`, `gh`,
`glab`, `npm`/`pnpm`/`yarn`, `node`, the `turbo` CLI and `mongosh` across two
release waves plus the smoke-test gate — the CLI surface is too broad and too
repo-dependent to enumerate as individual patterns.

> **Effort policy.** No `effort` in the frontmatter: the command runs at the session's level, so a developer who
> raises effort for a risky release round gets it here too. This command cannot run in an eval (it releases real
> repositories), so the decision rests on the work it consists of: in every lt-dev measurement of that work (Opus 5.5,
> `plugins/lt-dev/evals`, 2026-09-25), code review, planning and builds, the default `medium` reached the quality of
> `high` and `xhigh`, which took 1.3 to more than 3 times as long. Pin a level only when a measurement shows it adds quality.

## When to Use

- Regular stack release cycle (all base repos (Grund-Repos) current and published)
- After larger framework changes, before customer projects update
- As a smaller preliminary step: maintain individual repos with `/lt-dev:maintenance:maintain` in each repo

## Workflow

### Turn endings

This command runs to completion without check-ins. A message without a tool call ends the turn and stops the run, so status notes and recommendations go in the same message as the next tool call, and work that does not depend on the user carries on; waiting on npm propagation or CI means polling again, not reporting. The run stops only at the handoff points this command defines (a red Phase 0 preflight, the `--dry-run` plan, the report after the third Phase 5 iteration), when a step is blocked by something only the user can resolve, or before a destructive or irreversible action that needs confirmation. The releases themselves are the job the user started this command for.

### Phase 0 — Preflight (hard gate: stop on red)

- `gh auth status` (github.com, repo scope), and the push channel per repo via
  `bash "${CLAUDE_PLUGIN_ROOT}/scripts/check-push-channel.sh" <repo-root>`
  (field 1: `ssh` → push normally, `https` → use the fallback from the skill).
  Do not use `ssh-add -l`: it queries the agent from `$SSH_AUTH_SOCK` and ignores
  the `IdentityAgent` from `~/.ssh/config`. With 1Password setups it is therefore
  always a false negative, and it used to force needless HTTPS pushes. The skill
  explains the details.
- All 6 repos: correct branch (nest-server: `develop`, all others `main`), clean
  working tree, up to date via `git pull`. A dirty repo stops the run with a list
  of findings, because foreign changes must never be swept into release commits.
- Smoke-test prerequisites (the Phase 0 table in the smoke-test command), unless
  `--skip-smoke-test` is set.

### Phase 1 — Wave 1 (nuxt-extensions ∥ nest-server ∥ lt-monorepo ∥ cli)

Per repo: the `lt-dev:npm-package-maintainer` agent (FULL, without commit), then
the orchestrator commits, versions and releases following the skill recipe.
Repos may run in parallel (separate directories); run at most 2 CPU-heavy
`check` runs at once. `--release-as` sets the version bump (default: derive it
from the diff; dependency-only changes ⇒ patch).

A maintainer agent's final message is its report, not proof that the task is done. Compare it against the task given; when items are still open and no blocker is named, resume the same agent via `SendMessage` to its agent id, naming the open items. After two or three continuations on the same task, stop and report the gap instead.

**Release gate per repo (skill rule "No change → no release"):** Skip a repo as
"already current — no release" only when truly nothing has changed in it (clean
working tree and no commits since the last released version). Never mint a
version without any change. Every real repo change (dependencies, code,
scripts, lockfile, tooling pins) justifies a new version.

### Phase 2 — npm propagation

Poll `npm view <pkg> version` (30 s interval, 15 min timeout) for
`@lenne.tech/nuxt-extensions`, `@lenne.tech/nest-server` and `@lenne.tech/cli`.
On timeout, check `gh run list --workflow publish.yml` and fix the action
failure (re-run). Do not stack a new tag on top.

### Phase 3 — Wave 2 (nuxt-base-starter ∥ nest-server-starter)

Follow the skill recipe: raise the dependency version, run `pnpm run update`
plus the migration guides (nest-server-starter), run the maintenance agent, run
`check` twice (repo root and template), follow the commit convention, release.

### Phase 4 — Release gate: smoke test

Run `/lt-dev:fullstack:smoke-test` (via the `Skill` tool: `lt-dev:fullstack:smoke-test`) with `--rounds=<--smoke-rounds>` (default 1)
to completion. The test clones the freshly released states from GitHub, so it
validates exactly what customers get.

### Phase 5 — Findings → patch releases (loop)

Fix each smoke-test finding in the base repo that **caused** it, never only in
the throwaway project. Release it as a patch using the repo recipe, wait for npm
propagation and repeat the smoke-test phase until no findings remain (at most 3
iterations, then report the open items).

### Phase 6 — Cleanliness + report

- Verify the smoke-test cleanup (stage URLs offline, GitLab repo gone,
  TurboOps project gone, local registry/Caddy empty, project folder deleted).
- List policy leftovers (a DB drop that a hook policy blocks) as manual
  one-liners. Do not work around them. Server volumes are not a leftover: they
  are deleted through the TurboOps MCP, as smoke-test Phase 7 describes.
- No maintenance leftovers: no stashes, no work branches, no half-finished
  releases (every tag has its npm version).
- Final report: per repo old→new version, release links, smoke-test result,
  findings + fixes, open manual items.

## Flags

- `--only=<repos>` — subset of repos. Dependency rules stay active: a starter
  pulls in its npm package as a prerequisite.
- `--skip-smoke-test` — maintenance and releases only (e.g. a pure security fix).
- `--smoke-rounds=<n>` — MR rounds in the smoke test (default 1).
- `--release-as=patch|minor|major` — force the version bump instead of deriving it.
- `--dry-run` — analyse and print the plan only; no writes, no releases.

## Related

- Skill `maintaining-lt-stack` — **load first**; all recipes and pitfalls.
- `/lt-dev:fullstack:smoke-test` — the release gate (Phase 4).
- `/lt-dev:maintenance:maintain` — single-repo maintenance.
- Agent `lt-dev:npm-package-maintainer` — dependency work per repo.
